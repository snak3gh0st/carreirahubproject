// ---------------------------------------------------------------------------
// Question Bank Types — CEFR English Proficiency Test Engine
// ---------------------------------------------------------------------------

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type SkillType = 'grammar' | 'vocabulary' | 'reading' | 'idioms' | 'error-identification';

export interface BankQuestion {
  id: string;           // format: "{level}_{skill}_{number}" e.g. "a1_gram_01"
  level: CEFRLevel;
  section: number;      // 1-5 (A1=1, A2=2, B1=3, B2=4, C1/C2=5)
  skillType: SkillType;
  question: string;
  options: string[];    // always 4 options
  correctIndex: number; // 0-based
  passage?: string;     // for reading comprehension
  explanation?: string; // future use
}

export interface ClientQuestion {
  id: string;
  section: number;
  question: string;
  options: string[];
  passage?: string;
}

export interface TestResult {
  sectionScores: number[];  // [s1, s2, s3, s4, s5]
  sectionMaxes: number[];   // [max1, max2, max3, max4, max5]
  totalScore: number;
  percentage: number;       // 0-100
  cefrLevel: string;
  displayLevel: string;
  displayLevelPt: string;
}

export interface PlacementTestIncorrectReviewItem {
  id: string;
  position: number;
  section: number;
  skillType: SkillType;
  question: string;
  options: string[];
  passage?: string;
  explanation?: string;
  selectedIndex: number | null;
  selectedOption: string | null;
  correctIndex: number;
  correctOption: string;
}
