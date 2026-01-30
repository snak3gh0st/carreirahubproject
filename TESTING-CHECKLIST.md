# System Testing Checklist

This checklist verifies all recent fixes are working correctly.

## Test Environment Setup

- [ ] Database is accessible (Neon PostgreSQL)
- [ ] Redis is running (for BullMQ)
- [ ] Environment variables are configured
- [ ] Dev server started: `npm run dev`
- [ ] Browser opened to: `http://localhost:3000`

## Automated Tests

### Component & TypeScript Tests

```bash
npm run test:system -- --skip-build
```

**Expected Results:**
- ✅ All component files exist
- ✅ TypeScript compilation succeeds (no errors)
- ✅ QuickFilters component has auto-update logic
- ✅ ProfessionalSidebar has logout button
- ✅ API route has date filtering logic

### API Endpoint Tests

```bash
./scripts/test-api-filters.sh
```

**Expected Results:**
- ✅ All date range endpoints respond (200 or 401)
- ✅ Response has correct structure: `{ sales, finance, customers }`
- ✅ Combined filters work
- ⚠️ 401 responses are expected for unauthenticated requests

## Manual UI Testing

### 1. Logout Button Test

**Recent Fix:** Commit f4623ab - Made logout button visible in ProfessionalSidebar

**Steps:**
1. [ ] Navigate to `/dashboard`
2. [ ] Look at the sidebar (left side)
3. [ ] Scroll to bottom of sidebar
4. [ ] Locate user profile section
5. [ ] Verify logout icon (door with arrow) is visible
6. [ ] Click logout button
7. [ ] Verify redirect to `/auth/signin`

**Expected:**
- Logout button appears next to user avatar/name at bottom of sidebar
- Icon is a "LogOut" icon from lucide-react
- Button has hover effect (changes color)
- Clicking triggers signOut and redirects

**Bug if:**
- Logout button is missing
- Button is not clickable
- No redirect after clicking

---

### 2. QuickFilters Component Test

**Recent Fixes:** 
- Commit a6ccb98 - Created QuickFilters component
- Commit c9cd672 - Added QuickFilters to dashboard page

**Steps:**
1. [ ] Navigate to `/dashboard`
2. [ ] Locate "Time Period" filter section (should be above metrics)
3. [ ] Verify default filter is "This Year" (highlighted in blue)
4. [ ] Click "Last 7 Days"
5. [ ] Observe: URL updates to `?dateRange=last7`
6. [ ] Observe: Metrics update automatically (no Apply button needed)
7. [ ] Click "Last 30 Days"
8. [ ] Observe: URL updates, metrics refresh
9. [ ] Click "Reset" button
10. [ ] Verify: Returns to "This Year"

**Expected:**
- Filter section has 4 buttons: Last 7 Days, Last 30 Days, This Year, All Time
- Active filter is highlighted in blue/primary color
- URL updates immediately when clicking filter
- Metrics update without needing an "Apply" button
- Reset button appears when filter is not "This Year"
- Helper text mentions "Metrics update automatically"

**Bug if:**
- QuickFilters section is missing
- Clicking filter doesn't update URL
- Metrics don't update after clicking
- Apply button exists (shouldn't - that's the old pattern)

---

### 3. Dashboard Auto-Update Test

**Recent Fix:** Commit aa4be02 - Dashboard metrics update when filter changes

**Steps:**
1. [ ] Navigate to `/dashboard`
2. [ ] Note current "Total Revenue" value
3. [ ] Open browser DevTools → Network tab
4. [ ] Click "Last 30 Days" filter
5. [ ] Check Network tab for API call to `/api/dashboard/metrics?dateRange=last30`
6. [ ] Verify metrics on page updated
7. [ ] Click "This Year"
8. [ ] Check Network tab for API call with `?dateRange=thisYear`
9. [ ] Verify different metrics displayed

**Expected:**
- Each filter click triggers ONE API call to `/api/dashboard/metrics`
- API call includes `?dateRange=X` parameter matching clicked filter
- Response returns with filtered data
- UI updates with new metrics (revenue, invoices, customers, etc.)
- No page refresh occurs (SPA behavior)

**Bug if:**
- No API call made when clicking filter
- Multiple API calls triggered for one click
- API called but metrics don't update
- Page does full refresh

---

### 4. Insights Page Filters Test

**Recent Fixes:**
- Commit edd5dc5 - Insights page redesign
- Commit 8c9b621 - Default to YTD (This Year) on Insights

