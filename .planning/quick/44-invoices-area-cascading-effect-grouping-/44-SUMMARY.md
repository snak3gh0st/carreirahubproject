---
phase: 44-invoices-area-cascading-effect-grouping
plan: 01
subsystem: ui
tags: [react, next.js, tailwind, lucide-react, accordion, table]

requires: []
provides:
  - InvoiceGroupedList client component with accordion/expand-collapse by customer
  - Invoices page now groups rows by customer instead of flat list
affects: [invoices-page, invoice-list]

tech-stack:
  added: []
  patterns:
    - "Client component wrapping tbody: server page passes data; client renders grouped rows with local useState"
    - "useMemo for grouping + sorting: groups computed once per invoices prop change"
    - "Set<string> for expanded state: O(1) toggle, supports multiple groups open simultaneously"

key-files:
  created:
    - components/invoices/invoice-grouped-list.tsx
  modified:
    - app/dashboard/invoices/page.tsx

key-decisions:
  - "InvoiceGroupedList renders its own <tbody> so the page's <table> shell stays intact with thead and pagination outside"
  - "First group expanded by default via useState initializer, not effect"
  - "Removed getStatusVariant from page — now lives only inside the client component"
  - "Unused imports cleaned up from page: format, Badge, EmptyState, DeleteInvoiceButton, MobileFilterModal, FileText"

patterns-established:
  - "tbody-as-component: client component owns tbody only; server page keeps table structure, thead, and pagination"

requirements-completed: [QUICK-44]

duration: 12min
completed: 2026-02-19
---

# Quick Task 44: Invoices Area Cascading Effect Grouping Summary

**Accordion invoice table grouped by customer — collapsible header rows with invoice count and total, built as InvoiceGroupedList client component replacing the flat tbody**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-19T00:00:00Z
- **Completed:** 2026-02-19T00:12:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `InvoiceGroupedList` client component that groups invoices by customer using `useMemo`, tracks expansion via `useState<Set<string>>`, and renders collapsible accordion rows with ChevronRight icons
- Group header row shows customer name, email, invoice count, and total amount; clicking anywhere toggles the group
- First customer group is expanded by default; invoice sub-rows are indented (pl-10) and retain all original columns (invoice number link, amount, status badge, due date, Ver/Editar/Excluir actions)
- Replaced the 80-line `invoices.map()` tbody block in `page.tsx` with a single `<InvoiceGroupedList>` usage; removed `getStatusVariant` function and cleaned up now-unused imports
- Build passed with 0 TypeScript errors; all pre-existing ESLint warnings are unrelated to this task

## Task Commits

1. **Task 1: Create InvoiceGroupedList client component** - `26b8178` (feat)
2. **Task 2: Update invoices page to use InvoiceGroupedList** - `2b8fa9d` (feat)

**Plan metadata:** (included in this summary commit)

## Files Created/Modified

- `components/invoices/invoice-grouped-list.tsx` - New client component: groups invoices by customer, collapsible accordion rows, first group expanded by default
- `app/dashboard/invoices/page.tsx` - Replaced inline tbody map with `<InvoiceGroupedList>`; removed `getStatusVariant` and cleaned up unused imports

## Decisions Made

- InvoiceGroupedList renders its own `<tbody>` element so the page's `<table>` shell with `<thead>` and `<Pagination>` below remain untouched
- Sorting the groups alphabetically by `customerName` for consistent order each render
- Customer sub-rows still show customer name/email in muted style (gray-500/400) for consistency — they are within the group but still provide context for screenshot/export use cases
- Imported `Decimal` type from `@prisma/client/runtime/library` to correctly type the `amount` field

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Invoices grouped view is live; ready for production
- If desired, a follow-up could add a "expand all / collapse all" button to the table header

---
*Phase: 44-invoices-area-cascading-effect-grouping*
*Completed: 2026-02-19*
