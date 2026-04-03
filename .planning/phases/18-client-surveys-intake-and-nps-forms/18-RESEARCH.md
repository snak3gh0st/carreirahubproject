# Phase 18: Client Surveys - Intake and NPS Forms - Research

**Researched:** 2026-04-03
**Domain:** Form management, NPS surveys, client portal, ops portal integration
**Confidence:** HIGH — deep codebase audit, all patterns verified against existing code

---

## Summary

Phase 18 adds structured survey capability to the Carreira AI Hub in two forms: (1) intake surveys automatically assigned when a student is enrolled, and (2) periodic NPS (Net Promoter Score) surveys that measure student satisfaction at key journey milestones.

The critical discovery from this research is that **the core form infrastructure already exists and is production-ready.** The system has `FormAssignment`, `FormSubmission`, and `FormTemplate` concepts fully implemented in the Prisma schema, with client-facing Hub pages (`/hub/forms/*`), dashboard admin management (`/dashboard/forms/*`), and API routes on both the Hub side (`/api/hub/forms/*`) and Dashboard side (`/api/dashboard/forms/*`). What does NOT exist is: an NPS form template in `FORM_TEMPLATES`, auto-assignment of the intake form on enrollment, ops-side form management (forms are only assignable from the Dashboard portal, not the Ops Hub), NPS score surface in the Student Profile or Coordinator view, and the `RPT-01` requirement for coordinator NPS visibility.

Phase 18 is therefore primarily a **content + wiring + ops-surface** phase, not an infrastructure build. The planner should decompose around: adding NPS template content, hooking enrollment to auto-assign the intake form, building an ops-side form assignment panel on the student profile, and surfacing NPS scores in the coordinator and student profile views.

**Primary recommendation:** Extend the existing form system — never duplicate it. Add NPS as a new `FORM_TEMPLATES` entry, auto-assign intake on enrollment inside `mentorshipService.createEnrollment()`, and build ops-facing views within `/ops/students/[enrollmentId]` to show and assign forms without touching the dashboard portal.

---

## Standard Stack

### Core (already installed — no new installs required)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Prisma + PostgreSQL (Neon) | 5.x | FormAssignment, FormSubmission models | Already in use |
| Next.js 14 App Router | 14.x | Route handlers, Server Components | Already in use |
| @tanstack/react-query | ^5.90.17 | Client-side data fetching in ops profile | Already in use |
| zod | ^3.23.0 | API route validation | Already in use |
| sonner | ^2.0.7 | Toast feedback | Already in use |
| AWS S3 (`@aws-sdk/client-s3`) | latest | File uploads for form attachments | Already in use |
| next-auth | latest | Auth for ops/dashboard routes | Already in use |
| jose (custom hub-auth) | latest | Auth for hub routes | Already in use |

**Installation:** No new dependencies needed for this phase.

### No New Dependencies

The form infrastructure was built to be extensible via the `FORM_TEMPLATES` constant in `lib/hub/form-templates.ts`. New form types are added as new keys in that constant — no schema migration, no new libraries, no new API routes for the standard flow.

---

## Architecture Patterns

### Existing Form Infrastructure (verified by code audit)

```
lib/
  hub/
    form-templates.ts          ← FORM_TEMPLATES constant (TypeScript, not DB)
                                  Currently has: onboarding-career, onboarding-pass
                                  Missing: NPS template(s)

app/
  hub/
    forms/
      page.tsx                 ← Client list of assigned forms (Server Component)
      [id]/
        page.tsx               ← Client form fill page (Client Component)
  api/
    hub/
      forms/
        route.ts               ← GET: list assignments for client
        [id]/
          route.ts             ← GET: assignment + template detail
          submit/route.ts      ← POST: submit answers (transaction)
          upload/route.ts      ← POST: S3 file upload
  dashboard/
    forms/
      page.tsx                 ← Admin list all assignments (Server Component)
      assign/
        page.tsx               ← Admin assign form to customer(s)
      submissions/
        [id]/page.tsx          ← Admin view submission detail
  api/
    dashboard/
      forms/
        assign/route.ts        ← POST: assign template to customer(s)
        assignments/route.ts   ← GET: list with filters (status, customerId)
        submissions/[id]/route.ts ← GET: submission detail
```

