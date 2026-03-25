---
phase: 13-cefr-english-proficiency-test-engine
verified: 2026-03-25T00:00:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Take full placement test in browser as a hub client user"
    expected: "25 unique randomized questions load, sections 1-5 each show 5 questions, retake produces different questions"
    why_human: "Requires active authenticated browser session against live database"
  - test: "Retake test twice — verify no question repeats between first and second attempt"
    expected: "Zero overlapping question IDs between the two 25-question tests"
    why_human: "Requires two real test submissions against the production DB to accumulate seenIds"
  - test: "Verify section breakdown pass/fail colors in result page render correctly"
    expected: "Green for sections with score >= 3/5, red for < 3/5"
    why_human: "Visual rendering requires browser — logic is correct in code but color display is UI-only"
---

# Phase 13: CEFR English Proficiency Test Engine Verification Report

**Phase Goal:** Scientifically validated CEFR English proficiency test with randomized question bank (100-200+ questions, A1-C2), adaptive scoring, no-repeat guarantee
**Verified:** 2026-03-25
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                   | Status     | Evidence                                                                                  |
|----|-----------------------------------------------------------------------------------------|------------|-------------------------------------------------------------------------------------------|
| 1  | Question bank has 130+ questions covering A1-C2                                        | VERIFIED   | `getAllQuestions()` returns 131 (A1:17, A2:22, B1:29, B2:27, C1:23, C2:13)              |
| 2  | Fisher-Yates randomizer selects 25 questions (5/section) with no-repeat guarantee      | VERIFIED   | `generateTest(seenIds)` returns 25 Qs; two consecutive tests have 0 overlap              |
| 3  | Scoring uses 60% contiguous-pass threshold — not hardcoded 3/5                         | VERIFIED   | `Math.ceil(sectionCount * 0.6)` in `scoreAnswers`; behavioral test confirmed A1→A2 pass |
| 4  | PlacementTest schema has `questionIds String[]` and `questionCount Int`                | VERIFIED   | Both fields present in `prisma/schema.prisma` with backward-compatible defaults           |
| 5  | `correctIndex` never reaches the client                                                 | VERIFIED   | `toClientQuestion` explicitly strips it; runtime check: 0 leaked in 25-question test     |
| 6  | GET /api/hub/test returns randomized questions + testId, reuses pending test            | VERIFIED   | Route creates pending record with `totalScore: -1`, returns `testId`, reuses if < 24 hrs |
| 7  | POST /api/hub/test/submit scores against served questions (not a fixed answer key)      | VERIFIED   | `scoreAnswers(answers, pendingTest.questionIds)` — uses stored `questionIds` per student  |
| 8  | All UI displays show `totalScore/{questionCount \|\| 25}` (no hardcoded /25)           | VERIFIED   | Confirmed in result page (line 74), hub dashboard (line 331), admin tests (line 270), customer detail (line 225) |
| 9  | Test UI sends `testId` from GET response to POST submit body                           | VERIFIED   | `testId` state in `app/hub/test/page.tsx`; included in POST JSON body                    |
| 10 | i18n keys updated to include "Randomized" descriptor in both EN and PT-BR             | VERIFIED   | EN: "25 questions · ~15 minutes · Randomized"; PT-BR: "25 perguntas · ~15 minutos · Aleatório" |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact                                          | Expected                                          | Status     | Details                                                    |
|---------------------------------------------------|---------------------------------------------------|------------|------------------------------------------------------------|
| `lib/hub/question-bank/types.ts`                  | BankQuestion, ClientQuestion, CEFRLevel, SkillType, TestResult | VERIFIED   | All 5 types exported; BankQuestion has `correctIndex`, ClientQuestion does not |
| `lib/hub/question-bank/index.ts`                  | generateTest, scoreAnswers, toClientQuestion, getQuestionsByIds, getAllQuestions, DISPLAY_LEVELS | VERIFIED   | All 6 exports confirmed; 261-line substantive implementation |
| `lib/hub/question-bank/questions-a1.ts`           | A1 questions (17+ items)                          | VERIFIED   | 17 questions, 188 lines                                    |
| `lib/hub/question-bank/questions-a2.ts`           | A2 questions (22+ items)                          | VERIFIED   | 22 questions, 263 lines                                    |
| `lib/hub/question-bank/questions-b1.ts`           | B1 questions (27+ items, reading comprehension)   | VERIFIED   | 29 questions, 343 lines, 6 with passages                   |
| `lib/hub/question-bank/questions-b2.ts`           | B2 questions (27+ items, reading comprehension)   | VERIFIED   | 27 questions, 343 lines, 6 with passages                   |
| `lib/hub/question-bank/questions-c1.ts`           | C1 questions (22+ items, idioms, error-id)        | VERIFIED   | 23 questions, 278 lines, 4 idioms, 4 error-identification  |
| `lib/hub/question-bank/questions-c2.ts`           | C2 questions (12+ items)                          | VERIFIED   | 13 questions, 182 lines                                    |
| `lib/hub/english-test.ts`                         | Thin re-export layer (no QUESTIONS/ANSWER_KEY)    | VERIFIED   | 7-line file; no QUESTIONS array, no ANSWER_KEY; exports calculateScore alias |
| `prisma/schema.prisma`                            | PlacementTest with questionIds + questionCount    | VERIFIED   | `questionIds String[] @default([])` and `questionCount Int @default(25)` |
| `app/api/hub/test/route.ts`                       | Randomized test generation with pending tracking  | VERIFIED   | Imports from `@/lib/hub/question-bank`; totalScore=-1 sentinel; returns testId |
| `app/api/hub/test/submit/route.ts`                | Score against served questions, update pending     | VERIFIED   | Accepts testId; scores via `pendingTest.questionIds`; update-not-create pattern |
| `app/api/hub/test/result/route.ts`                | Dynamic questionCount in response                 | VERIFIED   | Returns `questionCount: test.questionCount`; excludes pending tests |
| `app/hub/test/page.tsx`                           | testId tracking, dynamic question numbering       | VERIFIED   | `testId` state, `previousQuestionCount + qi + 1` numbering |
| `app/hub/test/result/page.tsx`                    | Dynamic score display                             | VERIFIED   | `{result.totalScore}/{result.questionCount \|\| 25}` at line 74 |
| `app/hub/page.tsx`                                | Dynamic English Level card score                  | VERIFIED   | `{latestTest.totalScore}/{latestTest.questionCount \|\| 25}` at line 331 |
| `app/dashboard/tests/page.tsx`                    | Dynamic score column + KPI                        | VERIFIED   | `{test.totalScore}/{test.questionCount \|\| 25}` at line 270; avg KPI at line 86 |
| `app/dashboard/customers/[id]/page.tsx`           | Dynamic score badge                               | VERIFIED   | `{latestTest.totalScore}/{latestTest.questionCount \|\| 25}` at line 225 |
| `lib/i18n/hub.ts`                                 | Updated questionsInfo for both locales            | VERIFIED   | Lines 172, 390 confirmed                                   |

