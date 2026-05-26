import type { Language } from "@/lib/i18n/hub";
import {
  buildRealtimeFinalAssessmentPrompt,
  normalizeRealtimeEnglishResult,
  type RealtimeEnglishResult,
} from "@/lib/hub/realtime-english-test";

export const VOICE_ENGLISH_TEST_MODEL =
  process.env.OPENAI_VOICE_ENGLISH_TEST_MODEL?.trim() ||
  process.env.AI_MODEL_DEFAULT?.trim() ||
  "gpt-5.2-chat-latest";

export const VOICE_ENGLISH_TEST_FALLBACK_MODEL = "gpt-5.2";
export const VOICE_ENGLISH_TEST_MAX_STUDENT_TURNS = 6;

export interface VoiceInterviewTranscriptItem {
  role: "student" | "examiner";
  text: string;
  at: string;
  confidence?: number | null;
}

export interface VoiceInterviewTurn {
  examinerText: string;
  shouldFinish: boolean;
}

export function getVoiceEnglishTestModelCandidates(): string[] {
  return [
    VOICE_ENGLISH_TEST_MODEL,
    VOICE_ENGLISH_TEST_FALLBACK_MODEL,
  ].filter((model, index, models) => model && models.indexOf(model) === index);
}

export function getVoiceEnglishFirstQuestion(): string {
  return "Welcome. Please introduce yourself briefly and tell me how you use English today.";
}

export function normalizeVoiceTranscript(value: unknown): VoiceInterviewTranscriptItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item): VoiceInterviewTranscriptItem => {
      const role: VoiceInterviewTranscriptItem["role"] =
        item.role === "student" ? "student" : "examiner";
      const text = typeof item.text === "string" ? item.text.trim() : "";
      const at = typeof item.at === "string" ? item.at : new Date().toISOString();
      const confidence =
        typeof item.confidence === "number" && Number.isFinite(item.confidence)
          ? Math.max(0, Math.min(1, item.confidence))
          : null;

      return { role, text, at, confidence };
    })
    .filter((item) => item.text)
    .slice(-120);
}

export function countStudentTurns(transcript: VoiceInterviewTranscriptItem[]): number {
  return transcript.filter((item) => item.role === "student").length;
}

function transcriptForPrompt(transcript: VoiceInterviewTranscriptItem[]): string {
  return transcript
    .map((item) => {
      const confidence =
        item.role === "student" && typeof item.confidence === "number"
          ? ` (speech recognition confidence: ${item.confidence.toFixed(2)})`
          : "";
      return `${item.role === "student" ? "Student" : "Examiner"}${confidence}: ${item.text}`;
    })
    .join("\n");
}

export function buildVoiceNextQuestionPrompt(input: {
  language: Language;
  transcript: VoiceInterviewTranscriptItem[];
}): string {
  const studentTurns = countStudentTurns(input.transcript);
  const remainingTurns = Math.max(0, VOICE_ENGLISH_TEST_MAX_STUDENT_TURNS - studentTurns);

  return [
    "You are conducting an oral English analysis as a supportive English teacher.",
    "This is not a mock interview, not a job interview, and not a hiring simulation.",
    "Speak only in English during the oral analysis.",
    "Ask exactly one question at a time.",
    "Do not answer for the student.",
    "Use teacher-led speaking prompts such as familiar topics, everyday situations, simple past-tense storytelling, practical explanation, opinion, and clarification checks.",
    "Adapt difficulty based on the student's last answer.",
    "Keep each teacher turn under 35 words.",
    "Do not provide the final score yet.",
    `The oral analysis should finish after about ${VOICE_ENGLISH_TEST_MAX_STUDENT_TURNS} student answers. Student answers so far: ${studentTurns}. Remaining planned turns: ${remainingTurns}.`,
    "If the student clearly asks to finish, set shouldFinish to true.",
    "If the student has already answered enough questions, set shouldFinish to true and thank them briefly.",
    "Return only valid JSON with this exact shape:",
    '{"examinerText":"string","shouldFinish":false}',
    "Transcript:",
    transcriptForPrompt(input.transcript),
  ].join("\n");
}

export function normalizeVoiceTurn(input: unknown): VoiceInterviewTurn {
  const raw = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const examinerText =
    typeof raw.examinerText === "string" && raw.examinerText.trim()
      ? raw.examinerText.trim().slice(0, 500)
      : "Thank you. Could you say that again with one simple example?";

  return {
    examinerText,
    shouldFinish: raw.shouldFinish === true,
  };
}

export function buildVoiceFinalAssessmentPrompt(input: {
  language: Language;
  transcript: VoiceInterviewTranscriptItem[];
}): string {
  return [
    buildRealtimeFinalAssessmentPrompt(input.language),
    "Evaluate this as an oral English analysis transcript captured by browser speech recognition.",
    "Use speech recognition confidence, answer length, hesitation markers, coherence, grammar, vocabulary, and comprehension as evidence.",
    "PronunciationScore should represent intelligibility based on recognition confidence and transcript clarity, not a phonetic lab score.",
    "Be rigorous enough for CEFR language-level placement, not job-interview readiness.",
    "Transcript:",
    transcriptForPrompt(input.transcript),
  ].join("\n");
}

export function normalizeVoiceEnglishResult(input: unknown): RealtimeEnglishResult {
  return normalizeRealtimeEnglishResult(input);
}
