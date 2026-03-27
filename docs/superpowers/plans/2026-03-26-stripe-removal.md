# Stripe Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all dead Stripe code and references from the codebase — Stripe was never used in production; QB Payments is the sole payment engine.

**Architecture:** Pure deletion/cleanup across services, schema, UI components, and config. No new features. The payment-workflow.service.ts gets trimmed to only the methods that are actually called in production (updateCustomerBalance, checkOverdueInvoices, createLocalPayment). Dead cron route (payment-reminders) is removed.

**Tech Stack:** Prisma (migration), Next.js App Router, TypeScript

---

## File Map

**Delete entirely:**
- `lib/services/stripe.service.ts`
- `app/api/webhooks/stripe/route.ts`
- `app/payment/[invoiceId]/page.tsx`
- `app/payment/cancel/page.tsx`
- `app/payment/success/page.tsx`
- `app/api/cron/payment-reminders/route.ts`

**Heavy modification:**
- `lib/services/payment-workflow.service.ts` — remove 5 dead methods + stripeService import
- `app/api/webhooks/docusign/route.ts` — remove dead sendPaymentLinkAfterSignature call
- `app/api/invoices/[id]/send-payment-link/route.ts` — rewrite to use QB sendInvoice

**Light cleanup (remove Stripe field references):**
- `prisma/schema.prisma` — drop 6 Stripe columns
- `lib/services/identity-mapper.ts` — remove stripe_id
- `lib/services/notification.service.ts` — remove "Stripe" text
- `components/invoices/payment-status-card.tsx` — remove Stripe fields
- `app/dashboard/invoices/[id]/page.tsx` — remove Stripe external IDs + timeline refs
- `app/dashboard/payments/page.tsx` — remove Stripe filter/badge
- `app/dashboard/payments/[id]/page.tsx` — remove Stripe badge/field
- `app/dashboard/customers/[id]/edit/CustomerEditForm.tsx` — remove stripe_id display
- `app/api/customers/route.ts` — remove stripe_id from schema
- `components/analytics/payment-methods-chart.tsx` — remove stripe color
- `package.json` — remove stripe dependency
- `.env.example` — remove STRIPE_* vars

---

### Task 1: Delete Stripe service and webhook

**Files:**
- Delete: `lib/services/stripe.service.ts`
- Delete: `app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Delete the files**

```bash
rm lib/services/stripe.service.ts
rm app/api/webhooks/stripe/route.ts
```

- [ ] **Step 2: Verify no remaining imports**

```bash
grep -r "stripe.service" lib/ app/ components/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".planning"
```

Expected: Only `payment-workflow.service.ts` (fixed in Task 3)

- [ ] **Step 3: Commit**

```bash
git add -A lib/services/stripe.service.ts app/api/webhooks/stripe/
git commit -m "chore: delete dead stripe service and webhook handler

Stripe was never used in production. QB Payments is the sole payment engine."
```

---

### Task 2: Delete legacy payment pages

**Files:**
- Delete: `app/payment/[invoiceId]/page.tsx`
- Delete: `app/payment/cancel/page.tsx`
- Delete: `app/payment/success/page.tsx`

- [ ] **Step 1: Delete the files**

```bash
rm -r app/payment/
```

- [ ] **Step 2: Commit**

```bash
git add -A app/payment/
git commit -m "chore: delete legacy stripe payment pages

These pages were never used. Active payment pages are at /payment-v2/ and /hub/pay/."
```

---

### Task 3: Clean payment-workflow.service.ts

**Files:**
- Modify: `lib/services/payment-workflow.service.ts`

Remove the `stripeService` import (line 2), the Stripe Invoice interface fields (`stripePaymentLinkId` on line 13, `stripe_id` on line 19), and these dead methods:
- `sendPaymentLinkAfterSignature()` (lines 44-101)
- `handlePaymentSuccess()` (lines 107-181)
- `createLocalPayment()` — remove `stripePaymentId` param and dedup check (lines 187-228)
- `handlePaymentFailed()` (lines 233-271)
- `syncPaymentToQuickBooks()` (lines 277-377) — entirely Stripe-dependent
- `sendReminderForInvoice()` (lines 419-452) — only called by dead sendPaymentReminders
- `sendPaymentReminders()` (lines 458-526) — queries stripePaymentLinkId, never finds anything
- `resendPaymentLink()` (lines 584-656)

**Keep:**
- `updateCustomerBalance()` (lines 382-413) — used by overdue-invoices cron indirectly and hub charge
- `checkOverdueInvoices()` (lines 532-578) — used by overdue-invoices cron

- [ ] **Step 1: Rewrite the file**

Replace the entire file content with only the kept methods:

```typescript
import { prisma } from '@/lib/db';
import { InvoiceStatus } from '@prisma/client';

