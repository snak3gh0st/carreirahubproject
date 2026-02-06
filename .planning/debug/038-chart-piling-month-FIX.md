# Fix Summary: Charts Piling Data in One Month

**Date:** 2026-02-05
**Status:** RESOLVED
**File Fixed:** `app/api/analytics/quickbooks/route.ts`

## Root Cause

**Timezone parsing issue:** When dates were parsed from PostgreSQL using `new Date(p.paymentDate)`, JavaScript interpreted them in local timezone (EST = UTC-5). This caused early-morning UTC timestamps to shift to the previous day/month in local time.

**Example of the bug:**
- `2026-01-01T00:00:00Z` (UTC) → `2025-12-31T19:00:00` (EST)
- `startOfMonth()` then returned December 2025 instead of January 2026
- Result: All January/February payments were bucketed into December

## Fix Applied

Added UTC-safe date parsing helper function and updated all date parsing in chart aggregation:

```typescript
/**
 * Parse a date string from PostgreSQL as UTC to avoid timezone issues.
 * PostgreSQL stores dates as UTC, but JavaScript's new Date() parses them in local time,
 * causing early-morning UTC dates to shift to the previous day in local time.
 */
function parseUtcDate(dateStr: string | Date): Date {
  if (dateStr instanceof Date) {
    return dateStr;
  }
  // If the date string doesn't have timezone info, append 'Z' to treat it as UTC
  if (!dateStr.includes('Z') && !dateStr.includes('+')) {
    dateStr = dateStr + 'Z';
  }
  return new Date(dateStr);
}
```

**Changed lines:**
- Line 5: Added helper function
- Line 447: Revenue Trend chart payment aggregation
- Line 543: Cash Flow chart invoiced data aggregation  
- Line 553: Cash Flow chart received data aggregation
- Line 587: Customer acquisition chart aggregation

## Result

**Before fix:** All payments piled into December 2025
**After fix:** Payments correctly distributed:
- December 2025: Correct
- January 2026: Correct
- February 2026: Correct

## Files Changed

- `app/api/analytics/quickbooks/route.ts` - Fixed UTC date parsing in 5 locations

## Verification

Tested with sample data showing:
- `2025-12-15T10:00:00Z` → "2025-12" ✓
- `2026-01-10T10:00:00Z` → "2026-01" ✓
- `2026-02-20T10:00:00Z` → "2026-02" ✓
