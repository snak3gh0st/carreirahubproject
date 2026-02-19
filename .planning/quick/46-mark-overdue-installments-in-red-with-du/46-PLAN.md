---
phase: quick-46
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/invoices/invoice-grouped-list.tsx
autonomous: true
requirements:
  - QUICK-46
must_haves:
  truths:
    - "Customer group header row shows a subtle red background when the group has at least one overdue invoice"
    - "Customer group header row displays a 'Vencido' badge and the earliest overdue date on the same line as the customer name"
    - "Individual invoice rows that are overdue continue to show the existing red row highlight"
    - "Groups with no overdue invoices show no red styling on the header row"
  artifacts:
    - path: "components/invoices/invoice-grouped-list.tsx"
      provides: "Updated grouped list with overdue customer-level indicators"
  key_links:
    - from: "CustomerGroup (useMemo)"
      to: "group header row <tr>"
      via: "hasOverdue + earliestOverdueDate computed in useMemo, rendered in header"
      pattern: "hasOverdue.*earliestOverdueDate"
---

<objective>
Mark overdue installments at the customer group level in the invoices grouped list.

Purpose: Finance team needs to see at a glance which customers have overdue installments without expanding each group. Currently, overdue styling only exists on individual invoice rows (hidden inside collapsed groups).
Output: Customer group header rows show subtle red background + "Vencido" badge with earliest overdue date when any invoice in the group is past due and unpaid.
</objective>

<execution_context>
@/Users/pauloloureiro/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pauloloureiro/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@components/invoices/invoice-grouped-list.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add overdue fields to CustomerGroup and render overdue indicator in group header</name>
  <files>components/invoices/invoice-grouped-list.tsx</files>
  <action>
In `components/invoices/invoice-grouped-list.tsx`, make two changes:

**1. Extend `CustomerGroup` interface** to include overdue metadata:

```typescript
interface CustomerGroup {
  customerId: string;
  customerName: string;
  customerEmail: string;
  invoices: Invoice[];
  totalAmount: number;
  invoiceCount: number;
  hasOverdue: boolean;
  earliestOverdueDate: Date | null;
}
```

**2. Compute overdue metadata in the `useMemo` grouping loop.** After `group.invoiceCount += 1`, add:

```typescript
const invoiceDue = new Date(invoice.dueDate);
const isInvoiceOverdue =
  invoice.status !== InvoiceStatus.PAID &&
  invoice.status !== InvoiceStatus.VOID &&
  invoiceDue < new Date();

if (isInvoiceOverdue) {
  group.hasOverdue = true;
  if (
    group.earliestOverdueDate === null ||
    invoiceDue < group.earliestOverdueDate
  ) {
    group.earliestOverdueDate = invoiceDue;
  }
}
```

Also initialise the new fields when creating the group entry in `map.set(key, { ..., hasOverdue: false, earliestOverdueDate: null })`.

**3. Apply subtle red background to the group header `<tr>` when `hasOverdue` is true.** Change the existing className on the group header row from:

```tsx
className="bg-gray-100 border-t-2 border-gray-300 cursor-pointer hover:bg-gray-200 transition-colors"
```

to:

```tsx
className={`border-t-2 cursor-pointer transition-colors ${
  group.hasOverdue
    ? "bg-red-50 border-red-200 hover:bg-red-100"
    : "bg-gray-100 border-gray-300 hover:bg-gray-200"
}`}
```

**4. Add the overdue badge inline with the customer name.** Inside the group header's customer name/email `<div className="flex items-center gap-2">`, after the `<span>` showing `group.customerEmail`, add:

```tsx
{group.hasOverdue && group.earliestOverdueDate && (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-display font-semibold bg-red-100 text-red-700 border border-red-200">
    Vencido {format(group.earliestOverdueDate, "dd/MM/yy")}
  </span>
)}
```

The `format` function from `date-fns` is already imported. Use `dd/MM/yy` format to keep the badge compact and consistent with Brazilian date convention used elsewhere in the project.

Do NOT change any other logic — the existing `isOverdue` check on individual invoice rows (line ~279) remains untouched.
  </action>
  <verify>Run `npm run build` and confirm no TypeScript errors. Open the invoices dashboard and verify: (a) a customer group with overdue invoices shows a red-tinted header row with the "Vencido dd/MM/yy" badge, (b) a customer group with no overdue invoices shows the normal gray header, (c) expanding an overdue group still shows individual overdue rows in bg-red-50.</verify>
  <done>Customer groups with at least one overdue non-paid invoice display subtle red header row and inline "Vencido dd/MM/yy" badge. Groups without overdue invoices display unchanged gray header. Build passes with zero TypeScript errors.</done>
</task>

</tasks>

<verification>
- `npm run build` completes without errors
- In the browser at /dashboard/invoices, collapsed groups with overdue invoices show red-tinted header rows
- The "Vencido dd/MM/yy" badge appears on the same line as the customer name, showing the earliest overdue date
- Groups with all invoices paid/current show unchanged gray header rows
- Expanding an overdue group reveals individual invoice rows still highlighted in bg-red-50
</verification>

<success_criteria>
Finance team can scan the collapsed invoice list and immediately identify which customers have overdue installments, along with the date of the earliest overdue invoice, without needing to expand each group.
</success_criteria>

<output>
After completion, create `.planning/quick/46-mark-overdue-installments-in-red-with-du/46-SUMMARY.md`
</output>
```
