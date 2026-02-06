# Debug Session: QuickBooks Analytics Date Filtering

**Created:** 2026-02-04
**Status:** RESOLVED
**Goal:** Find and fix date filtering bugs in QuickBooks analytics API

## Issue Summary

All metrics in the QuickBooks BI dashboard are NOT respecting the selected date filters. User reports "all metrics are wrong."

## Known Bugs in API

### 1. MRR Calculation (lines 94-105)
```typescript
// PROBLEM: Uses fixed 3 months instead of dateFilter
const threeMonthsAgo = subMonths(now, 3);
const mrrResult = await prisma.payment.groupBy({
  by: ["paymentDate"],
  where: {
    paymentDate: { gte: threeMonthsAgo },  // IGNORES dateFilter!
  },
  _sum: { amount: true },
});
const mrr = mrrResult.length > 0
  ? Number(mrrResult.reduce((sum, m) => sum + Number(m._sum.amount || 0), 0) / 3)
  : 0;
```

### 2. Average Invoice Value (lines 152-158)
```typescript
// PROBLEM: Does NOT filter by dateFilter at all!
const avgInvoiceValueResult = await prisma.invoice.aggregate({
  where: {
    status: { notIn: ["DRAFT", "VOID"] },
    // MISSING: ...(dateFilter && { createdAt: dateFilter })
  },
  _avg: { amount: true },
});
```

### 3. Invoice Aging (lines 172-213)
```typescript
// PROBLEM: Does NOT filter by dateFilter
const agingResult = await prisma.invoice.findMany({
  where: {
    status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] },
    // MISSING: dateFilter
  },
  select: { amount: true, dueDate: true, paidAt: true },
});
```

### 4. Average Days to Payment (lines 215-240)
```typescript
// PROBLEM: Does NOT filter by dateFilter
const paidInvoices = await prisma.invoice.findMany({
  where: {
    status: "PAID",
    paidAt: { not: null },
    // MISSING: dateFilter
  },
  select: { createdAt: true, paidAt: true },
  take: 1000,
});
```

### 5. Invoice Volume Trends (lines 242-252)
```typescript
// PROBLEM: Uses fixed 12 months instead of dateFilter
const twelveMonthsAgo = subMonths(startOfMonth(now), 11);
const invoicesByMonth = await prisma.invoice.groupBy({
  by: ["createdAt"],
  where: {
    createdAt: { gte: twelveMonthsAgo },  // IGNORES dateFilter!
    status: { notIn: ["DRAFT", "VOID"] },
  },
});
```

### 6. Average LTV (lines 274-294)
```typescript
// PROBLEM: Uses all-time qbTotalPaid instead of date-filtered payments
const customersWithPayments = await prisma.customer.findMany({
  where: {
    qbTotalPaid: { gt: 0 },  // ALL-TIME, ignores dateFilter!
  },
  select: { id: true, name: true, qbTotalPaid: true },
  take: 1000,
});
```

## Expected Behavior

Each metric SHOULD filter by `dateFilter` when selected:

| Metric | Date Field | Behavior |
|--------|------------|----------|
| Total Revenue | `paymentDate` | Sum in range ✓ (correct) |
| MRR | `paymentDate` | (Total in range) / monthsInRange |
| ARR | `paymentDate` | MRR × 12 |
| Collection Rate | `createdAt` (invoices), `paidAt` (payments) | ✓ (correct) |
| Overdue Amount | `createdAt` | ✓ (correct) |
| avgInvoiceValue | `createdAt` | MISSING dateFilter |
| avgDaysToPayment | `createdAt` + `paidAt` | MISSING dateFilter |
| Invoice Aging | current state + filter | Needs review |
| Invoice Trends | `createdAt` | Uses fixed 12 months |
| Active Customers | `invoices.createdAt` | ✓ (correct) |
| New Customers | `createdAt` | ✓ (correct) |
| avgLTV | `payments.paymentDate` | Uses all-time data |

## Fix Progress

- [x] MRR Calculation (lines 94-105) - Fixed to use dateFilter
- [x] Average Invoice Value (lines 152-158) - Fixed to use dateFilter
- [x] Invoice Aging (lines 172-213) - Fixed to use dateFilter on createdAt
- [x] Average Days to Payment (lines 215-240) - Fixed to use dateFilter
- [x] Invoice Volume Trends (lines 242-252) - Fixed to use dateFilter
- [x] Average LTV (lines 274-294) - Fixed to calculate from payments in dateFilter

The developer wrote some metrics with `...(dateFilter && {...})` and others without it. The code is inconsistent and many critical metrics are missing date filtering.

## Evidence

- File: `app/api/analytics/quickbooks/route.ts`
- Lines: 94-105, 152-158, 172-213, 215-240, 242-252, 274-294

## Hypothesis

All metrics that don't include `...(dateFilter && {...})` are showing all-time values instead of filtered values.

## Tests to Run

1. Test with `dateRange=last7` - all metrics should only show last 7 days
2. Test with `dateRange=last30` - all metrics should only show last 30 days
3. Test with `dateRange=allTime` - all metrics should show everything

## Fix Required

Add `...(dateFilter && { createdAt: dateFilter })` or `...(dateFilter && { paymentDate: dateFilter })` to ALL queries that are missing it.

Special handling for:
- **MRR**: Calculate based on payments in range / monthsInRange
- **ARR**: MRR × 12
- **Invoice Trends**: Use dateFilter instead of fixed 12 months
- **LTV**: Calculate from payments in date range, not all-time qbTotalPaid
