---
phase: quick-016
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/api/invoices/create/route.ts
autonomous: true

must_haves:
  truths:
    - "Entry invoices are sent immediately (due today)"
    - "ALL installment invoices (including first) are scheduled for 5 days before due date"
    - "Single invoices (no entry, no installments) are sent immediately"
    - "No installment invoice is sent on creation day"
  artifacts:
    - path: "app/api/invoices/create/route.ts"
      provides: "Email timing logic that distinguishes entry from installments"
      min_lines: 500
  key_links:
    - from: "app/api/invoices/create/route.ts"
      to: "shouldSendEmail flag"
      via: "isEntryInvoice logic only"
      pattern: "shouldSendEmail.*=.*isEntryInvoice"
---

<objective>
Fix installment email timing - send ONLY entry invoices immediately, schedule ALL installments (including first) for 5 days before due date.

Purpose: After quick-015 separated entry from installments, the email logic incorrectly sends BOTH entry AND first installment immediately. First installment should be scheduled like all other installments.

Output: Corrected email timing logic that sends only entry invoices immediately and schedules all installments.
</objective>

<execution_context>
@~/.config/Claude/get-shit-done/workflows/execute-plan.md
@~/.config/Claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@app/api/invoices/create/route.ts

## Current Behavior (WRONG)

When creating invoices with entry + installments:
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

**Problem:** Line 339 sets `shouldSendEmail = isEntryInvoice || isFirstInstallment`, which sends BOTH entry AND first installment immediately.

## Expected Behavior (CORRECT)

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

**ALL installments should be scheduled, ONLY entry sends immediately**

## Email Logic Rules

1. **Single invoice (no installments, no entry):** Send immediately (customer pays today)
2. **Entry invoice:** Send immediately (customer needs to pay entry TODAY)
3. **ALL installments (including first):** Schedule for 5 days before due date (DO NOT send immediately)
4. **Edge case - No entry, first installment due today:** Send immediately (special case where first installment IS the entry)

## Root Cause

File: `app/api/invoices/create/route.ts` line 339:

```typescript
const shouldSendEmail = isEntryInvoice || isFirstInstallment;  // ❌ WRONG
```

Should be:

```typescript
// Send immediately ONLY for:
// - Single invoices (invoiceCountToCreate === 1)
// - Entry invoices (isEntryInvoice)
// - No-entry installments where first is due TODAY (special case)
const isSingleInvoice = invoiceCountToCreate === 1;
const isNoEntryFirstInstallmentDueToday = !entryAmount && i === 1 && invoiceDueDate.toDateString() === new Date().toDateString();
const shouldSendEmail = isSingleInvoice || isEntryInvoice || isNoEntryFirstInstallmentDueToday;
```

## Related Code Context

```typescript
// Lines 336-339 (current logic)
const isInstallmentSeries = invoiceCountToCreate > 1;
const isEntryInvoice = entryAmount > 0 && i === 1;
const isFirstInstallment = entryAmount > 0 ? i === 2 : i === 1;
const shouldSendEmail = isEntryInvoice || isFirstInstallment;  // ❌ BUG HERE
```

## Testing Scenarios

After fix, verify these scenarios:

1. **Entry + 3 installments:**
   - Entry (due today) → Email sent ✓
   - Inst 1 (due +30d) → Scheduled for -5d ✓
   - Inst 2 (due +60d) → Scheduled for -5d ✓
   - Inst 3 (due +90d) → Scheduled for -5d ✓

2. **Single invoice (no installments):**
   - Invoice (due today) → Email sent ✓

3. **No entry, 3 installments, first due today:**
   - Inst 1 (due today) → Email sent ✓
   - Inst 2 (due +30d) → Scheduled for -5d ✓
   - Inst 3 (due +60d) → Scheduled for -5d ✓

4. **No entry, 3 installments, first due +30d:**
   - Inst 1 (due +30d) → Scheduled for -5d ✓
   - Inst 2 (due +60d) → Scheduled for -5d ✓
   - Inst 3 (due +90d) → Scheduled for -5d ✓

</context>

<tasks>

<task type="auto">
  <name>Fix email timing logic to send only entry invoices immediately</name>
  <files>app/api/invoices/create/route.ts</files>
  <action>
Update the email sending logic on line 339 to correctly handle email timing:

**Current code (line 339):**
```typescript
const shouldSendEmail = isEntryInvoice || isFirstInstallment;
```

**Replace with:**
```typescript
// Email sending logic:
// 1. Single invoice (no installments): Send immediately
// 2. Entry invoice: Send immediately (customer needs to pay TODAY)
// 3. ALL installments: Schedule for 5 days before due date (DO NOT send immediately)
// 4. Exception: No-entry first installment due TODAY → send immediately (acts as entry)
const isSingleInvoice = invoiceCountToCreate === 1;
const isNoEntryFirstInstallmentDueToday = !entryAmount && i === 1 && invoiceDueDate.toDateString() === new Date().toDateString();
const shouldSendEmail = isSingleInvoice || isEntryInvoice || isNoEntryFirstInstallmentDueToday;
```