/**
 * Payment Workflow Service
 *
 * Orchestrates payment-adjacent workflows:
 * - Track overdue invoices (daily cron)
 * - Recalculate customer balances
 */
export class PaymentWorkflowService {
  /**
   * Update customer balance from invoices and payments
   */
  async updateCustomerBalance(customerId: string): Promise<void> {
    try {
      const invoiceStats = await prisma.invoice.aggregate({
        where: { customerId },
        _sum: { amount: true, amountPaid: true },
      });

      const paymentStats = await prisma.payment.aggregate({
        where: { customerId },
        _sum: { amount: true },
      });

      const totalInvoiced = Number(invoiceStats._sum.amount || 0);
      const totalPaid = Number(paymentStats._sum.amount || invoiceStats._sum.amountPaid || 0);
      const balance = totalInvoiced - totalPaid;

      await prisma.customer.update({
        where: { id: customerId },
        data: {
          qbTotalInvoiced: totalInvoiced,
          qbTotalPaid: totalPaid,
          qbBalance: Math.max(0, balance),
          lastQbBalanceSync: new Date(),
        },
      });

      console.log(`[PAYMENT_WORKFLOW] Customer ${customerId} balance updated: $${balance.toFixed(2)}`);
    } catch (error) {
      console.error(`[PAYMENT_WORKFLOW] Failed to update customer balance:`, error);
    }
  }

  /**
   * Check for overdue invoices and mark them as overdue
   * Called by cron job daily at 2:00 AM UTC
   */
  async checkOverdueInvoices(): Promise<{ overdue: number; errors: number }> {
    try {
      console.log(`[PAYMENT_WORKFLOW] Checking for overdue invoices...`);

      const now = new Date();

      const overdueInvoices = await prisma.invoice.findMany({
        where: {
          status: InvoiceStatus.SENT,
          dueDate: { lt: now },
        },
        include: {
          customer: true,
        },
      });

      console.log(`[PAYMENT_WORKFLOW] Found ${overdueInvoices.length} overdue invoices`);

      let overdue = 0;
      let errors = 0;

      for (const invoice of overdueInvoices) {
        try {
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              status: InvoiceStatus.OVERDUE,
              markedOverdueAt: new Date(),
            },
          });
          overdue++;
          console.log(`[PAYMENT_WORKFLOW] Invoice ${invoice.id} marked as OVERDUE`);
        } catch (error) {
          console.error(`[PAYMENT_WORKFLOW] Failed to mark invoice ${invoice.id} as overdue:`, error);
          errors++;
        }
      }

      console.log(`[PAYMENT_WORKFLOW] Overdue check complete: ${overdue} marked overdue, ${errors} errors`);

      return { overdue, errors };
    } catch (error) {
      console.error(`[PAYMENT_WORKFLOW] Failed to check overdue invoices:`, error);
      throw error;
    }
  }
}

export const paymentWorkflowService = new PaymentWorkflowService();
```

- [ ] **Step 2: Verify build doesn't break**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: May show errors in files that import removed methods (fixed in Tasks 4-5)

- [ ] **Step 3: Commit**

```bash
git add lib/services/payment-workflow.service.ts
git commit -m "refactor: remove all dead stripe methods from payment-workflow service

Keep only updateCustomerBalance and checkOverdueInvoices which are
actively used by cron jobs and hub charge routes."
```

---

### Task 4: Fix DocuSign webhook — remove dead payment link call

**Files:**
- Modify: `app/api/webhooks/docusign/route.ts`

- [ ] **Step 1: Remove import and dead call**

Remove line 4 (`import { paymentWorkflowService }`).

Replace lines 203-236 (the entire `if (contract.invoice)` block that calls `sendPaymentLinkAfterSignature`) with a simple log:

```typescript
        // Payment: QB invoice email already sent at creation time
        // (invoice-workflow.service.ts → quickbooksService.sendInvoice)
        // No additional payment link needed after contract signing.
        if (contract.invoice) {
          console.log(`[DOCUSIGN_WEBHOOK] Contract signed for invoice ${contract.invoice.id} — QB invoice email already sent`);
        }
