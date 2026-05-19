export const REALTIME_ENGLISH_TEST_DURATION_LABEL = "8 to 10 minutes";
export const REALTIME_ENGLISH_TEST_REQUIRED_STUDENT_TURNS = 5;
export const REALTIME_ENGLISH_TEST_MAX_TRANSCRIPT_ITEMS = 120;

export const REALTIME_ENGLISH_TEST_STAGES = [
  {
    id: "baseline",
    title: "Professional baseline",
    shortTitle: "Baseline",
    promptFocus: "current role, professional background, and U.S. career goal",
  },
  {
    id: "behavioral",
    title: "Behavioral evidence",
    shortTitle: "Behavioral",
    promptFocus: "past experience, business impact, and STAR-style follow-up",
  },
  {
    id: "workplace",
    title: "Workplace role-play",
    shortTitle: "Role-play",
    promptFocus: "realistic U.S. workplace conversation or stakeholder communication",
  },
  {
    id: "scenario",
    title: "Business scenario",
    shortTitle: "Scenario",
    promptFocus: "practical problem solving, prioritization, or conflict handling",
  },
  {
    id: "reasoning",
    title: "Opinion and reasoning",
    shortTitle: "Reasoning",
    promptFocus: "TOEFL-style opinion, structured reasoning, and clarification checks",
  },
] as const;

export type RealtimeEnglishTestStage = (typeof REALTIME_ENGLISH_TEST_STAGES)[number];

export const REALTIME_ENGLISH_TURN_ISSUE_TYPES = [
  "valid",
  "too_short",
  "off_topic",
  "joking",
  "unfocused",
  "non_english",
  "unclear",
  "refusal",
] as const;

export type RealtimeEnglishTurnIssueType =
  (typeof REALTIME_ENGLISH_TURN_ISSUE_TYPES)[number];

export interface RealtimeEnglishTranscriptLike {
  role: "student" | "examiner";
  text: string;
  at?: string;
  acceptedEvidence?: boolean;
  stageId?: string | null;
  issueType?: string | null;
  evaluationReason?: string | null;
}

export interface RealtimeEnglishTurnEvaluation {
  acceptedEvidence: boolean;
  stageId: string;
  stageTitle: string;
  issueType: RealtimeEnglishTurnIssueType;
  reason: string;
  examinerDirective: string;
}

export function countRealtimeEnglishStudentTurns(
  transcript: RealtimeEnglishTranscriptLike[]
): number {
  return transcript.filter((item) =>
    item.role === "student" &&
    item.text.trim() &&
    item.acceptedEvidence === true
  ).length;
}

export function isMeaningfulRealtimeStudentTranscript(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return false;

  const ignored = new Set([
    "ah",
    "eh",
    "er",
    "hm",
    "hmm",
    "hmmm",
    "uh",
    "uhh",
    "um",
    "umm",
    "okay",
    "ok",
    "yeah",
    "yes",
    "no",
    "sorry",
  ]);

  if (ignored.has(normalized)) return false;

  const words = normalized.split(" ").filter(Boolean);
  const letterCount = (normalized.match(/[a-z]/g) ?? []).length;

  return letterCount >= 8 && (words.length >= 2 || letterCount >= 12);
}

export function getRealtimeEnglishTestProgress(
  transcript: RealtimeEnglishTranscriptLike[]
) {
  const studentTurns = countRealtimeEnglishStudentTurns(transcript);
  const completedStageCount = Math.min(
    REALTIME_ENGLISH_TEST_REQUIRED_STUDENT_TURNS,
    studentTurns
  );

  return {
    studentTurns,
    completedStageCount,
    requiredStudentTurns: REALTIME_ENGLISH_TEST_REQUIRED_STUDENT_TURNS,
    remainingStudentTurns: Math.max(
      0,
      REALTIME_ENGLISH_TEST_REQUIRED_STUDENT_TURNS - studentTurns
    ),
    isCompleteEnough:
      studentTurns >= REALTIME_ENGLISH_TEST_REQUIRED_STUDENT_TURNS,
  };
}

export function getCurrentRealtimeEnglishTestStage(
  transcript: RealtimeEnglishTranscriptLike[]
): RealtimeEnglishTestStage {
  const progress = getRealtimeEnglishTestProgress(transcript);
  return REALTIME_ENGLISH_TEST_STAGES[
    Math.min(progress.completedStageCount, REALTIME_ENGLISH_TEST_STAGES.length - 1)
  ];
}

