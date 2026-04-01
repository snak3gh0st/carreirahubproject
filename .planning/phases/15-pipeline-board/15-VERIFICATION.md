---
phase: 15-pipeline-board
verified: 2026-04-01T17:45:00Z
status: human_needed
score: 9/9 automated must-haves verified
human_verification:
  - test: "Navigate to /ops/pipeline and visually confirm 11 phase columns render"
    expected: "11 columns labelled in correct sortOrder sequence (Passagem de Bastão through Renovação)"
    why_human: "Column rendering depends on DB seed data — programmatic check cannot confirm 11 MentorshipPhase rows exist in DB"
  - test: "Drag a student card to the adjacent next column"
    expected: "AdvanceDialog opens with 'Mover [Name] para [Phase]?' text, card moves optimistically on confirm, success toast appears"
    why_human: "DnD interaction and dialog flow require a browser session with active enrollments"
  - test: "Click 'Meus alunos' filter button"
    expected: "URL changes to /ops/pipeline?assignee=me and cards not assigned to current user disappear"
    why_human: "Filter correctness depends on real enrollment data with assigned users"
---

# Phase 15: Pipeline Board Verification Report

**Phase Goal:** Build the Kanban pipeline board — ops team can view all 11 student journey phases, see active enrollments per phase, drag cards to advance students, and filter to "My students".
**Verified:** 2026-04-01T17:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | GET /api/ops/pipeline returns 11 phase objects ordered by sortOrder, each with an enrollments array | VERIFIED | `app/api/ops/pipeline/route.ts` L16-40: `mentorshipPhase.findMany({ orderBy: { sortOrder: "asc" }, include: { enrollments: { where: { status: "ACTIVE" } } } })` |
| 2 | Each enrollment includes customer name, qbBalance, assignee id/name, and latest PhaseTransition timestamp | VERIFIED | Pipeline route includes `customer { id, name, qbBalance }`, `assignedTo { id, name }`, `transitions { createdAt }` (take: 1, desc) |
| 3 | POST /api/ops/enrollments/[id]/advance writes a PhaseTransition and returns updated enrollment | VERIFIED | `advance/route.ts` calls `mentorshipService.advancePhase()` which is substantive — handles `INVALID_TRANSITION → 422` |
| 4 | Both routes return 403 for users without ADMIN or OPERATIONAL role | VERIFIED | Both routes check `role !== "ADMIN" && role !== "OPERATIONAL"` and return 403 |
| 5 | Pipeline page renders columns from API data via DndContext with 11 droppable PhaseColumn components | VERIFIED | `PipelineBoard.tsx`: maps `phases` from `usePipelineData()` into `PhaseColumn` components each wrapped with `useDroppable({ id: phase.id })` |
| 6 | Student cards show name, program badge, phase age in days, assignee initials, overdue indicator, and Devedor badge | VERIFIED | `StudentCard.tsx`: all six elements confirmed present; `isOverdue` triggers `border-l-red-500`; `isDebtor` triggers "Devedor" badge |
| 7 | Drag-and-drop opens AdvanceDialog before advancing; cancel returns card to original column | VERIFIED | `PipelineBoard.tsx` `handleDragEnd` sets `pendingMove`; optimistic rollback in `useAdvancePhase` `onError` restores snapshot |
| 8 | "My students" filter is URL-driven (?assignee=me), bookmarkable, and preserved on refresh | VERIFIED | `PipelineBoard.tsx` L71-74: `useSearchParams`, `toggleFilter` uses `router.push` with updated URLSearchParams; `visibleEnrollments` filtered by `e.assignedTo.id === currentUserId` |
| 9 | Pipeline nav entry appears in ops sidebar | VERIFIED | `ops-sidebar.tsx` L11, L25: `KanbanSquare` imported, `{ href: "/ops/pipeline", label: "Pipeline", icon: KanbanSquare }` added |

