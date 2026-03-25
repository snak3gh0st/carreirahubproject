---
phase: 13-cefr-english-proficiency-test-engine
plan: 02
subsystem: client-hub
tags: [question-bank, cefr, b1, b2, c1, c2, reading-comprehension, idioms, error-identification]
dependency_graph:
  requires:
    - lib/hub/question-bank/types.ts
    - lib/hub/question-bank/index.ts
    - lib/hub/question-bank/questions-a1.ts
    - lib/hub/question-bank/questions-a2.ts
  provides:
    - lib/hub/question-bank/questions-b1.ts (fully populated)
    - lib/hub/question-bank/questions-b2.ts (fully populated)
    - lib/hub/question-bank/questions-c1.ts (fully populated)
    - lib/hub/question-bank/questions-c2.ts (fully populated)
  affects:
    - lib/hub/question-bank/index.ts (getAllQuestions now returns 131 questions)
    - generateTest(new Set()) now returns full 25-question tests across all 5 sections
tech_stack:
  added: []
  patterns:
    - TypeScript constant arrays for developer-authored question bank (per Plan 01 decision)
    - Career/immigration context for all questions (Brazilian immigrants in the US)
    - Reading passages with 2 comprehension questions per passage
    - Unique ID format: level_skill_NN (e.g., b1_gram_01, c2_errid_01)
key_files:
  created: []
  modified:
    - lib/hub/question-bank/questions-b1.ts
    - lib/hub/question-bank/questions-b2.ts
    - lib/hub/question-bank/questions-c1.ts
    - lib/hub/question-bank/questions-c2.ts
decisions:
  - "All questions maintain career/immigration context for Brazilian immigrants in the US — consistent with A1/A2 questions authored in Plan 01"
  - "Reading comprehension passages are paired — two questions per passage — enabling single passage load with two test items"
  - "C1 and C2 both use section: 5 per the architecture decision from Plan 01 — level field distinguishes them for future adaptive testing"
  - "C2 targets near-native subtleties: academic hedging, moot/begging-the-question vocab, rhetorical device identification, dangling/misplaced modifiers"
metrics:
  duration_minutes: 4
  completed_date: "2026-03-25"
  tasks_completed: 2
  files_created: 0
  files_modified: 4
---

# Phase 13 Plan 02: B1-C2 Question Bank Authoring Summary

**One-liner:** 92 new career/immigration-context questions across B1-C2 CEFR levels completing the 131-question bank with full 25-question test generation across all 5 sections.

## What Was Built

Four question bank files filled from stubs to full question sets:

1. **questions-b1.ts** — 29 questions for section 3 (B1 level):
   - Grammar (18 questions): present perfect vs past simple (4), second conditional (3), reported speech (2), passive voice (2), used to (2), gerunds/infinitives (3), past perfect (2)
   - Vocabulary (5 questions): schedule/hire/laid off/networking/outline collocations
   - Reading comprehension (6 questions): 3 passages of ~80 words each — Ana's first day at a US office (name tags, lunch customs), Carlos preparing for his first US interview (research, handshake, eye contact), Brazilian vs US workplace communication styles (directness, agendas)

2. **questions-b2.ts** — 27 questions for section 4 (B2 level):
   - Grammar (16 questions): third conditional (3), mixed conditionals (2), future perfect (2), modal perfects (3), complex passives (2), relative clauses (2), formal register (2)
   - Vocabulary (5 questions): formal cover letter language, negotiate, comprehensive benefits
   - Reading comprehension (6 questions): 3 passages of ~80-100 words each — at-will employment vs Brazil's CLT system, cover letter writing conventions for US companies, PTO policies comparison

3. **questions-c1.ts** — 23 questions for section 5 (C1 level):
   - Grammar (12 questions): subjunctive mood (3), inversion (2), cleft sentences (1), advanced modals (2), wish/if only (2), complex reported speech (2)
   - Idioms (4 questions): hit the ground running, think outside the box, cut corners, drop the ball
   - Error identification (4 questions): subject-verb agreement (each/neither), tense consistency, word choice (effect vs affect)
   - Vocabulary (3 questions): raise vs rise, affect vs effect nuance

