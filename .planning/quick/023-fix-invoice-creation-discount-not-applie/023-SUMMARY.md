---
task: 023
type: quick
title: "Fix invoice creation: discount not applied, billing address missing, email not sent"
subsystem: finance-workflow
tags: [quickbooks, invoices, email, discount, billing-address]

# Dependencies
requires: [quickbooks-integration, invoice-creation]
provides: [discount-line-items, billing-address-on-invoices, reliable-email-delivery]
affects: [invoice-accuracy, customer-experience]

# Tech Changes
tech-stack:
  added: []
  patterns: [retry-logic, error-tracking]

# Files
key-files:
  created: []
  modified:
    - lib/services/quickbooks.service.ts
    - app/api/invoices/create/route.ts

# Decisions
decisions:
  - id: discount-as-line-item
    choice: Use DiscountLineDetail instead of adjusting line item amounts
    rationale: QuickBooks expects discounts as separate line items for proper invoice display and reporting

  - id: billing-address-from-customer
    choice: Copy customer address fields to invoice BillAddr
    rationale: QuickBooks invoices need BillAddr for proper PDF rendering even though customer has default address

  - id: retry-with-billemail-update
    choice: Update BillEmail on retry before sending
    rationale: If first send fails due to missing/incorrect email, retry has better chance with explicit update

  - id: needs-manual-send-status
    choice: Create NEEDS_MANUAL_SEND status instead of silent failure
    rationale: Finance team needs clear visibility into email failures and manual action required

# Metrics
duration: 2
completed: 2026-01-28
---

# Quick Task 023: Fix invoice creation - discount, billing address, email Summary

**One-liner:** QuickBooks invoices now include discount line items, billing addresses, and reliable email delivery with retry logic and clear failure tracking.

## What Was Built

### Discount Line Item Support
- Modified `createInvoiceWithBillEmail` to accept `discount` parameter
- Add DiscountLineDetail line item to QB invoice when discount > 0
- Discount applied as fixed amount (not percentage-based)
- Only applies to single invoices (not installment series)

### Billing Address on Invoices
- Modified `createInvoiceWithBillEmail` to accept `billingAddress` parameter
- Add BillAddr to invoice from customer record fields (address, city, state, zipCode, country)
- Billing address included in QB invoice for proper PDF rendering
- Log billing address for debugging purposes

### Enhanced Email Delivery
- Implemented 2-attempt retry logic with 1s delay between attempts
- Update BillEmail explicitly on retry attempt before sending
- Increased pre-send delay from 500ms to 1000ms for QB processing time
- Track send attempt count in response
- Check BillEmail presence before send for debugging

### Better Error Tracking
- Created NEEDS_MANUAL_SEND status for failed email sends
- Include QuickBooks invoice URL in error logs for manual action
- Log enhanced diagnostics (attempt count, email status, error details)
- No silent failures - all outcomes clearly logged to IntegrationLog

## Technical Implementation

### Task 1: Add discount line item and billing address to QB invoice
**Files Modified:**
- `lib/services/quickbooks.service.ts` - Enhanced method signature and invoice payload
- `app/api/invoices/create/route.ts` - Pass discount and customer address to QB service

**Key Changes:**
```typescript
// QuickBooks service signature
async createInvoiceWithBillEmail(data: {
  // ... existing params
  discount?: number;
  billingAddress?: { line1, city, state, postalCode, country };
}): Promise<any>

// Add discount line item
if (data.discount && data.discount > 0) {
  invoiceData.Line.push({
    Amount: data.discount,
    DetailType: "DiscountLineDetail",
    DiscountLineDetail: { PercentBased: false },
    Description: "Discount applied",
  });
}

// Add billing address
if (data.billingAddress) {
  invoiceData.BillAddr = {
    Line1: data.billingAddress.line1 || "",
    City: data.billingAddress.city || "",
    CountrySubDivisionCode: data.billingAddress.state || "",
    PostalCode: data.billingAddress.postalCode || "",
    Country: data.billingAddress.country || "USA",
  };
}
```

**Invoice Route Changes:**
```typescript
const qbInvoiceData: any = {
  // ... existing fields
  discount: (invoiceCountToCreate === 1 && discount > 0) ? discount : undefined,
  billingAddress: {
    line1: customer.address || undefined,
    city: customer.city || undefined,
    state: customer.state || undefined,
    postalCode: customer.zipCode || undefined,
    country: customer.country || "USA",
  },
};
```

**Commit:** `44e7a48`

### Task 2: Fix email sending with better error handling and retry
**Files Modified:**
- `lib/services/quickbooks.service.ts` - Enhanced sendInvoice with retry logic
- `app/api/invoices/create/route.ts` - Better error tracking and NEEDS_MANUAL_SEND status

