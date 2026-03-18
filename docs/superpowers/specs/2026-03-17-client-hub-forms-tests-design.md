# Client Hub — Forms + English Test Design

**Date**: 2026-03-17
**Status**: Approved
**Scope**: Hub Phase 3 (Forms) + Phase 4 (English Test)
**Depends on**: Hub Phase 1 (auth, dashboard, invoices)

---

## Overview

Add two features to the Client Hub:

1. **Onboarding Forms** — hardcoded form templates that operators assign to clients. Clients fill them in the hub. Operators view submissions in the admin dashboard.

2. **English Placement Test** — 25-question multiple choice test with CEFR scoring. Clients take it in the hub. Results visible to both client and operator.

Both features appear as summary cards on the hub dashboard alongside existing invoice cards.

---

## 1. Form Builder

### Templates — Hardcoded in Code

Templates are NOT stored in the database. They are TypeScript objects in `lib/hub/form-templates.ts`. New templates are added by developers.

```typescript
// lib/hub/form-templates.ts
export const FORM_TEMPLATES = {
  "onboarding-career": {
    id: "onboarding-career",
    title: "Career Services — Personal Information",
    titlePt: "Serviços de Carreira — Dados Pessoais",
    description: "Please complete your personal information to get started.",
    descriptionPt: "Por favor, preencha seus dados pessoais para começar.",
    fields: [
      { id: "fullName", type: "text", label: "Full Legal Name", labelPt: "Nome Completo", required: true },
      { id: "dob", type: "date", label: "Date of Birth", labelPt: "Data de Nascimento", required: true },
      { id: "phone", type: "text", label: "Phone Number", labelPt: "Telefone", required: true },
      { id: "address", type: "text", label: "Current Address", labelPt: "Endereço Atual", required: true },
      { id: "resume", type: "file", label: "Resume / CV", labelPt: "Currículo", required: true },
      { id: "workExperience", type: "textarea", label: "Work Experience Summary", labelPt: "Resumo da Experiência Profissional", required: false },
      { id: "desiredRole", type: "text", label: "Desired Role in the USA", labelPt: "Cargo Desejado nos EUA", required: false },
      { id: "linkedIn", type: "text", label: "LinkedIn Profile", labelPt: "Perfil LinkedIn", required: false },
    ],
  },
};
```

**Supported field types**: `text`, `textarea`, `number`, `date`, `select` (dropdown with options array), `checkbox`, `file` (upload)

### File Upload Security

- Allowed MIME types: `application/pdf`, `image/jpeg`, `image/png`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Max file size: 10 MB
- Filenames sanitized: strip path separators, limit to 255 chars, replace special characters

### Data Models

```prisma
model FormAssignment {
  id          String               @id @default(cuid())
  templateId  String               // slug from FORM_TEMPLATES
  status      FormAssignmentStatus @default(PENDING)
  assignedAt  DateTime             @default(now())
  updatedAt   DateTime             @updatedAt

  customerId  String
  customer    Customer             @relation(fields: [customerId], references: [id])
  assignedById String
  assignedBy  User                 @relation("AssignedForms", fields: [assignedById], references: [id])
  submission  FormSubmission?

  @@index([customerId])
  @@map("form_assignments")
}

model FormSubmission {
  id            String         @id @default(cuid())
  answers       Json           // { fieldId: value } map
  submittedAt   DateTime       @default(now())

  assignmentId  String         @unique
  assignment    FormAssignment @relation(fields: [assignmentId], references: [id])
  customerId    String
  customer      Customer       @relation(fields: [customerId], references: [id])
  updatedAt     DateTime       @updatedAt

  @@index([customerId])
  @@map("form_submissions")
}

enum FormAssignmentStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
}
```

Add to Customer model:
```prisma
  formAssignments  FormAssignment[]
  formSubmissions  FormSubmission[]
```

Add to User model:
```prisma
  formAssignments  FormAssignment[]  @relation("AssignedForms")
```

### Flow

