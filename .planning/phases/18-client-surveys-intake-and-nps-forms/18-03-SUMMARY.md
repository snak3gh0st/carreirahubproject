---
phase: 18-client-surveys-intake-and-nps-forms
plan: "03"
subsystem: ui
tags: [react, react-query, tanstack-query, sonner, next-js, ops-hub, forms, nps]

requires:
  - phase: 18-02
    provides: "POST /api/ops/forms/assign route, formAssignments in enrollment API response, npsResults extraction, availableFormTemplates"

provides:
  - "FormsSection component with inline assign flow at app/ops/students/[enrollmentId]/FormsSection.tsx"
  - "StudentProfileClient extended with NPS badges in header and FormsSection between timeline and sessions"
  - "NPS score visibility (Entrada/Saida) on student profile as color-coded badges"

affects: [ops-hub, student-profile, phase-18]

tech-stack:
  added: []
  patterns:
    - "Inline assign UI pattern: toggle-revealed form with dropdown, submit disables while pending, invalidates parent query on success"
    - "React Query mutation for POST with query invalidation — same pattern as SessionSection"
    - "Status badge helper functions (statusBadgeClass/statusLabel) for form assignment statuses"
    - "useMemo-derived Set for active template IDs to filter selectable templates"

key-files:
  created:
    - app/ops/students/[enrollmentId]/FormsSection.tsx
  modified:
    - app/ops/students/[enrollmentId]/StudentProfileClient.tsx

key-decisions:
  - "FormsSection receives all data as props from parent query — no second page-level query"
  - "Active template filtering via useMemo Set: templates in PENDING or IN_PROGRESS state are hidden from dropdown"
  - "NPS score shown inline in assignment row and as header badges — dual visibility for quick scanning"

patterns-established:
  - "Ops inline-assign pattern: collapsed by default, dropdown from availableTemplates prop, invalidateQueries on success"

requirements-completed: [SURV-03, SURV-04]

duration: 4min
completed: 2026-04-03
---

# Phase 18 Plan 03: Ops Hub Student Profile — Forms and NPS Surface Summary

**FormsSection with inline assignment flow and NPS Entrada/Saida score badges embedded in the Ops student profile header**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-03T18:18:24Z
- **Completed:** 2026-04-03T18:22:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Extended `StudentProfileClient.tsx` with Phase 18 `ProfileData` types (`formAssignments`, `availableFormTemplates`, `npsResults`) and NPS Entrada/Saida score badges in the header card
- Built `FormsSection.tsx` as an Ops-native client component with React Query mutation to `POST /api/ops/forms/assign`, inline template dropdown, and query invalidation on success
- Status visibility for form assignments: `Pendente`, `Em andamento`, `Concluido` badges with assigned/submitted dates and inline NPS scores for completed NPS forms

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend student profile data types and header for NPS visibility** - `48a7343` (feat)
2. **Task 2: Build FormsSection with inline assign flow** - `1d4004a` (feat)

## Files Created/Modified

- `app/ops/students/[enrollmentId]/StudentProfileClient.tsx` - Extended ProfileData type, NPS badge rendering in header, FormsSection embedded between timeline and SessionSection
- `app/ops/students/[enrollmentId]/FormsSection.tsx` - New component: inline assign form, assignment list with status badges, empty state, NPS score inline display

## Decisions Made

- FormsSection receives all data as props from the existing parent `useProfileData` query — no second page-level query introduced, consistent with plan requirement
- Active template filtering uses a `useMemo`-derived `Set` of non-COMPLETED template IDs to determine which templates appear in the dropdown
- NPS scores are shown both inline in the assignment row (for detail) and as header badges (for quick scanning) — dual visibility strategy

## Deviations from Plan

None - both files were already partially implemented in the worktree from prior session work. Task 1 artifacts (ProfileData extension, NPS badges) and Task 2 artifacts (FormsSection) were complete and passing TypeScript type-check. Committed as two atomic task commits per plan protocol.

## Issues Encountered

None — TypeScript (`npx tsc --noEmit`) passed with zero errors. All acceptance criteria strings present in both files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Full Phase 18 surface is complete: templates registered (18-01), backend wired (18-02), Ops UI surface built (18-03)
- Manual spot-check: open `/ops/students/[enrollmentId]`, assign `nps-entry`, submit from `/hub/forms/[id]`, confirm NPS badge appears in header
- No blockers for subsequent phases

---
*Phase: 18-client-surveys-intake-and-nps-forms*
*Completed: 2026-04-03*
