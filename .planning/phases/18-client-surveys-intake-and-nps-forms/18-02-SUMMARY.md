---
phase: 18-client-surveys-intake-and-nps-forms
plan: "02"
subsystem: ops-backend
tags: [forms, nps, enrollment, mentorship, ops]
dependency_graph:
  requires: [18-01]
  provides: [form-assignment-api, nps-extraction, enrollment-profile-forms]
  affects: [app/api/ops/enrollments, app/api/ops/forms, lib/services/mentorship.service]
tech_stack:
  added: []
  patterns:
    - Duplicate-safe form assignment via findFirst guard before create
    - Shared NPS extraction helper filters and safely casts Prisma JSON
    - Ops-native route follows ADMIN|OPERATIONAL RBAC pattern
key_files:
  created:
    - lib/ops/nps.ts
    - app/api/ops/forms/assign/route.ts
  modified:
    - lib/services/mentorship.service.ts
    - app/api/ops/enrollments/[id]/route.ts
decisions:
  - "Ops assign route scoped to single customerId (not bulk) — simpler contract, UI assigns one form at a time"
  - "NPS score -1 sentinel filtered out at extraction layer — submissions with non-numeric scores silently dropped"
metrics:
  duration: 3 minutes
  completed_date: "2026-04-03"
  tasks_completed: 3
  files_changed: 4
---

# Phase 18 Plan 02: Ops Backend — Form Assignment and NPS Wiring Summary

**One-liner:** Enrollment transaction auto-assigns the correct intake form (duplicate-safe), ops gets its own RBAC assign route, and the student profile API returns formAssignments + availableFormTemplates + extractedNpsResults in one response.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Auto-assign intake form during enrollment | 3d60d48 | lib/services/mentorship.service.ts |
| 2 | NPS extraction helper + ops assign route | c3e3ecd | lib/ops/nps.ts, app/api/ops/forms/assign/route.ts |
| 3 | Extend enrollment profile API with forms/NPS | 0d7560a | app/api/ops/enrollments/[id]/route.ts |

## What Was Built

### Task 1 — Auto-assign intake on enrollment (mentorship.service.ts)

Inside the existing `prisma.$transaction`, after writing the enrollment and initial `PhaseTransition`:
- Resolves template: `programType === "PASS" ? "onboarding-pass" : "onboarding-career"`
- Guards re-enrollment duplicates via `tx.formAssignment.findFirst({ where: { customerId, templateId, status: { not: "COMPLETED" } } })`
- Creates `formAssignment` only when no active intake exists

### Task 2 — NPS extraction helper + ops assign route

**`lib/ops/nps.ts`** — `extractNpsFromSubmissions()`:
- Filters to NPS_TEMPLATE_IDS only
- Casts Prisma JSON as `Record<string, unknown>` safely
- Returns score/comment/submittedAt; filters out non-numeric scores (sentinel -1 dropped)

**`app/api/ops/forms/assign/route.ts`** — POST endpoint:
- `getServerSession` auth guard
- ADMIN | OPERATIONAL role check
- Zod validation for `customerId` and `templateId`
- `FORM_TEMPLATES[templateId]` check rejects unknown templates
- `findFirst` duplicate guard returns 409 if pending assignment already exists
- Creates single `formAssignment` and returns with 201

### Task 3 — Extended enrollment profile API (enrollments/[id]/route.ts)

Adds parallel `formAssignment.findMany` fetch (with submission include) alongside existing `placementTest` and `totalSessions` queries. Computes:
- `availableFormTemplates`: onboarding template (by programType) + NPS_TEMPLATE_IDS, mapped to `{ id, title, titlePt }`
- `npsResults`: from `extractNpsFromSubmissions()` on assignments that have a submission

Returns enriched payload with all existing fields preserved.

## Decisions Made

- **Ops assign route is single-customer** — `templateId + customerId` per call; the dashboard's bulk pattern is not needed for ops profile UX
- **NPS score sentinel (-1) filtered at extraction layer** — submissions with missing/non-numeric scores are silently dropped rather than crashing

## Deviations from Plan

None — all three files were already partially authored (from 18-01 preparation) and needed only the specific additions described in the plan. The acceptance criteria all pass exactly as specified.

## Verification

- `npx tsc --noEmit` exits 0 with no errors
- All 15 acceptance criteria checked via grep — each condition confirmed present

## Self-Check: PASSED

Files created/modified exist:
- lib/services/mentorship.service.ts — FOUND (modified)
- lib/ops/nps.ts — FOUND (created)
- app/api/ops/forms/assign/route.ts — FOUND (created)
- app/api/ops/enrollments/[id]/route.ts — FOUND (modified)

Commits:
- 3d60d48 — FOUND
- c3e3ecd — FOUND
- 0d7560a — FOUND
