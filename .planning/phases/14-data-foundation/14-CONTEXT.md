# Phase 14: Data Foundation - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the mentorship data foundation so the ops team can enroll any existing Customer into a mentorship program and log student journey events. Delivers:
- 4 new Prisma models: `MentorshipPhase`, `MentorshipEnrollment`, `MentorshipSession`, `PhaseTransition`
- `mentorship.service.ts` — stateless singleton with enrollment, phase transition, and session logic
- `/api/ops/*` routes — enrollment create, session log (ADMIN + OPERATIONAL access only)
- `/dashboard/ops/enroll` — enrollment form with customer typeahead search

This phase does NOT include the Kanban board (Phase 15), student profile (Phase 16), or daily action view (Phase 17).

</domain>

<decisions>
## Implementation Decisions

### Phase Lookup Table (MentorshipPhase)

- **D-01:** 11 phases stored as DB rows (not a Prisma enum) with `key` (snake_case slug), `label` (Portuguese display name), `sortOrder` (1–11), and `slaDays` (integer).
- **D-02:** Phase keys and SLA defaults to seed:

| sortOrder | key               | label                    | slaDays |
|-----------|-------------------|--------------------------|---------|
| 1         | bastao            | Passagem de Bastão       | 3       |
| 2         | cadastro          | Cadastro                 | 3       |
| 3         | teste_de_ingles   | Teste de Inglês          | 7       |
| 4         | onboarding        | Onboarding               | 7       |
| 5         | board             | Board                    | 7       |
| 6         | bussola           | Bússola                  | 14      |
| 7         | raio_x            | Raio X                   | 14      |
| 8         | material          | Material                 | 21      |
| 9         | devolutiva        | Devolutiva               | 7       |
| 10        | ongoing           | Ongoing                  | 60      |
| 11        | renovacao         | Renovação                | 14      |

### Enrollment (MentorshipEnrollment)

- **D-03:** Program type is `PASS` | `ADVANCED` — stored as a string enum (not a Prisma enum, for consistency with MentorshipPhase pattern). Required at enrollment time.
- **D-04:** Assigned team member (a `User` with OPERATIONAL or ADMIN role) is required at enrollment.
- **D-05:** Start date defaults to today, editable in the form.
- **D-06:** CEFR level (from `PlacementTest`) is optional at enrollment — student may not have a test result yet. Shows as "Pending" on profile. No blocking validation.
- **D-07:** Duplicate enrollment is blocked — if a Customer already has an **active** enrollment, the API returns 409 with message: "This student is already enrolled in an active [PASS/ADVANCED] program." An inactive/completed enrollment allows re-enrollment.
- **D-08:** On enrollment, the system creates the `MentorshipEnrollment` and immediately writes a `PhaseTransition` row setting the student to phase 1 (`bastao`), recording `fromPhaseId: null`, `toPhaseId: bastao.id`, `triggeredById: current_user.id`, and `createdAt: now()`.

### Phase Transitions (PhaseTransition)

- **D-09:** Default flow is sequential only — the API enforces `toPhase.sortOrder === currentPhase.sortOrder + 1` unless the requester has ADMIN role (coordinator override).
- **D-10:** Rollback (moving a student to a previous phase) is supported — written as a standard `PhaseTransition` row. The `PhaseTransition` model stores `fromPhaseId` and `toPhaseId` without direction enforcement; the service enforces forward-only for non-ADMIN users.
- **D-11:** All phase transitions (including rollbacks and coordinator skips) are recorded atomically in a single DB transaction — partial writes never occur.

### Session Logging (MentorshipSession)

- **D-12:** Session types are stored as a string enum with these 11 controlled values:
  - `passagem_de_bastao` — Passagem de Bastão
  - `teste_de_ingles` — Teste de Inglês
  - `onboarding` — Onboarding
  - `bussola` — Bússola
  - `raio_x` — Raio X
  - `devolutiva` — Devolutiva
  - `treinamento_de_entrevista` — Treinamento de Entrevista
  - `mock_interview` — Mock Interview
  - `check_in` — Check-in
  - `renovacao` — Renovação
  - `outro` — Outro (catch-all for edge cases)
- **D-13:** Conductor (a `User`) is required. Session date is required. Notes are optional.

### Enrollment UI