### Pattern 1: Template-based Form System

**What:** Form content lives entirely in `lib/hub/form-templates.ts` as a typed TypeScript constant. Database stores only the assignment metadata (`templateId` string) and submission answers (`answers: Json`). Template rendering is done at query time by joining the static constant with the DB record.

**When to use:** All new form types (NPS, additional intake variants) follow this pattern. NEVER create a DB table for form question definitions.

**Example — adding NPS template:**
```typescript
// lib/hub/form-templates.ts
export const FORM_TEMPLATES: Record<string, FormTemplate> = {
  "onboarding-pass": { /* existing */ },
  "nps-midpoint": {
    id: "nps-midpoint",
    title: "How is your journey going?",
    titlePt: "Como está sendo sua jornada?",
    description: "Quick feedback to help us serve you better.",
    descriptionPt: "Seu feedback nos ajuda a melhorar.",
    fields: [
      {
        id: "npsScore",
        type: "scale",
        label: "How likely are you to recommend Carreira USA to a friend?",
        labelPt: "Qual a probabilidade de você recomendar a Carreira USA a um amigo?",
        required: true,
        scaleMin: 0,
        scaleMax: 10,
        scaleMinLabel: "Not likely",
        scaleMinLabelPt: "Pouco provável",
        scaleMaxLabel: "Extremely likely",
        scaleMaxLabelPt: "Muito provável",
      },
      // additional qualitative questions
    ],
  },
};
```

### Pattern 2: Form Assignment (ops-triggered)

**What:** An ops or dashboard user creates a `FormAssignment` record linking a `templateId` to a `customerId`. The Hub client then sees the form in `/hub/forms`.

**Existing entry point:** `POST /api/dashboard/forms/assign` — used by the Dashboard portal only.

**Gap:** The Ops Hub has no form assignment capability. The ops customer page (`/ops/customers/[id]/page.tsx`) shows a "Atribuir formulario" link that navigates to `/dashboard/forms/assign?customerId=...`, crossing portal boundaries. This is an existing design limitation that Phase 18 should address by adding form assignment to the ops student profile.

**New ops entry point needed:** `POST /api/ops/forms/assign` (ADMIN | OPERATIONAL roles, same pattern as other ops routes).

### Pattern 3: Auto-Assignment on Enrollment

**What:** When a student is enrolled via `POST /api/ops/enrollments`, the `mentorshipService.createEnrollment()` method atomically creates the enrollment + initial phase transition. Phase 18 should extend this transaction to also create a `FormAssignment` for the appropriate intake form based on `programType`.

**Where to add:**
```typescript
// lib/services/mentorship.service.ts — createEnrollment method
// Inside the existing prisma.$transaction callback, after creating enrollment:

const intakeTemplateId = programType === "PASS" ? "onboarding-pass" : "onboarding-career";
await tx.formAssignment.create({
  data: {
    templateId: intakeTemplateId,
    customerId,
    assignedById: triggeredById,
  },
});
```

**Why inside the transaction:** Ensures enrollment and intake assignment are atomic — a rollback on enrollment failure also rolls back the form assignment.

### Pattern 4: NPS Score Extraction from FormSubmission

**What:** NPS scores are stored as arbitrary JSON in `FormSubmission.answers`. To surface the NPS score in the Student Profile and Coordinator views, a helper extracts the score from the submission answers.

**Pattern:**
```typescript
// lib/hub/form-templates.ts or a new lib/ops/nps.ts helper
export function extractNpsScore(
  submissions: FormSubmission[],
  templateId: string
): number | null {
  const sub = submissions.find(
    (s) => s.assignment.templateId === templateId && s.answers
  );
  if (!sub) return null;
  const answers = sub.answers as Record<string, unknown>;
  const score = answers["npsScore"];
  return typeof score === "number" ? score : null;
}
```

**Note:** The NPS score field ID must be `npsScore` in the template definition and consistently referenced by the extraction helper. This is a naming contract between the template and the display layer.

### Pattern 5: Ops-Side Form Panel in Student Profile