### Key Link Verification

| From                                    | To                                  | Via                                  | Status  | Details                                          |
|-----------------------------------------|-------------------------------------|--------------------------------------|---------|--------------------------------------------------|
| `lib/hub/question-bank/index.ts`        | `lib/hub/question-bank/types.ts`    | `import types`                       | WIRED   | Import on line 5                                 |
| `lib/hub/question-bank/index.ts`        | `lib/hub/question-bank/questions-a1.ts` | `import A1_QUESTIONS`            | WIRED   | Import on line 6                                 |
| `lib/hub/question-bank/index.ts`        | `lib/hub/question-bank/questions-a2.ts` | `import A2_QUESTIONS`            | WIRED   | Import on line 7                                 |
| `lib/hub/question-bank/index.ts`        | `lib/hub/question-bank/questions-b1.ts` | `import B1_QUESTIONS`            | WIRED   | Import on line 8                                 |
| `lib/hub/question-bank/index.ts`        | `lib/hub/question-bank/questions-b2.ts` | `import B2_QUESTIONS`            | WIRED   | Import on line 9                                 |
| `lib/hub/question-bank/index.ts`        | `lib/hub/question-bank/questions-c1.ts` | `import C1_QUESTIONS`            | WIRED   | Import on line 10                                |
| `lib/hub/question-bank/index.ts`        | `lib/hub/question-bank/questions-c2.ts` | `import C2_QUESTIONS`            | WIRED   | Import on line 11                                |
| `app/api/hub/test/route.ts`             | `lib/hub/question-bank/index.ts`    | `generateTest, toClientQuestion, getQuestionsByIds` | WIRED | Import on line 8; all three used in GET handler |
| `app/api/hub/test/submit/route.ts`      | `lib/hub/question-bank/index.ts`    | `scoreAnswers`                       | WIRED   | Import on line 5; used on line 59                |
| `app/hub/test/page.tsx`                 | `/api/hub/test`                     | `fetch /api/hub/test` with testId    | WIRED   | `fetch("/api/hub/test")` sets `questions` and `testId` state |
| `app/hub/test/page.tsx`                 | `/api/hub/test/submit`              | `POST with answers + testId`         | WIRED   | POST body includes `{ answers, timeSpentSeconds, testId }` |

