# Phase 17: Daily Action View + Coordinator Overview - Research

**Researched:** 2026-04-01
**Domain:** Next.js 14 App Router — server components, React Query polling, Prisma aggregations, role-based page visibility
**Confidence:** HIGH

## Summary

Phase 17 delivers two new Ops Hub pages built entirely on patterns already established in Phases 14-16. The daily action view (`/ops/daily`) computes two flag conditions from existing Prisma models — SLA expiry (derived from the most recent `PhaseTransition.createdAt`) and session inactivity (derived from `MentorshipSession.sessionDate`) — and filters by `assignedToId` for OPERATIONAL users or returns all for ADMIN. The coordinator page (`/ops/coordinator`) is ADMIN-only and reuses the phase distribution query from `app/ops/page.tsx` plus a `qbBalance > 0` filter already supported by the `Customer` model.

The coordinator page requires React Query (`@tanstack/react-query` v5, already in `package.json`) for 60-second polling of the phase distribution section. Everything else is a standard Next.js 14 server component backed by a Route Handler. The sidebar needs conditional rendering driven by the role prop, which requires passing `userRole` down from `OpsLayout` to `OpsSidebar`.

**Primary recommendation:** Build two Route Handlers (`/api/ops/daily`, `/api/ops/coordinator`) that compute flag logic server-side in Prisma, render the pages as server components for initial load, and layer React Query client polling only on the coordinator's phase distribution table.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Route Architecture**
- Daily action view: `/ops/daily` (clean separation, dedicated URL, bookmarkable)
- Coordinator overview: `/ops/coordinator` (ADMIN-only)
- Coordinator metrics (phase distribution + overdue QB): on same `/ops/coordinator` page below flagged list
- Sidebar nav entries: "Daily Actions" for all ADMIN|OPERATIONAL users; "Coordinator" only visible when role=ADMIN

**SLA & Flag Logic**
- Default SLA per phase: 7 calendar days
- Both flags simultaneously: show both badge reasons, highlight SLA as more urgent
- SLA thresholds in named constants: `lib/constants/sla.ts`
- Session check: latest `MentorshipSession.sessionDate` (or `createdAt`) across all session entries for the enrollment

**UI Design — Daily Action View**
- Flagged student row: compact list row (name, phase, flag badge, days remaining/overdue, direct profile link)
- Flag badge colors: Red for SLA expiring, Amber for no recent session
- Empty state: "Tudo certo hoje! ✓" green success banner
- Header stat: "X alunos precisam de atenção" count

**Coordinator Overview**
- Phase distribution: reuse table pattern from ops home page
- QB overdue definition: `qbBalance > 0`
- React Query polling: `useQuery` with `refetchInterval: 60_000` on coordinator page only
- Coordinator access: ADMIN role only — OPERATIONAL sidebar link hidden; server-side redirect if accessed directly

### Claude's Discretion
- Exact Portuguese labels for new sidebar entries and page headings
- API route structure for daily action endpoint (`/api/ops/daily` or similar)
- How to handle `assignedTo` null for an enrollment (exclude from per-user daily view, include in coordinator view)

### Deferred Ideas (OUT OF SCOPE)
- WhatsApp/Slack notifications for flagged students
- Per-phase configurable SLA thresholds
- Export/CSV of flagged students list
- Email digest of daily actions
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DAILY-01 | Ops team member sees daily action list scoped to their assigned students requiring attention | `assignedToId` filter on `MentorshipEnrollment`; user ID from `getServerSession` |
| DAILY-02 | Daily action view flags students whose current phase SLA expires within 2 days | `PhaseTransition.createdAt` (most recent) + `SLA_DAYS_PER_PHASE` constant; date arithmetic server-side |
| DAILY-03 | Daily action view flags students who have had no session in past 7 days | `MentorshipSession.sessionDate` max per enrollment; compare against `now - 7 days` |
| COORD-01 | Coordinator sees phase distribution — count of active students per phase | Reuse `phaseCounts` query from `app/ops/page.tsx`; expose via `/api/ops/coordinator` |
| COORD-02 | Coordinator sees all active enrollments regardless of assigned team member | Same flag query as DAILY-01/02/03 but without `assignedToId` filter |
| COORD-03 | Coordinator sees list of students with no session activity in past 7 days | Subset of coordinator flag list where flag includes `no_recent_session` |
| COORD-04 | Coordinator sees list of students with overdue QB payment balances | `customer.qbBalance > 0` filter on active enrollments |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 14.2.x (in use) | Server components, Route Handlers | Project standard |
| Prisma | in use | DB queries for flag computation | Project ORM |
| `@tanstack/react-query` | ^5.90.17 (in package.json) | 60s polling on coordinator page | Already installed |
| NextAuth | in use | `getServerSession` for role/user ID | Project auth |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | in use | Icons for flag badges and sidebar nav | All UI icons |
| tailwindcss brand tokens | in use | `text-red-600`, `text-amber-500`, `bg-brand-verde` | Flag badge colors |