**What:** The student profile at `/ops/students/[enrollmentId]` (rendered by `StudentProfileClient.tsx`) already uses React Query to fetch enrollment data. A new "Forms" section should be added showing:
- Currently assigned forms and their status
- An "Assign Form" action (dropdown of available templates + assign button)
- Link to view submission detail

**Data source:** Add form assignments to the enrollment detail API response OR create a dedicated `GET /api/ops/enrollments/[id]/forms` route.

**Recommendation:** Add to the existing enrollment detail API (`GET /api/ops/enrollments/[id]`) by including `formAssignments` in the Prisma query. This avoids an extra round trip and matches the established pattern (the same route already includes `placementTest` via a secondary query).

### Recommended Project Structure for Phase 18

No new directories needed. Additions are to existing files and patterns:

```
lib/
  hub/
    form-templates.ts          ← ADD nps-entry and nps-exit templates
  ops/
    (no new files needed)

app/
  api/
    ops/
      forms/
        assign/route.ts        ← NEW: POST assign form from ops portal
      enrollments/
        [id]/
          route.ts             ← EXTEND: include formAssignments in response
    
  ops/
    students/
      [enrollmentId]/
        StudentProfileClient.tsx ← EXTEND: add Forms section
        FormsSection.tsx        ← NEW: dedicated component for forms tab
```

### Anti-Patterns to Avoid

- **Duplicating form infrastructure in the Ops portal:** The ops portal must reuse `lib/hub/form-templates.ts` for template definitions and the existing `FormAssignment`/`FormSubmission` schema. Never create separate "ops form" models.
- **Cross-portal navigation for form assignment:** The existing `ops/customers/[id]` page currently links to `/dashboard/forms/assign`. Phase 18 should replace this with ops-native assignment so users stay in the Ops portal.
- **Storing NPS score as a separate DB column:** NPS answers live in `FormSubmission.answers: Json` — extract them at query time, never denormalize into a separate column.
- **Rendering scale/NPS fields differently from existing form UI:** The `scale` FieldType already renders as a row of numbered buttons in the client form. NPS uses the same field type with `scaleMin=0, scaleMax=10`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form field rendering | Custom NPS UI widget | Existing `scale` field type in form-templates | Already renders 0-10 buttons with labels |
| File upload for intake | Custom upload handler | Existing `/api/hub/forms/[id]/upload/route.ts` | S3 + MIME validation + sanitization already done |
| Form assignment CRUD | New ORM layer | Existing `FormAssignment` Prisma model + `createMany` | Schema, indexes, constraints already in place |
| Submission viewing | New submission renderer | Existing `/dashboard/forms/submissions/[id]/page.tsx` | Full field-type-aware rendering already exists |
| Auth for hub forms | Custom middleware | `getHubAuth()` from `lib/hub-auth.ts` | JWT verification + CSRF already handled |
| Auth for ops forms | Custom middleware | `getServerSession(authOptions)` + role check | Pattern used by all `/api/ops/*` routes |
| i18n for form labels | New translation keys | Existing `labelPt` / `hintPt` fields in FormField | Both portals already read `isPt` to toggle language |

**Key insight:** The form system was designed for extensibility. Adding new survey types is additive (new template entries) — not structural. The only structural additions in this phase are the ops-side assignment UI and the NPS score surface.

---

## Common Pitfalls

### Pitfall 1: Duplicate Form Assignment on Re-enrollment

**What goes wrong:** If a student's enrollment is completed and they re-enroll, `createEnrollment` runs again and creates a second intake form assignment. The client sees two "Intake" forms in their hub.

**Why it happens:** `formAssignment.createMany` does not check for existing assignments for the same `templateId` + `customerId`.

**How to avoid:** Before creating the intake form assignment, check for an existing `PENDING` or `IN_PROGRESS` assignment for the same template:
```typescript
const existing = await tx.formAssignment.findFirst({
  where: { customerId, templateId: intakeTemplateId, status: { not: "COMPLETED" } },
});
if (!existing) {
  await tx.formAssignment.create({ data: { ... } });
}
```

