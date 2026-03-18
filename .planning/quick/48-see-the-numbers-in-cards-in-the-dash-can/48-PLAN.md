---
phase: quick-48
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/ui/stat-card.tsx
  - components/dashboard/kpi-card.tsx
  - components/dashboard/dashboard-kpi-card.tsx
  - components/analytics/quickbooks-kpi-card.tsx
autonomous: true
requirements: [QUICK-48]
must_haves:
  truths:
    - "Dashboard card numbers never overflow or overlay card boundaries on any screen size"
    - "Large currency values like $125,430.00 remain fully visible within cards"
    - "Cards display correctly on mobile (320px), tablet (768px), and desktop (1280px+)"
  artifacts:
    - path: "components/ui/stat-card.tsx"
      provides: "Responsive value text with overflow protection"
      contains: "text-2xl sm:text-3xl lg:text-4xl"
    - path: "components/dashboard/kpi-card.tsx"
      provides: "Overflow-safe KPI card"
      contains: "min-w-0"
    - path: "components/dashboard/dashboard-kpi-card.tsx"
      provides: "Overflow-safe dashboard KPI card"
      contains: "min-w-0"
    - path: "components/analytics/quickbooks-kpi-card.tsx"
      provides: "Overflow-safe QuickBooks KPI card"
      contains: "min-w-0"
  key_links: []
---

<objective>
Fix dashboard card number overflow — large numeric values (e.g., "$125,430.00") overflow card boundaries on smaller screens.

Purpose: Cards must contain their content within boundaries on all screen sizes, preventing visual breakage.
Output: All 4 card components updated with responsive text sizing and overflow protection.
</objective>

<execution_context>
@/Users/pauloloureiro/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pauloloureiro/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@components/ui/stat-card.tsx
@components/dashboard/kpi-card.tsx
@components/dashboard/dashboard-kpi-card.tsx
@components/analytics/quickbooks-kpi-card.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix StatCard responsive sizing and overflow</name>
  <files>components/ui/stat-card.tsx</files>
  <action>
    In stat-card.tsx, make these changes:

    1. Line 73 — Change value text from fixed `text-4xl` to responsive sizing:
       `text-2xl sm:text-3xl lg:text-4xl`

    2. Add overflow protection to the value paragraph (line 73):
       Add `truncate` class as safety net so text gets ellipsis rather than overflowing.

    3. Add `min-w-0` to the `space-y-2` div (line 72) to prevent flex child overflow.

    4. Add `overflow-hidden` to the outer card div (line 50-55) to ensure nothing escapes.

    Final value line should be:
    ```tsx
    <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 tabular-nums truncate">
    ```

    And the space-y-2 div:
    ```tsx
    <div className="min-w-0 space-y-2">
    ```

    And add `overflow-hidden` to the outer div's className alongside existing classes.
  </action>
  <verify>npm run build 2>&1 | tail -5</verify>
  <done>StatCard value text is responsive (2xl/3xl/4xl) with truncate and overflow-hidden protection. No build errors.</done>
</task>

<task type="auto">
  <name>Task 2: Fix overflow in KpiCard, DashboardKPICard, and QuickBooksKpiCard</name>
  <files>components/dashboard/kpi-card.tsx, components/dashboard/dashboard-kpi-card.tsx, components/analytics/quickbooks-kpi-card.tsx</files>
  <action>
    Fix the remaining 3 card components:

    **kpi-card.tsx:**
    1. Line 55 — The flex container `flex items-baseline gap-2` needs `min-w-0` added:
       `flex items-baseline gap-2 min-w-0`
    2. Line 56 — The value `<p>` needs `truncate` added:
       `<p className={`text-2xl font-bold truncate ${valueColor}`}>`
    3. Line 45 — The outer `<div className="bg-white">` needs `overflow-hidden min-w-0`:
       `<div className="bg-white overflow-hidden min-w-0">`
    4. Same overflow-hidden on the loading state outer div (line 33).

    **dashboard-kpi-card.tsx:**
    This already has `overflow-hidden` on the outer div (line 75) and responsive text `text-2xl sm:text-3xl` (line 97). Add:
    1. Line 96 — The value container div `<div className="mb-2">` needs `min-w-0`:
       `<div className="mb-2 min-w-0">`
    2. Line 97 — Add `truncate` to the value text:
       `<p className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">`
    3. Line 87 — The `flex-1` div needs `min-w-0`:
       `<div className="flex-1 min-w-0">`

    **quickbooks-kpi-card.tsx:**
    1. Line 40 — The `flex-1` div needs `min-w-0`:
       `<div className="flex-1 min-w-0">`
    2. Line 42 — The value `<p>` needs `truncate`:
       `<p className={`text-2xl font-bold truncate ${valueColor}`}>`
    3. Line 38 — The outer div already has `overflow-hidden` via hover:shadow-md. Verify it has proper containment. Add `overflow-hidden` explicitly if not present:
       Add `overflow-hidden` to the outer div class list.
  </action>
  <verify>npm run build 2>&1 | tail -5</verify>
  <done>All 3 remaining card components have min-w-0 on flex children, truncate on value text, and overflow-hidden on containers. No build errors.</done>
</task>

</tasks>

<verification>
- `npm run build` completes without errors
- All 4 card files contain `truncate` on value elements
- All 4 card files contain `min-w-0` on flex containers holding values
- StatCard uses responsive text sizing `text-2xl sm:text-3xl lg:text-4xl`
</verification>

<success_criteria>
All dashboard card components contain numeric values within their boundaries on all screen sizes. No text overflow, no overlapping elements.
</success_criteria>

<output>
After completion, create `.planning/quick/48-see-the-numbers-in-cards-in-the-dash-can/48-SUMMARY.md`
</output>
