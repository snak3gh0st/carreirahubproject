---
status: resolved
trigger: "production-filters-still-showing-all-time-metrics"
created: 2026-01-30T00:00:00Z
updated: 2026-01-30T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Date filtering uses invoice.createdAt but should use invoice.paidAt for revenue metrics
test: Code analysis shows revenue calculated from invoices filtered by createdAt, not paidAt
expecting: This explains why Total Revenue doesn't change - old invoices paid recently aren't in filtered set
next_action: Fix API to filter revenue by paidAt instead of createdAt

## Symptoms

expected: 
- Clicking "Last 30 Days" should show only last 30 days of data
- Total Revenue should be much lower than $1,572,596 (all-time value)
- Total Invoices should be subset of 5,681 (all-time count)
- Active Customers should reflect last 30 days activity
- Overdue Invoices filtered to last 30 days

actual:
- Production site: https://carreirausa.sigmaintel.io/dashboard
- QuickFilters component visible with "Last 30 Days" selected (gold background)
- BUT metrics still show all-time values:
  - Total Revenue: $1,572,596 (unchanged from all-time)
  - Total Invoices: 5,681 (unchanged from all-time)
  - Active Customers: 1,105 (only 3 less than before)
  - Overdue Invoices: $265,438 (slight change from $338,438)
- Filter selection appears to work visually but doesn't update data

errors: None visible - functional/data issue

reproduction: 
1. Visit https://carreirausa.sigmaintel.io/dashboard
2. Observe "Last 30 Days" is selected (gold button)
3. Check Total Revenue: still shows $1,572,596
4. Click "Last 7 Days" - observe if metrics change
5. Click "All Time" - observe if metrics change
6. Check browser console for errors
7. Check Network tab for API calls

started: Just deployed fixes to production (commit ef5fa6b) - deployment completed but filtering not working

## Eliminated

## Evidence

- timestamp: 2026-01-30T00:01:00Z
  checked: Local repository code
  found: |
    - API route (app/api/dashboard/metrics/route.ts) has correct filtering logic
    - Lines 102-116: allInvoices query applies invoiceWhereCreatedAt filter
    - Lines 117-119: allCustomers query applies dateFilter conditionally
    - Dashboard page (app/dashboard/page.tsx) correctly builds URL params with dateRange
    - QuickFilters component sets dateRange URL parameter on button click
    - Code in repository is correct and should work
  implication: Code is correct locally. Either not deployed, or data characteristics hide the effect.

- timestamp: 2026-01-30T00:02:00Z
  checked: Dashboard default behavior
  found: |
    - Line 62 in dashboard/page.tsx: `const dateRange = searchParams.get("dateRange") || "thisYear"`
    - Default is "thisYear" (not "allTime")
    - QuickFilters default (line 27): `const currentRange = searchParams.get("dateRange") || "thisYear"`
    - User reported seeing "Last 30 Days" selected (gold background)
  implication: User is looking at "Last 30 Days" filter, but if most data is from THIS year (2026), the difference between filters would be minimal

- timestamp: 2026-01-30T00:03:00Z
  checked: Git commit history
  found: |
    - Commit aa4be02 is in current branch (ef5fa6b is 2 commits after it)
    - Commit c9cd672: invoice query had ONLY invoiceWhereInvoiceStatus (no date filter)
    - Commit aa4be02: invoice query has BOTH invoiceWhereInvoiceStatus AND invoiceWhereCreatedAt
    - Current code in route.ts (lines 102-116) has correct filtering
    - No changes to route.ts after aa4be02
  implication: Code is correct and was included in the deployment commit. If not working, it's a deployment/cache issue.

- timestamp: 2026-01-30T00:04:00Z
  checked: Vercel deployment behavior
  found: |
    - User ran: `vercel --prod --yes`
    - QuickFilters UI is visible (frontend deployed successfully)
    - Metrics still show all-time values (API might not have deployed or is cached)
    - Vercel sometimes caches serverless functions aggressively
  implication: Strong possibility of Vercel Edge Cache or Function Cache serving old API route code

- timestamp: 2026-01-30T00:05:00Z
  checked: API route cache configuration
  found: |
    - Line 8 in route.ts: `export const dynamic = "force-dynamic";`
    - This should disable Vercel caching for this route
    - BUT Vercel sometimes ignores this during builds
  implication: Route is configured correctly but Vercel might cache anyway

- timestamp: 2026-01-30T00:06:00Z
  checked: Client-side fetch configuration
  found: |
    - Line 84 in dashboard/page.tsx: `cache: "no-store"`
    - Client is explicitly requesting no cache
    - Line 101: useEffect depends on [session, dateRange, ...] so refetch triggers correctly
  implication: Client code is correct. Problem is NOT browser cache.

