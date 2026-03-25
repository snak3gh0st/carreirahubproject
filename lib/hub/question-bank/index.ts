// ---------------------------------------------------------------------------
// Question Bank — Loader, Randomizer, Scoring, and Type Re-exports
// ---------------------------------------------------------------------------

import { BankQuestion, ClientQuestion, TestResult } from './types';
import { A1_QUESTIONS } from './questions-a1';
import { A2_QUESTIONS } from './questions-a2';
import { B1_QUESTIONS } from './questions-b1';
import { B2_QUESTIONS } from './questions-b2';
import { C1_QUESTIONS } from './questions-c1';
import { C2_QUESTIONS } from './questions-c2';

export type { BankQuestion, ClientQuestion, TestResult };

// ---------------------------------------------------------------------------
// Display-level mapping
// ---------------------------------------------------------------------------

export const DISPLAY_LEVELS: Record<string, { display: string; displayPt: string }> = {
  A1: { display: 'Beginner', displayPt: 'Iniciante' },
  A2: { display: 'Beginner', displayPt: 'Iniciante' },
  B1: { display: 'Intermediate', displayPt: 'Intermediario' },
  B2: { display: 'Intermediate', displayPt: 'Intermediario' },
  C1: { display: 'Advanced', displayPt: 'Avancado' },
  C2: { display: 'Fluent', displayPt: 'Fluente' },
};

// ---------------------------------------------------------------------------
// Bank loader
// ---------------------------------------------------------------------------

let _cachedBank: BankQuestion[] | null = null;

/**
 * Returns all questions from all level files combined.
 * Result is cached in memory after first call.
 */
export function getAllQuestions(): BankQuestion[] {
  if (_cachedBank) return _cachedBank;
  _cachedBank = [
    ...A1_QUESTIONS,
    ...A2_QUESTIONS,
    ...B1_QUESTIONS,
    ...B2_QUESTIONS,
    ...C1_QUESTIONS,
    ...C2_QUESTIONS,
  ];
  return _cachedBank;
}

// ---------------------------------------------------------------------------
// ID-based lookup
// ---------------------------------------------------------------------------

let _bankMap: Map<string, BankQuestion> | null = null;

function getBankMap(): Map<string, BankQuestion> {
  if (_bankMap) return _bankMap;
  const bank = getAllQuestions();
  _bankMap = new Map(bank.map((q) => [q.id, q]));
  return _bankMap;
}

/**
 * Returns BankQuestion[] for the given IDs from the full bank.
 * Uses a Map for O(1) lookup. Unknown IDs are silently skipped.
 */
export function getQuestionsByIds(ids: string[]): BankQuestion[] {
  const map = getBankMap();
  return ids.flatMap((id) => {
    const q = map.get(id);
    return q ? [q] : [];
  });
}

// ---------------------------------------------------------------------------
// Client question mapper (strips correctIndex and explanation)
// ---------------------------------------------------------------------------

/**
 * Strip server-only fields before sending to the client.
 * Never spreads the full BankQuestion — only picks safe fields.
 */
export function toClientQuestion(q: BankQuestion): ClientQuestion {
  const client: ClientQuestion = {
    id: q.id,
    section: q.section,
    question: q.question,
    options: q.options,
  };
  if (q.passage) {
    client.passage = q.passage;
  }
  return client;
}

// ---------------------------------------------------------------------------
// Fisher-Yates partial shuffle
// ---------------------------------------------------------------------------

/**
 * Selects `count` items from `pool` using Fisher-Yates partial shuffle.
 * Returns a new array of length min(count, pool.length).
 * Does NOT mutate the original array.
 */
export function selectRandom<T>(pool: T[], count: number): T[] {
  const arr = [...pool];
  const n = Math.min(count, arr.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (arr.length - i));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr.slice(0, n);
}

// ---------------------------------------------------------------------------
// Test generator
// ---------------------------------------------------------------------------

const SECTIONS = [1, 2, 3, 4, 5] as const;

