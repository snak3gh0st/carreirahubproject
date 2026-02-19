---
phase: quick-46
plan: 01
subsystem: invoices-ui
tags: [overdue, invoices, ui, grouped-list, finance]
dependency_graph:
  requires: [quick-44]
  provides: [overdue-customer-group-indicators]
  affects: [components/invoices/invoice-grouped-list.tsx]
tech_stack:
  added: []
  patterns: [computed-group-metadata, conditional-tailwind-classes]
key_files:
  created: []
  modified:
    - components/invoices/invoice-grouped-list.tsx
decisions:
  - Use useMemo loop to compute hasOverdue + earliestOverdueDate per group (no extra API call needed)
  - Use bg-red-50/border-red-200 for subtle red header — visually distinct but not alarming
  - Badge format 'Vencido dd/MM/yy' matches existing Brazilian date conventions in the project
metrics:
  duration: 5 minutes
  completed: 2026-02-19
  tasks_completed: 1
  files_modified: 1
---

# Quick Task 46: Mark Overdue Installments in Red with "Vencido" Badge - Summary

One-liner: Customer group headers in the invoices accordion now show a subtle red background and a compact "Vencido dd/MM/yy" badge when any invoice in the group is past due and unpaid.

## What Was Built

The Finance team previously had to expand each customer group in the invoices accordion to check for overdue installments. Now, overdue status is surfaced at the group header level so Finance can scan the full list at a glance without expanding anything.

### Changes Made

**`components/invoices/invoice-grouped-list.tsx`**

1. Extended `CustomerGroup` interface with two new fields:
   - `hasOverdue: boolean` — true if at least one invoice in the group is overdue
   - `earliestOverdueDate: Date | null` — the earliest due date among overdue invoices in the group

2. In the `useMemo` grouping loop, after incrementing `invoiceCount`, compute overdue state per invoice:
   - Overdue = status is not PAID or VOID AND dueDate is before now
   - Track the earliest overdue date across invoices in the group

3. Group header `<tr>` className now conditionally applies red or gray styling:
   - Overdue: `bg-red-50 border-red-200 hover:bg-red-100`
   - Normal: `bg-gray-100 border-gray-300 hover:bg-gray-200`

4. Added "Vencido dd/MM/yy" badge inline with customer name/email row using `format()` from `date-fns` (already imported). Badge uses `bg-red-100 text-red-700 border-red-200`.

5. Individual invoice row overdue highlighting (`bg-red-50` on `<tr>`) left entirely untouched.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `npm run build` completed successfully with zero TypeScript errors
- Build output: "Compiled successfully", 72/72 static pages generated
- Logic correctly skips PAID and VOID invoices when computing overdue state
- `earliestOverdueDate` uses `Date | null` type matching the interface spec

## Self-Check: PASSED

- [x] `components/invoices/invoice-grouped-list.tsx` modified and verified
- [x] Commit `114f845` exists: `feat(quick-46): mark overdue customer groups with red header and Vencido badge`
- [x] Build passes with no TypeScript errors
