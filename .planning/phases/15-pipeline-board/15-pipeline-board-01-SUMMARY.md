---
phase: 15-pipeline-board
plan: "01"
subsystem: ops-api
tags: [api, ops, pipeline, mentorship, rbac]
dependency_graph:
  requires: [14-data-foundation]
  provides: [GET /api/ops/pipeline, POST /api/ops/enrollments/[id]/advance]
  affects: [15-02-pipeline-board-ui]
tech_stack:
  added: []
  patterns: [NextAuth session RBAC, Prisma nested include, MentorshipError typed error codes]
key_files:
  created:
    - app/api/ops/pipeline/route.ts
    - app/api/ops/enrollments/[id]/advance/route.ts
    - app/ops/pipeline/PipelineBoard.tsx
  modified: []
decisions:
  - "GET /api/ops/pipeline returns all phases unconditionally — client-side ?assignee=me filter only"
  - "MentorshipError INVALID_TRANSITION maps to HTTP 422; all other MentorshipError codes map to 400"
  - "PipelineBoard stub created to unblock build — Plan 02 replaces with full implementation"
metrics:
  duration: 8
  completed_date: "2026-04-01"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 15 Plan 01: Pipeline Board API Routes Summary

Two backend API routes that power the Kanban pipeline board — GET /api/ops/pipeline returning all 11 phases with nested active enrollments, and POST /api/ops/enrollments/[id]/advance wrapping mentorshipService.advancePhase atomically.

## Routes Created

### GET /api/ops/pipeline
**File:** `app/api/ops/pipeline/route.ts`

Returns all 11 `MentorshipPhase` rows ordered by `sortOrder`, each with an `enrollments` array of active students.

**Prisma query shape per enrollment:**
- `customer`: `{ id, name, qbBalance }` — qbBalance is `Decimal?` serialized as string; consumers use `Number(qbBalance) > 0` for debtor flag
- `assignedTo`: `{ id, name }` — the User assigned to the enrollment
- `transitions`: `{ createdAt }` — latest 1 row ordered by `createdAt desc` — used for SLA age calculation

**Auth pattern:** NextAuth `getServerSession(authOptions)` → 401 if no session, 403 if role is not ADMIN or OPERATIONAL. Matches existing `/api/ops/enrollments/route.ts` pattern exactly.

### POST /api/ops/enrollments/[id]/advance
**File:** `app/api/ops/enrollments/[id]/advance/route.ts`

Thin wrapper around `mentorshipService.advancePhase()`. No business logic in the route handler.

**Request body:** `{ toPhaseId: string }` — returns 400 if missing.

**Error mapping:**
- `MentorshipError(INVALID_TRANSITION)` → HTTP 422
- All other `MentorshipError` codes → HTTP 400
- Unexpected errors → HTTP 500 (logged to console)

**Auth pattern:** Same NextAuth pattern — 401/403. `userId` and `role` extracted and forwarded to service.

## Auth Pattern Used

```typescript
const session = await getServerSession(authOptions);
if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const role = (session.user as any).role as string;
if (role !== "ADMIN" && role !== "OPERATIONAL") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
const userId = (session.user as any).id as string;
```

Matches `/api/ops/enrollments/route.ts` exactly — consistent RBAC across Ops Hub.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| No server-side assignee filter on GET /api/ops/pipeline | Single endpoint serves all filter states; ?assignee=me is client-side only |
| INVALID_TRANSITION → HTTP 422 | Semantic distinction: 422 = unprocessable (business rule), 400 = bad request (malformed input) |
| Other MentorshipError codes → HTTP 400 | Catch-all for future error codes without requiring route changes |
| PipelineBoard stub created | page.tsx referenced PipelineBoard before Plan 02; stub keeps build green |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added PipelineBoard stub to unblock build**
- **Found during:** Overall verification (npm run build)
- **Issue:** `app/ops/pipeline/page.tsx` imported `./PipelineBoard` which did not exist — pre-existing scaffold from Phase 15 setup
- **Fix:** Created `app/ops/pipeline/PipelineBoard.tsx` as a stub component with TODO comment pointing to Plan 02
- **Files modified:** `app/ops/pipeline/PipelineBoard.tsx`
- **Commit:** 5aee49d

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| `app/ops/pipeline/PipelineBoard.tsx` | Returns static placeholder text | Plan 02 (15-02) will implement the full Kanban board using these API routes |

## Self-Check: PASSED
