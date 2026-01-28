---
quick_task: 015
description: Separate entry invoice from installments - entry today, installments start next month
type: execute
files_modified: 
  - app/api/invoices/create/route.ts
  - app/dashboard/invoices/new/InvoiceForm.tsx
autonomous: true
---

# Quick Task 015: Separate Entry Invoice from Installments

<objective>
Fix invoice creation logic to generate SEPARATE invoices for entry and installments, instead of incorrectly combining entry + first installment into a single invoice.

**Current bug:** Entry ($500) + Installment 1 ($200) are combined into one invoice ($700) due today.

**Correct behavior:** Entry ($500) is a separate invoice due today. Installments start NEXT MONTH.

**Example:**
- Total: $1,100
- Entry: $500 (Invoice 1, due 2026-01-28)
- 3 installments @ $200 each:
  - Invoice 2: $200 due 2026-02-28 (+1 month)
  - Invoice 3: $200 due 2026-03-28 (+2 months)
  - Invoice 4: $200 due 2026-04-28 (+3 months)

Result: 4 separate invoices (not 3).
</objective>

<execution_context>
@~/.config/Claude/get-shit-done/workflows/execute-plan.md
@~/.config/Claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@app/api/invoices/create/route.ts
@app/dashboard/invoices/new/InvoiceForm.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix backend invoice count and amount calculation logic</name>
  <files>app/api/invoices/create/route.ts</files>
  <action>
**Lines 83-92 - Invoice count calculation:**

Current logic (WRONG):
```typescript
if (entryAmount > 0 && installmentCount > 0) {
  invoiceCountToCreate = installmentCount; // Creates N invoices (combines entry + first)
}
```

Change to (CORRECT):
```typescript
if (entryAmount > 0 && installmentCount > 0) {
  invoiceCountToCreate = 1 + installmentCount; // Creates 1 entry + N installments
} else if (entryAmount > 0) {
  invoiceCountToCreate = 1; // Entry only
} else if (installmentCount > 0) {
  invoiceCountToCreate = installmentCount; // Installments only
}
```

**Lines 120-144 - Invoice amount and due date logic:**

Rewrite the amount/description/dueDate calculation to handle 3 cases:

**Case 1: Entry invoice (when entry exists and i === 1):**
- Amount: `entryAmount`
- Description: `"${description} - Entry Payment"`
- Due date: `dueDate` (TODAY - no offset)

**Case 2: Installment invoice (when entry exists and i > 1):**
- Amount: `remaining / installmentCount`
- Description: `"${description} - Installment ${i-1} of ${installmentCount}"` (i=2 → "Installment 1")
- Due date: `dueDate + (i-1) months` (i=2 → +1 month, i=3 → +2 months)

**Case 3: Installment invoice (no entry, just installments):**
- Amount: `totalAmount / installmentCount`
- Description: `"${description} - Installment ${i} of ${installmentCount}"`
- Due date: `dueDate + (i-1) months` (i=1 → +0 months, i=2 → +1 month)

**Lines 155-194 - Line items logic:**

Rewrite line items to handle separate invoices:

**Entry invoice (entry exists and i === 1):**
```typescript
lineItems = [{
  description: `${description} - Entry Payment`,
  quantity: 1,
  unitPrice: entryAmount,
  amount: entryAmount,
  serviceItemId: data.items[0].serviceItemId,
}];
```

**Installment invoice (entry exists and i > 1):**
```typescript
const installmentNum = i - 1; // i=2 → Installment 1
lineItems = [{
  description: `${description} - Installment ${installmentNum} of ${installmentCount}`,
  quantity: 1,
  unitPrice: installmentAmount,
  amount: installmentAmount,
  serviceItemId: data.items[0].serviceItemId,
}];
```

**Installment invoice (no entry):**
```typescript
lineItems = [{
  description: `${description} - Installment ${i} of ${installmentCount}`,
  quantity: 1,
  unitPrice: installmentAmount,
  amount: installmentAmount,
  serviceItemId: data.items[0].serviceItemId,
}];
```

**Lines 196-225 - Invoice number generation:**

Update installment type logic:

```typescript
let installmentType: 'single' | 'entry' | 'installment';
let installmentNum: number | undefined;

if (invoiceCountToCreate === 1) {
  installmentType = 'single';
} else if (entryAmount > 0 && i === 1) {
  installmentType = 'entry'; // Entry invoice
} else {
  installmentType = 'installment';
  // If entry exists: i=2 → Installment 1, i=3 → Installment 2
  // If no entry: i=1 → Installment 1, i=2 → Installment 2
  installmentNum = entryAmount > 0 ? i - 1 : i;
}
```

