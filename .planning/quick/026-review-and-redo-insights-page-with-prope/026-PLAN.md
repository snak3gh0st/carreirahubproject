---
quick_task: 026
description: Review and redo insights page with proper filters
created: 2026-01-29
---

# Quick Task 026: Review and Redo Insights Page with Proper Filters

## Objective

Review the existing insights page (`/dashboard/insights`) and improve the filter implementation to ensure all filters work correctly with the BI dashboard API. The current implementation has `DashboardFilters` component with date range, customer segment, invoice status, and deal status filters, but these may not be properly integrated with the API backend.

**Purpose:** Ensure Finance and Commercial users can filter insights data effectively for accurate analysis and reporting.

**Output:** Working insights page with fully functional filters that correctly query the backend and update all KPIs and charts.

## Execution Context

@.planning/STATE.md - Project state and recent work
@app/dashboard/insights/page.tsx - Main insights page
@components/dashboard/dashboard-filters.tsx - Filter component
@app/api/analytics/bi-dashboard/route.ts - Backend API

## Current State Analysis

**Existing Implementation:**
- `DashboardFilters` component supports: date range, customer segment, invoice/deal status filters
- `bi-dashboard` API endpoint only processes `dateRange`, `from`, and `to` query params
- Missing backend support for: `segment`, `invoiceStatus`, `dealStatus` filters
- Frontend applies filters but backend ignores most of them

**Issues Identified:**
1. API doesn't respect `segment` (customer segment filter)
2. API doesn't respect `invoiceStatus` filter (multi-select)
3. API doesn't respect `dealStatus` filter (multi-select)
4. Frontend shows filters that don't actually work
5. No visual feedback when filters are applied but not affecting data

## Tasks

<task type="auto">
  <name>Task 1: Audit and document current filter behavior</name>
  <files>
    app/dashboard/insights/page.tsx
    components/dashboard/dashboard-filters.tsx
    app/api/analytics/bi-dashboard/route.ts
  </files>
  <action>
    1. Review current filter implementation in all three files
    2. Document which filters work vs which are broken
    3. Identify missing query parameters in API endpoint
    4. Check if frontend properly passes all filter values to API
    5. Review SQL queries in API to understand current filtering logic
    6. Create inline comments marking broken filter integrations
  </action>
  <verify>
    All three files have inline comments documenting current behavior and issues
  </verify>
  <done>
    Clear documentation exists showing:
    - Which filters work (date range)
    - Which filters don't work (segment, invoiceStatus, dealStatus)
    - Where backend changes are needed
  </done>
</task>

<task type="auto">
  <name>Task 2: Implement missing filter support in API</name>
  <files>
    app/api/analytics/bi-dashboard/route.ts
  </files>
  <action>
    Add backend support for missing filters:
    
    1. Parse `segment`, `invoiceStatus`, `dealStatus` query params from URL
    2. Build Prisma where clauses for customer segment filtering:
       - `active`: customers with invoices in last 90 days
       - `inactive`: customers with no invoices in last 90 days but has invoices
       - `churned`: customers with last invoice >180 days ago
    3. Build Prisma where clauses for invoice status filtering:
       - If `invoiceStatus` array provided, filter invoices by status IN array
       - Apply to all invoice queries (KPIs, charts, aggregations)
    4. Build Prisma where clauses for deal status filtering:
       - If `dealStatus` array provided, filter deals by status IN array
       - Apply to all deal queries (KPIs, pipeline chart)
    5. Apply filters consistently across ALL parallel queries
    6. Test each filter combination doesn't break existing date range logic
    
    **Important:** Don't break existing date filtering logic. All filters must work together (AND logic).
  </action>
  <verify>
    1. Test API with `?segment=active` returns only active customers
    2. Test API with `?invoiceStatus=PAID,SENT` returns filtered invoice data
    3. Test API with `?dealStatus=WON` returns only won deals in pipeline
    4. Test combined filters work together (date + segment + status)
    5. Verify all KPIs and charts reflect filtered data correctly
  </verify>
  <done>
    - API accepts and processes all filter parameters
    - All KPIs (revenue, collection rate, customers, deals) respect filters
    - All charts (status distribution, trends, top customers) respect filters
    - Combined filters work correctly without breaking each other
  </done>
</task>

<task type="auto">
  <name>Task 3: Update frontend to properly integrate filters</name>
  <files>
    app/dashboard/insights/page.tsx
    components/dashboard/dashboard-filters.tsx
  </files>
  <action>
    1. Update `InsightsPage` to read ALL filter params from URL:
       - Add segment, invoiceStatus, dealStatus to useSearchParams
       - Pass all params to API fetch in useQuery queryFn
    2. Update query key in useQuery to include new filter params:
       - Change from: `["bi-dashboard", dateRange, from, to]`
       - Change to: `["bi-dashboard", dateRange, from, to, segment, invoiceStatus, dealStatus]`
    3. Ensure DashboardFilters callback triggers data refetch
    4. Add visual indicator showing active filter count
    5. Test that applying filters immediately updates charts and KPIs
    6. Clean up any unused DateRangeFilter component imports (appears unused)
    
    **Important:** Ensure filter changes trigger immediate data refresh without page reload.
  </action>
  <verify>
    1. Change date range → data updates instantly
    2. Select customer segment → data updates instantly
    3. Toggle invoice status filters → data updates instantly
    4. Toggle deal status filters → data updates instantly
    5. Reset filters button clears all filters and reloads data
    6. Active filter count badge shows correct number
  </verify>
  <done>
    - All filter controls are functional and update data immediately
    - URL query params reflect current filter state (shareable/bookmarkable)
    - Filter changes don't cause page reload (React Query handles updates)
    - Visual feedback shows when filters are active
    - Export functionality respects active filters
  </done>
</task>

## Success Criteria

**Functional Requirements:**
- [ ] Date range filter works (already working)
- [ ] Customer segment filter works (active/inactive/churned)
- [ ] Invoice status multi-select filter works
- [ ] Deal status multi-select filter works
- [ ] Combined filters work together (AND logic)
- [ ] Filter state persists in URL (shareable links)
- [ ] Reset button clears all filters

**Technical Requirements:**
- [ ] API query params processed: dateRange, from, to, segment, invoiceStatus, dealStatus
- [ ] All Prisma queries respect active filters
- [ ] React Query cache invalidates on filter changes
- [ ] No performance degradation with multiple filters active

**User Experience:**
- [ ] Filter changes update data instantly (no page reload)
- [ ] Visual indicator shows active filter count
- [ ] Export CSV respects active filters
- [ ] Loading states during data refresh
- [ ] Toast notification on filter apply/reset

## Output

After completion, commit changes with:

```bash
git add app/dashboard/insights/page.tsx components/dashboard/dashboard-filters.tsx app/api/analytics/bi-dashboard/route.ts
git commit -m "fix(insights): implement full filter support for BI dashboard

- Add backend support for segment, invoiceStatus, dealStatus filters
- Fix frontend to pass all filter params to API
- Update React Query cache key to include all filters
- Add visual feedback for active filters
- Ensure filters work together with AND logic

Closes: Quick Task 026"
```