- **D-14:** A new `/dashboard/ops` section is added to the sidebar nav. Phase 14 delivers `/dashboard/ops/enroll`. Later phases (15–17) add their routes to the same section.
- **D-15:** The enrollment form uses typeahead-as-you-type Customer search (fires at 2+ characters, searches name and email). The search result card shows customer name, email, and latest CEFR level if available.
- **D-16:** After successful enrollment, the form stays on the page, resets, and shows a success toast — useful for enrolling multiple students back-to-back.

### API Routes

- **D-17:** All ops routes live at `/api/ops/*` — separate from `/api/dashboard/*`. Access is restricted to ADMIN and OPERATIONAL roles at the middleware/route level (returns 403 for other roles). Data is scoped at the query level, not post-filter.

### Claude's Discretion

- Exact Prisma model field names (following existing snake_case/camelCase conventions in the schema)
- HTTP status codes for validation errors (following existing patterns in the codebase)
- Loading skeleton vs spinner for the customer typeahead search results
- Whether `mentorship.service.ts` exports a singleton or uses static methods (follow existing service pattern)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema & Data Model
- `prisma/schema.prisma` — Existing models (Customer, User, UserRole enum, FormAssignment pattern) — follow these conventions for new models
- `.planning/REQUIREMENTS.md` §v1.2 Requirements — DATA-01 through DATA-04, ENRL-01, ENRL-02 — success criteria for this phase

### Ops Workflow Domain
- `.claude/projects/-Users-pauloloureiro-Dev-SigmaProjects-carreirahubproject/memory/project_ops_workflow.md` — 11 student journey phases, team responsibilities, session types — the domain the schema must model

### Architecture Constraints
- `CLAUDE.md` §Two Portals — CRITICAL SEPARATION — ops routes belong to the Admin Dashboard portal (`/dashboard/*`, `/api/dashboard/*` pattern; ops uses `/api/ops/*` but same portal)
- `CLAUDE.md` §Service Layer Pattern — new `mentorship.service.ts` follows the stateless singleton pattern

### Prior Services to Reference
- `lib/services/invoice-workflow.service.ts` — example of a workflow service with transaction patterns
- `lib/services/identity-mapper.ts` — example singleton service structure

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `prisma/schema.prisma` Customer model — `MentorshipEnrollment` will have a `customerId` FK to this
- `prisma/schema.prisma` User model with `UserRole` enum (ADMIN, OPERATIONAL already exist) — conductor and assignee fields reference this
- `app/dashboard/customers/` — existing customer search patterns (name/email queries) can inform the typeahead API endpoint
- Existing service singleton pattern: `export const mentorshipService = new MentorshipService()` at bottom of file

### Established Patterns
- Services: stateless classes in `lib/services/*.service.ts`, imported as singletons
- API routes: `app/api/[route]/route.ts` with exported `GET/POST/PATCH/DELETE` functions
- Auth: NextAuth JWT — ops routes use the same `getServerSession` check, then verify `session.user.role`
- DB transactions: `prisma.$transaction([...])` pattern used in existing services
- IntegrationLog: external API calls are logged — not needed for internal ops routes

### Integration Points
- New `/dashboard/ops` section needs a sidebar nav entry — connects to `app/dashboard/layout.tsx` or the sidebar component
- Customer typeahead needs a `/api/ops/customers/search` or reuse of `/api/dashboard/customers` with a search param
- `MentorshipEnrollment` links `Customer` (existing) + new `MentorshipPhase` + `User` (existing)

</code_context>

<specifics>
## Specific Ideas

- Phase transitions must be atomic — user explicitly confirmed this ("processes need to be correct and following in phases, it's like a client journey")
- The ops team (Fraenze, Dária, Rafael) are the primary users — UX should favor speed: typeahead search, quick form reset after enrollment, toast feedback
- SLA days are tunable — seed with workflow-based defaults, Fraenze can adjust via a future admin UI (not in scope for Phase 14)
- The 11 session types map directly to the student journey phases — this is intentional domain modeling

</specifics>

<deferred>
## Deferred Ideas

- Admin UI to edit SLA days per phase — deferred to a future phase after v1.2 ships
- Enrollment via Pipedrive Deal Won webhook (AUTO-01) — deferred to v1.3
- Session scheduling with Google Calendar invites (COMM-02) — deferred to v1.3
- Rollback UI/UX (the API supports rollback in Phase 14; the Kanban UI for triggering it comes in Phase 15)

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 14-data-foundation*
*Context gathered: 2026-04-01*
