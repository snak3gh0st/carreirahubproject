import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createOpsManualStudentCommunicationAlert } from "@/lib/ops/internal-alerts";
import { emailService } from "@/lib/services/email.service";

const CEFR_RANK: Record<string, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

export const ENGLISH_TEST_MIN_PASSING_CEFR = "B1";
export const ENGLISH_TEST_MIN_PASSING_SCORE = 55;

export function isEnglishTestPassingResult(input: {
  cefrLevel: string | null | undefined;
  score?: number | null;
  percentage?: number | null;
}): boolean {
  const cefrRank = CEFR_RANK[String(input.cefrLevel || "").toUpperCase()] ?? 0;
  const numericScore = input.score ?? input.percentage ?? null;
  const scorePass = numericScore == null || numericScore >= ENGLISH_TEST_MIN_PASSING_SCORE;

  return cefrRank >= CEFR_RANK[ENGLISH_TEST_MIN_PASSING_CEFR] && scorePass;
}

export async function handleCompletedEnglishTestOutcome(input: {
  customerId: string;
  testKind: "WRITTEN" | "REALTIME" | "VOICE";
  testId: string;
  cefrLevel: string;
  displayLevel: string;
  score?: number | null;
  percentage?: number | null;
}) {
  const [customer, enrollment, failedPhase, systemUser] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: input.customerId },
      select: { id: true, name: true, email: true },
    }),
    prisma.mentorshipEnrollment.findFirst({
      where: { customerId: input.customerId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        currentPhaseId: true,
        currentPhase: { select: { key: true } },
        customer: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.mentorshipPhase.findUnique({
      where: { key: "nao_passou_teste_ingles" },
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
  ]);

  if (customer) {
    await emailService.sendOpsEnglishTestCompletedAlert(
      customer,
      {
        testKind: input.testKind,
        testId: input.testId,
        cefrLevel: input.cefrLevel,
        displayLevel: input.displayLevel,
        score: input.score ?? null,
        percentage: input.percentage ?? null,
        enrollmentId: enrollment?.id ?? null,
      }
    ).catch((emailError) => {
      console.warn("[Hub English Test] Could not email ops about completed test:", emailError);
    });
  }

  if (isEnglishTestPassingResult(input)) {
    return { passed: true, movedToManualReview: false, alertCreated: false };
  }

  let movedToManualReview = false;

  if (
    enrollment &&
    failedPhase &&
    systemUser &&
    enrollment.currentPhase?.key !== "nao_passou_teste_ingles"
  ) {
    await prisma.$transaction([
      prisma.phaseTransition.create({
        data: {
          enrollmentId: enrollment.id,
          fromPhaseId: enrollment.currentPhaseId,
          toPhaseId: failedPhase.id,
          triggeredById: systemUser.id,
          reason: `English test did not meet threshold (${input.cefrLevel}, score ${input.score ?? input.percentage ?? "n/a"}). Manual review required.`,
        },
      }),
      prisma.mentorshipEnrollment.update({
        where: { id: enrollment.id },
        data: { currentPhaseId: failedPhase.id },
      }),
    ]);
    movedToManualReview = true;
  }

  let alertCreated = false;
  if (enrollment?.customer) {
    const result = await createOpsManualStudentCommunicationAlert({
      customerId: enrollment.customer.id,
      customerName: enrollment.customer.name,
      customerEmail: enrollment.customer.email,
      title: `Analise manual: teste de ingles nao aprovado`,
      description: `${enrollment.customer.name} concluiu o teste de ingles com ${input.cefrLevel} (${input.displayLevel}) e score ${input.score ?? input.percentage ?? "n/a"}. Nao avancar para onboarding sem decisao operacional/comercial.`,
      dedupeKey: `english-test-failed:${input.testKind}:${input.testId}`,
      data: {
        source: "english-test-outcome",
        testKind: input.testKind,
        testId: input.testId,
        cefrLevel: input.cefrLevel,
        displayLevel: input.displayLevel,
        score: input.score ?? null,
        percentage: input.percentage ?? null,
        requiredCefr: ENGLISH_TEST_MIN_PASSING_CEFR,
        requiredScore: ENGLISH_TEST_MIN_PASSING_SCORE,
      },
    });
    alertCreated = result.created;
  }

  return { passed: false, movedToManualReview, alertCreated };
}
