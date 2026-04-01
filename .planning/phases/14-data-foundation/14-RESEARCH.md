# Phase 14: Data Foundation - Research

**Researched:** 2026-04-01
**Domain:** Prisma schema extension, Next.js 14 App Router (dashboard portal), service layer transactions, typeahead search, RBAC
**Confidence:** HIGH

## Summary

Phase 14 adds four new Prisma models to persist the student journey for Carreira USA's mentorship programs. All four models follow the existing schema conventions exactly: `cuid()` IDs, `@@map()` table names, explicit `@@index()` on FK columns, and `createdAt`/`updatedAt` timestamps. Phase lookup rows are seeded via a Prisma seed script (matches project's `db:seed` convention) rather than an SQL migration, keeping seeding in one place and idempotent via `upsert`.

The service layer (`mentorship.service.ts`) follows the stateless singleton pattern established by `identity-mapper.ts` and `invoice-workflow.service.ts`. All multi-step writes (enrollment + initial PhaseTransition, phase transition) use `prisma.$transaction([...])` — the interactive transaction variant is not needed here because all operations are pure DB writes with no async branching inside the transaction body.

The enrollment UI lives at `/dashboard/ops/enroll` — a new ops section in the admin portal. The middleware already handles `/api/ops/*` with ADMIN/OPERATIONAL gate (confirmed in `middleware.ts` lines 84–98). The sidebar needs one new `NavItem` entry added to `mainNavItems` in `professional-sidebar.tsx`.

**Primary recommendation:** Use Prisma `prisma.$transaction([...])` (batch variant) for all atomic writes; use `prisma.customer.findMany` with `mode: "insensitive"` OR filter for the typeahead endpoint; debounce at 300ms in the client component.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Phase Lookup Table (MentorshipPhase)**
- D-01: 11 phases stored as DB rows (not a Prisma enum) with `key` (snake_case slug), `label` (Portuguese display name), `sortOrder` (1–11), and `slaDays` (integer).
- D-02: Phase keys and SLA defaults:

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

**Enrollment (MentorshipEnrollment)**
- D-03: Program type is `PASS` | `ADVANCED` — string (not Prisma enum).
- D-04: Assigned team member (User with OPERATIONAL or ADMIN role) required at enrollment.
- D-05: Start date defaults to today, editable in the form.
- D-06: CEFR level optional at enrollment — no blocking validation.
- D-07: Duplicate enrollment blocked (409) if active enrollment exists; inactive/completed allows re-enrollment.
- D-08: On enrollment, system creates `MentorshipEnrollment` + `PhaseTransition` to phase 1 (`bastao`) atomically.

**Phase Transitions (PhaseTransition)**
- D-09: Default flow sequential only — `toPhase.sortOrder === currentPhase.sortOrder + 1` unless ADMIN role.
- D-10: Rollback supported — written as standard PhaseTransition row; service enforces forward-only for non-ADMIN.
- D-11: All phase transitions recorded atomically in single DB transaction.

**Session Logging (MentorshipSession)**
- D-12: 11 session types as string enum: `passagem_de_bastao`, `teste_de_ingles`, `onboarding`, `bussola`, `raio_x`, `devolutiva`, `treinamento_de_entrevista`, `mock_interview`, `check_in`, `renovacao`, `outro`.
- D-13: Conductor (User) required. Session date required. Notes optional.

**Enrollment UI**
- D-14: New `/dashboard/ops` section in sidebar. Phase 14 delivers `/dashboard/ops/enroll`.
- D-15: Typeahead fires at 2+ chars, searches name and email; result shows name, email, CEFR level.
- D-16: After successful enrollment: form resets, success toast shown.

**API Routes**
- D-17: All ops routes at `/api/ops/*`. ADMIN + OPERATIONAL only (403 for others). Data scoped at query level.

### Claude's Discretion
- Exact Prisma model field names (follow existing snake_case/camelCase conventions)
- HTTP status codes for validation errors (follow existing patterns)
- Loading skeleton vs spinner for typeahead results
- Whether `mentorship.service.ts` exports a singleton or uses static methods (follow existing pattern)

