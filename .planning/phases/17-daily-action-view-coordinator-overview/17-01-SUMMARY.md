---
phase: 17-daily-action-view-coordinator-overview
plan: "01"
subsystem: ops-hub
tags: [daily-action, sla, session-flags, sidebar, api-route]
dependency_graph:
  requires: [phase-14-data-foundation, phase-15-pipeline-board, phase-16-student-profile]
  provides: [daily-action-view, sla-constants, updated-ops-sidebar]
  affects: [app/ops/layout.tsx, components/ops/ops-sidebar.tsx]
tech_stack:
  added: [lib/constants/sla.ts]
  patterns: [server-component-fetch-pattern, role-scoped-prisma-query, flag-computation-in-api]
key_files:
  created:
    - lib/constants/sla.ts
    - app/api/ops/daily/route.ts
    - app/ops/daily/page.tsx
  modified:
    - components/ops/ops-sidebar.tsx
    - app/ops/layout.tsx
decisions:
  - SLA_DAYS_PER_PHASE=7 and SLA_WARNING_DAYS=2 as conservative defaults per phase 14-17 architecture decision
  - Daily page fetches via internal HTTP (cookie-forwarded) matching the established pipeline pattern
  - FlaggedRow interface defined inline in route for self-contained type safety
metrics:
  duration: "~15 minutes"
  completed_date: "2026-04-01"
  tasks_completed: 2
  files_changed: 5
---

# Phase 17 Plan 01: Daily Action View + Sidebar Nav Summary

SLA constants, role-gated sidebar nav entries, GET /api/ops/daily with per-role scoping and pre-computed SLA/session flags, plus /ops/daily server component page with flag badges and empty state.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | SLA constants + sidebar nav + layout wiring | aed4928 | lib/constants/sla.ts, components/ops/ops-sidebar.tsx, app/ops/layout.tsx |
| 2 | Daily action API route + daily page | fd4040c | app/api/ops/daily/route.ts, app/ops/daily/page.tsx |

## What Was Built

**SLA constants** (`lib/constants/sla.ts`): Named exports `SLA_DAYS_PER_PHASE=7`, `SLA_WARNING_DAYS=2`, `NO_SESSION_THRESHOLD_DAYS=7`, and `FlagType` union type.

**Sidebar** (`components/ops/ops-sidebar.tsx`): Added `userRole?: string` prop. `navItems` moved inside component so it reacts to role. "Ações do Dia" (CalendarCheck icon) appears for all roles. "Coordenador" (LayoutList icon) appears only when `userRole === "ADMIN"`.

**Layout** (`app/ops/layout.tsx`): Passes `userRole={userRole}` to `<OpsSidebar>`.

**Daily API** (`app/api/ops/daily/route.ts`): Auth-guarded GET endpoint. OPERATIONAL users get enrollments filtered by `assignedToId`; ADMIN gets all active enrollments. Computes `slaExpiring` (daysRemaining <= 2) and `noRecentSession` (no session in 7+ days). Returns `{ students, count }` sorted SLA-first then by days remaining.

**Daily page** (`app/ops/daily/page.tsx`): Server component. Fetches from own API with cookie forwarding. Renders count banner when flagged students exist, or green "Tudo certo hoje!" empty state. Each student row shows red SLA badge and/or amber "Sem sessão" badge, student name linked to `/ops/students/{enrollmentId}`, phase label, days info, and chevron.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- lib/constants/sla.ts: FOUND
- app/api/ops/daily/route.ts: FOUND
- app/ops/daily/page.tsx: FOUND
- Commit aed4928: FOUND
- Commit fd4040c: FOUND
