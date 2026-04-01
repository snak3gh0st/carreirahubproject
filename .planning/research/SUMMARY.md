# Project Research Summary

**Project:** Carreira AI Hub — Ops Hub v1.2 (Student Journey Management)
**Domain:** Internal ops workspace for coaching/mentorship program delivery
**Researched:** 2026-04-01
**Confidence:** HIGH

## Executive Summary

The Ops Hub is an internal tool for a 3-person team (Fraenze, Dária, Rafael) that replaces ClickUp as their day-to-day student management surface. The pattern is well-understood: every coaching CRM and customer success platform (CoachVantage, HubSpot CS Workspace, Gainsight, Vitally) converges on the same core design — a phase pipeline board as the primary entry point, a per-user daily action queue, and a 360-degree student profile. The recommended approach is to build a purpose-built version of these patterns against the existing Next.js 14 + Prisma stack rather than adopting a general-purpose tool. The existing stack covers nearly every need; the only genuine library gap is `@dnd-kit/core` for drag-and-drop on the pipeline board.

The architecture decision with the highest long-term impact is the data model: phases must be stored as a lookup table with string foreign keys, not as a PostgreSQL enum. Every team that models operational phases as enums eventually hits an untransactable `ALTER TYPE` migration when the business renames or adds a phase — a documented Prisma breaking pattern across multiple tracked issues. Equally important, the student journey concept maps directly onto the existing `Customer` identity anchor via a new `MentorshipEnrollment` model. Creating a parallel "Student" entity would re-introduce the deduplication problem the Identity Mapper was built to prevent.

The critical build constraint is scope. Because 12+ services already exist in the codebase (QuickBooks, WhatsApp, DocuSign, etc.), it is trivially easy to import them into ops routes and silently expand v1.2 into a much larger build. The five v1.2 deliverables — data model and enrollment, pipeline board, phase transitions, session logging, and student profile — must be treated as a complete and closed list. Every other capability is explicitly deferred to v1.3.

## Key Findings

### Recommended Stack

The existing stack (Next.js 14 App Router, Prisma 5, React Query v5, TanStack Table v8, Radix UI, Zod, date-fns v3, Sonner) covers all Ops Hub needs without new additions except drag-and-drop. The only install required is `@dnd-kit/core@^6.3.1 @dnd-kit/sortable@^10.0.0 @dnd-kit/utilities@^3.2.2` — the only production-stable React DnD library as of 2026. `react-beautiful-dnd` is officially deprecated by Atlassian (2022); `@dnd-kit/react` is pre-1.0 alpha and not safe for production. Real-time WebSocket infrastructure is explicitly excluded by project constraints; React Query `refetchInterval` polling (60s for the pipeline board, 30s for the daily view) is the correct substitute on Vercel serverless.

**Core technologies:**
- `@dnd-kit/core` v6.3.1: Kanban drag-and-drop engine — only stable option; full TypeScript and WCAG accessibility support
- `@dnd-kit/sortable` v10.0.0: Cross-column card movement preset — maps directly to the phase transition gesture
- `@dnd-kit/utilities` v3.2.2: CSS transform helpers for drag animation — required companion to sortable
- `@tanstack/react-query` (existing): Board polling and daily view refresh — already installed and in use
- `date-fns` (existing): Session date display, overdue detection, week view — already installed
- `prisma` v5 (existing): Three new models required — `MentorshipEnrollment`, `MentorshipSession`, `PhaseTransition`

### Expected Features

**Must have (table stakes) — v1 launch, replaces ClickUp:**
- Phase pipeline board — all students across 11 phase columns; no board means the tool cannot replace ClickUp
- Phase transition action — "Avançar Fase" with confirmation modal and atomic PhaseTransition log write
- Student profile page — contact info, current phase, phase history, sessions, English test result, invoice status
- Phase history timeline — chronological audit trail on the student profile
- Session logging — log-after-the-fact (type, date, conductor, notes); not a scheduling tool
- Team member filter — "My students" scoping (Fraenze = all, Dária = phases 1-9, Rafael = phases 10+)
- Notes — freeform per-student, visible to the whole team
- Enrollment flow — create a MentorshipEnrollment from an existing Customer or won deal record

**Should have (differentiators) — v1.x after validation:**
- Daily action view — SLA-based per-member queue; requires real usage data to define threshold values
- Phase SLA indicators — green/amber/red on pipeline cards; thresholds need validation with real data
- Debtor flag on pipeline card — pulls from existing Invoice model; low cost, high coordinator value
- Coordinator overview — cross-team metrics for Fraenze; built last as an aggregation of v1 data
- Program type badge — Pass vs. Advanced context on every card

