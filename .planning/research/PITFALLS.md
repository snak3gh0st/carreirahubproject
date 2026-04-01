# Pitfalls Research

**Domain:** Adding student journey management (phase pipeline, session logging, daily action views) to an existing Next.js 14 SaaS with finance automation, CRM, and multi-portal auth
**Researched:** 2026-04-01
**Confidence:** HIGH

---

## Critical Pitfalls

### Pitfall 1: Phase as Enum — The Migration Trap

**What goes wrong:**
Modeling the 11 student phases as a PostgreSQL enum (e.g., `enum MentorshipPhase { ONBOARDING, ACTIVE, ... }`) appears clean at schema design time. The moment the business wants to rename a phase, reorder phases, add phase 12, or retire phase 4, the migration breaks production. PostgreSQL `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block, causing Prisma to emit a migration that fails with `"ALTER TYPE ... ADD cannot run inside a transaction block"`. Removing an enum value is even worse — Prisma rewrites the entire column type through a multi-step replace strategy that is prone to conflicts when other changes are in the same migration (documented Prisma issue #5290, #7251, #24292).

For 11 named phases with business labels ("Fase de Onboarding", "Fase Ativa", etc.), the enum approach means every phase name change requires a database migration, a code deploy, and a risk window.

**Why it happens:**
Enums feel like the right choice for a bounded set of states. Developers default to them when they see a list of named values. The Prisma docs themselves show enums as the first example for status fields. The pain only appears on the first time the business says "we renamed Phase 3" — 3-6 months after the feature ships.

**How to avoid:**
Model phases as a separate `MentorshipPhase` table with a `sortOrder` integer and a `label` string. Use a `String` foreign key on the enrollment record, not an enum. This keeps phase names editable without migrations, allows reordering, and supports soft-deleting retired phases:

```prisma
model MentorshipPhase {
  id          String               @id @default(cuid())
  key         String               @unique  // "ONBOARDING", "ACTIVE", etc.
  label       String                        // "Fase de Onboarding"
  sortOrder   Int
  active      Boolean              @default(true)
  createdAt   DateTime             @default(now())
  enrollments MentorshipEnrollment[]

  @@map("mentorship_phases")
}