export function summarizeRealtimeEnglishTranscriptForPrompt(
  transcript: RealtimeEnglishTranscriptLike[]
): string {
  return transcript
    .slice(-12)
    .map((item) => {
      const speaker = item.role === "student" ? "Student" : "Examiner";
      const evidence =
        item.role === "student"
          ? item.acceptedEvidence === true
            ? " accepted evidence"
            : item.acceptedEvidence === false
              ? ` not accepted${item.issueType ? `: ${item.issueType}` : ""}`
              : ""
          : "";
      return `${speaker}${evidence}: ${item.text.trim()}`;
    })
    .filter(Boolean)
    .join("\n");
}

function isRealtimeEnglishTurnIssueType(
  value: unknown
): value is RealtimeEnglishTurnIssueType {
  return (
    typeof value === "string" &&
    REALTIME_ENGLISH_TURN_ISSUE_TYPES.includes(value as RealtimeEnglishTurnIssueType)
  );
}

function trimText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function buildFallbackRealtimeTurnEvaluation(input: {
  studentAnswer: string;
  stage: RealtimeEnglishTestStage;
}): RealtimeEnglishTurnEvaluation {
  const acceptedEvidence = isMeaningfulRealtimeStudentTranscript(input.studentAnswer);

  return {
    acceptedEvidence,
    stageId: input.stage.id,
    stageTitle: input.stage.title,
    issueType: acceptedEvidence ? "valid" : "too_short",
    reason: acceptedEvidence
      ? "The answer contains enough spoken evidence for this stage."
      : "The answer was too short or unclear to evaluate this stage reliably.",
    examinerDirective: acceptedEvidence
      ? `Move to the next section after acknowledging the answer briefly.`
      : `Do not advance. Ask the student to take their time and answer the ${input.stage.shortTitle.toLowerCase()} question with a full professional example.`,
  };
}

export function buildEvaluatorUnavailableRealtimeTurnEvaluation(input: {
  studentAnswer: string;
  stage: RealtimeEnglishTestStage;
}): RealtimeEnglishTurnEvaluation {
  void input.studentAnswer;

  return {
    acceptedEvidence: false,
    stageId: input.stage.id,
    stageTitle: input.stage.title,
    issueType: "unclear",
    reason: "The answer could not be validated by the evaluator service.",
    examinerDirective:
      `Do not advance. Ask the student to repeat or expand the ${input.stage.shortTitle.toLowerCase()} answer clearly while the evaluator validates the section.`,
  };
}

export function normalizeRealtimeEnglishTurnEvaluation(
  value: unknown,
  input: {
    studentAnswer: string;
    stage: RealtimeEnglishTestStage;
  }
): RealtimeEnglishTurnEvaluation {
  const fallback = buildFallbackRealtimeTurnEvaluation(input);
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const acceptedEvidence =
    raw.acceptedEvidence === true
      ? true
      : raw.acceptedEvidence === false
        ? false
        : fallback.acceptedEvidence;
  const issueType =
    acceptedEvidence
      ? "valid"
      : isRealtimeEnglishTurnIssueType(raw.issueType)
        ? raw.issueType
        : fallback.issueType;
  const reason =
    trimText(raw.reason, 500) ||
    trimText(raw.evaluationReason, 500) ||
    fallback.reason;
  const examinerDirective =
    trimText(raw.examinerDirective, 700) ||
    fallback.examinerDirective;

  return {
    acceptedEvidence,
    stageId: input.stage.id,
    stageTitle: input.stage.title,
    issueType,
    reason,
    examinerDirective,
  };
}

export function normalizeRealtimeEnglishTranscript(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item): RealtimeEnglishTranscriptLike & { at: string } => {
      const role = item.role === "student" ? "student" : "examiner";
      const text = typeof item.text === "string" ? item.text.trim() : "";
      const at = typeof item.at === "string" ? item.at : new Date().toISOString();
      const acceptedEvidence =
        item.acceptedEvidence === true
          ? true
          : item.acceptedEvidence === false
            ? false
            : undefined;
      const stageId =
        typeof item.stageId === "string" && item.stageId.trim()
          ? item.stageId.trim().slice(0, 80)
          : null;
      const issueType =
        typeof item.issueType === "string" && item.issueType.trim()
          ? item.issueType.trim().slice(0, 80)
          : null;
      const evaluationReason =
        typeof item.evaluationReason === "string" && item.evaluationReason.trim()
          ? item.evaluationReason.trim().slice(0, 500)
          : null;

      return {
        role,
        text,
        at,
        ...(acceptedEvidence !== undefined ? { acceptedEvidence } : {}),
        ...(stageId ? { stageId } : {}),
        ...(issueType ? { issueType } : {}),
        ...(evaluationReason ? { evaluationReason } : {}),
      };
    })
    .filter((item) => item.text)
    .slice(-REALTIME_ENGLISH_TEST_MAX_TRANSCRIPT_ITEMS);
}
