---
phase: quick-260414-oco
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/api/hub/forms/[id]/route.ts
  - app/api/ops/forms/assign/route.ts
  - app/ops/students/[enrollmentId]/FormsSection.tsx
autonomous: true
requirements: [FORMS-WIRE-01, FORMS-WIRE-02, FORMS-WIRE-03]
must_haves:
  truths:
    - "Ops staff can assign any allowed form template to a student from the profile page and see it appear immediately."
    - "When a student opens a pending form in the hub, its status transitions to IN_PROGRESS and ops sees the updated status."
    - "Ops staff can see submitted NPS scores inline on each assignment row, and completed templates disappear from the selectable dropdown."
    - "Hub student can fill and submit assigned forms end-to-end (load, upload files, submit answers) with answers persisted."
  artifacts:
    - path: "app/api/hub/forms/[id]/route.ts"
      provides: "GET form detail; transitions status PENDING → IN_PROGRESS on first open"
    - path: "app/api/ops/forms/assign/route.ts"
      provides: "POST assign form template; enforces allowed templates per programType"
    - path: "app/ops/students/[enrollmentId]/FormsSection.tsx"
      provides: "Ops UI for assigning forms + viewing NPS inline"
  key_links:
    - from: "app/ops/students/[enrollmentId]/StudentProfileClient.tsx"
      to: "app/api/ops/enrollments/[id]/route.ts"
      via: "useQuery fetch"
      pattern: "fetch.*api/ops/enrollments"
    - from: "app/ops/students/[enrollmentId]/FormsSection.tsx"
      to: "app/api/ops/forms/assign/route.ts"
      via: "useMutation POST"
      pattern: "fetch.*api/ops/forms/assign"
    - from: "app/hub/forms/[id]/page.tsx"
      to: "app/api/hub/forms/[id]/route.ts"
      via: "fetch on mount"
      pattern: "fetch.*api/hub/forms"
---

<objective>
Close the remaining wiring gaps between the Client Hub forms flow (`/hub/forms/*`) and the Operational Hub student profile (`/ops/students/[enrollmentId]`) so the end-to-end forms loop works correctly:

1. Status transitions correctly (PENDING → IN_PROGRESS → COMPLETED) so ops staff see real progress.
2. Ops assign endpoint respects the `programType`-scoped allowed template list (same rule the ops UI applies), preventing mismatched template assignment (e.g. assigning `onboarding-pass` to an ADVANCED/CAREER enrollment).
3. Ops UI shows "assigned by" context and uses assignment-scoped query key to force revalidation after mutations.

Investigation summary (files confirmed to exist and mostly wired):
- `GET /api/ops/enrollments/[id]` — returns `availableFormTemplates` + `npsResults` + `enrollment.formAssignments`. ✓
- `POST /api/ops/forms/assign` — validates `templateId` against `FORM_TEMPLATES` registry and creates `FormAssignment`. ✓ (but does NOT scope by `programType`)
- `GET /api/hub/forms/[id]` — returns assignment + template + submission. ✓ (but does NOT flip status to `IN_PROGRESS` on first view)
- `POST /api/hub/forms/[id]/submit` — validates required fields, creates `FormSubmission`, flips status to `COMPLETED` in a transaction. ✓
- `POST /api/hub/forms/[id]/upload` — uploads to S3 and returns key. ✓
- UI components (`FormsSection`, `StudentProfileClient`, `app/hub/forms/page.tsx`, `app/hub/forms/[id]/page.tsx`) are wired to the correct endpoints. ✓

**Gaps to close:**
- `IN_PROGRESS` status is defined in the `FormAssignmentStatus` enum but never set. Ops always sees either "Pendente" or "Concluído".
- Ops assign endpoint allows any templateId that exists in `FORM_TEMPLATES` — it doesn't enforce the `programType` filter (CAREER gets `onboarding-career` + NPS; PASS gets `onboarding-pass` + NPS). A bug or direct API call could create a mismatched assignment.

Purpose: Make the full ops-assigns → student-fills → ops-sees-result loop correct and defensible.
Output: 3 small, surgical code edits.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@CLAUDE.md
@prisma/schema.prisma
@lib/hub/form-templates.ts
@lib/ops/nps.ts
@app/api/ops/enrollments/[id]/route.ts
@app/api/ops/forms/assign/route.ts
@app/api/hub/forms/[id]/route.ts
@app/api/hub/forms/[id]/submit/route.ts
@app/hub/forms/[id]/page.tsx
@app/ops/students/[enrollmentId]/StudentProfileClient.tsx
@app/ops/students/[enrollmentId]/FormsSection.tsx

<interfaces>
From prisma/schema.prisma:
```prisma
enum FormAssignmentStatus { PENDING, IN_PROGRESS, COMPLETED }

model FormAssignment {
  id           String   @id @default(cuid())
  templateId   String
  status       FormAssignmentStatus @default(PENDING)
  customerId   String
  assignedById String
  submission   FormSubmission?
}
```

