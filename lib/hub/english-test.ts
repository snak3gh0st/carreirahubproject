// ---------------------------------------------------------------------------
// English Placement Test — Legacy re-exports
// Actual implementation moved to lib/hub/question-bank/
// ---------------------------------------------------------------------------

export type { BankQuestion as Question, ClientQuestion, TestResult } from './question-bank/types';
export { DISPLAY_LEVELS, scoreAnswers as calculateScore } from './question-bank/index';