**Installation:** No new packages required. All dependencies already present.

---

## Architecture Patterns

### Recommended Project Structure
```
app/
  ops/
    daily/
      page.tsx          ← Server component, fetches via /api/ops/daily
    coordinator/
      page.tsx          ← Server component for initial load
      PhaseDistribution.tsx  ← Client component with React Query polling
lib/
  constants/
    sla.ts              ← SLA_DAYS_PER_PHASE = 7, SLA_WARNING_DAYS = 2
app/api/ops/
  daily/
    route.ts            ← GET: returns flagged enrollments (scoped or all)
  coordinator/
    route.ts            ← GET: returns phase distribution + QB debtors
components/ops/
  ops-sidebar.tsx       ← Extended with role-conditional nav items
```

### Pattern 1: Flag Computation in Route Handler

The flag logic is a server-side date calculation. Compute once in the Route Handler, return pre-computed flags to the client.

```typescript
// lib/constants/sla.ts
export const SLA_DAYS_PER_PHASE = 7;
export const SLA_WARNING_DAYS = 2;

// Flag types
export type FlagType = "sla_expiring" | "no_recent_session";
```

```typescript
// app/api/ops/daily/route.ts  (conceptual — planner finalizes)
// Source: project pattern from app/api/ops/pipeline/route.ts

const now = new Date();
const slaDeadline = addDays(latestTransition.createdAt, SLA_DAYS_PER_PHASE);
const daysRemaining = differenceInCalendarDays(slaDeadline, now);
const slaExpiring = daysRemaining <= SLA_WARNING_DAYS;

const lastSession = enrollment.sessions
  .sort((a, b) => b.sessionDate.getTime() - a.sessionDate.getTime())[0];
const noRecentSession = !lastSession ||
  differenceInCalendarDays(now, lastSession.sessionDate) >= 7;
```

**Key insight:** Use plain JS `Date` arithmetic — no extra library needed. `differenceInCalendarDays` can be computed as `Math.floor((a - b) / 86400000)`.

### Pattern 2: Role-Conditional Sidebar Items

The sidebar is a Client Component and currently receives `userName` and `userEmail` props from `OpsLayout`. To hide "Coordinator" for OPERATIONAL users, pass `userRole` as a new prop.

```typescript
// OpsLayout passes role:
<OpsSidebar userName={userName} userEmail={userEmail} userRole={userRole} />

// OpsSidebar conditionally renders:
const adminItems: NavItem[] = [
  { href: "/ops/coordinator", label: "Coordenador", icon: BarChart3 },
];
// render adminItems only when userRole === "ADMIN"
```

This is the existing pattern — `OpsLayout` already reads `userRole`. No new mechanism needed.

### Pattern 3: React Query Polling (Coordinator Only)

The coordinator page uses a hybrid approach: server component for the initial full page render, client component island for the auto-refreshing phase distribution table.

```typescript
// app/ops/coordinator/PhaseDistribution.tsx
"use client";
import { useQuery } from "@tanstack/react-query";

export function PhaseDistribution() {
  const { data } = useQuery({
    queryKey: ["coordinator-phase-distribution"],
    queryFn: () => fetch("/api/ops/coordinator").then(r => r.json()),
    refetchInterval: 60_000,
  });
  // render table
}
```

The parent `page.tsx` remains a server component for initial data load and ADMIN redirect guard.

**Important:** React Query v5 requires a `QueryClientProvider` in the component tree. Check if one already exists in the ops layout; if not, wrap at the coordinator page level with a small provider component.

### Pattern 4: ADMIN-Only Server-Side Redirect

```typescript
// app/ops/coordinator/page.tsx
const session = await getServerSession(authOptions);
const role = (session?.user as any)?.role;
if (role !== "ADMIN") redirect("/ops");
```

