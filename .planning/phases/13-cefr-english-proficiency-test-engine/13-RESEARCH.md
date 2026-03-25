# Phase 13: CEFR English Proficiency Test Engine - Research

**Researched:** 2026-03-25
**Domain:** English placement testing, question bank architecture, CEFR scoring, randomization algorithms
**Confidence:** HIGH

## Summary

The current English placement test is a fixed 25-question test hardcoded in `lib/hub/english-test.ts`. Every student sees the identical questions in the same order. The answer key is embedded in the same file (server-side only). Scoring uses a contiguous section-pass algorithm that maps 5 sections to CEFR levels A1-C2. The data model (`PlacementTest`) stores per-section scores, total score, percentage, CEFR level, and the raw answers as JSON.

Phase 13 replaces this with a randomized question bank of 100-200+ questions organized by CEFR level and skill type. Each test attempt selects a unique subset, guaranteeing no student sees repeated questions across retakes. The scoring algorithm, database schema, API routes, and UI all need updates to support variable question counts, question tracking, and the expanded bank.

**Primary recommendation:** Build the question bank as a large TypeScript constant array (not a database table) organized by level and tagged by skill type. Use a Fisher-Yates shuffle with per-student seed based on previously-seen question IDs to guarantee no repeats. Expand the PlacementTest schema to track which questions were served. Keep the contiguous scoring algorithm but make it percentage-based (not fixed count) to handle variable questions per section.

## Project Constraints (from CLAUDE.md)

### Portal Separation
- Test engine is exclusively **Client Hub** (Portal 2) code
- Routes: `/hub/test/*`, `/api/hub/test/*`
- Auth: Custom JWT via `getHubAuth()` (jose, httpOnly cookie `hub-token`)
- Never import hub-auth in dashboard code or vice versa
- Admin views of test results remain in `/dashboard/tests` and `/dashboard/customers/[id]`

### Technology Stack (Locked)
- Next.js 14+ (App Router), TypeScript strict mode
- PostgreSQL (Neon) with Prisma ORM (`@prisma/client ^5.19.0`)
- Vercel Serverless deployment
- Path alias: `@/` for imports
- Services: stateless singletons in `lib/services/`
- Schema changes: `npm run db:generate` then `npm run db:push` (dev)

### Naming Conventions
- Services: `*.service.ts` (lowercase with dashes)
- API Routes: `route.ts` (Next.js App Router)
- Components in `components/`

### i18n
- Hub supports EN and PT-BR via `lib/i18n/hub.ts` translation keys
- Language derived from JWT payload

## Current Implementation Analysis

### What Exists Today

| Component | Location | Description |
|-----------|----------|-------------|
| Question definitions | `lib/hub/english-test.ts` | 25 questions, 5 sections of 5 |
| Answer key | `lib/hub/english-test.ts` (ANSWER_KEY) | Object mapping `q1`-`q25` to correct option index |
| Scoring algorithm | `lib/hub/english-test.ts` (calculateScore) | Contiguous section-pass, threshold 3/5 |
| Test page (client) | `app/hub/test/page.tsx` | Client component, fetches questions, section-by-section UI |
| Test API | `app/api/hub/test/route.ts` | GET returns all QUESTIONS (no answers) |
| Submit API | `app/api/hub/test/submit/route.ts` | POST scores answers, creates PlacementTest record |
| Result page | `app/hub/test/result/page.tsx` | Server component, shows latest result |
| Result API | `app/api/hub/test/result/route.ts` | GET returns latest PlacementTest for client |
| Admin test list | `app/dashboard/tests/page.tsx` | Server component, lists all test results |
| Admin API | `app/api/dashboard/tests/route.ts` | GET returns all tests with customer info |
| Customer detail | `app/dashboard/customers/[id]/page.tsx` | Shows latest test result badge |
| Hub status page | `app/hub/status/page.tsx` | Shows test level in onboarding steps |
| Hub dashboard | `app/hub/page.tsx` | Shows English Level card |
| i18n keys | `lib/i18n/hub.ts` | `test.*` and `testResult.*` translation keys |