**Defer (v2+):**
- Automated notifications and push alerts — alert fatigue risk; daily action view is sufficient for 3 people
- Session scheduling and calendar integration — complexity not justified; log-after-the-fact covers 90% of the value
- Student-facing phase display in Client Hub — cross-portal write introduces coupling; read from shared DB if needed later
- Document storage and file attachments — Google Drive links in the Notes field is sufficient for v1
- Enrollment auto-creation from Pipedrive webhook — design the service method for it in v1.2; wire it in v1.3

### Architecture Approach

The Ops Hub fits into the existing three-portal structure as a third NextAuth-protected portal at `/ops/*` with `ADMIN | OPERATIONAL` role gates. All business logic lives in a new `lib/services/mentorship.service.ts` singleton following the same pattern as all existing services. Pages are Server Components that call the service directly; the only `"use client"` surfaces are two small mutation leaf components (`PhaseAdvanceButton`, `SessionLogForm`). Phase changes are always written as a Prisma `$transaction` pairing an enrollment update with a `PhaseTransition` log row — these two writes are inseparable. The pipeline board uses a single `findMany` with `include` and in-memory grouping by phase, which is acceptable for under 500 students.

**Major components:**
1. `lib/services/mentorship.service.ts` — all student journey business logic: `createEnrollment`, `transitionPhase`, `logSession`, `getPipelineData`, `getDailyActions`, `getStudentProfile`
2. `app/api/ops/` — thin route handlers delegating to the service; every handler independently verifies `getToken()` role in addition to middleware
3. `app/ops/pipeline/page.tsx` — Server Component pipeline board; client mutations are isolated leaf components only
4. `app/ops/daily/page.tsx` — Server Component daily action view; user-scoped by token, never by query parameter
5. `app/ops/students/[id]/page.tsx` — Server Component student profile; aggregates Customer, enrollment, sessions, test results, and invoices

### Critical Pitfalls

1. **Phase modeled as a Prisma enum** — PostgreSQL `ALTER TYPE` cannot run inside a transaction block; every phase rename requires a risky production migration. Use a `MentorshipPhase` lookup table with `key`, `label`, and `sortOrder` columns instead. TypeScript type safety comes from a `const` object in application code, not a DB enum. This decision must be made before any migration is written.

2. **N+1 queries on the pipeline board** — Fetching each student's profile, last session, and assignee in a loop produces 100+ DB queries per page load. At 80+ students with a full `include` block on Neon's shared tier, Vercel's 10-second function timeout is reachable. Use a single `findMany` with `include` and `relationLoadStrategy: "join"`. Verify with Prisma query logging (`log: ['query']`) in staging at 20+ test enrollments before shipping.

3. **Role scoping enforced only in the UI** — The middleware gates the route but does not scope the data. An OPERATIONAL user calling `GET /api/ops/pipeline` directly receives all students unless the Prisma `where` clause includes `assignedUserId: token.sub` for non-admin roles. Apply the scope filter at the query level, never post-filter in JavaScript.

4. **Phase transitions without validation** — An API that accepts any `{ phaseKey }` payload without checking the current phase allows impossible state jumps that corrupt reporting and phase history. Define a `VALID_TRANSITIONS` map in the service layer; return 400 for invalid transitions; provide an ADMIN-only `force: true` flag with a logged override reason.

5. **Schema addition breaking existing endpoints** — Adding back-relations to `Customer` and `User` is additive but can accidentally expose enrollment data in dashboard or hub API responses if `include` blocks are copy-pasted across portals. Write explicit `select` objects in all ops routes and verify that `/api/dashboard/customers` and `/api/hub/invoices` return identical response shapes before and after the migration deploys to staging.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Data Foundation
**Rationale:** `MentorshipEnrollment` is the keystone — every single Ops Hub feature reads from or writes to it. Nothing else can be built until the schema is correct and the service layer is proven. This phase also contains the highest-risk decisions: phase model as a lookup table (not enum), transition validation map, and N+1-safe query patterns. Getting these wrong requires data migrations later; getting them right means all subsequent phases are low-risk.
**Delivers:** Three new Prisma models (`MentorshipEnrollment`, `MentorshipSession`, `PhaseTransition`), `mentorship.service.ts` with all business logic methods, and all `/api/ops/*` route handlers — both read and write — tested at the API level with real seeded data.
**Addresses:** StudentJourney data model, enrollment flow, phase transition action (service layer)
**Avoids:** Phase-as-enum pitfall, N+1 pitfall, role-scoping pitfall, transition validation pitfall, and schema-breaks-existing-endpoints pitfall — all must be solved at this layer before any UI is built on top

