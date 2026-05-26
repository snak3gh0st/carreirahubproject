# Hub Job Search Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Home quick actions and a `Meus Registros` history page so Hub clients can submit applications, interviews, tasks, and offers.

**Architecture:** Reuse `OpsStudentActivity` as the single source of truth. Add a small Hub-specific schema/service layer, a Hub API route, one reusable client modal component, and a server-rendered history page.

**Tech Stack:** Next.js App Router, Prisma, Zod, Tailwind CSS, Radix Dialog, lucide-react, node:test with tsx.

---

### Task 1: Hub Job Search Domain Helpers

**Files:**
- Create: `lib/hub/job-search-records.ts`
- Test: `tests/hub-job-search-records.test.ts`
- Modify: `lib/ops/visibility.ts`

- [ ] Write failing tests for record validation, create-data mapping, and summary counters.
- [ ] Run `npx tsx --test tests/hub-job-search-records.test.ts` and confirm it fails because the module does not exist.
- [ ] Implement `lib/hub/job-search-records.ts` with `parseHubJobSearchRecordInput`, `buildHubJobSearchActivityData`, and `summarizeHubJobSearchActivities`.
- [ ] Add `TASK`, `PENDENTE`, and `CONCLUIDO` to operational visibility/status constants.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Hub API Route

**Files:**
- Create: `app/api/hub/job-search/route.ts`
- Test: covered through domain tests and TypeScript validation

- [ ] Implement `GET` with `getHubAuth`, active enrollment lookup, and `opsActivities` list.
- [ ] Implement `POST` with `verifyCsrf`, active enrollment lookup, domain parsing, and `opsStudentActivity.create`.
- [ ] Return string errors plus `fieldErrors` on validation failure.

### Task 3: Quick Add Modal

**Files:**
- Create: `app/hub/registros/JobSearchRecordModal.tsx`

- [ ] Build a reusable client dialog with type buttons for application, interview, task, and offer.
- [ ] Use native form controls with labels above inputs and inline error text.
- [ ] POST to `/api/hub/job-search`, preserve form values on error, and call `router.refresh()` after success.

### Task 4: Home Integration

**Files:**
- Modify: `app/hub/page.tsx`

- [ ] Query active enrollment job-search activity counts and recent records.
- [ ] Render a "Registrar avanço da busca" section after the alerts and before KPI cards.
- [ ] Include four quick action buttons and a link to `/hub/registros`.

### Task 5: History Page and Navigation

**Files:**
- Create: `app/hub/registros/page.tsx`
- Modify: `app/hub/HubNavLinks.tsx`
- Modify: `lib/i18n/hub.ts`

- [ ] Add navigation label for records/search in English and Portuguese.
- [ ] Render summary counters, filters, add button, empty state, and record list.
- [ ] Keep the page server-rendered and use the same modal for adding records.

### Task 6: Verification

**Files:**
- All modified files

- [ ] Run `npx tsx --test tests/hub-job-search-records.test.ts`.
- [ ] Run the prior focused bug tests.
- [ ] Run `npx tsc --noEmit --pretty false`.
- [ ] Inspect `git diff --stat` and final changed files.