### Deferred Ideas (OUT OF SCOPE)
- Admin UI to edit SLA days per phase
- Enrollment via Pipedrive Deal Won webhook (AUTO-01)
- Session scheduling with Google Calendar invites (COMM-02)
- Rollback UI/UX (API supports it; Kanban UI comes in Phase 15)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | System stores 11 mentorship phases as DB rows with key, label, and sortOrder | MentorshipPhase model design + seed script pattern |
| DATA-02 | Ops team member can create a MentorshipEnrollment for any Customer with program type, assigned team member, and start date | MentorshipEnrollment schema + enrollment service method |
| DATA-03 | System records a PhaseTransition row (timestamp, from-phase, to-phase, triggered-by user) every time a student's phase changes | PhaseTransition schema + transaction pattern |
| DATA-04 | Ops team member can log a MentorshipSession with type, conductor, date, optional notes | MentorshipSession schema + session service method |
| ENRL-01 | Ops team member can manually enroll an existing Customer into a mentorship program | POST /api/ops/enrollments + form at /dashboard/ops/enroll |
| ENRL-02 | Enrollment form includes Customer search by name or email | GET /api/ops/customers/search + typeahead component |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma Client | Already installed (project uses it) | ORM / DB transactions | Project standard |
| Next.js App Router | 14+ (project standard) | API routes + Server Components | Project standard |
| next-auth | Already installed | Session retrieval via `getServerSession` | Project standard |
| zod | Already installed (used in `app/api/customers/route.ts`) | Request body validation | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | Already installed (used in sidebar) | Icon for Ops nav item | Sidebar nav entry |
| React `useState` + `useEffect` | Built-in | Debounced typeahead state | Client component typeahead |

No new npm packages required for this phase.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prisma string for programType | Prisma enum | D-03 locked: string for consistency with MentorshipPhase pattern |
| Prisma enum for sessionType | String field | D-12 locked: string enum, validated at service/API layer |
| `useSWR` for typeahead | `useEffect` + `fetch` | SWR not installed; plain fetch with debounce is sufficient |

---

## Architecture Patterns

### Recommended Project Structure
```
prisma/
  schema.prisma          # Add 4 new models here
  seed.ts                # Add mentorship phases upsert block

lib/services/
  mentorship.service.ts  # New singleton service

app/api/ops/
  enrollments/route.ts   # POST enrollment
  sessions/route.ts      # POST session
  customers/search/route.ts  # GET typeahead

app/dashboard/ops/
  enroll/page.tsx        # Enrollment form (Server Component shell)
  enroll/EnrollForm.tsx  # Enrollment form (Client Component)

components/dashboard/
  professional-sidebar.tsx  # Add ops nav item here
```

### Pattern 1: Prisma Model Conventions (observed in schema.prisma)

**What:** Every model uses `cuid()` or `uuid()` for IDs, has `createdAt`/`updatedAt`, maps table name via `@@map()`, and indexes all FK columns via `@@index()`.

**When to use:** All four new models must follow this exactly.

```typescript
// Source: prisma/schema.prisma — observed pattern across all models
model MentorshipPhase {
  id        String   @id @default(cuid())
  key       String   @unique
  label     String
  sortOrder Int      @unique
  slaDays   Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  enrollments   MentorshipEnrollment[]
  transitions   PhaseTransition[]

  @@index([key])
  @@index([sortOrder])
  @@map("mentorship_phases")
}

model MentorshipEnrollment {
  id            String   @id @default(cuid())
  customerId    String
  assignedToId  String
  programType   String   // "PASS" | "ADVANCED"
  status        String   @default("ACTIVE") // "ACTIVE" | "COMPLETED" | "CANCELLED"
  startDate     DateTime
  cefrLevel     String?
  notes         String?
  createdById   String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  customer      Customer              @relation(fields: [customerId], references: [id])
  assignedTo    User                  @relation("EnrollmentAssignee", fields: [assignedToId], references: [id])
  createdBy     User?                 @relation("EnrollmentCreator", fields: [createdById], references: [id])
  sessions      MentorshipSession[]
  transitions   PhaseTransition[]

  @@index([customerId])
  @@index([assignedToId])
  @@index([createdById])
  @@index([status])
  @@map("mentorship_enrollments")
}

model MentorshipSession {
  id            String   @id @default(cuid())
  enrollmentId  String
  sessionType   String   // one of 11 controlled values from D-12
  conductorId   String
  sessionDate   DateTime
  notes         String?
  createdById   String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  enrollment    MentorshipEnrollment  @relation(fields: [enrollmentId], references: [id])
  conductor     User                  @relation("SessionConductor", fields: [conductorId], references: [id])
  createdBy     User?                 @relation("SessionCreator", fields: [createdById], references: [id])

  @@index([enrollmentId])
  @@index([conductorId])
  @@index([sessionDate])
  @@map("mentorship_sessions")
}

model PhaseTransition {
  id            String    @id @default(cuid())
  enrollmentId  String
  fromPhaseId   String?   // null on initial placement
  toPhaseId     String
  triggeredById String
  reason        String?
  createdAt     DateTime  @default(now())

  enrollment    MentorshipEnrollment  @relation(fields: [enrollmentId], references: [id])
  fromPhase     MentorshipPhase?      @relation("TransitionFrom", fields: [fromPhaseId], references: [id])
  toPhase       MentorshipPhase       @relation("TransitionTo", fields: [toPhaseId], references: [id])
  triggeredBy   User                  @relation("TransitionTrigger", fields: [triggeredById], references: [id])

  @@index([enrollmentId])
  @@index([toPhaseId])
  @@map("phase_transitions")
}
```

