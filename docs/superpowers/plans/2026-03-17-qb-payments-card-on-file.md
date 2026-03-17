# QB Payments Credit Card on File — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-charge invoices on their due date via QuickBooks Payments API when customers have a card or bank account on file, and remove Stripe from the active payment flow.

**Architecture:** Add a QB Payments API layer to the existing `quickbooks.service.ts` (separate base URL, same OAuth tokens). A daily cron job at 00:30 UTC queries invoices due today, checks for payment methods on file via QB Payments API, and charges automatically. Retry logic handles failures (3 attempts over 4 days). Stripe is removed from active flows but files/data are preserved.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma ORM (PostgreSQL/Neon), QuickBooks Payments API v4, Vercel Cron Jobs.

**Spec:** `docs/superpowers/specs/2026-03-17-qb-payments-card-on-file-design.md`

---

## Phased Rollout Strategy

This plan is split into 4 phases with validation gates. **Do NOT proceed to the next phase until the current phase is validated.**

| Phase | What | Risk | Gate |
|-------|------|------|------|
| 1 | API layer + test endpoint | Low | Manual test confirms API connectivity |
| 2 | Cron in DRY_RUN mode | Low | Logs show correct invoices would be charged |
| 3 | Live charging (1 customer, then all) | Medium | First real charge succeeds end-to-end |
| 4 | Stripe removal | Low | QB Payments working for 1+ week |

---

## File Map

| Action | Phase | File | Responsibility |
|--------|-------|------|---------------|
| Modify | 1 | `prisma/schema.prisma` | Add `AutoChargeStatus` enum + 6 new fields on Invoice |
| Modify | 1 | `lib/services/quickbooks.service.ts` | Add `paymentsBaseUrl`, `paymentsRequest()`, and 7 new public methods |
| Modify | 1 | `lib/services/quickbooks.service.ts:1274-1309` | Update `createPayment()` to accept `source` parameter |
| Create | 1 | `app/api/quickbooks/payments/test/route.ts` | Test endpoint: validate QB Payments API connectivity |
| Create | 2 | `app/api/cron/auto-charge-invoices/route.ts` | Daily cron with DRY_RUN support |
| Modify | 2 | `vercel.json` | Add `auto-charge-invoices` cron entry |
| Modify | 4 | `lib/services/payment-workflow.service.ts` | Remove Stripe from active flows |
| Modify | 4 | `app/api/invoices/[id]/send-payment-link/route.ts` | Deprecate endpoint |

---

# PHASE 1: API Layer + Test Endpoint (Low Risk)

**Goal:** QB Payments API is connected and returning data. No charges, no schema used yet by production code.

---

## Task 1: Schema — Add AutoChargeStatus enum and Invoice fields

**Files:**
- Modify: `prisma/schema.prisma:196-238` (Invoice model)

- [ ] **Step 1: Add AutoChargeStatus enum to Prisma schema**

Add after the existing enums (before `model Customer`):

```prisma
enum AutoChargeStatus {
  CHARGED
  RETRY_PENDING
  FAILED
  SKIPPED
}
```

- [ ] **Step 2: Add new fields to Invoice model**

Add before the `@@map("invoices")` line (line 237):

```prisma
  autoChargeAttempts    Int               @default(0)
  lastAutoChargeAt      DateTime?
  lastAutoChargeError   String?
  autoChargeStatus      AutoChargeStatus?
  nextAutoChargeRetry   DateTime?
  autoChargePaymentRef  String?
```

- [ ] **Step 3: Generate Prisma client and push schema**

Run:
```bash
npm run db:generate
npm run db:push
```

Expected: Schema pushed successfully, no errors. New fields default to null/0 — no impact on existing data.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add AutoChargeStatus enum and auto-charge fields to Invoice"
```

---

## Task 2: QB Payments API layer — paymentsRequest and payment method methods

**Files:**
- Modify: `lib/services/quickbooks.service.ts`

- [ ] **Step 1: Add `paymentsBaseUrl` property and initialize in constructor**

In the class properties section (after line 46), add:

```typescript
private paymentsBaseUrl: string;
```

In the constructor (after line 63, the `this.baseUrl = ...` line), add:

```typescript
this.paymentsBaseUrl = isProduction
  ? "https://api.intuit.com/quickbooks/v4/payments"
  : "https://sandbox.api.intuit.com/quickbooks/v4/payments";