```

- [ ] **Step 2: Verify the webhook still compiles**

```bash
npx tsc --noEmit app/api/webhooks/docusign/route.ts 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add app/api/webhooks/docusign/route.ts
git commit -m "fix: remove dead stripe payment link call from docusign webhook

QB invoice email is already sent at invoice creation time.
The sendPaymentLinkAfterSignature call always failed silently."
```

---

### Task 5: Rewrite send-payment-link route to use QB

**Files:**
- Modify: `app/api/invoices/[id]/send-payment-link/route.ts`

- [ ] **Step 1: Rewrite the route**

Replace the entire file:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { InvoiceStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/invoices/[id]/send-payment-link
 * Re-send QB invoice email to customer (includes card + PayPal payment options)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== "ADMIN" && userRole !== "FINANCE") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: { customer: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status === InvoiceStatus.PAID) {
      return NextResponse.json(
        { error: "Invoice is already paid" },
        { status: 400 }
      );
    }

    if (invoice.status === InvoiceStatus.VOID) {
      return NextResponse.json(
        { error: "Invoice is voided" },
        { status: 400 }
      );
    }

    if (!invoice.quickbooks_invoice_id) {
      return NextResponse.json(
        { error: "Invoice is not synced to QuickBooks" },
        { status: 400 }
      );
    }

    // Initialize QB and re-send invoice email
    await quickbooksService.initialize();
    await quickbooksService.sendInvoice(
      invoice.quickbooks_invoice_id,
      invoice.customer.email
    );

    // Log the action
    await prisma.integrationLog.create({
      data: {
        service: "QUICKBOOKS",
        action: "INVOICE_EMAIL_RESENT",
        status: "SUCCESS",
        payload: {
          invoiceId: params.id,
          qbInvoiceId: invoice.quickbooks_invoice_id,
          sentBy: (session.user as any).id,
          recipientEmail: invoice.customer.email,
        } as any,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Invoice email sent successfully via QuickBooks",
    });
  } catch (error) {
    console.error("[SEND_INVOICE_EMAIL_ERROR]", error);

    await prisma.integrationLog.create({
      data: {
        service: "QUICKBOOKS",
        action: "INVOICE_EMAIL_RESEND_FAILED",
        status: "ERROR",
        error: error instanceof Error ? error.message : "Unknown error",
        payload: { invoiceId: params.id } as any,
      },
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send invoice email" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/invoices/[id]/send-payment-link/route.ts
git commit -m "feat: rewrite send-payment-link to use QB invoice email

Replaces dead Stripe payment link creation with QB sendInvoice.
Admin can now actually resend invoice emails from the dashboard."
```

---

### Task 6: Delete dead payment-reminders cron

**Files:**
- Delete: `app/api/cron/payment-reminders/route.ts`
- Modify: `vercel.json` — remove the cron entry

- [ ] **Step 1: Delete the cron route**

```bash
rm app/api/cron/payment-reminders/route.ts
```

- [ ] **Step 2: Remove from vercel.json**

Remove the cron entry:
```json
{
  "path": "/api/cron/payment-reminders",
  "schedule": "0 10 * * *"
},
```

The real invoice email reminders are handled by `send-scheduled-invoices` cron.

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/payment-reminders/ vercel.json
git commit -m "chore: remove dead payment-reminders cron

This cron queried stripePaymentLinkId (always null) so never sent reminders.
Actual invoice reminders are handled by send-scheduled-invoices cron via QB."
```

---

### Task 7: Prisma schema — drop Stripe columns

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Remove Stripe fields from schema**

Remove these lines:
- Line 44: `stripe_id            String?          @unique` (Customer model)
- Line 291: `stripe_invoice_id     String?          @unique` (Invoice model)
- Line 304: `stripePaymentIntentId String?          @unique` (Invoice model)
- Line 305: `stripePaymentLinkId   String?          @unique` (Invoice model)
- Line 309: `stripePaymentLinkUrl  String?` (Invoice model)
- Line 342: `stripe_payment_id     String?   @unique` (Payment model)

- [ ] **Step 2: Create migration**

```bash
npx prisma migrate dev --name remove_stripe_fields
```

- [ ] **Step 3: Generate Prisma client**

```bash
npm run db:generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "chore: drop stripe columns from database schema

