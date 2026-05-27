import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isMissingOpsNativeTable, OPS_NATIVE_MIGRATION_ERROR } from "@/lib/ops/native-schema";
import { getApiErrorMessage, parseOpsProfilePatchInput } from "@/lib/ops/ops-profile-schema";
import {
  calculateMentorshipRenewalDate,
  shouldRecalculateRenewalDateOnProfilePatch,
} from "@/lib/ops/renewal";
import {
  buildDigisacLifecycleDedupeKey,
  sendDigisacLifecycleMessageSafely,
} from "@/lib/ops/digisac-lifecycle";
import { isOperationalAccessRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

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
          renewalState: true,
          pauseExtensionDays: true,
        },
      },
    },
  });
  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  const parsed = parseOpsProfilePatchInput(await req.json().catch(() => ({})));
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return NextResponse.json(
      {
        error: getApiErrorMessage(fieldErrors, "Dados invalidos no perfil operacional"),
        fieldErrors,
      },
      { status: 400 }
    );
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
    const previousState = enrollment.opsProfile?.renewalState ?? "NOT_DUE";
    const profile = await prisma.opsStudentProfile.upsert({
      where: { enrollmentId: enrollment.id },
      create: {
        ...data,
        enrollmentId: enrollment.id,
        customerId: enrollment.customerId,
      },
      update: data,
    });

    // Notify on transition to a renewal-warning state
    const warningStates = new Set(["DUE_SOON", "DUE_NOW", "OVERDUE"]);
    const transitionedToWarning =
      warningStates.has(profile.renewalState) && previousState !== profile.renewalState;
    const digisacLifecycle = transitionedToWarning
      ? await sendDigisacLifecycleMessageSafely({
          event: "renewal_reminder",
          enrollmentId: enrollment.id,
          dedupeKey: buildDigisacLifecycleDedupeKey(
            "renewal_reminder",
            `${enrollment.id}:${profile.renewalState}`
          ),
          renewalDate: profile.renewalDate ?? null,
          daysUntilRenewal: profile.renewalDate
            ? Math.ceil((new Date(profile.renewalDate).getTime() - Date.now()) / 86_400_000)
            : null,
          metadata: {
            source: "ops.enrollments.ops-profile",
            previousState,
            renewalState: profile.renewalState,
          },
        })
      : null;

    return NextResponse.json({ profile, digisacLifecycle });
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