### Phase 2: Pipeline Board
**Rationale:** The pipeline board is the team's primary daily entry point and the first visual proof that the data model is correct. Building it immediately after the data layer validates query shape, phase grouping, and the `DndContext` integration in isolation before other views depend on the same patterns.
**Delivers:** `/ops/pipeline` page with 11-column Kanban board, student cards showing name, program type, phase age, and assignee badge; `PhaseAdvanceButton` client mutation component; `ops-sidebar.tsx` nav update; React Query polling at 60-second interval.
**Uses:** `@dnd-kit/core` v6.3.1 + `@dnd-kit/sortable` v10.0.0 (new installs); existing React Query polling pattern
**Implements:** Server Component pipeline page with isolated `"use client"` PhaseAdvanceButton leaf component; optimistic update on phase advance followed by `router.refresh()`
**Avoids:** PII in pipeline response (explicit `select` excluding ssn, cpf, passport); unbounded `findMany` — pagination with `take` from day one

### Phase 3: Student Profile and Session Logging
**Rationale:** Once the pipeline board is working, the natural next need is clicking into a student and seeing their full context. Session logging is bundled here because it writes to `MentorshipSession`, which the profile immediately reads — building them together avoids a second round of API and UI work.
**Delivers:** `/ops/students/[id]` profile page with phase timeline, session history, English test result, invoice status, and notes; `SessionLogForm` client component; `GET/POST /api/ops/students/[id]/sessions` routes; `/ops/students` paginated list with search and phase filter.
**Implements:** `phase-timeline.tsx` Server Component; `session-log-form.tsx` "use client" leaf; TanStack Table for the student list with filtering by phase and assignee
**Avoids:** Session type as free text — controlled dropdown from the first implementation; session type must be an enum dropdown, never a freeform field

### Phase 4: Daily Action View
**Rationale:** Intentionally deferred to Phase 4 because SLA threshold values can only be defined credibly after Phases 1-3 are in production use and the team has real data on actual time-in-phase distributions. Building on day one would require guessing thresholds. Research confirms this: both Gainsight and HubSpot CS recommend calibrating SLA rules against actual usage data rather than upfront assumptions.
**Delivers:** `/ops/daily` page with per-user needs-action queue sorted by urgency (longest since last contact first); SLA threshold constants calibrated from real usage data from Phases 1-3; React Query polling at 30-second interval.
**Implements:** Token-scoped user filter (never accepts `userId` query parameter from client); needs-action heuristic (last session age, days in current phase, program end date proximity)
**Research flag:** Phase SLA threshold values require team input after 2-4 weeks of real Phase 1-3 usage. Do not hard-code production thresholds until the team has used the tool on live data.

### Phase 5: Proactive Indicators and Coordinator Overview
**Rationale:** These are aggregations and visual enhancements layered on top of the data that Phases 1-4 produce. Building them last means building against real data shapes, not hypothetical ones. The debtor flag reads from the existing `Invoice` model with no new data work; the coordinator overview is a read-only aggregation of existing tables. Both have low implementation cost once the data layer is stable.
**Delivers:** Phase SLA green/amber/red badges on pipeline cards; debtor "Em atraso" badge on student cards; program type (Pass/Advanced) badges throughout; coordinator metrics screen for Fraenze (count per phase, sessions logged this week, students flagged in daily action view).
**Implements:** Phase threshold config constants; Invoice model integration (read-only, no QB writes); aggregated queries using Prisma `_count` and `groupBy`
**Avoids:** Scope creep — QB balance fetching from QuickBooks API and WhatsApp sending from the ops context are explicitly not in this phase; only existing Invoice model data is used

### Phase Ordering Rationale

- The data model is a strict dependency for every UI surface, not a preference. All five features reference `MentorshipEnrollment`. Phase 1 must complete before Phase 2 begins.
- Phase transition validation (the `VALID_TRANSITIONS` map and `$transaction` pattern) must live in the service layer before the pipeline board UI is built. Atomicity cannot be retrofitted after the fact without touching every call site.
- The pipeline board (Phase 2) comes before the student profile (Phase 3) because it is the simpler read surface and validates the query shape that the profile later reuses.
- The daily action view (Phase 4) is intentionally late because its SLA thresholds require real usage data from Phases 1-3 to be calibrated meaningfully. Building it first would mean shipping with guessed values.
- Proactive indicators (Phase 5) are pure enhancement — the team can operate fully without them, and they benefit from real data to validate threshold values.

### Research Flags

