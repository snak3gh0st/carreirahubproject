---
phase: 14-data-foundation
plan: "03"
subsystem: ops-api
tags: [api-routes, rbac, mentorship, enrollment, sessions, typeahead]
dependency_graph:
  requires: [14-02]
  provides: [ops-api-routes]
  affects: [ops-ui-phase-15]
tech_stack:
  added: []
  patterns: [nextauth-rbac, zod-validation, service-layer-delegation]
key_files:
  created:
    - app/api/ops/customers/search/route.ts
    - app/api/ops/enrollments/route.ts
    - app/api/ops/sessions/route.ts
  modified: []
decisions:
  - "RBAC enforces ADMIN|OPERATIONAL on all three /api/ops/ routes — matches middleware pattern from D-16"
  - "Zod used for request body validation on POST routes — consistent with project conventions"
  - "MentorshipError.code instanceof check maps DUPLICATE_ENROLLMENT to 409, plain Error message match maps inactive enrollment to 404"
metrics:
  duration: 4 min
  completed_date: "2026-04-01"
  tasks: 2
  files: 3
---

# Phase 14 Plan 03: Ops API Routes Summary

**One-liner:** Three `/api/ops/` route handlers exposing customer search typeahead, enrollment creation, and session logging — all gated to ADMIN and OPERATIONAL roles via NextAuth.

## Routes Created

### GET /api/ops/customers/search

- **File:** `app/api/ops/customers/search/route.ts`
- **Auth:** 401 (no session), 403 (wrong role)
- **Query param:** `q` — returns `{ customers: [] }` if under 2 chars
- **Search:** Case-insensitive `contains` on `name` OR `email`, limited to 10 results
- **Response shape:**
  ```json
  {
    "customers": [
      { "id": "...", "name": "...", "email": "...", "cefrLevel": "B1" }
    ]
  }
  ```
- `cefrLevel` pulled from most recent `PlacementTest`; `null` if none exists

### POST /api/ops/enrollments

- **File:** `app/api/ops/enrollments/route.ts`
- **Auth:** 401 / 403
- **Request body (Zod-validated):**
  ```json
  { "customerId": "...", "programType": "PASS|ADVANCED", "assignedToId": "...", "startDate": "2026-04-01T00:00:00Z" }
  ```
- **Delegates to:** `mentorshipService.createEnrollment()`
- **Error mapping:**
  - `400` — invalid body (Zod fieldErrors)
  - `409` — `MentorshipError.code === "DUPLICATE_ENROLLMENT"`
  - `500` — unexpected errors (logged via `console.error`)
- **Success:** `201` with `{ enrollment, transition }`

### POST /api/ops/sessions

- **File:** `app/api/ops/sessions/route.ts`
- **Auth:** 401 / 403
- **Request body (Zod-validated):**
  ```json
  { "enrollmentId": "...", "sessionType": "onboarding", "conductorId": "...", "sessionDate": "2026-04-01T00:00:00Z", "notes": "..." }
  ```
- **Valid `sessionType` values (D-12):** `passagem_de_bastao`, `teste_de_ingles`, `onboarding`, `bussola`, `raio_x`, `devolutiva`, `treinamento_de_entrevista`, `mock_interview`, `check_in`, `renovacao`, `outro`
- **Delegates to:** `mentorshipService.logSession()`
- **Error mapping:**
  - `400` — invalid body
  - `404` — enrollment not found or not active
  - `500` — unexpected errors
- **Success:** `201` with `{ session }`

## Auth / RBAC Pattern

All three routes use the same pattern from `app/api/dashboard/alerts/route.ts`:

```typescript
const session = await getServerSession(authOptions);
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const userRole = (session.user as any).role;
if (!["ADMIN", "OPERATIONAL"].includes(userRole)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all routes fully wired to `mentorshipService` methods.

## Self-Check: PASSED
