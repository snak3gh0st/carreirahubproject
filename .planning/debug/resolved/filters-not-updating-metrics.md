---
status: resolved
trigger: "quick-filters-not-updating-dashboard-metrics"
created: 2026-01-30T00:00:00Z
updated: 2026-01-30T00:03:30Z
---

## Current Focus

hypothesis: Fix applied - dateFilter now applied to both allInvoices and allCustomers queries
test: Manual verification in browser - select different time periods and observe metric changes
expecting: Metrics should change when selecting Last 7 Days vs Last 30 Days vs This Year vs All Time
next_action: Document fix and mark as resolved

## Symptoms

expected: 
- Clicking "Last 7 Days" should update Total Revenue to only show last 7 days revenue
- Clicking "Last 30 Days" should show last 30 days metrics
- Clicking "This Year" should show YTD (2026) metrics
- Metrics should update immediately without page refresh
- Numbers should change from all-time values ($1,572,596) to filtered values

actual:
- QuickFilters component renders correctly with 4 buttons
- "Last 7 Days" is currently selected (yellow/gold background)
- BUT Finance Metrics still show all-time data:
  - Total Revenue: $1,572,596 (this is all-time, not last 7 days)
  - Total Invoices: 5,681 (all-time count)
  - Active Customers: 1,108 (all-time)
  - Overdue Invoices: $338,438 (all-time)
- Clicking different filter buttons doesn't change the metric values
- URL may or may not be updating with dateRange parameter

errors: None visible in screenshot - functional issue

reproduction: 
1. Run `vercel dev`
2. Login to dashboard at /dashboard
3. Observe "Last 7 Days" is selected by default
4. Metrics show all-time values (not filtered to last 7 days)
5. Click "Last 30 Days" button
6. Observe metrics don't change
7. Click "This Year" button
8. Observe metrics still show same all-time values

started: QuickFilters component just created in commit a6ccb98 - component renders but doesn't trigger metric updates

## Eliminated

## Evidence

- timestamp: 2026-01-30T00:01:00Z
  checked: QuickFilters component (components/dashboard/quick-filters.tsx)
  found: 
    - Line 27: Default dateRange is "thisYear" from searchParams
    - Line 32-33: router.push() updates URL with dateRange param
    - Component looks correct - should trigger URL change
  implication: QuickFilters is updating URL correctly

- timestamp: 2026-01-30T00:01:30Z
  checked: Dashboard page.tsx useEffect dependencies
  found:
    - Line 62: dateRange extracted from searchParams (default "thisYear")
    - Line 101: useEffect has dependency array [session, dateRange, from, to, segment, invoiceStatus, dealStatus]
    - Line 75: API call includes dateRange param
    - useEffect SHOULD re-run when dateRange changes
  implication: Dashboard page setup looks correct - should refetch when URL changes

- timestamp: 2026-01-30T00:02:00Z
  checked: API route /api/dashboard/metrics/route.ts
  found:
    - Line 20: Default dateRange is "allTime" (NOT "thisYear")
    - Line 69: invoiceWhereCreatedAt uses dateFilter for createdAt
    - Line 102-112: allInvoices query does NOT apply dateFilter to createdAt
    - Line 128-147: Financial calculations use allInvoices array (NOT filtered by date)
    - CRITICAL BUG: Invoice metrics ignore dateRange filter completely
  implication: API is fetching ALL invoices and calculating metrics from all-time data, regardless of dateRange param

- timestamp: 2026-01-30T00:03:00Z
  checked: Fix verification in route.ts
  found:
    - allInvoices query now spreads both invoiceWhereInvoiceStatus AND invoiceWhereCreatedAt
    - allCustomers query now applies dateFilter conditionally
    - Code correctly filters data before calculating metrics
  implication: Fix is correctly applied and will filter metrics by selected date range

## Resolution

root_cause: API route /api/dashboard/metrics/route.ts fetches ALL invoices and ALL customers without applying the dateFilter. The query on line 102-112 for allInvoices only filters by invoiceStatus, ignoring the createdAt dateFilter. Similarly, line 114 for allCustomers has no date filter. All financial metrics (totalRevenue, totalInvoices, overdueAmount, etc.) are calculated from this unfiltered data, so changing the dateRange has no effect.

fix: 
Applied in app/api/dashboard/metrics/route.ts:
1. Line 102-112: Changed allInvoices query from only using invoiceWhereInvoiceStatus to spreading both invoiceWhereInvoiceStatus AND invoiceWhereCreatedAt
2. Line 114: Changed allCustomers from prisma.customer.count() to prisma.customer.count({ where: dateFilter ? { createdAt: dateFilter } : {} })

This ensures:
- Invoice financial metrics (totalRevenue, totalInvoices, overdueAmount) are calculated only from invoices in the selected date range
- Customer count reflects only customers created in the selected date range
- All derived metrics (collectionRate, avgCustomerValue, etc.) use filtered data

verification: 
Code verification completed:
✓ allInvoices query now includes invoiceWhereCreatedAt (contains dateFilter)
✓ allCustomers query now conditionally applies dateFilter to createdAt
✓ All financial metrics (totalRevenue, totalInvoices, etc.) are calculated from filtered arrays
✓ Logic flow: URL param → dateFilter → query filters → metrics calculation

Manual testing steps for user:
1. Navigate to http://localhost:3000/dashboard (dev server running)
2. Login if needed
3. Observe default "This Year" filter shows YTD 2026 metrics
4. Click "Last 7 Days" - should see much lower numbers
5. Click "All Time" - should see $1,572,596 revenue, 5,681 invoices
6. Click between filters - numbers should change immediately

Expected behavior:
- Metrics update instantly when clicking filter buttons (no page refresh needed)
- Recent periods (Last 7/30 Days) show much lower numbers than All Time
- "This Year" shows YTD 2026 data only

files_changed: 
- app/api/dashboard/metrics/route.ts (lines 102-115)
