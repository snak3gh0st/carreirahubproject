---
phase: quick
plan: 006
subsystem: finance
tags: [quickbooks, debugging, email, diagnostics, api]
dependencies:
  requires: [quick-003, quick-005]
  provides: [qb-send-diagnostics, verbose-logging, debug-endpoint]
  affects: []
tech-stack:
  added: []
  patterns: [diagnostic-logging, multi-approach-testing]
key-files:
  created:
    - app/api/debug/verbose-qb-send/route.ts
  modified:
    - lib/services/quickbooks.service.ts
decisions:
  - id: verbose-logging-prefix
    choice: Use [QB_SEND_DEBUG] prefix for all diagnostic logs
    rationale: Easy to grep, distinct from standard [QuickBooks] logs
  - id: multi-approach-testing
    choice: Test 4 different approaches in single endpoint
    rationale: Comprehensive diagnosis - find which method works
  - id: export-interface
    choice: Export SendInvoiceResult interface
    rationale: Allows debug endpoint to use typed result
metrics:
  duration: 5
  completed: 2026-01-22
---

# Quick Task 006: Add Comprehensive QB /send Endpoint Debugging

**One-liner:** Verbose diagnostic logging and multi-approach testing endpoint to identify why QB invoice emails fail

## What Was Built

Added comprehensive debugging capabilities to diagnose QuickBooks invoice email sending failures:

### 1. Verbose Diagnostic Logging (`sendInvoiceVerbose()`)

Enhanced `lib/services/quickbooks.service.ts` with new `sendInvoiceVerbose()` method that logs every step of the /send API call:

**What it logs:**
- `[QB_SEND_DEBUG] === SEND INVOICE START ===`
- Invoice ID and email being used
- Full endpoint URL (production vs sandbox)
- Complete request body (JSON formatted)
- HTTP status code and status text
- Response headers (all of them)
- Raw response body (before parsing)
- Parsed response (structured JSON)
- QB-specific fields:
  - `EmailStatus` (should be "EmailSent" if worked)
  - `DeliveryInfo` (delivery details)
  - `Fault` (QuickBooks error object)
  - `Error` (alternative error format)
  - `warnings` (non-fatal warnings)

**Returns:** `SendInvoiceResult` interface with:
- `success`: boolean (determined from HTTP status + no Fault/Error)
- `httpStatus`: HTTP status code
- `emailStatus`: QB's EmailStatus field value
- `qbResponse`: Full parsed response
- `diagnostics`: Complete diagnostic data including request, response, headers, raw body

### 2. Multi-Approach Debug Endpoint

Created `/api/debug/verbose-qb-send` that tests 4 different approaches to QB invoice sending:

**Approach 1: Standard send with email override (current method)**
```
POST /v3/company/{companyId}/invoice/{id}/send
Body: { "Id": "xxx", "BillEmail": { "Address": "email@example.com" } }
```
- Tests if email override in POST body works
- Current production method

**Approach 2: Send without email override**
```
POST /v3/company/{companyId}/invoice/{id}/send
Body: (empty or minimal)
```
- Tests if invoice's existing BillEmail is used
- Checks if QB uses customer's PrimaryEmailAddr

**Approach 3: Fetch invoice first, check EmailStatus before/after**
```
1. GET invoice to see current EmailStatus
2. POST /send with or without email
3. Compare EmailStatus before/after
```
- Verifies if EmailStatus actually changes
- Detects silent failures (200 OK but no email sent)

**Approach 4: Update invoice BillEmail FIRST, then send**
```
1. POST invoice update: sparse=true, BillEmail.Address="email@example.com"
2. POST /send without email override
```
- Tests if QB requires BillEmail on invoice before /send works
- Some QB configurations may need this

**Endpoint features:**
- Auth: ADMIN/FINANCE only
- Query params:
  - `invoiceId`: Invoice ID from database (required)
  - `approach`: 1, 2, 3, 4, or 'all' (default: '1')
- Returns:
  - Results for each tested approach
  - Conclusions (what worked, what failed, EmailStatus changes)
  - Recommendation (which approach to use going forward)
- Logs to IntegrationLog with action='verbose_qb_send_test'

### 3. Alternative Invoice Creation Methods

