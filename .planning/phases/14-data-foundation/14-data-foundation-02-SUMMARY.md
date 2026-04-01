---
phase: 14-data-foundation
plan: "02"
subsystem: mentorship-service
tags: [mentorship, service-layer, transactions, business-rules]
dependency_graph:
  requires:
    - "14-01"  # MentorshipPhase, MentorshipEnrollment, MentorshipSession, PhaseTransition schema
  provides:
    - "mentorship.service.ts singleton (mentorshipService)"
    - "MentorshipError class with typed codes"
  affects:
    - "14-03"  # API routes will consume mentorshipService
    - "14-04"  # Pipeline board reads enrollments created by this service
tech_stack:
  added: []
  patterns:
    - "Stateless singleton service class (class + export const singleton)"
    - "prisma.$transaction interactive variant for atomic multi-model writes"
    - "Typed domain error class (MentorshipError extends Error with code field)"
key_files:
  created:
    - lib/services/mentorship.service.ts
  modified: []
decisions:
  - "MentorshipError extends Error with a typed `code` field — API routes instanceof-check to map to 409/422 vs 500"
  - "logSession re-throws Prisma P2025 as a plain Error with message 'Enrollment not found or not active' — avoids leaking Prisma internals to callers"
  - "advancePhase initialises currentSortOrder to -1 when currentPhase is null, so any forward move to sortOrder 0 (bastao) fails for non-ADMIN — intentional safety rail"
metrics:
  duration: "3 minutes"
  completed_date: "2026-04-01"
  tasks_completed: 1
  files_changed: 1
---

# Phase 14 Plan 02: Mentorship Service Summary

One-liner: Stateless singleton service encapsulating enrollment, session, and phase-transition business rules with atomic Prisma transactions and typed domain errors.

## What Was Built

`lib/services/mentorship.service.ts` — three public methods exported via the `mentorshipService` singleton.

### Method Signatures

```typescript
// Creates ACTIVE enrollment + initial PhaseTransition to "bastao" atomically
createEnrollment(data: CreateEnrollmentInput): Promise<{ enrollment, transition }>

// Persists a MentorshipSession for an ACTIVE enrollment
logSession(data: LogSessionInput): Promise<MentorshipSession>

// Writes PhaseTransition + updates enrollment.currentPhaseId atomically
advancePhase(data: AdvancePhaseInput): Promise<{ transition, enrollment }>
```

### Transaction Patterns

| Method | Transaction scope |
|--------|------------------|
| `createEnrollment` | `prisma.$transaction` wraps `MentorshipEnrollment.create` + `PhaseTransition.create` |
| `logSession` | Single write — no transaction needed |
| `advancePhase` | `prisma.$transaction` wraps `PhaseTransition.create` + `MentorshipEnrollment.update` |

### Error Codes Defined

| Code | Class | Thrown by | HTTP mapping (for API route) |
|------|-------|-----------|------------------------------|
| `DUPLICATE_ENROLLMENT` | `MentorshipError` | `createEnrollment` | 409 Conflict |
| `INVALID_TRANSITION` | `MentorshipError` | `advancePhase` | 422 Unprocessable |

Plain `Error("Enrollment not found or not active")` is thrown by `logSession` (Prisma P2025 re-throw) — API route maps to 404.

### Edge Cases Handled

1. **Bastao phase missing from DB** — `findUniqueOrThrow` propagates a Prisma P2025 error; operations team must seed phases before enrollments can be created.
2. **Null currentPhase during advancePhase** — `sortOrder` defaults to `-1` so any sequential transition (sortOrder 0 = bastao) is blocked for non-ADMIN. ADMIN can always advance freely.
3. **Non-sequential ADMIN jump** — allowed by design (D-09 exempts ADMIN from forward-only rule).
4. **logSession on PAUSED/COMPLETED enrollment** — rejected via `findFirstOrThrow({ where: { status: "ACTIVE" } })` guard.

## Portal Separation

The service imports only `@/lib/db` (Prisma). No hub-auth, no hub routes, no ClientUser queries — portal separation rules satisfied.

## Commits

| Hash | Description |
|------|-------------|
| b221926 | feat(14-02): create mentorship.service.ts with createEnrollment, logSession, advancePhase |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — the service is fully implemented. It depends on the `bastao` MentorshipPhase row existing in the database (seeded in plan 14-01).

## Self-Check: PASSED

- [x] `lib/services/mentorship.service.ts` exists
- [x] `export const mentorshipService` found at line 209
- [x] Two `prisma.$transaction` calls found (lines 88 and 187)
- [x] `DUPLICATE_ENROLLMENT` and `INVALID_TRANSITION` error codes found
- [x] `npx tsc --noEmit` exits 0 — no TypeScript errors
- [x] Commit b221926 exists
