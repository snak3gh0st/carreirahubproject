// ---------------------------------------------------------------------------
// 25-Question English Placement Test with CEFR Scoring
// ---------------------------------------------------------------------------

export interface Question {
  id: string; // "q1"..."q25"
  section: number; // 1-5
  question: string;
  options: string[]; // 4 options
  passage?: string; // for reading comprehension
}

export interface TestResult {
  sectionScores: number[]; // [s1, s2, s3, s4, s5] each 0-5
  totalScore: number; // 0-25
  percentage: number; // 0-100
  cefrLevel: string; // A1, A2, B1, B2, C1, C2
  displayLevel: string; // Beginner, Intermediate, Advanced, Fluent
  displayLevelPt: string; // Iniciante, Intermediario, Avancado, Fluente
}

// ---------------------------------------------------------------------------
// Display-level mapping
// ---------------------------------------------------------------------------

export const DISPLAY_LEVELS: Record<
  string,
  { display: string; displayPt: string }
> = {
  A1: { display: "Beginner", displayPt: "Iniciante" },
  A2: { display: "Beginner", displayPt: "Iniciante" },
  B1: { display: "Intermediate", displayPt: "Intermediario" },
  B2: { display: "Intermediate", displayPt: "Intermediario" },
  C1: { display: "Advanced", displayPt: "Avancado" },
  C2: { display: "Fluent", displayPt: "Fluente" },
};

// ---------------------------------------------------------------------------
// Questions (NO correct answers exposed to the client)
// ---------------------------------------------------------------------------