**Warning signs:** Client hub shows duplicate form entries; `formAssignments` count on coordinator view inflates.

### Pitfall 2: NPS Score Extraction Fails Silently

**What goes wrong:** The coordinator sees `null` NPS scores for students who have submitted NPS forms, because the field ID in the template doesn't match the extraction helper.

**Why it happens:** `FormSubmission.answers` is a `Json` column — Prisma types it as `Prisma.JsonValue`, which requires explicit casting. A typo in the field ID key produces `undefined` silently.

**How to avoid:** Define the NPS score field ID as a named constant: `const NPS_SCORE_FIELD_ID = "npsScore"`. Use that constant in both the template definition and the extraction helper. Add a type guard in the extractor.

**Warning signs:** `extractNpsScore()` always returns `null` even after NPS form submission.

### Pitfall 3: Ops Form Assignment Bypasses Hub Auth

**What goes wrong:** The new `POST /api/ops/forms/assign` route assigns forms correctly in DB, but when the client visits `/hub/forms`, the API calls `getHubAuth(request)` using the `hub-token` cookie. If the ops route uses `getServerSession` (NextAuth), the form is created fine — but the hub rendering must use hub-auth. The portals use different auth mechanisms.

**Why it happens:** Ops routes use `getServerSession` (NextAuth JWT). Hub routes use `getHubAuth` (custom jose JWT in `hub-token` cookie). Both can write to `FormAssignment` — the table is portal-neutral.

**How to avoid:** This is already working correctly in the existing system — the `/api/dashboard/forms/assign` route uses `getServerSession` to create assignments that the hub then reads via `getHubAuth`. The new ops assign route follows the same pattern. No mixing needed.

**Warning signs:** `401 Unauthorized` on `/api/hub/forms` after ops assigns a form — check `hub-token` cookie is present and not expired.

### Pitfall 4: FormSubmission.answers JSON Type in Prisma

**What goes wrong:** TypeScript errors when accessing `submission.answers["npsScore"]` because `Prisma.JsonValue` is typed as `string | number | boolean | null | JsonObject | JsonArray`.

**Why it happens:** Prisma types `Json` fields conservatively.

**How to avoid:** Cast explicitly:
```typescript
const answers = submission.answers as Record<string, unknown>;
const score = answers["npsScore"];
const npsScore = typeof score === "number" ? score : null;
```
This pattern is already used in the submission detail page (`renderFieldValue` function).

### Pitfall 5: Ops Sidebar Missing Forms Entry

**What goes wrong:** The ops sidebar (`components/ops/ops-sidebar.tsx`) has no entry for form management. Users can assign forms from the student profile but have no dedicated forms overview in the ops portal.

**Why it happens:** The forms list currently lives at `/dashboard/forms` — it was built before the Ops Hub existed.

**How to avoid:** Either add a forms nav item to the ops sidebar pointing to a new `/ops/forms` page, or accept that form management is done from the student profile. The student profile integration is the minimum viable approach; an ops-level forms list is a enhancement.

**Warning signs:** Ops team cannot see pending NPS form completions across all students without navigating to each student profile individually.

---

## Code Examples

### Extending createEnrollment to Auto-Assign Intake Form

```typescript
// Source: lib/services/mentorship.service.ts — createEnrollment
// Inside the prisma.$transaction async callback, after creating enrollment + transition:

const intakeTemplateId =
  programType === "PASS" ? "onboarding-pass" : "onboarding-career";

const existingIntake = await tx.formAssignment.findFirst({
  where: {
    customerId,
    templateId: intakeTemplateId,
    status: { not: "COMPLETED" },
  },
});

if (!existingIntake) {
  await tx.formAssignment.create({
    data: {
      templateId: intakeTemplateId,
      customerId,
      assignedById: triggeredById,
    },
  });
}
```

### NPS Template Definition