Remove stripe_id (Customer), stripe_invoice_id, stripePaymentIntentId,
stripePaymentLinkId, stripePaymentLinkUrl (Invoice), stripe_payment_id (Payment).
Stripe was never used in production."
```

---

### Task 8: Clean up identity-mapper.ts

**Files:**
- Modify: `lib/services/identity-mapper.ts`

- [ ] **Step 1: Remove stripe_id references**

Remove/fix these locations:
- Line 7: remove `stripe_id?: string;` from ExternalIds interface
- Lines 78-79: remove the `if (externalIds.stripe_id && !customer.stripe_id)` block
- Line 125: remove `stripe_id: externalIds.stripe_id,` from create data
- Line 142: remove `"stripe"` from the service union type in `findByExternalId`
- Lines 154-155: remove the `case "stripe"` block
- Line 179: remove `"stripe"` from the service union type in `addExternalId`
- Lines 191-192: remove the `case "stripe"` block

- [ ] **Step 2: Commit**

```bash
git add lib/services/identity-mapper.ts
git commit -m "chore: remove stripe_id from identity mapper"
```

---

### Task 9: Clean up notification.service.ts

**Files:**
- Modify: `lib/services/notification.service.ts`

- [ ] **Step 1: Fix Stripe text**

- Line 830: change `Pay Now with Stripe` to `Pay Now`
- Line 844: change `Secure payments powered by Stripe` to `Secure payments powered by QuickBooks`

- [ ] **Step 2: Commit**

```bash
git add lib/services/notification.service.ts
git commit -m "chore: remove stripe branding from notification emails"
```

---

### Task 10: Clean up dashboard invoice detail page

**Files:**
- Modify: `app/dashboard/invoices/[id]/page.tsx`

- [ ] **Step 1: Fix timeline references**

- Lines 174-183: The "Link de Pagamento Enviado" timeline step checks `stripePaymentLinkId`. Replace with `emailSentAt` check (invoice email sent via QB):

```typescript
    {
      title: "Invoice Enviado",
      status:
        invoice.emailSentAt
          ? ("completed" as const)
          : invoice.contract?.status === ContractStatus.SIGNED
          ? ("current" as const)
          : ("pending" as const),
      date: invoice.emailSentAt || null,
      description: invoice.emailSentAt
        ? "Invoice enviado ao cliente via QuickBooks"
        : invoice.contract?.status === ContractStatus.SIGNED
        ? "Aguardando envio do invoice..."
        : "Contrato precisa ser assinado primeiro",
    },
```

- Lines 191-203: The "Pagamento" timeline step checks `stripePaymentLinkId`. Replace:

```typescript
    {
      title: "Pagamento",
      status:
        invoice.status === InvoiceStatus.PAID
          ? ("completed" as const)
          : invoice.emailSentAt
          ? ("current" as const)
          : ("pending" as const),
      date: invoice.paidAt,
      description:
        invoice.status === InvoiceStatus.PAID
          ? `Pago via ${invoice.paymentMethod || "QuickBooks"}`
          : invoice.emailSentAt
          ? `Aguardando pagamento (${invoice.paymentReminderCount || 0} lembretes enviados)`
          : "Aguardando pagamento",
    },
```

- [ ] **Step 2: Remove Stripe external IDs section**

Lines 413-428: Remove the `stripe_invoice_id` and `stripePaymentIntentId` display blocks. Update the "no IDs" fallback on lines 429-433:

```typescript
                {!invoice.quickbooks_invoice_id && (
                    <p className="text-gray-400 text-sm">Nenhum ID externo sincronizado ainda</p>
                )}
```

- [ ] **Step 3: Remove Stripe fields from payment-status-card prop**

Lines 627-633: Remove `stripePaymentLinkId` and `stripePaymentIntentId` from the object passed to the payment status card.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/invoices/[id]/page.tsx
git commit -m "refactor: replace stripe references with QB in invoice detail page

Timeline now checks emailSentAt instead of stripePaymentLinkId.
External IDs section no longer shows Stripe fields."
```

---

### Task 11: Clean up payment-status-card component

**Files:**
- Modify: `components/invoices/payment-status-card.tsx`

- [ ] **Step 1: Remove Stripe fields from interface and display**