export const QUESTIONS: Question[] = [
  // =========================================================================
  // SECTION 1 — A1-A2: Basic vocabulary, "to be", simple present
  // =========================================================================
  {
    id: "q1",
    section: 1,
    question: 'Choose the correct form: "She _____ a software engineer at a company in Miami."',
    options: ["am", "is", "are", "be"],
  },
  {
    id: "q2",
    section: 1,
    question: 'What does "resume" mean in a job-search context?',
    options: [
      "To start again",
      "A document listing your work experience and education",
      "A type of interview",
      "A job offer letter",
    ],
  },
  {
    id: "q3",
    section: 1,
    question: 'Complete: "I _____ looking for a new job in the United States."',
    options: ["is", "am", "are", "be"],
  },
  {
    id: "q4",
    section: 1,
    question: 'Which sentence is correct?',
    options: [
      "He work every day in the office.",
      "He works every day in the office.",
      "He working every day in the office.",
      "He to work every day in the office.",
    ],
  },
  {
    id: "q5",
    section: 1,
    question: 'What is the correct question form? "_____ you speak English at work?"',
    options: ["Does", "Do", "Is", "Are"],
  },

  // =========================================================================
  // SECTION 2 — A2-B1: Past tense, prepositions, daily expressions
  // =========================================================================
  {
    id: "q6",
    section: 2,
    question: 'Choose the correct past tense: "I _____ to the United States in 2019."',
    options: ["move", "moved", "moving", "have move"],
  },
  {
    id: "q7",
    section: 2,
    question:
      'Fill in the blank: "The meeting is _____ Monday _____ 9 a.m."',
    options: ["in / at", "on / at", "at / on", "on / in"],
  },
  {
    id: "q8",
    section: 2,
    question:
      'Your coworker says "How\'s it going?" on Monday morning. What is the most natural reply?',
    options: [
      "I am going to the office.",
      "It goes well, thank you.",
      "Not bad, how about you?",
      "Yes, it is going.",
    ],
  },
  {
    id: "q9",
    section: 2,
    question:
      'Choose the correct sentence about a past event:',
    options: [
      "Yesterday I have finished the report.",
      "Yesterday I finished the report.",
      "Yesterday I was finish the report.",
      "Yesterday I did finished the report.",
    ],
  },
  {
    id: "q10",
    section: 2,
    question:
      '"Actually" in English means:',
    options: [
      "Currently / at this moment (atualmente)",
      "In fact / really (na verdade)",
      "Exactly (exatamente)",
      "Obviously (obviamente)",
    ],
  },

  // =========================================================================
  // SECTION 3 — B1-B2: Present perfect, conditionals, reading comprehension
  // =========================================================================
  {
    id: "q11",
    section: 3,
    question:
      'Choose the correct option: "She _____ in the United States for three years."',
    options: [
      "lives",
      "is living",
      "has lived",
      "was living",
    ],
  },
  {
    id: "q12",
    section: 3,
    question:
      'Select the correct conditional: "If I _____ more experience, I would apply for the manager position."',
    options: ["have", "had", "would have", "having"],
  },
  {
    id: "q13",
    section: 3,
    question:
      '"I have never _____ to a job fair in the US before."',
    options: ["go", "went", "been", "going"],
  },
  {
    id: "q14",
    section: 3,
    question: "According to the passage, why did Maria feel confident during the interview?",
    passage:
      "Maria had been preparing for her first job interview in the United States for weeks. She researched the company, practiced common questions with a friend, and chose professional attire. When the interviewer asked about her strengths, she confidently described her five years of project management experience in Brazil. At the end, she asked thoughtful questions about team culture. The interviewer smiled and said they would be in touch soon.",
    options: [
      "Because the interviewer was friendly.",
      "Because she had prepared thoroughly beforehand.",
      "Because she had already worked in the United States.",
      "Because she received a job offer during the interview.",
    ],
  },
  {
    id: "q15",
    section: 3,
    question:
      'Which word best completes the sentence? "By the time he arrived at the office, the meeting _____."',
    options: [
      "already started",
      "has already started",
      "had already started",
      "was already starting",
    ],
  },

  // =========================================================================
  // SECTION 4 — B2-C1: Complex tenses, passive voice, formal register
  // =========================================================================
  {
    id: "q16",
    section: 4,
    question:
      'Rewrite in passive voice: "The HR department reviewed all applications." → "All applications _____ by the HR department."',
    options: [
      "reviewed",
      "were reviewed",
      "have reviewed",
      "are reviewing",
    ],
  },
  {
    id: "q17",
    section: 4,
    question:
      'Choose the most appropriate formal register for a cover letter: "I am writing to _____ my interest in the Marketing Analyst position."',
    options: ["say", "tell", "express", "talk about"],
  },
  {
    id: "q18",
    section: 4,
    question:
      'Fill in the blank: "Had she known about the visa requirements earlier, she _____ the documents on time."',
    options: [
      "will prepare",
      "would prepare",
      "would have prepared",
      "has prepared",
    ],
  },
  {
    id: "q19",
    section: 4,
    question:
      'Which sentence correctly uses the future perfect? "By next December, I _____ at this company for two years."',
    options: [
      "will work",
      "will be working",
      "will have worked",
      "am going to work",
    ],
  },
  {
    id: "q20",
    section: 4,
    question:
      '"The contract _____ by both parties before the deadline." Choose the correct passive form.',
    options: [
      "must signed",
      "must be signed",
      "must to be signed",
      "must being signed",
    ],
  },

  // =========================================================================
  // SECTION 5 — C1-C2: Subjunctive, idioms, subtle distinctions, error ID
  // =========================================================================
  {
    id: "q21",
    section: 5,
    question:
      'Which sentence uses the subjunctive mood correctly?',
    options: [
      "The manager suggested that he takes a training course.",
      "The manager suggested that he take a training course.",
      "The manager suggested that he took a training course.",
      "The manager suggested that he would take a training course.",
    ],
  },
  {
    id: "q22",
    section: 5,
    question:
      'What does the idiom "to hit the ground running" mean in a workplace context?',
    options: [
      "To fall down at work",
      "To start a job quickly and effectively from day one",
      "To run away from a difficult situation",
      "To exercise during lunch break",
    ],
  },
  {
    id: "q23",
    section: 5,
    question:
      'Identify the sentence that contains a grammatical error:',
    options: [
      "Neither the manager nor the employees were aware of the policy change.",
      "The data suggest that the new strategy is effective.",
      "Each of the candidates have submitted their application.",
      "Were I in your position, I would negotiate a higher salary.",
    ],
  },
  {
    id: "q24",
    section: 5,
    question:
      'Choose the sentence with the most precise meaning: "The company\'s profits _____ over the last quarter."',
    options: [
      "raised significantly",
      "rose significantly",
      "have been raised significantly",
      "were rising significantly",
    ],
  },
  {
    id: "q25",
    section: 5,
    question:
      '"Notwithstanding the challenges faced during the transition, the team _____ to deliver results ahead of schedule." Choose the most appropriate word.',
    options: ["could", "managed", "succeeded", "achieved"],
  },
];

