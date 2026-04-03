---
phase: 18-client-surveys-intake-and-nps-forms
verified: 2026-04-03T19:00:00Z
status: passed
score: 10/10 must-haves verified
gaps: []
human_verification:
  - test: "Open /ops/students/[enrollmentId], assign nps-entry, submit from /hub/forms/[id], confirm NPS Entrada badge appears in header"
    expected: "NPS badge with score/10 renders in the header card; assignment row shows inline NPS score"
    why_human: "Full end-to-end form submission flow requires a live session, Hub auth cookie, and database state"
  - test: "Enroll a PASS student and a non-PASS student; open /hub/forms for each"
    expected: "PASS student has 'onboarding-pass' assigned; non-PASS student has 'onboarding-career' assigned"
    why_human: "Requires live database writes and two distinct enrollment flows"
  - test: "Re-enroll an already-enrolled student whose intake form is still pending"
    expected: "No second intake formAssignment row is created; the existing pending assignment is preserved"
    why_human: "Duplicate-guard relies on database state across two sequential enrollment calls"
  - test: "Attempt to assign nps-entry from ops profile, then attempt to assign nps-entry again"
    expected: "Second attempt returns HTTP 409 and ops UI shows a toast error without creating a duplicate row"
    why_human: "Requires live browser interaction with the ops profile and network inspection"
---

# Phase 18: Client Surveys — Intake and NPS Forms Verification Report

