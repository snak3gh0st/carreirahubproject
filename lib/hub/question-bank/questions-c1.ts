// ---------------------------------------------------------------------------
// C1 Level Questions — Section 5
// Topics: subjunctive mood, inversion, cleft sentences, advanced modals,
//         wish/if only, complex reported speech
//         Idioms: workplace idioms
//         Error identification: subject-verb agreement, tense consistency
//         Vocabulary: raise/rise, affect/effect, lay/lie nuance
// Context: career/immigration themes for Brazilian immigrants in the US
// ---------------------------------------------------------------------------

import { BankQuestion } from './types';

export const C1_QUESTIONS: BankQuestion[] = [
  // --- Grammar: Subjunctive Mood ---
  {
    id: 'c1_gram_01',
    level: 'C1',
    section: 5,
    skillType: 'grammar',
    question: '"The board recommended that each department _____ its own budget proposal."',
    options: ['submits', 'submit', 'submitted', 'to submit'],
    correctIndex: 1,
  },
  {
    id: 'c1_gram_02',
    level: 'C1',
    section: 5,
    skillType: 'grammar',
    question: '"It is essential that the visa application _____ before the deadline."',
    options: ['is filed', 'files', 'be filed', 'was filed'],
    correctIndex: 2,
  },
  {
    id: 'c1_gram_03',
    level: 'C1',
    section: 5,
    skillType: 'grammar',
    question: '"The manager insisted that all employees _____ the mandatory training."',
    options: ['completed', 'completes', 'complete', 'will complete'],
    correctIndex: 2,
  },

  // --- Grammar: Inversion ---
  {
    id: 'c1_gram_06',
    level: 'C1',
    section: 5,
    skillType: 'grammar',
    question: '"Not only _____ she complete the project on time, but she also received a promotion."',
    options: ['has', 'did', 'was', 'had'],
    correctIndex: 1,
  },
  {
    id: 'c1_gram_04',
    level: 'C1',
    section: 5,
    skillType: 'grammar',
    question: '"Rarely _____ such commitment in a new hire."',
    options: ['one sees', 'does one see', 'one did see', 'did one saw'],
    correctIndex: 1,
  },

  // --- Grammar: Cleft Sentences ---
  {
    id: 'c1_gram_05',
    level: 'C1',
    section: 5,
    skillType: 'grammar',
    question: '"It was Maria _____ the presentation at the conference."',
    options: ['who gave', 'which gave', 'that gives', 'who gives'],
    correctIndex: 0,
  },

  // --- Grammar: Advanced Modals ---
  {
    id: 'c1_gram_15',
    level: 'C1',
    section: 5,
    skillType: 'grammar',
    question: '"She needn\'t _____ worried about the interview — she was extremely well prepared."',
    options: ['to be', 'be', 'have been', 'being'],
    correctIndex: 2,
  },
  {
    id: 'c1_gram_16',
    level: 'C1',
    section: 5,
    skillType: 'grammar',
    question: '"You had better _____ your LinkedIn profile before the networking event."',
    options: ['update', 'to update', 'updating', 'updated'],
    correctIndex: 0,
  },

  // --- Grammar: Wish / If Only ---
  {
    id: 'c1_gram_07',
    level: 'C1',
    section: 5,
    skillType: 'grammar',
    question: '"I wish I _____ applied for the position before the deadline passed."',
    options: ['have', 'had', 'would have', 'did'],
    correctIndex: 1,
  },
  {
    id: 'c1_gram_17',
    level: 'C1',
    section: 5,
    skillType: 'grammar',
    question: '"If only she _____ more experience when she first arrived in the US."',
    options: ['has', 'had', 'would have', 'have had'],
    correctIndex: 1,
  },

  // --- Grammar: Complex Reported Speech ---
  {
    id: 'c1_gram_18',
    level: 'C1',
    section: 5,
    skillType: 'grammar',
    question: '"He denied _____ involved in the contract dispute."',
    options: ['to be', 'being', 'to have been', 'having been'],
    correctIndex: 3,
  },
  {
    id: 'c1_gram_19',
    level: 'C1',
    section: 5,
    skillType: 'grammar',
    question: '"The director admitted that the decision _____ without consulting the team."',
    options: ['was made', 'had been made', 'made', 'has been made'],
    correctIndex: 1,
  },

  // --- Idioms ---
  {
    id: 'c1_idiom_01',
    level: 'C1',
    section: 5,
    skillType: 'idioms',
    question: '"Hit the ground running" in a workplace context means:',
    options: [
      'To fall during a meeting',
      'To start working quickly and effectively from day one',
      'To run away from problems at work',
      'To exercise before starting work',
    ],
    correctIndex: 1,
  },
  {
    id: 'c1_idiom_02',
    level: 'C1',
    section: 5,
    skillType: 'idioms',
    question: '"Think outside the box" means:',
    options: [
      'To work in a small office space',
      'To refuse new ideas',
      'To approach problems creatively and unconventionally',
      'To organize your desk neatly',
    ],
    correctIndex: 2,
  },
  {
    id: 'c1_idiom_03',
    level: 'C1',
    section: 5,
    skillType: 'idioms',
    question: '"Don\'t cut corners on the compliance report." This means:',
    options: [
      'Don\'t fold the corners of the pages',
      'Don\'t shorten the report unnecessarily',
      'Don\'t do the work cheaply or poorly to save time',
      'Don\'t share the report with others',
    ],
    correctIndex: 2,
  },
  {
    id: 'c1_idiom_04',
    level: 'C1',
    section: 5,
    skillType: 'idioms',
    question: '"She really dropped the ball on that client presentation." This means:',
    options: [
      'She threw something at the client',
      'She failed to fulfill her responsibility',
      'She lost the presentation file',
      'She was late to the meeting',
    ],
    correctIndex: 1,
  },

  // --- Error Identification ---
  {
    id: 'c1_errid_01',
    level: 'C1',
    section: 5,
    skillType: 'error-identification',
    question: 'Identify the sentence with a grammatical error:',
    options: [
      '"The data suggest that our approach is effective."',
      '"Each of the managers have approved the budget."',
      '"Were she in charge, things would be different."',
      '"Neither the CEO nor the board members were consulted."',
    ],
    correctIndex: 1,
  },
  {
    id: 'c1_errid_02',
    level: 'C1',
    section: 5,
    skillType: 'error-identification',
    question: 'Which sentence contains an error?',
    options: [
      '"The committee has made its decision."',
      '"Neither of the candidates were qualified for the role."',
      '"Everyone on the team was informed about the change."',
      '"The staff has been notified of the new policy."',
    ],
    correctIndex: 1,
  },
  {
    id: 'c1_errid_03',
    level: 'C1',
    section: 5,
    skillType: 'error-identification',
    question: 'Which sentence uses tense consistently and correctly?',
    options: [
      '"She submitted her application last week and is waiting for a response."',
      '"She submitted her application last week and waited for a response."',
      '"She submits her application last week and waits for a response."',
      '"She had submitted her application last week and has waited for a response."',
    ],
    correctIndex: 0,
  },
  {
    id: 'c1_errid_04',
    level: 'C1',
    section: 5,
    skillType: 'error-identification',
    question: 'Identify the error in word choice: "The new policy will ___ the number of vacation days available to employees."',
    options: [
      '"affect"',
      '"effect"',
      '"impact"',
      '"change"',
    ],
    correctIndex: 1,
  },

  // --- Vocabulary: Subtle Distinctions ---
  {
    id: 'c1_vocab_01',
    level: 'C1',
    section: 5,
    skillType: 'vocabulary',
    question: '"The company\'s profits _____ significantly over the last quarter."',
    options: ['raised', 'rose', 'have been raised', 'were rising'],
    correctIndex: 1,
  },
  {
    id: 'c1_vocab_02',
    level: 'C1',
    section: 5,
    skillType: 'vocabulary',
    question: '"The new policy will _____ how employees request time off."',
    options: ['effect', 'affect', 'inflect', 'infect'],
    correctIndex: 1,
  },
  {
    id: 'c1_vocab_03',
    level: 'C1',
    section: 5,
    skillType: 'vocabulary',
    question: 'Which word correctly completes the sentence: "Please _____ your concerns at the beginning of the meeting."',
    options: ['rise', 'raise', 'arose', 'arises'],
    correctIndex: 1,
  },
];
