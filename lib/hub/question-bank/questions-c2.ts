// ---------------------------------------------------------------------------
// C2 Level Questions — Section 5 (near-native subtleties)
// Topics: academic/literary register, advanced idioms, rhetorical devices,
//         subtle word choice, near-native error identification
// Context: career/immigration themes for Brazilian immigrants in the US
// ---------------------------------------------------------------------------

import { BankQuestion } from './types';

export const C2_QUESTIONS: BankQuestion[] = [
  // --- Grammar / Academic Register ---
  {
    id: 'c2_gram_01',
    level: 'C2',
    section: 5,
    skillType: 'grammar',
    question: '"_____ the economic downturn, the company managed to increase its workforce by 15%."',
    options: ['Despite of', 'In spite', 'Notwithstanding', 'Regardless'],
    correctIndex: 2,
  },
  {
    id: 'c2_gram_02',
    level: 'C2',
    section: 5,
    skillType: 'grammar',
    question: '"The proposal was rejected, _____ its innovative approach and strong cost projections."',
    options: ['despite', 'although', 'even', 'however'],
    correctIndex: 0,
  },
  {
    id: 'c2_gram_03',
    level: 'C2',
    section: 5,
    skillType: 'grammar',
    question: 'Which sentence uses formal hedging language correctly?',
    options: [
      '"This is definitely the best solution."',
      '"The results would seem to suggest a positive correlation."',
      '"Obviously, anyone can see the answer."',
      '"It is totally clear that we should proceed."',
    ],
    correctIndex: 1,
  },

  // --- Vocabulary: Near-Native Subtleties ---
  {
    id: 'c2_vocab_01',
    level: 'C2',
    section: 5,
    skillType: 'vocabulary',
    question: '"The committee deemed the proposal _____, opting instead for a more conservative approach."',
    options: ['mute', 'moot', 'mood', 'moat'],
    correctIndex: 1,
  },
  {
    id: 'c2_vocab_02',
    level: 'C2',
    section: 5,
    skillType: 'vocabulary',
    question: '"To _____ the question" properly means:',
    options: [
      'To ask a difficult question',
      'To assume the conclusion in the premise of an argument',
      'To avoid answering a direct question',
      'To repeat a question for emphasis',
    ],
    correctIndex: 1,
  },
  {
    id: 'c2_vocab_03',
    level: 'C2',
    section: 5,
    skillType: 'vocabulary',
    question: '"The CFO\'s remarks were _____, leaving room for multiple interpretations of the company\'s financial outlook."',
    options: ['ambiguous', 'ambivalent', 'arbitrary', 'ambidextrous'],
    correctIndex: 0,
  },

  // --- Idioms: Advanced ---
  {
    id: 'c2_idiom_01',
    level: 'C2',
    section: 5,
    skillType: 'idioms',
    question: '"She\'s been burning the midnight oil all week to prepare for the audit." This means:',
    options: [
      'She works by candlelight',
      'She has been working very late into the night',
      'She is wasting company resources',
      'She started a fire in the office',
    ],
    correctIndex: 1,
  },
  {
    id: 'c2_idiom_02',
    level: 'C2',
    section: 5,
    skillType: 'idioms',
    question: '"Losing that contract turned out to be a blessing in disguise — it led us to a better client." This means:',
    options: [
      'The contract loss was fortunate all along',
      'Something that seemed bad turned out to be beneficial',
      'The client was disguised during negotiations',
      'The company was blessed after a difficult period',
    ],
    correctIndex: 1,
  },
  {
    id: 'c2_idiom_03',
    level: 'C2',
    section: 5,
    skillType: 'idioms',
    question: '"We\'ve done everything we can from our side. The ball is in your court now." This means:',
    options: [
      'A sport is being played in the conference room',
      'The other party now has the responsibility to act',
      'The team needs to be more physical in their work',
      'The meeting should move to the sports court',
    ],
    correctIndex: 1,
  },

  // --- Error Identification: Near-Native Level ---
  {
    id: 'c2_errid_01',
    level: 'C2',
    section: 5,
    skillType: 'error-identification',
    question: 'Which sentence contains a dangling modifier?',
    options: [
      '"After reviewing the data, the conclusion was drawn by the team."',
      '"The manager, who had reviewed the data, drew a conclusion."',
      '"Having reviewed the data, the team drew a conclusion."',
      '"The team reviewed the data before drawing a conclusion."',
    ],
    correctIndex: 0,
  },
  {
    id: 'c2_errid_02',
    level: 'C2',
    section: 5,
    skillType: 'error-identification',
    question: 'Which sentence contains a misplaced modifier?',
    options: [
      '"The executive only approved two proposals, rejecting the rest."',
      '"Only the executive approved two proposals."',
      '"He almost drove his team to complete exhaustion."',
      '"She nearly submitted every form required by the deadline."',
    ],
    correctIndex: 2,
  },

  // --- Rhetorical Devices ---
  {
    id: 'c2_vocab_04',
    level: 'C2',
    section: 5,
    skillType: 'vocabulary',
    question: '"We shall not fail our clients; we shall not fail our team; we shall not fail our mission." Which rhetorical device is used?',
    options: [
      'Metaphor',
      'Parallelism / Anaphora',
      'Litotes',
      'Antithesis',
    ],
    correctIndex: 1,
  },
  {
    id: 'c2_vocab_05',
    level: 'C2',
    section: 5,
    skillType: 'vocabulary',
    question: '"This was not an insignificant achievement for the team." This sentence uses:',
    options: [
      'Hyperbole — extreme exaggeration',
      'Litotes — understatement using double negation',
      'Irony — saying the opposite of what is meant',
      'Parallelism — repeating grammatical structure',
    ],
    correctIndex: 1,
  },
];
