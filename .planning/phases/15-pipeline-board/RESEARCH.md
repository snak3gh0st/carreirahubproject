# Phase 15: Pipeline Board - Research

**Researched:** 2026-04-01
**Domain:** Kanban UI with drag-and-drop, Next.js App Router, Prisma query design
**Confidence:** HIGH

---

## Summary

Phase 15 builds the Kanban pipeline view on top of the data foundation shipped in Phase 14.
All four mentorship models (`MentorshipPhase`, `MentorshipEnrollment`, `PhaseTransition`,
`MentorshipSession`) and `mentorshipService.advancePhase()` already exist. The board must
render 11 columns (one per phase), display student cards with SLA age and debtor status, and
support drag-to-advance with a confirmation step.

dnd-kit is the correct choice for drag-and-drop (specified in roadmap, React-ecosystem
standard for 2024-2026). It is NOT installed yet — `@dnd-kit/core`, `@dnd-kit/sortable`, and
`@dnd-kit/utilities` must be added. With a maximum of ~50–80 active students at any time,
virtualization is not required. A single wide horizontal scroll container is sufficient.

The debtor flag source already exists on the `Customer` model as `qbBalance` (Decimal,
nullable). A positive `qbBalance` means an outstanding QB balance — treat `qbBalance > 0` as
the debtor indicator. No additional QB API calls are needed at render time.

**Primary recommendation:** Install dnd-kit, build a Client Component board that fetches via
a single `/api/ops/pipeline` route returning all active enrollments grouped by phase, wire
drag-end and advance-button to `POST /api/ops/enrollments/[id]/advance`, and sync URL filter
state with `useRouter` + `useSearchParams`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PIPE-01 | All active enrollments appear in a Kanban board, one column per phase; cards show name, program badge, phase age in days, assignee initials | Single `/api/ops/pipeline` query with `include` on `currentPhase`, `customer`, `assignedTo`; phase age = `now() - latestTransition.createdAt` |
| PIPE-02 | Drag-to-next-phase or advance button; transition recorded atomically with confirmation step | `mentorshipService.advancePhase()` already atomic; new `POST /api/ops/enrollments/[id]/advance` route; Radix Dialog for confirmation |
| PIPE-03 | "My students" filter hides others; URL reflects active filter (bookmarkable) | `useSearchParams` + `useRouter.push` pattern in Next.js App Router; filter `?assignee=me` in URL |
| PIPE-04 | Cards with phase age > `slaDays` show amber/red overdue indicator | Compute `phaseAgeDays = differenceInDays(now, lastTransitionDate)`; compare to `currentPhase.slaDays` from the API response |
| PIPE-05 | Cards for customers with overdue QB balance show debtor flag badge | `customer.qbBalance` is already on the Customer row (Decimal, nullable); treat `qbBalance > 0` as debtor |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- **Portal separation**: Pipeline board belongs to the Admin Dashboard portal. Routes live at
  `/ops/*` (under `/dashboard/ops/*` parent layout per CLAUDE.md file structure, but Phase 14
  chose `/ops/*` under a dedicated ops layout — follow Phase 14 convention).
- **API routes**: New ops API routes live at `/api/ops/*`, restricted to ADMIN and OPERATIONAL
  roles using `getServerSession` + role check (same pattern as `/api/ops/enrollments/route.ts`).
- **Service layer**: Business logic stays in `mentorship.service.ts`; API routes are thin.
- **Path alias**: Use `@/` for all imports.
- **TypeScript strict mode**: All new code must be strictly typed.
- **No duplicate customer data**: Debtor flag reads from `customer.qbBalance` — do not call QB
  API at render time. The field is kept current by the existing QB sync cron.
