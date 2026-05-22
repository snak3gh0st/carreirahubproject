import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isMissingOpsNativeTable, OPS_NATIVE_MIGRATION_ERROR } from "@/lib/ops/native-schema";
import {
  calculateMentorshipRenewalDate,
  shouldRecalculateRenewalDateOnProfilePatch,
} from "@/lib/ops/renewal";
import { isOperationalAccessRole } from "@/lib/roles";
import { OPS_SENIORITY_LEVELS } from "@/lib/ops/visibility";

export const dynamic = "force-dynamic";

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

const profileSchema = z.object({
  optStatus: nullableString,
  seniority: z.enum(OPS_SENIORITY_LEVELS).nullable().optional(),
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userRole = (session.user as any).role as string;
  if (!isOperationalAccessRole(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const enrollment = await prisma.mentorshipEnrollment.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      customerId: true,
      startDate: true,
      opsProfile: {
        select: {
          renewalDate: true,
          pauseExtensionDays: true,
        },
      },
    },
  });
  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  const parsed = profileSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const shouldRecalculateRenewalDate = shouldRecalculateRenewalDateOnProfilePatch({
    requestedRenewalDate: parsed.data.renewalDate,
    existingRenewalDate: enrollment.opsProfile?.renewalDate ?? null,
    requestedPauseExtensionDays: parsed.data.pauseExtensionDays,
    existingPauseExtensionDays: enrollment.opsProfile?.pauseExtensionDays ?? 0,
  });

  const data = {
    ...parsed.data,
    renewalState: parsed.data.renewalState || "NOT_DUE",
    renewalDate: shouldRecalculateRenewalDate
      ? calculateMentorshipRenewalDate(enrollment.startDate, parsed.data.pauseExtensionDays)
      : parsed.data.renewalDate,
  };

  try {
    const profile = await prisma.opsStudentProfile.upsert({
      where: { enrollmentId: enrollment.id },
      create: {
        ...data,
        enrollmentId: enrollment.id,
        customerId: enrollment.customerId,
      },
      update: data,
    });

    return NextResponse.json({ profile });
  } catch (error) {
    if (isMissingOpsNativeTable(error)) {
      return NextResponse.json(
        { error: OPS_NATIVE_MIGRATION_ERROR, migrationRequired: true },
        { status: 503 }
      );
    }
    throw error;
  }
}