**Phase Goal:** Extend the existing form system so intake surveys are auto-assigned at enrollment, ops can manage intake/NPS forms from the student profile, and NPS entry/exit feedback is visible in the Ops Hub without cross-portal navigation
**Verified:** 2026-04-03T19:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `FORM_TEMPLATES` exports `nps-entry` and `nps-exit` without replacing existing onboarding templates | VERIFIED | `lib/hub/form-templates.ts` lines 310–376: both templates defined; `onboarding-career` (line 56) and `onboarding-pass` (line 127) unchanged |
| 2 | `NPS_SCORE_FIELD` is the single source of truth for the 0-10 answer key | VERIFIED | Line 45: `export const NPS_SCORE_FIELD = "npsScore"`. Used as `id: NPS_SCORE_FIELD` in both NPS templates; imported and reused by `lib/ops/nps.ts` line 1 |
| 3 | Hub form detail page renders NPS templates through the existing `scale` field path with `scaleMin: 0` and `scaleMax: 10` | VERIFIED | `app/hub/forms/[id]/page.tsx` lines 245-278: `field.type === "scale"` renderer with `field.scaleMin ?? 1` / `field.scaleMax ?? 10`; NPS templates set `scaleMin: 0, scaleMax: 10` |
| 4 | Hub list/detail pages show Portuguese copy when `lang === "pt-BR"` | VERIFIED | List page (`app/hub/forms/page.tsx` line 63): `lang === "pt-BR" ? tpl?.titlePt : tpl?.title`. Detail page (`app/hub/forms/[id]/page.tsx` line 74): `isPt` guard on `titlePt`, `descriptionPt`, `labelPt`, `scaleMinLabelPt`, `scaleMaxLabelPt` |
| 5 | Creating an enrollment auto-assigns the correct onboarding form for PASS vs ADVANCED | VERIFIED | `lib/services/mentorship.service.ts` lines 86-127: `intakeTemplateId = programType === "PASS" ? "onboarding-pass" : "onboarding-career"`, `tx.formAssignment.create` inside the Prisma transaction |
| 6 | Re-enrollment or repeated assignment does not create a second non-completed intake assignment | VERIFIED | `mentorship.service.ts` lines 111-127: `tx.formAssignment.findFirst({ where: { customerId, templateId, status: { not: "COMPLETED" } } })` guard before create |
| 7 | Ops form assignment stays inside `/api/ops/*` with NextAuth role checks and known template validation | VERIFIED | `app/api/ops/forms/assign/route.ts`: `getServerSession(authOptions)` (line 16), `["ADMIN", "OPERATIONAL"].includes(userRole)` (line 22), `FORM_TEMPLATES[templateId]` check (line 33), duplicate guard (lines 37-49) |
| 8 | Student profile API returns form assignments, available assignable templates, and extracted NPS results | VERIFIED | `app/api/ops/enrollments/[id]/route.ts` lines 53-115: `formAssignments` from parallel Promise.all, `availableFormTemplates` array computed per programType, `npsResults` via `extractNpsFromSubmissions()`, all returned in single response |
| 9 | Student profile shows a Forms section with assigned templates, statuses, and dates; ops can assign inline | VERIFIED | `app/ops/students/[enrollmentId]/FormsSection.tsx`: status badges (lines 30-50), assigned/submitted dates (lines 205-210), `POST /api/ops/forms/assign` mutation (lines 87-110), `invalidateQueries({ queryKey: ["student-profile", enrollmentId] })` (line 103), "Atribuir Formulário" (line 143) |
| 10 | Completed NPS entry/exit submissions render as score badges on the student profile header | VERIFIED | `app/ops/students/[enrollmentId]/StudentProfileClient.tsx` lines 157-168: `data.npsResults.map(result => "NPS Entrada" / "NPS Saída" badge with `{result.score}/10`)` |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `lib/hub/form-templates.ts` | NPS template definitions, `NPS_SCORE_FIELD`, `NPS_TEMPLATE_IDS`, `FORM_TEMPLATES`, `getTemplate` | VERIFIED | All exports confirmed present; `nps-entry` and `nps-exit` fully defined with EN/PT-BR copy, `scaleMin: 0`, `scaleMax: 10` |
| `app/hub/forms/page.tsx` | Localized hub form list cards | VERIFIED | Substantive: renders from DB query, uses `titlePt` guard, shows status badges |
| `app/hub/forms/[id]/page.tsx` | Localized hub form detail page with scale renderer | VERIFIED | Substantive: full form renderer, `isPt` guards on all field copy, scale renderer with `scaleMin ?? 1` / `scaleMax ?? 10` defaults |
| `lib/services/mentorship.service.ts` | Duplicate-safe intake auto-assignment inside enrollment transaction | VERIFIED | `createEnrollment` adds `formAssignment` inside `prisma.$transaction`; `findFirst` guard prevents duplicates |
| `lib/ops/nps.ts` | `extractNpsFromSubmissions` shared helper | VERIFIED | Exports `extractNpsFromSubmissions`; imports `NPS_SCORE_FIELD` and `NPS_TEMPLATE_IDS`; safely casts JSON; filters `score >= 0` |
| `app/api/ops/forms/assign/route.ts` | Ops-native assignment endpoint (`POST`) | VERIFIED | Auth guard, RBAC check, Zod validation, template existence check, duplicate guard, `201` response |
| `app/api/ops/enrollments/[id]/route.ts` | Enrollment detail API with forms and NPS data | VERIFIED | Parallel fetch for `formAssignments` with submission include; `availableFormTemplates`; `npsResults`; existing fields preserved |
| `app/ops/students/[enrollmentId]/FormsSection.tsx` | Forms list, empty state, and inline assign action | VERIFIED | Client component with full mutation flow, status badges, empty state copy, duplicate template filtering via `useMemo` Set |
| `app/ops/students/[enrollmentId]/StudentProfileClient.tsx` | Student profile header with NPS badges and embedded FormsSection | VERIFIED | `ProfileData` type extended with `formAssignments`, `availableFormTemplates`, `npsResults`; NPS badges rendered; `FormsSection` embedded between timeline and SessionSection |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/api/hub/forms/[id]/route.ts` | `lib/hub/form-templates.ts` | `getTemplate(assignment.templateId)` | WIRED | `import { getTemplate }` line 4; `getTemplate(assignment.templateId)` line 36 |
| `app/hub/forms/[id]/page.tsx` | `template.fields` | `field.type === "scale"` renderer | WIRED | Scale renderer at line 245; `field.scaleMin ?? 1`, `field.scaleMax ?? 10` |
| `app/api/ops/enrollments/route.ts` | `lib/services/mentorship.service.ts` | `mentorshipService.createEnrollment` | WIRED | `import { mentorshipService }` line 4; `mentorshipService.createEnrollment({...})` line 38 |
| `app/api/ops/enrollments/[id]/route.ts` | `lib/ops/nps.ts` | `extractNpsFromSubmissions` | WIRED | `import { extractNpsFromSubmissions }` line 6; called at line 95 |
| `app/api/ops/forms/assign/route.ts` | `lib/hub/form-templates.ts` | `FORM_TEMPLATES[templateId]` | WIRED | `import { FORM_TEMPLATES }` line 6; `FORM_TEMPLATES[templateId]` check line 33 |
| `app/ops/students/[enrollmentId]/FormsSection.tsx` | `/api/ops/forms/assign` | React Query mutation (POST) | WIRED | `fetch("/api/ops/forms/assign", { method: "POST" })` lines 89-93 |
| `app/ops/students/[enrollmentId]/FormsSection.tsx` | `["student-profile", enrollmentId]` | `invalidateQueries` after assignment | WIRED | `qc.invalidateQueries({ queryKey: ["student-profile", enrollmentId] })` line 103 |
| `app/ops/students/[enrollmentId]/StudentProfileClient.tsx` | `npsResults` | Header badge rendering | WIRED | `data.npsResults.map(result => ...)` lines 159-166; badge shows `"NPS Entrada" / "NPS Saída": {result.score}/10` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `FormsSection.tsx` | `assignments` | `enrollment.formAssignments` from parent `useProfileData` query | Yes — Prisma `formAssignment.findMany` in `enrollments/[id]/route.ts` line 62 | FLOWING |
| `FormsSection.tsx` | `availableTemplates` | `availableFormTemplates` from parent query | Yes — computed from `FORM_TEMPLATES` with real DB `programType` in route line 78-93 | FLOWING |
| `FormsSection.tsx` | `npsResults` | `npsResults` from parent query | Yes — `extractNpsFromSubmissions` processes live `submission.answers` JSON from DB | FLOWING |
| `StudentProfileClient.tsx` | `npsResults` | `useProfileData` query → `/api/ops/enrollments/${enrollmentId}` | Yes — same as above | FLOWING |
| `app/hub/forms/page.tsx` | `assignments` | `prisma.formAssignment.findMany` (line 42) | Yes — direct Prisma query with `customerId` from JWT | FLOWING |
| `app/hub/forms/[id]/page.tsx` | `template` | `fetch(/api/hub/forms/${assignmentId})` → `getTemplate()` | Yes — `getTemplate(assignment.templateId)` in hub forms API returns real template definition | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `lib/hub/form-templates.ts` exports `NPS_SCORE_FIELD`, `NPS_TEMPLATE_IDS`, `getTemplate` | `grep -c "export const NPS_SCORE_FIELD\|export const NPS_TEMPLATE_IDS\|export function getTemplate" lib/hub/form-templates.ts` | 3 matches | PASS |
| `lib/ops/nps.ts` exports `extractNpsFromSubmissions` | File read — function defined and exported at line 10 | Present and substantive | PASS |
| `app/api/ops/forms/assign/route.ts` exports `POST` with auth and RBAC | File read — `export async function POST`, `getServerSession`, ADMIN/OPERATIONAL check, Zod, FORM_TEMPLATES guard | All present | PASS |
| `app/api/ops/enrollments/[id]/route.ts` returns `formAssignments`, `availableFormTemplates`, `npsResults`, `workflow` | File read — all 4 fields confirmed in `NextResponse.json({...})` lines 105-115 | All present | PASS |
| TypeScript compiler passes | `npx tsc --noEmit` | Exit 0, no output | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SURV-01 | 18-01-PLAN | Form template registry includes NPS entry and NPS exit surveys rendering through the existing Hub form system without new schema | SATISFIED | `FORM_TEMPLATES` contains `nps-entry` and `nps-exit` using existing `scale` field type; `getTemplate()` returns them via hub forms API; hub list/detail pages render them through existing pipeline |
| SURV-02 | 18-02-PLAN | Enrolling a student auto-assigns the correct intake form for their program type without duplicate pending/in-progress intake assignments | SATISFIED | `mentorship.service.ts` `createEnrollment` resolves `intakeTemplateId` by `programType` and guards with `findFirst` before `tx.formAssignment.create` |
| SURV-03 | 18-02-PLAN, 18-03-PLAN | Ops team member can assign supported survey templates directly from the Ops Hub profile without leaving the Ops portal | SATISFIED | `POST /api/ops/forms/assign` is an Ops-native route (ADMIN/OPERATIONAL RBAC); `FormsSection.tsx` calls it inline; no dashboard redirect required |
| SURV-04 | 18-03-PLAN | Student profile shows assigned forms, submission status, and completed NPS entry/exit scores for coordinator visibility | SATISFIED | `FormsSection` renders assignment list with `Pendente`/`Em andamento`/`Concluído` badges and dates; `StudentProfileClient` renders NPS Entrada/Saída score badges in header |

No orphaned requirements — all four SURV-0x IDs are claimed by plans and verified in code.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/hub/forms/[id]/page.tsx` | 45-48 | `useState<any>(null)` for `template`, `assignment`, `submission`, `answers` — broad `any` types | Info | Type safety only; does not affect runtime behavior or goal. The API response is typed on the server side. |
| `app/api/ops/forms/assign/route.ts` | 21 | `(session.user as any).role` cast | Info | Common pattern in this codebase; not a stub or behavioral gap |