- **Queue workers don't run on Vercel**: No BullMQ workers for UI interactions; call the
  service directly from API routes.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@dnd-kit/core` | 6.3.1 | DnD sensor management, collision detection, drag overlay | The maintained React DnD library; react-beautiful-dnd is deprecated/unmaintained |
| `@dnd-kit/sortable` | 10.0.0 | Sortable context and hooks (`useSortable`) | Simplifies column-to-column moves; built on top of @dnd-kit/core |
| `@dnd-kit/utilities` | 3.2.2 | CSS transform helpers (`CSS.Transform.toString`) | Required companion for sortable transforms |
| `@tanstack/react-query` | ^5.90 (already installed) | Client-side data fetching with stale-while-revalidate | Already in project; used in BI dashboard (Phase 4) |
| `date-fns` | ^3.6 (already installed) | `differenceInDays`, `formatDistanceToNow` for phase age | Already in project |
| `sonner` | ^2.0 (already installed) | Toast for transition success/error | Already in project |
| `@radix-ui/react-dialog` | ^1.1 (already installed) | Confirmation modal before phase advance | Already in project |

### Not Needed
| Skipped | Reason |
|---------|--------|
| `react-beautiful-dnd` | Deprecated; no React 18 support |
| `react-dnd` | Heavier API; dnd-kit is the current standard |
| Virtual scrolling (`@tanstack/react-virtual`) | Max ~80 active students; 11 columns × 8 cards = manageable DOM |

**Installation (new packages only):**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Verified versions against npm registry (2026-04-01):
- `@dnd-kit/core` → 6.3.1
- `@dnd-kit/sortable` → 10.0.0
- `@dnd-kit/utilities` → 3.2.2

---

## Architecture Patterns

### Recommended File Structure
```
app/
  ops/
    pipeline/
      page.tsx              ← Server Component shell (auth check, passes phases list)
      PipelineBoard.tsx     ← 'use client' — DnD context, column layout
      StudentCard.tsx       ← 'use client' — draggable card, badges, indicators
      AdvanceDialog.tsx     ← 'use client' — Radix Dialog confirmation
      usePipelineData.ts    ← React Query hook (fetches /api/ops/pipeline)

app/
  api/
    ops/
      pipeline/
        route.ts            ← GET — all active enrollments grouped by phase
      enrollments/
        [id]/
          advance/
            route.ts        ← POST — calls mentorshipService.advancePhase()
```

### Pattern 1: Single Pipeline Query

Fetch all 11 phases with their enrollments in one query. Return phases as an ordered array
so the board can render columns in `sortOrder` sequence without client-side sorting.

```typescript
// app/api/ops/pipeline/route.ts
// Source: Prisma docs — nested include with orderBy

export async function GET(req: NextRequest) {
  // auth check (same as enrollments route) ...

  const phases = await prisma.mentorshipPhase.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      enrollments: {
        where: { status: "ACTIVE" },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              qbBalance: true,
            },
          },
          assignedTo: {
            select: { id: true, name: true },
          },
          // Need the last transition to compute phase age
          transitions: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  return NextResponse.json(phases);
}
```

This returns an array of 11 phase objects, each with an `enrollments` array. The client
renders one column per phase. Empty phases render as empty columns (all 11 always visible).

### Pattern 2: Phase Age Calculation

Phase age = days since the student entered the CURRENT phase (not enrollment start).
The last `PhaseTransition` record where `toPhaseId === enrollment.currentPhaseId` gives the
entry timestamp.

The query above fetches `transitions` ordered by `createdAt desc, take: 1` per enrollment.
The client then computes:

```typescript
// Source: date-fns docs — differenceInDays
import { differenceInDays } from "date-fns";

function getPhaseAgeDays(lastTransitionCreatedAt: string): number {
  return differenceInDays(new Date(), new Date(lastTransitionCreatedAt));
}

function isOverdue(phaseAgeDays: number, slaDays: number): boolean {
  return phaseAgeDays > slaDays;
}
```

The `slaDays` value comes from the phase object already in the response — no extra query.

### Pattern 3: dnd-kit Column-to-Column Drag

dnd-kit's `DndContext` wraps the board. Each column is a `droppable`. Each card is a
`draggable`. On `onDragEnd`, extract `active.id` (enrollmentId) and `over.id` (phaseId).

```typescript
// Source: dnd-kit docs — DndContext onDragEnd
import { DndContext, DragEndEvent, closestCenter } from "@dnd-kit/core";