**Critical note:** `PhaseTransition` has two relations to `MentorshipPhase`. Prisma requires named relations when a model has two FK references to the same target — use `"TransitionFrom"` and `"TransitionTo"` as shown, and add reciprocal named relations on `MentorshipPhase`:

```typescript
// On MentorshipPhase, replace generic `transitions` with:
transitionsFrom PhaseTransition[] @relation("TransitionFrom")
transitionsTo   PhaseTransition[] @relation("TransitionTo")
```

**Relation names must also be added to `User`** for the three new User FK references in the new models. The `User` model currently has 9 named relations; add:

```typescript
// In User model:
mentorshipEnrollments     MentorshipEnrollment[] @relation("EnrollmentAssignee")
createdEnrollments        MentorshipEnrollment[] @relation("EnrollmentCreator")
conductedSessions         MentorshipSession[]    @relation("SessionConductor")
createdSessions           MentorshipSession[]    @relation("SessionCreator")
triggeredTransitions      PhaseTransition[]      @relation("TransitionTrigger")
```

**`Customer` model** needs one new relation:

```typescript
// In Customer model:
mentorshipEnrollments MentorshipEnrollment[]
```

### Pattern 2: Prisma Seed Script (observed in project commands)

**What:** Project has `npm run db:seed` mapping to `scripts/` or `prisma/seed.ts`. Phases seeded via `upsert` on unique key column for idempotency.

**When to use:** Seed the 11 MentorshipPhase rows.

```typescript
// Source: CLAUDE.md §Essential Commands + prisma/schema.prisma conventions
// File: prisma/seed.ts (add this block to existing seed file, or create if absent)

const phases = [
  { key: "bastao",          label: "Passagem de Bastão", sortOrder: 1,  slaDays: 3  },
  { key: "cadastro",        label: "Cadastro",           sortOrder: 2,  slaDays: 3  },
  { key: "teste_de_ingles", label: "Teste de Inglês",    sortOrder: 3,  slaDays: 7  },
  { key: "onboarding",      label: "Onboarding",         sortOrder: 4,  slaDays: 7  },
  { key: "board",           label: "Board",              sortOrder: 5,  slaDays: 7  },
  { key: "bussola",         label: "Bússola",            sortOrder: 6,  slaDays: 14 },
  { key: "raio_x",          label: "Raio X",             sortOrder: 7,  slaDays: 14 },
  { key: "material",        label: "Material",           sortOrder: 8,  slaDays: 21 },
  { key: "devolutiva",      label: "Devolutiva",         sortOrder: 9,  slaDays: 7  },
  { key: "ongoing",         label: "Ongoing",            sortOrder: 10, slaDays: 60 },
  { key: "renovacao",       label: "Renovação",          sortOrder: 11, slaDays: 14 },
];

for (const phase of phases) {
  await prisma.mentorshipPhase.upsert({
    where:  { key: phase.key },
    update: { label: phase.label, sortOrder: phase.sortOrder, slaDays: phase.slaDays },
    create: phase,
  });
}
```

### Pattern 3: Service Layer — Singleton + Transaction (observed in identity-mapper.ts + invoice-workflow.service.ts)

