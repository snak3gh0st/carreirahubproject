---
phase: quick-017
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/api/invoices/create/route.ts
  - app/dashboard/invoices/new/InvoiceForm.tsx
autonomous: true

must_haves:
  truths:
    - "Installment dates respect calendar months (Jan 31 + 1 month = Feb 28/29)"
    - "Month-end overflow handled gracefully (no Feb 31 → Mar 3)"
    - "Mid-month dates increment correctly (Jan 15 + 1 month = Feb 15)"
  artifacts:
    - path: "app/api/invoices/create/route.ts"
      provides: "Backend installment date calculation with month-end handling"
      min_lines: 150
    - path: "app/dashboard/invoices/new/InvoiceForm.tsx"
      provides: "Frontend preview calculation with month-end handling"
      min_lines: 200
  key_links:
    - from: "InvoiceForm.tsx preview"
      to: "create/route.ts actual calculation"
      via: "must match exactly"
      pattern: "setMonth.*baseDate.*getMonth"
---

<objective>
Fix installment date calculation to properly handle month-end overflow scenarios. While the code already uses `setMonth()` for calendar months (not 30-day increments), JavaScript's native date overflow causes Jan 31 + 1 month to become Mar 2/3 instead of Feb 28/29.

**Purpose:** Ensure installment due dates respect calendar month boundaries and never overflow into unexpected months.

**Output:** Updated date calculation logic in both backend (API route) and frontend (preview) that clamps to last day of target month when overflow would occur.
</objective>

<execution_context>
@~/.config/Claude/get-shit-done/workflows/execute-plan.md
@~/.config/Claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md

# Current implementation (already uses setMonth correctly)
@app/api/invoices/create/route.ts
@app/dashboard/invoices/new/InvoiceForm.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create month-aware date calculation utility</name>
  <files>
lib/utils/date.ts (new file)
app/api/invoices/create/route.ts
app/dashboard/invoices/new/InvoiceForm.tsx
  </files>
  <action>
**Create date utility function (lib/utils/date.ts):**

```typescript
/**
 * Adds months to a date respecting calendar months.
 * Handles month-end overflow by clamping to last day of target month.
 * 
 * Examples:
 * - Jan 31 + 1 month = Feb 28/29 (not Mar 2/3)
 * - Jan 31 + 2 months = Mar 31 (correct)
 * - Jan 15 + 1 month = Feb 15 (correct)
 * 
 * @param date - Base date
 * @param months - Number of months to add
 * @returns New date with months added
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const originalDay = result.getDate();
  
  // Add months (may cause overflow)
  result.setMonth(result.getMonth() + months);
  
  // Check if day changed due to overflow (e.g., Jan 31 → Feb 31 → Mar 3)
  // If so, go back to last day of intended month
  if (result.getDate() !== originalDay) {
    result.setDate(0); // Sets to last day of previous month
  }
  
  return result;
}
```

**Update backend (app/api/invoices/create/route.ts):**

Replace lines 136-139 and 147-150:

```typescript
// OLD (lines 136-139):
const baseDueDate = data.dueDate ? new Date(data.dueDate) : new Date();
const monthsToAdd = i - 1;
invoiceDueDate = new Date(baseDueDate);
invoiceDueDate.setMonth(baseDueDate.getMonth() + monthsToAdd);

// NEW:
import { addMonths } from '@/lib/utils/date';
const baseDueDate = data.dueDate ? new Date(data.dueDate) : new Date();
const monthsToAdd = i - 1;
invoiceDueDate = addMonths(baseDueDate, monthsToAdd);
```

Apply same change to lines 147-150 (second installment calculation block).

**Update frontend (app/dashboard/invoices/new/InvoiceForm.tsx):**

Replace lines 189-191:

```typescript
// OLD:
const installmentDate = new Date(baseDate);
installmentDate.setMonth(baseDate.getMonth() + (i + 1));

// NEW:
import { addMonths } from '@/lib/utils/date';
const installmentDate = addMonths(baseDate, i + 1);
```

**Why this works:**
- `setMonth()` automatically rolls over to next month if day doesn't exist
- When `result.getDate() !== originalDay`, overflow occurred
- `setDate(0)` sets date to last day of **previous** month (which is our target month)
- Example: Jan 31 + 1 month → Feb 31 (invalid) → Mar 3 → detect mismatch → setDate(0) → Feb 28
  </action>
  <verify>
