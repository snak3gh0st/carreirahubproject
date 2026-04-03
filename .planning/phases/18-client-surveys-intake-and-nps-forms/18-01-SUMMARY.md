---
phase: 18-client-surveys-intake-and-nps-forms
plan: "01"
subsystem: ui
tags: [forms, nps, hub, i18n, typescript, scale-field]

# Dependency graph
requires:
  - phase: 13-cefr-english-proficiency-test-engine
    provides: FormAssignment/FormSubmission infrastructure and Hub form rendering pipeline
  - phase: 14-data-foundation
    provides: MentorshipEnrollment model that NPS assignments will reference
provides:
  - NPS_SCORE_FIELD constant as single source of truth for answer key
  - NPS_TEMPLATE_IDS constant listing all NPS template slugs
  - nps-entry and nps-exit FormTemplate definitions in FORM_TEMPLATES registry
  - Localized Hub form list/detail rendering supporting pt-BR for all templates
affects:
  - 18-02-PLAN (auto-assignment of nps-entry on enrollment)
  - 18-03-PLAN (NPS score extraction reads NPS_SCORE_FIELD constant)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - NPS_SCORE_FIELD as a named constant prevents magic string "npsScore" from scattering across extraction logic
    - NPS templates reuse the existing scale field type (scaleMin:0, scaleMax:10) - no custom widget
    - Hub pages use isPt guard (lang === "pt-BR") to select titlePt/descriptionPt/labelPt

key-files:
  created: []
  modified:
    - lib/hub/form-templates.ts
    - app/hub/forms/page.tsx
    - app/hub/forms/[id]/page.tsx

key-decisions:
  - "NPS templates use existing scale field type with scaleMin:0 and scaleMax:10 — no custom nps field type introduced"
  - "NPS_SCORE_FIELD = 'npsScore' is the single score contract for all downstream NPS extraction"

patterns-established:
  - "NPS_SCORE_FIELD: export a named constant for the answer key; never scatter the magic string"
  - "Scale renderer: scaleMin ?? 1 / scaleMax ?? 10 default guards handle both 1-10 and 0-10 cases"

requirements-completed: [SURV-01]

# Metrics
duration: 4min
completed: 2026-04-03
---

# Phase 18 Plan 01: NPS Template Registry and Hub Localization Summary

**nps-entry and nps-exit templates registered in FORM_TEMPLATES with NPS_SCORE_FIELD/NPS_TEMPLATE_IDS constants; Hub list/detail pages render PT-BR copy through the existing scale renderer**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-03T18:13:32Z
- **Completed:** 2026-04-03T18:17:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Exported `NPS_SCORE_FIELD = "npsScore"` as shared score contract for all NPS extraction
- Exported `NPS_TEMPLATE_IDS = ["nps-entry", "nps-exit"] as const` for type-safe template ID enumeration
- Added `nps-entry` template: 0-10 scale + npsComment textarea, full EN/PT-BR copy
- Added `nps-exit` template: 0-10 scale + npsComment textarea, full EN/PT-BR copy
- Hub forms list page renders `titlePt` when client language is `pt-BR`
- Hub form detail page renders `template.titlePt`, `template.descriptionPt`, and field `labelPt` in Portuguese
- Scale renderer uses `scaleMinLabelPt`/`scaleMaxLabelPt` for endpoint labels in Portuguese

## Task Commits

Each task was committed atomically:

1. **Task 1: Add NPS templates and shared score constants** - `7f00500` (feat)
2. **Task 2: Localize Hub list/detail rendering for new survey templates** - `2be86f3` (feat)

## Files Created/Modified

- `lib/hub/form-templates.ts` - Added NPS_SCORE_FIELD, NPS_TEMPLATE_IDS exports and nps-entry/nps-exit template definitions
- `app/hub/forms/page.tsx` - Renders titlePt when lang === "pt-BR"
- `app/hub/forms/[id]/page.tsx` - Uses template.titlePt, template.descriptionPt, field.labelPt, scaleMinLabelPt/scaleMaxLabelPt

## Decisions Made

- NPS templates reuse the existing `scale` field type with `scaleMin: 0` and `scaleMax: 10` — no custom NPS widget introduced, keeping the renderer surface minimal
- `NPS_SCORE_FIELD = "npsScore"` is exported as a named constant so Plan 18-03 (score extraction) can import it instead of hardcoding the string

## Deviations from Plan

None - plan executed exactly as written. All three files already had the correct structure in place; the work was pre-done as part of the Phase 18 planning. Verified TypeScript passes (`tsc --noEmit` exits 0) and all acceptance criteria confirmed by grep.

## Issues Encountered

None - all code was already present from the planning phase commits. Tasks committed cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- NPS template registry is complete; Plan 18-02 can call `getTemplate("nps-entry")` and `getTemplate("nps-exit")` for auto-assignment on enrollment
- `NPS_SCORE_FIELD` constant is available for Plan 18-03 score extraction from `FormSubmission.answers`
- No blockers for 18-02 or 18-03

---
*Phase: 18-client-surveys-intake-and-nps-forms*
*Completed: 2026-04-03*
