---
phase: 44-invoices-area-cascading-effect-grouping
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/invoices/invoice-grouped-list.tsx
  - app/dashboard/invoices/page.tsx
autonomous: true
requirements: [QUICK-44]
must_haves:
  truths:
    - "Invoices list groups rows by customer name with a collapsible header row per customer"
    - "Each customer group shows customer name, invoice count, and total amount in the header"
    - "Clicking the expand/collapse arrow toggles visibility of that customer's invoices"
    - "Groups are collapsed by default; the first group is expanded by default"
    - "Individual invoice rows inside a group retain all existing columns and actions (Ver, Editar, Excluir)"
    - "Pagination and filters continue to work — they control which invoices are on the current page; grouping applies to the current page's results"
  artifacts:
    - path: "components/invoices/invoice-grouped-list.tsx"
      provides: "Client component that receives the invoice list and renders grouped accordion rows"
      exports: ["InvoiceGroupedList"]
    - path: "app/dashboard/invoices/page.tsx"
      provides: "Server page that replaces the inline tbody rows with InvoiceGroupedList"
  key_links:
    - from: "app/dashboard/invoices/page.tsx"
      to: "components/invoices/invoice-grouped-list.tsx"
      via: "passes invoices array, userRole, userId props"
      pattern: "InvoiceGroupedList"
---

<objective>
Replace the flat invoice table body with an accordion/cascading grouped view where each customer is a collapsible section. Clicking the expand arrow reveals that customer's invoices as sub-rows.

Purpose: Finance team deals with installment-heavy customers. Grouping by customer makes it immediately clear how many invoices each customer has and their combined value, without scanning the whole table.
Output: A new InvoiceGroupedList client component + updated invoices page that uses it.
</objective>

<execution_context>
@/Users/pauloloureiro/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pauloloureiro/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@app/dashboard/invoices/page.tsx
@components/invoices/delete-invoice-button.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create InvoiceGroupedList client component</name>
  <files>components/invoices/invoice-grouped-list.tsx</files>
  <action>
Create a "use client" component `InvoiceGroupedList` that:

**Props interface:**
```typescript
interface Invoice {
  id: string;
  invoiceNumber: string | null;
  amount: number | Decimal;
  status: InvoiceStatus;
  dueDate: Date | string;
  ownerId: string | null;
  quickbooks_invoice_id: string | null;
  customer: { id: string; name: string; email: string };
  deal: { id: string; title: string } | null;
}

interface InvoiceGroupedListProps {
  invoices: Invoice[];
  userRole: string;
  userId: string;
  buildSortUrl: never; // sorting is handled by page; not passed
}
```

**Grouping logic:**
- Use `useMemo` to group invoices by `customer.id`
- Each group: `{ customerId, customerName, customerEmail, invoices[], totalAmount, invoiceCount }`
- Sort groups by `customerName` ascending
- Track expanded state: `useState<Set<string>>` initialized with the first customer's id (first group expanded by default)

**Toggle behavior:**
- `toggleGroup(customerId)`: add to set if absent, remove if present

**Rendered structure (keep the existing `<table>` shell — this component renders `<tbody>` content only):**

For each customer group render two types of rows:

1. **Group header row** (`<tr className="bg-gray-100 border-t-2 border-gray-300">`):
   - First `<td colSpan={6}` with `px-4 py-3`:
     - Left side: chevron button (ChevronRight / ChevronDown from lucide-react, rotated via `transition-transform`) + customer name in bold + customer email in gray text
     - Right side (flex justify-between): `{invoiceCount} fatura{invoiceCount !== 1 ? 's' : ''}` + total amount `$X,XXX.XX`
   - Clicking anywhere on the row (or the chevron button) calls `toggleGroup`
   - Chevron rotates 90deg when expanded (`rotate-90` Tailwind class toggled)

