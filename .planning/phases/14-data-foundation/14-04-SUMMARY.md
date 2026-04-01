---
phase: 14-data-foundation
plan: "04"
subsystem: ops-hub-ui
tags: [ops-hub, enrollment, sidebar, middleware, form, typeahead]
dependency_graph:
  requires: [14-03]
  provides: [enrollment-form-ui, ops-hub-nav]
  affects: [middleware.ts, professional-sidebar.tsx]
tech_stack:
  added: [sonner (toast)]
  patterns: [server-shell + client-component split, debounced typeahead, form reset on success]
key_files:
  created:
    - app/dashboard/ops/enroll/page.tsx
    - app/dashboard/ops/enroll/EnrollForm.tsx
  modified:
    - middleware.ts
    - components/dashboard/professional-sidebar.tsx
decisions:
  - "Toast library: sonner (v2.0.7) — already in package.json, used toast.success/toast.error"
  - "Assignable users: manual text input fallback — /api/dashboard/users endpoint does not exist"
  - "page.tsx is Server Component shell with no use client directive — EnrollForm.tsx holds all interactivity"
metrics:
  duration: 8 min
  completed_date: "2026-04-01"
  tasks_completed: 3
  files_changed: 4
---

# Phase 14 Plan 04: Enrollment Form UI Summary

Ops Hub UI scaffolding — middleware guard, sidebar nav entry, and enrollment form page for back-to-back student enrollment.

## What Was Built

### Sidebar Changes
- Added `GraduationCap` icon import to `professional-sidebar.tsx`
- Added "Ops Hub" nav entry pointing to `/dashboard/ops/enroll` with `roles: ["ADMIN", "OPERATIONAL"]`
- The existing `visibleNavItems.filter()` logic ensures only ADMIN/OPERATIONAL users see the entry

### Page Component Structure
- `app/dashboard/ops/enroll/page.tsx` — Server Component shell (no `"use client"`), renders `<EnrollForm />`
- `app/dashboard/ops/enroll/EnrollForm.tsx` — Client Component (`"use client"` at top) with all interactive logic

### EnrollForm Behaviour
- Customer typeahead: debounced 300ms, fires at 2+ chars, calls `GET /api/ops/customers/search?q=`
- Dropdown shows: `{name} — {email} — CEFR: {cefrLevel ?? "Pending"}`
- Selecting a customer hides the dropdown and displays selected name/email with clear button
- Program type `<select>`: PASS / ADVANCED
- Assigned team member: text input fallback (see below)
- Start date `<input type="date">` defaults to today
- Submit calls `POST /api/ops/enrollments` — resets form + `toast.success()` on 201, `toast.error()` on 409/other errors
- Submit button disabled when any required field is empty or while submitting

### Toast Library Used
`sonner` v2.0.7 — already present in `package.json`. Used `toast.success()` and `toast.error()`.

### Assignable Users Approach
`/api/dashboard/users` endpoint does not exist. Used manual `<input type="text" placeholder="User ID">` fallback with a helper note in the UI. When the users endpoint is created in a future plan, this can be upgraded to a `<select>` populated via `GET /api/dashboard/users?roles=ADMIN,OPERATIONAL`.

### Middleware Entry
Added `{ prefix: "/dashboard/ops", roles: ["ADMIN", "OPERATIONAL"] }` to `routeRoleMap` in `middleware.ts` — defense in depth so direct URL navigation is blocked at the middleware layer before reaching the API.

## Human Verification Result

Pending — checkpoint returned to orchestrator.

## Known Stubs

- **Assignable users field** (`app/dashboard/ops/enroll/EnrollForm.tsx`, line ~115): Manual text input for User ID. Intentional fallback pending `/api/dashboard/users` endpoint. Future plan should replace with a populated select dropdown.

## Deviations from Plan

### Auto-applied

**1. [Rule 3 - Blocking] Dashboard users API not found — used manual input fallback**
- Found during: Task 2
- Issue: `/api/dashboard/users` route does not exist; plan called for checking and using it or falling back
- Fix: Used `<input type="text">` for user ID with a TODO note in the UI; toast library check was done and sonner was confirmed present
- Files modified: `app/dashboard/ops/enroll/EnrollForm.tsx`

## Self-Check: PASSED

- middleware.ts contains `/dashboard/ops` entry: FOUND (line 30)
- `GraduationCap` and `Ops Hub` in sidebar: FOUND
- `page.tsx` has no `"use client"`: CONFIRMED (0 occurrences)
- `EnrollForm.tsx` has `"use client"` at top: CONFIRMED
- Both API calls present in EnrollForm: `/api/ops/customers/search` (line 43), `/api/ops/enrollments` (line 84)
- Commits: 048a1f0, 09e2922, 1e79951