### Current Data Model (PlacementTest)

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
  answers          Json     // { "q1": 2, "q2": 0, ... }
  createdAt        DateTime @default(now())
  customerId       String
  customer         Customer @relation(...)
}
```

### Current Scoring Algorithm

The contiguous algorithm requires passing ALL sections 1..N to earn level N:
- Pass threshold: 3 out of 5 correct (60%) per section
- Section 1 pass -> A2, Sections 1-2 -> B1, 1-3 -> B2, 1-4 -> C1, 1-5 (perfect) -> C2
- If section 1 fails, level is A1 regardless of higher section scores

### What Must Change

1. **Question bank**: 25 fixed -> 100-200+ questions organized by CEFR level
2. **Randomization**: Each test draws a different subset; no student sees the same set twice
3. **No-repeat guarantee**: Track which questions a student has already seen
4. **Scoring**: Must adapt to variable question counts per section
5. **Schema**: Must store which specific questions were served (for scoring and auditing)
6. **API**: Must return a unique question set per student, not the full bank
7. **Admin**: Score display must adapt to variable max scores

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.5.0 | Type-safe question bank definitions | Already in project |
| Prisma | ^5.19.0 | Schema changes for question tracking | Already in project |
| Next.js | ^14.2.0 | API routes and pages | Already in project |

### Supporting (No New Dependencies)
This phase requires **zero new npm packages**. All functionality (randomization, scoring, question bank) is pure TypeScript logic.

| Utility | Source | Purpose | Why |
|---------|--------|---------|-----|
| Fisher-Yates shuffle | Custom (~15 lines) | Randomize question selection | Standard O(n) shuffle, no library needed |
| Crypto.getRandomValues | Node.js built-in | Cryptographically secure random seed | Available in Next.js server runtime |

**Installation:**
```bash
# No new packages required
npm run db:generate  # After schema changes
```

## Architecture Patterns

### Recommended Project Structure

```
lib/hub/
  english-test.ts              # REPLACE: scoring algorithm only (no questions)
  question-bank/
    index.ts                   # Bank loader + randomizer + type exports
    questions-a1.ts            # ~20 questions for A1 level
    questions-a2.ts            # ~25 questions for A2 level
    questions-b1.ts            # ~30 questions for B1 level
    questions-b2.ts            # ~30 questions for B2 level
    questions-c1.ts            # ~25 questions for C1 level
    questions-c2.ts            # ~20 questions for C2 level
    types.ts                   # Question, QuestionBank, SkillType types

app/hub/test/
  page.tsx                     # MODIFY: dynamic question count, section labels
  result/page.tsx              # MODIFY: dynamic max scores

app/api/hub/test/
  route.ts                     # MODIFY: generate randomized question set
  submit/route.ts              # MODIFY: score against served questions
  result/route.ts              # (likely unchanged)
```

### Pattern 1: Question Bank as TypeScript Constants

**What:** Store all questions as typed constant arrays in separate files per CEFR level. Each question has metadata (level, skill type, difficulty tag) but the full bank is never sent to the client.

**When to use:** When question count is 100-200 items (small enough for memory, no database overhead needed).

**Why not database:** Questions are developer-authored content, not user-generated. Storing in code means: version-controlled, type-safe, no migration needed for content changes, no admin CRUD UI required, instant availability without DB queries.

```typescript
// lib/hub/question-bank/types.ts
export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type SkillType = 'grammar' | 'vocabulary' | 'reading' | 'idioms' | 'error-identification';

export interface BankQuestion {
  id: string;                    // unique: "a1_gram_01", "b2_read_03"
  level: CEFRLevel;              // which CEFR level this tests
  section: number;               // 1-5 (maps to test sections)
  skillType: SkillType;          // what skill is being tested
  question: string;              // the question text
  options: string[];             // 4 options (always 4)
  correctIndex: number;          // 0-based index of correct answer
  passage?: string;              // optional reading passage
  explanation?: string;          // optional explanation (for future use)
}

// Client-facing version (no correctIndex, no explanation)
export interface ClientQuestion {
  id: string;
  section: number;
  question: string;
  options: string[];
  passage?: string;
}
```

```typescript
// lib/hub/question-bank/questions-a1.ts
import { BankQuestion } from './types';