model MentorshipEnrollment {
  id        String           @id @default(cuid())
  phaseKey  String
  phase     MentorshipPhase  @relation(fields: [phaseKey], references: [key])
  // ...
}
```

If a finite set of phase keys is needed in TypeScript for type safety, use a `const` object rather than the Prisma enum — it lives in code, not in the database.

**Warning signs:**
- `enum MentorshipPhase` or `enum EnrollmentPhase` appears anywhere in `prisma/schema.prisma`
- Phase labels are hardcoded strings in the frontend instead of fetched from the database
- A business change request to rename a phase requires a code deploy

**Phase to address:**
Phase 1 (Data Model) — before any migration is written.

---

### Pitfall 2: N+1 Queries in the Pipeline Board View

**What goes wrong:**
The pipeline board shows all students grouped by phase. The naive implementation queries enrollments, then loops to load each student's profile, latest session, and assigned team member separately:

```typescript
// BAD — 1 query for enrollments + N queries for each student's data
const enrollments = await prisma.mentorshipEnrollment.findMany();
for (const e of enrollments) {
  const customer = await prisma.customer.findUnique({ where: { id: e.customerId } });
  const lastSession = await prisma.mentorshipSession.findFirst({ where: { enrollmentId: e.id } });
}
```

With 50 students, this is 1 + 50 + 50 = 101 database queries per page load. On Vercel serverless with Neon's connection pooler, each query costs ~5-15ms in cold-path round trips. The board takes 500ms-1500ms to load instead of 50ms. At 100 students it crosses Vercel's 10-second function timeout.

**Why it happens:**
The code "works" in development with 5 test records. The pattern feels natural — a loop with individual lookups. The performance cliff is invisible until the board has real data.

**How to avoid:**
Use Prisma's `include` with nested relations in a single `findMany` call. Use `relationLoadStrategy: "join"` for the most performance-critical queries (single SQL statement, no round trips):

```typescript
// GOOD — 1-2 queries total regardless of student count
const enrollments = await prisma.mentorshipEnrollment.findMany({
  relationLoadStrategy: "join",
  include: {
    customer: { select: { id: true, name: true, email: true, phone: true } },
    phase: { select: { key: true, label: true, sortOrder: true } },
    assignedTo: { select: { id: true, name: true } },
    sessions: {
      orderBy: { scheduledAt: "desc" },
      take: 1,
      select: { id: true, type: true, scheduledAt: true, conductedAt: true }
    }
  }
});
```

For the daily action view (per-user filtered list), add `where: { assignedToId: session.user.id }` — always filter at the query level, never post-filter in JavaScript.

**Warning signs:**
- Any `findUnique` or `findFirst` call inside a loop that iterates over query results
- Pipeline board slow in staging with 20+ students
- Prisma query logs showing 20+ queries for a single page request

**Phase to address:**
Phase 1 (Data Model + API layer) — the query pattern must be established from the first API route. Retrofitting is possible but requires touching every board endpoint.

---

### Pitfall 3: Role-Based Filtering Enforced Only in the UI, Not the Query

**What goes wrong:**
The ops portal already correctly restricts access to `ADMIN` and `OPERATIONAL` roles at the middleware level (confirmed in `middleware.ts`). The subtle next mistake is implementing "team member sees only their own students" as a frontend filter — showing all students in the API response but hiding rows client-side based on `session.user.id`. Any team member can call `GET /api/ops/enrollments` directly (via curl, Postman, or browser DevTools) and see every student's data regardless of assignment.

This is a data leakage bug, not an access control bug. The middleware correctly gates the portal. The problem is the API returns unscoped data.

**Why it happens:**
Developers think of the UI as the security boundary because they can see it. The intent is correct ("show Fraenze only her students") but the implementation is wrong ("filter the array after fetching all"). This pattern is common in rapid prototyping and almost always survives into production.

**How to avoid:**
Apply the scope filter in the Prisma `where` clause based on the server-side session, not in the client:

```typescript
// In /api/ops/enrollments/route.ts
const session = await getServerSession(authOptions);
const userId = (session?.user as any)?.id;
const userRole = (session?.user as any)?.role;

const where = userRole === "ADMIN"
  ? {}                                  // ADMIN sees all students
  : { assignedToId: userId };           // OPERATIONAL sees only their own

const enrollments = await prisma.mentorshipEnrollment.findMany({ where, include: { ... } });
```

The admin/coordinator overview (cross-team view) is then an explicit `ADMIN`-only endpoint with no `assignedToId` filter. Document this distinction in a comment at the top of each route file.

**Warning signs:**
- API route returns all enrollments, then JavaScript filters by `assignedToId`
- `GET /api/ops/enrollments` with a non-admin token returns students assigned to other team members
- No `where: { assignedToId }` clause in the enrollment query for `OPERATIONAL` role users

**Phase to address:**
Phase 1 (API routes) — the filter must be in the first version of every enrollment query. Adding it retroactively requires auditing all routes and is error-prone.

---

### Pitfall 4: Phase Transitions Without Enforcement — Invalid States Enter the Database

**What goes wrong:**
Without transition enforcement, any phase can follow any other phase. A student gets manually moved from "Fase de Onboarding" directly to "Fase Concluída" skipping 9 phases. The pipeline board's history shows impossible jumps. Reports on "average time in each phase" become meaningless. The team loses trust in the data.

More critically: if payment status or contract status is tied to phase (e.g., "student cannot move to Fase Ativa without a signed contract"), skipping phases silently bypasses business rules that exist outside the ops tool.

**Why it happens:**
Phase pipeline boards feel like drag-and-drop. Developers implement a PATCH endpoint that accepts `{ phaseKey: string }` and updates the enrollment without checking what the current phase is or whether the transition is valid. The UI shows the right phases in the right order, but the API accepts any value.

**How to avoid:**
Define the valid transition map as a constant in a shared service file. The API route validates the transition before writing:

```typescript
// lib/services/mentorship-phase.service.ts
const VALID_TRANSITIONS: Record<string, string[]> = {
  "LEAD":         ["ONBOARDING"],
  "ONBOARDING":   ["ACTIVE", "PAUSED"],
  "ACTIVE":       ["SESSION_PREP", "PAUSED"],
  "SESSION_PREP": ["IN_SESSION", "ACTIVE"],
  "IN_SESSION":   ["POST_SESSION", "PAUSED"],
  "POST_SESSION": ["ACTIVE", "COMPLETED"],
  "PAUSED":       ["ACTIVE", "DROPPED"],
  // ADMIN override: can jump to any phase by passing force: true
};