```typescript
// Source: lib/hub/form-templates.ts — add to FORM_TEMPLATES
export const NPS_SCORE_FIELD = "npsScore";

"nps-entry": {
  id: "nps-entry",
  title: "Carreira USA — Entry Feedback",
  titlePt: "Carreira USA — Feedback de Entrada",
  description: "Help us understand your expectations at the start of your journey.",
  descriptionPt: "Nos ajude a entender suas expectativas no início da sua jornada.",
  fields: [
    {
      id: NPS_SCORE_FIELD,
      type: "scale",
      label: "How likely are you to recommend Carreira USA to a friend or colleague? (0 = Not at all likely, 10 = Extremely likely)",
      labelPt: "Qual a probabilidade de você recomendar a Carreira USA a um amigo ou colega? (0 = Muito improvável, 10 = Extremamente provável)",
      required: true,
      scaleMin: 0,
      scaleMax: 10,
      scaleMinLabel: "0 — Not likely",
      scaleMinLabelPt: "0 — Pouco provável",
      scaleMaxLabel: "10 — Extremely likely",
      scaleMaxLabelPt: "10 — Muito provável",
    },
    {
      id: "npsComment",
      type: "textarea",
      label: "What is the main reason for your score?",
      labelPt: "Qual é o principal motivo da sua nota?",
      required: false,
    },
  ],
},
```

### Ops Form Assignment API Route

```typescript
// Source: app/api/ops/forms/assign/route.ts (new file — follows existing ops pattern)
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FORM_TEMPLATES } from "@/lib/hub/form-templates";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  customerId: z.string().min(1),
  templateId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userRole = (session.user as any).role;
  if (!["ADMIN", "OPERATIONAL"].includes(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { customerId, templateId } = parsed.data;
  if (!FORM_TEMPLATES[templateId]) {
    return NextResponse.json({ error: "Template not found" }, { status: 400 });
  }
  const assignedById = (session.user as any).id;
  const assignment = await prisma.formAssignment.create({
    data: { templateId, customerId, assignedById },
  });
  return NextResponse.json({ assignment }, { status: 201 });
}
```

### NPS Score Extraction Helper