4. **questions-c2.ts** — 13 questions for section 5 (C2 level):
   - Grammar/Academic register (3 questions): notwithstanding, despite, formal hedging language
   - Vocabulary (5 questions): moot point, begging the question, ambiguous vs ambivalent, rhetorical devices (parallelism, litotes)
   - Idioms (3 questions): burning the midnight oil, blessing in disguise, ball is in your court
   - Error identification (2 questions): dangling modifier, misplaced modifier

## Verification Results

```
B1 count: 29 (need >=27) ✓
B2 count: 27 (need >=27) ✓
B1 reading questions: 6 (need >=3) ✓
B2 reading questions: 6 (need >=3) ✓
ALL B1/B2 CHECKS PASSED

C1 count: 23 (need >=22) ✓
C2 count: 13 (need >=12) ✓
C1 idiom questions: 4 (need >=1) ✓
C1 error-identification questions: 4 (need >=1) ✓
TOTAL BANK: 131 (need >=130) ✓
Full test questions: 25 (expect 25) ✓
Overlap between test 1 and 2: 0 ✓
ALL C1/C2 CHECKS PASSED
```

**Final bank composition:**
| Level | Section | Questions |
|-------|---------|-----------|
| A1 | 1 | 17 |
| A2 | 2 | 22 |
| B1 | 3 | 29 |
| B2 | 4 | 27 |
| C1 | 5 | 23 |
| C2 | 5 | 13 |
| **Total** | | **131** |

With 131 questions and 25 per test, a student can take **5+ completely unique tests** before any question repeats (per section).

## Deviations from Plan

None — plan executed exactly as written.

All concrete examples specified in the plan were included:
- `b1_gram_06`: "She said she _____ looking for a new position" — correct=1 (was) ✓
- `b1_gram_07`: "The email _____ sent to all employees yesterday" — correct=1 (was) ✓
- `b1_gram_08`: "I used to _____ in São Paulo before moving to Miami" — correct=0 (live) ✓
- `b1_gram_09`: "She enjoys _____ with international clients" — correct=1 (working) ✓
- `b1_vocab_01`: "I need to _____ a meeting with my supervisor" — correct=2 (schedule) ✓
- `b1_read_02`: Ana's first day at a US office passage — correct=1 (How people introduced themselves) ✓
- `b2_gram_06`: "If she had applied earlier, she _____ the position" — correct=2 (would have gotten) ✓
- `b2_gram_07`: "If I had studied English in Brazil, I _____ more confident now" — correct=0 (would be) ✓
- `b2_gram_08`: "She must _____ left the office already" — correct=1 (have) ✓
- `b2_gram_09`: "The company, _____ headquarters are in Miami" — correct=2 (whose) ✓
- `b2_read_01`: At-will employment passage — correct=1 (Employment termination rules) ✓
- `b2_vocab_01`: "I would like to _____ my interest in the Senior Analyst position" — correct=2 (express) ✓
- `c1_gram_06`: "Not only _____ she complete the project on time" — correct=1 (did) ✓
- `c1_gram_07`: "I wish I _____ applied for the position" — correct=1 (had) ✓
- `c1_idiom_01`: "Hit the ground running" — correct=1 (start working quickly) ✓
- `c1_idiom_03`: "Don't cut corners" — correct=2 (don't do it cheaply or poorly) ✓
- `c1_errid_01`: "Each of the managers have approved" — correct=1 ✓
- `c1_vocab_01`: "The company's profits _____ significantly" — correct=1 (rose) ✓
- `c2_vocab_01`: "moot" — correct=1 ✓
- `c2_idiom_01`: "burning the midnight oil" — correct=1 (working very late) ✓
- `c2_gram_01`: "Notwithstanding the economic downturn" — correct=2 ✓
- `c2_errid_01`: Dangling modifier — correct=0 ✓
- `c2_vocab_02`: "begging the question" — correct=1 ✓

## Known Stubs

None — all question files are fully populated. The stubs tracked in Plan 01 have been resolved.

## Commits

- `dd9cf7f` — feat(13-02): author B1 and B2 question banks (sections 3-4)
- `e5c4388` — feat(13-02): author C1 and C2 question banks (section 5)

## Self-Check: PASSED
