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
    question: '"If she had applied earlier, she _____ the position."',
    options: ['got', 'would get', 'would have gotten', 'had gotten'],
    correctIndex: 2,
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
    question: '"The report is believed _____ prepared by the senior analyst."',
    options: ['to be', 'to have been', 'being', 'to being'],
    correctIndex: 1,
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
    question: 'Which sentence is most appropriate for a formal cover letter?',
    options: [
      '"I wanna work at your company because it is cool."',
      '"I am writing to express my strong interest in the position."',
      '"Hey, I am looking for a job and you guys seem great."',
      '"I think I\'d be pretty good at this job."',
    ],
    correctIndex: 1,
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
      'Unlike Brazil\'s CLT (Consolidação das Leis do Trabalho) system, which provides employees with strong legal protections and requires employers to give notice or severance for termination, most US states operate under "at-will employment." This means an employer can terminate an employee at any time, for any reason, or for no reason at all, as long as the reason is not illegal — such as discrimination based on race, gender, or religion. Similarly, employees can quit at any time without legal obligation.',
    question: 'What is the main difference described in the passage?',
    options: [
      'Salary levels between Brazil and the US',
      'Employment termination rules between Brazil and the US',
      'Work hour regulations',
      'Benefits packages',
    ],
    correctIndex: 1,
  },
  {
    id: 'b2_read_02',
    level: 'B2',
    section: 4,
    skillType: 'reading',
    passage:
      'Unlike Brazil\'s CLT (Consolidação das Leis do Trabalho) system, which provides employees with strong legal protections and requires employers to give notice or severance for termination, most US states operate under "at-will employment." This means an employer can terminate an employee at any time, for any reason, or for no reason at all, as long as the reason is not illegal — such as discrimination based on race, gender, or religion. Similarly, employees can quit at any time without legal obligation.',
    question: 'According to the passage, when is it ILLEGAL to terminate an at-will employee?',
    options: [
      'When the employee has been with the company for less than one year',
      'When the termination is based on discrimination',
      'When the employee is a foreign national',
      'When the company has fewer than 50 employees',
    ],
    correctIndex: 1,
  },
  {
    id: 'b2_read_03',
    level: 'B2',
    section: 4,
    skillType: 'reading',
    passage:
      'When writing a cover letter for a US company, Brazilian applicants should avoid several common mistakes. First, do not start the letter with "I" — instead, open with "With great enthusiasm..." or "As an experienced professional...". Second, keep the letter to one page and focus on what value you bring to the company, not just your work history. Third, address the letter to a specific person if possible, using "Dear Mr./Ms. [Last Name]" rather than "To Whom It May Concern."',
    question: 'According to the passage, what is one common mistake to avoid in a US cover letter?',
    options: [
      'Writing more than two pages',
      'Including your professional accomplishments',
      'Starting the letter with "I"',
      'Mentioning your interest in the company',
    ],
    correctIndex: 2,
  },
  {
    id: 'b2_read_04',
    level: 'B2',
    section: 4,
    skillType: 'reading',
    passage:
      'When writing a cover letter for a US company, Brazilian applicants should avoid several common mistakes. First, do not start the letter with "I" — instead, open with "With great enthusiasm..." or "As an experienced professional...". Second, keep the letter to one page and focus on what value you bring to the company, not just your work history. Third, address the letter to a specific person if possible, using "Dear Mr./Ms. [Last Name]" rather than "To Whom It May Concern."',
    question: 'What should a US cover letter focus on, according to the passage?',
    options: [
      'The applicant\'s personal story and immigration journey',
      'The value the applicant brings to the company',
      'A complete summary of all previous jobs',
      'The applicant\'s educational qualifications only',
    ],
    correctIndex: 1,
  },
  {
    id: 'b2_read_05',
    level: 'B2',
    section: 4,
    skillType: 'reading',
    passage:
      'Paid Time Off (PTO) policies in the US can be confusing for immigrants. Unlike Brazil, where employees are entitled to 30 days of paid vacation by law, US companies are not legally required to offer any paid vacation. Most large companies voluntarily offer 10–15 days per year for new employees, increasing with tenure. Additionally, in the US, PTO often covers vacation, sick days, and personal days in a single combined bank, whereas in Brazil these are separate entitlements.',
    question: 'What is one key difference between Brazilian and US vacation policies described in the passage?',
    options: [
      'US workers receive more vacation days than Brazilian workers',
      'Brazilian law guarantees 30 days of paid vacation, while US law does not require any',
      'US companies must offer 15 days of vacation by law',
      'Brazilian companies combine vacation and sick days into one bank',
    ],
    correctIndex: 1,
  },
  {
    id: 'b2_read_06',
    level: 'B2',
    section: 4,
    skillType: 'reading',
    passage:
      'Paid Time Off (PTO) policies in the US can be confusing for immigrants. Unlike Brazil, where employees are entitled to 30 days of paid vacation by law, US companies are not legally required to offer any paid vacation. Most large companies voluntarily offer 10–15 days per year for new employees, increasing with tenure. Additionally, in the US, PTO often covers vacation, sick days, and personal days in a single combined bank, whereas in Brazil these are separate entitlements.',
    question: 'According to the passage, how does PTO work differently in the US compared to Brazil?',
    options: [
      'US companies legally must offer 10 days of PTO',
      'Brazilian companies offer fewer total days than US companies',
      'In the US, vacation, sick days, and personal days are often combined into one PTO bank',
      'In Brazil, PTO increases with tenure, unlike the US',
    ],
    correctIndex: 2,
  },
];
