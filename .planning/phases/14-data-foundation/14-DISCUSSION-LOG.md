# Phase 14: Data Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 14-data-foundation
**Areas discussed:** Session types, Enrollment UI placement, Phase keys & SLA, Customer search UX, Phase flow

---

## Session Types

| Option | Description | Selected |
|--------|-------------|----------|
| Map from the 11 phases | Use session names from the ops workflow | ✓ |
| Simpler generic types | Generic: Session, Follow-up, Check-in, Mock Interview | |
| I'll define them | User-specified list | |

**User's choice:** Map from the 11 phases — confirmed the proposed list of 11 types (Passagem de Bastão, Teste de Inglês, Onboarding, Bússola, Raio X, Devolutiva, Treinamento de Entrevista, Mock Interview, Check-in, Renovação, Outro) looked correct.

---

## Enrollment UI Placement

| Option | Description | Selected |
|--------|-------------|----------|
| New /dashboard/ops section | Dedicated Ops Hub section in the sidebar | ✓ |
| Inside Customer detail | Button/modal within existing Customer detail page | |
| Standalone modal from anywhere | Global 'New enrollment' action | |

**User's choice:** New /dashboard/ops section — sets up the nav structure for Phases 15–17.

### Post-enrollment behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Stay on form with success toast | Show toast, reset form | ✓ |
| Redirect to student profile | Navigate to new student's profile (Phase 16) | |
| Redirect to Pipeline Board | Navigate to /dashboard/ops Kanban (Phase 15) | |

**User's choice:** Stay on form with success toast — useful for enrolling multiple students back-to-back.

---

## Phase Keys & SLA

| Option | Description | Selected |
|--------|-------------|----------|
| snake_case slugs | e.g. bastao, teste_de_ingles | ✓ |
| SCREAMING_SNAKE_CASE | e.g. BASTAO, CADASTRO | |
| Numeric codes | e.g. phase_01 through phase_11 | |

**User's choice:** snake_case slugs.

### SLA seeding

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, seed SLA now | Add slaDays column and seed with workflow-based defaults | ✓ |
| No, defer to Phase 15 | Phase 15 adds the column | |
| Yes, but use a default | 14 days for all phases | |

**User's choice:** Seed now. SLA values: "Use what is best to have this working correctly." — delegated to Claude's discretion using workflow-derived defaults.

---

## Customer Search UX

| Option | Description | Selected |
|--------|-------------|----------|
| Typeahead as-you-type | Search fires at 2+ chars, dropdown results | ✓ |
| Search-then-select step | Two-step explicit flow | |
| Browse all, then filter | Paginated table with filter | |

**User's choice:** Typeahead as-you-type.

### Duplicate enrollment handling

| Option | Description | Selected |
|--------|-------------|----------|
| Block with error message | API returns 409 | ✓ |
| Allow re-enrollment | Allow second enrollment | |
| Show warning, let ops decide | Confirmation step | |

**User's choice:** Block with error message (409).

### Missing CEFR level

| Option | Description | Selected |
|--------|-------------|----------|
| Allow enrollment, CEFR optional | CEFR shows as 'Pending' | ✓ |
| Block enrollment | Require PlacementTest first | |
| Show warning only | Yellow warning, allow through | |

**User's choice:** Allow enrollment, CEFR optional.

---

## Phase Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Strict sequential only | API enforces currentPhase + 1 only | |
| Any phase, but log it | Ops can jump to any phase | |
| Sequential with coordinator override | Default sequential, ADMIN can skip | ✓ |

**User's choice:** Sequential with coordinator override — ADMIN role can skip phases.

### Rollback support

| Option | Description | Selected |
|--------|-------------|----------|
| Forward-only in this phase | No rollback in Phase 14 | |
| Allow rollback now | Full rollback support in service | ✓ |

**User's choice:** Allow rollback now — API and service support phase rollback.

---

## Claude's Discretion

- SLA days per phase (delegated — user said "use what is best")
- Exact Prisma field names
- HTTP status codes for validation errors
- Loading states for typeahead

## Deferred Ideas

- Admin UI to edit SLA days — future phase after v1.2
- Auto-enrollment via Pipedrive Deal Won (AUTO-01) — v1.3
- Google Calendar session scheduling (COMM-02) — v1.3
- Rollback UX in Kanban — Phase 15 (API support added in Phase 14)
