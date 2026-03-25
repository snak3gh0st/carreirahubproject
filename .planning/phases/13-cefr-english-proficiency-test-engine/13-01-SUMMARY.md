---
phase: 13-cefr-english-proficiency-test-engine
plan: 01
subsystem: client-hub
tags: [question-bank, cefr, randomization, scoring, prisma, english-test]
dependency_graph:
  requires: []
  provides:
    - lib/hub/question-bank/types.ts
    - lib/hub/question-bank/index.ts
    - lib/hub/question-bank/questions-a1.ts
    - lib/hub/question-bank/questions-a2.ts
    - lib/hub/question-bank/questions-b1.ts (stub)
    - lib/hub/question-bank/questions-b2.ts (stub)
    - lib/hub/question-bank/questions-c1.ts (stub)
    - lib/hub/question-bank/questions-c2.ts (stub)
    - prisma/schema.prisma (PlacementTest updated)
    - lib/hub/english-test.ts (re-export layer)
  affects:
    - Any consumer of lib/hub/english-test.ts
    - app/api/hub/test/* (Plan 03 targets)
    - app/hub/test/* (Plan 03 targets)
tech_stack:
  added: []
  patterns:
    - Fisher-Yates partial shuffle for question randomization
    - Contiguous pass algorithm with percentage-based threshold (60%)
    - TypeScript constant arrays for developer-authored question bank
    - Thin re-export layer for backward compatibility
key_files:
  created:
    - lib/hub/question-bank/types.ts
    - lib/hub/question-bank/index.ts
    - lib/hub/question-bank/questions-a1.ts
    - lib/hub/question-bank/questions-a2.ts
    - lib/hub/question-bank/questions-b1.ts
    - lib/hub/question-bank/questions-b2.ts
    - lib/hub/question-bank/questions-c1.ts
    - lib/hub/question-bank/questions-c2.ts
  modified:
    - prisma/schema.prisma
    - lib/hub/english-test.ts
decisions:
  - "Question bank stored as TypeScript constant arrays (not DB) — developer-authored content, version-controlled, type-safe, zero DB overhead"
  - "60% pass threshold (Math.ceil(count * 0.6)) replaces hardcoded 3/5 — supports variable question counts"
  - "Backward-compatible schema defaults: questionIds String[] @default([]), questionCount Int @default(25)"
  - "english-test.ts becomes thin re-export layer, calculateScore alias preserved for any existing consumers"
metrics:
  duration_minutes: 4
  completed_date: "2026-03-25"
  tasks_completed: 2
  files_created: 8
  files_modified: 2
---

# Phase 13 Plan 01: Question Bank Foundation Summary

**One-liner:** Fisher-Yates question bank with 39 A1/A2 questions, percentage-based CEFR scoring engine, and backward-compatible PlacementTest schema expansion.

## What Was Built

Created the `lib/hub/question-bank/` directory with complete infrastructure for the CEFR English Proficiency Test Engine:

1. **types.ts** — Defines `BankQuestion`, `ClientQuestion`, `CEFRLevel`, `SkillType`, `TestResult` type contracts. `BankQuestion` includes `correctIndex` (server-only). `ClientQuestion` exposes only safe fields. `TestResult` adds `sectionMaxes` for variable-count display.

2. **index.ts** — Core engine:
   - `getAllQuestions()` — Loads and caches all questions from all level files
   - `getQuestionsByIds(ids)` — O(1) Map-based lookup
   - `toClientQuestion(q)` — Explicitly strips `correctIndex` and `explanation` before any client response
   - `selectRandom<T>(pool, count)` — Fisher-Yates partial shuffle
   - `generateTest(seenIds, questionsPerSection=5)` — No-repeat aware test generator; resets pool per section when exhausted
   - `scoreAnswers(answers, questionIds)` — Contiguous pass algorithm with 60% threshold, maps to A1-C2 CEFR levels

3. **questions-a1.ts** — 17 A1 questions (section 1): grammar (to be, simple present, articles, there is/are, imperatives, pronouns, prepositions) and vocabulary (workplace, greetings, false-friend traps). Adapted 5 questions from the original fixed test with new IDs.

4. **questions-a2.ts** — 22 A2 questions (section 2): grammar (past simple, comparatives, first conditional, much/many, present perfect, phrasal verbs) and vocabulary (false cognates: actually, pretend, sensible, eventually; workplace expressions). Adapted 5 from original.

5. **questions-b1/b2/c1/c2.ts** — Stubs with empty arrays; Plan 02 fills them.

6. **prisma/schema.prisma** — Added two backward-compatible fields to `PlacementTest`:
   - `questionIds String[] @default([])` — Stores which questions were served per test for no-repeat tracking and scoring verification
   - `questionCount Int @default(25)` — Stores total questions served; defaults to 25 so all existing records display correctly

7. **lib/hub/english-test.ts** — Rewritten as a 2-line re-export layer. Removes the 400-line hardcoded `QUESTIONS` array and `ANSWER_KEY` object. Exports `calculateScore` alias for any existing imports.

## Verification Results

- Total questions: 39 (17 A1 + 22 A2)
- `generateTest(new Set())` returns exactly 10 questions (5 per filled section)
- `toClientQuestion` strips `correctIndex` — confirmed by runtime check
- `scoreAnswers` with all-correct answers returns `B1` (both sections 1+2 passed at 100%)
- `db:generate` succeeds, schema pushed to Neon production database
- Backward compat: `calculateScore` and `DISPLAY_LEVELS` importable from `lib/hub/english-test.ts`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

The following stubs are intentional and tracked for Plan 02:

| File | Stub | Reason |
|------|------|--------|
| `lib/hub/question-bank/questions-b1.ts` | `B1_QUESTIONS = []` | B1 questions authored in Plan 02 |
| `lib/hub/question-bank/questions-b2.ts` | `B2_QUESTIONS = []` | B2 questions authored in Plan 02 |
| `lib/hub/question-bank/questions-c1.ts` | `C1_QUESTIONS = []` | C1 questions authored in Plan 02 |
| `lib/hub/question-bank/questions-c2.ts` | `C2_QUESTIONS = []` | C2 questions authored in Plan 02 |

These stubs do NOT prevent Plan 01's goal (question bank infrastructure for A1/A2). Sections 3-5 remain empty until Plan 02 fills them. The `generateTest` function gracefully skips empty sections.

## Commits

- `9263732` — feat(13-01): create question bank types, infrastructure, and A1/A2 questions
- `5dc841c` — feat(13-01): update Prisma schema and rewrite english-test.ts as re-export layer

## Self-Check: PASSED