**What:** Stateless class exported as `const mentorshipService = new MentorshipService()`. Multi-row writes wrapped in `prisma.$transaction([...])`.

**When to use:** `createEnrollment` and `transitionPhase` both require atomicity.

```typescript
// Source: lib/services/identity-mapper.ts (singleton pattern)
//         lib/services/invoice-workflow.service.ts (transaction usage)
// File: lib/services/mentorship.service.ts

import { prisma } from "@/lib/db";

export class MentorshipService {

  // ── Enrollment ────────────────────────────────────────────
  async createEnrollment(params: {
    customerId: string;
    programType: "PASS" | "ADVANCED";
    assignedToId: string;
    startDate: Date;
    cefrLevel?: string;
    notes?: string;
    createdById: string;
  }) {
    // 1. Duplicate guard — 409 if active enrollment exists
    const existing = await prisma.mentorshipEnrollment.findFirst({
      where: { customerId: params.customerId, status: "ACTIVE" },
      select: { id: true, programType: true },
    });
    if (existing) {
      throw Object.assign(
        new Error(`This student is already enrolled in an active ${existing.programType} program.`),
        { code: "DUPLICATE_ENROLLMENT", status: 409 }
      );
    }

    // 2. Load phase 1 (bastao) — needed for initial PhaseTransition
    const bastao = await prisma.mentorshipPhase.findUnique({
      where: { key: "bastao" },
    });
    if (!bastao) throw new Error("Phase 'bastao' not seeded. Run npm run db:seed.");

    // 3. Atomic: create enrollment + initial PhaseTransition
    const [enrollment, transition] = await prisma.$transaction([
      prisma.mentorshipEnrollment.create({
        data: {
          customerId:   params.customerId,
          programType:  params.programType,
          assignedToId: params.assignedToId,
          startDate:    params.startDate,
          cefrLevel:    params.cefrLevel,
          notes:        params.notes,
          createdById:  params.createdById,
          status:       "ACTIVE",
        },
      }),
      // PhaseTransition inserted after enrollment so enrollmentId is available —
      // use prisma.$transaction with callback form for this (see note below)
    ]);
    // NOTE: The batch array form of $transaction cannot reference the result
    // of prisma.mentorshipEnrollment.create in the same array.
    // Use the INTERACTIVE (callback) form instead:
    //
    //   return prisma.$transaction(async (tx) => {
    //     const enrollment = await tx.mentorshipEnrollment.create({ data: { ... } });
    //     const transition = await tx.phaseTransition.create({
    //       data: { enrollmentId: enrollment.id, fromPhaseId: null,
    //               toPhaseId: bastao.id, triggeredById: params.createdById }
    //     });
    //     return { enrollment, transition };
    //   });
  }

  // ── Phase Transition ──────────────────────────────────────
  async transitionPhase(params: {
    enrollmentId: string;
    toPhaseKey: string;
    triggeredById: string;
    triggeredByRole: string;
    reason?: string;
  }) {
    // Load enrollment with current phase (last transition toPhaseId)
    const lastTransition = await prisma.phaseTransition.findFirst({
      where:   { enrollmentId: params.enrollmentId },
      orderBy: { createdAt: "desc" },
      include: { toPhase: true },
    });

    const currentPhase = lastTransition?.toPhase ?? null;

    const targetPhase = await prisma.mentorshipPhase.findUnique({
      where: { key: params.toPhaseKey },
    });
    if (!targetPhase) throw new Error(`Phase '${params.toPhaseKey}' not found.`);

    // Forward-only guard for non-ADMIN
    if (params.triggeredByRole !== "ADMIN" && currentPhase) {
      if (targetPhase.sortOrder !== currentPhase.sortOrder + 1) {
        throw Object.assign(
          new Error("Non-ADMIN users may only advance one phase at a time."),
          { code: "FORWARD_ONLY_VIOLATION", status: 403 }
        );
      }
    }

    return prisma.$transaction(async (tx) => {
      return tx.phaseTransition.create({
        data: {
          enrollmentId:  params.enrollmentId,
          fromPhaseId:   currentPhase?.id ?? null,
          toPhaseId:     targetPhase.id,
          triggeredById: params.triggeredById,
          reason:        params.reason,
        },
      });
    });
  }

  // ── Session Logging ───────────────────────────────────────
  async logSession(params: {
    enrollmentId: string;
    sessionType: string;
    conductorId: string;
    sessionDate: Date;
    notes?: string;
    createdById: string;
  }) {
    const VALID_SESSION_TYPES = [
      "passagem_de_bastao", "teste_de_ingles", "onboarding", "bussola",
      "raio_x", "devolutiva", "treinamento_de_entrevista", "mock_interview",
      "check_in", "renovacao", "outro",
    ] as const;

    if (!VALID_SESSION_TYPES.includes(params.sessionType as any)) {
      throw Object.assign(
        new Error(`Invalid session type: ${params.sessionType}`),
        { code: "INVALID_SESSION_TYPE", status: 400 }
      );
    }

    return prisma.mentorshipSession.create({
      data: {
        enrollmentId: params.enrollmentId,
        sessionType:  params.sessionType,
        conductorId:  params.conductorId,
        sessionDate:  params.sessionDate,
        notes:        params.notes,
        createdById:  params.createdById,
      },
    });
  }
}

export const mentorshipService = new MentorshipService();
```

