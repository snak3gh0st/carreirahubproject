# Stack Research

**Domain:** Ops Hub — Student Journey Management on existing Next.js 14 App Router
**Researched:** 2026-04-01
**Confidence:** HIGH (versions verified via npm; dnd-kit stable status confirmed via GitHub; React Query v5 from official docs; date-fns already in project)

---

## Context: What Already Exists

This research covers ONLY new capabilities needed for v1.2 Ops Hub. The following are
already installed and do NOT need to be added:

| Already Installed | Version | Relevant To Ops Hub |
|-------------------|---------|---------------------|
| `@tanstack/react-query` | ^5.90.17 | Polling, data fetching — use as-is |
| `date-fns` | ^3.6.0 | Session date formatting, relative times — use as-is |
| `@tanstack/react-table` | ^8.21.3 | Student list table views — use as-is |
| `@radix-ui/react-dialog` | ^1.1.15 | Session log modals — use as-is |
| `@radix-ui/react-select` | ^2.2.6 | Phase dropdowns, staff assignment — use as-is |
| `@radix-ui/react-tabs` | ^1.1.13 | Student profile sections — use as-is |
| `lucide-react` | ^0.378.0 | Icons throughout — use as-is |
| `sonner` | ^2.0.7 | Toast feedback on save/move — use as-is |
| `zod` | ^3.23.0 | Form validation — use as-is |
| `prisma` / `@prisma/client` | ^5.19.0 | Database models for students — add new models |

The **only genuine gap** is drag-and-drop for the Kanban pipeline board. Everything else
is already in the stack.

---

## Recommended Stack

### New Libraries to Add

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `@dnd-kit/core` | ^6.3.1 | Drag-and-drop engine for Kanban columns | Only production-stable React DnD library as of 2026. `react-beautiful-dnd` is officially deprecated by Atlassian (2022). `@dnd-kit/react` is pre-1.0 alpha — do not use. v6.3.1 is the stable release with full TypeScript support, touch/pointer/keyboard sensors, and WCAG accessibility built-in. |
| `@dnd-kit/sortable` | ^10.0.0 | Sortable preset for reordering cards within a column | Ships with `SortableContext` + `useSortable` hook that directly maps to Kanban card reorder within a phase column. Separate package by design — install alongside core. |
| `@dnd-kit/utilities` | ^3.2.2 | CSS transform utilities for drag animations | Provides `CSS.Transform.toString()` for the style transform during drag. Required companion to `@dnd-kit/sortable` for smooth card movement visuals. |

### Existing Stack Usage Patterns for New Features

| Feature | Use These (Already Installed) | Pattern |
|---------|-------------------------------|---------|
| Pipeline board data | `@tanstack/react-query` `useQuery` with `refetchInterval` | Poll board state every 30-60s; no WebSockets needed per PROJECT.md constraints |
| Daily action view | `@tanstack/react-query` `useQuery` | Filter query by `assignedUserId + today's date`; stale after 30s |
| Session log modal | `@radix-ui/react-dialog` + `zod` + Server Action | Dialog opens, form validates with zod, POSTs to `/api/dashboard/sessions` |
| Date display | `date-fns` `format`, `formatDistanceToNow`, `isToday` | Already imported in codebase — no new functions needed |
| Student table/list | `@tanstack/react-table` | Column filtering by phase, program type, assigned staff |
| Phase transition toasts | `sonner` | Already wired to root layout |
| Student profile tabs | `@radix-ui/react-tabs` | Phase history, sessions, notes, test result tabs |

---

## Installation

```bash
# Only these three are new — install them together
npm install @dnd-kit/core@^6.3.1 @dnd-kit/sortable@^10.0.0 @dnd-kit/utilities@^3.2.2
```

No dev-only dependencies needed. No schema tooling beyond existing Prisma.

---

## How dnd-kit Integrates With This Stack

### Component structure for the pipeline board

```
DndContext (from @dnd-kit/core)
  ├── SortableContext [phaseId="onboarding"] (from @dnd-kit/sortable)
  │     └── StudentCard (useSortable hook) × N
  ├── SortableContext [phaseId="active"]
  │     └── StudentCard × N
  └── ... × 11 phases
```