This mirrors the existing pattern in `OpsLayout` and pipeline route.

### Anti-Patterns to Avoid
- **Client-side flag computation:** Don't fetch raw enrollment data and compute SLA flags in the browser — do it in the Route Handler. Keeps bundle small and logic testable.
- **Including `SessionLog` model:** Phase 17 CONTEXT.md references `SessionLog.createdAt`, but the actual model is `MentorshipSession` with field `sessionDate`. Use `MentorshipSession.sessionDate` (indexed).
- **Skipping `QueryClientProvider`:** React Query v5 will throw if `useQuery` is called outside a provider. Verify the ops portal has a provider or add a minimal one.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date diff calculation | Custom calendar math | Plain JS: `Math.floor((a - b) / 86400000)` | Trivial; no library needed for simple day diffs |
| Role-based nav visibility | Complex permission system | Conditional render on `userRole` prop | Already done for other role-checks in this codebase |
| Auto-refresh UI | `setInterval` + fetch | React Query `refetchInterval` | Handles stale state, loading, error, deduplication |

---

## Common Pitfalls

### Pitfall 1: Wrong session model for "last session" check
**What goes wrong:** Code queries `SessionLog` (does not exist) instead of `MentorshipSession`.
**Why it happens:** CONTEXT.md mentions "SessionLog model" as a carryover from Phase 16 naming discussion, but the Prisma schema model is `MentorshipSession` (mapped to `mentorship_sessions`).
**How to avoid:** Use `enrollment.sessions` (the relation on `MentorshipEnrollment`) and order by `sessionDate DESC`, take 1.
**Warning signs:** Prisma type errors referencing unknown model.

### Pitfall 2: `assignedToId` is non-nullable in schema
**What goes wrong:** Code tries to handle null `assignedToId` for filtering, but the schema defines `assignedToId String` (required). A student cannot be enrolled without an assignee.
**Why it happens:** CONTEXT.md speculates about null assignedTo, but the Prisma schema requires it.
**How to avoid:** No null guard needed for `assignedToId`. For the coordinator view, simply omit the `where: { assignedToId: userId }` clause.
**Warning signs:** TypeScript complaining about `string | null` type mismatch.

### Pitfall 3: React Query v5 API change
**What goes wrong:** Using v4 `onSuccess` callback or `useQuery(key, fn, opts)` three-argument form.
**Why it happens:** React Query v5 changed to `useQuery({ queryKey, queryFn, ...opts })` object form only and removed `onSuccess`/`onError` callbacks.
**How to avoid:** Always use object form. The project already has `^5.90.17` — use v5 API.
**Warning signs:** TypeScript error on `useQuery` signature.

### Pitfall 4: Missing QueryClientProvider in ops portal
**What goes wrong:** `useQuery` throws "No QueryClient set" error at runtime.
**Why it happens:** React Query v5 requires `QueryClientProvider` in the React tree. The ops portal may not have one yet (pipeline board uses server components only).
**How to avoid:** Check if `app/ops/layout.tsx` or any parent wraps a `QueryClientProvider`. If not, create a small `OpsQueryProvider` client component and wrap in layout or coordinator page.
**Warning signs:** Runtime error in browser console on coordinator page.

### Pitfall 5: Phase distribution count includes COMPLETED/PAUSED students
**What goes wrong:** Phase distribution shows incorrect counts because it counts all enrollments not just ACTIVE.
**Why it happens:** The `_count` query on `MentorshipPhase` aggregates all enrollments by default.
**How to avoid:** Use `where: { status: "ACTIVE" }` in the count filter — same as `app/ops/page.tsx`.

---

## Code Examples

### SLA Days Remaining Computation
```typescript
// Source: project pattern + plain JS date math
// lib/constants/sla.ts
export const SLA_DAYS_PER_PHASE = 7;
export const SLA_WARNING_DAYS = 2;

// In route handler:
function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

const latestTransitionDate = enrollment.transitions[0]?.createdAt ?? enrollment.startDate;
const phaseAgeInDays = daysBetween(latestTransitionDate, new Date());
const daysRemaining = SLA_DAYS_PER_PHASE - phaseAgeInDays;
const slaExpiring = daysRemaining >= 0 && daysRemaining <= SLA_WARNING_DAYS;
const slaOverdue = daysRemaining < 0;
```