/**
 * Generates a test by selecting `questionsPerSection` questions from each section.
 *
 * No-repeat guarantee:
 *   - seenIds: Set of question IDs already served to this student (from prior tests)
 *   - For each section, filters out seenIds from the pool
 *   - If remaining < needed, resets to the full section pool (allow repeats)
 *
 * Only sections with at least 1 available question are included in the output.
 */
export function generateTest(
  seenIds: Set<string>,
  questionsPerSection: number = 5,
): BankQuestion[] {
  const bank = getAllQuestions();
  const result: BankQuestion[] = [];

  for (const sec of SECTIONS) {
    const sectionPool = bank.filter((q) => q.section === sec);
    if (sectionPool.length === 0) continue;

    // Filter out previously seen questions
    let available = sectionPool.filter((q) => !seenIds.has(q.id));

    // If not enough unseen questions, reset pool (allow repeats for this section)
    if (available.length < questionsPerSection) {
      available = sectionPool;
    }

    const selected = selectRandom(available, questionsPerSection);
    result.push(...selected);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Scoring algorithm (contiguous pass with 60% threshold)
// ---------------------------------------------------------------------------

const PASS_RATE = 0.6; // 60% per section required to "pass"

/**
 * Scores a test using the contiguous algorithm:
 *
 * 1. Compute per-section scores (correct count).
 * 2. Pass threshold per section = Math.ceil(sectionCount * 0.6).
 * 3. CEFR level = highest section N where ALL sections 1..N passed.
 * 4. Mapping: 0 passed=A1, 1=A2, 2=B1, 3=B2, 4=C1,
 *    5 with perfect section 5 = C2, otherwise C1.
 *
 * @param answers  Record of question ID -> selected option index (0-based)
 * @param questionIds  Ordered list of question IDs that were served
 */
export function scoreAnswers(
  answers: Record<string, number>,
  questionIds: string[],
): TestResult {
  const map = getBankMap();
  const servedQuestions = questionIds.flatMap((id) => {
    const q = map.get(id);
    return q ? [q] : [];
  });

  // --- Per-section scores and max counts ---
  const sectionScores: number[] = SECTIONS.map((sec) => {
    let correct = 0;
    for (const q of servedQuestions) {
      if (q.section !== sec) continue;
      if (answers[q.id] !== undefined && answers[q.id] === q.correctIndex) {
        correct++;
      }
    }
    return correct;
  });

  const sectionMaxes: number[] = SECTIONS.map((sec) =>
    servedQuestions.filter((q) => q.section === sec).length,
  );

  const totalScore = sectionScores.reduce((a, b) => a + b, 0);
  const totalQuestions = servedQuestions.length;
  const percentage = totalQuestions > 0
    ? Math.round((totalScore / totalQuestions) * 100)
    : 0;

  // --- Contiguous pass algorithm ---
  let highestPassedSection = 0;
  for (const sec of SECTIONS) {
    const sectionCount = sectionMaxes[sec - 1];
    if (sectionCount === 0) break; // no questions for this section — stop contiguous check
    const threshold = Math.ceil(sectionCount * PASS_RATE);
    if (sectionScores[sec - 1] >= threshold) {
      highestPassedSection = sec;
    } else {
      break; // contiguous: stop at first failure
    }
  }

  // --- Map to CEFR level ---
  let cefrLevel: string;
  switch (highestPassedSection) {
    case 0:
      cefrLevel = 'A1';
      break;
    case 1:
      cefrLevel = 'A2';
      break;
    case 2:
      cefrLevel = 'B1';
      break;
    case 3:
      cefrLevel = 'B2';
      break;
    case 4:
      cefrLevel = 'C1';
      break;
    case 5:
      // Perfect section 5 (all correct) -> C2, otherwise C1
      cefrLevel = sectionScores[4] === sectionMaxes[4] ? 'C2' : 'C1';
      break;
    default:
      cefrLevel = 'A1';
  }

  const { display, displayPt } = DISPLAY_LEVELS[cefrLevel] ?? { display: 'Beginner', displayPt: 'Iniciante' };

  return {
    sectionScores,
    sectionMaxes,
    totalScore,
    percentage,
    cefrLevel,
    displayLevel: display,
    displayLevelPt: displayPt,
  };
}