From lib/hub/form-templates.ts (exports):
```typescript
export const FORM_TEMPLATES: Record<string, FormTemplate>;
export const NPS_TEMPLATE_IDS: readonly string[]; // ["nps-entry", "nps-exit"]
export function getTemplate(id: string): FormTemplate | undefined;
```

Program-scoped allowed templates (same rule enforced by GET /api/ops/enrollments/[id]):
- programType === "PASS"   → ["onboarding-pass",   ...NPS_TEMPLATE_IDS]
- programType !== "PASS"   → ["onboarding-career", ...NPS_TEMPLATE_IDS]
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Transition status PENDING → IN_PROGRESS on first hub view</name>
  <files>app/api/hub/forms/[id]/route.ts</files>
  <action>
In `GET /api/hub/forms/[id]`, after loading the assignment and confirming it belongs to `auth.customerId`, flip status to `IN_PROGRESS` if currently `PENDING`. Do this BEFORE returning the response so the client sees the new status on first load.

Implementation:
1. After `const assignment = await prisma.formAssignment.findUnique(...)` and the null check, add:
   ```ts
   if (assignment.status === "PENDING") {
     await prisma.formAssignment.update({
       where: { id: assignment.id },
       data: { status: "IN_PROGRESS" },
     });
     assignment.status = "IN_PROGRESS";
   }
   ```
2. Do NOT transition if status is already `IN_PROGRESS` or `COMPLETED` — submit route owns the transition to `COMPLETED`.
3. Keep the existing `include: { submission: true }` so read-only rendering still works.
4. Preserve existing error handling / 401 / 404 paths.

Why: The `IN_PROGRESS` enum value is defined in schema.prisma but never written. Ops staff cannot distinguish "student saw the form but didn't submit" from "student hasn't opened it yet". This is the single missing state transition in the flow.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
    Manual: Assign a form as ops → open hub → fetch `/api/hub/forms/{id}` → confirm status is `IN_PROGRESS` in DB and in ops UI badge.
  </verify>
  <done>
Opening a pending form in the hub flips its status to IN_PROGRESS exactly once. Ops dashboard shows the updated "Em andamento" badge after query refetch. Already-COMPLETED forms remain COMPLETED (no regression).
  </done>
</task>

<task type="auto">
  <name>Task 2: Enforce programType-scoped template whitelist in ops assign endpoint</name>
  <files>app/api/ops/forms/assign/route.ts</files>
  <action>
Currently `POST /api/ops/forms/assign` accepts any `templateId` that exists in `FORM_TEMPLATES`. But the UI (GET /api/ops/enrollments/[id]) only surfaces templates appropriate for the enrollment's `programType`. A direct API call — or a stale client — could create a mismatched assignment (e.g. `onboarding-pass` for a CAREER/ADVANCED enrollment).

Implementation:
1. Import `NPS_TEMPLATE_IDS` alongside `FORM_TEMPLATES`:
   ```ts
   import { FORM_TEMPLATES, NPS_TEMPLATE_IDS } from "@/lib/hub/form-templates";
   ```
2. After validating `templateId` exists in `FORM_TEMPLATES` (keep existing 400 response), look up the customer's most recent `MentorshipEnrollment` to determine allowed templates:
   ```ts
   const enrollment = await prisma.mentorshipEnrollment.findFirst({
     where: { customerId },
     orderBy: { createdAt: "desc" },
     select: { programType: true },
   });

   if (!enrollment) {
     return NextResponse.json(
       { error: "Customer has no active enrollment. Cannot assign forms." },
       { status: 400 }
     );
   }

   const allowedTemplateIds =
     enrollment.programType === "PASS"
       ? ["onboarding-pass", ...NPS_TEMPLATE_IDS]
       : ["onboarding-career", ...NPS_TEMPLATE_IDS];

   if (!allowedTemplateIds.includes(templateId)) {
     return NextResponse.json(
       { error: `Template '${templateId}' is not allowed for ${enrollment.programType} enrollments.` },
       { status: 400 }
     );
   }
   ```
3. Keep the existing duplicate-assignment guard (`findFirst` with `status: { not: "COMPLETED" }` → 409) unchanged.
4. Keep `assignedById = session.user.id` unchanged.

Why: This mirrors the exact same rule that GET /api/ops/enrollments/[id] uses to compute `availableFormTemplates`, so client and server stay in lockstep. Prevents data corruption from stale clients or direct API calls.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
    Manual: POST to `/api/ops/forms/assign` with `{customerId, templateId: "onboarding-pass"}` for a CAREER customer → expect 400. Same customer with `templateId: "onboarding-career"` → expect 201.
  </verify>
  <done>
