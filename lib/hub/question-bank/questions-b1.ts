// ---------------------------------------------------------------------------
// B1 Level Questions — Section 3
// Topics: present perfect vs past simple, second conditional, past perfect,
//         reported speech, passive voice, used to, gerunds/infinitives
//         Vocabulary: career/work expressions, collocations
//         Reading: short passages about Brazilian immigrants in the US workplace
// Context: career/immigration themes for Brazilian immigrants in the US
// ---------------------------------------------------------------------------

import { BankQuestion } from './types';

export const B1_QUESTIONS: BankQuestion[] = [
  // --- Grammar: Present Perfect vs Past Simple ---
  {
    id: 'b1_gram_01',
    level: 'B1',
    section: 3,
    skillType: 'grammar',
    question: '"She _____ in the US for three years now."',
    options: ['lives', 'lived', 'has lived', 'was living'],
    correctIndex: 2,
  },
  {
    id: 'b1_gram_02',
    level: 'B1',
    section: 3,
    skillType: 'grammar',
    question: '"I _____ my visa application last Monday."',
    options: ['submit', 'have submitted', 'submitted', 'was submitting'],
    correctIndex: 2,
  },
  {
    id: 'b1_gram_03',
    level: 'B1',
    section: 3,
    skillType: 'grammar',
    question: '"_____ you ever _____ a job interview in English before?"',
    options: ['Did / have', 'Have / had', 'Did / had', 'Have / have'],
    correctIndex: 1,
  },
  {
    id: 'b1_gram_04',
    level: 'B1',
    section: 3,
    skillType: 'grammar',
    question: '"He _____ at this company since he moved to Florida."',
    options: ['works', 'worked', 'is working', 'has worked'],
    correctIndex: 3,
  },

  // --- Grammar: Second Conditional ---
  {
    id: 'b1_gram_05',
    level: 'B1',
    section: 3,
    skillType: 'grammar',
    question: '"If I _____ more experience, I would apply for the management position."',
    options: ['have', 'had', 'would have', 'having'],
    correctIndex: 1,
  },
  {
    id: 'b1_gram_10',
    level: 'B1',
    section: 3,
    skillType: 'grammar',
    question: '"What _____ you do if your employer asked you to relocate to another state?"',
    options: ['do', 'would', 'will', 'did'],
    correctIndex: 1,
  },
  {
    id: 'b1_gram_11',
    level: 'B1',
    section: 3,
    skillType: 'grammar',
    question: '"If she _____ the HR manager, she would implement better onboarding."',
    options: ['is', 'was', 'were', 'has been'],
    correctIndex: 2,
  },

  // --- Grammar: Reported Speech ---
  {
    id: 'b1_gram_06',
    level: 'B1',
    section: 3,
    skillType: 'grammar',
    question: '"Yesterday, she said she _____ looking for a new position."',
    options: ['is', 'was', 'has been', 'will be'],
    correctIndex: 1,
    explanation: 'With a past reporting verb and a past time reference, "was looking" is the clearest reported-speech form.',
  },
  {
    id: 'b1_gram_12',
    level: 'B1',
    section: 3,
    skillType: 'grammar',
    question: '"He told me he _____ work experience in logistics."',
    options: ['has', 'had', 'would have', 'having'],
    correctIndex: 1,
  },

  // --- Grammar: Passive Voice ---
  {
    id: 'b1_gram_07',
    level: 'B1',
    section: 3,
    skillType: 'grammar',
    question: '"The email _____ sent to all employees yesterday."',
    options: ['is', 'was', 'has', 'were'],
    correctIndex: 1,
  },
  {
    id: 'b1_gram_13',
    level: 'B1',
    section: 3,
    skillType: 'grammar',
    question: '"New employees _____ required to attend a two-day orientation."',
    options: ['is', 'are', 'was', 'were'],
    correctIndex: 1,
  },

  // --- Grammar: Used To ---
  {
    id: 'b1_gram_08',
    level: 'B1',
    section: 3,
    skillType: 'grammar',
    question: '"I used to _____ in São Paulo before moving to Miami."',
    options: ['live', 'living', 'lived', 'lives'],
    correctIndex: 0,
  },
  {
    id: 'b1_gram_14',
    level: 'B1',
    section: 3,
    skillType: 'grammar',
    question: '"She didn\'t use to _____ early, but her new job requires it."',
    options: ['wake up', 'waking up', 'woke up', 'wakes up'],
    correctIndex: 0,
  },

  // --- Grammar: Gerunds and Infinitives ---
  {
    id: 'b1_gram_09',
    level: 'B1',
    section: 3,
    skillType: 'grammar',
    question: '"She enjoys _____ with international clients."',
    options: ['work', 'working', 'to work', 'worked'],
    correctIndex: 1,
  },
  {
    id: 'b1_gram_15',
    level: 'B1',
    section: 3,
    skillType: 'grammar',
    question: '"The manager suggested _____ the project deadline."',
    options: ['to extend', 'extending', 'extended', 'extend'],
    correctIndex: 1,
  },
  {
    id: 'b1_gram_16',
    level: 'B1',
    section: 3,
    skillType: 'grammar',
    question: '"I would like _____ more about the benefits package."',
    options: ['knowing', 'know', 'to know', 'known'],
    correctIndex: 2,
  },

  // --- Grammar: Past Perfect ---
  {
    id: 'b1_gram_17',
    level: 'B1',
    section: 3,
    skillType: 'grammar',
    question: '"By the time he arrived, the meeting _____ already."',
    options: ['started', 'has started', 'had started', 'would start'],
    correctIndex: 2,
  },
  {
    id: 'b1_gram_18',
    level: 'B1',
    section: 3,
    skillType: 'grammar',
    question: '"She _____ her degree before applying for the work visa."',
    options: ['completed', 'had completed', 'has completed', 'completes'],
    correctIndex: 1,
  },

  // --- Vocabulary: Career Expressions ---
  {
    id: 'b1_vocab_01',
    level: 'B1',
    section: 3,
    skillType: 'vocabulary',
    question: '"I need to _____ a meeting with my supervisor about my performance review."',
    options: ['do', 'make', 'schedule', 'take'],
    correctIndex: 2,
  },
  {
    id: 'b1_vocab_02',
    level: 'B1',
    section: 3,
    skillType: 'vocabulary',
    question: '"She was _____ for the position because she had the required qualifications."',
    options: ['hired', 'fired', 'resigned', 'promoted'],
    correctIndex: 0,
  },
  {
    id: 'b1_vocab_03',
    level: 'B1',
    section: 3,
    skillType: 'vocabulary',
    question: 'What does "to be laid off" mean?',
    options: [
      'To be promoted to a higher position',
      'To lose your job because the company is reducing staff',
      'To take a vacation',
      'To transfer to another department',
    ],
    correctIndex: 1,
  },
  {
    id: 'b1_vocab_04',
    level: 'B1',
    section: 3,
    skillType: 'vocabulary',
    question: '"Can you _____ the main points of the project proposal in your email?"',
    options: ['outline', 'underline', 'headline', 'decline'],
    correctIndex: 0,
  },
  {
    id: 'b1_vocab_05',
    level: 'B1',
    section: 3,
    skillType: 'vocabulary',
    question: 'What does "networking" mean in a professional context?',
    options: [
      'Setting up computer networks',
      'Building professional relationships that may help your career',
      'Working on the internet',
      'Joining a social media platform',
    ],
    correctIndex: 1,
  },

  // --- Reading Comprehension ---
  {
    id: 'b1_read_01',
    level: 'B1',
    section: 3,
    skillType: 'reading',
    passage:
      'Ana arrived at her new office on a Monday morning. She was surprised to see that everyone wore a name badge and introduced themselves by their first name — even the director. During the lunch break, she noticed that most people ate at their desks while working. A colleague explained that in the US, it is common to eat lunch quickly so you can leave on time at the end of the day.',
    question: 'According to the passage, what surprised Ana on her first day?',
    options: [
      'The food in the cafeteria',
      'How people introduced themselves',
      'The size of the office',
      'The working hours',
    ],
    correctIndex: 1,
  },
  {
    id: 'b1_read_02',
    level: 'B1',
    section: 3,
    skillType: 'reading',
    passage:
      'Ana arrived at her new office on a Monday morning. She was surprised to see that everyone wore a name badge and introduced themselves by their first name — even the director. During the lunch break, she noticed that most people ate at their desks while working. A colleague explained that in the US, it is common to eat lunch quickly so you can leave on time at the end of the day.',
    question: 'Why do many US workers eat lunch at their desks, according to the passage?',
    options: [
      'Because the cafeteria is too far away',
      'Because lunch breaks are not allowed',
      'So they can finish on time and leave at the end of the day',
      'Because their managers require it',
    ],
    correctIndex: 2,
  },
  {
    id: 'b1_read_03',
    level: 'B1',
    section: 3,
    skillType: 'reading',
    passage:
      'Before his first interview with a US company, Carlos learned it would be on video. He researched the company, tested his camera and microphone the night before, and prepared short examples about projects he had led. On the day of the interview, he joined five minutes early, kept notes beside his screen, and looked at the camera when answering questions.',
    question: 'What did Carlos do to prepare for his interview?',
    options: [
      'He researched the company, tested his setup, and prepared examples',
      'He only practiced small talk',
      'He waited for the recruiter to explain the role',
      'He sent a second resume minutes before the call',
    ],
    correctIndex: 0,
    explanation: 'The passage says Carlos researched the company, checked his tech, and prepared examples in advance.',
  },
  {
    id: 'b1_read_04',
    level: 'B1',
    section: 3,
    skillType: 'reading',
    passage:
      'Before his first interview with a US company, Carlos learned it would be on video. He researched the company, tested his camera and microphone the night before, and prepared short examples about projects he had led. On the day of the interview, he joined five minutes early, kept notes beside his screen, and looked at the camera when answering questions.',
    question: 'According to the passage, what helped Carlos appear professional during the video interview?',
    options: [
      'Joining late so he seemed busy',
      'Looking at the camera and joining a few minutes early',
      'Reading his full resume word for word',
      'Keeping his microphone off during answers',
    ],
    correctIndex: 1,
    explanation: 'Joining slightly early and looking at the camera both signal preparation and professionalism in a video interview.',
  },
  {
    id: 'b1_read_05',
    level: 'B1',
    section: 3,
    skillType: 'reading',
    passage:
      'One of the biggest differences between Brazilian and US workplace communication is directness. In Brazil, business relationships often develop over months of socializing before formal discussions begin. In the US, communication tends to be more direct and task-focused. Meetings have clear agendas, and employees are expected to share their opinions openly, even with managers.',
    question: 'What is the main idea of the passage?',
    options: [
      'US companies prefer to hire Brazilian employees',
      'Workplace communication styles differ between Brazil and the US',
      'Brazilian workers need to learn to socialize more',
      'US meetings last longer than Brazilian meetings',
    ],
    correctIndex: 1,
  },
  {
    id: 'b1_read_06',
    level: 'B1',
    section: 3,
    skillType: 'reading',
    passage:
      'One of the biggest differences between Brazilian and US workplace communication is directness. In Brazil, business relationships often develop over months of socializing before formal discussions begin. In the US, communication tends to be more direct and task-focused. Meetings have clear agendas, and employees are expected to share their opinions openly, even with managers.',
    question: 'According to the passage, how are US meetings different from Brazilian ones?',
    options: [
      'US meetings have no agenda and are very informal',
      'US meetings focus on social activities before business',
      'US meetings are task-focused with clear agendas',
      'US managers do not allow employees to speak during meetings',
    ],
    correctIndex: 2,
  },
];