`DragEndEvent` fires when a card drops. The handler calls a Server Action (or `fetch` to
`/api/dashboard/ops/students/[id]/phase`) to persist the new phase. Optimistic update via
`queryClient.setQueryData` before the network call completes.

### Why NOT use DnD for cross-column reordering

The board has 11 fixed phases representing a linear journey (not freeform reordering).
Students move from phase to phase — they don't reorder within a phase. This means:

- **Within-column sort order is not needed** — cards are sorted by `lastActionAt` from the
  query, not by drag position
- **Cross-column drag is the only DnD interaction** — a student card moves from column A
  to column B
- This simplifies the DnD implementation significantly: no `arrayMove`, no position tracking

---

## Polling Strategy for Vercel Serverless

The PROJECT.md explicitly excludes real-time WebSocket features. Use React Query polling.

| View | `refetchInterval` | `staleTime` | Rationale |
|------|-------------------|-------------|-----------|
| Pipeline board (`/ops`) | 60 000 ms (1 min) | 30 000 ms | Multi-user board; 1-min lag is acceptable for ops team |
| Daily action view | 30 000 ms (30 s) | 15 000 ms | Checklist must feel current; team refreshes it mentally |
| Student profile | `false` (no poll) | 5 min | Individual record; only stale after explicit action |
| Session history | `false` (no poll) | 10 min | Append-only log; no background changes expected |

Add `refetchOnWindowFocus: true` to all polling queries so returning to the tab refreshes
data immediately. This covers the 90% case where team members switch tabs and come back.

```typescript
// Example pattern — daily action view
const { data } = useQuery({
  queryKey: ['daily-actions', userId, today],
  queryFn: () => fetch(`/api/dashboard/ops/daily-actions?userId=${userId}&date=${today}`).then(r => r.json()),
  refetchInterval: 30_000,
  staleTime: 15_000,
  refetchOnWindowFocus: true,
})
```

Vercel serverless has a 10s function timeout. All Ops Hub API routes must return in < 8s.
Queries should be indexed on `phase`, `assignedStaffId`, and `nextActionDate` — add these
indexes in the Prisma schema for the new `StudentJourney` and `Session` models.

---

## Date/Time Handling

`date-fns` v3 (already installed at ^3.6.0) covers all session scheduling needs:

| Need | Function | Notes |
|------|----------|-------|
| Display session date | `format(date, 'MMM d, yyyy')` | Human-readable card dates |
| "Due today" badge | `isToday(date)` | Daily action view filtering |
| Relative time | `formatDistanceToNow(date, { addSuffix: true })` | "3 days ago" in session log |
| Week view | `startOfWeek` / `endOfWeek` | Upcoming sessions widget |
| Overdue detection | `isBefore(date, new Date())` | Flag students past next-action date |

