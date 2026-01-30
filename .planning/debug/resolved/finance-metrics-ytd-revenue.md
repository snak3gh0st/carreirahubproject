---
status: resolved
trigger: "finance-metrics-showing-all-time-instead-of-ytd"
created: 2026-01-30T00:00:00Z
updated: 2026-01-30T00:10:00Z
---

## Current Focus

hypothesis: CONFIRMED - DashboardFilters component defaults to "allTime" instead of "thisYear", causing finance metrics to show all-time revenue
test: Fix default date range in DashboardFilters component from "allTime" to "thisYear"
expecting: Insights page will default to YTD (2026) metrics on initial load
next_action: Apply fix to DashboardFilters component

## Symptoms

expected: Finance metrics should show Year-to-Date (YTD) revenue for 2026 only
actual: Showing $1.5M which appears to be all-time revenue (not filtered to current year)
errors: None reported - data is displaying but incorrect calculation period
reproduction: Navigate to Insights page or Dashboard, observe revenue metrics showing cumulative all-time data
timeline: Unclear when started - likely since Insights page was created (Phase 4)

## Eliminated

## Evidence

- timestamp: 2026-01-30T00:05:00Z
  checked: app/dashboard/insights/page.tsx
  found: Insights page fetches from /api/analytics/bi-dashboard endpoint with dateRange param from URL
  implication: Frontend correctly passes dateRange filter to API

- timestamp: 2026-01-30T00:06:00Z
  checked: app/api/analytics/bi-dashboard/route.ts (lines 61-84)
  found: API correctly implements date filtering with switch case including "thisYear" option using startOfYear(now)
  implication: Backend API correctly handles YTD filtering when dateRange="thisYear" is passed

- timestamp: 2026-01-30T00:07:00Z
  checked: components/dashboard/dashboard-filters.tsx (line 60)
  found: Default dateRange state is "allTime" - `searchParams.get("dateRange") || "allTime"`
  implication: ROOT CAUSE - Filter defaults to all-time instead of thisYear on initial page load

- timestamp: 2026-01-30T00:08:00Z
  checked: components/dashboard/dashboard-filters.tsx (lines 136-155)
  found: resetFilters() also sets dateRange to "allTime"
  implication: Reset behavior also needs updating to match new default

## Resolution

root_cause: DashboardFilters component defaults to "allTime" date range instead of "thisYear". When users navigate to Insights page without URL params, the filter initializes to all-time, causing API to return cumulative all-time revenue instead of YTD 2026 data.
fix: Changed default dateRange from "allTime" to "thisYear" in DashboardFilters component at three locations: initial state (line 60), resetFilters function (line 137, 148), and hasActiveFilters comparison (line 158)
verification: Verified complete data flow:
  1. DashboardFilters now initializes with dateRange="thisYear" on mount
  2. Insights page passes thisYear param to API via URL searchParams
  3. API endpoint correctly handles thisYear case using startOfYear(now) for 2026-01-01 start date
  4. Date filter { gte: 2026-01-01, lte: now } applied to all revenue queries
  5. Only invoices with paidAt in 2026 will be included in totalRevenue calculation
  6. TypeScript compilation successful (unrelated pre-existing build warnings)
files_changed: ["components/dashboard/dashboard-filters.tsx"]
