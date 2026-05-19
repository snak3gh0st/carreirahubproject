import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { addDays } from "date-fns";

import { prisma } from "@/lib/db";
import { isMissingOpsNativeTable } from "@/lib/ops/native-schema";
import { withCronTelemetry } from "@/lib/utils/cron-with-telegram";

export const dynamic = "force-dynamic";

export const GET = withCronTelemetry("mentorship-renewals", async () => {
  const now = new Date();
  const thirtyDaysOut = addDays(now, 30);

  let dueSoon;
  try {
    dueSoon = await prisma.opsStudentProfile.updateMany({
      where: {
        renewalDate: { gt: now, lte: thirtyDaysOut },
        renewalState: { in: ["NOT_DUE", "DUE_SOON"] },
        enrollment: { status: "ACTIVE" },
      },
      data: { renewalState: "DUE_SOON" },
    });
  } catch (error) {
    if (isMissingOpsNativeTable(error)) {
      return NextResponse.json({
        success: true,
        skipped: true,
        migrationRequired: true,
        dueSoon: 0,
        movedToNeedsRenewal: 0,
      });
    }
    throw error;
  }

  const [needsRenewalPhase, systemUser, profiles] = await Promise.all([
    prisma.mentorshipPhase.findUnique({
      where: { key: "precisa_renovar" },
      select: { id: true },
    }),
    prisma.user.findFirst({
      where: {
        active: true,
        role: { in: [UserRole.ADMIN, UserRole.HEAD_OPERACIONAL] },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }),
    prisma.opsStudentProfile.findMany({
      where: {
        renewalDate: { lte: now },
        renewalState: { notIn: ["RENEWED", "ENDED"] },
        enrollment: {
          status: "ACTIVE",
          currentPhase: {
            is: {
              key: {
                notIn: [
                  "precisa_renovar",
                  "audio_renovacao_enviado",
                  "renovacao",
                  "mentoria_encerrada",
                ],
              },
            },
          },
        },
      },
      include: {
        enrollment: {
          select: {
            id: true,
            currentPhaseId: true,
            customer: { select: { name: true, email: true } },
          },
        },
      },
    }),
  ]);

  let moved = 0;
  let stateOnly = 0;

  for (const profile of profiles) {
    if (!needsRenewalPhase || !systemUser) {
      await prisma.opsStudentProfile.update({
        where: { id: profile.id },
        data: { renewalState: "NEEDS_RENEWAL" },
      });
      stateOnly++;
      continue;
    }

    await prisma.$transaction([
      prisma.opsStudentProfile.update({
        where: { id: profile.id },
        data: { renewalState: "NEEDS_RENEWAL" },
      }),
      prisma.phaseTransition.create({
        data: {
          enrollmentId: profile.enrollment.id,
          fromPhaseId: profile.enrollment.currentPhaseId,
          toPhaseId: needsRenewalPhase.id,
          triggeredById: systemUser.id,
        },
      }),
      prisma.mentorshipEnrollment.update({
        where: { id: profile.enrollment.id },
        data: { currentPhaseId: needsRenewalPhase.id },
      }),
    ]);
    moved++;
  }

  return NextResponse.json({
    success: true,
    dueSoon: dueSoon.count,
    movedToNeedsRenewal: moved,
    stateOnly,
    missingPhase: !needsRenewalPhase,
    missingSystemUser: !systemUser,
  });
});

export const POST = GET;
