# Architecture Research

**Domain:** Ops Hub — Student Journey Management (v1.2 milestone)
**Researched:** 2026-04-01
**Confidence:** HIGH (based on direct codebase inspection of schema, middleware, and existing service layer)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Three-Portal Frontend                           │
├──────────────────┬──────────────────┬───────────────────────────────┤
│  Admin Dashboard │   Client Hub     │        Ops Hub                │
│  /dashboard/*    │   /hub/*         │        /ops/*                 │
│  NextAuth JWT    │   Custom JWT     │        NextAuth JWT            │
│  ALL roles       │   ClientUser     │        ADMIN / OPERATIONAL     │
├──────────────────┴──────────────────┴───────────────────────────────┤
│              Unified Middleware (middleware.ts — already wired)      │
│   /ops/* → getToken() + role check (ADMIN | OPERATIONAL)            │
│   /api/ops/* → same guard, already in config.matcher                │
├─────────────────────────────────────────────────────────────────────┤
│                       Service Layer                                 │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────┐ │
│  │  mentorship     │  │  identity-       │  │  existing services  │ │
│  │  .service.ts    │  │  mapper.ts       │  │  (QB, DocuSign …)   │ │
│  │  (NEW)          │  │  (shared, read)  │  │  (unchanged)        │ │
│  └────────┬────────┘  └──────────────────┘  └─────────────────────┘ │
├───────────┴─────────────────────────────────────────────────────────┤
│                    Prisma ORM / PostgreSQL (Neon)                   │
│  Customer   User   MentorshipEnrollment   MentorshipSession         │
│  PhaseTransition   PlacementTest   Deal   Invoice   Contract …      │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|---------------|----------------|
| `middleware.ts` | Route-level auth dispatch for all three portals | Already handles `/ops/*` and `/api/ops/*` — no changes needed |
| `app/ops/layout.tsx` | Session guard + ADMIN/OPERATIONAL role check | Already implemented — no changes needed |
| `lib/services/mentorship.service.ts` | All student journey business logic | New: enroll, transition phase, log session, query pipeline, daily actions |
| `app/api/ops/` | Thin route handlers delegating to service | New directory — all Ops API routes live here |
| `app/ops/pipeline/page.tsx` | Pipeline board (Server Component) | New: fetches all active enrollments grouped by phase |
| `app/ops/daily/page.tsx` | Daily action view (Server Component) | New: enrollments for current user, needs-action filter |
| `app/ops/students/[id]/page.tsx` | Student profile detail | New: full customer record + timeline + sessions |
| `components/ops/ops-sidebar.tsx` | Ops portal navigation | Modify: add Pipeline, Daily, Students nav items |

---

## Prisma Schema Design

### New Models

The three new models attach to `Customer` (the student) and `User` (the team member) as anchor points. No existing model fields change — only back-relations are added.

```prisma
// ── New Enums ─────────────────────────────────────────────────────────

enum MentorshipProgram {
  PASS
  ADVANCED
}

// 11 phases. Sequential order is implied by the enum; store an Int
// ordinal in application code (or a separate lookup table) if UI needs
// to enforce advancement direction. PAUSADO is a non-sequential state.
enum MentorshipPhase {
  ONBOARDING        // 1
  BUSSOLA           // 2 — compass / goal alignment session
  RAIO_X            // 3 — diagnostic / English assessment
  PLANO_DE_ESTUDOS  // 4 — study plan delivered
  TREINAMENTO       // 5 — active training
  MOCK_INTERVIEW    // 6
  DEVOLUTIVA        // 7 — feedback session
  REVISAO           // 8 — review / correction cycle
  FINALIZACAO       // 9 — wrap-up
  CONCLUIDO         // 10 — program complete
  PAUSADO           // non-sequential hold state
}

enum SessionType {
  ONBOARDING
  BUSSOLA
  RAIO_X
  TREINAMENTO
  MOCK_INTERVIEW
  DEVOLUTIVA
  OUTROS
}

// ── New Models ────────────────────────────────────────────────────────

model MentorshipEnrollment {
  id            String            @id @default(cuid())
  program       MentorshipProgram
  currentPhase  MentorshipPhase   @default(ONBOARDING)
  enrolledAt    DateTime          @default(now())
  programEndsAt DateTime          // explicit: enrolledAt + 6 months, adjustable
  completedAt   DateTime?         // null = active enrollment
  notes         String?
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  customerId    String
  customer      Customer          @relation(fields: [customerId], references: [id])

  assignedUserId String?
  assignedUser   User?            @relation("MentorshipAssignments", fields: [assignedUserId], references: [id])

  sessions         MentorshipSession[]
  phaseTransitions PhaseTransition[]

  @@index([customerId])
  @@index([assignedUserId])
  @@index([currentPhase])
  @@index([program])
  @@map("mentorship_enrollments")
}

model MentorshipSession {
  id           String            @id @default(cuid())
  type         SessionType
  conductedAt  DateTime
  notes        String?
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt

  enrollmentId  String
  enrollment    MentorshipEnrollment @relation(fields: [enrollmentId], references: [id])

  conductedById String
  conductedBy   User             @relation("ConductedSessions", fields: [conductedById], references: [id])

  @@index([enrollmentId])
  @@index([conductedById])
  @@index([conductedAt])
  @@map("mentorship_sessions")
}

model PhaseTransition {
  id              String            @id @default(cuid())
  fromPhase       MentorshipPhase
  toPhase         MentorshipPhase
  reason          String?
  transitionedAt  DateTime          @default(now())

  enrollmentId     String
  enrollment       MentorshipEnrollment @relation(fields: [enrollmentId], references: [id])

  transitionedById String
  transitionedBy   User             @relation("PhaseTransitions", fields: [transitionedById], references: [id])

  @@index([enrollmentId])
  @@index([transitionedAt])
  @@map("phase_transitions")
}
```

### Required Back-Relation Additions to Existing Models

These are purely additive. No existing fields are modified.

```prisma
// model User — add:
mentorshipAssignments MentorshipEnrollment[] @relation("MentorshipAssignments")
conductedSessions     MentorshipSession[]    @relation("ConductedSessions")
phaseTransitions      PhaseTransition[]      @relation("PhaseTransitions")

// model Customer — add:
mentorshipEnrollments MentorshipEnrollment[]
```

### Schema Design Rationale

**Why `customerId` FK, not a new `studentId`:**
`Customer` is the existing identity anchor shared by invoices, contracts, and payments. A parallel "Student" entity would create a second record for the same human — the exact duplication problem the Identity Mapper was built to prevent. A student is simply a `Customer` who has a `MentorshipEnrollment`. Filter the student list with `where: { mentorshipEnrollments: { some: {} } }`.

**Why `MentorshipEnrollment` is one-to-many on `Customer`:**
A student can complete the Pass program and later enroll in Advanced. A `@unique` constraint on `customerId` would block re-enrollment. The active enrollment is identified by `completedAt: null`. A customer should never have more than one active enrollment — enforce this in `MentorshipService.createEnrollment()` with an existence check, not at the DB level.

**Why `PhaseTransition` is a separate log model, not a JSON array:**
`currentPhase` on `MentorshipEnrollment` is the denormalized fast-read field for the pipeline board. `PhaseTransition` is the audit log for the student profile timeline. The timeline requires ordering by transition date; admin metrics need to count transitions by phase. JSON arrays in PostgreSQL cannot be indexed or filtered efficiently. Keep both: update `currentPhase` and insert a `PhaseTransition` row inside a single `$transaction`.

**Why `programEndsAt` is explicit:**
Computing `enrolledAt + 6 months` would be wrong if the program is paused and restarted. An explicit field gives the ops team manual control and makes the query trivial (`WHERE programEndsAt < NOW()`).

**Why `assignedUserId` is nullable:**
Unassigned students must be visible in the pipeline board (not hidden). The daily action view filters `WHERE assignedUserId = :currentUserId`. Unassigned students appear only in the admin/coordinator overview.

---

## Recommended File Structure (new additions only)

```
app/
  ops/
    pipeline/
      page.tsx              ← Server Component: all active enrollments by phase
    daily/
      page.tsx              ← Server Component: current user's students needing action
    students/
      page.tsx              ← Server Component: paginated student list with search
      [id]/
        page.tsx            ← Server Component: full student profile
  api/
    ops/
      pipeline/
        route.ts            ← GET: all active enrollments grouped by phase
      daily/
        route.ts            ← GET: enrollments for calling user, needs-action filter
      students/
        route.ts            ← GET (list/search), POST (create enrollment)
        [id]/
          route.ts          ← GET (profile), PATCH (notes, assignedUser)
          phase/
            route.ts        ← POST: transition to new phase ($transaction)
          sessions/
            route.ts        ← GET (history), POST (log session)

lib/
  services/
    mentorship.service.ts   ← New: all student journey business logic

components/
  ops/
    ops-sidebar.tsx         ← Modify: add Pipeline, Daily, Students nav items
    pipeline-board.tsx      ← New: phase column layout
    student-card.tsx        ← New: compact card for pipeline and daily views
    phase-timeline.tsx      ← New: vertical timeline for student profile
    session-log-form.tsx    ← New: "use client" form to log a session
    phase-advance-button.tsx ← New: "use client" mutation trigger
```

---

## Architectural Patterns

### Pattern 1: Phase Transition Transaction

**What:** Every phase change writes to `currentPhase` (on the enrollment) and creates a `PhaseTransition` log row inside a single Prisma `$transaction`. These two writes are inseparable — never update one without the other.

**When to use:** Every call to `MentorshipService.transitionPhase()`.

**Trade-offs:** Slightly more code than a plain update; worth it because the timeline on the student profile would silently corrupt if the log row is missing.

```typescript
// lib/services/mentorship.service.ts
async transitionPhase(
  enrollmentId: string,
  fromPhase: MentorshipPhase,
  toPhase: MentorshipPhase,
  userId: string,
  reason?: string
) {
  return prisma.$transaction([
    prisma.mentorshipEnrollment.update({
      where: { id: enrollmentId },
      data: { currentPhase: toPhase },
    }),
    prisma.phaseTransition.create({
      data: {
        enrollmentId,
        fromPhase,
        toPhase,
        reason,
        transitionedById: userId,
      },
    }),
  ]);
}
```

### Pattern 2: Pipeline Query — Single Fetch, In-Memory Group

**What:** The pipeline board fetches all active enrollments in one `findMany` with `include`, then groups by `currentPhase` in JavaScript. At Carreira's expected scale (< 500 active students), this is faster to implement and maintain than a SQL view.

**When to use:** The `/api/ops/pipeline` GET handler and the `pipeline/page.tsx` server component.

**Trade-offs:** In-memory grouping is O(n) on the result set — acceptable under 500 rows. If the pipeline query latency exceeds 200 ms in production, replace with a SQL view.

```typescript
const enrollments = await prisma.mentorshipEnrollment.findMany({
  where: { completedAt: null },
  include: {
    customer: { select: { id: true, name: true, email: true, phone: true, country: true } },
    assignedUser: { select: { id: true, name: true } },
    sessions: { orderBy: { conductedAt: "desc" }, take: 1 },
    phaseTransitions: { orderBy: { transitionedAt: "desc" }, take: 1 },
  },
  orderBy: { updatedAt: "desc" },
});

// Group in-memory by phase (O(n), fine for < 500 students)
const byPhase = enrollments.reduce((acc, e) => {
  (acc[e.currentPhase] ??= []).push(e);
  return acc;
}, {} as Record<MentorshipPhase, typeof enrollments>);
```

### Pattern 3: Daily Action View — Token-Scoped User Filter

**What:** The daily action view shows only the enrollments where `assignedUserId = session.user.id`. The API route reads the NextAuth token via `getToken()` to get the user ID — it never accepts a `userId` query parameter from the client.

**When to use:** The `/api/ops/daily` GET handler and `daily/page.tsx`.

**Trade-offs:** Server-side scoping means a team member cannot accidentally (or intentionally) see another member's list via URL manipulation. Admins use the pipeline board for the cross-team view.

```typescript
// app/api/ops/daily/route.ts
export async function GET(req: NextRequest) {
  const token = await getToken({ req });
  if (!token || !["ADMIN", "OPERATIONAL"].includes(token.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const userId = token.sub as string;

  const enrollments = await prisma.mentorshipEnrollment.findMany({
    where: {
      completedAt: null,
      assignedUserId: userId,
    },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      sessions: { take: 1, orderBy: { conductedAt: "desc" } },
    },
  });
  return NextResponse.json(enrollments);
}
```

### Pattern 4: Server Component Fetch + Isolated "use client" Mutations

**What:** Pipeline board, daily view, and student profile pages are Server Components that fetch data directly from `mentorship.service.ts`. The only client-side interactivity (phase advance button, session log form) is isolated into small `"use client"` leaf components nested inside the server-rendered tree.

**When to use:** All Ops Hub pages — they are read-heavy, non-real-time views.

**Trade-offs:** Eliminates loading flash, reduces client JS bundle, and allows streamed rendering. The small mutation components do not need to re-render the full page — they call `/api/ops/students/[id]/phase` or `/api/ops/students/[id]/sessions` and then `router.refresh()` to revalidate the Server Component above them.

---

## Data Flow

### Student Enrollment Creation

```
Ops user submits enrollment form
    ↓
POST /api/ops/students  { customerId, program, assignedUserId? }
    ↓
getToken() → verify ADMIN or OPERATIONAL
    ↓
MentorshipService.createEnrollment()
    → check no active enrollment exists for customerId
    → prisma.mentorshipEnrollment.create(...)
    → prisma.phaseTransition.create({ fromPhase: null, toPhase: ONBOARDING })
    ↓
201 Created  { enrollmentId }
```

### Phase Transition

```
Ops user clicks "Advance Phase" on Pipeline Board
    ↓
POST /api/ops/students/[id]/phase  { toPhase, reason? }
    ↓
getToken() → verify ADMIN or OPERATIONAL
    ↓
MentorshipService.transitionPhase()
    → prisma.$transaction([update enrollment, create PhaseTransition])
    ↓
200 OK → client calls router.refresh() → Server Component re-renders
```

### Pipeline Board Load

```
User navigates to /ops/pipeline
    ↓
pipeline/page.tsx (Server Component)
    → getServerSession() → verify role
    → MentorshipService.getPipelineData()
        → prisma.mentorshipEnrollment.findMany({ completedAt: null, include: ... })
        → group by currentPhase in memory
    ↓
Render <PipelineBoard byPhase={byPhase} /> (Server Component)
    → each phase column renders <StudentCard> list
    → each card embeds <PhaseAdvanceButton> ("use client" leaf)
```

### Daily Action Load

```
User navigates to /ops/daily
    ↓
daily/page.tsx (Server Component)
    → getServerSession() → userId
    → MentorshipService.getDailyActions(userId)
        → prisma.mentorshipEnrollment.findMany({
            assignedUserId: userId,
            completedAt: null
          })
        → filter / sort by "needs action" heuristic:
            - last session > 7 days ago, OR
            - phase is ONBOARDING with zero sessions, OR
            - programEndsAt within 30 days
    ↓
Render checklist of StudentCard items
```

---

## API Route Structure

| Route | Method | Purpose | Guard |
|-------|--------|---------|-------|
| `/api/ops/pipeline` | GET | All active enrollments grouped by phase | ADMIN, OPERATIONAL |
| `/api/ops/daily` | GET | Enrollments assigned to calling user, needs-action sorted | ADMIN, OPERATIONAL |
| `/api/ops/students` | GET | Paginated list with name/email search and phase filter | ADMIN, OPERATIONAL |
| `/api/ops/students` | POST | Create enrollment for existing Customer | ADMIN, OPERATIONAL |
| `/api/ops/students/[id]` | GET | Full student profile: customer info, timeline, sessions, placement test | ADMIN, OPERATIONAL |
| `/api/ops/students/[id]` | PATCH | Update notes, assignedUserId | ADMIN, OPERATIONAL |
| `/api/ops/students/[id]/phase` | POST | Transition to new phase (writes $transaction) | ADMIN, OPERATIONAL |
| `/api/ops/students/[id]/sessions` | GET | Full session history | ADMIN, OPERATIONAL |
| `/api/ops/students/[id]/sessions` | POST | Log a new session | ADMIN, OPERATIONAL |

Middleware at `middleware.ts` already enforces authentication and role check for all `/api/ops/*` routes. Each handler must additionally call `getToken()` to read the caller's `sub` for user-scoped queries (daily view, session conductor).

---

## Integration Points

### New Models → Existing Models (additive only)

| Integration | Direction | What Changes |
|-------------|-----------|-------------|
| `MentorshipEnrollment` → `Customer` | FK reference | Add `mentorshipEnrollments` back-relation to `Customer` model |
| `MentorshipEnrollment` → `User` (assignedUser) | FK reference | Add `mentorshipAssignments` back-relation to `User` model |
| `MentorshipSession` → `User` (conductedBy) | FK reference | Add `conductedSessions` back-relation to `User` model |
| `PhaseTransition` → `User` (transitionedBy) | FK reference | Add `phaseTransitions` back-relation to `User` model |
| Student Profile reads `PlacementTest` | Read-only | No schema change — already on `Customer` via `customer.placementTests` |
| Student Profile reads `Invoice` | Read-only | No schema change — already on `Customer` via `customer.invoices` |
| Student Profile reads `Deal` | Read-only | No schema change — already on `Customer` via `customer.deals` |
| Student Profile reads `Contract` | Read-only | No schema change — already on `Customer` via `customer.contracts` |

### Webhook Hook Point (out of scope for v1.2, design for it)

The Pipedrive Deal WON webhook (`/api/webhooks/pipedrive/deal`) is the natural trigger for auto-creating a `MentorshipEnrollment` when a deal closes. For v1.2, enrollment is manual. Write `MentorshipService.createEnrollment()` as a standalone function so it can be called from the webhook handler in v1.3 without refactoring.

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Ops Hub pages ↔ `/api/ops/*` | HTTP fetch (Server Components) or fetch + router.refresh() (client mutations) | Server Components can also call service directly, skipping the API layer |
| `mentorship.service.ts` ↔ Prisma | Direct import, singleton pattern | Same pattern as all existing services |
| Ops Hub ↔ Admin Dashboard | Shared database, no cross-portal API calls | Ops reads `Customer`, `Invoice`, `PlacementTest` via Prisma directly — not via `/api/dashboard/*` routes |
| Ops Hub ↔ Client Hub | No shared state | ClientUser and MentorshipEnrollment are both anchored on Customer but never queried together in the Ops context |

---

## Build Order (dependency-aware)

Each step unblocks the next. Do not start a UI surface until its data layer is confirmed correct.

1. **Schema migration** — Add the three new models and back-relations to `User` and `Customer`. Run `npm run db:migrate`. Everything else depends on this.

2. **`lib/services/mentorship.service.ts`** — Implement `createEnrollment`, `transitionPhase`, `logSession`, `getPipelineData`, `getDailyActions`, `getStudentProfile`. All business logic in one place before any route or UI touches it.

3. **`/api/ops/pipeline` and `/api/ops/daily`** — Read-only endpoints first. Validates the query shape and response structure before building UI.

4. **`/api/ops/students` and `/api/ops/students/[id]`** — CRUD endpoints including the mutation routes (`/phase`, `/sessions`).

5. **Pipeline board page** (`/ops/pipeline`) — First UI surface. Confirms the pipeline query renders correctly across all 11 phases. Add "Pipeline" to `ops-sidebar.tsx` nav.

6. **Daily action view** (`/ops/daily`) — Second UI surface. Validates the per-user filter and needs-action heuristic. Add "Daily" to `ops-sidebar.tsx` nav.

7. **Student profile page** (`/ops/students/[id]`) — Aggregates customer data, placement test, sessions, and phase timeline. Build after data layer is stable. Add "Students" to `ops-sidebar.tsx` nav.

8. **Mutation components** (`PhaseAdvanceButton`, `SessionLogForm`) — The two interactive surfaces. Build last because they depend on the read views being validated first.

9. **Ops sidebar nav update** — Add Pipeline, Daily, Students to `navItems`. Intentionally last so nav only surfaces working routes.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Creating a Parallel "Student" Model

**What people do:** Add a `Student` model with its own `email`, `name`, `phone` fields to represent the ops concept of a student separately from `Customer`.

**Why it's wrong:** Creates a second identity record for the same human. The existing `Invoice`, `Contract`, `Payment`, and `Deal` models all anchor on `Customer.id`. A separate `Student` model either duplicates these relations or requires joins through two identity tables. The Identity Mapper was built precisely to prevent this class of duplication.

**Do this instead:** A student is a `Customer` with at least one `MentorshipEnrollment`. Filter with `where: { mentorshipEnrollments: { some: {} } }` to scope any customer list to enrolled students.

### Anti-Pattern 2: Storing Phase History as JSON on the Enrollment

**What people do:** Add a `phaseHistory: Json` field to `MentorshipEnrollment` and append objects to it on each phase change.

**Why it's wrong:** PostgreSQL JSON columns cannot be indexed, filtered by date, or joined. The student profile timeline needs ordering by transition date. Admin metrics need to count transitions by phase. Both become full-table scans on a JSON blob.

**Do this instead:** `PhaseTransition` as a proper relational model. Each transition is one row, indexed on `enrollmentId` and `transitionedAt`.

### Anti-Pattern 3: Skipping Role Enforcement Inside Route Handlers

**What people do:** Rely solely on `middleware.ts` to enforce the ADMIN/OPERATIONAL role check, then omit `getToken()` calls inside each route handler.

**Why it's wrong:** Middleware is the first line of defense, not the only line. A misconfigured route prefix, a future refactor that moves a handler, or a direct invocation in tests bypasses middleware entirely. Defense in depth means each handler independently verifies the token.

**Do this instead:** Every `/api/ops/*` handler begins with:
```typescript
const token = await getToken({ req });
if (!token || !["ADMIN", "OPERATIONAL"].includes(token.role as string)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

### Anti-Pattern 4: Building the Pipeline Board as a Client Component with useEffect Fetch

**What people do:** Mark the pipeline board page `"use client"` and fetch from `/api/ops/pipeline` on mount via `useEffect` (or `useQuery`).

**Why it's wrong:** The pipeline board is a read-heavy initial render. Client-side fetching introduces a loading flash, increases JS payload, and prevents server-side caching. The board has no real-time requirement — polling or manual refresh is acceptable.

**Do this instead:** `pipeline/page.tsx` is a Server Component that calls `MentorshipService.getPipelineData()` directly. Phase advance buttons are small isolated `"use client"` leaf components that call the API and trigger `router.refresh()`. The vast majority of the board is server-rendered with zero client JS.

### Anti-Pattern 5: Allowing Multiple Active Enrollments Per Customer at the DB Level

**What people do:** Try to enforce "one active enrollment" via a unique constraint on `(customerId, completedAt)` in Prisma.

**Why it's wrong:** PostgreSQL treats `NULL` values as distinct for unique constraints — two rows with `completedAt: null` for the same `customerId` would not violate a `@@unique([customerId, completedAt])` constraint.

**Do this instead:** Enforce in `MentorshipService.createEnrollment()`:
```typescript
const existing = await prisma.mentorshipEnrollment.findFirst({
  where: { customerId, completedAt: null },
});
if (existing) throw new Error("Customer already has an active enrollment");
```
Document this invariant with a comment in the schema.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–200 active students | Single `findMany` with `include` for pipeline; in-memory grouping by phase. No additional optimization needed. |
| 200–1000 active students | Add a partial index `WHERE completed_at IS NULL` on `mentorship_enrollments`. Consider a Postgres view for the pipeline query to avoid computing last-session in application code. |
| 1000+ active students | Paginate the pipeline board by phase column. Cache the pipeline query with `unstable_cache` for 30 seconds (acceptable staleness for an ops board). |

The first bottleneck will be the pipeline query joining enrollments + customer + last session + last transition for all active students. The indexes on `completedAt IS NULL` (partial), `assignedUserId`, and `currentPhase` address this before it becomes a problem.

---

## Sources

- Direct inspection of `prisma/schema.prisma` — HIGH confidence
- Direct inspection of `middleware.ts` — HIGH confidence
- Direct inspection of `app/ops/` shell (layout, pages, sidebar) — HIGH confidence
- Direct inspection of `lib/services/` directory listing — HIGH confidence (service pattern established)
- Prisma relations documentation (one-to-many, back-relations): https://www.prisma.io/docs/orm/prisma-schema/data-model/relations — MEDIUM confidence (established from existing schema patterns)
- Next.js App Router Server Components and data fetching: https://nextjs.org/docs/app/building-your-application/data-fetching — MEDIUM confidence

---

*Architecture research for: Ops Hub — Student Journey Management (v1.2)*
*Researched: 2026-04-01*
