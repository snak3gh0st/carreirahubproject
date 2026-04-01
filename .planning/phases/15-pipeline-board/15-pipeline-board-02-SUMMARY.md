---
phase: 15-pipeline-board
plan: "02"
subsystem: ops-hub
tags: [pipeline-board, dnd-kit, kanban, react-query, optimistic-updates]
dependency_graph:
  requires: [15-01]
  provides: [pipeline-ui, student-cards, advance-dialog]
  affects: [ops-sidebar, ops-pipeline-page]
tech_stack:
  added: ["@dnd-kit/core@6.3.1", "@dnd-kit/sortable@10.0.0", "@dnd-kit/utilities@3.2.2"]
  patterns: [optimistic-updates, react-query-v5, dnd-kit-kanban, radix-dialog]
key_files:
  created:
    - app/ops/pipeline/usePipelineData.ts
    - app/ops/pipeline/page.tsx
    - app/ops/pipeline/PipelineBoard.tsx
    - app/ops/pipeline/StudentCard.tsx
    - app/ops/pipeline/AdvanceDialog.tsx
  modified:
    - components/ops/ops-sidebar.tsx
    - package.json
decisions:
  - "rectIntersection collision detection used for horizontal Kanban (not closestCenter)"
  - "DragOverlay z-index 50 — renders above sidebar z-30"
  - "PipelineBoard wrapped in Suspense in page.tsx to isolate useSearchParams CSR bailout"
  - "Only adjacent next-phase drops allowed; non-adjacent drops silently ignored"
metrics:
  duration: "3 minutes"
  completed: "2026-04-01"
  tasks: 2
  files: 7
---

# Phase 15 Plan 02: Pipeline Board UI Summary

**One-liner:** Kanban pipeline board with dnd-kit drag-and-drop, React Query optimistic advance, SLA overdue indicators, and QB debtor badges across 11 phase columns.

## What Was Built

### Component Files and Responsibilities

| File | Responsibility |
|------|----------------|
| `usePipelineData.ts` | React Query hook fetching GET /api/ops/pipeline; `useAdvancePhase` mutation with optimistic onMutate snapshot and onError rollback |
| `page.tsx` | Server Component — NextAuth session check, ADMIN/OPERATIONAL role gate, Suspense boundary wrapping PipelineBoard |
| `PipelineBoard.tsx` | Client Component — DndContext, 11 droppable PhaseColumn components, filter toggle (assignee=me), advance click handler, AdvanceDialog wiring |
| `StudentCard.tsx` | Draggable card — overdue border-l-4 red, approaching SLA amber, Devedor badge, assignee initials circle, phase age in days |
| `AdvanceDialog.tsx` | Radix Dialog confirmation — opens when pendingMove !== null, shows student name and target phase, brand-verde confirm button |

### dnd-kit Configuration

- **Versions installed:** @dnd-kit/core@6.3.1, @dnd-kit/sortable@10.0.0, @dnd-kit/utilities@3.2.2
- **Collision detection:** `rectIntersection` — correct algorithm for horizontal Kanban layouts
- **DragOverlay:** `style={{ zIndex: 50 }}` — appears above sidebar (z-30)
- **isDragging:** Card set to `opacity-40` so overlay ghost is visible

### Optimistic Update Strategy

`onMutate` captures full `PhaseWithEnrollments[]` snapshot via `queryClient.getQueryData(["pipeline"])`, then moves the enrollment from current phase to target phase in local cache. `onError` restores snapshot. `onSettled` invalidates to re-sync server state.

### Brand Tokens Used

- `text-brand-verde` / `bg-brand-verde` — PASS badge, confirm button, filter active state, pipeline heading
- `text-brand-tangerina` / `bg-brand-tangerina` — ADVANCED badge
- `border-l-red-500` — overdue indicator (phaseAgeDays > slaDays)
- `border-l-amber-400` — approaching SLA (> 75% of slaDays)
- `bg-brand-verde/5 ring-2 ring-brand-verde/30` — column drop-over highlight

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `app/ops/pipeline/usePipelineData.ts` exists
- [x] `app/ops/pipeline/page.tsx` exists
- [x] `app/ops/pipeline/PipelineBoard.tsx` exists
- [x] `app/ops/pipeline/StudentCard.tsx` exists
- [x] `app/ops/pipeline/AdvanceDialog.tsx` exists
- [x] `components/ops/ops-sidebar.tsx` updated with KanbanSquare Pipeline entry
- [x] TypeScript: zero errors (`npx tsc --noEmit` clean)
- [x] Commits: 9a355b6 (Task 1), 1026664 (Task 2)

## Self-Check: PASSED
