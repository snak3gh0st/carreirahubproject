# QuickBooks Analytics Date Filtering Bugs - FIX SUMMARY

**Date:** 2026-02-04  
**File Fixed:** `app/api/analytics/quickbooks/route.ts`  
**Status:** FIXED

## Bugs Fixed

### 1. MRR Calculation (lines ~94-105)

**Problem:** Used fixed 3 months instead of respecting `dateFilter`.

**Fix:** Changed to calculate MRR based on total revenue in the selected date range divided by the number of months in that range.

```typescript
// OLD: Fixed 3 months
const threeMonthsAgo = subMonths(now, 3);
const mrrResult = await prisma.payment.groupBy({
  by: ["paymentDate"],
  where: { paymentDate: { gte: threeMonthsAgo } },
  _sum: { amount: true },
});
const mrr = mrrResult.length > 0
  ? Number(mrrResult.reduce((sum, m) => sum + Number(m._sum.amount || 0), 0) / 3)
  : 0;

// NEW: Uses dateFilter
const totalRevenueInRange = Number(totalRevenueResult._sum.amount || 0);
const monthsInRange = startDate && endDate
  ? Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)))
  : 3;
const mrr = totalRevenueInRange > 0 ? totalRevenueInRange / monthsInRange : 0;
```

### 2. Average Invoice Value (lines ~152-158)

**Problem:** Missing `dateFilter` - was calculating all-time average instead of filtered average.

**Fix:** Added `...(dateFilter && { createdAt: dateFilter })` to the where clause.

### 3. Invoice Aging (lines ~172-213)

**Problem:** Missing `dateFilter` - was showing all aging invoices instead of only those created in the selected range.

**Fix:** Added `...(dateFilter && { createdAt: dateFilter })` to the where clause.

### 4. Average Days to Payment (lines ~215-240)

**Problem:** Missing `dateFilter` - was calculating average based on all-time paid invoices.

**Fix:** Added `...(dateFilter && { createdAt: dateFilter })` to the where clause.

### 5. Invoice Volume Trends (lines ~242-252)

**Problem:** Used fixed 12 months (`twelveMonthsAgo`) instead of respecting `dateFilter`.

**Fix:** Changed to use `invoiceTrendStartDate` which respects `dateFilter` when provided.

```typescript
// OLD: Fixed 12 months
const twelveMonthsAgo = subMonths(startOfMonth(now), 11);
const invoicesByMonth = await prisma.invoice.groupBy({
  by: ["createdAt"],
  where: { createdAt: { gte: twelveMonthsAgo }, status: { notIn: ["DRAFT", "VOID"] } },
  _count: { id: true },
  _sum: { amount: true },
});

// NEW: Uses dateFilter
const invoiceTrendStartDate = startDate || subMonths(startOfMonth(now), 11);
const invoicesByMonth = await prisma.invoice.groupBy({
  by: ["createdAt"],
  where: { createdAt: { gte: invoiceTrendStartDate }, status: { notIn: ["DRAFT", "VOID"] } },
  _count: { id: true },
  _sum: { amount: true },
});
```

### 6. Average LTV (lines ~274-294)

**Problem:** Used all-time `qbTotalPaid` from customer table instead of calculating from payments in the selected date range.

**Fix:** Changed to:
1. Fetch payments in the date range
2. Aggregate payments by customer
3. Fetch customer names for the customers with payments
4. Calculate LTV from date-filtered payments

```typescript
// OLD: Used all-time qbTotalPaid
const customersWithPayments = await prisma.customer.findMany({
  where: { qbTotalPaid: { gt: 0 } },
  select: { id: true, name: true, qbTotalPaid: true },
  take: 1000,
});
let avgLtv = 0;
if (customersWithPayments.length > 0) {
  const totalLtv = customersWithPayments.reduce((sum, c) => sum + Number(c.qbTotalPaid || 0), 0);
  avgLtv = totalLtv / customersWithPayments.length;
}

// NEW: Calculates from payments in dateFilter
const paymentsForLtv = await prisma.payment.findMany({
  where: { ...(dateFilter && { paymentDate: dateFilter }) },
  select: { customerId: true, amount: true },
});

// Aggregate payments by customer
const customerPayments = new Map<string, number>();
paymentsForLtv.forEach((p) => {
  const current = customerPayments.get(p.customerId) || 0;
  customerPayments.set(p.customerId, current + Number(p.amount));
});

// Get customer details for segments and top customers
const customerIds = Array.from(customerPayments.keys());
const customersWithPayments = customerIds.length > 0
  ? await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true, qbTotalPaid: true },
    })
  : [];

// Update with actual paid amounts from date-filtered payments
const customersWithLtv = customersWithPayments.map((c) => ({
  ...c,
  totalPaidInRange: customerPayments.get(c.id) || 0,
}));

let avgLtv = 0;
if (customersWithLtv.length > 0) {
  const totalLtv = customersWithLtv.reduce((sum, c) => sum + c.totalPaidInRange, 0);
  avgLtv = totalLtv / customersWithLtv.length;
}
```

## Metrics Now Respecting Date Filter

| Metric | Date Field | Status |
|--------|------------|--------|
| Total Revenue | `paymentDate` | ✓ Already correct |
| MRR | `paymentDate` | ✓ Fixed |
| ARR | `paymentDate` | ✓ Fixed (based on MRR) |
| Collection Rate | `createdAt`/`paidAt` | ✓ Already correct |
| Overdue Amount | `createdAt` | ✓ Already correct |
| avgInvoiceValue | `createdAt` | ✓ Fixed |
| avgDaysToPayment | `createdAt` | ✓ Fixed |
| Invoice Aging | `createdAt` | ✓ Fixed |
| Invoice Trends | `createdAt` | ✓ Fixed |
| Active Customers | `invoices.createdAt` | ✓ Already correct |
| New Customers | `createdAt` | ✓ Already correct |
| avgLTV | `payments.paymentDate` | ✓ Fixed |

## Additional Fixes

- **Customer Segments:** Now use `totalPaidInRange` from date-filtered payments instead of `qbTotalPaid`
- **Top Customers:** Now sorted by `totalPaidInRange` from date-filtered payments
- **Total Customers:** Now reflects count of customers with payments in the date range

## Verification

Build completed successfully. All date filtering bugs documented in `038-date-filtering-bugs.md` have been fixed.