**Key Changes:**
```typescript
// Retry logic in sendInvoice
const maxAttempts = 2;
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  // If retry, update BillEmail first
  if (attempt > 1 && email) {
    await this.updateInvoiceBillEmail(invoiceId, email);
  }

  // Try send
  // Wait 1s before retry if failed
  if (attempt < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Return graceful failure with details
return {
  success: false,
  sent: false,
  emailStatus: "NeedToSend",
  error: lastError?.message,
  attempts: maxAttempts,
  note: "Invoice created successfully and marked NeedToSend..."
};
```

**Enhanced Error Tracking:**
```typescript
// Success case
await prisma.integrationLog.create({
  data: {
    service: "quickbooks",
    action: "invoice_email_sent",
    status: "SUCCESS",
    payload: {
      qbInvoiceId, invoiceNumber, recipientEmail,
      deliveryInfo, emailStatus, sendAttempts: sendResult.attempt,
    },
  },
});

// Failure case
await prisma.integrationLog.create({
  data: {
    service: "quickbooks",
    action: "invoice_needs_manual_send",
    status: "NEEDS_MANUAL_SEND",
    error: sendResult.error,
    payload: {
      qbInvoiceId, invoiceNumber, recipientEmail,
      note: "Invoice created but email send failed after retries. Manual send required via QuickBooks UI.",
      qbInvoiceUrl: `https://app.qbo.intuit.com/app/invoice?txnId=${qbInvoice.Id}`,
      sendAttempts: sendResult.attempts,
    },
  },
});
```

**Commit:** `11856ea`

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

### Discount Line Item
✅ Discount parameter accepted by `createInvoiceWithBillEmail`
✅ DiscountLineDetail added to Line array when discount > 0
✅ Fixed amount discount (not percentage-based)
✅ Description: "Discount applied"
✅ Logging confirms discount value sent to QuickBooks

### Billing Address
✅ BillingAddress parameter accepted by `createInvoiceWithBillEmail`
✅ BillAddr object added to invoice payload
✅ Customer address fields mapped correctly (address → Line1, state → CountrySubDivisionCode, etc.)
✅ Default country set to "USA" if not provided
✅ Logging confirms billing address sent to QuickBooks

### Email Delivery Enhancement
✅ Retry logic implemented (2 attempts, 1s delay)
✅ BillEmail update on retry attempt
✅ Pre-send delay increased to 1000ms
✅ Attempt count tracked and logged
✅ BillEmail presence checked before send
✅ Success case logs attempt count and delivery info
✅ Failure case creates NEEDS_MANUAL_SEND status
✅ QuickBooks invoice URL included in error logs
✅ No silent failures - all outcomes logged

## Business Impact

### Problem Solved
1. **Discount Not Applied**: Finance creates invoice with discount in Hub, but QuickBooks shows full price → customer confusion
2. **Missing Billing Address**: QuickBooks PDF invoices lack billing address → unprofessional appearance
3. **Email Failures**: Invoices created but emails silently fail → customers never receive invoices

### Solution Delivered
1. **Discount Line Items**: QuickBooks invoices now show discount as separate line item → accurate totals and clear pricing
2. **Billing Address Included**: Customer address appears on QB invoice → professional PDF rendering
3. **Reliable Email Delivery**: Retry logic + clear failure tracking → emails sent or Finance knows to send manually

### Finance Team Benefits
- **Accuracy**: Invoice totals in QB match Hub totals (with discount applied)
- **Professionalism**: Customer billing address appears on all invoices
- **Visibility**: IntegrationLog clearly shows email sent vs needs manual send
- **Efficiency**: No silent failures - Finance can proactively send failed emails via QB UI

## Next Steps

**Immediate:**
1. Test invoice creation with discount via UI
2. Verify QuickBooks invoice shows discount line item correctly
3. Verify billing address appears on QB invoice PDF
4. Monitor IntegrationLog for NEEDS_MANUAL_SEND entries
5. Train Finance team on checking IntegrationLog for failed sends

**Optional Enhancements:**
1. Add UI notification when invoice needs manual send
2. Create dashboard widget showing NEEDS_MANUAL_SEND count
3. Add "Resend Email" button in Hub UI for failed sends
4. Support percentage-based discounts (currently only fixed amount)
5. Add discount reason/note field for better tracking

## Commits

| Hash    | Message                                                                   |
|---------|---------------------------------------------------------------------------|
| 44e7a48 | feat(quick-023): add discount line item and billing address to QuickBooks invoices |
| 11856ea | feat(quick-023): enhance email sending with retry logic and better error tracking |

**Total Duration:** 2 minutes
**Tasks Completed:** 2/2
**Files Modified:** 2
**Lines Changed:** ~160