**Key insight on `$transaction` variant choice:** The batch form `prisma.$transaction([...])` cannot forward the result of one operation as input to another. Because `PhaseTransition.enrollmentId` references the just-created enrollment ID, the **interactive (callback) form** `prisma.$transaction(async (tx) => { ... })` is required for `createEnrollment`. `transitionPhase` can use either form; the callback form is shown for consistency.

### Pattern 4: API Route with Role Guard (observed in app/api/customers/route.ts + app/api/dashboard/forms/assignments/route.ts)

**What:** `export const dynamic = "force-dynamic"` at top. `getServerSession(authOptions)` check first. Role check second. Zod validation third. Then service call.

```typescript
// Source: app/api/customers/route.ts + app/api/dashboard/forms/assignments/route.ts
// File: app/api/ops/enrollments/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { mentorshipService } from "@/lib/services/mentorship.service";

export const dynamic = "force-dynamic";

const OPS_ROLES = ["ADMIN", "OPERATIONAL"] as const;

const enrollmentSchema = z.object({
  customerId:   z.string().cuid(),
  programType:  z.enum(["PASS", "ADVANCED"]),
  assignedToId: z.string().cuid(),
  startDate:    z.string().datetime().optional(), // ISO 8601; defaults to now() if absent
  cefrLevel:    z.string().optional(),
  notes:        z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userRole = (session.user as any).role as string;
  if (!OPS_ROLES.includes(userRole as any)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = enrollmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.errors }, { status: 400 });
  }

  try {
    const userId = (session.user as any).id as string;
    const enrollment = await mentorshipService.createEnrollment({
      ...parsed.data,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : new Date(),
      createdById: userId,
    });
    return NextResponse.json({ enrollment }, { status: 201 });
  } catch (err: any) {
    if (err.code === "DUPLICATE_ENROLLMENT") {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("[ops/enrollments POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

### Pattern 5: Customer Typeahead Search API

**What:** Lightweight `GET` with `?q=` param. Returns minimal fields. Uses Prisma `OR` + `mode: "insensitive"` (confirmed in `app/api/customers/route.ts` line 44).

```typescript
// Source: app/api/customers/route.ts — insensitive search pattern
// File: app/api/ops/customers/search/route.ts

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userRole = (session.user as any).role as string;
  if (!["ADMIN", "OPERATIONAL"].includes(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ customers: [] });
  }

  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        { name:  { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id:             true,
      name:           true,
      email:          true,
      placementTests: {
        orderBy: { createdAt: "desc" },
        take:    1,
        select:  { cefrLevel: true },
      },
    },
    take: 10,
    orderBy: { name: "asc" },
  });

  // Flatten cefrLevel for convenience
  const result = customers.map((c) => ({
    id:        c.id,
    name:      c.name,
    email:     c.email,
    cefrLevel: c.placementTests[0]?.cefrLevel ?? null,
  }));

  return NextResponse.json({ customers: result });
}
```

### Pattern 6: Client Component Typeahead (Next.js 14 App Router, dashboard portal)

**What:** `"use client"` component with `useState` + `useEffect` debounce at 300ms. Fires fetch only when query length >= 2.

```typescript
// Source: components/dashboard/professional-sidebar.tsx — "use client" convention
// Pattern: standard React debounce via useEffect cleanup