export const A1_QUESTIONS: BankQuestion[] = [
  {
    id: 'a1_gram_01',
    level: 'A1',
    section: 1,
    skillType: 'grammar',
    question: 'Choose the correct form: "She _____ a software engineer at a company in Miami."',
    options: ['am', 'is', 'are', 'be'],
    correctIndex: 1,
  },
  // ... 15-20 more A1 questions
];
```

### Pattern 2: Fisher-Yates Selection with No-Repeat Tracking

**What:** When generating a test, query previously-seen question IDs for the student, filter them out of the bank, then use Fisher-Yates partial shuffle to select N questions per section.

**Algorithm:**
1. Load all questions for each section from the bank
2. Query `PlacementTest` records for this customer to get `questionIds` (previously served)
3. Filter out previously-seen questions from available pool
4. If pool is exhausted (student has seen all questions), reset pool (allow repeats)
5. Fisher-Yates partial shuffle: select exactly N questions per section
6. Return selected questions (stripped of answers) to client
7. Store `questionIds` array in the PlacementTest record on submit

```typescript
// lib/hub/question-bank/index.ts
function selectQuestions(
  pool: BankQuestion[],
  count: number,
  excludeIds: Set<string>,
): BankQuestion[] {
  // Filter out previously seen
  let available = pool.filter(q => !excludeIds.has(q.id));

  // If exhausted, reset (allow repeats for this section)
  if (available.length < count) {
    available = [...pool];
  }

  // Fisher-Yates partial shuffle: select `count` items
  const result: BankQuestion[] = [];
  const arr = [...available];
  for (let i = 0; i < Math.min(count, arr.length); i++) {
    const j = i + Math.floor(Math.random() * (arr.length - i));
    [arr[i], arr[j]] = [arr[j], arr[i]];
    result.push(arr[i]);
  }
  return result;
}
```

### Pattern 3: Answer Key Lookup (Not Client-Exposed)

**What:** The answer key is never sent to the client. On submit, the server looks up the correct answer from the bank using the question ID.

```typescript
// On submit: score by looking up each question in the bank
function scoreAnswers(
  answers: Record<string, number>,
  questionIds: string[],
): SectionScores {
  const bank = getAllQuestions(); // in-memory lookup
  const bankMap = new Map(bank.map(q => [q.id, q]));

  for (const qId of questionIds) {
    const question = bankMap.get(qId);
    if (!question) continue;
    const userAnswer = answers[qId];
    if (userAnswer === question.correctIndex) {
      // increment section score
    }
  }
}
```

### Anti-Patterns to Avoid

- **Storing questions in the database:** Adds unnecessary CRUD complexity, migration overhead, and admin UI work for content that changes infrequently and is developer-authored.
- **Sending the full question bank to the client:** Leaks the entire bank and answer structure. Only send the selected subset, stripped of `correctIndex`.
- **Using Math.random() for critical randomization:** While adequate for test question shuffling (not cryptographic), be aware it is not seeded. For reproducibility, consider a seeded PRNG if you need to reconstruct the exact same test from a seed.
- **Hardcoding section question counts in the UI:** The UI should derive section counts from the questions it receives, not assume 5.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Question shuffling | Custom shuffle algorithm | Fisher-Yates (well-known, ~15 lines) | Battle-tested O(n) algorithm, trivial to implement correctly |
| CEFR level mapping | Complex ML scoring | Contiguous threshold algorithm (existing) | Already implemented and correct; just needs percentage adaptation |
| Question bank CRUD UI | Admin editor for questions | TypeScript constant files | Questions are developer-authored, version-controlled content |
| Question uniqueness tracking | Custom dedup table | `questionIds` JSON field on PlacementTest | Simple, queryable, no extra table needed |

**Key insight:** The hard part of this phase is NOT the technology -- it is authoring 100-200+ high-quality, pedagogically sound English questions across 6 CEFR levels. The code changes are straightforward TypeScript/Prisma work.

## CEFR Question Bank Structure

### Grammar and Vocabulary Topics Per Level

Based on the Common European Framework of Reference and official exam structures:

| Level | Section | Grammar Topics | Vocabulary/Skill Topics | Question Count Target |
|-------|---------|---------------|------------------------|----------------------|
| A1 | 1 | to be, simple present, articles, there is/are, personal pronouns, imperatives, basic prepositions | Basic workplace vocab, greetings, numbers, daily life | 15-20 |
| A2 | 2 | Past simple, comparatives/superlatives, going to/will, first conditional, much/many, present perfect (intro), phrasal verbs (basic) | Common expressions, false cognates (PT-BR), workplace routines | 20-25 |
| B1 | 3 | Present perfect vs past simple, second conditional, past perfect, reported speech, passive voice (simple), used to, gerunds/infinitives | Reading comprehension (short passages), career/immigration context | 25-30 |
| B2 | 4 | Third conditional, mixed conditionals, future perfect, modal perfects, complex passives, relative clauses, formal register | Cover letters, formal communication, complex reading passages | 25-30 |
| C1 | 5 | Subjunctive mood, inversion, cleft sentences, advanced modals, wish/if only, complex reported speech | Idioms, subtle distinctions (raise/rise), error identification, nuance | 20-25 |
| C2 | 5 | All C1 + near-native subtleties, literary/academic register | Advanced idioms, academic vocabulary, rhetorical devices | 10-15 |

**Note:** C1 and C2 share section 5 in the current 5-section model. The question bank tags them separately so future adaptive testing can distinguish them, but for section scoring they are pooled into section 5.

### Question Types Per Section

| Section | Primary Types | Reading Passages |
|---------|--------------|-----------------|
| 1 (A1) | Fill-in-blank, vocabulary definition, correct sentence identification | None |
| 2 (A2) | Fill-in-blank, preposition choice, expression meaning, false cognate identification | None |
| 3 (B1) | Tense selection, conditional completion, reading comprehension | 1-2 short passages per test |
| 4 (B2) | Passive voice rewrite, formal register selection, complex tense, reading comprehension | 1-2 medium passages per test |
| 5 (C1-C2) | Subjunctive identification, idiom meaning, error identification, nuance selection | 0-1 passages per test |

### Question ID Convention

Format: `{level}_{skill}_{number}` (e.g., `a1_gram_01`, `b2_read_03`, `c1_idiom_05`)

Skills: `gram` (grammar), `vocab` (vocabulary), `read` (reading comprehension), `idiom` (idioms/expressions), `errid` (error identification)

### Questions Per Test (Selected from Bank)

| Section | Questions Selected | Min Bank Size | Recommended Bank Size |
|---------|-------------------|---------------|----------------------|
| 1 | 5 | 15 | 20 |
| 2 | 5 | 15 | 25 |
| 3 | 5 | 15 | 30 |
| 4 | 5 | 15 | 30 |
| 5 | 5 | 15 | 25 |
| **Total** | **25** | **75 (minimum)** | **130 (recommended)** |

At 25 questions per test and 130+ in the bank, a student can take 3+ completely unique tests before any question repeats. With 200+ questions, that rises to 5-8 unique tests.

## Scoring Algorithm (Updated)

### Adaptation for Variable Questions

The existing contiguous algorithm is sound and should be preserved. The only change needed: derive passing threshold from count rather than hardcoding 3/5.

```typescript
const PASS_RATE = 0.6; // 60% per section to pass

