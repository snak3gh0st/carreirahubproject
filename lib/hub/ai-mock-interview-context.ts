import { FORM_TEMPLATES } from "@/lib/hub/form-templates";

export interface AiMockInterviewFormAssignmentLike {
  templateId: string;
  assignedAt?: Date | string;
  submission?: {
    answers?: unknown;
    submittedAt?: Date | string;
  } | null;
}

export interface AiMockInterviewContextInput {
  customer: {
    name: string;
    email: string;
  };
  enrollment?: {
    id: string;
    programType: string;
    currentPhase?: {
      key?: string | null;
      label?: string | null;
    } | null;
  } | null;
  englishLevel?: {
    cefrLevel?: string | null;
    displayLevel?: string | null;
    score?: number | null;
    percentage?: number | null;
  } | null;
  formAssignments?: AiMockInterviewFormAssignmentLike[];
}

export interface AiMockInterviewContext {
  candidateName: string;
  candidateEmail: string;
  programType: string | null;
  currentPhase: string | null;
  targetRole: string | null;
  linkedinUrl: string | null;
  resumeFiles: string[];
  cvText: string | null;
  englishLevel: string | null;
  profileHighlights: string[];
  rawAnswers: Record<string, string>;
}

const PRIORITY_FIELD_IDS = [
  "desiredRole",
  "fieldOfWork",
  "workExperience",
  "currentlyWorking",
  "relocationGoal",
  "cptOptArea",
  "timeInUsa",
  "personalValues",
  "priorityLevel",
  "specialNotes",
  "linkedIn",
  "resume",
  "resumeText",
  "cvText",
] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function cleanText(value: unknown, max = 1200): string {
  if (typeof value === "string") return value.trim().slice(0, max);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function fieldLabel(templateId: string, fieldId: string): string {
  const template = FORM_TEMPLATES[templateId];
  const field = template?.fields.find((item) => item.id === fieldId);
  return field?.label ?? fieldId;
}

function looksLikeStoredFile(value: string): boolean {
  return /^forms\/[^/]+\/[^/]+\/[^/]+\/.+/i.test(value) || /\.(pdf|doc|docx)$/i.test(value);
}

function filenameFromStorageKey(value: string): string {
  const parts = value.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? value;
}

function sortedSubmittedAssignments(assignments: AiMockInterviewFormAssignmentLike[]) {
  return assignments
    .filter((assignment) => assignment.submission?.answers)
    .sort((a, b) => {
      const aTime = new Date(a.submission?.submittedAt ?? a.assignedAt ?? 0).getTime();
      const bTime = new Date(b.submission?.submittedAt ?? b.assignedAt ?? 0).getTime();
      return bTime - aTime;
    });
}

export function buildAiMockInterviewContext(
  input: AiMockInterviewContextInput
): AiMockInterviewContext {
  const rawAnswers: Record<string, string> = {};
  const resumeFiles: string[] = [];
  const profileHighlights: string[] = [];

  for (const assignment of sortedSubmittedAssignments(input.formAssignments ?? [])) {
    const answers = asRecord(assignment.submission?.answers);
    for (const [fieldId, value] of Object.entries(answers)) {
      const text = cleanText(
        value,
        fieldId === "resumeText" || fieldId === "cvText" ? 9000 : 1200
      );
      if (!text) continue;

      const label = fieldLabel(assignment.templateId, fieldId);
      rawAnswers[fieldId] = rawAnswers[fieldId] ?? text;

      if (looksLikeStoredFile(text)) {
        resumeFiles.push(filenameFromStorageKey(text));
      }

      if (
        PRIORITY_FIELD_IDS.includes(fieldId as (typeof PRIORITY_FIELD_IDS)[number]) &&
        !looksLikeStoredFile(text)
      ) {
        profileHighlights.push(`${label}: ${text}`.slice(0, 600));
      }
    }
  }

  const targetRole =
    rawAnswers.desiredRole ||
    rawAnswers.relocationGoal ||
    rawAnswers.fieldOfWork ||
    null;
  const linkedinUrl = rawAnswers.linkedIn || null;
  const cvText =
    cleanText(
      rawAnswers.cvText ||
      rawAnswers.resumeText ||
      rawAnswers.resumeContent ||
      rawAnswers.resumeSummary,
      9000
    ) || null;
  const englishLevel = input.englishLevel?.cefrLevel
    ? `${input.englishLevel.cefrLevel}${input.englishLevel.displayLevel ? ` - ${input.englishLevel.displayLevel}` : ""}`
    : null;

  return {
    candidateName: input.customer.name,
    candidateEmail: input.customer.email,
    programType: input.enrollment?.programType ?? null,
    currentPhase: input.enrollment?.currentPhase?.label ?? input.enrollment?.currentPhase?.key ?? null,
    targetRole,
    linkedinUrl,
    resumeFiles: Array.from(new Set(resumeFiles)).slice(0, 5),
    cvText,
    englishLevel,
    profileHighlights: Array.from(new Set(profileHighlights)).slice(0, 18),
    rawAnswers,
  };
}

export function summarizeAiMockInterviewContextForPrompt(
  context: AiMockInterviewContext
): string {
  return [
    `Candidate: ${context.candidateName}`,
    context.programType ? `Program: ${context.programType}` : null,
    context.currentPhase ? `Current Carreira USA phase: ${context.currentPhase}` : null,
    context.targetRole ? `Target role / relocation goal: ${context.targetRole}` : null,
    context.linkedinUrl ? `LinkedIn: ${context.linkedinUrl}` : null,
    context.englishLevel ? `Latest English level: ${context.englishLevel}` : null,
    context.resumeFiles.length ? `Uploaded resume/CV files: ${context.resumeFiles.join(", ")}` : null,
    context.cvText
      ? `CV / resume text for interview grounding:\n${context.cvText}`
      : null,
    context.profileHighlights.length
      ? ["Profile notes from onboarding forms:", ...context.profileHighlights.map((item) => `- ${item}`)].join("\n")
      : "No detailed onboarding answers were found. Ask the candidate to summarize their CV early in the interview.",
  ].filter(Boolean).join("\n");
}
