import { z } from "zod";

export const OPS_STAFF_STATUS_FORMER = "FORMER" as const;
export const OPS_STAFF_STATUSES = [OPS_STAFF_STATUS_FORMER] as const;

const nullableString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  });

const optionalEmail = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim().toLowerCase();
    return trimmed.length ? trimmed : null;
  })
  .pipe(z.string().email().nullable());

const areasSchema = z
  .union([z.array(z.string()), z.string(), z.null()])
  .optional()
  .transform((value) => {
    const rawValues = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(",")
        : [];
    return Array.from(
      new Set(
        rawValues
          .map((area) => area.trim())
          .filter(Boolean)
      )
    );
  });

export const opsStaffMemberInputSchema = z.object({
  name: z.string().trim().min(1),
  email: optionalEmail,
  status: z.enum(OPS_STAFF_STATUSES).default(OPS_STAFF_STATUS_FORMER),
  areas: areasSchema,
  notes: nullableString,
});

export type OpsStaffMemberInput = z.infer<typeof opsStaffMemberInputSchema>;
export type OpsStaffStatus = (typeof OPS_STAFF_STATUSES)[number];

export function parseOpsStaffMemberInput(input: unknown) {
  return opsStaffMemberInputSchema.safeParse(input);
}

export function formatOpsStaffMemberLabel(staff: {
  name: string;
  status?: string | null;
}) {
  return staff.status === OPS_STAFF_STATUS_FORMER
    ? `${staff.name} (ex-funcionário)`
    : staff.name;
}

export type OperationalActorPayload =
  | {
      kind: "user";
      performedByUserId: string;
      performedByStaffId: null;
      sessionConductorId: string;
    }
  | {
      kind: "staff";
      performedByUserId: null;
      performedByStaffId: string;
      sessionConductorId: string;
    };

export function buildOperationalActorPayload(
  actorSelection: string | null | undefined,
  recorderUserId: string
): OperationalActorPayload {
  const selection = (actorSelection ?? "").trim();

  if (!selection) {
    return {
      kind: "user",
      performedByUserId: recorderUserId,
      performedByStaffId: null,
      sessionConductorId: recorderUserId,
    };
  }

  if (selection.startsWith("staff:")) {
    const staffId = selection.slice("staff:".length).trim();
    if (!staffId) {
      throw new Error("Invalid staff actor selection");
    }
    return {
      kind: "staff",
      performedByUserId: null,
      performedByStaffId: staffId,
      sessionConductorId: recorderUserId,
    };
  }

  const userId = selection.startsWith("user:")
    ? selection.slice("user:".length).trim()
    : selection;
  if (!userId) {
    throw new Error("Invalid user actor selection");
  }

  return {
    kind: "user",
    performedByUserId: userId,
    performedByStaffId: null,
    sessionConductorId: userId,
  };
}
