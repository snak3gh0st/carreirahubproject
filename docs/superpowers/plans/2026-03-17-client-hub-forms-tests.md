# Client Hub Forms + English Test Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add onboarding forms (operator assigns, client fills) and English placement test (25-question CEFR scoring) to the existing Client Hub.

**Architecture:** Hardcoded form templates and test questions in TypeScript files under `lib/hub/`. DB models for assignments, submissions, and test results. Hub pages for clients under `/hub/forms` and `/hub/test`. Admin pages under `/dashboard/forms`. S3 for file uploads. All within existing hub JWT auth and admin NextAuth systems.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma/PostgreSQL, AWS S3 (existing), hub JWT auth, admin NextAuth

**Spec:** `docs/superpowers/specs/2026-03-17-client-hub-forms-tests-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `lib/hub/form-templates.ts` | Hardcoded form templates with bilingual labels |
| `lib/hub/english-test.ts` | 25 questions (QUESTIONS + ANSWER_KEY) + scoring algorithm |
| `app/api/hub/forms/route.ts` | GET: list assigned forms for client |
| `app/api/hub/forms/[id]/route.ts` | GET: assignment detail + template fields |
| `app/api/hub/forms/[id]/submit/route.ts` | POST: submit form answers |
| `app/api/hub/forms/[id]/upload/route.ts` | POST: upload file for form field |
| `app/api/hub/test/route.ts` | GET: test questions (no answers) |
| `app/api/hub/test/submit/route.ts` | POST: submit answers, return score |
| `app/api/hub/test/result/route.ts` | GET: latest test result |
| `app/hub/forms/page.tsx` | Client: list assigned forms |
| `app/hub/forms/[id]/page.tsx` | Client: fill/view form |
| `app/hub/test/page.tsx` | Client: take test (section by section) |
| `app/hub/test/result/page.tsx` | Client: view result |
| `app/api/dashboard/forms/assignments/route.ts` | Admin GET: list all assignments |
| `app/api/dashboard/forms/assign/route.ts` | Admin POST: assign template to customer |
| `app/api/dashboard/forms/submissions/[id]/route.ts` | Admin GET: view submission |
| `app/dashboard/forms/page.tsx` | Admin: list assignments |
| `app/dashboard/forms/assign/page.tsx` | Admin: assign form to customer |
| `app/dashboard/forms/submissions/[id]/page.tsx` | Admin: view answers |

### Modified Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add FormAssignment, FormSubmission, PlacementTest, FormAssignmentStatus |
| `app/hub/page.tsx` | Add Forms + English Level cards after summary cards |
| `middleware.ts` | Add routeRoleMap entry for `/dashboard/forms` |

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add models and enum**

Add to `prisma/schema.prisma`:

```prisma
enum FormAssignmentStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
}

model FormAssignment {
  id           String               @id @default(cuid())
  templateId   String
  status       FormAssignmentStatus @default(PENDING)
  assignedAt   DateTime             @default(now())
  updatedAt    DateTime             @updatedAt

  customerId   String
  customer     Customer             @relation(fields: [customerId], references: [id])
  assignedById String
  assignedBy   User                 @relation("AssignedForms", fields: [assignedById], references: [id])
  submission   FormSubmission?

  @@index([customerId])
  @@map("form_assignments")
}

model FormSubmission {
  id           String         @id @default(cuid())
  answers      Json
  submittedAt  DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  assignmentId String         @unique
  assignment   FormAssignment @relation(fields: [assignmentId], references: [id])
  customerId   String
  customer     Customer       @relation(fields: [customerId], references: [id])

  @@index([customerId])
  @@map("form_submissions")
}

model PlacementTest {
  id               String   @id @default(cuid())
  section1Score    Int
  section2Score    Int
  section3Score    Int
  section4Score    Int
  section5Score    Int
  totalScore       Int
  percentage       Float
  cefrLevel        String
  displayLevel     String
  timeSpentSeconds Int?
  answers          Json
  createdAt        DateTime @default(now())

  customerId       String
  customer         Customer @relation(fields: [customerId], references: [id])

  @@index([customerId])
  @@map("placement_tests")
}
```

Add to `Customer` model relations:
```prisma
  formAssignments  FormAssignment[]
  formSubmissions  FormSubmission[]
  placementTests   PlacementTest[]
