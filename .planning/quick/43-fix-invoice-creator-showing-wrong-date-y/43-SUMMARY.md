---
phase: 43-fix-invoice-creator-showing-wrong-date-y
plan: "01"
subsystem: invoice-creator
tags: [bug-fix, timezone, date-parsing, invoice-form]
dependency_graph:
  requires: []
  provides: [correct-date-display-in-invoice-preview]
  affects: [app/dashboard/invoices/new/InvoiceForm.tsx]
tech_stack:
  added: []
  patterns: [parseLocalDate-for-YYYY-MM-DD-strings]
key_files:
  created: []
  modified:
    - app/dashboard/invoices/new/InvoiceForm.tsx
decisions:
  - Replace new Date(dateString) with parseLocalDate() for all YYYY-MM-DD display rendering
  - Compare ISO date strings directly for today-check instead of toDateString() to avoid timezone mismatch
metrics:
  duration: 5 minutes
  completed: 2026-02-19
---

# Quick Task 43: Fix Invoice Creator Showing Wrong Date Summary

**One-liner:** Replaced 4 occurrences of `new Date(dateString)` with `parseLocalDate()` and a direct ISO string comparison to fix UTC-to-local timezone off-by-one-day rendering in the invoice preview.

## What Was Done

Fixed date display bug in the invoice creator preview panel where dates appeared one day behind the selected date. Root cause: ISO date strings like `"2026-02-19"` parsed with `new Date()` are treated as UTC midnight, which shifts to the previous calendar day in UTC-3 (Brazil/Eastern). `parseLocalDate()` already existed in `lib/utils/date.ts` and parses dates as noon UTC, safe for all timezone offsets.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace new Date() with parseLocalDate() for display and fix today comparison | bc4ba4f | app/dashboard/invoices/new/InvoiceForm.tsx |

## Changes Made

**app/dashboard/invoices/new/InvoiceForm.tsx** — 4 targeted replacements:

1. **Line 938** — Single payment due date display:
   - Before: `new Date(installmentSchedule[0].dueDate).toLocaleDateString('pt-BR')`
   - After: `parseLocalDate(installmentSchedule[0].dueDate).toLocaleDateString('pt-BR')`

2. **Line 947** — Today check (immediate email vs 5-day pre-send warning):
   - Before: `new Date(installmentSchedule[0].dueDate).toDateString() === new Date().toDateString()`
   - After: `installmentSchedule[0].dueDate === new Date().toISOString().split('T')[0]`

3. **Line 961** — First installment date display:
   - Before: `new Date(firstInstallmentDate).toLocaleDateString('pt-BR')`
   - After: `parseLocalDate(firstInstallmentDate).toLocaleDateString('pt-BR')`

4. **Line 992** — Installment schedule row date display:
   - Before: `new Date(installment.dueDate).toLocaleDateString('pt-BR')`
   - After: `parseLocalDate(installment.dueDate).toLocaleDateString('pt-BR')`

## Verification

- TypeScript type check (`npx tsc --noEmit`) passed with no errors
- Grep confirms no remaining bare `new Date(installmentSchedule`, `new Date(firstInstallmentDate`, or `new Date(installment.dueDate` patterns in the file
- `parseLocalDate` import was already present (line 6): `import { addMonths, parseLocalDate } from "@/lib/utils/date"`

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] `app/dashboard/invoices/new/InvoiceForm.tsx` — modified and committed
- [x] Commit bc4ba4f exists in git log
- [x] All 4 occurrences replaced, verified by grep
- [x] TypeScript passes with no errors