function calculateScore(
  answers: Record<string, number>,
  servedQuestions: BankQuestion[],
): TestResult {
  // Group served questions by section
  const sections = [1, 2, 3, 4, 5];
  const sectionScores: number[] = sections.map(sec => {
    const sectionQs = servedQuestions.filter(q => q.section === sec);
    let correct = 0;
    for (const q of sectionQs) {
      if (answers[q.id] === q.correctIndex) correct++;
    }
    return correct;
  });

  const sectionCounts = sections.map(sec =>
    servedQuestions.filter(q => q.section === sec).length
  );

  const totalScore = sectionScores.reduce((a, b) => a + b, 0);
  const totalQuestions = servedQuestions.length;
  const percentage = Math.round((totalScore / totalQuestions) * 100);

  // Contiguous pass: highest section N where ALL 1..N passed
  let highestPassed = 0;
  for (const sec of sections) {
    const threshold = Math.ceil(sectionCounts[sec - 1] * PASS_RATE);
    if (sectionScores[sec - 1] >= threshold) {
      highestPassed = sec;
    } else {
      break;
    }
  }

  // Map to CEFR (same logic as current)
  const cefrMap: Record<number, string> = {
    0: 'A1', 1: 'A2', 2: 'B1', 3: 'B2', 4: 'C1', 5: 'C1',
  };
  let cefrLevel = cefrMap[highestPassed] || 'A1';

  // C2 only if section 5 is perfect
  if (highestPassed === 5) {
    cefrLevel = sectionScores[4] === sectionCounts[4] ? 'C2' : 'C1';
  }

  return { sectionScores, totalScore, percentage, cefrLevel, ... };
}
```

## Database Schema Changes

### PlacementTest Model (Updated)

```prisma
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
  answers          Json       // { "a1_gram_01": 2, "b2_read_03": 0, ... }
  questionIds      String[]   // NEW: ordered list of question IDs served
  questionCount    Int        // NEW: total questions in this test (for display)
  createdAt        DateTime   @default(now())
  customerId       String
  customer         Customer   @relation(fields: [customerId], references: [id])

  @@index([customerId])
  @@map("placement_tests")
}
```

**Key changes:**
- `questionIds String[]` -- PostgreSQL native string array storing which questions were served. Used for no-repeat tracking and score verification.
- `questionCount Int` -- Total questions served (should be 25 for standard test, but stored explicitly for forward compatibility).
- `answers` JSON format changes from `{"q1": 2}` to `{"a1_gram_01": 2}` (new ID format).

### Migration Considerations

Existing `PlacementTest` records used the old 25-question fixed format. Two options:
1. **Add columns as optional** (`questionIds String[]? @default([])`, `questionCount Int @default(25)`) -- backward compatible, old records keep working
2. **Backfill old records** -- set `questionIds` to `["q1"..."q25"]` and `questionCount` to 25

**Recommendation:** Option 1 (add as optional with defaults). Old test records remain valid. The admin dashboard shows `totalScore/questionCount` which gracefully handles both old (25) and new (variable) tests.

## Randomization Strategy

### No-Repeat Guarantee Algorithm

```
1. Client requests GET /api/hub/test
2. Server authenticates via hub-token
3. Server queries: all PlacementTest.questionIds for this customerId
4. Server builds excludeSet: union of all previously-served question IDs
5. For each section (1-5):
   a. Get all bank questions for this section
   b. Filter out excludeSet
   c. If remaining < needed count, reset pool (allow repeats for this section)
   d. Fisher-Yates partial shuffle to select N questions