```

Add to `User` model relations:
```prisma
  formAssignments  FormAssignment[]  @relation("AssignedForms")
```

- [ ] **Step 2: Run migration**

```bash
npx prisma db push
npx prisma generate
```

- [ ] **Step 3: Add middleware RBAC**

In `middleware.ts`, add to `routeRoleMap`:
```typescript
{ prefix: "/dashboard/forms", roles: ["ADMIN", "OPERATIONAL", "SALES"] },
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma middleware.ts
git commit -m "feat(hub): add FormAssignment, FormSubmission, PlacementTest models"
```

---

## Task 2: Form Templates + English Test Data

**Files:**
- Create: `lib/hub/form-templates.ts`
- Create: `lib/hub/english-test.ts`

- [ ] **Step 1: Create form templates**

`lib/hub/form-templates.ts` — one placeholder template ("onboarding-career") with bilingual labels. Field types: text, textarea, date, file, select. Each field has: id, type, label, labelPt, required, options (for select).

Export: `FORM_TEMPLATES` object keyed by template slug, `FormField` type, `FormTemplate` type, `getTemplate(slug)` helper.

- [ ] **Step 2: Create English test questions + scoring**

`lib/hub/english-test.ts` — 25 questions in 5 sections. Two separate exports:

`QUESTIONS`: Array of `{ id, section, question, options: string[], passage?: string }` — NO correct answer included. This is what the API serves to the client.

`ANSWER_KEY`: Record of `{ [questionId]: correctOptionIndex }` — used server-side only.

`calculateScore(answers)`: Takes `{ [questionId]: selectedIndex }`, compares against ANSWER_KEY, returns `{ sectionScores, totalScore, percentage, cefrLevel, displayLevel }`. Uses contiguous algorithm (highest section N where ALL 1..N scored ≥3/5).

`DISPLAY_LEVELS`: Maps CEFR to display labels (EN + PT).

Questions cover:
- Section 1 (A1-A2): basic vocab, verb "to be", simple present
- Section 2 (A2-B1): past tense, prepositions, expressions
- Section 3 (B1-B2): present perfect, conditionals, reading passage
- Section 4 (B2-C1): complex tenses, passive voice, fill-in-blank
- Section 5 (C1-C2): subjunctive, idioms, error identification

Tailor to career/immigration context where possible.

- [ ] **Step 3: Commit**

```bash
git add lib/hub/form-templates.ts lib/hub/english-test.ts
git commit -m "feat(hub): add form templates and English test questions with CEFR scoring"
```

---

## Task 3: Hub Form APIs

**Files:**
- Create: `app/api/hub/forms/route.ts`
- Create: `app/api/hub/forms/[id]/route.ts`
- Create: `app/api/hub/forms/[id]/submit/route.ts`
- Create: `app/api/hub/forms/[id]/upload/route.ts`

- [ ] **Step 1: Create forms list API**

`GET /api/hub/forms`:
- Auth via `getHubAuth(request)`
- Query: `prisma.formAssignment.findMany({ where: { customerId }, include: { submission: true }, orderBy: { assignedAt: "desc" } })`
- Enrich each with template title from `FORM_TEMPLATES`
- Return: `{ forms: [{ id, templateId, title, status, assignedAt, submittedAt? }] }`

- [ ] **Step 2: Create form detail API**

`GET /api/hub/forms/[id]`:
- Auth + verify assignment belongs to customer
- Load template from `FORM_TEMPLATES[assignment.templateId]`
- Include submission if exists
- Return: `{ assignment, template, submission? }`

- [ ] **Step 3: Create form submit API**

`POST /api/hub/forms/[id]/submit`:
- Auth + CSRF + verify ownership
- Body: `{ answers: { [fieldId]: value } }`
- Validate required fields from template
- Create `FormSubmission`, update assignment status to COMPLETED
- Return: `{ success: true }`

- [ ] **Step 4: Create file upload API**

`POST /api/hub/forms/[id]/upload`:
- Auth + verify ownership
- Accept multipart form data with file + fieldId
- Validate: MIME type (pdf, jpeg, png, doc, docx), size ≤ 10MB, sanitize filename
- Upload to S3 at `forms/{customerId}/{assignmentId}/{fieldId}/{sanitizedFilename}`
- Use existing `documentStorageService` pattern (S3Client from `@aws-sdk/client-s3`)
- Return: `{ url: s3Key }`

- [ ] **Step 5: Commit**

```bash
git add app/api/hub/forms/
git commit -m "feat(hub): add form list, detail, submit, and upload APIs"
```

---

## Task 4: Hub Test APIs

**Files:**
- Create: `app/api/hub/test/route.ts`
- Create: `app/api/hub/test/submit/route.ts`
- Create: `app/api/hub/test/result/route.ts`

- [ ] **Step 1: Create test questions API**

`GET /api/hub/test`:
- Auth via `getHubAuth(request)`
- Return `QUESTIONS` from `english-test.ts` (no answers)
- Return: `{ questions: [...] }`

- [ ] **Step 2: Create test submit API**

`POST /api/hub/test/submit`:
- Auth + CSRF
- Body: `{ answers: { [questionId]: selectedIndex }, timeSpentSeconds }`
- Call `calculateScore(answers)` from `english-test.ts`
- Create `PlacementTest` record (all attempts stored)
- Return: `{ score: { sectionScores, totalScore, percentage, cefrLevel, displayLevel } }`

- [ ] **Step 3: Create test result API**

`GET /api/hub/test/result`:
- Auth
- Query: `prisma.placementTest.findFirst({ where: { customerId }, orderBy: { createdAt: "desc" } })`
- Return latest result or `{ result: null }` if never taken

- [ ] **Step 4: Commit**

```bash
git add app/api/hub/test/
git commit -m "feat(hub): add English test questions, submit, and result APIs"
```

---

## Task 5: Admin Form APIs

**Files:**
- Create: `app/api/dashboard/forms/assignments/route.ts`
- Create: `app/api/dashboard/forms/assign/route.ts`
- Create: `app/api/dashboard/forms/submissions/[id]/route.ts`

- [ ] **Step 1: Create assignments list API**

`GET /api/dashboard/forms/assignments`:
- Auth via `getServerSession(authOptions)`, check role
- Query all assignments with customer name, template title, status
- Support filtering by `?status=PENDING` and `?customerId=xxx`
- Return: `{ assignments: [...] }`

- [ ] **Step 2: Create assign API**

`POST /api/dashboard/forms/assign`:
- Auth + role check
- Body: `{ customerId: string | string[], templateId: string }`
- Validate templateId exists in `FORM_TEMPLATES`
- Create FormAssignment(s) for each customerId
- Return: `{ success: true, count }`

- [ ] **Step 3: Create submission view API**

`GET /api/dashboard/forms/submissions/[id]`:
- Auth + role check
- Load submission with assignment + customer
- Enrich with template fields from `FORM_TEMPLATES`
- Return: `{ submission, template, customer }`

- [ ] **Step 4: Commit**

```bash
git add app/api/dashboard/forms/
git commit -m "feat(hub): add admin form assignment and submission APIs"
```

---

## Task 6: Hub Form Pages

**Files:**
- Create: `app/hub/forms/page.tsx`
- Create: `app/hub/forms/[id]/page.tsx`

- [ ] **Step 1: Create forms list page**

Server component. Fetches `/api/hub/forms`. Shows list of assigned forms with status badges (Pending/Completed). Each row links to `/hub/forms/[id]`. Carreira Gold branding, consistent with hub dashboard style.

- [ ] **Step 2: Create form fill page**

Client component (`"use client"`). Fetches template + assignment. Renders form fields dynamically:
- `text` → input
- `textarea` → textarea
- `number` → input type=number
- `date` → input type=date
- `select` → select dropdown with options
- `checkbox` → checkbox
- `file` → file input with upload to `/api/hub/forms/[id]/upload`, show uploaded filename

Bilingual labels based on hub language. Required field validation. Submit button posts to `/api/hub/forms/[id]/submit`. On success → redirect to `/hub/forms`.

If already submitted → show answers read-only.

- [ ] **Step 3: Commit**

```bash
git add app/hub/forms/
git commit -m "feat(hub): add forms list and fill pages"
```

---

## Task 7: Hub Test Pages

**Files:**
- Create: `app/hub/test/page.tsx`
- Create: `app/hub/test/result/page.tsx`

- [ ] **Step 1: Create test page**

Client component. Fetches questions from `/api/hub/test`. UI flow:

1. Intro screen: "English Assessment — 25 questions, ~10-15 minutes" + "Start" button
2. On start: timer begins, show Section 1 (5 questions)
3. Each question: question text + 4 radio button options (+ passage if present)
4. "Next Section" button after answering all 5
5. Repeat for sections 2-5
6. After section 5: "Submit" button
7. POST answers + timeSpentSeconds to `/api/hub/test/submit`
8. Redirect to `/hub/test/result`

Progress bar showing section 1/5, 2/5, etc.

- [ ] **Step 2: Create result page**

Server component. Fetches latest result via API or direct Prisma query. Shows:
- Level badge (large, colored): "Intermediário" / "Intermediate"
- CEFR level: "B1"
- Score: "15/25 (60%)"
- Section breakdown: 5 bars showing score per section
- "Retake" button → links to `/hub/test`
- Time spent

- [ ] **Step 3: Commit**

```bash
git add app/hub/test/
git commit -m "feat(hub): add English test and result pages"
```

---

## Task 8: Hub Dashboard Cards

**Files:**
- Modify: `app/hub/page.tsx`

- [ ] **Step 1: Add Forms + English Level cards**

After the summary cards (line ~147, after the 3-column grid closes) and before the invoice list heading (line ~150), add a 2-column grid:

Card 1 — Forms:
- Query: `prisma.formAssignment.count({ where: { customerId, status: "PENDING" } })`
- If pending > 0: "Forms — {n} pending — [Fill Now →]"
- If all completed: "Forms — All completed ✓ — [View →]"
- If none assigned: don't show card
- Link to `/hub/forms`

Card 2 — English Level:
- Query: `prisma.placementTest.findFirst({ where: { customerId }, orderBy: { createdAt: "desc" } })`
- If no result: "English Level — Not taken yet — [Take Test →]"
- If result: show displayLevel + cefrLevel + score + [Retake →]
- Link to `/hub/test` or `/hub/test/result`

Style consistent with existing summary cards (rounded-2xl, shadow-sm, border, icon).

- [ ] **Step 2: Commit**

```bash
git add app/hub/page.tsx
git commit -m "feat(hub): add Forms and English Level cards to dashboard"
```

---

## Task 9: Admin Form Pages

**Files:**
- Create: `app/dashboard/forms/page.tsx`
- Create: `app/dashboard/forms/assign/page.tsx`
- Create: `app/dashboard/forms/submissions/[id]/page.tsx`

- [ ] **Step 1: Create assignments list page**

Server component. Auth via `getServerSession`. Fetches all form assignments with customer name, template title, status. Table with columns: Customer | Template | Status | Assigned Date | Actions. Filter by status dropdown. Link to view submission (if completed). Link to assign page.

Follow existing admin patterns: table layout, hover states, status badges, pagination if needed.

- [ ] **Step 2: Create assign page**

Client component. Two dropdowns:
1. Select customer (search/autocomplete from `/api/customers` or similar existing endpoint)
2. Select template (from `FORM_TEMPLATES` — loaded client-side since it's hardcoded)

"Assign" button → POST to `/api/dashboard/forms/assign`. Success toast → redirect to list.

- [ ] **Step 3: Create submission view page**

Server component. Fetches submission + template. Renders each field label + answer. For file fields: show download link (presigned S3 URL). Read-only view.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/forms/
git commit -m "feat(hub): add admin form assignment and submission pages"
```

---

## Task 10: Final Integration

- [ ] **Step 1: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 2: Test full flow locally**

Forms:
1. Create a FormAssignment via admin API
2. Login to hub → see Forms card on dashboard
3. Open form → fill fields → submit
4. Check admin → view submission

English Test:
1. Login to hub → see English Level card
2. Click "Take Test" → answer 25 questions
3. Submit → see result with level
4. Retake → verify latest result shown

- [ ] **Step 3: Commit and push**

```bash
git add -A
git commit -m "feat(hub): Forms + English Test complete"
git push origin main
```