Phases needing deeper research or team input during planning:
- **Phase 4 (Daily Action View):** SLA threshold values (days per phase before "needs attention") cannot be determined from research alone — they require team input after Phases 1-3 are running in production for 2-4 weeks. Block Phase 4 planning until Fraenze, Dária, and Rafael have observed actual phase durations.
- **Phase 5 (Debtor flag):** The QB sync cadence (currently every 6 hours per cron config) means the debtor flag can be up to 6 hours stale. Document this limitation clearly to the coordinator before building and confirm it is acceptable.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Data Foundation):** Schema design and service layer patterns are fully documented in ARCHITECTURE.md and PITFALLS.md with specific code examples. The decisions are clear; execute directly.
- **Phase 2 (Pipeline Board):** dnd-kit v6 integration is well-documented; Server Component + client mutation leaf pattern is established in the codebase. No additional research needed.
- **Phase 3 (Student Profile):** Standard read-heavy Server Component with CRUD mutations. No novel architecture; follows existing dashboard patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified via `npm info`; dnd-kit stable status confirmed via GitHub discussion #1842; all other dependencies already installed and in active use in the codebase |
| Features | HIGH | Pipeline board, session logging, and profile patterns are consistent across CoachVantage, HubSpot CS, Gainsight, and Vitally — strong convergence across multiple independent sources |
| Architecture | HIGH | Based on direct codebase inspection of `prisma/schema.prisma`, `middleware.ts`, `app/ops/` shell, and `lib/services/` — not inference; middleware already handles `/ops/*` routing |
| Pitfalls | HIGH | Phase-as-enum pitfall is documented in three specific Prisma GitHub issues; N+1 and role-scoping risks are well-established patterns; scope creep risk is codebase-specific and directly observed |

**Overall confidence:** HIGH

### Gaps to Address

- **Phase SLA thresholds:** The exact number of days that triggers "needs attention" per phase cannot be determined from research. Define conservative defaults for v1 (e.g., 7 calendar days for any phase) and adjust after 2-4 weeks of real usage. This is a configuration decision, not an architectural one — use named constants that can be updated without a schema migration.

- **Phase enum vs. lookup table conflict:** PITFALLS.md recommends a lookup table with string foreign keys. ARCHITECTURE.md uses a Prisma enum. These are in direct conflict. The pitfalls research is correct on this point — the lookup table approach must win. The architecture researcher's enum is the easier implementation but creates a migration trap. Override this before Phase 1 schema work begins and update `ARCHITECTURE.md` accordingly.

- **Enrollment trigger design for Pipedrive webhook:** ARCHITECTURE.md correctly identifies auto-enrollment from the Deal WON webhook as a v1.3 concern and recommends writing `MentorshipService.createEnrollment()` as a standalone function to support this. Confirm in Phase 1 planning that the method signature is designed with webhook invocation in mind so it does not require refactoring when the webhook is wired in v1.3.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `prisma/schema.prisma`, `middleware.ts`, `app/ops/`, `lib/services/` — architecture and integration constraints verified from source
- `npm info @dnd-kit/core` / `@dnd-kit/sortable` / `@dnd-kit/utilities` — version verification in project environment
- [dnd-kit GitHub discussion #1842](https://github.com/clauderic/dnd-kit/discussions/1842) — v6.3.1 stable vs @dnd-kit/react alpha confirmation
- [TanStack Query v5 docs — useQuery reference](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery) — polling options verified
- [Prisma issue #5290](https://github.com/prisma/prisma/issues/5290), [#7251](https://github.com/prisma/prisma/issues/7251), [#24292](https://github.com/prisma/prisma/issues/24292) — enum migration failures with version specifics
- [Prisma query optimization docs](https://www.prisma.io/docs/orm/prisma-client/queries/query-optimization-performance) — N+1 prevention and `relationLoadStrategy: "join"`

### Secondary (MEDIUM confidence)
- [CoachVantage features](https://www.coachvantage.com/coaches-platform-features) — coaching CRM patterns for session logging and client profile
- [HubSpot Customer Success Workspace](https://knowledge.hubspot.com/customer-success/use-the-customer-success-workspace) — daily action queue and 360-degree profile patterns
- [Gainsight vs Totango 2026](https://oliv.ai/blog/gainsight-vs-totango) — SLA health score patterns and alert fatigue risks
- [Best Customer Success Platforms 2026](https://www.thecscafe.com/p/best-customer-success-platforms) — feature landscape validation
- [PostgreSQL enum vs lookup table — CYBERTEC](https://www.cybertec-postgresql.com/en/lookup-table-or-enum-type/) — phase modeling rationale

### Tertiary (MEDIUM confidence)
- [Top 5 React DnD libraries 2026 — Puck](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react) — dnd-kit recommendation corroboration
- [date-fns vs alternatives 2026](https://www.pkgpulse.com/blog/best-javascript-date-libraries-2026) — library selection confirmation

---
*Research completed: 2026-04-01*
*Ready for roadmap: yes*