**Lines 312-435 - Email sending logic:**

Update email decision logic:

```typescript
// Entry invoice (i=1 when entry exists): Send immediately
// First installment (i=2 when entry exists, i=1 when no entry): Send immediately OR schedule
// Subsequent installments: Schedule for 5 days before due date

const isInstallmentSeries = invoiceCountToCreate > 1;
const isEntryInvoice = entryAmount > 0 && i === 1;
const isFirstInstallment = entryAmount > 0 ? i === 2 : i === 1;
const shouldSendEmail = isEntryInvoice || isFirstInstallment;
```

**Important:** Maintain backward compatibility with existing installment series that don't have entry amounts.
  </action>
  <verify>
1. Run TypeScript compiler: `npx tsc --noEmit` (no errors)
2. Create test invoice with entry + installments via UI
3. Check database: Verify correct number of invoices created
4. Check invoice amounts and due dates in database
5. Check QuickBooks: Verify invoices created with correct amounts
  </verify>
  <done>
- Invoice count calculation creates 1 + N invoices when entry exists
- Entry invoice has amount = entryAmount, due today
- Installment invoices have amount = remaining/N, due +1, +2, +3 months
- Line items show separate entry and installment descriptions
- Email logic sends entry and first installment immediately
- No TypeScript errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Update frontend preview to show entry as separate line</name>
  <files>app/dashboard/invoices/new/InvoiceForm.tsx</files>
  <action>
**Lines 164-195 - generateInstallmentSchedule function:**

Current logic shows installments only. Add entry as SEPARATE first line item.

Change the function to return TWO types of items:

```typescript
const generateInstallmentSchedule = () => {
  const total = calculateTotal();
  const entryAmount = getNumericValue(form.entryAmount);
  const installments = getNumericValue(form.installments);
  const remaining = Math.max(0, total - entryAmount);

  const schedule = [];
  const baseDate = form.dueDate ? new Date(form.dueDate) : new Date();

  // Add entry as separate first item (if exists)
  if (entryAmount > 0) {
    schedule.push({
      number: 0, // Special marker for entry
      amount: entryAmount,
      dueDate: baseDate.toISOString().split('T')[0],
      description: 'Entrada (à vista)',
      isEntry: true,
    });
  }

  // Add installments starting from NEXT MONTH
  if (installments > 0 && remaining > 0) {
    const installmentAmount = remaining / installments;
    
    for (let i = 0; i < installments; i++) {
      const installmentDate = new Date(baseDate);
      // Installments start NEXT MONTH: i=0 → +1 month, i=1 → +2 months
      installmentDate.setMonth(baseDate.getMonth() + (i + 1));
      
      schedule.push({
        number: i + 1,
        amount: Number(installmentAmount.toFixed(2)),
        dueDate: installmentDate.toISOString().split('T')[0],
        description: `Parcela ${i + 1} de ${installments}`,
        isEntry: false,
      });
    }
  }

  return schedule;
};
```

**Lines 638-674 - Installment schedule display section:**

Update the display to visually distinguish entry from installments:

```typescript
{installmentSchedule.map((installment) => (
  <div 
    key={installment.number} 
    className={`rounded-lg p-3 flex justify-between items-center text-sm ${
      installment.isEntry 
        ? 'bg-green-50 border border-green-300' 
        : 'bg-white'
    }`}
  >
    <span className={`font-medium ${
      installment.isEntry ? 'text-green-900' : 'text-gray-900'
    }`}>
      {installment.description}
    </span>
    <span className={`font-mono font-semibold ${
      installment.isEntry ? 'text-green-600' : 'text-blue-600'
    }`}>
      ${installment.amount.toFixed(2)}
    </span>
    <span className="text-gray-600">
      {new Date(installment.dueDate).toLocaleDateString('pt-BR')}
    </span>
  </div>
))}
```

**Lines 667-673 - Total calculation section:**

Update to show TOTAL of all invoices (entry + installments):

```typescript
<div className="flex justify-between items-center">
  <span className="font-semibold text-blue-900">Total de todas as faturas:</span>
  <span className="font-mono text-lg font-bold text-blue-600">
    ${(entryValue + remaining).toFixed(2)}
  </span>
</div>
<div className="text-xs text-gray-600 mt-1">
  {entryValue > 0 && `Entrada: $${entryValue.toFixed(2)} + `}
  {installmentsValue} parcela(s): ${remaining.toFixed(2)}
</div>
```
  </action>
  <verify>