```typescript
// Source: lib/ops/nps.ts (new file)
import { NPS_SCORE_FIELD } from "@/lib/hub/form-templates";

export interface NpsResult {
  score: number;
  comment: string | null;
  submittedAt: Date;
  templateId: string;
}

export function extractNpsFromSubmissions(
  submissions: Array<{
    answers: unknown;
    submittedAt: Date;
    assignment: { templateId: string };
  }>,
  templateIds: string[]  // e.g. ["nps-entry", "nps-exit"]
): NpsResult[] {
  return submissions
    .filter((s) => templateIds.includes(s.assignment.templateId))
    .map((s) => {
      const answers = s.answers as Record<string, unknown>;
      const score = answers[NPS_SCORE_FIELD];
      const comment = answers["npsComment"];
      return {
        score: typeof score === "number" ? score : -1,
        comment: typeof comment === "string" ? comment : null,
        submittedAt: s.submittedAt,
        templateId: s.assignment.templateId,
      };
    })
    .filter((r) => r.score >= 0);
}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| N/A — new feature | Template-as-constant pattern (no DB for form structure) | Established in existing codebase — follow it |
| Dashboard-only form management | Add ops-side management in Phase 18 | Forms historically managed from Dashboard; Phase 18 moves management into Ops Hub |
| Manual NPS form assignment | Auto-assignment on enrollment for intake + manual NPS | Intake auto-assigned; NPS manually assigned by ops at journey milestones |

**No deprecated patterns in this phase** — the existing form infrastructure is current and in use.

---

## Open Questions

1. **NPS Survey Cadence — How many NPS templates are needed?**
   - What we know: `RPT-01` requires coordinator to see NPS entry/exit scores. This implies at minimum two NPS surveys: one at enrollment/entry and one at program completion/exit.
   - What's unclear: Should there be a midpoint survey? Are there distinct template IDs for entry vs. exit, or one template reused?
   - Recommendation: Implement `nps-entry` (auto-assigned at enrollment, alongside intake) and `nps-exit` (manually assigned by ops when student reaches final phase or completes). Midpoint is optional and can be deferred.

2. **Where does NPS score surface in the Coordinator view?**
   - What we know: `RPT-01` says coordinator sees NPS entry/exit scores per student on their profile. The coordinator page at `/ops/coordinator` shows phase distribution and debtors — no per-student detail.
   - What's unclear: Does this mean the student profile page (already at `/ops/students/[enrollmentId]`) or the coordinator dashboard page?
   - Recommendation: Surface NPS scores on the Student Profile (`StudentProfileClient.tsx`) — the coordinator accesses student profiles from the pipeline board or coordinator page. No change to the coordinator overview page is needed for `RPT-01`.

3. **Should intake form auto-assignment be skippable?**
   - What we know: The existing enrollment flow has no mechanism to skip form assignment.
   - What's unclear: What if a student already completed intake via a previous enrollment period?
   - Recommendation: Use the guard pattern (check for non-COMPLETED existing assignment before creating) — described in Pitfall 1. This handles re-enrollment gracefully without requiring a skip toggle.

4. **Ops-side forms overview page — needed or optional?**
   - What we know: Form management currently lives at `/dashboard/forms`. Ops users navigating to the student profile can see that student's forms. There is no ops-level view of all pending NPS forms across all students.
   - What's unclear: Whether the team needs a cross-student forms status view in the Ops portal.
   - Recommendation: Build as part of Phase 18 if the coordinator needs to see NPS completion rates across all students. Otherwise, the student profile integration is sufficient for the minimum viable `RPT-01` requirement.

---

## Environment Availability

Step 2.6: No new external dependencies. AWS S3, PostgreSQL (Neon), and all authentication providers are already configured and operational. This phase requires no additional environment setup.

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| PostgreSQL (Neon) | FormAssignment/Submission queries | Yes | In use by existing form system |
| AWS S3 | File uploads in intake form | Yes | `S3_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` already used by `/api/hub/forms/[id]/upload` |
| NextAuth | Ops API auth | Yes | All ops routes already use this |
| Hub JWT (jose) | Hub API auth | Yes | `getHubAuth()` used by all hub form routes |

---

## Validation Architecture

No automated test infrastructure exists in this project (no `pytest.ini`, `jest.config.*`, `vitest.config.*`, or `tests/` directory found). Validation for this phase is manual verification.

### Phase Gate Checklist (Manual)

| Behavior | Test Method |
|----------|-------------|
| Enrolling a student auto-assigns intake form | Enroll a student, check `/hub/forms` as that client — intake form should appear |
| NPS template renders correctly in Hub | Assign `nps-entry` via ops, open `/hub/forms/[id]` as client — 0-10 scale renders |
| Ops form assign action works | From student profile, assign a form — appears in client's `/hub/forms` |
| NPS score appears on student profile | Submit NPS form as client, view student profile in ops — score renders |
| Duplicate intake guard works | Enroll same student twice (re-enroll after completing) — only one pending intake form |
| All form types still work | Submit `onboarding-pass` form as client — existing functionality unaffected |

---

## Sources

### Primary (HIGH confidence — direct code audit)

- `/lib/hub/form-templates.ts` — FormTemplate type, FORM_TEMPLATES constant, existing templates
- `/prisma/schema.prisma` — FormAssignment, FormSubmission models, FormAssignmentStatus enum
- `/app/api/hub/forms/` — Hub-side API: list, detail, submit, upload
- `/app/api/dashboard/forms/` — Dashboard-side API: assign, list assignments, submission detail
- `/app/api/ops/enrollments/route.ts` — Enrollment creation flow
- `/lib/services/mentorship.service.ts` — createEnrollment atomic transaction
- `/components/ops/ops-sidebar.tsx` — Current ops nav items
- `/app/ops/students/[enrollmentId]/StudentProfileClient.tsx` — React Query pattern in student profile
- `.planning/REQUIREMENTS.md` — RPT-01 requirement definition

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` decisions log — confirmed no prior decisions lock form implementation approach
- `.planning/ROADMAP.md` — Phase 18 goal and dependency on Phase 17

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in `package.json` and active codebase usage
- Architecture: HIGH — all patterns derived from existing code, not assumptions
- Pitfalls: HIGH — derived from direct inspection of schema constraints and existing code paths
- NPS template content: MEDIUM — field structure is established but specific questions TBD by product owner

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable domain; schema or template changes would invalidate)