**Update the console.log on line 341** to include new flags:
```typescript
console.log(`[INVOICE_CREATE] Email decision for invoice ${i}/${invoiceCountToCreate}:`, {
  isInstallmentSeries,
  isSingleInvoice,
  isEntryInvoice,
  isFirstInstallment,
  isNoEntryFirstInstallmentDueToday,
  shouldSendEmail,
  description: invoiceDescription,
});
```

**Update the comment block on lines 331-335** to reflect corrected logic:
```typescript
// Determine if this invoice should be emailed immediately
// LOGIC:
// - Single invoice (no installments): Send immediately
// - Entry invoice: Send immediately (customer pays TODAY)
// - ALL installments (including first): DRAFT (send 5 days before due date)
// - Exception: No-entry first installment due TODAY → send immediately
```

**Why this fixes the bug:**
- Removes `isFirstInstallment` from the send condition
- Only sends entry invoices immediately (when entryAmount > 0 AND i === 1)
- All installments are now scheduled (handled by the else block on line 423)
- Handles edge case: no-entry + first installment due today (acts like an entry)

**DO NOT change:**
- The email scheduling logic in the else block (lines 423-440) - it already works correctly
- The QuickBooks API call logic (lines 350-422) - only change the shouldSendEmail condition
- The integration logging - it already captures the correct metadata

**Expected behavior after fix:**
- Entry invoice: `shouldSendEmail = true` → sent immediately
- First installment: `shouldSendEmail = false` → scheduled for 5 days before due date
- Subsequent installments: `shouldSendEmail = false` → scheduled for 5 days before due date
- Single invoice: `shouldSendEmail = true` → sent immediately
  </action>
  <verify>
Test all scenarios with invoice creation:

```bash
# Verify the code change is correct
grep -A 3 "const shouldSendEmail" app/api/invoices/create/route.ts

# Expected output should show:
# const isSingleInvoice = invoiceCountToCreate === 1;
# const isNoEntryFirstInstallmentDueToday = ...
# const shouldSendEmail = isSingleInvoice || isEntryInvoice || isNoEntryFirstInstallmentDueToday;
```

**Manual verification scenarios:**
1. Create entry + 3 installments → Check logs for "Email sent immediately" ONLY for entry invoice
2. Create single invoice → Check logs for "Email sent immediately"
3. Check that installments show "Email will be sent 5 days before due date" message
  </verify>
  <done>
- Line 339 replaced with multi-line logic checking isSingleInvoice, isNoEntryFirstInstallmentDueToday
- Comment block updated to reflect correct logic
- Console.log updated to include new flags
- grep confirms shouldSendEmail now checks 3 conditions (not 2)
- Entry invoices send immediately, ALL installments are scheduled
  </done>
</task>

</tasks>

<verification>
After task completion:

1. **Code inspection:**
   ```bash
   grep -B 10 -A 5 "const shouldSendEmail" app/api/invoices/create/route.ts
   ```
   Should show updated logic with 3 conditions (isSingleInvoice, isEntryInvoice, isNoEntryFirstInstallmentDueToday)

2. **Integration log check:**
   - Entry invoices log: `action: "invoice_email_sent"` with `isEntryInvoice: true`
   - First installment logs: `action: "installment_invoice_scheduled"` (NOT invoice_email_sent)
   - Subsequent installments log: `action: "installment_invoice_scheduled"`

3. **Email timing verification:**
   - Entry invoice: Sent immediately (EmailStatus: "EmailSent")
   - First installment: DRAFT status, scheduled for (due_date - 5 days)
   - Subsequent installments: DRAFT status, scheduled for (due_date - 5 days)
</verification>

<success_criteria>
- [ ] `shouldSendEmail` logic updated to exclude first installment
- [ ] Entry invoices (entryAmount > 0 && i === 1) send immediately
- [ ] ALL installments (including first) are scheduled for 5 days before due date
- [ ] Single invoices (no installments) send immediately
- [ ] Edge case handled: no-entry first installment due today sends immediately
- [ ] Comments and console.log updated to reflect correct logic
- [ ] Code passes grep verification showing updated condition
- [ ] No regression in email scheduling for subsequent installments
</success_criteria>

<output>
After completion, create `.planning/quick/016-fix-installment-email-timing-send-only-5/016-SUMMARY.md` with:
- Code changes made (specific lines modified)
- Before/after behavior comparison
- Test scenarios verified
- Integration log examples showing correct timing
</output>