function PipelineBoard({ phases }) {
  const [pendingMove, setPendingMove] = useState<{
    enrollmentId: string;
    toPhaseId: string;
    toPhaseLabel: string;
  } | null>(null);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // active.id = enrollmentId, over.id = phaseId (set on droppable)
    const enrollment = findEnrollmentById(String(active.id));
    const targetPhase = phases.find(p => p.id === String(over.id));
    if (!enrollment || !targetPhase) return;
    // Open confirmation dialog instead of immediately advancing
    setPendingMove({
      enrollmentId: String(active.id),
      toPhaseId: String(over.id),
      toPhaseLabel: targetPhase.label,
    });
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      {phases.map(phase => (
        <PhaseColumn key={phase.id} phase={phase} enrollments={phase.enrollments} />
      ))}
      <AdvanceDialog
        pending={pendingMove}
        onConfirm={handleConfirmAdvance}
        onCancel={() => setPendingMove(null)}
      />
    </DndContext>
  );
}
```

### Pattern 4: Advance API Route

Wire the advance dialog confirm to `POST /api/ops/enrollments/[id]/advance`. This calls
`mentorshipService.advancePhase()` which is already atomic (single Prisma transaction).

```typescript
// app/api/ops/enrollments/[id]/advance/route.ts
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  // ... role check (ADMIN | OPERATIONAL) ...

  const { toPhaseId } = await req.json();
  const result = await mentorshipService.advancePhase({
    enrollmentId: params.id,
    toPhaseId,
    triggeredById: userId,
    triggeredByRole: userRole,
  });
  return NextResponse.json(result);
}
```

The service enforces forward-only for OPERATIONAL users and accepts any transition for ADMIN.
Error code `INVALID_TRANSITION` maps to HTTP 422. The drag-end handler only populates
`pendingMove` when the target column is `currentPhase.sortOrder + 1` (or any for ADMIN) —
validate on the client too so invalid drops fail silently before the dialog opens.

### Pattern 5: URL Filter State (bookmarkable "My students")

Use Next.js App Router `useSearchParams` + `useRouter` in the Client Component. The filter
is a query param `?assignee=me`. No server-side filtering needed — the client hides cards
that don't match. This avoids a re-fetch on filter toggle.

```typescript
// Source: Next.js App Router docs — useSearchParams, useRouter
"use client";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