No blocker or warning anti-patterns. No TODOs, placeholder returns, hardcoded empty data, or stub handlers found in Phase 18 files.

---

### Human Verification Required

#### 1. End-to-End NPS Survey Submission and Badge Visibility

**Test:** Log into Hub as a student who has an `nps-entry` assignment. Open `/hub/forms/[id]` for that assignment. Select a score and submit. Then open `/ops/students/[enrollmentId]` for that student.
**Expected:** The NPS Entrada badge appears in the header card showing `NPS Entrada: {score}/10`. The FormsSection row shows status "Concluido" with the submission date.
**Why human:** Requires an active Hub JWT cookie, a real form submission POST, and the Ops portal session simultaneously.

#### 2. PASS vs ADVANCED Intake Auto-Assignment

**Test:** Create two enrollments — one with `programType: "PASS"`, one with any other type. Open `/hub/forms` for each student's client account.
**Expected:** PASS student sees "Programa Pass — Queremos te Conhecer"; non-PASS student sees "Career Onboarding Form".
**Why human:** Requires live database writes with distinct program types and Hub auth per client.

#### 3. Duplicate Assignment Prevention (Re-enrollment)

**Test:** Enroll a student, then attempt to enroll the same student again while the intake form is still pending.
**Expected:** Only one `formAssignment` row exists for the student/template combination; no second pending intake is created.
**Why human:** Requires sequential enrollment API calls and direct DB inspection.

#### 4. Duplicate Ops Assignment — 409 Response

**Test:** From the Ops student profile FormsSection, assign `nps-entry`. Without submitting it, attempt to assign `nps-entry` again from the same profile.
**Expected:** The dropdown hides `nps-entry` (it is in `activeTemplateIds`), so the duplicate is prevented client-side. If called directly via API, returns HTTP 409.
**Why human:** The client-side `useMemo` filter is the primary UX guard; requires visual browser inspection plus optional API test.

---

### Gaps Summary

No gaps found. All ten observable truths are verified, all nine required artifacts exist and are substantive and wired, all eight key links are confirmed, and TypeScript passes with zero errors. The four SURV requirements (SURV-01 through SURV-04) are fully satisfied by code that exists in the codebase.

The four human verification items above are not gaps — they are behavioral confirmations that require a running application and live session state and are outside the scope of static code verification.

---

_Verified: 2026-04-03T19:00:00Z_
_Verifier: Claude (gsd-verifier)_