1. Operator in admin → `/dashboard/forms/assign` → picks customer + template → creates `FormAssignment`
2. Client sees card on hub dashboard: "1 form pending — Fill Now"
3. Client opens `/hub/forms/[assignmentId]` → sees form fields rendered from template
4. Client fills in and submits → `FormSubmission` created, assignment status → COMPLETED
5. Operator views submissions at `/dashboard/forms/submissions/[id]`

### File Uploads

Files uploaded via the form use the existing S3 integration (already in the project for contract storage). Files stored at `forms/{customerId}/{assignmentId}/{fieldId}/{filename}`. Upload endpoint: `POST /api/hub/forms/[id]/upload`.

---

## 2. English Placement Test

### Test Structure

25 questions, 5 sections of ascending difficulty. All hardcoded in `lib/hub/english-test.ts`.

| Section | Level | Topics | Format |
|---------|-------|--------|--------|
| 1 (Q1-5) | A1-A2 | Basic vocab, verb "to be", simple present | Multiple choice (4 options) |
| 2 (Q6-10) | A2-B1 | Past tense, prepositions, common expressions | Multiple choice |
| 3 (Q11-15) | B1-B2 | Present perfect, conditionals, reading comprehension | Multiple choice + short passage |
| 4 (Q16-20) | B2-C1 | Complex tenses, passive voice, formal register | Multiple choice + fill-in-blank |
| 5 (Q21-25) | C1-C2 | Subjunctive, idioms, subtle distinctions | Multiple choice + error identification |

Questions tailored to career/immigration context (workplace vocabulary, daily life in the USA, common false cognates for Portuguese speakers).

**Data structure**: `english-test.ts` exports `QUESTIONS` (without correct answers) and `ANSWER_KEY` (separate). The API route serves only `QUESTIONS` to the client, preventing answer leakage.

### Scoring

**Algorithm**: Section-based, **contiguous**. The client's level is the highest section N such that ALL sections 1 through N scored ≥ 3/5 (60%). If a lower section is failed, higher sections are ignored even if passed.

```
Section scores: [5, 4, 3, 1, 0]
→ Sections 1, 2, 3 all ≥3 (contiguous) → Level: B1

Section scores: [2, 4, 3, 1, 0]
→ Section 1 failed → Level: A1 (even though sections 2-3 passed)
```

**CEFR to display level mapping:**

| CEFR | Display (EN) | Display (PT) |
|------|-------------|-------------|
| A1-A2 | Beginner | Iniciante |
| B1 | Intermediate | Intermediário |
| B2 | Advanced | Avançado |
| C1-C2 | Fluent | Fluente |

### Data Model

```prisma
model PlacementTest {
  id               String   @id @default(cuid())
  section1Score    Int      // 0-5
  section2Score    Int      // 0-5
  section3Score    Int      // 0-5
  section4Score    Int      // 0-5
  section5Score    Int      // 0-5
  totalScore       Int      // 0-25
  percentage       Float    // 0-100
  cefrLevel        String   // A1, A2, B1, B2, C1, C2
  displayLevel     String   // Beginner, Intermediate, Advanced, Fluent
  timeSpentSeconds Int?
  answers          Json     // full answer record
  createdAt        DateTime @default(now())

  customerId       String
  customer         Customer @relation(fields: [customerId], references: [id])

  @@index([customerId])
  @@map("placement_tests")
}
```

Add to Customer model:
```prisma
  placementTests   PlacementTest[]
```

### Retake Policy

Client can retake. Only the latest result is displayed. All attempts are stored in DB (history), but the UI shows only the most recent.

---

## 3. Hub Pages

### Dashboard Cards (added to existing `/hub` page)

Between the summary cards (Total Due, etc.) and the invoice list, add two cards:

```
┌──────────────────┐  ┌──────────────────┐
│ Forms             │  │ English Level    │
│ 1 pending         │  │ Not taken yet    │
│ [Fill Now →]      │  │ [Take Test →]    │
└──────────────────┘  └──────────────────┘
```