### Data-Flow Trace (Level 4)

| Artifact                              | Data Variable      | Source                               | Produces Real Data | Status    |
|---------------------------------------|--------------------|--------------------------------------|-------------------|-----------|
| `app/hub/test/page.tsx`               | `questions`        | `GET /api/hub/test` → `generateTest(seenIds)` | Yes — Fisher-Yates from 131-question bank | FLOWING |
| `app/hub/test/result/page.tsx`        | `result`           | Prisma `placementTest.findFirst` (excludes pending) | Yes — real DB query | FLOWING |
| `app/hub/page.tsx`                    | `latestTest`       | Prisma `placementTest.findFirst` (excludes pending) | Yes — real DB query | FLOWING |
| `app/dashboard/tests/page.tsx`        | `tests`            | Prisma `placementTest.findMany` (excludes pending) | Yes — real DB query | FLOWING |
| `app/dashboard/customers/[id]/page.tsx` | `latestTest`     | Prisma `placementTest.findFirst` (excludes pending) | Yes — real DB query | FLOWING |

### Behavioral Spot-Checks

| Behavior                                                         | Command                                                              | Result                                    | Status  |
|------------------------------------------------------------------|----------------------------------------------------------------------|-------------------------------------------|---------|
| Bank has 131 questions (goal: 130+)                             | `npx tsx getAllQuestions().length`                                   | 131                                       | PASS    |
| generateTest returns exactly 25 questions                        | `npx tsx generateTest(new Set()).length`                             | 25                                        | PASS    |
| Two consecutive tests with exclusion have zero overlap           | `generateTest(new Set(test1.ids)).filter(in test1).length`          | 0                                         | PASS    |
| correctIndex stripped from client questions                      | `test.map(toClientQuestion).filter('correctIndex' in c).length`     | 0                                         | PASS    |
| Perfect answers score C2                                         | `scoreAnswers(allCorrect, ids).cefrLevel`                           | "C2"                                      | PASS    |
| All wrong answers score A1                                       | `scoreAnswers(allWrong, ids).cefrLevel`                             | "A1"                                      | PASS    |
| 60% threshold: pass section 1 (3/5) only → A2                  | `scoreAnswers(partial, ids).cefrLevel`                              | "A2"                                      | PASS    |
| TypeScript compilation                                           | `npx tsc --noEmit`                                                  | 0 errors                                  | PASS    |
| All SUMMARY commit hashes exist in git                          | `git log --oneline` grep for 6 hashes                               | All 6 found                               | PASS    |

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                          | Status    | Evidence                                                                                       |
|-------------|-------------|------------------------------------------------------------------------------------------------------|-----------|-----------------------------------------------------------------------------------------------|
| CEFR-01     | 13-01, 13-02 | Question bank of 130+ questions organized by CEFR level (A1-C2) with unique IDs, skill type tags, and career/immigration context | SATISFIED | 131 questions confirmed at runtime; all levels populated; career/immigration context throughout |
| CEFR-02     | 13-01        | Fisher-Yates randomized question selection with per-student no-repeat guarantee across retakes        | SATISFIED | `selectRandom` (Fisher-Yates) in index.ts; `generateTest(seenIds)` excludes prior question IDs; 0 overlap in spot-check |
| CEFR-03     | 13-01        | Percentage-based adaptive scoring algorithm using contiguous pass method (60% threshold per section, variable question counts) | SATISFIED | `Math.ceil(sectionCount * PASS_RATE)` where `PASS_RATE = 0.6`; behavioral test confirmed     |
| CEFR-04     | 13-01        | PlacementTest schema updated with questionIds (String[]) and questionCount (Int) for question tracking and auditing | SATISFIED | Both fields in prisma/schema.prisma with backward-compatible defaults; db:generate confirmed  |
| CEFR-05     | 13-03        | API routes generate unique randomized question sets per student with pending test tracking, and score against the specific served questions | SATISFIED | GET creates pending record; POST scores via `pendingTest.questionIds`; totalScore=-1 sentinel  |
| CEFR-06     | 13-03        | All UI and admin displays show dynamic score/questionCount (no hardcoded /25), test UI sends testId for stateless scoring | SATISFIED | `questionCount \|\| 25` pattern in all 4 display locations; testId sent in POST body         |

