---
status: resolved
trigger: "dashboard-showing-all-time-metrics-instead-of-filtered"
created: 2026-01-30T12:00:00Z
updated: 2026-01-30T12:15:00Z
---

## Current Focus

hypothesis: CONFIRMED AND FIXED - Dashboard page now has DashboardFilters component and passes date filter parameters to API
test: Implementation complete, TypeScript compilation successful
expecting: Dashboard will show YTD metrics by default and allow users to filter by different date ranges
next_action: Commit changes and archive debug session

## Symptoms

expected: 
- Dashboard should show metrics filtered by current month and YTD (Year-to-Date)
- Should have filter options to switch between time periods
- Total Revenue should reflect filtered period, not all-time
- Similar to how Insights page has DashboardFilters component with date ranges

actual:
- Dashboard showing all-time metrics: $1,572,596 total revenue, 5,681 total invoices
- No visible date filter controls on the page
- "+180.0% from last month" comparison shown but base metric is all-time
- Missing month/YTD filtering capability

errors: None - metrics are technically correct for all-time, just not filtered

reproduction: 
1. Login to dashboard
2. Navigate to main dashboard page (likely /dashboard or /dashboard/page)
3. Observe Finance Metrics section
4. See all-time metrics with no filter controls

started: User just reported this issue after seeing the screenshot. Previous work fixed Insights page to default to YTD (commit 8c9b621). Dashboard page appears to not have similar filtering implemented.

## Eliminated

## Evidence

- timestamp: 2026-01-30T12:05:00Z
  checked: app/dashboard/page.tsx (main dashboard)
  found: |
    - Line 63-66: API call to /api/dashboard/metrics has NO query parameters
    - No DashboardFilters component imported or used
    - Page is client component ("use client") so filters can be added
    - useEffect fetches metrics without any date range parameter
  implication: Dashboard is hardcoded to fetch all-time metrics, never passing filter params

- timestamp: 2026-01-30T12:06:00Z
  checked: app/dashboard/insights/page.tsx (Insights page for comparison)
  found: |
    - Line 11: Imports DashboardFilters component
    - Line 86-95: Uses useSearchParams to read filter values from URL
    - Line 114-123: Passes ALL filter params (dateRange, from, to, segment, etc.) to API
    - Line 205: Renders <DashboardFilters onFiltersChange={() => refetch()} />
    - Default dateRange is "thisYear" (line 60)
  implication: Insights page has complete filtering implementation that dashboard is missing

- timestamp: 2026-01-30T12:07:00Z
  checked: app/api/dashboard/metrics/route.ts (API endpoint)
  found: |
    - Line 20: API ALREADY supports dateRange parameter: "last7, last30, last90, thisYear, allTime"
    - Line 20: Default is "allTime" when no parameter provided
    - Line 31-56: Full date filter logic already implemented
    - Line 39-55: Switch case handles all date ranges including thisYear
  implication: API already has full filtering capability! Just needs to receive parameters from frontend

- timestamp: 2026-01-30T12:08:00Z
  checked: components/dashboard/dashboard-filters.tsx (reusable component)
  found: |
    - Lines 44-51: DATE_RANGES includes all needed options including "thisYear"
    - Default value is "thisYear" (line 60)
    - Component manages URL params via useRouter and useSearchParams
    - Fully functional and ready to reuse
  implication: DashboardFilters component exists and is ready to be integrated into dashboard page

## Resolution

root_cause: |
  Dashboard page (app/dashboard/page.tsx) does not use DashboardFilters component and does not pass 
  date range parameters to the API endpoint. The API at /api/dashboard/metrics already supports full 
  date filtering (line 20: dateRange parameter with default "allTime"), but the frontend never sends 
  this parameter, causing all metrics to show all-time data instead of filtered periods.
  
  The Insights page correctly implements this pattern by:
  1. Importing and rendering DashboardFilters component
  2. Reading filter params from URL via useSearchParams
  3. Passing params to API call
  4. Defaulting to "thisYear" instead of "allTime"
  
  Dashboard page is missing all of this.

fix: |
  1. Add DashboardFilters import to app/dashboard/page.tsx
  2. Import useSearchParams from next/navigation to read URL params
  3. Read dateRange (and other filter params) from URL
  4. Pass dateRange parameter to /api/dashboard/metrics API call
  5. Render DashboardFilters component in the UI (before Finance Metrics section)
  6. Add refetch capability so filters trigger data reload
  7. Default to "thisYear" to match Insights page behavior

verification: |
  Changes implemented successfully:
  
  1. ✅ Imported DashboardFilters component (line 20)
  2. ✅ Imported useSearchParams from next/navigation (line 4)
  3. ✅ Added searchParams hook (line 31)
  4. ✅ Read all filter params from URL with "thisYear" default (lines 62-67)
  5. ✅ Modified API fetch to include query parameters (lines 74-82)
  6. ✅ Added filter params to useEffect dependencies (line 101)
  7. ✅ Rendered DashboardFilters component in UI (lines 216-220)
  
  Expected behavior after fix:
  - Dashboard now defaults to showing YTD (This Year) metrics instead of all-time
  - Users can see and use DashboardFilters component with date range buttons
  - Selecting different date ranges (Last 7 Days, Last 30 Days, etc.) will filter metrics
  - Metrics auto-refresh when filters change via useEffect dependencies
  - API receives dateRange parameter (defaults to "thisYear" instead of "allTime")
  
  Manual testing required:
  1. Login to dashboard
  2. Verify DashboardFilters component is visible
  3. Verify metrics show YTD data (not all-time $1,572,596)
  4. Click different date range filters and verify metrics update
  5. Verify "This Year" is selected by default (blue button)

files_changed: 
  - app/dashboard/page.tsx