// ---------------------------------------------------------------------------
// Answer key (correct option index, 0-based) — NEVER send to the client
// ---------------------------------------------------------------------------

export const ANSWER_KEY: Record<string, number> = {
  // Section 1
  q1: 1, // "is"
  q2: 1, // "A document listing your work experience and education"
  q3: 1, // "am"
  q4: 1, // "He works every day in the office."
  q5: 1, // "Do"

  // Section 2
  q6: 1, // "moved"
  q7: 1, // "on / at"
  q8: 2, // "Not bad, how about you?"
  q9: 1, // "Yesterday I finished the report."
  q10: 1, // "In fact / really (na verdade)"

  // Section 3
  q11: 2, // "has lived"
  q12: 1, // "had"
  q13: 2, // "been"
  q14: 1, // "Because she had prepared thoroughly beforehand."
  q15: 2, // "had already started"

  // Section 4
  q16: 1, // "were reviewed"
  q17: 2, // "express"
  q18: 2, // "would have prepared"
  q19: 2, // "will have worked"
  q20: 1, // "must be signed"

  // Section 5
  q21: 1, // "...that he take a training course." (subjunctive)
  q22: 1, // "To start a job quickly and effectively from day one"
  q23: 2, // "Each of the candidates have submitted..." (error: should be "has")
  q24: 1, // "rose significantly"
  q25: 1, // "managed"
};

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const SECTIONS = [1, 2, 3, 4, 5] as const;
const PASSING_THRESHOLD = 3; // minimum correct per section to "pass"

/**
 * Scores the test using the CONTIGUOUS algorithm:
 *
 * 1. Compute per-section scores (0-5).
 * 2. The CEFR level equals the highest section N such that ALL sections
 *    1..N scored >= 3 out of 5.
 * 3. Mapping: pass section 1 -> A2, 2 -> B1, 3 -> B2, 4 -> C1,
 *    all 5 sections passed -> C2 (or C1 if section 5 < 5/5). Default A1.
 */
export function calculateScore(
  answers: Record<string, number>,
): TestResult {
  // --- Per-section scores ---------------------------------------------------
  const sectionScores: number[] = SECTIONS.map((sec) => {
    let correct = 0;
    for (const q of QUESTIONS) {
      if (q.section !== sec) continue;
      const userAnswer = answers[q.id];
      if (userAnswer !== undefined && userAnswer === ANSWER_KEY[q.id]) {
        correct++;
      }
    }
    return correct;
  });

  const totalScore = sectionScores.reduce((a, b) => a + b, 0);
  const percentage = Math.round((totalScore / QUESTIONS.length) * 100);

  // --- Contiguous pass algorithm --------------------------------------------
  let highestPassedSection = 0; // 0 means none passed
  for (const sec of SECTIONS) {
    if (sectionScores[sec - 1] >= PASSING_THRESHOLD) {
      highestPassedSection = sec;
    } else {
      break; // contiguous: stop at first failure
    }
  }

  // --- Map to CEFR ----------------------------------------------------------
  let cefrLevel: string;
  switch (highestPassedSection) {
    case 0:
      cefrLevel = "A1";
      break;
    case 1:
      cefrLevel = "A2";
      break;
    case 2:
      cefrLevel = "B1";
      break;
    case 3:
      cefrLevel = "B2";
      break;
    case 4:
      cefrLevel = "C1";
      break;
    case 5:
      // Perfect section 5 (5/5) -> C2, otherwise C1
      cefrLevel = sectionScores[4] === 5 ? "C2" : "C1";
      break;
    default:
      cefrLevel = "A1";
  }

  const { display, displayPt } = DISPLAY_LEVELS[cefrLevel];

  return {
    sectionScores,
    totalScore,
    percentage,
    cefrLevel,
    displayLevel: display,
    displayLevelPt: displayPt,
  };
}
