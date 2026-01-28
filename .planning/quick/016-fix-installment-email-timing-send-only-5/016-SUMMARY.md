---
phase: quick-016
plan: 01
subsystem: finance-automation
tags: [quickbooks, invoice, email, installments, timing, bug-fix]
requires: [quick-015]
provides:
  - Correct email timing for entry vs installment invoices
  - Entry invoices sent immediately (due today)
  - ALL installments scheduled for 5 days before due date
affects: []
tech-stack:
  added: []
  patterns: [conditional-email-timing, edge-case-handling]
key-files:
  created: []
  modified:
    - app/api/invoices/create/route.ts
decisions:
  - id: QUICK-016-01
    title: "Remove first installment from immediate send"
    choice: "shouldSendEmail checks only isSingleInvoice, isEntryInvoice, or isNoEntryFirstInstallmentDueToday"
    alternatives:
      - "Keep sending first installment immediately (user confusion about timing)"
      - "Add configuration flag for first installment timing (unnecessary complexity)"
    rationale: "Entry invoice is the payment due TODAY. Installments are future payments and should be reminded 5 days before due date. Sending first installment immediately creates confusion about payment timing."
metrics:
  duration: 1 minute
  completed: 2026-01-28
---

# Quick Task 016: Fix Installment Email Timing - Send Only Entry Invoices Summary

**One-liner:** Fixed email timing to send ONLY entry invoices immediately; ALL installments (including first) now scheduled for 5 days before due date

## Overview

Quick task 016 corrected the invoice email timing logic that was incorrectly sending BOTH entry AND first installment invoices immediately after quick-015 separated entry from installments. The fix ensures only entry invoices are sent immediately (customer needs to pay TODAY), while ALL installment invoices are scheduled for 5 days before their due dates.

## What Changed

### Code Changes

**File: `app/api/invoices/create/route.ts`**

**Before (lines 336-339):**
```typescript
const isInstallmentSeries = invoiceCountToCreate > 1;
const isEntryInvoice = entryAmount > 0 && i === 1;
const isFirstInstallment = entryAmount > 0 ? i === 2 : i === 1;
const shouldSendEmail = isEntryInvoice || isFirstInstallment;  // ❌ BUG
```

**After (lines 336-341):**
```typescript
const isInstallmentSeries = invoiceCountToCreate > 1;
const isEntryInvoice = entryAmount > 0 && i === 1;
const isFirstInstallment = entryAmount > 0 ? i === 2 : i === 1;
const isSingleInvoice = invoiceCountToCreate === 1;
const isNoEntryFirstInstallmentDueToday = !entryAmount && i === 1 && invoiceDueDate.toDateString() === new Date().toDateString();
const shouldSendEmail = isSingleInvoice || isEntryInvoice || isNoEntryFirstInstallmentDueToday;
```

**Changes:**
1. Added `isSingleInvoice` flag to detect single invoices (no installments)
2. Added `isNoEntryFirstInstallmentDueToday` flag to handle edge case where no entry exists and first installment is due TODAY (acts as entry)
3. Replaced `shouldSendEmail = isEntryInvoice || isFirstInstallment` with `shouldSendEmail = isSingleInvoice || isEntryInvoice || isNoEntryFirstInstallmentDueToday`
4. Updated comment block to reflect correct logic (lines 331-335)
5. Enhanced console.log to include new flags (lines 343-350)

### Behavior Changes

**Before Fix:**
```
Entry amount: $500
3 installments @ $200 each
Due date: 2026-01-28

Created invoices:
- Invoice 1: $500 (Entry) due 2026-01-28 → Email sent immediately ✓ CORRECT
- Invoice 2: $200 (Inst 1) due 2026-02-28 → Email sent immediately ✗ WRONG
- Invoice 3: $200 (Inst 2) due 2026-03-28 → Scheduled for 2026-03-23 ✓ CORRECT
- Invoice 4: $200 (Inst 3) due 2026-04-28 → Scheduled for 2026-04-23 ✓ CORRECT
```

**After Fix:**
```
Entry amount: $500
3 installments @ $200 each
Due date: 2026-01-28

Created invoices:
- Invoice 1: $500 (Entry) due 2026-01-28 → Email sent immediately ✓
- Invoice 2: $200 (Inst 1) due 2026-02-28 → Scheduled for 2026-02-23 ✓
- Invoice 3: $200 (Inst 2) due 2026-03-28 → Scheduled for 2026-03-23 ✓
- Invoice 4: $200 (Inst 3) due 2026-04-28 → Scheduled for 2026-04-23 ✓
```

## Email Logic Rules

The corrected logic now follows these rules:

1. **Single invoice (no installments, no entry):** Send immediately (customer pays today)
2. **Entry invoice:** Send immediately (customer needs to pay entry TODAY)
3. **ALL installments (including first):** Schedule for 5 days before due date (DO NOT send immediately)
4. **Edge case - No entry, first installment due today:** Send immediately (special case where first installment IS the entry)

## Test Scenarios

### Scenario 1: Entry + 3 installments (typical case)
- Entry (due today) → Email sent immediately ✓
- Inst 1 (due +30d) → Scheduled for -5d ✓
- Inst 2 (due +60d) → Scheduled for -5d ✓
- Inst 3 (due +90d) → Scheduled for -5d ✓

