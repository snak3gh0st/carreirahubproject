---
phase: 17-daily-action-view-coordinator-overview
plan: "02"
subsystem: ops-hub
tags: [coordinator, admin, react-query, polling, phase-distribution, debtors]
dependency_graph:
  requires: ["17-01"]
  provides: ["/ops/coordinator page", "/api/ops/coordinator endpoint"]
  affects: ["app/ops/coordinator/", "app/api/ops/coordinator/"]
tech_stack:
  added: []
  patterns: ["React Query polling (refetchInterval 60s)", "ADMIN-only server redirect", "Promise.all parallel Prisma queries"]
key_files:
  created:
    - app/api/ops/coordinator/route.ts
    - app/ops/coordinator/page.tsx
    - app/ops/coordinator/CoordinatorClient.tsx
    - app/ops/coordinator/PhaseDistribution.tsx
  modified:
    - .planning/STATE.md
decisions:
  - "Coordinator page puts all polling sections in a single CoordinatorQueryProvider — one query, three sections rendered client-side"
  - "qbBalance Decimal from Prisma converted via Number() before comparison and serialization"
metrics:
  duration: 12
  completed_date: "2026-04-01"
  tasks_completed: 2
  files_changed: 4
---

# Phase 17 Plan 02: Coordinator Overview Summary

**One-liner:** ADMIN-only coordinator page with React Query 60s polling showing phase distribution, no-session students, and QB debtors via a single `/api/ops/coordinator` endpoint.

## What Was Built

### Task 1: Coordinator API (`app/api/ops/coordinator/route.ts`)

- `GET /api/ops/coordinator` — ADMIN-only (returns 403 for any non-ADMIN role)
- Runs two Prisma queries in `Promise.all`: phase counts (ACTIVE enrollments) + all ACTIVE enrollments with full includes
- Processes enrollments in a single loop to produce three lists:
  - `flaggedStudents` — SLA expiring or no recent session (same logic as `/api/ops/daily` but without assignee filter)
  - `noSessionStudents` — students with no session in past 7 days (`daysSinceSession >= NO_SESSION_THRESHOLD_DAYS`)
  - `debtors` — students where `qbBalance > 0`
- Response: `{ phaseDistribution, flaggedStudents, flaggedCount, noSessionStudents, debtors }`

### Task 2: Coordinator Page (3 files)

**`CoordinatorClient.tsx`** — `"use client"` QueryClientProvider wrapper using React Query's `useState` pattern.

**`PhaseDistribution.tsx`** — `"use client"` component that:
- Fetches `/api/ops/coordinator` with `refetchInterval: 60_000` and `staleTime: 30_000`
- Loading state: `animate-pulse` skeleton blocks
- Section A: phase distribution table (phases with count > 0)
- Section B: no-session students with amber "Sem sessão" badge and days since session
- Section C: QB debtors with red "Débito" badge and formatted balance
- All student rows link to `/ops/students/{enrollmentId}`

**`page.tsx`** — Server component with ADMIN role check: `if (role !== "ADMIN") redirect("/ops")`. Renders heading + `CoordinatorQueryProvider > PhaseDistribution`.

## Requirements Addressed

- COORD-01: Coordinator page is ADMIN-only with server-side redirect
- COORD-02: Flagged students shown without assignee filter (all team members)
- COORD-03: No-session list shows students with no session in past 7 days
- COORD-04: QB debtors list shows students with `qbBalance > 0`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prisma Decimal type incompatible with number comparison**
- **Found during:** Task 1 tsc verification
- **Issue:** `qbBalance` from Prisma is `Decimal | null`, cannot be directly compared with `> 0` or typed as `number`
- **Fix:** Wrapped in `Number(enrollment.customer.qbBalance ?? 0)` before comparison and push
- **Files modified:** `app/api/ops/coordinator/route.ts`
- **Commit:** f633376

### Architecture Decision

The plan offered two options for the page structure (server-rendered flagged list + client PhaseDistribution, OR everything in one client component). Chose the simpler approach: all three sections live inside `PhaseDistribution.tsx` polled by React Query — a single fetch call renders all coordinator data with 60s auto-refresh.

## Known Stubs

None — all data flows from live Prisma queries.

## Self-Check: PASSED

- `app/api/ops/coordinator/route.ts` — exists, exports GET
- `app/ops/coordinator/page.tsx` — exists, contains `role !== "ADMIN"` and `redirect("/ops")`
- `app/ops/coordinator/CoordinatorClient.tsx` — exists, contains `QueryClientProvider`
- `app/ops/coordinator/PhaseDistribution.tsx` — exists, contains `refetchInterval: 60_000`
- Commits: f633376 (Task 1), b627bbf (Task 2) — both verified in git log