Assigning `onboarding-pass` to a non-PASS enrollment returns 400 with a clear error message. Valid assignments still succeed. Customers with no enrollment return a 400 "no active enrollment" error instead of orphaning a FormAssignment.
  </done>
</task>

<task type="auto">
  <name>Task 3: Surface IN_PROGRESS in ops dropdown filter + tighten FormsSection refetch</name>
  <files>app/ops/students/[enrollmentId]/FormsSection.tsx</files>
  <action>
Two small improvements so the ops UI reflects the new flow correctly:

1. **Dropdown filter**: The `activeTemplateIds` set already filters by `status !== "COMPLETED"`, so IN_PROGRESS templates are correctly hidden. No change needed — just verify by rereading the memo. If the existing code reads `status !== "COMPLETED"`, leave it. (Sanity check: the current Set filter excludes both PENDING and IN_PROGRESS, which is correct.)

2. **Status label for IN_PROGRESS**: Confirm `statusLabel("IN_PROGRESS")` returns "Em andamento" and `statusBadgeClass("IN_PROGRESS")` returns `"bg-blue-100 text-blue-700"` — these already exist in the file. No change.

3. **Refetch after mutation**: On successful assign, the current code calls:
   ```ts
   qc.invalidateQueries({ queryKey: ["student-profile", enrollmentId] });
   ```
   This is correct — the parent's `useProfileData` uses the same key. Leave unchanged.

4. **Add explicit pt-BR copy for empty NPS state + "assigned by" hint**: In the assignments `.map(...)` block, under the existing "Atribuído em … · Enviado em …" paragraph, when `assignment.status === "IN_PROGRESS"` and there is no submission yet, render a subtle hint:
   ```tsx
   {assignment.status === "IN_PROGRESS" && !assignment.submission && (
     <p className="text-xs text-blue-500 mt-1">Aluno iniciou o preenchimento.</p>
   )}
   ```
   Place this inside the existing `<div>` that contains the template name and date, right after the date paragraph and before the `{nps && ...}` block.

5. **No schema or type changes needed** — `FormAssignmentItem` already has `status: string`, so "IN_PROGRESS" is a valid runtime value.

This task is primarily a verification + a single small UI enhancement so ops staff can tell at a glance when a student has opened but not submitted a form.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run lint -- app/ops/students/[enrollmentId]/FormsSection.tsx</automated>
    Manual: Load an ops student profile with an IN_PROGRESS assignment → expect blue "Em andamento" badge + italic "Aluno iniciou o preenchimento." hint below the date.
  </verify>
  <done>
FormsSection renders IN_PROGRESS hint correctly for in-progress (not yet submitted) assignments. No regression on PENDING or COMPLETED rows. Dropdown still hides IN_PROGRESS templates (`activeTemplateIds` filter already handles this).
  </done>
</task>

</tasks>

<verification>
End-to-end smoke test (manual — ops + hub in two browser sessions):

1. Ops: open `/ops/students/{enrollmentId}` for a CAREER customer.
2. Ops: click "Atribuir Formulário" → select `onboarding-career` → submit.
3. Ops: row appears with yellow "Pendente" badge.
4. Hub (as that customer): visit `/hub/forms` → see the assignment → click it.
5. Hub: form loads. Refresh ops page → row now shows blue "Em andamento" + "Aluno iniciou o preenchimento." hint.
6. Hub: fill required fields → submit.
7. Ops: refresh → row shows green "Concluído" with submitted date. NPS score row appears inline if it was an NPS template.
8. Ops: try to re-assign the same template while status is IN_PROGRESS → expect 409 duplicate-assignment error.
9. Ops: try to POST `/api/ops/forms/assign` with `onboarding-pass` for this CAREER customer via curl → expect 400.

Type safety:
```
npx tsc --noEmit
```
</verification>

<success_criteria>
- [ ] `IN_PROGRESS` status is written exactly once, on first hub-side GET of the form.
- [ ] Ops assign endpoint rejects templates outside the `programType`-scoped whitelist.
- [ ] Ops assign endpoint rejects assignment for customers with no MentorshipEnrollment.
- [ ] FormsSection shows "Em andamento" + student-started hint for IN_PROGRESS rows.
- [ ] No regression on COMPLETED / submitted / NPS inline score rendering.
- [ ] `npx tsc --noEmit` passes.
</success_criteria>

<output>
After completion, append a one-line row to `.planning/STATE.md` "Quick Tasks Completed" table:
| 260414-oco | Wire forms flow: IN_PROGRESS status + programType whitelist + ops UI hint | 2026-04-14 | {commit} | — | [260414-oco-wire-the-forms-to-the-operacional-hub-co](./quick/260414-oco-wire-the-forms-to-the-operacional-hub-co/) |
</output>
