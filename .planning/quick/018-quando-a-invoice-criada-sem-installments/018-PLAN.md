---
phase: quick
plan: 018
type: execute
wave: 1
depends_on: []
files_modified:
  - app/api/invoices/create/route.ts
  - app/dashboard/invoices/new/InvoiceForm.tsx
autonomous: true

must_haves:
  truths:
    - "Single payment invoices (no entry, no installments) are created correctly"
    - "Single payment invoice email is sent based on due date timing (immediate if today, scheduled if future)"
    - "UI shows preview for single payment case"
  artifacts:
    - path: "app/api/invoices/create/route.ts"
      provides: "Invoice creation with single payment handling"
      contains: "isSinglePayment"
    - path: "app/dashboard/invoices/new/InvoiceForm.tsx"
      provides: "UI preview for single payment case"
      contains: "Pagamento a vista"
  key_links:
    - from: "app/api/invoices/create/route.ts"
      to: "quickbooksService.sendInvoice"
      via: "Email timing logic for single payments"
      pattern: "isSinglePayment.*shouldSendEmail"
---

<objective>
Fix single payment invoice creation and email scheduling

Purpose: When an invoice is created without installments and without an entry payment (down payment), it should be treated as a single full payment ("a vista"). Currently the email timing doesn't properly consider the due date for single payments - it sends immediately regardless. This should match the installment behavior: send immediately if due today, schedule for 5 days before if due in the future.

Output: Updated invoice creation route with proper single payment handling and UI preview
</objective>

<execution_context>
@/Users/pauloloureiro/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pauloloureiro/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@app/api/invoices/create/route.ts
@app/dashboard/invoices/new/InvoiceForm.tsx
@app/api/cron/send-scheduled-invoices/route.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix single payment email timing in invoice creation API</name>
  <files>app/api/invoices/create/route.ts</files>
  <action>
Update the invoice creation route to handle single payment ("a vista") invoices correctly:

1. After line 76 where `installmentCount` is defined, add a `isSinglePayment` flag:
```typescript
const isSinglePayment = entryAmount === 0 && installmentCount === 0;
```

2. Update the email timing logic around lines 329-340. Replace the current logic with:
```typescript
// Determine if this invoice should be emailed immediately
// LOGIC:
// - Entry invoice: Send immediately (customer needs to pay TODAY)
// - Single payment (a vista) due TODAY: Send immediately
// - Single payment (a vista) due FUTURE: Schedule (DRAFT status, cron sends 5 days before)
// - ALL installments (including first): DRAFT (send 5 days before due date)
const isInstallmentSeries = invoiceCountToCreate > 1;
const isEntryInvoice = entryAmount > 0 && i === 1;
const isSingleInvoice = invoiceCountToCreate === 1 && !isInstallmentSeries;

// Check if due date is today or in the past (needs immediate send)
const today = new Date();
today.setHours(0, 0, 0, 0);
const dueDay = new Date(invoiceDueDate);
dueDay.setHours(0, 0, 0, 0);
const isDueTodayOrPast = dueDay <= today;

// Single payment with future due date should be scheduled, not sent immediately
const shouldSendEmail = isEntryInvoice || (isSingleInvoice && isDueTodayOrPast);
```

3. Update the logging around line 342-350 to reflect the new logic:
```typescript
console.log(`[INVOICE_CREATE] Email decision for invoice ${i}/${invoiceCountToCreate}:`, {
  isInstallmentSeries,
  isSingleInvoice,
  isSinglePayment,
  isEntryInvoice,
  isDueTodayOrPast,
  shouldSendEmail,
  dueDate: invoiceDueDate.toISOString().split('T')[0],
  description: invoiceDescription,
});
```

4. Add specific logging for single payment scheduled invoices in the `else if (!shouldSendEmail)` block around line 426-444:
```typescript
} else if (customer.email && !shouldSendEmail) {
  // Single payment with future due date OR installment - schedule for later
  const sendDate = new Date(invoiceDueDate.getTime() - 5 * 24 * 60 * 60 * 1000);
  const invoiceType = isSinglePayment ? 'single payment (a vista)' : 'installment';
  console.log(`[INVOICE_CREATE] Scheduled ${invoiceType} invoice ${i}/${invoiceCountToCreate} for ${sendDate.toISOString().split('T')[0]} (5 days before due: ${invoiceDueDate.toISOString().split('T')[0]})`);

  await prisma.integrationLog.create({
    data: {
      service: "quickbooks",
      action: isSinglePayment ? "single_payment_invoice_scheduled" : "installment_invoice_scheduled",
      status: "SUCCESS",
      payload: {
        qbInvoiceId: qbInvoice.Id,
        recipientEmail: customer.email,
        dueDate: invoiceDueDate.toISOString(),
        isSinglePayment,
        installmentNumber: isSinglePayment ? null : i,
        totalInstallments: invoiceCountToCreate,
        scheduledSendDate: sendDate.toISOString(),
      } as any,
    },
  });
```

This ensures single payment invoices with future due dates are handled like installments - created as DRAFT in QB and emailed 5 days before the due date via the cron job.
  </action>
  <verify>
Run TypeScript check: `npx tsc --noEmit app/api/invoices/create/route.ts`
Test with curl or Postman creating an invoice with:
- No entry (entryAmount: 0 or undefined)
- No installments (installments: 0 or undefined)
- Future due date (e.g., 30 days from now)
Check logs show "single payment (a vista)" and "scheduled" status
  </verify>
  <done>Single payment invoices with future due dates are scheduled (not sent immediately), matching the installment behavior</done>
</task>

<task type="auto">
  <name>Task 2: Add UI preview for single payment invoices</name>
  <files>app/dashboard/invoices/new/InvoiceForm.tsx</files>
  <action>
