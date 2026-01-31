---
type: quick
number: 034
title: Fix invoice date timezone bug and first installment calculation logic
created: 2026-01-30
status: ready
---

# Quick Task 034: Fix Invoice Date Timezone Bug and First Installment Calculation

## Problem Summary

**Bug 1: Timezone Conversion (Date Off By 1 Day)**
- User selects Jan 30 → System shows Jan 31
- Root cause: `new Date('2026-01-30')` interprets as UTC midnight, displays in local timezone
- Affects: Frontend preview AND backend invoice creation

**Bug 2: First Installment Wrong Month (When No Entrada)**
- No entrada + 10 parcelas → First installment is NEXT month instead of chosen date
- Root cause: Loop always adds `i + 1` months, even when `i=0`
- Expected: First installment = chosen date when no entrada

**Bug 3: UX Clarity (Total Payment Count)**
- Users don't understand entrada is ADDITIONAL payment
- Need visual indicator: Total payments = entrada (if > 0) + parcelas

## Safety Context

**CRITICAL: System is in PRODUCTION**
- Invoice creation is LIVE and working (except for date bugs)
- QuickBooks integration active
- Contract automation active
- Changes must be surgical and atomic
- Each commit must be independently revertible

## Tasks

### Task 1: Create Date Utility Function
**Files:** `lib/utils/date.ts`

**Action:**
1. Create new utility file `lib/utils/date.ts`
2. Add `parseLocalDate()` function:
   ```typescript
   /**
    * Parse YYYY-MM-DD string in LOCAL timezone (not UTC)
    * Fixes timezone bug where '2026-01-30' becomes Jan 29 in UTC-3
    */
   export function parseLocalDate(dateString: string): Date {
     const [year, month, day] = dateString.split('-').map(Number);
     return new Date(year, month - 1, day);
   }
   ```
3. Add JSDoc explaining the timezone issue
4. Export function

**Verify:**
```bash
# Test the utility in Node REPL
node -e "
const { parseLocalDate } = require('./lib/utils/date.ts');
const d = parseLocalDate('2026-01-30');
console.log('Date object:', d);
console.log('BR format:', d.toLocaleDateString('pt-BR'));
console.log('ISO (for QB):', d.toISOString().split('T')[0]);
"
```

**Expected:**
- BR format shows "30/01/2026" (not 29 or 31)
- ISO format shows "2026-01-30"

**Done:** Date utility exists and correctly parses dates in local timezone

**Safety:** New file, no existing code affected

---

### Task 2: Fix Frontend Date Handling and Installment Logic
**Files:** `app/dashboard/invoices/new/InvoiceForm.tsx`

**Action:**
1. Import new utility: `import { parseLocalDate } from '@/lib/utils/date'`

2. Fix timezone bug (line ~200):
   ```typescript
   // OLD: const baseDate = form.dueDate ? new Date(form.dueDate) : new Date();
   const baseDate = form.dueDate ? parseLocalDate(form.dueDate) : new Date();
   ```

3. Fix first installment logic (line ~245):
   ```typescript
   // OLD: const installmentDate = addMonths(baseDate, i + 1);
   const monthsToAdd = entryAmount > 0 ? i + 1 : i;
   const installmentDate = addMonths(baseDate, monthsToAdd);
   ```

4. Add UX clarity - insert after installment input (line ~140):
   ```tsx
   {installments > 0 && (
     <p className="text-sm text-gray-600 mt-1">
       Total de pagamentos: {entryAmount > 0 ? '1 entrada + ' : ''}{installments} parcela{installments > 1 ? 's' : ''} = {entryAmount > 0 ? installments + 1 : installments} pagamento{(entryAmount > 0 ? installments + 1 : installments) > 1 ? 's' : ''}
     </p>
   )}
   ```

**Verify:**
```bash
npm run dev
# Open http://localhost:3000/dashboard/invoices/new
# Test Case 1: Select Jan 30, no entrada, 3 parcelas
#   Expected preview: Jan 30, Feb 28, Mar 30
# Test Case 2: Select Jan 30, entrada $1000, 3 parcelas
#   Expected preview: Entrada Jan 30, Parcelas Feb 28, Mar 30, Apr 30
# Test Case 3: Select Jan 31, 2 parcelas
#   Expected preview: Jan 31, Feb 28 (month-end clamping)
```

**Done:** 
- Dates display correctly (no +1/-1 day shift)
- First installment uses chosen date when no entrada
- UX shows total payment count clearly

**Safety:** 
- Only changes date parsing logic
- Preserves existing form validation
- Doesn't change API contract

---

### Task 3: Fix Backend Date Handling
**Files:** `app/api/invoices/create/route.ts`

**Action:**
1. Import utility: `import { parseLocalDate } from '@/lib/utils/date'`

2. Fix all timezone bugs (lines 132, 141, 151, 158):
   ```typescript
   // Line 132 (main invoice due date)
   // OLD: invoiceDueDate = data.dueDate ? new Date(data.dueDate) : new Date();
   invoiceDueDate = data.dueDate ? parseLocalDate(data.dueDate) : new Date();

   // Line 141 (entry payment)
   // OLD: const entryDueDate = data.dueDate ? new Date(data.dueDate) : new Date();
   const entryDueDate = data.dueDate ? parseLocalDate(data.dueDate) : new Date();

   // Line 151 (installment with entry)
   // OLD: const installmentDate = addMonths(new Date(data.dueDate!), i + 1);
   const monthsToAdd = entryAmount > 0 ? i + 1 : i;
   const installmentDate = addMonths(parseLocalDate(data.dueDate!), monthsToAdd);

   // Line 158 (installment without entry)
   // OLD: const installmentDate = addMonths(new Date(data.dueDate!), i);
   const installmentDate = addMonths(parseLocalDate(data.dueDate!), i);
   ```