After completion:
```
┌──────────────────┐  ┌──────────────────┐
│ Forms             │  │ English Level    │
│ All completed ✓   │  │ Intermediário    │
│ [View →]          │  │ B1 · 15/25      │
│                   │  │ [Retake →]       │
└──────────────────┘  └──────────────────┘
```

### New Hub Routes

| Route | Purpose |
|-------|---------|
| `/hub/forms` | List all assigned forms (pending + completed) |
| `/hub/forms/[id]` | Fill/view a specific form |
| `/hub/test` | Take English test (25 questions, one page per section or all-in-one) |
| `/hub/test/result` | View latest result |

### Test UI Flow

1. Client clicks "Take Test" → `/hub/test`
2. Sees intro: "25 questions, ~10-15 minutes, tests your English level"
3. Clicks "Start" → timer begins
4. Questions displayed one section at a time (5 questions per page, "Next" button)
5. After last section → submit all answers
6. Redirect to `/hub/test/result` with score breakdown + level badge

---

## 4. Admin Pages

| Route | Purpose |
|-------|---------|
| `/dashboard/forms` | List all form assignments (filterable by status, customer) |
| `/dashboard/forms/assign` | Assign a template to one or more customers |
| `/dashboard/forms/submissions/[id]` | View a client's completed form answers |

**Customer profile** (`/dashboard/customers/[id]`): Add sections showing:
- English level badge (if test taken)
- Form assignments and their status

---

## 5. APIs

### Hub APIs (client-facing, authenticated via hub-token)

```
GET  /api/hub/forms              → list assignments for this client
GET  /api/hub/forms/[id]         → assignment detail + template fields
POST /api/hub/forms/[id]/submit  → submit form answers
POST /api/hub/forms/[id]/upload  → upload file for a form field

GET  /api/hub/test               → get test questions (no answers included)
POST /api/hub/test/submit        → submit answers, receive score + level
GET  /api/hub/test/result        → get latest test result
```

### Admin APIs (authenticated via NextAuth)

```
GET  /api/dashboard/forms/assignments     → list all assignments
POST /api/dashboard/forms/assign          → assign template to customer(s)
GET  /api/dashboard/forms/submissions/[id] → view submission answers
```

---

## 6. File Structure

### New Files

```
lib/hub/
  form-templates.ts          ← hardcoded form templates (bilingual)
  english-test.ts            ← 25 questions + scoring algorithm

app/hub/
  forms/page.tsx             ← list assigned forms
  forms/[id]/page.tsx        ← fill form
  test/page.tsx              ← take test
  test/result/page.tsx       ← view result

app/api/hub/
  forms/route.ts             ← GET list
  forms/[id]/route.ts        ← GET detail
  forms/[id]/submit/route.ts ← POST answers
  forms/[id]/upload/route.ts ← POST file upload
  test/route.ts              ← GET questions
  test/submit/route.ts       ← POST answers
  test/result/route.ts       ← GET latest result

app/dashboard/
  forms/page.tsx             ← admin: list assignments
  forms/assign/page.tsx      ← admin: assign to customer
  forms/submissions/[id]/page.tsx ← admin: view answers

app/api/dashboard/
  forms/assignments/route.ts ← GET list
  forms/assign/route.ts      ← POST assign
  forms/submissions/[id]/route.ts ← GET answers
```

### Modified Files

```
prisma/schema.prisma         ← add FormAssignment, FormSubmission, PlacementTest, FormAssignmentStatus
app/hub/page.tsx             ← add Forms + English Level cards
```

---

## 7. What Changes vs What Stays

| Component | Changes? |
|-----------|----------|
| Hub auth (JWT) | No |
| Hub layout/header | No |
| Hub invoices/payment | No |
| Hub dashboard | Add 2 cards (forms + test) |
| Admin dashboard | Add forms management pages |
| Prisma schema | Add 3 models + 1 enum |
| QB Payments | No |
| Middleware | Add `routeRoleMap` entry for `/dashboard/forms` → `["ADMIN", "OPERATIONAL", "SALES"]` |