function FilterBar({ currentUserId }: { currentUserId: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isMyStudents = searchParams.get("assignee") === "me";

  function toggleFilter() {
    const params = new URLSearchParams(searchParams.toString());
    if (isMyStudents) {
      params.delete("assignee");
    } else {
      params.set("assignee", "me");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <button onClick={toggleFilter}>
      {isMyStudents ? "Todos os alunos" : "Meus alunos"}
    </button>
  );
}
```

Card visibility: `if (isMyStudents && card.assignedTo.id !== currentUserId) return null`.
Filter logic stays entirely on the client — no API change needed.

**IMPORTANT:** Any component using `useSearchParams` must be wrapped in a `<Suspense>`
boundary. Omitting this causes a CSR bailout warning in Next.js 14 and a build error in
strict mode.

```typescript
// page.tsx
import { Suspense } from "react";
export default function PipelinePage() {
  return (
    <Suspense fallback={<PipelineSkeleton />}>
      <PipelineBoard />
    </Suspense>
  );
}
```

### Pattern 6: Debtor Flag

`customer.qbBalance` is a `Decimal` stored on the Customer row. The pipeline API query
selects it. On the client, treat `Number(qbBalance) > 0` as debtor.

```typescript
// StudentCard.tsx
const isDebtor = customer.qbBalance !== null && Number(customer.qbBalance) > 0;
```

No QB API call at render time. The existing `quickbooks-sync` cron (every 6 hours) keeps
`qbBalance` current. Display a red badge "Devedor" alongside the student name when true.

### Anti-Patterns to Avoid

- **Re-fetching on every drag**: Use optimistic updates with React Query's `useMutation` +
  `queryClient.setQueryData` to move the card immediately; roll back on API error.
- **Fetching enrollment data per-card**: One query for all phases, not N queries.
- **Putting DnD in a Server Component**: `DndContext` requires browser APIs. The entire board
  is `'use client'`. The `page.tsx` can be a thin Server Component that passes `session.user`
  down as props.
- **Blocking drag to non-adjacent phases for OPERATIONAL users in the UI**: Validate on
  client before opening the dialog; don't rely only on the API 422.
- **`useSearchParams` without Suspense**: Build will warn/fail in Next.js 14+.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop sensors (mouse, touch, keyboard) | Custom event listeners | `@dnd-kit/core` sensors | Accessibility, touch, keyboard a11y are complex |
| Drag ghost/overlay | Custom CSS clone | `DragOverlay` from `@dnd-kit/core` | Handles portal rendering, avoids z-index issues |
| Confirmation dialog | Custom modal | `@radix-ui/react-dialog` (already installed) | Already in project, accessible |
| SLA date math | Custom diff logic | `date-fns differenceInDays` (already installed) | DST-safe, already in project |
| Toast feedback | Custom notification | `sonner` (already installed) | Already in project |

---

## Common Pitfalls

### Pitfall 1: Async params in Next.js 14 App Router
**What goes wrong:** `params` in route handlers must be awaited in Next.js 15; in Next.js 14
(this project) they are synchronous. Accessing `params.id` directly is correct here.
**How to avoid:** Check `next` version in `package.json` — it is `^14.2.0` — do NOT
`await params`.

### Pitfall 2: dnd-kit sortOrder mismatch
**What goes wrong:** `@dnd-kit/sortable` version 10 (installed) has a different API surface
than version 7 examples commonly found in tutorials. The `useSortable` hook interface is the
same, but the `SortableContext` items array must contain **string** IDs — passing objects
causes silent failures.
**How to avoid:** `<SortableContext items={enrollments.map(e => e.id)}>`.

### Pitfall 3: DragOverlay z-index fighting the sidebar
**What goes wrong:** The ops sidebar is `fixed inset-y-0 left-0 z-30`. A default
`DragOverlay` renders at a lower z-index and slides under the sidebar.
**How to avoid:** Set `style={{ zIndex: 50 }}` on `<DragOverlay>`.

### Pitfall 4: qbBalance is Decimal — JSON serialization
**What goes wrong:** Prisma returns `Decimal` objects. `JSON.stringify` converts them to
strings (e.g., `"125.00"`), not numbers. Parsing `Number(qbBalance)` in the client component
works correctly regardless.
**How to avoid:** `Number(customer.qbBalance) > 0` — not `customer.qbBalance > 0` (type
error in TypeScript strict mode).

### Pitfall 5: 11 droppable columns and collision detection
**What goes wrong:** `closestCenter` collision algorithm works well for sortable lists but
can misfire when dragging across a horizontal Kanban — a card held near column 3's right edge
might register as dropping on column 4.
**How to avoid:** Use `closestCorners` or `rectIntersection` for the outer DnD context (over
phases). Reserve `closestCenter` for within-column sortable contexts if needed.

### Pitfall 6: Optimistic update rollback on INVALID_TRANSITION
**What goes wrong:** Client moves card to column visually, API returns 422, card stays in
wrong column until refetch.
**How to avoid:** In React Query `useMutation.onError`, call
`queryClient.setQueryData` to restore the previous snapshot captured in `onMutate`.

---

## QB Payment Balance — Debtor Check Details

`Customer.qbBalance` (schema line 58):
```
qbBalance  Decimal?  @db.Decimal(10, 2)
```

This field is populated/refreshed by the QB sync cron at `/api/cron/quickbooks-sync`.
It represents the **current outstanding balance** in QuickBooks. A non-null positive value
means the customer owes money.

Logic for debtor flag:
- `qbBalance === null` → unknown / not synced → no badge
- `qbBalance <= 0` → no outstanding balance → no badge
- `qbBalance > 0` → debtor badge shown (red, label "Devedor")

No additional QuickBooks API call is needed. The pipeline API query already includes
`customer: { select: { qbBalance: true } }`.

---

## SLA Overdue Calculation Details

The `MentorshipPhase.slaDays` field (seeded with values from 3 to 60 days per D-02) defines
the expected maximum duration per phase.

Phase age is calculated from the **latest `PhaseTransition` where `toPhaseId = currentPhaseId`**,
which is the moment the student entered the current phase. The pipeline query fetches
`transitions: { orderBy: { createdAt: 'desc' }, take: 1 }` which gives exactly this record.

```
phaseAgeDays = differenceInDays(now, transitions[0].createdAt)
```

Visual indicators:
- `phaseAgeDays <= slaDays * 0.75` → no indicator
- `phaseAgeDays > slaDays * 0.75 && <= slaDays` → amber warning (approaching SLA)
- `phaseAgeDays > slaDays` → red overdue indicator

The 0.75 threshold (approaching SLA) is a UX recommendation — not required by PIPE-04 which
only specifies "exceeding the SLA threshold". Implement the red indicator first; amber is a
nice-to-have within the same task.

---

## API Design Summary

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/ops/pipeline` | GET | All 11 phases with active enrollments, customer name/qbBalance, assignee, last transition | ADMIN, OPERATIONAL |
| `/api/ops/enrollments/[id]/advance` | POST | Advance enrollment to next phase (calls `mentorshipService.advancePhase`) | ADMIN, OPERATIONAL |

The `GET /api/ops/pipeline` route does NOT filter by assignee — filtering is client-side
(URL param `?assignee=me`) to avoid two separate API endpoints and keep the board
instantaneously filterable without a new network request.

---

## Environment Availability

Step 2.6: SKIPPED — Phase is purely code/UI changes. No new external services, CLIs, or
runtimes required beyond the existing stack (Postgres/Neon, Vercel, Node.js). New npm
packages (`@dnd-kit/*`) install from the public registry with no credentials.

---

## Validation Architecture

`workflow.nyquist_validation` is absent from `.planning/config.json` — treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no pytest.ini, jest.config, vitest.config, or test/ directory found |
| Config file | None |
| Quick run command | N/A — Wave 0 must add test infrastructure if desired |
| Full suite command | N/A |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PIPE-01 | Pipeline API returns all 11 phases with active enrollments | manual (browser) | — | ❌ |
| PIPE-02 | Phase advance writes PhaseTransition atomically | manual (browser) | — | ❌ |
| PIPE-03 | URL `?assignee=me` filter hides unassigned cards | manual (browser) | — | ❌ |
| PIPE-04 | Overdue indicator shows when phaseAgeDays > slaDays | manual (browser) | — | ❌ |
| PIPE-05 | Debtor badge shows when qbBalance > 0 | manual (browser) | — | ❌ |

This project has no automated test infrastructure. All requirements are validated manually
in the browser. No Wave 0 test setup needed unless the team wants to add it.

### Wave 0 Gaps
None — project does not use automated testing.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-beautiful-dnd | @dnd-kit/core | 2022 (rbd deprecated) | Must use dnd-kit |
| `useRouter().query` (Pages Router) | `useSearchParams()` (App Router) | Next.js 13 | Different hook — use `useSearchParams` |
| Synchronous params | Async params (Next.js 15) | Next.js 15 | NOT applicable here (project is Next.js 14) |

---

## Open Questions

1. **Phase 11 status: is it complete?**
   - Roadmap shows Phase 11 complete but Phase 12 not started. The ops portal appears to be
     using brand tokens (`bg-brand-verde`, `text-brand-tangerina`) already — safe to proceed.

2. **Confirmation dialog: what text?**
   - Not specified in requirements. Recommend: "Mover [Student Name] para [Phase Label]?"
     with Confirmar / Cancelar buttons. Planner should make this a task detail.

3. **Does ops portal use the same auth session as dashboard?**
   - Yes — `app/ops/` uses `getServerSession(authOptions)` with NextAuth, same as dashboard.
     The `app/ops/layout.tsx` should already enforce role check. Verify before implementing
     the pipeline page.

---

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` — MentorshipEnrollment, MentorshipPhase, PhaseTransition, Customer.qbBalance — direct source read
- `lib/services/mentorship.service.ts` — advancePhase() signature and behavior — direct source read
- `app/api/ops/enrollments/route.ts` — auth pattern, role check pattern — direct source read
- `package.json` — installed packages, missing dnd-kit — direct source read
- npm registry (`npm view @dnd-kit/core version`) — verified versions 6.3.1 / 10.0.0 / 3.2.2

### Secondary (MEDIUM confidence)
- dnd-kit docs pattern (DndContext, DragOverlay, useSortable) — widely documented, stable API
- Next.js App Router `useSearchParams` + Suspense requirement — documented Next.js 14 behavior

### Tertiary (LOW confidence)
- `closestCorners` vs `closestCenter` recommendation for horizontal Kanban — common community
  guidance, not from official dnd-kit docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified against npm registry
- Architecture: HIGH — service layer and schema already exist; patterns follow established codebase conventions
- Pitfalls: MEDIUM — dnd-kit API notes based on version numbers from registry, not full doc read; verify sortable v10 API surface during implementation
- QB debtor logic: HIGH — field exists in schema with correct semantics
- SLA calculation: HIGH — all required fields (slaDays, transition timestamps) are present in schema

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable libraries; dnd-kit has not had breaking changes in 6+ months)
