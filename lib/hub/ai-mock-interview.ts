import { createHash } from "node:crypto";
import type { Language } from "@/lib/i18n/hub";
import {
  summarizeAiMockInterviewContextForPrompt,
  type AiMockInterviewContext,
} from "@/lib/hub/ai-mock-interview-context";

export const AI_MOCK_INTERVIEW_DEFAULT_MODEL = "gpt-realtime-2";
export const AI_MOCK_INTERVIEW_FALLBACK_MODEL = "gpt-realtime";
export const AI_MOCK_INTERVIEW_DEFAULT_VOICE = "marin";
export const AI_MOCK_INTERVIEW_MIN_CANDIDATE_TURNS = 8;
export const AI_MOCK_INTERVIEW_MAX_COMPLETED_SESSIONS = 2;
export const AI_MOCK_INTERVIEW_MAX_TRANSCRIPT_ITEMS = 120;
export const AI_MOCK_INTERVIEW_DURATION_LABEL = "10 to 12 minutes";
export const AI_MOCK_INTERVIEW_COMPLETION_PHRASE =
  "Mock interview complete. I have enough evidence to prepare your report now.";

const HIRING_SIGNALS = ["strong", "promising", "mixed", "not_ready"] as const;

export type AiMockInterviewHiringSignal = (typeof HIRING_SIGNALS)[number];

export interface AiMockInterviewTranscriptItem {
  role: "candidate" | "interviewer";
  text: string;
  at?: string;
}

export interface AiMockInterviewReport {
  overallScore: number;
  communicationScore: number;
  experienceScore: number;
  problemSolvingScore: number;
  roleFitScore: number;
  executivePresenceScore: number;
  hiringSignal: AiMockInterviewHiringSignal;
  summary: string;
  strengths: string[];
  risks: string[];
  focusAreas: string[];
  suggestedPracticeQuestions: string[];
  deliveryAnalysis: {
    fillerWordAssessment: string;
    paceAssessment: string;
    toneAndPresence: string;
    interviewerRead: string;
  };
  conversationMetrics: {
    candidateTurns: number;
    totalCandidateWords: number;
    avgWordsPerAnswer: number;
    estimatedWordsPerMinute: number;
    fillerWordCount: number;
    topFillerWords: string[];
  };
}

export interface AiMockInterviewConversationMetrics {
  candidateTurns: number;
  totalCandidateWords: number;
  avgWordsPerAnswer: number;
  estimatedWordsPerMinute: number;
  fillerWordCount: number;
  topFillerWords: string[];
}

const FILLER_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "um", pattern: /\bum+\b/gi },
  { label: "uh", pattern: /\buh+\b/gi },
  { label: "like", pattern: /\blike\b/gi },
  { label: "you know", pattern: /\byou know\b/gi },
  { label: "i mean", pattern: /\bi mean\b/gi },
  { label: "kind of", pattern: /\bkind of\b/gi },
  { label: "sort of", pattern: /\bsort of\b/gi },
  { label: "actually", pattern: /\bactually\b/gi },
  { label: "basically", pattern: /\bbasically\b/gi },
] as const;

export interface AiMockInterviewSessionConfig {
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
      voice: typeof AI_MOCK_INTERVIEW_DEFAULT_VOICE;
      speed: 1;
    };
  };
}

