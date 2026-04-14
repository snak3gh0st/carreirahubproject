---
phase: quick-260414-oco
plan: 01
subsystem: forms
tags: [forms, ops-hub, hub, status-transitions, programType-whitelist]
dependency_graph:
  requires: [Phase 18 forms infrastructure]
  provides: [correct IN_PROGRESS status transition, programType-scoped assignment guard, ops UI hint]
  affects: [app/api/hub/forms/[id]/route.ts, app/api/ops/forms/assign/route.ts, app/ops/students/[enrollmentId]/FormsSection.tsx]
tech_stack:
  added: []
  patterns: [Prisma update in GET handler, programType whitelist enforcement]
key_files:
  modified:
    - app/api/hub/forms/[id]/route.ts
    - app/api/ops/forms/assign/route.ts
    - app/ops/students/[enrollmentId]/FormsSection.tsx
decisions:
  - "IN_PROGRESS flip done before response so client sees updated status on first load — avoids a second fetch"
  - "programType whitelist in POST /api/ops/forms/assign mirrors GET /api/ops/enrollments/[id] logic exactly — single source of truth for allowed templates"
metrics:
  duration: 8 min
  completed: 2026-04-14
  tasks_completed: 3
  files_modified: 3
---

# Quick Task 260414-oco: Wire Forms Flow — IN_PROGRESS status + programType whitelist + ops UI hint

**One-liner:** Closed three wiring gaps in the ops-assigns → student-fills → ops-sees-result forms loop: status PENDING→IN_PROGRESS on first hub GET, programType-scoped template whitelist in the assign endpoint, and an ops UI hint for in-progress forms.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Flip status PENDING → IN_PROGRESS on first hub GET | 11aed29 | app/api/hub/forms/[id]/route.ts |
| 2 | Enforce programType-scoped template whitelist in ops assign endpoint | 7a4fcf1 | app/api/ops/forms/assign/route.ts |
| 3 | Add IN_PROGRESS hint in FormsSection ops UI | 4e102f9 | app/ops/students/[enrollmentId]/FormsSection.tsx |

## What Changed

### Task 1 — `app/api/hub/forms/[id]/route.ts`
After ownership verification, if `assignment.status === "PENDING"`, run `prisma.formAssignment.update` to set `status = "IN_PROGRESS"` and mutate the local object before returning the response. Already-IN_PROGRESS or COMPLETED assignments are untouched.

### Task 2 — `app/api/ops/forms/assign/route.ts`
Imported `NPS_TEMPLATE_IDS`. After the existing `FORM_TEMPLATES` existence check, look up the customer's most recent `MentorshipEnrollment`. Returns 400 if no enrollment exists. Computes `allowedTemplateIds` based on `programType === "PASS"` vs. otherwise, and returns 400 with a clear message if `templateId` is not in the allowed set. The existing duplicate-assignment guard and `assignedById` logic are unchanged.

### Task 3 — `app/ops/students/[enrollmentId]/FormsSection.tsx`
Added a `{assignment.status === "IN_PROGRESS" && !assignment.submission && (...)}` block rendering `<p className="text-xs text-blue-500 mt-1">Aluno iniciou o preenchimento.</p>` below the date paragraph and above the NPS block. Verified `statusLabel("IN_PROGRESS")` → "Em andamento" and `statusBadgeClass("IN_PROGRESS")` → `"bg-blue-100 text-blue-700"` already existed. Verified `activeTemplateIds` already excludes PENDING and IN_PROGRESS templates from the dropdown.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `app/api/hub/forms/[id]/route.ts` — modified and committed (11aed29)
- `app/api/ops/forms/assign/route.ts` — modified and committed (7a4fcf1)
- `app/ops/students/[enrollmentId]/FormsSection.tsx` — modified and committed (4e102f9)
- `npx tsc --noEmit` passes (only pre-existing unrelated error in tests/ai/model-selection.test.ts)