No timezone library needed — Carreira USA operates in a single timezone (US East). Server
stores UTC; display converts with `date-fns` in the browser. If multi-timezone support is
ever needed, add `date-fns-tz` at that point.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `@dnd-kit/core` v6.3.1 | `@dnd-kit/react` v0.3.x | Pre-1.0 alpha. New API is the future direction but API is unstable. Use v6 stable for production feature now. |
| `@dnd-kit/core` v6.3.1 | `react-beautiful-dnd` | Officially deprecated by Atlassian (2022). No maintenance. Known React 18 strict mode issues. |
| `@dnd-kit/core` v6.3.1 | `@hello-pangea/dnd` | Fork of react-beautiful-dnd; suitable for list-only DnD. Works but lacks the cross-container flexibility needed for 11-column board. |
| React Query `refetchInterval` | SWR `refreshInterval` | Both work. Project already has `@tanstack/react-query` installed and in use — no reason to add SWR. React Query's DevTools and query invalidation are already part of the workflow. |
| `date-fns` (existing) | `dayjs` | Already installed. Functional API fits existing TypeScript patterns. No reason to add a second date library. |
| `date-fns` (existing) | Temporal API | Not production-ready (Stage 3 proposal as of 2026). No polyfill warranted for this use case. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@dnd-kit/react` (v0.x) | Pre-1.0 alpha — API changes without notice, not safe for production feature | `@dnd-kit/core` v6.3.1 + `@dnd-kit/sortable` v10.0.0 |
| `react-beautiful-dnd` | Deprecated 2022, no React 18 strict mode support, no touch support | `@dnd-kit/core` |
| Socket.io / Pusher / Ably | PROJECT.md explicitly excludes real-time/WebSocket. Vercel serverless functions are stateless — no persistent connections | React Query `refetchInterval` polling |
| `react-dnd` | Lower-level, verbose, requires HTML5 backend wiring; more setup than dnd-kit for same result | `@dnd-kit/core` |
| `framer-motion` | Adds ~30kB for animation that dnd-kit handles natively via CSS transforms. Overkill for a Kanban board. | `@dnd-kit/utilities` CSS transforms |
| `moment.js` | 300kB, deprecated. Already using `date-fns` v3. | `date-fns` (already installed) |
| `react-hook-form` | Project uses direct `zod` + Server Actions pattern. Adding RHF would create two form patterns. | `zod` + Server Actions (already in codebase) |

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `@dnd-kit/core` | 6.3.1 | React 18.3, Next.js 14 App Router | Requires `'use client'` directive on Kanban board components — DnD is inherently client-side interaction. DndContext cannot be a Server Component. |
| `@dnd-kit/sortable` | 10.0.0 | `@dnd-kit/core` 6.3.1 | Must match the major version series of core. v10 sortable works with v6 core. |
| `@dnd-kit/utilities` | 3.2.2 | `@dnd-kit/core` 6.3.1 | CSS transform helpers; no React version restrictions. |
| `@tanstack/react-query` | 5.90.17 | Next.js 14 App Router | Already installed and working. `refetchInterval` as a function receives `{ state }` in v5 (changed from v4 where it received `data` directly). |
| `date-fns` | 3.6.0 | TypeScript 5.5 | Already installed. v3 uses named exports only (no default export). All functions are pure/tree-shaken. |

---

## Prisma Schema Additions Needed

The stack additions above require new database models. These are not library installs but
schema work that blocks the feature build:

```
New models needed (to be designed in Architecture phase):
  - StudentJourney   — phase tracking per Customer (11 phases, assignedStaffId, nextActionDate)
  - Session          — session log (type, conductorId, date, notes, linkedStudentJourneyId)
  - PhaseTransition  — audit log of phase moves (who moved, when, from/to)
```

No new Prisma packages needed — existing `prisma@^5.19.0` + `@prisma/client@^5.19.0`
handles these models. After schema changes: `npm run db:generate && npm run db:push` (dev)
or `npm run db:migrate` (prod).

---

## Sources

- [dnd-kit GitHub — Clarification on roadmap: @dnd-kit/react vs @dnd-kit/core (Discussion #1842)](https://github.com/clauderic/dnd-kit/discussions/1842) — Confirmed v6.3.1 is production-stable; @dnd-kit/react is pre-1.0. HIGH confidence.
- [@dnd-kit/core npm page](https://www.npmjs.com/package/@dnd-kit/core) — v6.3.1 confirmed as latest stable. Version verified via `npm info`. HIGH confidence.
- [TanStack Query v5 — useQuery reference](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery) — `refetchInterval`, `staleTime`, `refetchOnWindowFocus` options confirmed. HIGH confidence (official docs).
- [TanStack Query — Auto Refetching example](https://tanstack.com/query/v5/docs/framework/react/examples/auto-refetching) — Polling pattern with `refetchInterval`. HIGH confidence (official docs).
- [Top 5 Drag-and-Drop Libraries for React in 2026 — Puck](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react) — dnd-kit recommended over react-beautiful-dnd for new projects. MEDIUM confidence (community post).
- [date-fns vs Day.js vs Luxon 2026 — PkgPulse](https://www.pkgpulse.com/blog/best-javascript-date-libraries-2026) — date-fns recommended for TypeScript-heavy projects with tree-shaking. MEDIUM confidence.
- Package versions cross-checked via `npm info` in project environment. HIGH confidence.

---
*Stack research for: Ops Hub (Student Journey Management) — additions to existing Next.js 14 + Prisma stack*
*Researched: 2026-04-01*
