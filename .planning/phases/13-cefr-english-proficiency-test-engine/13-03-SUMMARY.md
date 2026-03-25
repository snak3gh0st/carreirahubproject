---
phase: 13-cefr-english-proficiency-test-engine
plan: 03
subsystem: client-hub
tags: [question-bank, cefr, randomization, scoring, api-routes, ui, i18n, admin-dashboard]
dependency_graph:
  requires:
    - lib/hub/question-bank/index.ts (Plan 01)
    - lib/hub/question-bank/types.ts (Plan 01)
    - prisma/schema.prisma PlacementTest with questionIds/questionCount (Plan 01)
    - lib/hub/question-bank/questions-b1/b2/c1/c2.ts (Plan 02)
  provides:
    - app/api/hub/test/route.ts (randomized test generation with pending tracking)
    - app/api/hub/test/submit/route.ts (score against served questions)
    - app/api/hub/test/result/route.ts (dynamic questionCount in response)
    - app/hub/test/page.tsx (testId tracking, dynamic numbering)
    - app/hub/test/result/page.tsx (dynamic score display)
    - app/hub/page.tsx (dynamic English Level card)
    - app/dashboard/tests/page.tsx (dynamic score column + KPI)
    - app/dashboard/customers/[id]/page.tsx (dynamic score badge)
    - lib/i18n/hub.ts (Randomized descriptor in both locales)
  affects:
    - All test-related displays across both portals
tech_stack:
  added: []
  patterns:
    - totalScore=-1 sentinel pattern for pending PlacementTest records
    - Pending test reuse within 24-hour window (prevents duplicate generation)
    - No-repeat guarantee via seenIds Set from prior completed tests
    - Update-not-create pattern for test submission
    - questionCount||25 fallback for backward compatibility with old records
key_files:
  created: []
  modified:
    - app/api/hub/test/route.ts
    - app/api/hub/test/submit/route.ts
    - app/api/hub/test/result/route.ts
    - app/hub/test/page.tsx
    - app/hub/test/result/page.tsx
    - app/hub/page.tsx
    - app/dashboard/tests/page.tsx
    - app/dashboard/customers/[id]/page.tsx
    - lib/i18n/hub.ts
decisions:
  - "totalScore=-1 as pending sentinel — avoids nullable field, reuses existing Int column, self-documenting"
  - "Update-not-create on submit — preserves the pending record with its questionIds, ensures scoring against exact served questions"
  - "24-hour pending test window — prevents duplicate test generation when student refreshes; expired tests are deleted and regenerated"
  - "questionCount||25 fallback in all displays — backward compatible with pre-Plan 01 test records that have questionCount defaulting to 25"
  - "Admin tests page excludes pending tests — incomplete tests should not appear in admin results table"
metrics:
  duration_minutes: 4
  completed_date: "2026-03-25"
  tasks_completed: 2
  files_created: 0
  files_modified: 9
---

# Phase 13 Plan 03: Integration Summary

**One-liner:** Wired question bank into all API routes, UI pages, and admin displays — replacing fixed-question test flow with randomized, no-repeat, pending-tracked system with dynamic score displays across both portals.

## What Was Built

Integrated the question bank infrastructure (Plan 01) and content (Plan 02) into the live application across all layers:

### Task 1: API Routes Rewritten

**app/api/hub/test/route.ts** — Complete rewrite:
- Imports from `@/lib/hub/question-bank` (not `english-test`)
- Checks for existing pending test (totalScore=-1) before generating
- Returns existing pending test if < 24 hours old and has questionIds
- Deletes expired pending tests (> 24 hours old)
- Collects seenIds from all completed tests for no-repeat guarantee
- Calls `generateTest(seenIds)` for randomized 25-question set
- Creates PlacementTest record with `totalScore: -1` sentinel
- Returns `{ questions, testId }` — questions stripped of correctIndex via `toClientQuestion`

**app/api/hub/test/submit/route.ts** — Complete rewrite:
- Accepts `testId` in request body
- Validates pending test exists for this student (`totalScore: -1`)
- Scores using `scoreAnswers(answers, pendingTest.questionIds)` — against exact served questions
- Updates the pending record (not creates new) — preserves questionIds linkage
- Returns `sectionMaxes` and `questionCount` in response

**app/api/hub/test/result/route.ts** — Updated:
- Excludes pending tests (`totalScore: { not: -1 }`)
- Returns `questionCount` field in result object

### Task 2: UI, Admin Displays, and i18n Updated

**app/hub/test/page.tsx:**
- Stores `testId` state from API response
- Sends `testId` in POST body on submit
- Question numbering computed dynamically: `previousQuestionCount + qi + 1`

**app/hub/test/result/page.tsx:**
- Score displayed as `{totalScore}/{questionCount || 25}` (not hardcoded /25)
- Query excludes pending tests (`totalScore: { not: -1 }`)
- Fixed `cookies()` to be async (`await cookies()`)

**app/hub/page.tsx:**
- English Level card shows `{totalScore}/{questionCount || 25}`
- `FormsAndTestCards` query excludes pending tests
- Fixed `cookies()` to be async (`await cookies()`)

**app/dashboard/tests/page.tsx:**
- Score column shows `{totalScore}/{test.questionCount || 25}`
- KPI Avg Score computes average questionCount across all tests
- Query excludes pending tests (`totalScore: { not: -1 }`)

**app/dashboard/customers/[id]/page.tsx:**
- Test score badge shows `{totalScore}/{questionCount || 25}`
- Query excludes pending tests (`totalScore: { not: -1 }`)

**lib/i18n/hub.ts:**
- EN: `"25 questions · ~15 minutes · Randomized"`
- PT-BR: `"25 perguntas · ~15 minutos · Aleatório"`

## Verification Results

- `npx tsc --noEmit` passes with zero errors
- No hardcoded `/25` remains in any test-related file (grep confirmed)
- All API routes import from `@/lib/hub/question-bank` (not `english-test`)
- No `correctIndex` field in any API route logic
- `testId` appears in both GET response and POST request body
- All queries exclude pending tests via `totalScore: { not: -1 }`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added pending test exclusion to admin/dashboard queries**
- **Found during:** Task 2
- **Issue:** Admin tests page, customer detail page, and hub dashboard would show incomplete pending test records (with empty scores) mixed in with completed results
- **Fix:** Added `totalScore: { not: -1 }` filter to all `findFirst`/`findMany` queries that display test results
- **Files modified:** `app/dashboard/tests/page.tsx`, `app/dashboard/customers/[id]/page.tsx`, `app/hub/page.tsx`, `app/hub/test/result/page.tsx`
- **Commit:** 82e5dfd

**2. [Rule 1 - Bug] Fixed async cookies() calls**
- **Found during:** Task 2 (post-edit validator)
- **Issue:** `cookies()` must be awaited in Next.js; was called synchronously in `app/hub/page.tsx` and `app/hub/test/result/page.tsx`
- **Fix:** Added `await` to both `cookieStore = await cookies()` calls
- **Files modified:** `app/hub/page.tsx`, `app/hub/test/result/page.tsx`
- **Commit:** 82e5dfd

## Commits

- `02eb9ec` — feat(13-03): rewrite test API routes for randomized generation and scoring
- `82e5dfd` — feat(13-03): update UI, admin displays, and i18n for dynamic question counts

## Self-Check: PASSED
