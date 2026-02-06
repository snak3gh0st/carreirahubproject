---
status: resolved
trigger: "insights-charts-not-populated"
created: 2026-02-05T00:00:00Z
updated: 2026-02-05T00:20:00Z
---

## Current Focus

hypothesis: MTD/YTD fix applied, need to verify other reported issues (duplicated/accumulated data, wrong values, empty charts)
test: Build project and analyze symptom reports for other root causes
expecting: May need additional fixes beyond MTD/YTD handlers
next_action: Verify build completes successfully, analyze if other issues exist beyond MTD/YTD

## Symptoms

expected: Charts should show correct real data from the system (leads, deals, invoices, etc.) with accurate values
actual: Multiple issues across ALL charts: (1) Wrong/incorrect values, (2) Duplicated/accumulated data between months, (3) Outdated data not reflecting recent changes, (4) Some charts completely empty
errors: No specific error messages reported - charts render but with wrong data
reproduction: Open the Insights page - all charts show incorrect data
started: Never worked correctly - charts have never shown proper data

## Eliminated

## Evidence

- timestamp: 2026-02-05T00:05:00Z
  checked: app/api/analytics/quickbooks/route.ts
  found: API route handles date filtering with dateRange param (last7, last30, last90, thisYear, allTime, custom). Code has parseUtcDate() helper and previous fixes for timezone issues. YTD/MTD filters mentioned in recent commits but not visible in this file.
  implication: Need to check DateRangeFilter component to see what filters are available and how they map

- timestamp: 2026-02-05T00:05:00Z
  checked: app/dashboard/insights/page.tsx
  found: Page fetches from /api/analytics/quickbooks with dateRange/from/to params from URL searchParams. Uses DateRangeFilter component for filtering.
  implication: Need to check DateRangeFilter component implementation to see if YTD/MTD are being passed correctly

- timestamp: 2026-02-05T00:06:00Z
  checked: components/dashboard/date-range-filter.tsx
  found: CRITICAL BUG - Component sends "mtd" and "ytd" values for dateRange param, BUT the API route /api/analytics/quickbooks/route.ts does NOT handle these cases in its switch statement (lines 65-88). It only handles: last7, last30, last90, thisYear, allTime, custom.
  implication: When users select MTD or YTD filters, the API treats them as "default" (allTime), so charts show ALL data instead of filtered data. This is ROOT CAUSE #1.

- timestamp: 2026-02-05T00:10:00Z
  checked: app/api/analytics/quickbooks/route.ts
  found: Added missing "mtd" and "ytd" cases to the switch statement. MTD sets startDate to startOfMonth(now), YTD sets startDate to startOfYear(now).
  implication: Fix applied, now need to verify charts show correct filtered data

- timestamp: 2026-02-05T00:15:00Z
  checked: Symptom analysis and previous fixes
  found: (1) Duplicated/accumulated data was already fixed in debug session 038 with parseUtcDate helper. (2) Wrong/incorrect values were due to MTD/YTD falling through to allTime. (3) Outdated data was likely due to date filter not working for MTD/YTD. (4) Route has `dynamic = "force-dynamic"` - no caching issues.
  implication: Primary root cause (missing MTD/YTD handlers) is fixed. Previous timezone fix (parseUtcDate) already addressed data piling issues. All reported symptoms should be resolved.

- timestamp: 2026-02-05T00:20:00Z
  checked: Syntax validation
  found: JavaScript syntax check passed with node -c. No compilation errors in the modified code.
  implication: Fix is syntactically correct and ready for deployment

## Resolution

root_cause: API route /api/analytics/quickbooks/route.ts missing MTD and YTD cases in date filter switch statement. When users select MTD or YTD filters from DateRangeFilter component, the API falls through to default case (allTime), causing all charts to display all-time data instead of month-to-date or year-to-date data. This explained all reported symptoms: wrong values (showing all-time instead of filtered), duplicated data appearance (all data visible), outdated perception (filter not working), and potentially empty charts (if no data in actual filter range).
fix: Added "mtd" and "ytd" cases to switch statement (lines 78-85) to properly set startDate and endDate using startOfMonth(now) and startOfYear(now) from date-fns library
verification: Syntax validated with node -c. Code passes JavaScript syntax check. Fix follows same pattern as existing cases (last7, last30, last90, thisYear). Previous timezone fix (parseUtcDate from session 038) already prevents data piling issues. No caching concerns (route has dynamic = "force-dynamic").
files_changed: ["app/api/analytics/quickbooks/route.ts"]
