import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FORM_TEMPLATES, NPS_TEMPLATE_IDS } from "@/lib/hub/form-templates";
import { extractNpsFromSubmissions } from "@/lib/ops/nps";
import { deriveOpsWorkflowState } from "@/lib/ops/workflow";
import { isOperationalAccessRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userRole = (session.user as any).role as string;
  if (!isOperationalAccessRole(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const enrollment = await prisma.mentorshipEnrollment.findUnique({
    where: { id: params.id },
    include: {
      customer: {
        select: { id: true, name: true, email: true, phone: true, qbBalance: true },
      },
      currentPhase: { select: { id: true, key: true, label: true, sortOrder: true, slaDays: true } },
      assignedTo: { select: { id: true, name: true } },
      transitions: {
        orderBy: { createdAt: "asc" },
        include: {
          fromPhase: { select: { key: true, label: true, sortOrder: true } },
          toPhase: { select: { key: true, label: true, sortOrder: true } },
          triggeredBy: { select: { name: true } },
        },
      },
      sessions: {
        orderBy: { sessionDate: "desc" },
        take: 20,
        include: {
          conductor: { select: { name: true } },
        },
      },
    },
  });

  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  const [placementTest, realtimeTest, totalSessions, formAssignments] = await Promise.all([
    prisma.placementTest.findFirst({
      where: { customerId: enrollment.customer.id, totalScore: { not: -1 } },
      orderBy: { createdAt: "desc" },
      select: { cefrLevel: true, displayLevel: true, percentage: true, createdAt: true },
    }),
    prisma.englishRealtimeTest.findFirst({
      where: { customerId: enrollment.customer.id, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      select: { cefrLevel: true, displayLevel: true, score: true, createdAt: true },
    }),
    prisma.mentorshipSession.count({
      where: { enrollmentId: params.id },
    }),
    prisma.formAssignment.findMany({
      where: { customerId: enrollment.customer.id },
      orderBy: { assignedAt: "desc" },
      include: {
        submission: {
          select: { id: true, submittedAt: true, answers: true },
        },
      },
    }),
  ]);

  const englishTest =
    realtimeTest && (!placementTest || realtimeTest.createdAt > placementTest.createdAt)
      ? {
          cefrLevel: realtimeTest.cefrLevel ?? "",
          displayLevel: realtimeTest.displayLevel ?? "",
          percentage: realtimeTest.score ?? 0,
          createdAt: realtimeTest.createdAt,
        }
      : placementTest;

  const workflow = deriveOpsWorkflowState({
    enrollment,
    placementTest: englishTest,
  });

  const availableTemplateIds =
    enrollment.programType === "PASS"
      ? ["onboarding-pass", ...NPS_TEMPLATE_IDS]
      : ["onboarding-career", ...NPS_TEMPLATE_IDS];

  const availableFormTemplates = availableTemplateIds
    .map((templateId) => {
      const template = FORM_TEMPLATES[templateId];
      if (!template) return null;
      return {
        id: templateId,
        title: template.title,
        titlePt: template.titlePt,
      };
    })
    .filter((template): template is NonNullable<typeof template> => Boolean(template));

  const npsResults = extractNpsFromSubmissions(
    formAssignments
      .filter((assignment) => assignment.submission)
      .map((assignment) => ({
        answers: assignment.submission!.answers,
        submittedAt: assignment.submission!.submittedAt,
        assignment: { templateId: assignment.templateId },
      }))
  );

  return NextResponse.json({
    enrollment: {
      ...enrollment,
      formAssignments,
    },
    placementTest: englishTest,
    totalSessions,
    workflow,
    availableFormTemplates,
    npsResults,
  });
}