"use client";
import { useState, useEffect } from "react";

export function CustomerTypeahead({ onSelect }: { onSelect: (c: Customer) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/ops/customers/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.customers ?? []);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer); // cleanup on next keystroke
  }, [query]);

  // Render: input + dropdown list of { name, email, cefrLevel }
}
```

**Server Component shell pattern** (page.tsx stays a Server Component for layout; form is Client Component):

```typescript
// File: app/dashboard/ops/enroll/page.tsx
import { EnrollForm } from "./EnrollForm"; // client boundary

export default function EnrollPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-display font-bold mb-6">Enrollar Estudante</h1>
      <EnrollForm />
    </div>
  );
}
```

### Pattern 7: Sidebar Nav Item Addition

**What:** Add to `mainNavItems` array in `components/dashboard/professional-sidebar.tsx`. Roles: `["ADMIN", "OPERATIONAL"]`. Import icon from lucide-react.

```typescript
// Source: components/dashboard/professional-sidebar.tsx lines 29–72
// Add after existing items or in a logical position (e.g., after Customers)

import { GraduationCap } from "lucide-react"; // suitable ops icon

// Add to mainNavItems:
{
  href:  "/dashboard/ops/enroll",
  label: "Ops Hub",
  icon:  GraduationCap,
  roles: ["ADMIN", "OPERATIONAL"],
},
```

The sidebar's `isActive` function uses `pathname.startsWith(href)` — so the single entry `/dashboard/ops/enroll` will match all future `/dashboard/ops/*` sub-routes correctly when Phase 15/16/17 are added. No structural changes needed.

### Pattern 8: Middleware — Ops Route Coverage (already implemented)

**What:** `middleware.ts` lines 84–98 already handle `/ops/*` and `/api/ops/*` with ADMIN/OPERATIONAL gate. **No middleware changes required.**

**Confirmed from middleware.ts:**
```typescript
// Already in place — DO NOT modify
if (pathname.startsWith("/ops") || pathname.startsWith("/api/ops")) {
  const token = await getToken({ req: request });
  if (!token) return NextResponse.redirect(new URL("/ops/login", request.url));
  const userRole = token.role as UserRole;
  if (!["ADMIN", "OPERATIONAL"].includes(userRole)) {
    return NextResponse.redirect(new URL("/?error=access_denied", request.url));
  }
  return NextResponse.next();
}
```

The ops routes at `/api/ops/*` are protected at middleware level. Each route handler still performs its own `getServerSession` + role check per project convention (defence in depth, consistent with how `/api/dashboard/*` routes work).

However, the `/dashboard/ops/*` path prefix is NOT in the middleware `routeRoleMap`. The middleware currently only protects `/dashboard/*` against the `routeRoleMap` list — if a prefix is not in the list, it passes through (only requiring a valid token). Two options:

1. **Add `/dashboard/ops` to `routeRoleMap`** — recommended, keeps RBAC at the middleware layer.
2. **Gate at the page level** — the page/layout does `getServerSession` + redirect.

Option 1 is consistent with how other dashboard routes work. Add to `routeRoleMap`:
```typescript
{ prefix: "/dashboard/ops", roles: ["ADMIN", "OPERATIONAL"] },
```

### Anti-Patterns to Avoid
- **Using the batch `$transaction([...])` form when enrollment ID is needed mid-transaction.** The batch form executes operations in a single query batch but cannot forward result values. Use the callback form: `prisma.$transaction(async (tx) => { ... })`.
- **Fetching `PhaseTransition` list and sorting in JS to find current phase.** Use `findFirst` with `orderBy: { createdAt: "desc" }` at the DB level.
- **Firing typeahead fetch on every keystroke.** Always debounce 300ms and guard on `query.length >= 2`.
- **Missing `export const dynamic = "force-dynamic"` on route handlers.** This project uses it on all data routes (observed in `app/api/customers/route.ts` and `app/api/dashboard/forms/assignments/route.ts`).
- **Forgetting named relations on `MentorshipPhase` for `fromPhase`/`toPhase`.** Prisma will reject the schema if two FK columns on `PhaseTransition` point to the same model without named relation annotations on both sides.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request body validation | Custom type guards | `zod` (already installed) | Type-safe, consistent error format across codebase |
| Debounce | Custom debounce utility | `useEffect` cleanup + `setTimeout` | No new dependency; 5-line pattern is sufficient |
| Auth session check | Custom JWT decode | `getServerSession(authOptions)` | Already the project standard |
| Duplicate enrollment check | Application-level UUID comparison | `prisma.findFirst({ where: { status: "ACTIVE" } })` | DB-level uniqueness is authoritative |

**Key insight:** All infrastructure (auth, DB, validation, transactions) is already installed. This phase is purely additive schema + service + UI work.

---

## Common Pitfalls

### Pitfall 1: Dual-FK Relation to Same Model (PhaseTransition → MentorshipPhase)
**What goes wrong:** Prisma schema validation error: "Ambiguous relation detected." at `prisma db push` or `prisma generate`.
**Why it happens:** `fromPhaseId` and `toPhaseId` both reference `MentorshipPhase`. Without named relations, Prisma cannot determine which FK maps to which back-relation.
**How to avoid:** Use `@relation("TransitionFrom", ...)` and `@relation("TransitionTo", ...)` on both FK sides, and add matching `transitionsFrom PhaseTransition[] @relation("TransitionFrom")` and `transitionsTo PhaseTransition[] @relation("TransitionTo")` on `MentorshipPhase`.
**Warning signs:** `prisma generate` exits with "Ambiguous relation" error.

### Pitfall 2: Batch Transaction Cannot Forward Enrollment ID
**What goes wrong:** `prisma.$transaction([create enrollment, create transition])` — the transition `create` call must reference `enrollmentId` from the enrollment `create`, but the batch form evaluates both before executing.
**Why it happens:** The batch form `prisma.$transaction([op1, op2])` submits all operations together; `op2` cannot use the result of `op1`.
**How to avoid:** Use the callback form: `prisma.$transaction(async (tx) => { const e = await tx.mentorshipEnrollment.create(...); await tx.phaseTransition.create({ data: { enrollmentId: e.id, ... } }); return e; })`.
**Warning signs:** TypeScript error trying to reference `enrollment.id` in the batch array.

### Pitfall 3: Missing `force-dynamic` on Ops Route Handlers
**What goes wrong:** Route handlers return stale cached responses in Vercel production builds.
**Why it happens:** Next.js 14 App Router can statically cache route handlers unless opted out.
**How to avoid:** Add `export const dynamic = "force-dynamic"` at the top of every route file — consistent with the rest of the codebase.

### Pitfall 4: Seed Not Idempotent
**What goes wrong:** Running `npm run db:seed` a second time throws unique constraint violations on `key` or `sortOrder`.
**Why it happens:** `prisma.mentorshipPhase.create()` fails if a row with that key already exists.
**How to avoid:** Always use `upsert` on the `key` unique field in the seed script.

### Pitfall 5: `/dashboard/ops` Not in routeRoleMap
**What goes wrong:** A user with SALES role can navigate to `/dashboard/ops/enroll` directly — middleware lets them through because the prefix is not in `routeRoleMap`.
**Why it happens:** `routeRoleMap` in `middleware.ts` checks prefixes in order; unmatched prefixes fall through to `NextResponse.next()` (only valid token required).
**How to avoid:** Add `{ prefix: "/dashboard/ops", roles: ["ADMIN", "OPERATIONAL"] }` to `routeRoleMap`.

### Pitfall 6: Forward-Only Check Ignores Null Current Phase
**What goes wrong:** `currentPhase.sortOrder + 1` throws when `currentPhase` is null (e.g., the enrollment has no transitions yet — which should never happen post-D-08, but defensive coding matters).
**Why it happens:** Race condition or manual DB intervention leaves enrollment without transitions.
**How to avoid:** Null-check `currentPhase` before applying the sortOrder guard; treat null current phase as sortOrder 0 (so only `bastao` at sortOrder 1 passes the check).

---

## Code Examples

### Verified Pattern: Prisma interactive transaction
```typescript
// Source: Prisma documentation pattern; used consistently in this codebase
// (invoice-workflow.service.ts uses sequential awaits on prisma; $transaction callback
//  is the correct upgrade for atomicity)

const result = await prisma.$transaction(async (tx) => {
  const enrollment = await tx.mentorshipEnrollment.create({ data: { ... } });
  await tx.phaseTransition.create({
    data: {
      enrollmentId:  enrollment.id,
      fromPhaseId:   null,
      toPhaseId:     bastao.id,
      triggeredById: createdById,
    },
  });
  return enrollment;
});
```

### Verified Pattern: getServerSession usage (from app/api/customers/route.ts and layout.tsx)
```typescript
const session = await getServerSession(authOptions);
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const userId = (session.user as any).id as string;
const userRole = (session.user as any).role as string;
```

### Verified Pattern: Zod safeParse for API validation (from app/api/customers/route.ts)
```typescript
const parsed = schema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json({ error: "Invalid request", details: parsed.error.errors }, { status: 400 });
}
```

---

## Environment Availability

Step 2.6: SKIPPED — Phase 14 is purely internal code/schema changes. No external services, CLI tools, or third-party APIs are required. All dependencies (Prisma, Next.js, NextAuth, Zod) are already installed in the project.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no `jest.config.*`, `vitest.config.*`, or `pytest.ini` found in project |
| Config file | None — Wave 0 must create |
| Quick run command | (none until framework installed) |
| Full suite command | (none until framework installed) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | 11 phases seeded correctly with keys/sortOrder/slaDays | unit | N/A — Wave 0 gap | No |
| DATA-02 | `createEnrollment` persists enrollment + initial transition atomically | unit | N/A — Wave 0 gap | No |
| DATA-03 | `transitionPhase` records PhaseTransition row; forward-only enforced for non-ADMIN | unit | N/A — Wave 0 gap | No |
| DATA-04 | `logSession` persists session with valid type; rejects invalid type | unit | N/A — Wave 0 gap | No |
| ENRL-01 | POST /api/ops/enrollments returns 201 on valid payload; 409 on duplicate active enrollment | integration | N/A — Wave 0 gap | No |
| ENRL-02 | GET /api/ops/customers/search returns matching customers at 2+ chars; empty array below threshold | integration | N/A — Wave 0 gap | No |

**Note:** The project has no test framework installed. Given that this is a pure backend + schema phase with no complex branching logic beyond what's already audited, the planner should treat Wave 0 as installing Vitest (zero-config for Next.js TypeScript projects) and writing a minimal service unit test for `createEnrollment` duplicate guard and `transitionPhase` forward-only logic.

### Wave 0 Gaps
- [ ] `package.json` — add `vitest`, `@vitest/coverage-v8`, `@testing-library/react` devDependencies
- [ ] `vitest.config.ts` — base config pointing at `lib/` and `app/api/`
- [ ] `__tests__/mentorship.service.test.ts` — covers DATA-02, DATA-03, DATA-04 (mock Prisma client)
- [ ] `__tests__/api/ops-enrollments.test.ts` — covers ENRL-01 (mock service + session)

---

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` — all model conventions, relation patterns, index conventions observed directly
- `middleware.ts` — confirmed `/api/ops/*` is already protected by ADMIN/OPERATIONAL gate
- `components/dashboard/professional-sidebar.tsx` — confirmed `mainNavItems` structure, icon imports, role filtering
- `app/api/customers/route.ts` — confirmed `mode: "insensitive"` search pattern, Zod usage, `getServerSession` pattern
- `app/api/dashboard/forms/assignments/route.ts` — confirmed `export const dynamic = "force-dynamic"` and session check pattern
- `lib/auth.ts` — confirmed `session.user.id`, `session.user.role` shape
- `lib/services/identity-mapper.ts` — confirmed singleton export pattern
- `lib/services/invoice-workflow.service.ts` — confirmed service class structure
- `.planning/phases/14-data-foundation/14-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)
- Prisma documentation on named relations (two FKs to same model) — well-established constraint, consistent with schema.prisma conventions observed

---

## Metadata

**Confidence breakdown:**
- Schema design: HIGH — derived directly from reading the existing schema and all conventions
- Transaction pattern: HIGH — `$transaction` callback form is the established Prisma pattern for sequential dependent writes; confirmed Prisma docs pattern
- API route patterns: HIGH — copied from existing routes in the codebase
- Middleware coverage: HIGH — read middleware.ts directly; ops routes already handled
- Sidebar addition: HIGH — read sidebar component directly; single array entry addition
- Test framework: MEDIUM — no test infra exists; Vitest recommendation based on Next.js 14 TypeScript compatibility

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable libraries, no external dependencies)
