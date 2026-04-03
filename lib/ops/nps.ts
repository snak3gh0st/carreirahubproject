import { NPS_SCORE_FIELD, NPS_TEMPLATE_IDS } from "@/lib/hub/form-templates";

export interface NpsResult {
  templateId: string;
  score: number;
  comment: string | null;
  submittedAt: Date;
}

export function extractNpsFromSubmissions(
  submissions: Array<{
    answers: unknown;
    submittedAt: Date;
    assignment: { templateId: string };
  }>
): NpsResult[] {
  return submissions
    .filter((submission) =>
      NPS_TEMPLATE_IDS.includes(submission.assignment.templateId as (typeof NPS_TEMPLATE_IDS)[number])
    )
    .map((submission) => {
      const answers = (submission.answers ?? {}) as Record<string, unknown>;
      const score = answers[NPS_SCORE_FIELD];
      const comment = answers.npsComment;

      return {
        templateId: submission.assignment.templateId,
        score: typeof score === "number" ? score : -1,
        comment: typeof comment === "string" ? comment : null,
        submittedAt: submission.submittedAt,
      };
    })
    .filter((result) => result.score >= 0);
}