3. **Important:** Preserve ISO format for QuickBooks API:
   ```typescript
   // Ensure toISOString().split('T')[0] is still used for QB API calls
   // (No change needed - utility returns Date object, ISO conversion works)
   ```

**Verify:**
```bash
# Create test invoice via UI
npm run dev
# 1. Create invoice: Jan 30, no entrada, 3 parcelas
# 2. Check QuickBooks invoice dates match expectations
# 3. Check Hub database dates (Prisma Studio)

npx prisma studio
# Verify Invoice.dueDate and Payment.dueDate values are correct
```

**Expected:**
- QuickBooks invoices have correct dates (no +1/-1 shift)
- Hub database stores correct dates
- Email scheduling uses correct dates

**Done:**
- Backend creates invoices with correct dates
- First installment calculation matches frontend
- QuickBooks sync shows correct dates

**Safety:**
- Preserves ISO format for QB API (YYYY-MM-DD)
- Doesn't change request/response format
- Existing invoices unaffected (only affects new creates)

---

## Verification Plan

### End-to-End Test Cases

**Test 1: No Entrada, 3 Installments**
1. Select customer
2. Amount: $3000
3. Due date: Jan 30, 2026
4. Entrada: $0
5. Installments: 3

Expected:
- Preview shows: Jan 30, Feb 28, Mar 30 (not Jan 31, Mar 30, Apr 30)
- Total payments: "3 parcelas = 3 pagamentos"
- QuickBooks invoices have same dates
- Hub database matches

**Test 2: With Entrada, 3 Installments**
1. Amount: $4000
2. Due date: Jan 30, 2026
3. Entrada: $1000
4. Installments: 3

Expected:
- Preview shows: Entrada Jan 30, Parcelas Feb 28, Mar 30, Apr 30
- Total payments: "1 entrada + 3 parcelas = 4 pagamentos"
- QuickBooks shows 4 invoices with correct dates

**Test 3: Month-End Edge Case**
1. Amount: $2000
2. Due date: Jan 31, 2026
3. Entrada: $0
4. Installments: 2

Expected:
- Preview shows: Jan 31, Feb 28 (not Mar 3 due to month-end clamping)
- QuickBooks invoices match

---

## Rollback Plan

**If Issues Occur:**

1. **Revert Task 3 (Backend):**
   ```bash
   git revert HEAD
   git push
   ```
   Impact: Frontend still broken but backend reverted to working state

2. **Revert Task 2 (Frontend):**
   ```bash
   git revert HEAD~1
   ```
   Impact: UI back to original behavior

3. **Remove Task 1 (Utility):**
   ```bash
   git revert HEAD~2
   rm lib/utils/date.ts
   ```

**Each task is independently revertible - commits are atomic**

---

## Git Commits

**Task 1:**
```bash
git add lib/utils/date.ts
git commit -m "fix(invoices): add parseLocalDate utility for timezone-safe date parsing

- Create lib/utils/date.ts with parseLocalDate function
- Fixes timezone bug where YYYY-MM-DD string interprets as UTC
- In UTC-3 timezone, prevents date shifting by 1 day
- Returns Date object in local timezone for correct display"
```

**Task 2:**
```bash
git add app/dashboard/invoices/new/InvoiceForm.tsx
git commit -m "fix(invoices): fix date timezone and first installment calculation

- Use parseLocalDate instead of new Date() for dueDate parsing
- Fix first installment to use chosen date when no entrada
- Add UX clarity: show total payment count (entrada + parcelas)
- Fixes Bug 1 (date off by 1 day) and Bug 2 (first installment wrong month)"
```

**Task 3:**
```bash
git add app/api/invoices/create/route.ts
git commit -m "fix(invoices): apply timezone fix to backend invoice creation

- Use parseLocalDate for all dueDate parsing in API route
- Preserves ISO format for QuickBooks API compatibility
- Ensures backend dates match frontend preview dates
- Fixes date mismatches in QuickBooks and email scheduling"
```

---

## Success Criteria

- [ ] `parseLocalDate()` utility exists and handles timezone correctly
- [ ] Frontend preview shows correct dates (no +1/-1 shift)
- [ ] First installment uses chosen date when no entrada
- [ ] UX shows total payment count clearly
- [ ] Backend creates invoices with matching dates
- [ ] QuickBooks invoices show correct dates
- [ ] Email scheduling uses correct dates
- [ ] All 3 test cases pass
- [ ] No breaking changes to existing invoices
- [ ] QuickBooks API contract preserved (ISO format)

---

## Estimated Time

- Task 1: 5 minutes (create utility)
- Task 2: 10 minutes (frontend fixes + UX)
- Task 3: 10 minutes (backend fixes)
- Verification: 10 minutes (3 test cases)

**Total: ~35 minutes**