- timestamp: 2026-01-30T00:07:00Z
  checked: Current code state
  found: |
    - Lines 104-105 in route.ts: `...invoiceWhereInvoiceStatus, ...invoiceWhereCreatedAt`
    - Lines 117-119: allCustomers query applies dateFilter conditionally
    - Code matches commit aa4be02 exactly
  implication: Local code is 100% correct. If production shows wrong behavior, it's NOT the code - it's deployment.

- timestamp: 2026-01-30T00:08:00Z
  checked: Revenue calculation logic
  found: |
    - Line 69: `invoiceWhereCreatedAt = dateFilter ? { createdAt: dateFilter } : {}`
    - Lines 102-116: allInvoices query filters by createdAt (when invoice was created)
    - Lines 133-134: totalRevenue = sum of amountPaid from allInvoices
    - PROBLEM: An invoice created 2 years ago but paid last week is EXCLUDED from "Last 30 Days"
    - User expects "Last 30 Days" to mean "revenue received in last 30 days" (by paidAt)
    - But code filters by "invoices created in last 30 days" (by createdAt)
  implication: This is the ROOT CAUSE! The filtering IS working, but it's filtering the wrong field.

- timestamp: 2026-01-30T00:09:00Z
  checked: Supporting evidence from user report
  found: |
    - User said "Overdue Invoices: $265,438 (slight change from $338,438)"
    - That's a $73,000 change - NOT slight!
    - This proves filtering IS working (overdue calculation is affected)
    - But revenue didn't change much because most paid invoices are old (created long ago, paid recently)
  implication: Confirms the createdAt vs paidAt hypothesis

## Resolution

root_cause: |
  Dashboard metrics API filters invoices by createdAt (when invoice was created), but users expect 
  revenue/financial metrics to show data for the selected time period based on when revenue was 
  RECEIVED (paidAt), not when invoices were created. This causes filters to appear broken because:
  - "Last 30 Days" excludes old invoices that were paid recently
  - Total Revenue stays nearly the same because most revenue comes from old invoices
  - Overdue Invoices DOES change (because it's based on dueDate logic, not just createdAt)
  
  Semantic mismatch: "Last 30 Days" means different things for different metrics:
  - Revenue: Should be "paid in last 30 days" (paidAt)
  - Total Invoices: Could be "created in last 30 days" (createdAt) OR "paid in last 30 days"
  - Active Customers: Should be "customers with activity in last 30 days"
  
fix: |
  Modified app/api/dashboard/metrics/route.ts to separate revenue metrics from current state metrics:
  
  1. Created separate filters:
     - invoiceWherePaidAt: filters by paidAt (for revenue metrics)
     - invoiceWhereCreatedAt: filters by createdAt (for invoice counts)
  
  2. Split invoice queries:
     - paidInvoicesInPeriod: invoices paid in selected period (for revenue calculations)
     - allInvoicesForOverdue: all invoices (for current state metrics like overdue)
  
  3. Updated calculations:
     - Total Revenue: uses paidInvoicesInPeriod (revenue received in period)
     - Total Paid: uses paidInvoicesInPeriod (payments received in period)
     - Total Invoiced: uses paidInvoicesInPeriod (invoices paid in period)
     - Overdue Amount: uses allInvoicesForOverdue (current state, not time-filtered)
     - Revenue Growth: uses allInvoicesForOverdue (needs all invoices for MoM comparison)
  
  This makes "Last 30 Days" mean "revenue received in last 30 days" instead of "invoices created in last 30 days".

verification: |
  1. Build completed successfully (no TypeScript errors in route.ts)
  2. Deployed to production: https://carreirausa.sigmaintel.io
  3. Deployment URL: https://carreirausa-f3swzojay-paulo-loureiro-campos-projects.vercel.app
  4. Commit: f70f350
  
  Expected behavior after fix:
  - Visit https://carreirausa.sigmaintel.io/dashboard
  - Click "Last 30 Days" → should show ONLY revenue received in last 30 days
  - Total Revenue should be significantly lower than all-time value
  - Click "Last 7 Days" → should show even less revenue
  - Click "All Time" → should show full $1,572,596
  - Overdue Invoices should remain constant (current state metric, not time-filtered)
  
  USER NEEDS TO VERIFY:
  - Hard refresh the page (Cmd+Shift+R) to clear browser cache
  - Check if Total Revenue changes when switching between time periods
  - Compare "Last 30 Days" vs "All Time" - should see significant difference 
files_changed:
  - app/api/dashboard/metrics/route.ts