function cleanString(value: unknown, max = 1200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
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

function cleanStringList(value: unknown, maxItems = 6): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

export function buildAiMockInterviewConversationMetrics(input: {
  transcript: AiMockInterviewTranscriptItem[];
  durationSeconds?: number | null;
}): AiMockInterviewConversationMetrics {
  const candidateAnswers = normalizeAiMockInterviewTranscript(input.transcript)
    .filter((item) => item.role === "candidate");
  const totalCandidateWords = candidateAnswers.reduce((sum, item) => sum + countWords(item.text), 0);
  const candidateTurns = candidateAnswers.length;
  const avgWordsPerAnswer = candidateTurns > 0
    ? Math.round((totalCandidateWords / candidateTurns) * 10) / 10
    : 0;
  const durationSeconds = input.durationSeconds && input.durationSeconds > 0
    ? input.durationSeconds
    : null;
  const estimatedWordsPerMinute = durationSeconds
    ? Math.round((totalCandidateWords / Math.max(durationSeconds / 60, 1 / 60)) * 10) / 10
    : 0;

  const fillerCounts = FILLER_PATTERNS.map(({ label, pattern }) => ({
    label,
    count: candidateAnswers.reduce((sum, item) => sum + (item.text.match(pattern)?.length ?? 0), 0),
  }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  return {
    candidateTurns,
    totalCandidateWords,
    avgWordsPerAnswer,
    estimatedWordsPerMinute,
    fillerWordCount: fillerCounts.reduce((sum, item) => sum + item.count, 0),
    topFillerWords: fillerCounts.slice(0, 5).map((item) => `${item.label} (${item.count})`),
  };
}

export function normalizeAiMockInterviewModel(model: string): string {
  const trimmed = model.trim();
  if (trimmed === "gpt-realtime-2.0") return AI_MOCK_INTERVIEW_DEFAULT_MODEL;
  return trimmed || AI_MOCK_INTERVIEW_DEFAULT_MODEL;
}

export function getAiMockInterviewModel(): string {
  return normalizeAiMockInterviewModel(
    process.env.OPENAI_REALTIME_MOCK_INTERVIEW_MODEL?.trim() ||
    process.env.OPENAI_REALTIME_ENGLISH_TEST_MODEL?.trim() ||
    AI_MOCK_INTERVIEW_DEFAULT_MODEL
  );
}

export function getAiMockInterviewModelCandidates(): string[] {
  const candidates = [getAiMockInterviewModel(), AI_MOCK_INTERVIEW_FALLBACK_MODEL];
  return candidates.filter((model, index, models) => models.indexOf(model) === index);
}

export function normalizeAiMockInterviewTranscript(
  value: unknown
): AiMockInterviewTranscriptItem[] {
  if (!Array.isArray(value)) return [];

  const normalized: AiMockInterviewTranscriptItem[] = [];

  for (const item of value
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object")
    )) {
    if (item.role !== "candidate" && item.role !== "interviewer") continue;
    const text = cleanString(item.text, 3000);
    if (!text) continue;
    normalized.push({
      role: item.role,
      text,
      at: cleanString(item.at, 80) || new Date().toISOString(),
    });
  }

  return normalized.slice(-AI_MOCK_INTERVIEW_MAX_TRANSCRIPT_ITEMS);
}

export function countAiMockInterviewCandidateTurns(
  transcript: AiMockInterviewTranscriptItem[]
): number {
  return transcript.filter((item) => item.role === "candidate").length;
}

export function isMeaningfulAiMockInterviewCandidateTranscript(text: string): boolean {
  const clean = text.trim();
  if (clean.length < 10) return false;
  if (clean.split(/\s+/).length < 4) return false;
  if (/^(ok|okay|yes|no|yeah|uh|um|hmm|thanks)$/i.test(clean)) return false;
  if (/(keyboard|background noise|cough|breathing|silence)/i.test(clean)) return false;
  return true;
}

export function summarizeAiMockInterviewTranscriptForPrompt(
  transcript: AiMockInterviewTranscriptItem[]
): string {
  return normalizeAiMockInterviewTranscript(transcript)
    .slice(-30)
    .map((item) => `${item.role === "candidate" ? "Candidate" : "Interviewer"}: ${item.text}`)
    .join("\n");
}

function buildResumeContextInstructions(transcript: AiMockInterviewTranscriptItem[]) {
  if (countAiMockInterviewCandidateTurns(transcript) === 0) return [];

  return [
    "Saved progress exists from a previous AI mock interview voice connection.",
    "Continue the same mock interview; do not restart the opening and do not ask the candidate to repeat information already captured.",
    "Use the saved transcript as interview memory and continue with the next best role-specific question.",
    "Latest saved transcript:",
    summarizeAiMockInterviewTranscriptForPrompt(transcript) || "No readable saved transcript.",
  ];
}

function buildOpeningGroundingLine(context: AiMockInterviewContext): string {
  if (context.resumeFiles.length > 0) {
    return `In the opening, explicitly say you are grounding the interview on ${context.resumeFiles.join(", ")} for ${context.candidateName}.`;
  }

  if (context.cvText) {
    return `In the opening, explicitly say you are grounding the interview on the uploaded CV/resume context for ${context.candidateName}.`;
  }

  return `In the opening, explicitly say you will ground the interview on ${context.candidateName}'s candidate profile and ask for a short resume summary if needed.`;
}

export function buildAiMockInterviewInstructions(input: {
  language: Language;
  context: AiMockInterviewContext;
  transcript?: AiMockInterviewTranscriptItem[];
}): string {
  const contextSummary = summarizeAiMockInterviewContextForPrompt(input.context);
  const transcript = normalizeAiMockInterviewTranscript(input.transcript);

  return [
    "You are the Carreira USA AI mock interviewer inside CarreiraHub.",
    "Carreira USA helps Brazilian and international professionals prepare for U.S. corporate opportunities.",
    "This is not an English placement test. This is a realistic U.S. corporate job interview simulation for interview training.",
    "Speak only in English during the live interview.",
    `Run a focused mock interview that usually takes ${AI_MOCK_INTERVIEW_DURATION_LABEL}.`,
    `The candidate cannot manually end the interview. You decide when the interview is complete and, when ready, you must say exactly: "${AI_MOCK_INTERVIEW_COMPLETION_PHRASE}"`,
    `Do not end the interview before at least ${AI_MOCK_INTERVIEW_MIN_CANDIDATE_TURNS} substantive candidate answers. Usually aim for 8 to 10 strong answers; continue longer if the evidence is still weak or generic.`,
    "In the first spoken opening only, explicitly state the candidate's name, the interview duration, the areas you will cover, and the CV/resume grounding you are using.",
    "Sound like a real interviewer from a top U.S. company: calm, articulate, warm, confident, and sharp.",
    "Humanize the experience. Make the candidate feel respected and capable, not judged by a robot.",
    "Use natural interviewer language such as short acknowledgments, precise follow-ups, and polished transitions. Avoid robotic phrasing, repetitive templates, or stiff system-like wording.",
    "Challenge the candidate like a strong recruiter or hiring manager would, but keep the tone composed and confidence-building.",
    "If the candidate needs a brief second to think, allow that naturally. Do not cut them off for short pauses.",
    "If the candidate asks for clarification, clarify briefly like a real interviewer and continue.",
    "Ask one question at a time and keep your speaking turns concise so the candidate speaks most of the time.",
    "Use the candidate profile, CV/resume context, target role, current Carreira USA phase, and onboarding notes below.",
    "If the uploaded CV text is not available, use the onboarding notes and ask the candidate early to summarize the most relevant parts of their resume.",
    "Behave like a real interviewer: probe for evidence, ask follow-ups, test clarity, challenge vague claims, and move deeper when the answer is generic.",
    "Use different interview formats: resume walkthrough, behavioral CARL-first question, role-specific technical or business scenario, conflict or stakeholder question, prioritization question, salary/career-goal framing, and final reflection.",
    "For behavioral answers, prefer Carreira USA's CARL structure: context, action, result, and learning. If the candidate or U.S. interviewer framing uses STAR, treat STAR as compatible, but coach toward the missing learning/reflection when needed.",
    "If the candidate jokes, avoids the question, switches language unnecessarily, or loses focus, politely redirect them and re-ask the question before moving on.",
    "Ignore brief noises, coughs, keyboard sounds, breathing, background speech, and unclear fragments. Do not stop speaking only because of small noise.",
    "Do not give the candidate model answers during the live interview.",
    "Do not announce final scores in the live interview. At the end, say the report is being prepared.",
    "Evaluate interview readiness, not only English: answer structure, relevance, evidence, confidence, executive presence, role fit, communication, and problem-solving.",
    input.language === "pt-BR"
      ? "The final written report will be shown in Portuguese after the live interview."
      : "The final written report will be shown in English after the live interview.",
    "Candidate context:",
    contextSummary,
    ...buildResumeContextInstructions(transcript),
  ].join(" ");
}

export function buildAiMockInterviewSession(input: {
  language: Language;
  context: AiMockInterviewContext;
  model?: string;
  transcript?: AiMockInterviewTranscriptItem[];
}): AiMockInterviewSessionConfig {
  const model = input.model
    ? normalizeAiMockInterviewModel(input.model)
    : getAiMockInterviewModel();

  return {
    type: "realtime",
    model,
    output_modalities: ["audio"],
    instructions: buildAiMockInterviewInstructions(input),
    max_output_tokens: 1400,
    ...(model === AI_MOCK_INTERVIEW_DEFAULT_MODEL
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
        voice: AI_MOCK_INTERVIEW_DEFAULT_VOICE,
        speed: 1,
      },
    },
  };
}

export function buildAiMockInterviewOpeningPrompt(input: {
  context: AiMockInterviewContext;
  transcript?: AiMockInterviewTranscriptItem[];
}): string {
  const transcript = normalizeAiMockInterviewTranscript(input.transcript);
  if (countAiMockInterviewCandidateTurns(transcript) > 0) {
    return [
      "Resume the existing Carreira USA AI mock interview now.",
      "Do not repeat the full opening.",
      `Briefly welcome the candidate back and continue the interview for the ${input.context.targetRole || "target corporate role"}.`,
      "Ask exactly one next best interview question based on the saved transcript and candidate context.",
    ].join(" ");
  }

  return [
    "Start the Carreira USA AI mock interview now.",
    "Briefly introduce yourself as the AI interviewer for Carreira USA inside CarreiraHub.",
    `Address the candidate by name: ${input.context.candidateName}.`,
    `Explain in English that this is a realistic ${AI_MOCK_INTERVIEW_DURATION_LABEL} U.S. corporate mock interview for ${input.context.targetRole || "the candidate's target corporate role"}.`,
    "Explicitly say you will cover resume walkthrough, CARL behavioral evidence, role-specific scenarios, stakeholder or conflict handling, and a final reflection.",
    buildOpeningGroundingLine(input.context),
    "Set a calm, professional, confidence-building tone. Briefly tell the candidate they can take a moment to think and can ask for clarification if needed.",
    "Say that you will decide when there is enough evidence and then prepare the written report.",
    "Keep the introduction under 30 seconds.",
    `Then ask one strong first question for this candidate's target role: ${input.context.targetRole || "their target U.S. corporate role"}.`,
  ].join(" ");
}

export function buildAiMockInterviewFinalReportPrompt(input: {
  language: Language;
  context: AiMockInterviewContext;
  transcript: AiMockInterviewTranscriptItem[];
  durationSeconds?: number | null;
}): string {
  const reportLanguage =
    input.language === "pt-BR"
      ? "Write summary, strengths, risks, focusAreas, suggestedPracticeQuestions, and deliveryAnalysis in Portuguese for a Brazilian candidate."
      : "Write summary, strengths, risks, focusAreas, suggestedPracticeQuestions, and deliveryAnalysis in English.";
  const metrics = buildAiMockInterviewConversationMetrics({
    transcript: input.transcript,
    durationSeconds: input.durationSeconds,
  });

  return [
    "Create the final report for this Carreira USA AI mock interview.",
    "Act like a real interviewer from major U.S. companies reviewing this candidate after the interview.",
    "Evaluate interview readiness, not only English. Be direct, practical, and useful for coaching.",
    "Assess not only content but also delivery: filler words, pacing, answer control, clarity, confidence, executive presence, and whether the candidate sounds credible for this target area.",
    "You do not have raw acoustic pitch data. Infer tone, confidence, and pace only from transcript wording, answer shape, timing context, filler usage, and conversational flow. Do not pretend to have exact acoustic certainty.",
    "Write the report the way a strong interviewer or hiring panel would debrief a candidate after a high-stakes interview.",
    "Be specific about whether the candidate sounds polished, rushed, hesitant, vague, executive, junior, over-explaining, under-structured, or genuinely credible.",
    reportLanguage,
    "Return only valid JSON with this exact shape:",
    '{"overallScore":0,"communicationScore":0,"experienceScore":0,"problemSolvingScore":0,"roleFitScore":0,"executivePresenceScore":0,"hiringSignal":"strong|promising|mixed|not_ready","summary":"string","strengths":["string"],"risks":["string"],"focusAreas":["string"],"suggestedPracticeQuestions":["string"],"deliveryAnalysis":{"fillerWordAssessment":"string","paceAssessment":"string","toneAndPresence":"string","interviewerRead":"string"}}',
    "Use integer scores from 0 to 100.",
    "Hiring signal rules: strong means likely credible for target interviews now; promising means coachable with focused work; mixed means inconsistent evidence; not_ready means significant preparation gap.",
    "Do not include markdown, commentary, or extra keys.",
    "Conversation metrics computed from the session:",
    JSON.stringify(metrics),
    "Candidate context:",
    summarizeAiMockInterviewContextForPrompt(input.context),
    "Interview transcript:",
    summarizeAiMockInterviewTranscriptForPrompt(input.transcript) || "(No transcript)",
  ].join("\n");
}

export function normalizeAiMockInterviewReport(
  input: unknown,
  conversationMetrics: AiMockInterviewConversationMetrics = {
    candidateTurns: 0,
    totalCandidateWords: 0,
    avgWordsPerAnswer: 0,
    estimatedWordsPerMinute: 0,
    fillerWordCount: 0,
    topFillerWords: [] as string[],
  }
): AiMockInterviewReport {
  const raw = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const signal = typeof raw.hiringSignal === "string" && HIRING_SIGNALS.includes(raw.hiringSignal as AiMockInterviewHiringSignal)
    ? raw.hiringSignal as AiMockInterviewHiringSignal
    : "mixed";
  const delivery =
    raw.deliveryAnalysis && typeof raw.deliveryAnalysis === "object"
      ? raw.deliveryAnalysis as Record<string, unknown>
      : {};

  return {
    overallScore: clampInt(raw.overallScore, 0, 100),
    communicationScore: clampInt(raw.communicationScore, 0, 100),
    experienceScore: clampInt(raw.experienceScore, 0, 100),
    problemSolvingScore: clampInt(raw.problemSolvingScore, 0, 100),
    roleFitScore: clampInt(raw.roleFitScore, 0, 100),
    executivePresenceScore: clampInt(raw.executivePresenceScore, 0, 100),
    hiringSignal: signal,
    summary: cleanString(raw.summary, 1600),
    strengths: cleanStringList(raw.strengths),
    risks: cleanStringList(raw.risks),
    focusAreas: cleanStringList(raw.focusAreas),
    suggestedPracticeQuestions: cleanStringList(raw.suggestedPracticeQuestions, 8),
    deliveryAnalysis: {
      fillerWordAssessment: cleanString(delivery.fillerWordAssessment, 600),
      paceAssessment: cleanString(delivery.paceAssessment, 600),
      toneAndPresence: cleanString(delivery.toneAndPresence, 600),
      interviewerRead: cleanString(delivery.interviewerRead, 600),
    },
    conversationMetrics,
  };
}

export function buildAiMockInterviewSafetyIdentifier(customerId: string): string {
  return `mock_${createHash("sha256").update(customerId).digest("hex").slice(0, 59)}`;
}