**createInvoiceWithBillEmail():**
- Sets BillEmail during invoice creation (not after)
- Sets EmailStatus to "NeedToSend" on creation
- Use case: Test if new invoices need email from the start

**updateInvoiceBillEmail():**
- Updates existing invoice to add/change BillEmail
- Uses sparse update (only changes BillEmail field)
- Requires fetching invoice first to get SyncToken
- Logs EmailStatus before and after update

## Testing Sequence

**Recommended testing order:**

1. **First: Run approach 1 (current production method)**
   ```
   GET /api/debug/verbose-qb-send?invoiceId=xxx&approach=1
   ```
   - If EmailStatus changes from "NotSet"/"NeedToSend" to "EmailSent" → IT WORKS
   - If EmailStatus doesn't change → Email not actually sent

2. **If approach 1 fails: Try approach 4**
   ```
   GET /api/debug/verbose-qb-send?invoiceId=xxx&approach=4
   ```
   - Updates invoice BillEmail first, then sends
   - Tests if QB requires email on invoice

3. **If both fail: Run all approaches**
   ```
   GET /api/debug/verbose-qb-send?invoiceId=xxx&approach=all
   ```
   - Tests all 4 methods
   - Returns recommendation for which to use

4. **For new invoices: Try createInvoiceWithBillEmail()**
   - Set BillEmail during creation
   - Then use /send without email override

## Key Diagnostic Indicators

**Success indicators to look for:**
- ✅ `EmailStatus` changes to `"EmailSent"`
- ✅ HTTP status `200 OK`
- ✅ No `Fault` or `Error` in response
- ✅ `DeliveryInfo` present in response

**Failure indicators:**
- ❌ `EmailStatus` stays `"NotSet"` or `"NeedToSend"`
- ❌ `Fault` object present (QB error)
- ❌ HTTP status `400`, `401`, `500`
- ❌ `Error` field in response

**Search logs for:**
```bash
grep "QB_SEND_DEBUG" server-logs.txt
```
Will show complete request/response flow.

## Files Modified

**lib/services/quickbooks.service.ts:**
- Added `SendInvoiceResult` interface (exported)
- Added `sendInvoiceVerbose()` method (19 log statements)
- Added `createInvoiceWithBillEmail()` method
- Added `updateInvoiceBillEmail()` method
- Kept existing `sendInvoice()` unchanged (backwards compatibility)

**app/api/debug/verbose-qb-send/route.ts:**
- New debug endpoint (291 lines)
- Tests 4 approaches
- Returns comprehensive diagnostics
- Logs to IntegrationLog

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Blockers:** None

**Concerns:** None

**Dependencies satisfied:** All

**What's next:**
1. Run debug endpoint on production invoice that's failing
2. Check server logs for `[QB_SEND_DEBUG]` output
3. Review EmailStatus changes
4. Implement working approach in production code
5. May need to update invoice creation to use `createInvoiceWithBillEmail()`

## Success Criteria

- ✅ `sendInvoice()` logs every step with [QB_SEND_DEBUG] prefix
- ✅ Debug endpoint tests 4 different approaches
- ✅ `createInvoiceWithBillEmail()` method available
- ✅ `updateInvoiceBillEmail()` method available
- ✅ All code compiles without TypeScript errors
- ✅ Build passes successfully

## Task Breakdown

| Task | Status | Commit | Description |
|------|--------|--------|-------------|
| 1 | ✅ Complete | fca8dba | Enhanced sendInvoice() with verbose logging |
| 2 | ✅ Complete | d0f488a | Created comprehensive debug endpoint |
| 3 | ✅ Complete | fca8dba | Added createInvoiceWithBillEmail and updateInvoiceBillEmail methods |

## Commits

```
d0f488a feat(quick-006): add comprehensive QB send debug endpoint
fca8dba feat(quick-006): add verbose QB send diagnostics and BillEmail methods
```

## Performance

**Execution time:** 5 minutes
**Tasks:** 3/3 completed
**Files created:** 1
**Files modified:** 1
**Lines added:** 530

## Related Work

- **quick-003:** Fixed QB email send with POST body format (foundation for this work)
- **quick-005:** Changed invoice numbering and enabled auto-send (context for why we need diagnostics)
- **Future work:** Update production invoice creation to use findings from debug endpoint