### Anti-Patterns Found

| File                                             | Line | Pattern                        | Severity | Impact                                                             |
|--------------------------------------------------|------|--------------------------------|----------|--------------------------------------------------------------------|
| `lib/hub/question-bank/questions-a1.ts`          | 23   | Non-standard question ID format: `a1_vocab_01_resume` (has extra `_resume` suffix) | Warning  | Breaks the uniform `{level}_{skill}_{nn}` contract; ID is unique so no functional breakage, but inconsistent with the ID format spec and could trip future ID-based tooling |
| `app/hub/test/result/page.tsx`                   | 89   | Hardcoded `/5` in section breakdown (`{score}/5`) | Info     | Intentional by design (always 5 per section); the plan acknowledged this and said "keep /5 but add a comment" — the comment was not added, but functional impact is zero as long as `questionsPerSection=5` is unchanged |

**Anti-pattern severity notes:**

The `a1_vocab_01_resume` ID is the only ID that does not match `/^(a1|a2|b1|b2|c1|c2)_(gram|vocab|read|idiom|errid)_\d{2}$/`. All other 130 questions have conforming IDs. The ID is unique (confirmed: no duplicates), so scoring and lookup work correctly. The non-conformance is a cosmetic issue, not a functional blocker.

The hardcoded `/5` in the section breakdown is noted in the plan as a deliberate simplification for the current 5-questions-per-section design. It does not affect the total score display (which uses `questionCount || 25`) and correctly reflects the per-section max in all existing and foreseeable tests.

### Human Verification Required

#### 1. Full Test Flow in Browser

**Test:** Log in to the client hub as a real ClientUser, navigate to `/hub/test`, complete all 5 sections, and submit.
**Expected:** 25 questions load (5 per section), no `correctIndex` field visible in browser network responses, submit redirects to `/hub/test/result` with the correct CEFR level and dynamic score display.
**Why human:** Requires authenticated browser session against a live database with a real ClientUser record.

#### 2. No-Repeat Guarantee Across Retakes

**Test:** Complete the test twice as the same ClientUser. After the second test, compare the two sets of question IDs (visible via Prisma Studio in the `questionIds` column of `placement_tests`).
**Expected:** Zero overlapping question IDs between the two completed tests.
**Why human:** Requires two real test submissions to accumulate `seenIds` from prior completed tests.

#### 3. Pending Test Reuse on Refresh

**Test:** Start the test (GET /api/hub/test), note the `testId` in the network response, then refresh the page without submitting.
**Expected:** The same `testId` and identical 25 questions are returned (pending test reused, not regenerated).
**Why human:** Requires browser interaction with timing and real database state.

---

### Gaps Summary

No gaps. All 10 observable truths verified, all 19 required artifacts exist and are substantive, all 11 key links confirmed wired, data flows real from DB through all display surfaces. TypeScript compiles clean. All 6 CEFR requirements satisfied.

Two minor anti-patterns noted — one non-standard question ID (`a1_vocab_01_resume`) and one hardcoded `/5` in section breakdown — neither blocks goal achievement. Three items flagged for optional human verification (live browser testing requires real authentication).

---

_Verified: 2026-03-25_
_Verifier: Claude (gsd-verifier)_