6. Combine all sections, strip correctIndex
7. Store selected questionIds in server session/temp or return with test
8. On submit, use questionIds to score
```

### Stateless Question Tracking

Since Vercel is serverless (no session state between requests), the question selection must be reproducible or stored:

**Option A: Store question selection at generation time** -- Create a "pending" PlacementTest record when questions are generated, storing `questionIds`. On submit, update that record with answers and scores.

**Option B: Sign the question set** -- Return questionIds as part of the test payload (encrypted/signed JWT) that the client sends back on submit.

**Recommendation:** Option A is simpler and more robust. Create the PlacementTest record immediately on GET with `answers: {}` and a status field, then update on submit. This also prevents multiple test generations without submission.

### Handling Pool Exhaustion

With 130+ questions and 25 per test, a student exhausts the bank after ~5 tests. After exhaustion:
- Reset the seen-questions pool
- Log that the student is on a "repeat cycle"
- This is acceptable -- most students take 1-2 tests total

## Common Pitfalls

### Pitfall 1: Answer Key Leakage
**What goes wrong:** Sending `correctIndex` to the client allows cheating by inspecting network responses.
**Why it happens:** The bank stores answers alongside questions; forgetting to strip them before sending.
**How to avoid:** Create a `toClientQuestion()` mapper function that explicitly picks only safe fields. Never spread the full `BankQuestion` object in API responses.
**Warning signs:** Client-side code accessing `correctIndex` or `explanation` fields.

### Pitfall 2: Race Condition on Test Generation
**What goes wrong:** Student opens two tabs, gets two different question sets, submits one -- the other question set is scored against wrong questions.
**Why it happens:** Stateless API generates fresh questions on each GET call.
**How to avoid:** Create a "pending" test record on first GET. Subsequent GETs return the same pending test's questions. Only one pending test per student.
**Warning signs:** Multiple PlacementTest records with empty answers for the same customer.

### Pitfall 3: Hardcoded "/25" in UI
**What goes wrong:** Admin dashboard shows "Score: 18/25" but the test had a different question count.
**Why it happens:** Current code hardcodes 25 as max score in both hub and admin views.
**How to avoid:** Store `questionCount` on the record. Display as `totalScore/questionCount`. Grep for `/25` across all files.
**Warning signs:** Search for literal `25` in test-related components and API responses.

### Pitfall 4: Section Score Display Assumptions
**What goes wrong:** Result page shows "section1Score/5" but sections may have more or fewer than 5 questions.
**Why it happens:** Current UI hardcodes 5 as max per section.
**How to avoid:** Store per-section max alongside per-section score, OR keep sections at exactly 5 questions (recommended for simplicity).
**Warning signs:** Mismatch between displayed max and actual max per section.

### Pitfall 5: Stale Question Pool After Code Deploy
**What goes wrong:** A student's pending test references question IDs that were renamed or removed in a code update.
**Why it happens:** Questions are in code, but pending tests reference them by ID.
**How to avoid:** Never change a question ID once created. To "remove" a question, add a `deprecated: true` flag. Score calculation should handle missing questions gracefully (skip, don't crash).
**Warning signs:** Questions not found during scoring.

### Pitfall 6: Migration Breaking Admin Dashboard
**What goes wrong:** Admin tests page crashes because old records lack `questionIds` or `questionCount`.
**Why it happens:** Schema migration adds new required fields without defaults.
**How to avoid:** Make new fields optional with sensible defaults (`questionIds: []`, `questionCount: 25`). Update admin display logic to check for presence.
**Warning signs:** Prisma errors on `findMany` for existing records.

## Code Examples

### Stripping Answer Key Before Sending to Client

```typescript
// lib/hub/question-bank/index.ts
import { BankQuestion, ClientQuestion } from './types';

