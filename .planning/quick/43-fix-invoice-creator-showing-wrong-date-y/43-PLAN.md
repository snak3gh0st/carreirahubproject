---
phase: 43-fix-invoice-creator-showing-wrong-date-y
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/dashboard/invoices/new/InvoiceForm.tsx
autonomous: true
requirements:
  - FIX-43

must_haves:
  truths:
    - "Invoice preview shows today's date (19/02) not yesterday's (18/02)"
    - "Single payment due date displays correctly in Brazilian format"
    - "Installment schedule dates all display correctly"
    - "Today check (immediate email vs 5-day warning) evaluates correctly"
  artifacts:
    - path: "app/dashboard/invoices/new/InvoiceForm.tsx"
      provides: "Fixed date rendering using parseLocalDate instead of new Date"
  key_links:
    - from: "app/dashboard/invoices/new/InvoiceForm.tsx"
      to: "lib/utils/date.ts"
      via: "parseLocalDate import (already present)"
      pattern: "parseLocalDate"
---

<objective>
Fix 4 occurrences of `new Date(dateString)` in InvoiceForm.tsx that cause dates to display one day behind due to UTC-to-local timezone conversion.

Purpose: ISO date strings parsed with `new Date("YYYY-MM-DD")` are treated as UTC midnight, which converts to the previous calendar day in UTC-3 (Brazil). `parseLocalDate()` already exists and parses as UTC noon, safe for all timezones.

Output: InvoiceForm.tsx with corrected date parsing — preview shows correct dates matching what the user selected.
</objective>

<execution_context>
@/Users/pauloloureiro/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pauloloureiro/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/pauloloureiro/Dev/SigmaProjects/carreirahubproject/app/dashboard/invoices/new/InvoiceForm.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace new Date() with parseLocalDate() for display and fix today comparison</name>
  <files>app/dashboard/invoices/new/InvoiceForm.tsx</files>
  <action>
    Make 4 targeted replacements in InvoiceForm.tsx. The import for `parseLocalDate` is already present on the file.

    **Line 938** — single payment due date display:
    Before: `new Date(installmentSchedule[0].dueDate).toLocaleDateString('pt-BR')`
    After:  `parseLocalDate(installmentSchedule[0].dueDate).toLocaleDateString('pt-BR')`

    **Line 947** — today check (determines immediate vs 5-day email):
    Before: `new Date(installmentSchedule[0].dueDate).toDateString() === new Date().toDateString()`
    After:  `installmentSchedule[0].dueDate === new Date().toISOString().split('T')[0]`
    Rationale: dueDate strings are stored as YYYY-MM-DD UTC. Compare directly against UTC today string to avoid any timezone shift.

    **Line 961** — first installment date display:
    Before: `new Date(firstInstallmentDate).toLocaleDateString('pt-BR')`
    After:  `parseLocalDate(firstInstallmentDate).toLocaleDateString('pt-BR')`

    **Line 992** — installment schedule row date display:
    Before: `new Date(installment.dueDate).toLocaleDateString('pt-BR')`
    After:  `parseLocalDate(installment.dueDate).toLocaleDateString('pt-BR')`

    Do not change any other lines. Do not add new imports (parseLocalDate is already imported).
  </action>
  <verify>
    Run `npm run build` or `npx tsc --noEmit` — must produce no TypeScript errors related to InvoiceForm.tsx.
    Grep confirms no remaining bare `new Date(installmentSchedule` or `new Date(firstInstallmentDate` or `new Date(installment.dueDate` patterns in the file.
  </verify>
  <done>
    All 4 occurrences replaced. Invoice preview renders dates matching the selected calendar date regardless of local timezone offset.
  </done>
</task>

</tasks>

<verification>
Open invoice creator in browser (http://localhost:3000/dashboard/invoices/new), configure a single payment or installment plan with today's date (2026-02-19), and confirm the preview shows 19/02/2026 — not 18/02/2026.
</verification>

<success_criteria>
Invoice date preview displays the correct calendar date selected by the user, with no off-by-one day regression in any timezone offset from UTC.
</success_criteria>

<output>
After completion, create `.planning/quick/43-fix-invoice-creator-showing-wrong-date-y/43-01-SUMMARY.md`
</output>
