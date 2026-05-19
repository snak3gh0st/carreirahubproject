import { createHash } from "node:crypto";
import type { Language } from "@/lib/i18n/hub";
import {
  REALTIME_ENGLISH_TEST_DURATION_LABEL,
  REALTIME_ENGLISH_TEST_REQUIRED_STUDENT_TURNS,
  REALTIME_ENGLISH_TEST_STAGES,
  getRealtimeEnglishTestProgress,
  summarizeRealtimeEnglishTranscriptForPrompt,
  type RealtimeEnglishTranscriptLike,
} from "@/lib/hub/realtime-english-test-flow";

export const REALTIME_ENGLISH_TEST_DEFAULT_MODEL = "gpt-realtime-2";
export const REALTIME_ENGLISH_TEST_FALLBACK_MODEL = "gpt-realtime";
export const REALTIME_ENGLISH_TEST_LEGACY_FALLBACK_MODEL = "gpt-4o-realtime-preview";
export const REALTIME_ENGLISH_TEST_DEFAULT_VOICE = "marin";

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const DISPLAY_BY_CEFR: Record<string, string> = {
  A1: "Beginner",
  A2: "Beginner",
  B1: "Intermediate",
  B2: "Intermediate",
  C1: "Advanced",
  C2: "Fluent",
};

export type RealtimeEnglishCefrLevel = (typeof CEFR_LEVELS)[number];

export interface RealtimeEnglishResult {
  cefrLevel: RealtimeEnglishCefrLevel;
  displayLevel: string;
  score: number;
  fluencyScore: number;
  pronunciationScore: number;
  grammarScore: number;
  vocabularyScore: number;
  comprehensionScore: number;
  summary: string;
  strengths: string[];
  focusAreas: string[];
}

export interface RealtimeEnglishSessionConfig {
  type: "realtime";
  model: string;
  output_modalities: ["audio"];
  instructions: string;
  max_output_tokens: number;
  reasoning?: {
    effort: "minimal" | "low" | "medium" | "high" | "xhigh";
  };
  audio: {
    input: {
      noise_reduction: { type: "near_field" };
      transcription: { model: "gpt-realtime-whisper"; language: "en" };
      turn_detection: {
        type: "semantic_vad";
        create_response: false;
        eagerness: "low";
        interrupt_response: boolean;
      };
    };
    output: {
      voice: typeof REALTIME_ENGLISH_TEST_DEFAULT_VOICE;
      speed: 1;
    };
  };
}

export function getRealtimeEnglishTestModel(): string {
  return normalizeRealtimeEnglishTestModel(
    process.env.OPENAI_REALTIME_ENGLISH_TEST_MODEL?.trim() ||
    REALTIME_ENGLISH_TEST_DEFAULT_MODEL
  );
}

export function normalizeRealtimeEnglishTestModel(model: string): string {
  const trimmed = model.trim();
  if (trimmed === "gpt-realtime-2.0") return REALTIME_ENGLISH_TEST_DEFAULT_MODEL;
  return trimmed || REALTIME_ENGLISH_TEST_DEFAULT_MODEL;
}

export function getRealtimeEnglishTestModelCandidates(): string[] {
  const primary = getRealtimeEnglishTestModel();
  const candidates = [
    primary,
    REALTIME_ENGLISH_TEST_FALLBACK_MODEL,
  ];

  if (process.env.OPENAI_REALTIME_INCLUDE_LEGACY_FALLBACK === "true") {
    candidates.push(REALTIME_ENGLISH_TEST_LEGACY_FALLBACK_MODEL);
  }

  return candidates.filter((model, index, models) => models.indexOf(model) === index);
}

