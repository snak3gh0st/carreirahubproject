import { z } from "zod";

import { OPS_SENIORITY_LEVELS } from "@/lib/ops/visibility";

const nullableString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  });

const nullableDate = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  });

const nullableSeniority = z
  .union([z.enum(OPS_SENIORITY_LEVELS), z.literal(""), z.null()])
  .optional()
  .transform((value) => (value ? value : null));

export const opsProfilePatchSchema = z.object({
  optStatus: nullableString,
  seniority: nullableSeniority,
  coachCohort: nullableString,
  classAttendancePercent: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === null || value === "") return null;
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return null;
      return Math.max(0, Math.min(100, Math.round(parsed)));
    }),
  boardUrl: nullableString,
  notionUrl: nullableString,
  linkedinUrl: nullableString,
  canvaUrl: nullableString,
  studentMaterialUrl: nullableString,
  interviewRecordingFolderUrl: nullableString,
  contractPdfKey: nullableString,
  renewalDate: nullableDate,
  renewalState: nullableString,
  renewalAdjustmentReason: nullableString,
  pauseExtensionDays: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === null || value === "") return 0;
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return 0;
      return Math.max(0, Math.round(parsed));
    }),
  lastOperationalContactAt: nullableDate,
  notes: nullableString,
});

export function parseOpsProfilePatchInput(input: unknown) {
  return opsProfilePatchSchema.safeParse(input);
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

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const messages = flattenErrorValue(error);
  return messages.length ? messages.join("; ") : fallback;
}