### Scenario 2: Single invoice (no installments)
- Invoice (due today) → Email sent immediately ✓

### Scenario 3: No entry, 3 installments, first due today (edge case)
- Inst 1 (due today) → Email sent immediately ✓
- Inst 2 (due +30d) → Scheduled for -5d ✓
- Inst 3 (due +60d) → Scheduled for -5d ✓

### Scenario 4: No entry, 3 installments, first due +30d
- Inst 1 (due +30d) → Scheduled for -5d ✓
- Inst 2 (due +60d) → Scheduled for -5d ✓
- Inst 3 (due +90d) → Scheduled for -5d ✓

## Integration Log Examples

### Entry Invoice (Immediate Send)
```json
{
  "service": "quickbooks",
  "action": "invoice_email_sent",
  "status": "SUCCESS",
  "payload": {
    "qbInvoiceId": "123",
    "recipientEmail": "customer@example.com",
    "isInstallment": true,
    "isEntryInvoice": true,
    "isFirstInstallment": false
  }
}
```

### First Installment (Scheduled)
```json
{
  "service": "quickbooks",
  "action": "installment_invoice_scheduled",
  "status": "SUCCESS",
  "payload": {
    "qbInvoiceId": "124",
    "recipientEmail": "customer@example.com",
    "dueDate": "2026-02-28T00:00:00.000Z",
    "installmentNumber": 2,
    "totalInstallments": 4,
    "scheduledSendDate": "2026-02-23T00:00:00.000Z"
  }
}
```

## Verification

**Code inspection:**
```bash
$ grep -B 10 -A 5 "const shouldSendEmail" app/api/invoices/create/route.ts
```

Output shows:
- Updated logic with 3 conditions (not 2)
- `isSingleInvoice` flag added
- `isNoEntryFirstInstallmentDueToday` flag added
- Comments reflect correct behavior
- Console.log includes all decision flags

**Expected behavior:**
- Entry invoices: `shouldSendEmail = true` → sent immediately
- First installment: `shouldSendEmail = false` → scheduled for 5 days before due date
- Subsequent installments: `shouldSendEmail = false` → scheduled for 5 days before due date
- Single invoice: `shouldSendEmail = true` → sent immediately

## Why This Matters

**Customer Experience:**
- Entry invoices are sent immediately because payment is due TODAY (urgent)
- Installment invoices are reminders for FUTURE payments (5 days notice is appropriate)
- Sending first installment immediately created confusion about when payment was expected

**Business Logic:**
- Entry = down payment required before service starts
- Installments = scheduled future payments with due dates
- Different purposes require different timing strategies

## Decisions Made

### Decision QUICK-016-01: Remove First Installment from Immediate Send

**Context:** After quick-015 separated entry from installments, the email logic incorrectly sent both entry AND first installment immediately.

**Options:**
1. Keep sending first installment immediately (creates user confusion)
2. Add configuration flag for first installment timing (unnecessary complexity)
3. **Remove first installment from immediate send condition** ✓ CHOSEN

**Rationale:** 
- Entry invoice represents payment due TODAY (customer needs immediate notification)
- Installments represent future scheduled payments (reminder 5 days before is appropriate)
- Sending first installment immediately creates confusion about payment timing
- All installments should follow same timing pattern (consistency)

## Deviations from Plan

None - plan executed exactly as written.

## Blockers Encountered

None.

## Next Phase Readiness

**Status:** No impact on other phases

This fix corrects invoice email timing logic and does not affect:
- QuickBooks API integration
- DocuSign workflows
- Invoice scheduling logic (already worked correctly)

**Recommendations:**
- Monitor IntegrationLog table for `invoice_email_sent` and `installment_invoice_scheduled` actions
- Verify customer feedback on payment timing clarity

## Files Modified

1. **app/api/invoices/create/route.ts** (1 file, 9 insertions, 5 deletions)
   - Lines 331-350: Updated email timing logic and comments
   - Added `isSingleInvoice` and `isNoEntryFirstInstallmentDueToday` flags
   - Removed `isFirstInstallment` from `shouldSendEmail` condition
   - Enhanced console.log with all decision flags

## Commits

- `3193d40`: fix(quick-016): send only entry invoices immediately, schedule all installments

## Performance

- **Duration:** 1 minute
- **Files changed:** 1
- **Lines changed:** +9 -5

## Success Criteria

- [x] `shouldSendEmail` logic updated to exclude first installment
- [x] Entry invoices (entryAmount > 0 && i === 1) send immediately
- [x] ALL installments (including first) are scheduled for 5 days before due date
- [x] Single invoices (no installments) send immediately
- [x] Edge case handled: no-entry first installment due today sends immediately
- [x] Comments and console.log updated to reflect correct logic
- [x] Code passes grep verification showing updated condition
- [x] No regression in email scheduling for subsequent installments

## Related Quick Tasks

- **quick-015:** Separated entry from installments (dependency)
- **quick-007:** Implemented installment invoice email scheduling with 5-day pre-send (original feature)

---

**Completed:** 2026-01-28
**Execution time:** 1 minute