function buildResumeContextInstructions(
  transcript: RealtimeEnglishTranscriptLike[] | undefined
): string[] {
  if (!transcript?.length) return [];

  const progress = getRealtimeEnglishTestProgress(transcript);
  const transcriptSummary = summarizeRealtimeEnglishTranscriptForPrompt(transcript);

  return [
    "Saved progress exists from a previous voice connection.",
    "Continue the same assessment from the saved context; do not restart the test, do not repeat the opening, and do not ask the student to repeat information already captured.",
    `Saved student answers so far: ${progress.studentTurns}/${REALTIME_ENGLISH_TEST_REQUIRED_STUDENT_TURNS}. Remaining required student answers before scoring: ${progress.remainingStudentTurns}.`,
    "Use the saved transcript as memory for follow-up questions, difficulty, and final evaluation.",
    "Latest saved transcript:",
    transcriptSummary || "No readable saved transcript.",
  ];
}

export function buildRealtimeEnglishTestInstructions(
  language: Language,
  transcript?: RealtimeEnglishTranscriptLike[]
): string {
  return [
    "You are an English oral exam evaluator for Brazilian professionals seeking corporate jobs in the United States.",
    "This interview runs inside CarreiraHub for Carreira USA, a career preparation and mentoring company that helps Brazilian and international professionals improve business English and prepare for corporate opportunities in the United States.",
    "Conduct a realistic corporate English oral interview.",
    "Speak only in English during the interview.",
    "The client controls the first spoken opening prompt, which introduces this as a live Carreira USA English speaking assessment with an AI teacher. Follow it once only; do not repeat the same opening later.",
    `The full assessment is designed to take about ${REALTIME_ENGLISH_TEST_DURATION_LABEL} across five short sections.`,
    `Collect at least ${REALTIME_ENGLISH_TEST_REQUIRED_STUDENT_TURNS} substantive student answers before a final score can be prepared.`,
    `The staged sections are: ${REALTIME_ENGLISH_TEST_STAGES.map((stage) => `${stage.shortTitle} (${stage.promptFocus})`).join("; ")}.`,
    "Do not begin with only a generic name question.",
    "After the short introduction, ask the first substantial warm-up question about the student's current role, professional background, or U.S. career goal.",
    "Use an adaptive test plan, not a fixed script.",
    "Rotate between different assessment formats: professional background interview, behavioral STAR question, workplace role-play, practical problem-solving scenario, opinion with reasoning, clarification or comprehension check, and TOEFL-style timed speaking prompt.",
    "For each student answer, decide whether to deepen before moving on.",
    "If an answer is short, vague, memorized, unclear, or grammatically weak, ask a targeted follow-up such as: Can you give me a specific example? What was the business impact? What happened next? Why did you choose that approach? How would you explain that to a U.S. manager?",
    "If the student performs well, increase complexity with abstract reasoning, negotiation, conflict, prioritization, stakeholder communication, and leadership scenarios.",
    "If the student struggles, simplify the wording, keep the interview in English, and scaffold with clearer follow-ups without giving the answer.",
    "Do not ask the same type of question repeatedly; cover at least three different formats before the final assessment if the session is long enough.",
    "If the student asks to stop before the required sections are complete, explain in English that the test cannot produce a reliable result yet and they should continue; if they must stop, Carreira USA operations must reset or schedule a new test.",
    "Ignore brief noises, coughs, keyboard sounds, breathing, background speech, and unclear fragments. Do not ask what happened because of noise.",
    "Do not announce or invent a final score inside the live conversation before all required sections are complete.",
    "Ask one question at a time.",
    "Do not give answers to the student.",
    "Keep the tone professional but supportive.",
    "Evaluate fluency, pronunciation intelligibility, grammar range/control, vocabulary range, comprehension, confidence, and business communication.",
    "Use corporate and TOEFL-style speaking scenarios.",
    "Run a concise CEFR-aligned assessment for an adult student.",
    "Ask across these areas: warm-up, work or study background, past experience, practical scenario, opinion with reasoning, and short follow-up.",
    "Adapt difficulty dynamically from A1 to C2 based on the student's answers.",
    "Keep responses short so the student speaks most of the time.",
    language === "pt-BR"
      ? "When the student finishes or asks to end, say in English that the result is being prepared; the final feedback will be in Portuguese."
      : "When the student finishes or asks to end, briefly say that the result is being prepared.",
    "Use the hidden CEFR rubric and prepare a score from 0 to 100 plus a CEFR estimate.",
    ...buildResumeContextInstructions(transcript),
  ].join(" ");
}

