# Debug Session: Charts Piling Data in One Month

**Created:** 2026-02-04
**Status:** RESOLVED
**Goal:** Fix chart data distribution - data piling in one month instead of spreading across Dec/Jan/Feb

## Root Cause

**Timezone parsing issue:** Dates from PostgreSQL were parsed in local timezone (EST = UTC-5), causing early-morning UTC timestamps to shift to the previous day/month.

**Example:**
- `2026-01-01T00:00:00Z` (UTC) → `2025-12-31T19:00:00` (EST)
- `startOfMonth()` returned December 2025 instead of January 2026
- All January/February payments bucketed into December

## Fix Applied

Added `parseUtcDate()` helper function to ensure UTC parsing, applied to all chart aggregation logic.

## Resolution

**Fix file:** `.planning/debug/038-chart-piling-month-FIX.md`
**Files changed:** `app/api/analytics/quickbooks/route.ts` (5 locations)
**Status:** WORKING - Data now distributes correctly across Dec/Jan/Feb
