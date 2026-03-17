# QB Payments Credit Card on File — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-charge invoices on their due date via QuickBooks Payments API when customers have a card or bank account on file, and remove Stripe from the active payment flow.

**Architecture:** Add a QB Payments API layer to the existing `quickbooks.service.ts` (separate base URL, same OAuth tokens). A daily cron job at 01:00 UTC queries invoices due today, checks for payment methods on file via QB Payments API, and charges automatically. Retry logic handles failures (3 attempts over 4 days). Stripe is removed from active flows but files/data are preserved.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma ORM (PostgreSQL/Neon), QuickBooks Payments API v4, Vercel Cron Jobs.

**Spec:** `docs/superpowers/specs/2026-03-17-qb-payments-card-on-file-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `prisma/schema.prisma` | Add `AutoChargeStatus` enum + 6 new fields on Invoice |
| Modify | `lib/services/quickbooks.service.ts` | Add `paymentsBaseUrl`, `paymentsRequest()`, and 7 new public methods |
| Modify | `lib/services/quickbooks.service.ts:1274-1309` | Update `createPayment()` to accept `source` parameter |
| Create | `app/api/cron/auto-charge-invoices/route.ts` | Daily cron: auto-charge invoices due today |
| Create | `app/api/quickbooks/payments/test/route.ts` | Test endpoint: validate QB Payments API connectivity |
| Modify | `vercel.json` | Add `auto-charge-invoices` cron entry |
| Modify | `lib/services/payment-workflow.service.ts:2` | Remove Stripe import |
| Modify | `lib/services/payment-workflow.service.ts:44-102` | Remove `sendPaymentLinkAfterSignature()` Stripe usage |
| Modify | `lib/services/payment-workflow.service.ts:458-526` | Update `sendPaymentReminders()` — remove Stripe filter |
| Modify | `lib/services/payment-workflow.service.ts:584-656` | Remove `resendPaymentLink()` Stripe usage |

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

Expected: Schema pushed successfully, no errors.

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

    // Test 1: Check QB Payments API is reachable by listing cards
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

- [ ] **Step 2: Test manually**

Run: `npm run dev`

Then in browser or curl:
```bash
curl http://localhost:3000/api/quickbooks/payments/test?customerId=YOUR_QB_CUSTOMER_ID
```

Expected: JSON response with `connected: true` and payment methods list (or empty arrays if customer has no cards on file).

- [ ] **Step 3: Commit**

```bash
git add app/api/quickbooks/payments/test/route.ts
git commit -m "feat(qb): add test endpoint for QB Payments API connectivity validation"
```

---

## Task 5: Auto-charge cron job

**Files:**
- Create: `app/api/cron/auto-charge-invoices/route.ts`

- [ ] **Step 1: Create the cron route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { InvoiceStatus, AutoChargeStatus } from "@prisma/client";
import { integrationLogger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

const BATCH_SIZE = 20;

/**
 * GET /api/cron/auto-charge-invoices
 *
 * Daily cron (00:30 UTC) — auto-charges invoices due today if customer
 * has a payment method on file in QuickBooks.
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

    console.log("[CRON] Starting auto-charge-invoices job...");

    await quickbooksService.initialize();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Query: invoices due today (first attempt) + retry-pending invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        amount: { gt: 0 }, // Skip zero/negative amounts
        OR: [
          // First attempt: due today, SENT status, never attempted
          {
            dueDate: { gte: today, lt: tomorrow },
            status: InvoiceStatus.SENT,
            autoChargeStatus: null,
          },
          // Retries: pending retry, due today or earlier, under 3 attempts
          {
            autoChargeStatus: AutoChargeStatus.RETRY_PENDING,
            nextAutoChargeRetry: { lte: tomorrow },
            autoChargeAttempts: { lt: 3 },
          },
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

    for (const invoice of invoices) {
      try {
        const qbCustomerId = invoice.customer.quickbooks_id;

        // Skip if no QB customer ID
        if (!qbCustomerId) {
          console.log(`[CRON] Skipping invoice ${invoice.id} — no QB customer ID`);
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { autoChargeStatus: AutoChargeStatus.SKIPPED },
          });
          skipped++;
          continue;
        }

        // Check for payment methods on file
        const methods = await quickbooksService.getCustomerPaymentMethods(qbCustomerId);

        if (!methods.hasPaymentMethod) {
          console.log(`[CRON] Skipping invoice ${invoice.id} — no payment method on file`);
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { autoChargeStatus: AutoChargeStatus.SKIPPED },
          });
          skipped++;
          continue;
        }

        // Determine payment method (card > bank account)
        const attemptNumber = invoice.autoChargeAttempts + 1;
        const requestId = `auto-charge-${invoice.id}-${attemptNumber}`;
        const amount = Number(invoice.amount);
        const description = `Invoice ${invoice.invoiceNumber || invoice.id}`;

        let chargeResult: any;
        let paymentType: string;

        if (methods.cards.length > 0) {
          // Charge card (priority)
          const card = methods.cards[0];
          chargeResult = await quickbooksService.chargeCard({
            cardId: card.id,
            amount,
            description,
            requestId,
          });
          paymentType = "card_on_file";
        } else {
          // Charge bank account (ACH/eCheck)
          const bankAccount = methods.bankAccounts[0];
          chargeResult = await quickbooksService.chargeBankAccount({
            bankAccountId: bankAccount.id,
            amount,
            description,
            requestId,
          });
          paymentType = "ach_on_file";
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

        const attemptNumber = invoice.autoChargeAttempts + 1;
        const isFinalAttempt = attemptNumber >= 3;

        // Calculate next retry date
        let nextRetry: Date | null = null;
        if (!isFinalAttempt) {
          nextRetry = new Date();
          if (attemptNumber === 1) {
            nextRetry.setDate(nextRetry.getDate() + 1); // +1 day
          } else {
            nextRetry.setDate(nextRetry.getDate() + 2); // +2 more days (day 3 total)
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

    const summary = { total: invoices.length, charged, skipped, failed };
    console.log(`[CRON] Auto-charge complete:`, summary);

    return NextResponse.json(summary);
  } catch (error: any) {
    console.error("[CRON] Auto-charge-invoices job failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Add cron entry to vercel.json**

Add new entry to the `crons` array in `vercel.json` (before the existing entries):

```json
{
  "path": "/api/cron/auto-charge-invoices",
  "schedule": "30 0 * * *"
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/auto-charge-invoices/route.ts vercel.json
git commit -m "feat(cron): add auto-charge-invoices cron — charges due invoices via QB Payments on file"
```

---

## Task 6: Remove Stripe from payment-workflow.service.ts

**Files:**
- Modify: `lib/services/payment-workflow.service.ts`

- [ ] **Step 1: Keep Stripe import but mark as legacy**

At line 2, the `stripeService` import MUST stay because `handlePaymentSuccess()` (line 112) and `syncPaymentToQuickBooks()` (line 300) still reference it for historical Stripe webhook handling. Add a comment:

```typescript
// LEGACY: stripeService still used by handlePaymentSuccess() and syncPaymentToQuickBooks()
// for processing historical Stripe webhooks. Remove when those methods are also deprecated.
import { stripeService } from './stripe.service';
```

- [ ] **Step 2: Update `sendPaymentLinkAfterSignature()` (lines 44-102)**

This method creates Stripe payment links. Replace the entire method body to be a no-op that logs the deprecation:

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

Remove the `stripePaymentLinkId: { not: null }` filter at line 471, and remove the Stripe URL construction. Replace lines 468-510:

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

Expected: Build succeeds with no TypeScript errors referencing `stripeService`.

- [ ] **Step 6: Commit**

```bash
git add lib/services/payment-workflow.service.ts
git commit -m "refactor(payments): remove Stripe from active payment flow — QB Payments on file replaces it"
```

---

## Task 7: Remove Stripe payment link endpoint

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

## Task 8: Final build verification

- [ ] **Step 1: Run full build**

```bash
npm run build
```

Expected: Build succeeds, no TypeScript errors.

- [ ] **Step 2: Test auto-charge cron locally**

```bash
curl http://localhost:3000/api/cron/auto-charge-invoices
```

Expected: JSON response with `{ total: 0, charged: 0, skipped: 0, failed: 0 }` (no invoices due today in dev).

- [ ] **Step 3: Test QB Payments API connectivity**

```bash
curl "http://localhost:3000/api/quickbooks/payments/test?customerId=REAL_QB_CUSTOMER_ID"
```

Expected: JSON response with `connected: true` and payment methods list.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: QB Payments credit card on file auto-charge — complete implementation"
```