export function buildRealtimeEnglishTestSession(input: {
  language: Language;
  model?: string;
  transcript?: RealtimeEnglishTranscriptLike[];
}): RealtimeEnglishSessionConfig {
  const model = input.model
    ? normalizeRealtimeEnglishTestModel(input.model)
    : getRealtimeEnglishTestModel();

  return {
    type: "realtime",
    model,
    output_modalities: ["audio"],
    instructions: buildRealtimeEnglishTestInstructions(input.language, input.transcript),
    max_output_tokens: 1200,
    ...(model === REALTIME_ENGLISH_TEST_DEFAULT_MODEL
      ? { reasoning: { effort: "low" as const } }
      : {}),
    audio: {
      input: {
        noise_reduction: { type: "near_field" },
        transcription: { model: "gpt-realtime-whisper", language: "en" },
        turn_detection: {
          type: "semantic_vad",
          create_response: false,
          eagerness: "low",
          interrupt_response: false,
        },
      },
      output: {
        voice: REALTIME_ENGLISH_TEST_DEFAULT_VOICE,
        speed: 1,
      },
    },
  };
}

export function buildRealtimeFinalAssessmentPrompt(language: Language = "pt-BR"): string {
  const feedbackLanguage =
    language === "pt-BR"
      ? "Write summary, strengths, and focusAreas in Portuguese for a Brazilian student."
      : "Write summary, strengths, and focusAreas in English.";

  return [
    "Create the final English assessment result from this voice conversation.",
    feedbackLanguage,
    "Return only valid JSON with this exact shape:",
    '{"cefrLevel":"A1|A2|B1|B2|C1|C2","displayLevel":"Beginner|Intermediate|Advanced|Fluent","score":0,"fluencyScore":0,"pronunciationScore":0,"grammarScore":0,"vocabularyScore":0,"comprehensionScore":0,"summary":"string","strengths":["string"],"focusAreas":["string"]}',
    "Use integer scores from 0 to 10 for component scores and 0 to 100 for score.",
    "Do not include markdown, commentary, or extra keys.",
  ].join(" ");
}

export function buildRealtimeSafetyIdentifier(customerId: string): string {
  return `hub_${createHash("sha256").update(customerId).digest("hex").slice(0, 60)}`;
}

function clampInt(value: unknown, min: number, max: number): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function cleanStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

export function normalizeRealtimeEnglishResult(input: unknown): RealtimeEnglishResult {
  const raw = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const rawLevel = typeof raw.cefrLevel === "string" ? raw.cefrLevel.toUpperCase() : "";
  const cefrLevel = CEFR_LEVELS.includes(rawLevel as RealtimeEnglishCefrLevel)
    ? rawLevel as RealtimeEnglishCefrLevel
    : "B1";
  const displayLevel = DISPLAY_BY_CEFR[cefrLevel];

  return {
    cefrLevel,
    displayLevel,
    score: clampInt(raw.score, 0, 100),
    fluencyScore: clampInt(raw.fluencyScore, 0, 10),
    pronunciationScore: clampInt(raw.pronunciationScore, 0, 10),
    grammarScore: clampInt(raw.grammarScore, 0, 10),
    vocabularyScore: clampInt(raw.vocabularyScore, 0, 10),
    comprehensionScore: clampInt(raw.comprehensionScore, 0, 10),
    summary: typeof raw.summary === "string" ? raw.summary.trim().slice(0, 1200) : "",
    strengths: cleanStringList(raw.strengths),
    focusAreas: cleanStringList(raw.focusAreas),
  };
}
