import { z } from "zod";

export const HUB_JOB_SEARCH_RECORD_TYPES = [
  "APPLICATION",
  "INTERVIEW",
  "TASK",
  "OFFER",
] as const;

export type HubJobSearchRecordType = (typeof HUB_JOB_SEARCH_RECORD_TYPES)[number];

export type HubJobSearchRecordStatus =
  | "PENDENTE"
  | "EM_PROCESSO"
  | "CONCLUIDO"
  | "PASSOU"
  | "NAO_PASSOU"
  | "NO_SHOW"
  | "REMARCADO"
  | "CANCELADO"
  | "OFERTA"
  | "RECOLOCADO"
  | "PERDIDO";

const HUB_JOB_SEARCH_STATUSES = [
  "PENDENTE",
  "EM_PROCESSO",
  "CONCLUIDO",
  "PASSOU",
  "NAO_PASSOU",
  "NO_SHOW",
  "REMARCADO",
  "CANCELADO",
  "OFERTA",
  "RECOLOCADO",
  "PERDIDO",
] as const;

const DEFAULT_STATUS_BY_TYPE: Record<HubJobSearchRecordType, HubJobSearchRecordStatus> = {
  APPLICATION: "EM_PROCESSO",
  INTERVIEW: "EM_PROCESSO",
  TASK: "PENDENTE",
  OFFER: "OFERTA",
};

const nullableString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  });

const recordSchema = z
  .object({
    type: z.enum(HUB_JOB_SEARCH_RECORD_TYPES),
    activityDate: z.string().min(1, "Data é obrigatória."),
    company: nullableString,
    roleTitle: nullableString,
    area: nullableString,
    industry: nullableString,
    source: nullableString,
    jobUrl: nullableString,
    salary: nullableString,
    status: z.enum(HUB_JOB_SEARCH_STATUSES).nullable().optional(),
    outcome: nullableString,
    notes: nullableString,
  })
  .superRefine((value, ctx) => {
    const date = new Date(value.activityDate);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["activityDate"],
        message: "Data inválida.",
      });
    }

    if (value.type === "APPLICATION") {
      if (!value.company) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["company"],
          message: "Empresa é obrigatória para aplicações.",
        });
      }
      if (!value.roleTitle) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["roleTitle"],
          message: "Cargo é obrigatório para aplicações.",
        });
      }
      if (!value.jobUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["jobUrl"],
          message: "Link da vaga é obrigatório para aplicações.",
        });
      }
    }

    if (value.type === "INTERVIEW" || value.type === "OFFER") {
      if (!value.company) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["company"],
          message: "Empresa é obrigatória.",
        });
      }
      if (!value.roleTitle) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["roleTitle"],
          message: "Cargo é obrigatório.",
        });
      }
    }

    if (value.type === "TASK" && !value.roleTitle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["roleTitle"],
        message: "Título da task é obrigatório.",
      });
    }
  })
  .transform((value) => ({
    ...value,
    status: (value.status ?? DEFAULT_STATUS_BY_TYPE[value.type]) as HubJobSearchRecordStatus,
  }));

export type HubJobSearchRecordInput = z.infer<typeof recordSchema>;

export type HubJobSearchActivityLike = {
  type: string;
  status?: string | null;
};

export function parseHubJobSearchRecordInput(input: unknown) {
  return recordSchema.safeParse(input);
}

export function isHubJobSearchRecordType(type: string): type is HubJobSearchRecordType {
  return HUB_JOB_SEARCH_RECORD_TYPES.includes(type as HubJobSearchRecordType);
}

export function buildHubJobSearchActivityData(
  input: HubJobSearchRecordInput,
  enrollmentId: string
) {
  return {
    type: input.type,
    activityDate: new Date(input.activityDate),
    company: input.company,
    roleTitle: input.roleTitle,
    area: input.area,
    industry: input.industry,
    source: input.source,
    jobUrl: input.jobUrl,
    salary: input.salary,
    status: input.status,
    visibility: "STUDENT_VISIBLE",
    outcome: input.outcome,
    notes: input.notes,
    metadata: { createdFrom: "CLIENT_HUB" },
    enrollmentId,
    createdById: null,
  };
}

export function summarizeHubJobSearchActivities(activities: HubJobSearchActivityLike[]) {
  const summary = {
    applications: 0,
    interviews: 0,
    tasks: 0,
    openTasks: 0,
    offers: 0,
    total: 0,
  };

  activities.forEach((activity) => {
    if (!isHubJobSearchRecordType(activity.type)) return;

    summary.total += 1;
    if (activity.type === "APPLICATION") summary.applications += 1;
    if (activity.type === "INTERVIEW") summary.interviews += 1;
    if (activity.type === "OFFER") summary.offers += 1;
    if (activity.type === "TASK") {
      summary.tasks += 1;
      if (activity.status !== "CONCLUIDO") summary.openTasks += 1;
    }
  });

  return summary;
}

function flattenErrorValue(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenErrorValue);
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, nested]) =>
      flattenErrorValue(nested).map((message) => `${key}: ${message}`)
    );
  }
  return [];
}

export function getHubJobSearchApiErrorMessage(error: unknown, fallback: string): string {
  const messages = flattenErrorValue(error);
  return messages.length ? messages.join("; ") : fallback;
}
