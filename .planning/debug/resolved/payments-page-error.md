---
status: resolved
trigger: "The dashboard /payments page shows an error message on screen. It has never worked."
created: 2026-02-06T00:00:00Z
updated: 2026-02-06T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - onClick handlers in server component
test: removed all onClick handlers, build succeeds
expecting: page renders without error
next_action: archive

## Symptoms

expected: The /payments page should load and display payment data
actual: Shows an error message on screen (caught by error.tsx boundary)
errors: Event handlers cannot be passed to Client Component props (server component runtime error)
reproduction: Navigate to /payments in the dashboard
started: Never worked

## Eliminated

## Evidence

- checked: app/dashboard/payments/page.tsx
  found: No "use client" directive. File is a server component.
  implication: Cannot use onClick handlers in server components.

- checked: Lines 702, 714-716, 723, 734 of payments/page.tsx
  found: onClick handlers on <tr>, <button>, and <Link> elements
  implication: These cause runtime errors in Next.js server components

- checked: app/dashboard/error.tsx
  found: Error boundary catches the runtime error and shows "Something went wrong"
  implication: This is the error message users see

- checked: app/dashboard/invoices/page.tsx (similar page)
  found: Uses <Link> without onClick for navigation - no event handlers
  implication: Confirms the pattern - other pages avoid onClick in server components

## Resolution

root_cause: The payments page (app/dashboard/payments/page.tsx) is a server component (no "use client" directive) but contained onClick event handlers on <tr> (row click navigation), <button> (clipboard copy), and <Link> (stopPropagation) elements. Server components in Next.js cannot have event handlers, causing a runtime error caught by the dashboard error boundary.
fix: 1) Removed onClick from <tr>, replaced row navigation with <Link> wrappers on date and reference cells. 2) Extracted clipboard copy button into a new client component (components/ui/copy-button.tsx) with "use client" directive. 3) Removed unnecessary onClick={(e) => e.stopPropagation()} from <Link> elements.
verification: Build succeeds with no errors.
files_changed:
  - app/dashboard/payments/page.tsx
  - components/ui/copy-button.tsx (new)