### Prisma Query for Daily Flags
```typescript
// Source: adapted from app/api/ops/pipeline/route.ts
const enrollments = await prisma.mentorshipEnrollment.findMany({
  where: {
    status: "ACTIVE",
    ...(scopeToUser ? { assignedToId: userId } : {}),
  },
  include: {
    customer: { select: { id: true, name: true, qbBalance: true } },
    currentPhase: { select: { id: true, label: true, key: true } },
    assignedTo: { select: { id: true, name: true } },
    transitions: {
      orderBy: { createdAt: "desc" },
      take: 1,
      select: { createdAt: true },
    },
    sessions: {
      orderBy: { sessionDate: "desc" },
      take: 1,
      select: { sessionDate: true },
    },
  },
});
```

### Conditional Sidebar Nav (role-aware)
```typescript
// Source: components/ops/ops-sidebar.tsx extension pattern
// OpsSidebarProps updated:
interface OpsSidebarProps {
  userName?: string;
  userEmail?: string;
  userRole?: string;  // new
}

// Inside render:
const allNavItems = [
  { href: "/ops", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ops/daily", label: "Ações do Dia", icon: ListChecks },
  { href: "/ops/customers", label: "Clientes", icon: Users },
  { href: "/ops/enroll", label: "Matricular", icon: GraduationCap },
  { href: "/ops/pipeline", label: "Pipeline", icon: KanbanSquare },
  ...(userRole === "ADMIN"
    ? [{ href: "/ops/coordinator", label: "Coordenador", icon: BarChart3 }]
    : []),
];
```

### React Query Polling (v5 API)
```typescript
// Source: @tanstack/react-query v5 docs
"use client";
import { useQuery } from "@tanstack/react-query";

const { data, isLoading } = useQuery({
  queryKey: ["coordinator-distribution"],
  queryFn: async () => {
    const res = await fetch("/api/ops/coordinator");
    if (!res.ok) throw new Error("fetch failed");
    return res.json();
  },
  refetchInterval: 60_000,
  staleTime: 30_000,
});
```

---

## Environment Availability

Step 2.6: SKIPPED — phase is purely code/config changes against existing infrastructure. No new external dependencies. All services (Postgres/Neon, Prisma, NextAuth) are already operational from prior phases.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected (no jest.config, vitest.config, pytest.ini found) |
| Config file | None |
| Quick run command | `npm run lint` (only automated check available) |
| Full suite command | `npm run build` (type-check + lint) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DAILY-01 | Scoped flag list returns only assigned students | manual-only | — | — |
| DAILY-02 | SLA expiry flag fires when ≤2 days remain | manual-only | — | — |
| DAILY-03 | No-session flag fires when last session ≥7 days ago | manual-only | — | — |
| COORD-01 | Phase distribution shows correct counts | manual-only | — | — |
| COORD-02 | Coordinator view unscoped (all students) | manual-only | — | — |
| COORD-03 | No-session list renders in coordinator view | manual-only | — | — |
| COORD-04 | QB debtors list shows students with qbBalance > 0 | manual-only | — | — |

**Justification for manual-only:** No test framework is installed in the project. All prior phases validated via browser/UI verification. Build (`npm run build`) provides TypeScript type-checking as the primary automated quality gate.

### Wave 0 Gaps
- No test infrastructure to create — consistent with all prior phases in this project.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `prisma/schema.prisma` lines 872-935 — `MentorshipEnrollment`, `MentorshipSession`, `PhaseTransition` model shapes confirmed
- `app/api/ops/pipeline/route.ts` — Prisma include pattern with transitions + assignedTo
- `app/ops/page.tsx` — phase distribution query pattern (`_count` with `status: "ACTIVE"`)
- `components/ops/ops-sidebar.tsx` — existing sidebar structure and prop interface
- `app/ops/layout.tsx` — `userRole` already read from session, available to pass to sidebar
- `package.json` — `@tanstack/react-query ^5.90.17` confirmed installed

### Secondary (MEDIUM confidence)
- React Query v5 `refetchInterval` API — confirmed via package version + documented breaking changes from v4→v5 (object-form only)

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed in package.json and codebase
- Architecture: HIGH — all patterns directly observed in existing ops pages
- Pitfalls: HIGH (schema) / MEDIUM (React Query v5 edge cases) — schema confirmed by direct read; RQ v5 API confirmed by version number

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable stack, no fast-moving dependencies)