2. **Invoice rows** (only when group is expanded, same `<tr>` structure as current page):
   - `<tr key={invoice.id} className="hover:bg-gray-50 transition-colors">` — identical columns as current page
   - First `<td>` (invoice number) should have `pl-10` for visual indentation to show hierarchy
   - Replicate the full row from current `invoices.map(...)` in page.tsx including:
     - Invoice number as Link to `/dashboard/invoices/${invoice.id}` in gold
     - Customer name + email (can be subtle since it's inside the customer group — reduce to just invoice number column spanning less prominently, but still show customer sub-row for consistency)
     - Amount in tabular-nums
     - Badge with status variant (import `Badge` from `@/components/ui/badge`, `InvoiceStatus` from `@prisma/client`)
     - Due date formatted with `format` from `date-fns`
     - Actions: Ver link, conditional Editar link, DeleteInvoiceButton
   - Overdue detection: same logic as page (`invoice.status !== InvoiceStatus.PAID && invoice.status !== InvoiceStatus.VOID && new Date(invoice.dueDate) < new Date()`)

**Status variant helper** — copy getStatusVariant logic inline:
```typescript
function getStatusVariant(status: InvoiceStatus): "success" | "warning" | "error" | "info" | "default" { ... }
```

**Empty state:** If invoices.length === 0, render a single `<tr><td colSpan={6}...>` with the EmptyState component (import from `@/components/ui/empty-state`, FileText icon).

Import `DeleteInvoiceButton` from `@/components/invoices/delete-invoice-button`.
Import `Link` from `next/link`.
Import `Badge` from `@/components/ui/badge`.
Import `EmptyState` from `@/components/ui/empty-state`.
Import `ChevronRight`, `FileText` from `lucide-react`.
Import `format` from `date-fns`.
Import `InvoiceStatus` from `@prisma/client`.
Import `useMemo`, `useState` from `react`.
  </action>
  <verify>Run `npm run build` and check for TypeScript errors in the new component. No build errors expected.</verify>
  <done>Component file exists at components/invoices/invoice-grouped-list.tsx, compiles without errors, exports InvoiceGroupedList.</done>
</task>

<task type="auto">
  <name>Task 2: Update invoices page to use InvoiceGroupedList</name>
  <files>app/dashboard/invoices/page.tsx</files>
  <action>
Modify `app/dashboard/invoices/page.tsx` to use the new `InvoiceGroupedList` component:

1. **Add import** at the top:
   ```typescript
   import { InvoiceGroupedList } from "@/components/invoices/invoice-grouped-list";
   ```

2. **Remove** from the page's imports: `Link` usage inside the table body is now inside the client component. Keep `Link` for the header "Criar Fatura" button and filter chips — it's still used at page level.

3. **In the JSX**, find the `<tbody>` block (lines ~497-578) that contains the `invoices.map(...)` and the EmptyState fallback. Replace the entire `<tbody>` element with:
   ```tsx
   <InvoiceGroupedList
     invoices={invoices}
     userRole={userRole}
     userId={userId}
   />
   ```
   Note: `InvoiceGroupedList` renders its own `<tbody>` internally, so remove the `<tbody>` wrapper from the page too.

4. **Remove** the `SortIndicator` component, `buildSortUrl` helper, and `getStatusVariant` function from the page ONLY IF they are no longer used by the page itself. Check: `buildSortUrl` and `SortIndicator` are used in the `<thead>` columns — keep them. `getStatusVariant` is used only inside the old tbody map — remove it from the page (it's now inside the client component).

5. **Keep all other page content unchanged**: header, KPI stat cards, filter bar, `<thead>` with sort links, Pagination component below the table.

6. Ensure the `<table>` structure remains intact:
   ```tsx
   <table className="min-w-full divide-y divide-gray-200">
     <thead className="bg-gray-50">
       {/* existing thead unchanged */}
     </thead>
     <InvoiceGroupedList invoices={invoices} userRole={userRole} userId={userId} />
   </table>
   ```
  </action>
  <verify>
1. Run `npm run build` — must complete with 0 errors.
2. Run `npm run dev` and visit `http://localhost:3000/dashboard/invoices`.
3. Confirm: customers appear as collapsible group headers; first group is expanded; clicking a header collapses/expands it; invoice rows show inside; Ver/Editar/Excluir links work.
  </verify>
  <done>
- Build passes with no TypeScript errors
- Invoices page renders customer group headers with expand/collapse arrows
- First customer group is expanded by default, others collapsed
- Invoice rows are indented inside each group with all original columns intact
- Pagination and filters still function (they control which invoices are fetched server-side; grouping applies to the rendered page)
  </done>
</task>

</tasks>

<verification>
After both tasks complete:
- `npm run build` passes with 0 errors
- At `/dashboard/invoices`: grouped customer headers visible with chevron icons
- Click chevron: group expands showing that customer's invoices as sub-rows
- Click again: group collapses
- First group is open on page load
- Each group header shows: customer name, email, invoice count, total amount
- Individual invoice rows retain: invoice number link, amount, status badge, due date, Ver / Editar / Excluir actions
- Filters (status, search, date range) still filter which invoices appear (server-side, unchanged)
- Pagination still works for navigating pages of results
</verification>

<success_criteria>
The flat invoice table is replaced by an accordion view grouped by customer. Each customer section collapses and expands on click. Build passes. No regressions in filtering, pagination, or invoice actions.
</success_criteria>

<output>
After completion, create `.planning/quick/44-invoices-area-cascading-effect-grouping-/44-SUMMARY.md` using the summary template.
</output>