```

- [ ] **Step 2: Add `paymentsRequest()` private method**

Add after the existing `request()` method (after line ~230). This follows the same pattern but uses `paymentsBaseUrl` and includes `Request-Id` header support:

```typescript
/**
 * Make a request to the QB Payments API (separate from Accounting API).
 * Uses same OAuth tokens but different base URL.
 */
private async paymentsRequest(
  endpoint: string,
  options: RequestInit = {},
  requestId?: string
): Promise<any> {
  const startTime = Date.now();

  try {
    return await this.circuitBreaker.execute(async () => {
      if (!this.accessToken) {
        const error: any = new Error("Quickbooks access token not configured");
        error.status = 401;
        throw error;
      }

      const url = `${this.paymentsBaseUrl}${endpoint}`;

      console.log(`[QuickBooks Payments] Requesting: ${url}`);

      const headers: Record<string, string> = {
        "Authorization": `Bearer ${this.accessToken}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
        ...((options.headers as Record<string, string>) || {}),
      };

      if (requestId) {
        headers["Request-Id"] = requestId;
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        if (this.refreshToken) {
          console.log("[QuickBooks Payments] Attempting to refresh access token...");
          await this.refreshAccessToken();
          return this.paymentsRequest(endpoint, options, requestId);
        }
        throw new Error("QuickBooks Payments access token expired.");
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[QuickBooks Payments] API Error ${response.status}: ${errorText}`);
        const error: any = new Error(`QuickBooks Payments API error (${response.status}): ${response.statusText}`);
        error.status = response.status;
        error.responseText = errorText;
        throw error;
      }

      return response.json();
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    await integrationLogger.logError(
      "quickbooks_payments",
      endpoint,
      error,
      { errorCode: "PAYMENTS_API_ERROR", category: "transient", severity: "error", recovery: "retry", metadata: { endpoint } },
      { endpoint, method: options.method || "GET", durationMs }
    );
    throw error;
  }
}
```

- [ ] **Step 3: Add `getCustomerCards()` method**

Add after `paymentsRequest()`:

```typescript
/**
 * List all credit/debit cards on file for a QB customer.
 * QB Payments API: GET /customers/{id}/cards
 */
async getCustomerCards(qbCustomerId: string): Promise<any[]> {
  try {
    const result = await this.paymentsRequest(`/customers/${qbCustomerId}/cards`);
    return result || [];
  } catch (error: any) {
    if (error.status === 404) return [];
    throw error;
  }
}
```

- [ ] **Step 4: Add `getCustomerBankAccounts()` method**

```typescript
/**
 * List all bank accounts on file for a QB customer.
 * QB Payments API: GET /customers/{id}/bank-accounts
 */
async getCustomerBankAccounts(qbCustomerId: string): Promise<any[]> {
  try {
    const result = await this.paymentsRequest(`/customers/${qbCustomerId}/bank-accounts`);
    return result || [];
  } catch (error: any) {
    if (error.status === 404) return [];
    throw error;
  }
}
```

- [ ] **Step 5: Add `getCustomerPaymentMethods()` method**

```typescript
/**
 * Get all payment methods on file for a QB customer (cards + bank accounts).
 * Returns { cards: [...], bankAccounts: [...] }
 */
async getCustomerPaymentMethods(qbCustomerId: string): Promise<{
  cards: any[];
  bankAccounts: any[];
  hasPaymentMethod: boolean;
}> {
  const [cards, bankAccounts] = await Promise.all([
    this.getCustomerCards(qbCustomerId),
    this.getCustomerBankAccounts(qbCustomerId),
  ]);
  return {
    cards,
    bankAccounts,
    hasPaymentMethod: cards.length > 0 || bankAccounts.length > 0,
  };
}
```

- [ ] **Step 6: Add `chargeCard()` method**

```typescript
/**
 * Charge a stored credit card via QB Payments API.
 * POST /charges
 */
async chargeCard(params: {
  cardId: string;
  amount: number;
  currency?: string;
  description?: string;
  requestId: string;
}): Promise<any> {
  const chargeData = {
    amount: params.amount.toFixed(2),
    currency: params.currency || "USD",
    card: { id: params.cardId },
    capture: true,
    context: {
      mobile: "false",
      isEcommerce: "true",
    },
    description: params.description,
  };

  return this.paymentsRequest("/charges", {
    method: "POST",
    body: JSON.stringify(chargeData),
  }, params.requestId);
}
```

- [ ] **Step 7: Add `chargeBankAccount()` method**

```typescript
/**
 * Charge a stored bank account via ACH/eCheck.
 * QB Payments API: POST /echecks
 */
async chargeBankAccount(params: {
  bankAccountId: string;
  amount: number;
  currency?: string;
  description?: string;
  requestId: string;
}): Promise<any> {
  const echeckData = {
    amount: params.amount.toFixed(2),
    currency: params.currency || "USD",
    bankAccount: { id: params.bankAccountId },
    context: {
      mobile: "false",
      isEcommerce: "true",
    },
    description: params.description,
  };

  return this.paymentsRequest("/echecks", {
    method: "POST",
    body: JSON.stringify(echeckData),
  }, params.requestId);
}
```

- [ ] **Step 8: Add `getCharge()` and `getEcheck()` methods**

```typescript
/**
 * Get charge status by ID.
 */
async getCharge(chargeId: string): Promise<any> {
  return this.paymentsRequest(`/charges/${chargeId}`);
}

/**
 * Get eCheck status by ID.
 */
async getEcheck(echeckId: string): Promise<any> {
  return this.paymentsRequest(`/echecks/${echeckId}`);
}
```

- [ ] **Step 9: Commit**

```bash
git add lib/services/quickbooks.service.ts
git commit -m "feat(qb): add QB Payments API layer — cards, bank accounts, charges, echecks"
```

---

## Task 3: Update `createPayment()` to accept source parameter

**Files:**
- Modify: `lib/services/quickbooks.service.ts:1274-1309`

- [ ] **Step 1: Update `createPayment()` signature and PrivateNote logic**

Replace lines 1274-1309 with:

```typescript
async createPayment(data: {
  customerId: string;
  invoiceId: string;
  amount: number;
  paymentDate?: Date;
  paymentMethod?: string;
  referenceNumber?: string;
  source?: "auto_charge" | "stripe" | "manual";
}): Promise<any> {
  let privateNote: string | undefined;
  if (data.referenceNumber) {
    switch (data.source) {
      case "auto_charge":
        privateNote = `QB Payments Auto-Charge: ${data.referenceNumber}`;
        break;
      case "stripe":
        privateNote = `Stripe Payment: ${data.referenceNumber}`;
        break;
      case "manual":
        privateNote = `Manual Payment: ${data.referenceNumber}`;
        break;
      default:
        privateNote = `Payment: ${data.referenceNumber}`;
    }
  }

  const paymentData = {
    CustomerRef: {
      value: data.customerId,
    },
    TotalAmt: data.amount,
    TxnDate: (data.paymentDate || new Date()).toISOString().split("T")[0],
    PrivateNote: privateNote,
    Line: [
      {
        Amount: data.amount,
        LinkedTxn: [
          {
            TxnId: data.invoiceId,
            TxnType: "Invoice",
          },
        ],
      },
    ],
  };

  const result = await this.request("/payment", {
    method: "POST",
    body: JSON.stringify(paymentData),
  });

  console.log(`[QuickBooks] Payment created: ${result.Payment?.Id}`);
  return result.Payment;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/services/quickbooks.service.ts
git commit -m "refactor(qb): update createPayment to accept source parameter instead of hardcoded Stripe note"
```

---

## Task 4: Test endpoint — validate QB Payments API connectivity

**Files:**
- Create: `app/api/quickbooks/payments/test/route.ts`

- [ ] **Step 1: Create the test route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { quickbooksService } from "@/lib/services/quickbooks.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/quickbooks/payments/test?customerId={qbCustomerId}
 *
 * Test endpoint to validate QB Payments API connectivity and list
 * payment methods on file for a given customer.
 * Admin-only access.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin-only access
    if ((session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");

    if (!customerId) {
      return NextResponse.json(
        { error: "customerId query parameter is required (QuickBooks customer ID)" },
        { status: 400 }
      );
    }

    await quickbooksService.initialize();

    // Test: Check QB Payments API is reachable by listing payment methods
    let paymentMethods;
    try {
      paymentMethods = await quickbooksService.getCustomerPaymentMethods(customerId);
    } catch (error: any) {
      return NextResponse.json({
        connected: false,
        paymentsApiReachable: false,
        error: error.message,
        hint: "Ensure QuickBooks Payments is enabled on your QB account and OAuth tokens are valid.",
      }, { status: 502 });
    }

    return NextResponse.json({
      connected: true,
      paymentsApiReachable: true,
      customer: { qbId: customerId },
      paymentMethods: {
        cards: paymentMethods.cards.map((c: any) => ({
          id: c.id,
          last4: c.number?.slice(-4),
          brand: c.cardType || c.type,
          expMonth: c.expMonth,
          expYear: c.expYear,
        })),
        bankAccounts: paymentMethods.bankAccounts.map((ba: any) => ({
          id: ba.id,
          last4: ba.accountNumber?.slice(-4),
          bankName: ba.bankName || ba.name,
        })),
      },
      hasPaymentMethod: paymentMethods.hasPaymentMethod,
    });
  } catch (error: any) {
    console.error("[QB Payments Test] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Build and test manually**

Run: `npm run build && npm run dev`

Then test:
```bash
curl "http://localhost:3000/api/quickbooks/payments/test?customerId=YOUR_QB_CUSTOMER_ID"
```

Expected: JSON response with `connected: true` and payment methods list.

- [ ] **Step 3: Commit**

```bash
git add app/api/quickbooks/payments/test/route.ts
git commit -m "feat(qb): add test endpoint for QB Payments API connectivity validation"
```

---

## PHASE 1 VALIDATION GATE

**Before proceeding to Phase 2, confirm ALL of these:**

- [ ] `npm run build` succeeds with no errors
- [ ] Test endpoint returns `connected: true` for a real QB customer ID
- [ ] Test endpoint correctly shows cards/bank accounts on file (or empty arrays)
- [ ] Test endpoint returns `connected: false` with helpful error for invalid customer
- [ ] No existing functionality is broken (invoice creation, payment reminders still work)

**STOP HERE.** Deploy Phase 1 to production. Test the `/payments/test` endpoint in production with a real customer. Only proceed to Phase 2 when confident the API layer works.

---

# PHASE 2: Cron Job in DRY_RUN Mode (Low Risk)

**Goal:** Cron runs daily, identifies which invoices WOULD be charged, logs everything, but charges nothing.

---

## Task 5: Auto-charge cron job with DRY_RUN mode

**Files:**
- Create: `app/api/cron/auto-charge-invoices/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create the cron route with DRY_RUN support**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { InvoiceStatus, AutoChargeStatus } from "@prisma/client";
import { integrationLogger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

const BATCH_SIZE = 20;

// Set to false to enable real charging (Phase 3)
const DRY_RUN = process.env.AUTO_CHARGE_DRY_RUN !== "false";

/**
 * GET /api/cron/auto-charge-invoices
 *
 * Daily cron (00:30 UTC) — auto-charges invoices due today if customer
 * has a payment method on file in QuickBooks.
 *
 * DRY_RUN mode (default): logs what WOULD happen without charging.
 * Set AUTO_CHARGE_DRY_RUN=false env var to enable real charging.
 *
 * Runs BEFORE overdue-invoices cron (02:00 UTC) to prevent race conditions.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`[CRON] Starting auto-charge-invoices job... (DRY_RUN: ${DRY_RUN})`);

    await quickbooksService.initialize();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Query: invoices due today (first attempt) + retry-pending invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        amount: { gt: 0 },
        OR: [
          // First attempt: due today, SENT status, never attempted
          {
            dueDate: { gte: today, lt: tomorrow },
            status: InvoiceStatus.SENT,
            autoChargeStatus: null,
          },
          // Retries: pending retry, due today or earlier, under 3 attempts
          ...(!DRY_RUN ? [{
            autoChargeStatus: AutoChargeStatus.RETRY_PENDING,
            nextAutoChargeRetry: { lte: tomorrow },
            autoChargeAttempts: { lt: 3 },
          }] : []),
        ],
      },
      include: { customer: true },
      take: BATCH_SIZE,
      orderBy: { dueDate: "asc" },
    });

    console.log(`[CRON] Found ${invoices.length} invoices to auto-charge`);

    let charged = 0;
    let skipped = 0;
    let failed = 0;
    const dryRunLog: any[] = [];

    for (const invoice of invoices) {
      try {
        const qbCustomerId = invoice.customer.quickbooks_id;

        // Skip if no QB customer ID
        if (!qbCustomerId) {
          console.log(`[CRON] Skipping invoice ${invoice.id} — no QB customer ID`);
          if (!DRY_RUN) {
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: { autoChargeStatus: AutoChargeStatus.SKIPPED },
            });
          }
          skipped++;
          continue;
        }

        // Check for payment methods on file
        const methods = await quickbooksService.getCustomerPaymentMethods(qbCustomerId);

        if (!methods.hasPaymentMethod) {
          console.log(`[CRON] Skipping invoice ${invoice.id} — no payment method on file`);
          if (!DRY_RUN) {
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: { autoChargeStatus: AutoChargeStatus.SKIPPED },
            });
          }
          skipped++;
          continue;
        }

        // Determine payment method (card > bank account)
        const attemptNumber = invoice.autoChargeAttempts + 1;
        const requestId = `auto-charge-${invoice.id}-${attemptNumber}`;
        const amount = Number(invoice.amount);
        const description = `Invoice ${invoice.invoiceNumber || invoice.id}`;
        const paymentType = methods.cards.length > 0 ? "card_on_file" : "ach_on_file";

        // === DRY RUN: log only, don't charge ===
        if (DRY_RUN) {
          const entry = {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            customerName: invoice.customer.name,
            customerEmail: invoice.customer.email,
            qbCustomerId,
            amount,
            paymentType,
            methodId: methods.cards.length > 0 ? methods.cards[0].id : methods.bankAccounts[0].id,
            wouldCharge: true,
          };
          dryRunLog.push(entry);
          console.log(`[CRON DRY_RUN] WOULD charge invoice ${invoice.invoiceNumber}: $${amount} via ${paymentType} for ${invoice.customer.name}`);
          charged++;
          continue;
        }

        // === LIVE MODE: actually charge ===
        let chargeResult: any;

        if (methods.cards.length > 0) {
          const card = methods.cards[0];
          chargeResult = await quickbooksService.chargeCard({
            cardId: card.id,
            amount,
            description,
            requestId,
          });
        } else {
          const bankAccount = methods.bankAccounts[0];
          chargeResult = await quickbooksService.chargeBankAccount({
            bankAccountId: bankAccount.id,
            amount,
            description,
            requestId,
          });
        }

        console.log(`[CRON] Charge successful for invoice ${invoice.id}: ${chargeResult?.id}`);

        // Create payment in QB Accounting
        const qbInvoiceId = invoice.quickbooks_invoice_id;
        if (qbInvoiceId) {
          await quickbooksService.createPayment({
            customerId: qbCustomerId,
            invoiceId: qbInvoiceId,
            amount,
            paymentMethod: paymentType,
            referenceNumber: chargeResult?.id || requestId,
            source: "auto_charge",
          });
        }

        // Update local invoice
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: InvoiceStatus.PAID,
            amountPaid: amount,
            paidAt: new Date(),
            paymentMethod: paymentType,
            autoChargeStatus: AutoChargeStatus.CHARGED,
            autoChargeAttempts: attemptNumber,
            lastAutoChargeAt: new Date(),
            autoChargePaymentRef: chargeResult?.id || requestId,
          },
        });

        // Update customer balance
        await prisma.customer.update({
          where: { id: invoice.customerId },
          data: {
            qbTotalPaid: { increment: amount },
            qbBalance: { decrement: amount },
            lastQbBalanceSync: new Date(),
          },
        });

        // Log success
        await integrationLogger.logSuccess(
          "quickbooks_payments",
          paymentType === "card_on_file" ? "auto_charge_card" : "auto_charge_ach",
          { invoiceId: invoice.id, chargeId: chargeResult?.id, amount }
        );

        charged++;
      } catch (error: any) {
        console.error(`[CRON] Auto-charge failed for invoice ${invoice.id}:`, error.message);

        if (DRY_RUN) {
          failed++;
          continue;
        }

        const attemptNumber = invoice.autoChargeAttempts + 1;
        const isFinalAttempt = attemptNumber >= 3;

        // Calculate next retry date
        let nextRetry: Date | null = null;
        if (!isFinalAttempt) {
          nextRetry = new Date();
          if (attemptNumber === 1) {
            nextRetry.setDate(nextRetry.getDate() + 1);
          } else {
            nextRetry.setDate(nextRetry.getDate() + 2);
          }
        }

        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            autoChargeAttempts: attemptNumber,
            lastAutoChargeAt: new Date(),
            lastAutoChargeError: error.message?.slice(0, 500),
            autoChargeStatus: isFinalAttempt
              ? AutoChargeStatus.FAILED
              : AutoChargeStatus.RETRY_PENDING,
            nextAutoChargeRetry: nextRetry,
          },
        });

        await integrationLogger.logError(
          "quickbooks_payments",
          "auto_charge_failed",
          error,
          {
            errorCode: "AUTO_CHARGE_FAILED",
            category: "transient",
            severity: isFinalAttempt ? "error" : "warning",
            recovery: isFinalAttempt ? "manual" : "retry",
            metadata: {
              invoiceId: invoice.id,
              attempt: attemptNumber,
              nextRetry: nextRetry?.toISOString(),
            },
          },
          { invoiceId: invoice.id }
        );

        failed++;
      }
    }

    const summary = {
      dryRun: DRY_RUN,
      total: invoices.length,
      charged,
      skipped,
      failed,
      ...(DRY_RUN ? { wouldCharge: dryRunLog } : {}),
    };
    console.log(`[CRON] Auto-charge complete:`, JSON.stringify(summary, null, 2));

    return NextResponse.json(summary);
  } catch (error: any) {
    console.error("[CRON] Auto-charge-invoices job failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Add cron entry to vercel.json**

Add new entry to the `crons` array in `vercel.json`:

```json
{
  "path": "/api/cron/auto-charge-invoices",
  "schedule": "30 0 * * *"
}
```

- [ ] **Step 3: Build and test locally**

```bash
npm run build
npm run dev
curl http://localhost:3000/api/cron/auto-charge-invoices
```

Expected: JSON response with `{ dryRun: true, total: N, charged: N, skipped: N, failed: 0, wouldCharge: [...] }`

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/auto-charge-invoices/route.ts vercel.json
git commit -m "feat(cron): add auto-charge-invoices cron in DRY_RUN mode — logs without charging"
```

---

## PHASE 2 VALIDATION GATE

**Deploy to production with DRY_RUN=true (default). Let it run for 2-3 days. Confirm:**

- [ ] Cron executes daily at 00:30 UTC without errors
- [ ] `wouldCharge` list shows correct invoices (right customers, right amounts)
- [ ] Invoices without payment methods on file are correctly skipped
- [ ] No false positives (invoices that shouldn't be charged)
- [ ] Check Vercel function logs for any errors

**STOP HERE.** Review the dry run logs with Paulo. Only proceed to Phase 3 when the dry run data looks correct.

---

# PHASE 3: Live Charging (Medium Risk)

**Goal:** Enable real charging. Start with one test customer, then open to all.

---

## Task 6: Enable live charging

- [ ] **Step 1: Set environment variable in Vercel**

In Vercel dashboard → Project Settings → Environment Variables:

```
AUTO_CHARGE_DRY_RUN = false
```

This flips the cron from dry-run to live mode. No code change needed.

- [ ] **Step 2: Monitor first live run**

After the next cron execution (00:30 UTC):
1. Check Vercel function logs — any errors?
2. Check IntegrationLog in Prisma Studio — charges logged as SUCCESS?
3. Check QuickBooks — payments created against correct invoices?
4. Check customer's card/bank — charge appeared?

- [ ] **Step 3: Verify end-to-end for first customer**

Confirm:
- [ ] Invoice status changed to PAID in local DB
- [ ] Payment created in QB Accounting with correct note ("QB Payments Auto-Charge: ...")
- [ ] Customer balance updated in local DB
- [ ] Amount matches invoice amount exactly

---

## PHASE 3 VALIDATION GATE

- [ ] At least 1 real charge succeeded end-to-end
- [ ] QB Accounting shows correct payment linked to correct invoice
- [ ] No double charges
- [ ] Failed charges (if any) have correct retry scheduling
- [ ] Run for 1+ week before proceeding to Phase 4

**STOP HERE.** Let auto-charging run for at least 1 week. Monitor IntegrationLog daily.

---

# PHASE 4: Stripe Removal (Low Risk)

**Goal:** Remove Stripe from active payment flows. Only proceed after QB Payments is proven stable.

---

## Task 7: Remove Stripe from payment-workflow.service.ts

**Files:**
- Modify: `lib/services/payment-workflow.service.ts`

- [ ] **Step 1: Mark Stripe import as legacy**

At line 2, add a comment but KEEP the import (still used by `handlePaymentSuccess()` and `syncPaymentToQuickBooks()` for historical webhooks):

```typescript
// LEGACY: stripeService still used by handlePaymentSuccess() and syncPaymentToQuickBooks()
// for processing historical Stripe webhooks. Remove when those methods are also deprecated.
import { stripeService } from './stripe.service';
```

- [ ] **Step 2: Update `sendPaymentLinkAfterSignature()` (lines 44-102)**

Replace the entire method body:

```typescript
async sendPaymentLinkAfterSignature(
  invoice: Invoice,
  contract: Contract
): Promise<void> {
  // Stripe payment links removed — payments now handled via QB Payments on file
  // or manual QB invoice email payment
  console.log(`[PAYMENT_WORKFLOW] sendPaymentLinkAfterSignature called for invoice ${invoice.id} — Stripe removed, skipping`);
}
```

- [ ] **Step 3: Update `sendPaymentReminders()` (lines 458-526)**

Remove the `stripePaymentLinkId: { not: null }` filter at line 471, and remove the Stripe URL construction. Replace lines 468-516 (the query and loop inside the method, keeping the method signature and surrounding try/catch):

```typescript
      const invoicesNeedingReminder = await prisma.invoice.findMany({
        where: {
          status: InvoiceStatus.SENT,
          autoChargeStatus: null, // Only remind invoices not being auto-charged
          OR: [
            {
              dueDate: { lte: sevenDaysFromNow, gte: threeDaysFromNow },
              paymentReminderCount: 0,
            },
            {
              dueDate: { lte: threeDaysFromNow, gte: oneDayFromNow },
              paymentReminderCount: 1,
            },
            {
              dueDate: { lte: oneDayFromNow, gte: now },
              paymentReminderCount: 2,
            },
          ],
        },
        include: {
          customer: true,
        },
      });

      console.log(`[PAYMENT_WORKFLOW] Found ${invoicesNeedingReminder.length} invoices needing reminders`);

      let sent = 0;
      let errors = 0;

      for (const invoice of invoicesNeedingReminder) {
        try {
          // No payment link — reminder tells customer to check their email for the QB invoice
          const paymentUrl = ''; // QB invoice email already has the payment link
          await this.sendReminderForInvoice(invoice, paymentUrl);
          sent++;
        } catch (error) {
          console.error(`[PAYMENT_WORKFLOW] Failed to send reminder for invoice ${invoice.id}:`, error);
          errors++;
        }
      }
```

- [ ] **Step 4: Update `resendPaymentLink()` (lines 584-656)**

Replace with a no-op:

```typescript
async resendPaymentLink(invoiceId: string): Promise<void> {
  // Stripe payment links removed — payments now handled via QB Payments on file
  console.log(`[PAYMENT_WORKFLOW] resendPaymentLink called for invoice ${invoiceId} — Stripe removed, skipping`);
}
```

- [ ] **Step 5: Verify build compiles**

Run:
```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add lib/services/payment-workflow.service.ts
git commit -m "refactor(payments): remove Stripe from active payment flow — QB Payments on file replaces it"
```

---

## Task 8: Deprecate Stripe payment link endpoint

**Files:**
- Modify: `app/api/invoices/[id]/send-payment-link/route.ts`

- [ ] **Step 1: Deprecate the endpoint**

Replace the entire file contents with:

```typescript
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/invoices/[id]/send-payment-link
 *
 * DEPRECATED: Stripe payment links have been removed.
 * Payments are now handled via QuickBooks Payments on file
 * or manual QB invoice email payment.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: "Stripe payment links have been deprecated. Payments are now handled via QuickBooks.",
      deprecated: true,
    },
    { status: 410 }
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/invoices/[id]/send-payment-link/route.ts
git commit -m "deprecate: mark send-payment-link endpoint as 410 Gone — Stripe removed"
```

---

## Task 9: Final build verification

- [ ] **Step 1: Run full build**

```bash
npm run build
```

Expected: Build succeeds, no TypeScript errors.

- [ ] **Step 2: Test auto-charge cron locally**

```bash
curl http://localhost:3000/api/cron/auto-charge-invoices
```

Expected: JSON response showing dry run or live results depending on env var.

- [ ] **Step 3: Test QB Payments API connectivity**

```bash
curl "http://localhost:3000/api/quickbooks/payments/test?customerId=REAL_QB_CUSTOMER_ID"
```

Expected: JSON response with `connected: true` and payment methods list.

- [ ] **Step 4: Final commit**

```bash
git commit --allow-empty -m "feat: QB Payments credit card on file — Phase 4 complete, all phases validated"
```