export function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
```

The PATCH endpoint rejects invalid transitions with `400 Bad Request` and a message like `"Cannot transition from ACTIVE to COMPLETED — intermediate phases required"`. Admins get a `force: true` flag for exceptional corrections, which gets logged in the `phaseHistory` array with an `overrideReason` field.

**Warning signs:**
- The PATCH enrollment endpoint accepts any `phaseKey` value without checking the current phase
- No `phaseHistory` or transition log exists — only the current phase is stored
- Students appear in "completed" phase without any session logs

**Phase to address:**
Phase 1 (Data Model + Service layer) — the transition map must exist before the first PATCH endpoint is built.

---

### Pitfall 5: Schema Addition Breaks Existing Customer Queries

**What goes wrong:**
`MentorshipEnrollment` adds a new relation to the existing `Customer` model. The Prisma migration adds the foreign key correctly. But the existing `/api/dashboard/customers` route uses `prisma.customer.findMany({ include: { deals: true, invoices: true } })`. After the new relation is added, the Customer type grows a new `mentorshipEnrollment` field. TypeScript catches nothing — Prisma relations are opt-in in queries. The bug appears when a `SELECT *` query (via raw SQL or a Prisma extension) suddenly joins the new relation and performance degrades, or when a serializer that spreads the customer object starts returning enrollment data to the finance dashboard's API consumers.

A subtler version: the `ClientUser` model in the client hub displays customer data. If the enrollment relation is accidentally included in a hub API route (via a copy-pasted `include` block), customers see other customers' enrollment data in the Client Hub.

**Why it happens:**
Adding a relation to an existing model feels low-risk. The existing code doesn't use the new field — "how can it break?" The danger is in copy-paste patterns: a developer copies the dashboard `include` block into the new ops route and doesn't notice that `clientUser` or other sensitive relations are now included in the ops response.

**How to avoid:**
1. Never add the ops enrollment relation to `Customer` with a cascade that could be accidentally included. Use `MentorshipEnrollment.customerId` as the foreign key (enrollment points to customer, not the other way around), and only add the reverse relation (`enrollments MentorshipEnrollment[]`) to Customer if explicitly needed.
2. When writing ops API routes, define explicit `select` objects — never rely on default Prisma includes across portal boundaries.
3. After migration, run the existing dashboard customer API endpoints and verify response shapes match pre-migration baselines.

**Warning signs:**
- Hub API (`/api/hub/*`) response includes `enrollment` or ops-specific fields
- Dashboard customer API response grows unexpected fields after the schema migration
- Prisma schema shows `enrollments` relation on `Customer` without an `@@index` on the foreign key side

**Phase to address:**
Phase 1 (Data Model migration) — verify existing endpoints immediately after running the new migration in staging.

---

### Pitfall 6: "Just One More Feature" Scope Creep During Ops Tool Builds

**What goes wrong:**
Internal ops tools are uniquely vulnerable to scope creep because the users are in the same building (or Slack channel) as the developers. The team sees the pipeline board working and immediately asks for:
- "Can we add a notes field to each phase transition?"
- "Can we see the student's invoice balance on the profile card?"
- "Can we send a WhatsApp message from the session log?"
- "Can we bulk-assign students to a new team member?"

Each request feels small. Collectively they double the build time. The v1.2 milestone targets 5 features. If the team adds invoice balance display, the ops service now depends on QuickBooks sync data. If they add WhatsApp sending, the ops tool now requires the Twilio service. Both integrations already exist, making the additions feel "free" — but they each add edge cases, error handling, and test surface.

The specific risk in this codebase: the existing system has 12+ services already built (`quickbooks.service.ts`, `whatsapp.service.ts`, `docusign.service.ts`, etc.). It is trivially easy to import them into ops routes. The features work immediately. The scope boundary collapses silently.

**Why it happens:**
Internal tools serve people with direct access to the developer. The feedback loop is instant. "Yes, I can add that" is the path of least resistance. The developer sees the existing service and thinks "this will only take 20 minutes." Multiply by 10 requests.

**How to avoid:**
Define the five v1.2 deliverables as the complete and exhaustive feature set before writing any code. Any addition goes through an explicit decision: "Does this belong in v1.2 or is it a v1.3 item?" Write the out-of-scope list in the phase plan alongside the in-scope list. When a team member requests a new feature mid-sprint, the answer is "added to the v1.3 backlog" — not "let me add it quickly." The roadmap phase plan should include an explicit "NOT in this milestone" section with 3-5 pre-declined items to set expectations.

For this specific codebase: WhatsApp sending from ops, invoice balance display in ops, and bulk operations are all v1.3+ features. v1.2 is read/write on the pipeline and session data only.

**Warning signs:**
- Ops routes importing `quickbooks.service.ts`, `whatsapp.service.ts`, or `docusign.service.ts`
- Pipeline board showing financial balance data alongside phase data
- Session log form has a "send message" button
- Sprint taking 2x longer than estimated with "almost done, just adding one more thing" status updates

**Phase to address:**
All phases — scope discipline must be enforced at the planning stage (before Phase 1) and re-enforced at each phase boundary via an explicit scope check.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Phase as Prisma `enum` | Clean TypeScript types, no join needed | Every phase rename or addition requires a production migration with PostgreSQL enum transaction risks | Never for user-visible labels that business stakeholders control |
| Storing only `currentPhase`, no `phaseHistory` array | Simpler schema, no transition log writes | Cannot audit who moved a student, cannot calculate time-in-phase, reports are meaningless | Never — history is the primary value of a pipeline tracker |
| Filtering assignments in JavaScript post-query | Fast to implement | Data leakage: full dataset is always sent over the wire; any API consumer can bypass UI filters | Never for scoped data |
| Copying `include` blocks from dashboard routes | Reuse existing tested patterns | Accidentally brings in relations from the wrong portal domain; response payload grows unexpectedly | Never across portal boundaries — write explicit `select` objects |
| Skip transition validation, "users won't do that" | No service layer needed | Invalid phase sequences corrupt reporting; fixing requires data migrations | Never — invalid states always appear in production |
| Import `quickbooks.service.ts` into ops route for "quick" balance display | Immediate feature delivery | Ops tool now depends on QB OAuth token availability; QB outage breaks the ops board | MVP only if explicitly scoped; must have error boundary so QB failure does not break the page |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Existing Customer model | Adding `enrollments` relation to Customer and forgetting to add `@@index([customerId])` on the enrollment table | Always index the FK side of the relation; Prisma will silently omit the index unless explicitly declared |
| NextAuth session in ops routes | Using `(session?.user as any)?.id` and trusting it without validating the role server-side | Always re-check `role` from the session in each API route handler — middleware blocks the route but does not inject verified role into the request body |
| Prisma migration with new FK on existing table | Running `db:push` in development then assuming `db:migrate` will produce the same result | `db:push` and `db:migrate` can diverge; always test the migration SQL on a staging database before production |
| Phase history as `Json?` field | Storing history as `[{ phase, movedAt, movedBy }]` in a JSON column for simplicity | JSON columns cannot be indexed, queried efficiently, or have FK constraints. Use a `MentorshipPhaseHistory` table with proper columns |
| Vercel 10s timeout + pipeline query | Board API fetching all students with all relations on cold start | Add pagination (`take: 20, skip: offset`) to all board queries; never fetch unbounded lists in serverless functions |
| BullMQ workers not running on Vercel | Session reminders or phase-deadline checks enqueued but never processed | Any time-based ops logic (e.g., "alert if student has been in phase > 30 days") must use Vercel Cron Jobs, not BullMQ workers |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unbounded `findMany` on enrollments | Pipeline board times out; Vercel function exceeds 10s limit | Always add `take` + `skip` pagination; default page size 25 | At ~80 students with full `include` block on Neon's shared tier |
| Per-student session count subquery | Daily action view loads slowly; N+1 on `_count` aggregates | Use Prisma `_count` in a single `include` block: `sessions: { select: { _count: true } }` | At 50 students with 10+ sessions each |
| Phase history written on every view | Read-heavy ops board triggers writes; Neon connection pool exhausts | Phase history writes are mutations only (PATCH transitions) — never write in GET handlers | Immediately in production — write-on-read is always wrong |
| No index on `assignedToId` | Daily action view query table-scans the enrollment table | Add `@@index([assignedToId])` to `MentorshipEnrollment` in the schema | At ~200 enrollment records |
| Cold start + Prisma client instantiation | First request after idle takes 2-4s | Use the existing singleton pattern from `lib/db.ts` (already in codebase) — do not instantiate `new PrismaClient()` in route files | Every cold start on Vercel if the singleton pattern is not followed |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| OPERATIONAL role user calls admin endpoint directly | Team member sees all students across all assignees | Every ops API route must derive scope from `session.user.role` — middleware does not add scoping to requests, it only gates access |
| Phase transition accepted from unverified client payload | Client sends `{ phaseKey: "COMPLETED", force: true }` and it is accepted | `force: true` must only be honored when `userRole === "ADMIN"` — validate server-side, never trust client payload |
| Student PII (SSN, CPF, passport) included in pipeline board response | Sensitive data exposed in pipeline view that doesn't need it | Use explicit `select` that excludes `ssn`, `cpf`, `passport`, `dateOfBirth` from all ops list endpoints; include only in individual student profile endpoint with ADMIN-only gate |
| Phase history records not scoped to ops portal | Hub portal API accidentally returns phase history in customer profile response | Phase history relations must never be included in `/api/hub/*` routes — add a comment block at the top of hub route files listing forbidden includes |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Pipeline board loads all phases at once with no loading state | Users see blank board for 1-2 seconds on cold start | Add Suspense boundaries per phase column; stream data phase-by-phase using React Server Components |
| Phase transition requires a page reload to see the updated board | Team members think the move failed and move the card again (double-transition) | Optimistic UI update on drag: update local state immediately, revert on API error with an error toast |
| Daily action view shows all students "needing action" without sorting by urgency | Team members don't know where to start; most urgent students get missed | Sort by `lastSessionAt ASC` (longest since last contact first); add a visual indicator for students overdue by >7 days |
| Session log form accepts free-text "type" field | Inconsistent session type labels ("zoom", "Zoom", "video call") make reporting impossible | Session type must be a controlled enum or dropdown: STRATEGY / ENGLISH / FOLLOW_UP / CLOSING |
| No confirmation on phase transition | Accidental drag-and-drop moves student to wrong phase | Show a confirmation modal for transitions that skip phases or move backward; inline transitions for forward-one-step moves |

---

## "Looks Done But Isn't" Checklist

- [ ] **Phase model:** `prisma/schema.prisma` contains no `enum` for phase values — phases are rows in `MentorshipPhase` table with `key`, `label`, `sortOrder`.
- [ ] **Phase history:** `MentorshipPhaseHistory` table exists with `enrollmentId`, `fromPhaseKey`, `toPhaseKey`, `movedAt`, `movedById` — not a JSON column.
- [ ] **Transition enforcement:** `isValidTransition()` is called in every PATCH endpoint before writing; invalid transitions return 400 with descriptive message.
- [ ] **Scoped queries:** `GET /api/ops/enrollments` with an `OPERATIONAL` token returns only students assigned to that user — verified by calling the endpoint directly, not by checking the UI.
- [ ] **No N+1:** Pipeline board API uses a single `findMany` with `include` — verify using Prisma query logging (`log: ['query']` in dev) that page load triggers at most 3 database queries.
- [ ] **No PII leakage:** Pipeline board API response does not include `ssn`, `cpf`, `passport`, or `dateOfBirth` fields — verify by inspecting the JSON response in the network tab.
- [ ] **Existing endpoints intact:** After the schema migration, `/api/dashboard/customers` and `/api/hub/invoices` return the same response shape as pre-migration — verified in staging before production deploy.
- [ ] **Scope boundary held:** No ops API route imports `quickbooks.service.ts`, `whatsapp.service.ts`, or `docusign.service.ts` — verified with `grep -rn "quickbooks.service\|whatsapp.service\|docusign.service" app/ops app/api/ops`.
- [ ] **Pagination:** All `findMany` calls in ops routes have `take` and `skip` — no unbounded queries.
- [ ] **Session type is controlled:** Session `type` field uses an enum or a FK to a session type table — free-text is not accepted.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Phase defined as enum, business wants rename | HIGH | Requires PostgreSQL enum type replacement migration; must drop the enum, recreate it with new values, update all columns using it; high risk in production; better to refactor to string FK before first data exists |
| N+1 discovered in production | MEDIUM | Add `include` to existing queries; deploy; no data migration needed; but requires careful testing that included data shapes don't break existing TypeScript consumers |
| Role scoping missing from API route | MEDIUM | Audit all ops routes; add `where: { assignedToId }` clause; deploy; run API-level tests to confirm scoping works; check logs for any data access anomalies |
| Phase transition without history log | HIGH | Requires backfilling history from `createdAt` / `updatedAt` timestamps on enrollment records — approximate only; accurate history cannot be recovered retroactively |
| Scope creep features shipped in v1.2 | MEDIUM | Remove the features in v1.3 planning; document them as "moved to backlog"; runtime removal is fast but the development time spent is unrecoverable |
| Existing customer endpoint response changed by migration | LOW–MEDIUM | Revert migration if caught in staging; if in production, add explicit `select` to the existing route to exclude the new relation |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Phase as enum | Phase 1: Data Model | `grep -rn "enum.*Phase\|enum.*Enrollment" prisma/schema.prisma` returns 0 results |
| No phase transition history | Phase 1: Data Model | `MentorshipPhaseHistory` table exists in schema with typed columns before any PATCH route is written |
| N+1 in pipeline board | Phase 1: API layer | Prisma query log shows ≤3 queries for full board load; verified in staging with 20 test enrollments |
| Role scoping not in query | Phase 1: API layer | Direct API call with OPERATIONAL token returns only scoped students |
| Phase transition not enforced | Phase 1: Service layer | PATCH with invalid transition returns 400; confirmed with integration test |
| Schema addition breaks existing endpoints | Phase 1: Migration | Existing dashboard + hub endpoints tested in staging immediately after migration |
| Scope creep | Planning (pre-Phase 1) | "Out of scope" list written and agreed before Phase 1 starts; re-verified at each phase boundary |
| PII in pipeline response | Phase 2: Pipeline board API | Network tab inspection confirms no `ssn`/`cpf`/`passport` in list endpoint response |
| Unbounded queries | Phase 2: Pipeline board API | All `findMany` in ops routes have `take` parameter; verified by code review |
| Session type as free text | Phase 3: Session logging | Session form uses controlled dropdown; API rejects values not in the allowed set |

---

## Sources

- [Prisma: Query optimization and N+1 prevention](https://www.prisma.io/docs/orm/prisma-client/queries/query-optimization-performance)
- [Prisma: Relation load strategy — join vs query](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries)
- [Prisma issue #5290: ALTER TYPE enum migrations fail in PostgreSQL](https://github.com/prisma/prisma/issues/5290)
- [Prisma issue #7251: Can't add value to enum in Postgres](https://github.com/prisma/prisma/issues/7251)
- [Prisma issue #8424: New enum values must be committed before they can be used](https://github.com/prisma/prisma/issues/8424)
- [Prisma issue #24292: Adding enum field and removing value generates failing migration](https://github.com/prisma/prisma/issues/24292)
- [Lawrence Jones: Use your database to power state machines](https://blog.lawrencejones.dev/state-machines/)
- [Prisma: Customizing migrations — expand and contract pattern](https://www.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations)
- [PostgreSQL enum vs lookup table tradeoffs — CYBERTEC](https://www.cybertec-postgresql.com/en/lookup-table-or-enum-type/)
- [CVE-2025-29927: Next.js middleware auth bypass — RBAC implementation risks](https://github.com/vercel/next.js/discussions/60933)
- [Codebase analysis: middleware.ts OPERATIONAL/ADMIN role gate, Customer model relations, existing service layer patterns]

---
*Pitfalls research for: v1.2 Ops Hub — Student Journey Management added to existing Carreira AI Hub*
*Researched: 2026-04-01*