- Lines 17-18: Remove `stripePaymentLinkId` and `stripePaymentIntentId` from the invoice type
- Lines 133-155: Remove the `stripePaymentLinkId` "Payment Link" display block and the `stripePaymentIntentId` "Stripe ID" display block
- Lines 165-170: The "Send Payment Link" button text checks `stripePaymentLinkId`. Change to always show "Send Payment Link":

```typescript
            {isSending ? "Sending..." : "Send Payment Link"}
```

- [ ] **Step 2: Commit**

```bash
git add components/invoices/payment-status-card.tsx
git commit -m "chore: remove stripe fields from payment status card"
```

---

### Task 12: Clean up payments dashboard pages

**Files:**
- Modify: `app/dashboard/payments/page.tsx`
- Modify: `app/dashboard/payments/[id]/page.tsx`

- [ ] **Step 1: Clean payments list page**

- Line 89: Remove `whereClause.stripe_payment_id = null;` from manual filter (keep QB null check)
- Line 182: Remove `stripe_payment_id: null,` from manual payments count query
- Line 444: Remove `<option value="stripe">Stripe</option>` from source filter dropdown
- Lines 687-688: Change `isStripeSynced` logic — remove `stripe_payment_id` check, simplify `isManual`:

```typescript
                  const isQBSynced = !!payment.quickbooks_payment_id;
                  const isManual = !isQBSynced;
```

- Line 691: Remove `payment.paymentMethod === "stripe"` from the variant check
- Line 748: Remove `{isStripeSynced && <Badge variant="info">Stripe</Badge>}`

- [ ] **Step 2: Clean payment detail page**

- Lines 90-91: Remove `isStripeSynced`, simplify `isManual`:

```typescript
  const isQBSynced = !!payment.quickbooks_payment_id;
  const isManual = !isQBSynced;
```

- Lines 139-143: Remove `isStripeSynced` badge block
- Lines 198-204: Remove Stripe Payment ID display block

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/payments/
git commit -m "chore: remove stripe references from payments dashboard"
```

---

### Task 13: Clean up remaining files

**Files:**
- Modify: `app/dashboard/customers/[id]/edit/CustomerEditForm.tsx`
- Modify: `app/api/customers/route.ts`
- Modify: `components/analytics/payment-methods-chart.tsx`
- Modify: `.env.example`

- [ ] **Step 1: CustomerEditForm**

- Line 23: Remove `stripe_id: string | null;` from type
- Line 190: Remove `customer.stripe_id` from the condition
- Lines 206-209: Remove the Stripe badge block

- [ ] **Step 2: Customers API route**

- Line 28: Remove `stripe_id: z.string().optional(),` from zod schema
- Line 121: Remove `stripe_id: data.stripe_id,` from externalIds

- [ ] **Step 3: Payment methods chart**

- Line 32: Remove `stripe: "#8b5cf6",`

- [ ] **Step 4: Remove Stripe env vars from .env.example**

Remove lines 11-15:
```
STRIPE_SECRET_KEY=""
STRIPE_PUBLISHABLE_KEY=""
STRIPE_WEBHOOK_SECRET=""
STRIPE_PAYMENT_SUCCESS_URL="https://your-domain.com/payment/success"
STRIPE_PAYMENT_CANCEL_URL="https://your-domain.com/payment/cancel"
```

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/customers/ app/api/customers/route.ts components/analytics/ .env.example
git commit -m "chore: remove remaining stripe references from dashboard and config"
```

---

### Task 14: Remove stripe npm package

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Uninstall stripe**

```bash
npm uninstall stripe
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors (all imports removed in prior tasks)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove stripe npm package"
```

---

### Task 15: Final verification

- [ ] **Step 1: Full build check**

```bash
npm run build
```

Expected: Build succeeds with no Stripe-related errors

- [ ] **Step 2: Verify no remaining Stripe references in active code**

```bash
grep -r "stripe" lib/ app/ components/ --include="*.ts" --include="*.tsx" -l | grep -v node_modules | grep -v ".planning" | grep -v "docs/"
```

Expected: Zero results (or only comments/strings that say "not Stripe")

- [ ] **Step 3: Verify cron jobs still work**

Check that `overdue-invoices` cron still imports and calls the trimmed service:

```bash
grep -r "paymentWorkflowService" app/api/cron/ --include="*.ts"
```

Expected: Only `overdue-invoices/route.ts`

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "chore: stripe removal complete — verify clean build"
```
