// ---------------------------------------------------------------------------
// B2 Level Questions — Section 4
// Topics: third conditional, mixed conditionals, future perfect, modal perfects,
//         complex passives, relative clauses, formal register, reading passages
// Context: career/immigration themes for Brazilian immigrants in the US
// ---------------------------------------------------------------------------

import { BankQuestion } from './types';

export const B2_QUESTIONS: BankQuestion[] = [
  // --- Grammar: Third Conditional ---
  {
    id: 'b2_gram_01',
    level: 'B2',
    section: 4,
    skillType: 'grammar',
    question: '"If she _____ earlier, she _____ the position."',
    options: [
      'applied / would get',
      'had applied / would have gotten',
      'applied / would have gotten',
      'had applied / would get',
    ],
    correctIndex: 1,
  },
  {
    id: 'b2_gram_02',
    level: 'B2',
    section: 4,
    skillType: 'grammar',
    question: '"He _____ the job if he _____ a better cover letter."',
    options: [
      'would get / wrote',
      'would have gotten / had written',
      'got / had written',
      'had gotten / wrote',
    ],
    correctIndex: 1,
  },
  {
    id: 'b2_gram_03',
    level: 'B2',
    section: 4,
    skillType: 'grammar',
    question: '"We _____ the contract on time if the client _____ the documents sooner."',
    options: [
      'would sign / sends',
      'would have signed / had sent',
      'signed / sent',
      'would sign / had sent',
    ],
    correctIndex: 1,
  },

  // --- Grammar: Mixed Conditionals ---
  {
    id: 'b2_gram_06',
    level: 'B2',
    section: 4,
    skillType: 'grammar',
    question: '"If she had accepted the first offer, she _____ managing a larger team now."',
    options: ['is', 'would be', 'would have been', 'had been'],
    correctIndex: 1,
    explanation: 'A past condition with a present result uses a mixed conditional: if + had accepted / would be managing.',
  },
  {
    id: 'b2_gram_07',
    level: 'B2',
    section: 4,
    skillType: 'grammar',
    question: '"If I had studied English in Brazil, I _____ more confident now."',
    options: ['would be', 'would have been', 'will be', 'was'],
    correctIndex: 0,
  },

  // --- Grammar: Future Perfect ---
  {
    id: 'b2_gram_04',
    level: 'B2',
    section: 4,
    skillType: 'grammar',
    question: '"By next December, I _____ at this company for two years."',
    options: ['will work', 'will be working', 'will have worked', 'have worked'],
    correctIndex: 2,
  },
  {
    id: 'b2_gram_05',
    level: 'B2',
    section: 4,
    skillType: 'grammar',
    question: '"Before the meeting ends, the team _____ all the proposals."',
    options: ['reviews', 'will review', 'will have reviewed', 'has reviewed'],
    correctIndex: 2,
  },

  // --- Grammar: Modal Perfects ---
  {
    id: 'b2_gram_08',
    level: 'B2',
    section: 4,
    skillType: 'grammar',
    question: '"She must _____ left the office already; her car is gone."',
    options: ['has', 'have', 'had', 'having'],
    correctIndex: 1,
  },
  {
    id: 'b2_gram_10',
    level: 'B2',
    section: 4,
    skillType: 'grammar',
    question: '"You should _____ applied for the promotion when you had the chance."',
    options: ['have', 'has', 'had', 'of'],
    correctIndex: 0,
  },
  {
    id: 'b2_gram_11',
    level: 'B2',
    section: 4,
    skillType: 'grammar',
    question: '"The HR team may _____ already sent the offer letter."',
    options: ['has', 'have', 'had', 'been'],
    correctIndex: 1,
  },

  // --- Grammar: Complex Passives ---
  {
    id: 'b2_gram_12',
    level: 'B2',
    section: 4,
    skillType: 'grammar',
    question: '"The contract must _____ before the end of the quarter."',
    options: ['sign', 'be signed', 'be sign', 'have signed'],
    correctIndex: 1,
  },
  {
    id: 'b2_gram_13',
    level: 'B2',
    section: 4,
    skillType: 'grammar',
    question: '"The report is believed _____ by the senior analyst before the board meeting started."',
    options: ['to be prepared', 'to have been prepared', 'being prepared', 'to preparing'],
    correctIndex: 1,
    explanation: 'Because the preparation happened before another past event, the passive infinitive "to have been prepared" is the best fit.',
  },

  // --- Grammar: Relative Clauses ---
  {
    id: 'b2_gram_09',
    level: 'B2',
    section: 4,
    skillType: 'grammar',
    question: '"The company, _____ headquarters are in Miami, hired 50 new employees."',
    options: ['which', 'that', 'whose', 'where'],
    correctIndex: 2,
  },
  {
    id: 'b2_gram_14',
    level: 'B2',
    section: 4,
    skillType: 'grammar',
    question: '"The manager _____ team exceeded the target received a bonus."',
    options: ['who', 'which', 'whose', 'that'],
    correctIndex: 2,
  },

  // --- Grammar: Formal Register ---
  {
    id: 'b2_gram_15',
    level: 'B2',
    section: 4,
    skillType: 'grammar',
    question: 'Which sentence is most appropriate for a professional message to a recruiter?',
    options: [
      '"I\'m excited about the role and would welcome the chance to discuss how my reporting experience could support your team."',
      '"I really want this job and promise I\'ll do anything."',
      '"Your company seems cool, so let me know what you have."',
      '"Please hire me because I need a change."',
    ],
    correctIndex: 0,
    explanation: 'The best professional option is specific, respectful, and connects relevant experience to the employer\'s needs.',
  },
  {
    id: 'b2_gram_16',
    level: 'B2',
    section: 4,
    skillType: 'grammar',
    question: 'Which phrase is most appropriate to close a formal business email?',
    options: [
      '"Talk to you later!"',
      '"Sincerely, [Name]"',
      '"Bye!"',
      '"Best wishes and lots of love,"',
    ],
    correctIndex: 1,
  },

  // --- Vocabulary: Formal and Professional Language ---
  {
    id: 'b2_vocab_01',
    level: 'B2',
    section: 4,
    skillType: 'vocabulary',
    question: '"I would like to _____ my interest in the Senior Analyst position."',
    options: ['say', 'tell', 'express', 'talk about'],
    correctIndex: 2,
  },
  {
    id: 'b2_vocab_02',
    level: 'B2',
    section: 4,
    skillType: 'vocabulary',
    question: 'Which word best completes this formal sentence: "I am _____ to the possibility of relocating for the right opportunity."',
    options: ['opened', 'open', 'opening', 'openly'],
    correctIndex: 1,
  },
  {
    id: 'b2_vocab_03',
    level: 'B2',
    section: 4,
    skillType: 'vocabulary',
    question: '"Please find _____ my updated resume for your review."',
    options: ['attached', 'attaching', 'enclosed', 'enclosing'],
    correctIndex: 0,
  },
  {
    id: 'b2_vocab_04',
    level: 'B2',
    section: 4,
    skillType: 'vocabulary',
    question: 'What does "to negotiate" a salary mean?',
    options: [
      'To accept the first offer without discussion',
      'To discuss terms to reach a mutually acceptable agreement',
      'To refuse a job offer',
      'To ask for a raise after one week',
    ],
    correctIndex: 1,
  },
  {
    id: 'b2_vocab_05',
    level: 'B2',
    section: 4,
    skillType: 'vocabulary',
    question: '"The company offers _____ benefits, including health insurance, 401(k), and paid time off."',
    options: ['comprehensive', 'comprehensible', 'apprehensive', 'intensive'],
    correctIndex: 0,
  },

  // --- Reading Comprehension ---
  {
    id: 'b2_read_01',
    level: 'B2',
    section: 4,
    skillType: 'reading',
    passage:
      'After the final interview, Maya received an email from the recruiter explaining the next steps. The company would complete reference checks this week, and if all went well, an offer would be sent by Friday. The email also said that the first month would be hybrid, with three days in the office and two days remote.',
    question: 'What is the main purpose of the recruiter\'s email?',
    options: [
      'To explain the hiring timeline and work arrangement',
      'To reject Maya from the process',
      'To ask Maya to restart the application',
      'To announce a company reorganization',
    ],
    correctIndex: 0,
    explanation: 'The email focuses on the post-interview timeline and the hybrid schedule for the first month.',
  },
  {
    id: 'b2_read_02',
    level: 'B2',
    section: 4,
    skillType: 'reading',
    passage:
      'After the final interview, Maya received an email from the recruiter explaining the next steps. The company would complete reference checks this week, and if all went well, an offer would be sent by Friday. The email also said that the first month would be hybrid, with three days in the office and two days remote.',
    question: 'According to the passage, what work arrangement is planned for Maya\'s first month?',
    options: [
      'Fully remote every day',
      'Fully in-office every day',
      'Three office days and two remote days per week',
      'One office day and four remote days per week',
    ],
    correctIndex: 2,
    explanation: 'The email states a hybrid plan of three days in the office and two days remote.',
  },
  {
    id: 'b2_read_03',
    level: 'B2',
    section: 4,
    skillType: 'reading',
    passage:
      'When writing a cover letter for a US role, applicants should tailor it to the company and position, highlight two or three relevant achievements, and explain how those achievements can help the employer. The letter should stay concise and specific instead of repeating the entire resume.',
    question: 'According to the passage, what should a strong cover letter emphasize?',
    options: [
      'A full list of every job the applicant has ever had',
      'Relevant achievements and the value they bring to the employer',
      'Personal hobbies unrelated to the role',
      'General praise without examples',
    ],
    correctIndex: 1,
    explanation: 'The passage says the letter should highlight a few relevant achievements and connect them to the employer\'s needs.',
  },
  {
    id: 'b2_read_04',
    level: 'B2',
    section: 4,
    skillType: 'reading',
    passage:
      'When writing a cover letter for a US role, applicants should tailor it to the company and position, highlight two or three relevant achievements, and explain how those achievements can help the employer. The letter should stay concise and specific instead of repeating the entire resume.',
    question: 'What should applicants avoid, according to the passage?',
    options: [
      'Connecting achievements to the role',
      'Being concise and specific',
      'Repeating the entire resume in paragraph form',
      'Tailoring the message to the company',
    ],
    correctIndex: 2,
    explanation: 'The passage explicitly says the cover letter should not just restate the resume.',
  },
  {
    id: 'b2_read_05',
    level: 'B2',
    section: 4,
    skillType: 'reading',
    passage:
      'A recruiter sent Daniel an offer summary before the formal contract. The base salary was $78,000, bonus eligibility would begin after six months, and health coverage would start on the first day of the month after his start date. The recruiter asked Daniel to review the summary carefully and send any questions before signing.',
    question: 'According to the passage, when will Daniel\'s health coverage begin?',
    options: [
      'On his exact start date',
      'On the first day of the month after he starts',
      'After six months',
      'Only after he receives a bonus',
    ],
    correctIndex: 1,
    explanation: 'The offer summary says health coverage starts on the first day of the month after the start date.',
  },
  {
    id: 'b2_read_06',
    level: 'B2',
    section: 4,
    skillType: 'reading',
    passage:
      'A recruiter sent Daniel an offer summary before the formal contract. The base salary was $78,000, bonus eligibility would begin after six months, and health coverage would start on the first day of the month after his start date. The recruiter asked Daniel to review the summary carefully and send any questions before signing.',
    question: 'What is Daniel expected to do before signing?',
    options: [
      'Review the summary and send any questions',
      'Ask for health coverage to start immediately',
      'Wait until after signing to read the offer',
      'Decline the bonus eligibility period',
    ],
    correctIndex: 0,
    explanation: 'The recruiter asks Daniel to review the summary carefully and raise any questions before signing.',
  },
];
