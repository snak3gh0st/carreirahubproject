import { prisma } from "@/lib/db";
import {
  buildAiMockInterviewContext,
  type AiMockInterviewContext,
} from "@/lib/hub/ai-mock-interview-context";

export interface AiMockInterviewAccess {
  allowed: boolean;
  reason: string | null;
  customer: {
    id: string;
    name: string;
    email: string;
  };
  enrollment: {
    id: string;
    programType: string;
    assignedToId: string;
    currentPhase: {
      key: string;
      label: string;
    } | null;
  } | null;
  context: AiMockInterviewContext;
}

export async function getAiMockInterviewAccess(
  customerId: string
): Promise<AiMockInterviewAccess | null> {
  const [customer, enrollment, placementTest, realtimeTest, formAssignments] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true, email: true },
    }),
    prisma.mentorshipEnrollment.findFirst({
      where: { customerId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        programType: true,
        assignedToId: true,
        currentPhase: { select: { key: true, label: true } },
      },
    }),
    prisma.placementTest.findFirst({
      where: { customerId, totalScore: { not: -1 } },
      orderBy: { createdAt: "desc" },
      select: {
        cefrLevel: true,
        displayLevel: true,
        percentage: true,
        createdAt: true,
      },
    }),
    prisma.englishRealtimeTest.findFirst({
      where: { customerId, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      select: {
        cefrLevel: true,
        displayLevel: true,
        score: true,
        createdAt: true,
      },
    }),
    prisma.formAssignment.findMany({
      where: { customerId },
      orderBy: { assignedAt: "desc" },
      include: {
        submission: {
          select: { answers: true, submittedAt: true },
        },
      },
    }),
  ]);

  if (!customer) return null;

  const englishLevel =
    realtimeTest && (!placementTest || realtimeTest.createdAt > placementTest.createdAt)
      ? realtimeTest
      : placementTest;
  const context = buildAiMockInterviewContext({
    customer,
    enrollment,
    englishLevel,
    formAssignments,
  });

  return {
    allowed: Boolean(enrollment),
    reason: enrollment
      ? null
      : "AI mock interview is available for active Carreira USA program students.",
    customer,
    enrollment,
    context,
  };
}