1. Run dev server: `npm run dev`
2. Navigate to /dashboard/invoices/new
3. Fill form with entry + installments
4. Check preview section shows:
   - Entry line (green background) due TODAY
   - Installment lines (white background) due NEXT MONTHS
   - Correct total calculation
5. Verify visual distinction between entry and installments
  </verify>
  <done>
- Preview schedule shows entry as SEPARATE first line with green styling
- Installments start from NEXT MONTH (not current month)
- Total calculation includes entry + all installments
- Visual distinction between entry (green) and installments (white)
- Date display shows correct offsets
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
Complete separation of entry invoices from installment invoices in both backend creation logic and frontend preview display.
  </what-built>
  <how-to-verify>
**Test Case: Entry + 3 Installments**

1. Navigate to https://carreirausa.sigmaintel.io/dashboard/invoices/new
2. Fill form:
   - Customer: Any customer
   - Service item: Any service (e.g., $1,100)
   - Entry: $500
   - Installments: 3
   - Due date: Today (2026-01-28)
3. Check PREVIEW section (before submitting):
   - ✓ Shows "Entrada (à vista): $500 - 2026-01-28" (green background)
   - ✓ Shows "Parcela 1 de 3: $200 - 2026-02-28" (+1 month)
   - ✓ Shows "Parcela 2 de 3: $200 - 2026-03-28" (+2 months)
   - ✓ Shows "Parcela 3 de 3: $200 - 2026-04-28" (+3 months)
   - ✓ Total: $1,100 (entry + installments)
4. Submit form
5. Check created invoices in dashboard:
   - ✓ 4 invoices created (not 3)
   - ✓ Invoice 1: $500, due 2026-01-28, description contains "Entry"
   - ✓ Invoice 2: $200, due 2026-02-28, description "Installment 1 of 3"
   - ✓ Invoice 3: $200, due 2026-03-28, description "Installment 2 of 3"
   - ✓ Invoice 4: $200, due 2026-04-28, description "Installment 3 of 3"
6. Check QuickBooks:
   - ✓ All 4 invoices synced correctly
   - ✓ Amounts and due dates match database

**Test Case: Installments Only (No Entry)**

1. Create invoice with:
   - Total: $600
   - Entry: $0 (or leave empty)
   - Installments: 3
   - Due date: Today
2. Verify:
   - ✓ 3 invoices created (not 4)
   - ✓ Invoice 1: $200, due TODAY (no offset)
   - ✓ Invoice 2: $200, due +1 month
   - ✓ Invoice 3: $200, due +2 months
3. Check preview shows no green entry line

**Test Case: Entry Only (No Installments)**

1. Create invoice with:
   - Total: $500
   - Entry: $500
   - Installments: 0
2. Verify:
   - ✓ 1 invoice created
   - ✓ Amount: $500, due today
   - ✓ Description: "Entry Payment"
  </how-to-verify>
  <resume-signal>
Type "approved" if all test cases pass, or describe any issues found.
  </resume-signal>
</task>

</tasks>

<verification>
- [ ] TypeScript compilation succeeds with no errors
- [ ] Invoice count calculation creates correct number of invoices (1 + N when entry exists)
- [ ] Entry invoice has correct amount and due date (today)
- [ ] Installment invoices start NEXT MONTH (+1, +2, +3 months from due date)
- [ ] Line items show separate descriptions for entry and installments
- [ ] Frontend preview visually distinguishes entry (green) from installments (white)
- [ ] Email logic sends entry and first installment immediately
- [ ] Backward compatibility maintained for installments without entry
</verification>

<success_criteria>
**Backend (route.ts):**
- Entry + 3 installments creates 4 separate invoices (not 3)
- Entry invoice: amount = entryAmount, due = dueDate (no offset)
- Installment invoices: amount = remaining / N, due = dueDate + 1/2/3 months
- Line items contain single entry per invoice (no more combined entry + installment)
- Invoice numbering distinguishes entry from installments

**Frontend (InvoiceForm.tsx):**
- Preview schedule shows entry as FIRST line with green styling
- Installments show as separate lines starting NEXT MONTH
- Total calculation accurate (entry + sum of installments)
- Visual distinction clear between entry and installments

**QuickBooks Integration:**
- All invoices sync correctly to QB
- Amounts, due dates, and descriptions match local database
- Email sending works for entry and first installment

**User Experience:**
- Finance team can clearly see entry payment separate from installments
- Due date logic matches business expectation (entry today, installments future months)
- No confusion about combined first invoice
</success_criteria>

<output>
After completion, create `.planning/quick/015-separate-entry-invoice-from-installments/015-SUMMARY.md`
</output>
