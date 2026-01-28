---
phase: quick
plan: "020"
subsystem: api
tags: [quickbooks, error-handling, validation]

# Dependency graph
requires:
  - phase: quick-018
    provides: Single payment invoice detection with isSinglePayment flag
provides:
  - Enhanced QuickBooks error diagnostics with Fault.Error parsing
  - Invoice payload validation preventing invalid itemRef and amounts
affects: [invoice-creation, quickbooks-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [defensive-validation, detailed-error-logging]

key-files:
  created: []
  modified:
    - lib/services/quickbooks.service.ts
    - app/api/invoices/create/route.ts

key-decisions:
  - "Parse and log QuickBooks Fault.Error details for better debugging"
  - "Validate invoice payload before QB API call to prevent 400 errors"
  - "Reject demo/placeholder itemRef values before reaching QuickBooks"

patterns-established:
  - "Enhanced error logging: Log request payload AND parsed QB error response for all QB API failures"
  - "Defensive validation: Validate all critical fields before external API calls"

# Metrics
duration: 1min
completed: 2026-01-28
---

# Quick Task 020: QuickBooks API Error Diagnostics and Validation

**Enhanced QuickBooks error logging with Fault.Error parsing and invoice payload validation to prevent 400 Bad Request errors**

## Performance

- **Duration:** 1 min
- **Started:** 2026-01-28T05:59:00Z
- **Completed:** 2026-01-28T06:00:21Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Added comprehensive error logging in createInvoiceWithBillEmail that parses QuickBooks Fault.Error responses
- Implemented invoice payload validation before QB API calls
- Prevent invalid itemRef (demo IDs) and negative amounts from reaching QuickBooks API
- Log full request payload on errors for rapid debugging

## Task Commits

Each task was completed and committed atomically:

1. **Task 1: Add Diagnostic Error Logging to createInvoiceWithBillEmail** - `c32003f` (fix)
2. **Task 2: Fix Invoice Creation Payload Validation** - `c32003f` (fix)
3. **Task 3: Test and Commit Fix** - `c32003f` (fix)

All tasks committed together in: `c32003f` (fix(quick-020): add QB error diagnostics and validate invoice payload)

## Files Created/Modified
- `lib/services/quickbooks.service.ts` - Added try/catch with enhanced error logging that parses QB Fault.Error response
- `app/api/invoices/create/route.ts` - Added defensive validation for line items (itemRef, amount) before QB API call

## Decisions Made

**1. Parse QuickBooks Fault.Error Structure**
- QuickBooks API returns errors in `Fault.Error[]` array format
- Each error has `code`, `Message`, and `Detail` fields
- Parse and log each error individually for clear debugging
- Fallback to raw error text if parsing fails

**2. Validate Before API Call**
- Check for invalid itemRef values (demo-service-1, demo-service-2)
- Ensure amounts are positive numbers (min 0.01)
- Validate at least one line item exists
- Log full payload before sending to QB

**3. Enhanced Error Context**
- Log request payload on failures (critical for debugging)
- Log parsed QB error response
- Include both human-readable message and detail code
- Keep existing error throwing behavior (no silent failures)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation straightforward.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for production:**
- Invoice creation now has comprehensive error diagnostics
- Invalid payloads caught before reaching QuickBooks API
- Error logs will clearly identify root cause of 400 Bad Request errors

**Testing recommendation:**
- Monitor logs on next invoice creation to see detailed diagnostics
- If 400 error occurs, check console for "QB Error Response" with specific Fault.Error details
- Validation should catch common issues (invalid itemRef, negative amounts) before API call

---
*Phase: quick*
*Completed: 2026-01-28*