Update the InvoiceForm to show a preview for single payment ("a vista") invoices:

1. Update `generateInstallmentSchedule()` function to also return a single entry for "a vista" payments when no entry and no installments are provided:

Find the function around line 165-204 and update it:
```typescript
const generateInstallmentSchedule = () => {
  const total = calculateTotal();
  const entryAmount = getNumericValue(form.entryAmount);
  const installments = getNumericValue(form.installments);
  const remaining = Math.max(0, total - entryAmount);

  const schedule = [];
  const baseDate = form.dueDate ? new Date(form.dueDate) : new Date();

  // CASE 1: Single payment (a vista) - no entry, no installments
  if (entryAmount === 0 && installments === 0 && total > 0) {
    schedule.push({
      number: 1,
      amount: total,
      dueDate: baseDate.toISOString().split('T')[0],
      description: 'Pagamento a vista (completo)',
      isEntry: false,
      isSinglePayment: true,
    });
    return schedule;
  }

  // CASE 2: Entry only (no installments)
  if (entryAmount > 0 && installments === 0) {
    schedule.push({
      number: 0,
      amount: entryAmount,
      dueDate: baseDate.toISOString().split('T')[0],
      description: 'Entrada (a vista)',
      isEntry: true,
      isSinglePayment: false,
    });
    return schedule;
  }

  // CASE 3: Entry + installments
  if (entryAmount > 0) {
    schedule.push({
      number: 0,
      amount: entryAmount,
      dueDate: baseDate.toISOString().split('T')[0],
      description: 'Entrada (a vista)',
      isEntry: true,
      isSinglePayment: false,
    });
  }

  // CASE 4: Installments (with or without entry)
  if (installments > 0 && remaining > 0) {
    const installmentAmount = remaining / installments;

    for (let i = 0; i < installments; i++) {
      const installmentDate = addMonths(baseDate, i + 1);

      schedule.push({
        number: i + 1,
        amount: Number(installmentAmount.toFixed(2)),
        dueDate: installmentDate.toISOString().split('T')[0],
        description: `Parcela ${i + 1} de ${installments}`,
        isEntry: false,
        isSinglePayment: false,
      });
    }
  }

  return schedule;
};
```

2. Update the schedule display condition around line 647 to also show for single payments:
```tsx
{/* Section 6: Payment Schedule (installments, entry, or single payment) */}
{(installmentSchedule.length > 0 || (total > 0 && installmentsValue === 0 && entryValue === 0)) && (
```

3. Update the schedule card title and styling to handle single payment case around lines 648-706:
```tsx
{installmentSchedule.length > 0 && (
  <div className={`rounded-lg shadow-md p-6 border-l-4 ${
    installmentSchedule[0]?.isSinglePayment
      ? 'bg-green-50 border-green-500'
      : 'bg-blue-50 border-blue-500'
  }`}>
    <h2 className={`text-xl font-semibold mb-4 ${
      installmentSchedule[0]?.isSinglePayment ? 'text-green-900' : 'text-blue-900'
    }`}>
      {installmentSchedule[0]?.isSinglePayment
        ? 'Pagamento a Vista'
        : 'Cronograma de Parcelas'}
    </h2>

    {/* For single payment, show a simpler view */}
    {installmentSchedule[0]?.isSinglePayment ? (
      <div className="bg-white rounded-lg p-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="font-semibold text-gray-900">Fatura unica</p>
            <p className="text-sm text-gray-600">
              Vencimento: {new Date(installmentSchedule[0].dueDate).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <span className="font-mono text-2xl font-bold text-green-600">
            ${installmentSchedule[0].amount.toFixed(2)}
          </span>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            {new Date(installmentSchedule[0].dueDate).toDateString() === new Date().toDateString()
              ? 'A fatura sera enviada por email imediatamente apos a criacao.'
              : 'A fatura sera enviada por email 5 dias antes do vencimento.'}
          </p>
        </div>
      </div>
    ) : (
      // Existing installment schedule code (lines 651-705)
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 text-sm text-blue-900">
          {/* ... existing grid content ... */}
        </div>
        <div className="space-y-2">
          {/* ... existing installment list ... */}
        </div>
        <div className="mt-4 pt-3 border-t-2 border-blue-300 bg-white rounded-lg p-3">
          {/* ... existing total ... */}
        </div>
      </>
    )}
  </div>
)}
```

This provides clear visual feedback to users about single payment invoices and when the email will be sent.
  </action>
  <verify>
Run dev server: `npm run dev`
Navigate to /dashboard/invoices/new
Create invoice with:
- Select customer
- Select service item with price
- Leave entry amount empty (or 0)
- Leave installments empty (or 0)
- Set due date to a future date
Verify: Green "Pagamento a Vista" card appears showing:
- "Fatura unica"
- Total amount
- Due date
- Message about email timing
  </verify>
  <done>UI shows clear preview for single payment invoices with email timing information</done>
</task>

</tasks>

<verification>
1. TypeScript compilation: `npx tsc --noEmit`
2. Test single payment (a vista) invoice creation:
   - Due today: Should send email immediately
   - Due in future: Should be scheduled (DRAFT status, cron handles email)
3. Test with entry + installments: Should work as before
4. Test installments only: Should work as before
5. UI preview shows correct information for all payment types
</verification>

<success_criteria>
- Single payment invoices are created correctly in QB and local database
- Email timing matches the configured due date (immediate if today/past, scheduled if future)
- UI provides clear preview of what will happen for single payments
- Existing entry/installment logic continues to work correctly
- Integration logs correctly categorize single payment invoices
</success_criteria>

<output>
After completion, create `.planning/quick/018-quando-a-invoice-criada-sem-installments/018-SUMMARY.md`
</output>
