# Ops Former Staff Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add former-employee internal control to Ops without creating login access.

**Architecture:** Create a separate non-login staff model and keep current `User` records as the only login-capable accounts. Store "who acted" on activities and sessions through optional performed-by fields while preserving the logged-in recorder for audit.

**Tech Stack:** Next.js App Router, Prisma, Zod, React client components, Tailwind CSS, node:test with tsx.

---

### Task 1: Domain Helpers And Tests

**Files:**
- Create: `tests/ops-staff-members.test.ts`
- Create: `lib/ops/staff-members.ts`

- [ ] Write tests proving former staff can be saved without email, area keys are normalized, labels show ex-funcionario, and actor selections map to user/staff payloads.
- [ ] Run `npx tsx --test tests/ops-staff-members.test.ts` and confirm it fails because the helper module is missing.
- [ ] Implement `lib/ops/staff-members.ts`.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Prisma Model

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260526093000_add_ops_staff_members/migration.sql`

- [ ] Add `OpsStaffMember`.
- [ ] Add optional performed-by references to `OpsStudentActivity` and `MentorshipSession`.
- [ ] Run `npm run db:generate`.

### Task 3: API Wiring

**Files:**
- Create: `app/api/ops/staff-members/route.ts`
- Modify: `app/api/ops/enrollments/[id]/activities/route.ts`
- Modify: `app/api/ops/sessions/route.ts`
- Modify: `app/api/ops/enrollments/[id]/route.ts`
- Modify: `app/api/ops/enrollments/[id]/sessions/route.ts`
- Modify: `lib/services/mentorship.service.ts`

- [ ] Add `GET` and `POST` for former staff.
- [ ] Accept optional actor selection on activity and session creation.
- [ ] Include performed-by relations in profile/session responses.

### Task 4: UI Wiring

**Files:**
- Create: `app/ops/team/OpsFormerStaffClient.tsx`
- Modify: `app/ops/team/page.tsx`
- Modify: `app/ops/students/[enrollmentId]/OperationalHubSection.tsx`
- Modify: `app/ops/students/[enrollmentId]/SessionSection.tsx`
- Modify: `app/ops/students/[enrollmentId]/StudentProfileClient.tsx`

- [ ] Add former-employee form/list on `/ops/team`.
- [ ] Add "Quem atuou" selectors to activities and sessions.
- [ ] Display former-employee labels in activity/session history.

### Task 5: Verification

**Files:** all changed files.

- [ ] Run `npx tsx --test tests/ops-staff-members.test.ts`.
- [ ] Run focused existing ops tests touched by this change.
- [ ] Run `npx tsc --noEmit --pretty false`.
- [ ] Inspect `git diff --stat`.