**Steps:**
1. [ ] Navigate to `/dashboard/insights`
2. [ ] Verify DashboardFilters section is visible at top
3. [ ] Check default filter is "This Year" or similar
4. [ ] Open filters (if collapsed)
5. [ ] Change date range filter
6. [ ] Click "Apply Filters"
7. [ ] Observe: URL updates with filter params
8. [ ] Observe: Charts and KPIs update with filtered data
9. [ ] Test other filters: segment, invoice status, deal status
10. [ ] Verify all filter combinations work

**Expected:**
- DashboardFilters component visible
- Has advanced filters: date range, custom dates, segment, statuses
- "Apply Filters" button exists (different from QuickFilters)
- Active filter count badge shows when filters applied
- Charts update with filtered data
- All filter combinations work together

**Bug if:**
- DashboardFilters missing
- Apply button doesn't work
- URL doesn't update
- Charts don't update with filtered data
- Filter combinations cause errors

---

### 5. API Date Filtering Test

**Recent Fix:** Commit aa4be02 - API applies date filters to database queries

**Steps:**
1. [ ] Open browser DevTools → Network tab
2. [ ] Navigate to `/dashboard`
3. [ ] Click "Last 7 Days"
4. [ ] Find API call to `/api/dashboard/metrics?dateRange=last7`
5. [ ] Check response: should have lower counts than "All Time"
6. [ ] Click "This Year"
7. [ ] Check response: should have YTD data only
8. [ ] Compare metrics between different date ranges
9. [ ] Verify counts are different (proving filtering works)

**Expected:**
- `dateRange=last7` returns data from last 7 days only
- `dateRange=last30` returns data from last 30 days only
- `dateRange=thisYear` returns data from start of year
- `dateRange=allTime` returns all historical data
- Counts/amounts differ based on filter (proving filter is applied)

**Bug if:**
- All filters return same data
- API ignores dateRange parameter
- Date calculations are wrong
- No data returned when filter applied

---

### 6. Cross-Page Navigation Test

**Verify consistency across pages:**

**Steps:**
1. [ ] Start on `/dashboard` with "Last 30 Days" filter active
2. [ ] Note URL has `?dateRange=last30`
3. [ ] Click "Insights" link in sidebar
4. [ ] Check if Insights page uses same filter or resets
5. [ ] Return to `/dashboard`
6. [ ] Verify filter state is maintained
7. [ ] Test navigation with different filters active

**Expected:**
- Dashboard and Insights manage filters independently
- Each page has its own default
- URL state is preserved within each page
- No errors when switching pages

---

### 7. TypeScript Compilation Test

**Verify no TypeScript errors:**

```bash
npx tsc --noEmit
```

**Expected:**
- No compilation errors
- No type mismatches
- All imports resolve correctly

---

### 8. Production Build Test

**Verify system builds for production:**

```bash
npm run build
```

**Expected:**
- Build completes successfully
- No TypeScript errors
- No runtime errors during build
- All routes compiled
- API routes included in build

---

## Bug Reporting Template

If you find a bug, use this format:

```markdown
### Bug: [Short Description]

**Location:** [Page/Component]
**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Behavior:**


**Actual Behavior:**


**Screenshots/Errors:**


**Browser:** [Chrome/Firefox/Safari + version]
**Commit:** [Git commit hash if known]
```

---

## Success Criteria

All tests pass when:

- [ ] ✅ Logout button visible and functional
- [ ] ✅ QuickFilters renders on main dashboard
- [ ] ✅ QuickFilters auto-update works (no Apply button)
- [ ] ✅ Dashboard API applies date filters correctly
- [ ] ✅ Different date ranges return different data
- [ ] ✅ Insights page has DashboardFilters
- [ ] ✅ Insights filters work with Apply button
- [ ] ✅ URL updates reflect filter state
- [ ] ✅ TypeScript compilation succeeds
- [ ] ✅ Production build succeeds
- [ ] ✅ No runtime errors in browser console

---

## Test Results

**Date Tested:** _________________

**Tested By:** _________________

**Environment:**
- Node version: _________________
- Database: _________________
- Browser: _________________

**Results:**

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| Logout Button | ☐ | ☐ | |
| QuickFilters Component | ☐ | ☐ | |
| Dashboard Auto-Update | ☐ | ☐ | |
| Insights Page Filters | ☐ | ☐ | |
| API Date Filtering | ☐ | ☐ | |
| Cross-Page Navigation | ☐ | ☐ | |
| TypeScript Compilation | ☐ | ☐ | |
| Production Build | ☐ | ☐ | |

**Overall Status:** ☐ All Pass | ☐ Some Failures | ☐ Major Issues

**Issues Found:**

1. 
2. 
3. 

**Additional Notes:**