export function toClientQuestion(q: BankQuestion): ClientQuestion {
  return {
    id: q.id,
    section: q.section,
    question: q.question,
    options: q.options,
    ...(q.passage ? { passage: q.passage } : {}),
  };
}
```

### API Route: Generate Test Questions

```typescript
// app/api/hub/test/route.ts
import { getHubAuth } from '@/lib/hub-auth';
import { prisma } from '@/lib/db';
import { generateTest, toClientQuestion } from '@/lib/hub/question-bank';

export async function GET(request: NextRequest) {
  const auth = await getHubAuth(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check for pending test (already generated, not yet submitted)
  const pending = await prisma.placementTest.findFirst({
    where: { customerId: auth.customerId, totalScore: -1 }, // sentinel for pending
    orderBy: { createdAt: 'desc' },
  });

  if (pending && pending.questionIds.length > 0) {
    // Return existing pending test questions
    const questions = getQuestionsByIds(pending.questionIds);
    return NextResponse.json({ questions: questions.map(toClientQuestion), testId: pending.id });
  }

  // Get previously seen question IDs
  const previousTests = await prisma.placementTest.findMany({
    where: { customerId: auth.customerId },
    select: { questionIds: true },
  });
  const seenIds = new Set(previousTests.flatMap(t => t.questionIds));

  // Generate new test
  const selected = generateTest(seenIds);
  const questionIds = selected.map(q => q.id);

  // Create pending record
  const test = await prisma.placementTest.create({
    data: {
      customerId: auth.customerId,
      questionIds,
      questionCount: questionIds.length,
      totalScore: -1,        // sentinel: not yet scored
      percentage: 0,
      cefrLevel: '',
      displayLevel: '',
      section1Score: 0,
      section2Score: 0,
      section3Score: 0,
      section4Score: 0,
      section5Score: 0,
      answers: {},
    },
  });

  return NextResponse.json({ questions: selected.map(toClientQuestion), testId: test.id });
}
```

### Fisher-Yates Partial Shuffle

```typescript
// lib/hub/question-bank/index.ts
function selectRandom<T>(pool: T[], count: number): T[] {
  const arr = [...pool];
  const n = Math.min(count, arr.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (arr.length - i));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}
```

## Files Requiring Modification

| File | Change Type | Scope |
|------|-------------|-------|
| `lib/hub/english-test.ts` | **Major rewrite** | Remove QUESTIONS/ANSWER_KEY, keep scoring (adapted) |
| `lib/hub/question-bank/` (new dir) | **New** | Types, question files per level, bank loader, randomizer |
| `app/api/hub/test/route.ts` | **Major rewrite** | Generate randomized questions, create pending test |
| `app/api/hub/test/submit/route.ts` | **Major rewrite** | Score against specific question set, update pending record |
| `app/hub/test/page.tsx` | **Moderate** | Accept testId, dynamic question counts, send testId on submit |
| `app/hub/test/result/page.tsx` | **Minor** | Dynamic max scores (`totalScore/questionCount` instead of `/25`) |
| `prisma/schema.prisma` | **Minor** | Add `questionIds`, `questionCount` to PlacementTest |
| `app/dashboard/tests/page.tsx` | **Minor** | Dynamic max scores |
| `app/dashboard/customers/[id]/page.tsx` | **Minor** | Dynamic max scores |
| `app/hub/page.tsx` | **Minor** | Dynamic max scores in English Level card |
| `app/hub/status/page.tsx` | **Minimal** | No change needed (only shows level/cefrLevel) |
| `lib/i18n/hub.ts` | **Minor** | Update `test.questionsInfo` string, possibly add new keys |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed 25-question test | Randomized from bank | This phase | Each student gets unique test |
| Answers as `q1`-`q25` keys | Answers keyed by descriptive IDs | This phase | Traceable, no collision |
| Score always out of 25 | Score out of dynamic `questionCount` | This phase | Admin displays must adapt |
| No repeat tracking | `questionIds` array on each test | This phase | Enables no-repeat guarantee |

## Open Questions

1. **Exact question count target**
   - What we know: Phase description says "100-200+ questions across A1-C2"
   - What's unclear: Exact minimum to ship -- is 100 acceptable for v1, or must it be 150+?
   - Recommendation: Ship with 130 questions minimum (enables 3+ unique tests). Expand to 200+ iteratively.

2. **Questions per test: keep 25 or increase?**
   - What we know: Current test is 25 questions (5 sections x 5 each)
   - What's unclear: Whether 25 is sufficient or should increase to 30-40
   - Recommendation: Keep 25 (5x5) for v1 -- it is the established experience, and changing count affects time estimates shown to students.

3. **Who authors the new questions?**
   - What we know: Questions must be career/immigration-context specific for Brazilian immigrants
   - What's unclear: Whether the developer (Claude) writes all questions or a subject-matter expert provides them
   - Recommendation: Developer writes initial bank using CEFR grammar structures as guide, maintaining the career/immigration context of the current 25 questions. Flag for ESL expert review post-launch.

4. **Should option order be shuffled too?**
   - What we know: Current test has fixed option order
   - What's unclear: Whether shuffling options within each question adds meaningful anti-cheating value
   - Recommendation: Yes, shuffle options on each test generation. Store the mapping so scoring works correctly. This prevents students sharing "the answer is always B" patterns.

5. **Pending test expiration**
   - What we know: A pending test record is created when questions are generated
   - What's unclear: How long should a pending test remain valid before expiring?
   - Recommendation: 24 hours. After that, discard the pending record and generate fresh questions. This handles tab-close scenarios.

## Sources

### Primary (HIGH confidence)
- Direct code analysis of `lib/hub/english-test.ts`, `app/api/hub/test/route.ts`, `app/api/hub/test/submit/route.ts`, `app/hub/test/page.tsx`, `app/hub/test/result/page.tsx`, `prisma/schema.prisma`
- Original design spec: `docs/superpowers/specs/2026-03-17-client-hub-forms-tests-design.md`

### Secondary (MEDIUM confidence)
- [TrackTest - English Grammar CEF Level Requirements](https://tracktest.eu/english-grammar-cef-level-requirements/) - Grammar structures per CEFR level
- [ExamEnglish - CEFR Grammar](https://www.examenglish.com/CEFR/cefr_grammar.htm) - Grammar points per level
- [Council of Europe - CEFR Level Descriptions](https://www.coe.int/en/web/common-european-framework-reference-languages/level-descriptions) - Official CEFR descriptors
- [TAO Testing - Question Randomization](https://www.taotesting.com/blog/how-test-question-randomization-improves-exam-integrity/) - Randomization patterns

### Tertiary (LOW confidence)
- [IJERT - Intelligent Question Paper Generator](https://www.ijert.org/an-intelligent-question-paper-generator-using-randomized-algorithm) - Academic paper on randomization algorithms (verified Fisher-Yates is standard)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, pure TypeScript + existing Prisma
- Architecture: HIGH - Patterns directly derived from existing codebase analysis
- Question bank structure: HIGH - Based on official CEFR descriptors and existing test format
- Scoring algorithm: HIGH - Direct adaptation of existing working algorithm
- Pitfalls: HIGH - Identified from concrete code analysis of current implementation
- Randomization: HIGH - Fisher-Yates is textbook algorithm, no-repeat tracking is straightforward

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable domain, no fast-moving dependencies)