**Test month-end overflow scenarios:**

Create test file `scripts/test-installment-dates.ts`:

```typescript
import { addMonths } from '@/lib/utils/date';

const tests = [
  { base: '2024-01-31', months: 1, expected: '2024-02-29' }, // Leap year
  { base: '2023-01-31', months: 1, expected: '2023-02-28' }, // Non-leap
  { base: '2024-01-31', months: 2, expected: '2024-03-31' }, // Back to 31
  { base: '2024-01-31', months: 3, expected: '2024-04-30' }, // April has 30
  { base: '2024-01-30', months: 1, expected: '2024-02-29' }, // Leap year clamp
  { base: '2024-01-15', months: 1, expected: '2024-02-15' }, // Mid-month (no overflow)
  { base: '2024-05-31', months: 1, expected: '2024-06-30' }, // May → June
];

console.log('Testing installment date calculations...\n');
let passed = 0;
let failed = 0;

tests.forEach(({ base, months, expected }) => {
  const baseDate = new Date(base);
  const result = addMonths(baseDate, months);
  const resultStr = result.toISOString().split('T')[0];
  const match = resultStr === expected;
  
  if (match) {
    passed++;
    console.log(`✓ ${base} + ${months} month(s) = ${resultStr}`);
  } else {
    failed++;
    console.log(`✗ ${base} + ${months} month(s) = ${resultStr} (expected ${expected})`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```

Run: `npx tsx scripts/test-installment-dates.ts`

All tests should pass with ✓ marks.
  </verify>
  <done>
**Acceptance criteria:**
- [x] `lib/utils/date.ts` created with `addMonths()` function
- [x] Backend uses `addMonths()` in both installment calculation blocks
- [x] Frontend uses `addMonths()` in preview calculation
- [x] Test script passes all 7 test cases
- [x] Month-end dates clamp to last day of target month (Jan 31 → Feb 28/29)
- [x] Mid-month dates increment normally (Jan 15 → Feb 15)
- [x] No dates overflow into wrong month (no Mar 2/3 for Feb calculations)
  </done>
</task>

</tasks>

<verification>
**Manual verification in UI:**

1. Navigate to `/dashboard/invoices/new`
2. Select customer, enter amount $1000
3. Select due date: **January 31, 2024**
4. Enable "Split into installments": 3 installments, no entry fee
5. **Verify preview shows:**
   - Installment 1: Feb 29, 2024 (NOT Mar 2/3)
   - Installment 2: Mar 31, 2024
   - Installment 3: Apr 30, 2024

6. Create invoice and verify in QuickBooks that dates match preview

7. Repeat test with due date **January 15, 2024**:
   - Installment 1: Feb 15, 2024
   - Installment 2: Mar 15, 2024
   - Installment 3: Apr 15, 2024

8. Repeat test with due date **May 31, 2024**:
   - Installment 1: Jun 30, 2024 (NOT Jul 1)
   - Installment 2: Jul 31, 2024
   - Installment 3: Aug 31, 2024
</verification>

<success_criteria>
**Code Quality:**
- Date utility function is pure (no side effects)
- Function handles edge cases (leap years, month-end overflow)
- Both backend and frontend use same calculation logic
- Test coverage for all edge cases

**Functional:**
- Month-end dates never overflow into wrong month
- Calendar month boundaries respected (Jan 31 + 1 month = Feb 28/29)
- Mid-month dates work correctly (Jan 15 + 1 month = Feb 15)
- Leap years handled correctly (2024 vs 2023)

**User Experience:**
- Preview in InvoiceForm matches actual invoice due dates
- Installment dates are predictable and intuitive
- No unexpected dates (Mar 2/3 when expecting late Feb)
</success_criteria>

<output>
After completion, create `.planning/quick/017-fix-installment-date-calculation-to-use-/017-SUMMARY.md` with:
- Test results (all 7 cases passing)
- Before/after examples (Jan 31 + 1 month: Mar 3 → Feb 29)
- Files modified (3 files: date.ts, route.ts, InvoiceForm.tsx)
- Verification screenshots or test output
</output>
