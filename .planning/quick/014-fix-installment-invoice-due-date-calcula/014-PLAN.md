---
type: quick
task: 014
status: pending
files_modified:
  - app/api/invoices/create/route.ts
  - app/dashboard/invoices/new/InvoiceForm.tsx
autonomous: true
---

<objective>
Fix installment invoice due date calculation logic to correctly handle entry payment scenarios.

**Problem:** When creating invoices with entry + installments, the first separate installment invoice is due on the same date as the entry invoice, instead of one month later.

**Root Cause:** The due date calculation in the API route doesn't properly account for the fact that when an entry exists, the first invoice combines entry + first installment (both due today), so the NEXT invoice (first separate installment) should be due 1 month later, not on the same date.

**Expected Behavior:**
- WITH ENTRY: Entry+Inst1 due today → Inst2 due in 1 month → Inst3 due in 2 months
- WITHOUT ENTRY: Inst1 due today → Inst2 due in 1 month → Inst3 due in 2 months

**Impact:** Finance team and customers see incorrect payment schedules.
</objective>

<execution_context>
@~/.config/Claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@app/api/invoices/create/route.ts
@app/dashboard/invoices/new/InvoiceForm.tsx
</context>

<tasks>

<task type="auto">
  <name>Fix installment due date calculation in backend and frontend</name>
  <files>
app/api/invoices/create/route.ts
app/dashboard/invoices/new/InvoiceForm.tsx
  </files>
  <action>
**Backend Fix (app/api/invoices/create/route.ts):**

Review lines 120-145 carefully. The issue is in the due date calculation for installment invoices.

Current logic (lines 133-138):
- Line 120-125: First invoice when entry exists (i=1) combines entry + first installment, due today
- Line 126-138: Subsequent invoices are installments with monthly offsets

The problem: When calculating monthsToAdd for subsequent installments, we need to account for whether the first installment was already included in the entry invoice.

Analyze the actual values being produced:
- WITH ENTRY at i=2 (first separate installment): monthsToAdd should be 1
- WITH ENTRY at i=3 (second separate installment): monthsToAdd should be 2
- WITHOUT ENTRY at i=1 (first installment): monthsToAdd should be 0
- WITHOUT ENTRY at i=2 (second installment): monthsToAdd should be 1

Fix line 137 to ensure correct offset calculation. The formula should account for the loop index and whether an entry invoice was created.

Add defensive date handling to prevent Date object mutation issues:
```typescript
// Create fresh date object for each invoice
const baseDueDate = new Date(data.dueDate || new Date());
const monthsToAdd = [CORRECT FORMULA];
invoiceDueDate = new Date(baseDueDate);
invoiceDueDate.setMonth(baseDueDate.getMonth() + monthsToAdd);
```

**Frontend Fix (app/dashboard/invoices/new/InvoiceForm.tsx):**

Review lines 170-189 to ensure the preview calculation matches the backend logic exactly.

The frontend loop (line 176) starts at i=0 for installments. Ensure the date calculation on line 178 produces the same due dates as the backend will create.

Match the formula to backend logic for consistency.

**Important:** Test both WITH ENTRY and WITHOUT ENTRY scenarios to ensure the calculations are correct.
  </action>
  <verify>
```bash
# Start dev server
npm run dev

# Test 1: WITH ENTRY
# Navigate to /dashboard/invoices/new
# Create invoice with:
# - Entry: $500
# - Total: $1100
# - Installments: 3
# - Due date: 2026-01-28

# Check preview shows:
# - Entry + Inst 1: due 2026-01-28
# - Inst 2: due 2026-02-28 (1 month later)
# - Inst 3: due 2026-03-28 (2 months later)

# Submit and verify created invoices in database have same dates

# Test 2: WITHOUT ENTRY
# Create invoice with:
# - Entry: $0
# - Total: $900
# - Installments: 3
# - Due date: 2026-01-28

# Check preview shows:
# - Inst 1: due 2026-01-28
# - Inst 2: due 2026-02-28
# - Inst 3: due 2026-03-28

# Submit and verify created invoices match preview
```
  </verify>
  <done>
✅ Backend API correctly calculates installment due dates with proper monthly offsets for both entry and no-entry scenarios
✅ Frontend preview matches backend calculation logic exactly
✅ Test invoices confirm due dates progress correctly month by month
✅ No Date object mutation issues across loop iterations
  </done>
</task>

</tasks>

<verification>
**Manual Testing Checklist:**
1. ✅ Create invoice WITH entry - verify due dates progress monthly starting from entry date
2. ✅ Create invoice WITHOUT entry - verify due dates progress monthly starting from due date
3. ✅ Preview schedule matches actual created invoices
4. ✅ First separate installment after entry is 1 month later, not same date
5. ✅ QuickBooks sync doesn't fail due to date issues
</verification>

<success_criteria>
- Installment invoices have correct due dates with proper monthly progression
- Entry scenario: First separate installment is due 1 month after entry date
- Non-entry scenario: First installment is due on selected due date
- Preview schedule in form matches backend-created invoices
- No date calculation bugs across different month boundaries
</success_criteria>

<output>
After completion, create `.planning/quick/014-fix-installment-invoice-due-date-calcula/014-SUMMARY.md`
</output>