**Score:** 9/9 truths verified (automated)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/api/ops/pipeline/route.ts` | GET — all 11 phases with active enrollments | VERIFIED | 43 lines, exports `GET`, full Prisma query with nested includes |
| `app/api/ops/enrollments/[id]/advance/route.ts` | POST — thin wrapper around mentorshipService.advancePhase | VERIFIED | 54 lines, exports `POST`, delegates to service, maps INVALID_TRANSITION → 422 |
| `app/ops/pipeline/page.tsx` | Server Component shell — auth check, Suspense wrapper | VERIFIED | 39 lines, NextAuth session check, ADMIN/OPERATIONAL gate, Suspense around PipelineBoard |
| `app/ops/pipeline/PipelineBoard.tsx` | Client Component — DndContext, column layout, filter | VERIFIED | 248 lines, DndContext with rectIntersection, 11 droppable columns, useSearchParams filter, DragOverlay z-50 |
| `app/ops/pipeline/StudentCard.tsx` | Draggable card with badges and indicators | VERIFIED | 109 lines, useDraggable, overdue/SLA/debtor logic, all required UI elements present |
| `app/ops/pipeline/AdvanceDialog.tsx` | Radix Dialog confirmation before phase advance | VERIFIED | 53 lines, Radix Dialog, pending !== null opens dialog, brand-verde confirm button |
| `app/ops/pipeline/usePipelineData.ts` | React Query hook — fetch + mutation with optimistic updates | VERIFIED | 106 lines, useQuery for GET, useMutation with onMutate snapshot, onError rollback, onSettled invalidate |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/api/ops/pipeline/route.ts` | `prisma.mentorshipPhase` | `findMany` with nested include | WIRED | L16: `prisma.mentorshipPhase.findMany(...)` confirmed |
| `app/api/ops/enrollments/[id]/advance/route.ts` | `mentorshipService.advancePhase` | direct service call | WIRED | L33: `mentorshipService.advancePhase({ enrollmentId: params.id, ... })` confirmed |
| `PipelineBoard.tsx` | `/api/ops/pipeline` | usePipelineData React Query hook | WIRED | `usePipelineData.ts` L34: `fetch("/api/ops/pipeline")` |
| `AdvanceDialog.tsx` | `/api/ops/enrollments/[id]/advance` | useMutation in usePipelineData | WIRED | `usePipelineData.ts` L51: `fetch(\`/api/ops/enrollments/${enrollmentId}/advance\`, { method: "POST" })` |
| `StudentCard.tsx` | DndContext | useDraggable from @dnd-kit/core | WIRED | `StudentCard.tsx` L15: `useDraggable({ id: enrollment.id })` |
| filter toggle | URL ?assignee=me param | router.push in PipelineBoard | WIRED | `PipelineBoard.tsx` L83-90: `router.push(\`${pathname}?${params.toString()}\`)` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `PipelineBoard.tsx` | `phases` | `usePipelineData()` → `GET /api/ops/pipeline` → `prisma.mentorshipPhase.findMany` | Yes — live DB query | FLOWING |
| `StudentCard.tsx` | `enrollment` | props from PipelineBoard, sourced from pipeline query | Yes — flows from DB | FLOWING |
| `AdvanceDialog.tsx` | `pending` (studentName, toPhaseLabel) | props set by handleAdvanceClick/handleDragEnd from phases data | Yes — derived from real data | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| @dnd-kit/core installed at required version | `node -e "require('.../node_modules/@dnd-kit/core/package.json').version"` | 6.3.1 | PASS |
| TypeScript: zero errors in pipeline files | `npx tsc --noEmit \| grep pipeline` | no output | PASS |
| Commits for all 3 plans present | `git log --oneline` | bab7a26, cdfba3f, 9a355b6, 1026664, 2891eac, 413ea24 all found | PASS |
| API route file exists and exports GET | file read | `export async function GET()` confirmed | PASS |
| Advance route maps INVALID_TRANSITION to 422 | file read | `err.code === "INVALID_TRANSITION" ? 422 : 400` confirmed | PASS |
| DragOverlay z-index 50 | file read | `DragOverlay style={{ zIndex: 50 }}` confirmed | PASS |
| useSearchParams inside Suspense boundary | page.tsx + PipelineBoard.tsx | PipelineBoard wrapped in `<Suspense>` in page.tsx | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| PIPE-01 | 15-01, 15-02 | Ops team sees all active enrollments grouped by phase in Kanban layout | SATISFIED | GET /api/ops/pipeline + PipelineBoard renders phases from DB |
| PIPE-02 | 15-01, 15-02 | Ops team can advance student via drag-and-drop or advance button | SATISFIED | DnD handleDragEnd + handleAdvanceClick both set pendingMove; confirm calls advanceMutation |
| PIPE-03 | 15-02, 15-03 | Filter board to show only students assigned to a specific team member | SATISFIED | useSearchParams + router.push + visibleEnrollments filter by assignedTo.id |
| PIPE-04 | 15-02 | Overdue indicator when student exceeds SLA for current phase | SATISFIED | StudentCard: `isOverdue = phaseAgeDays > slaDays` → `border-l-red-500` |
| PIPE-05 | 15-02 | Debtor flag when student has overdue QB payment balance | SATISFIED | StudentCard: `isDebtor = Number(qbBalance) > 0` → "Devedor" badge |

No orphaned requirements — all 5 PIPE requirements claimed across plans and implementation confirmed.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | All pipeline files are substantive implementations |

No TODOs, FIXMEs, placeholder returns, or hardcoded empty data found in pipeline files.

### Human Verification Required

#### 1. Confirm 11 MentorshipPhase DB rows exist

**Test:** Run `npx prisma studio`, open MentorshipPhase table, count rows and verify sortOrder 1-11 with correct labels.
**Expected:** 11 rows labelled: Passagem de Bastão, Cadastro, Teste de Inglês, Onboarding, Board, Bússola, Raio X, Material, Devolutiva, Ongoing, Renovação — each with a `slaDays` value.
**Why human:** DB seed data cannot be verified programmatically without running a live query against the actual database.

#### 2. Kanban board visual rendering

**Test:** Start `npm run dev`, log in with ADMIN or OPERATIONAL role, navigate to `/ops/pipeline`, observe the board.
**Expected:** 11 phase columns visible in horizontal scroll layout. If active enrollments exist: student cards show name, program badge (PASS/ADVANCED), phase age in days, and assignee initials.
**Why human:** Visual layout and card rendering require a real browser session.

#### 3. Drag-and-drop advance flow

**Test:** With at least one active enrollment, drag a student card to the adjacent next column.
**Expected:** AdvanceDialog opens showing "Mover [StudentName] para [PhaseName]?". Clicking Confirmar moves the card and shows a success toast. Clicking Cancelar returns the card to its original column.
**Why human:** DnD interaction requires browser + active enrollment data.

#### 4. "My students" filter

**Test:** Click "Meus alunos" button, observe URL change, then click "Todos os alunos".
**Expected:** URL changes to `/ops/pipeline?assignee=me` and only cards assigned to current user remain. Navigating directly to that URL pre-applies the filter.
**Why human:** Filter correctness requires real enrollment data with user assignments.

### Gaps Summary

No automated gaps. All 9 observable truths verified against actual code. All 7 artifacts exist and are substantive. All 6 key links confirmed wired. Data flows from DB through API to rendered components. The 3 human verification items above are the only items pending — they require real DB data and browser interaction.

---

_Verified: 2026-04-01T17:45:00Z_
_Verifier: Claude (gsd-verifier)_
