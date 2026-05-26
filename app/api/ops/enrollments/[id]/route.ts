import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FORM_TEMPLATES, NPS_TEMPLATE_IDS } from "@/lib/hub/form-templates";
import { isMissingOpsNativeTable } from "@/lib/ops/native-schema";
import { extractNpsFromSubmissions } from "@/lib/ops/nps";
import { deriveOpsWorkflowState } from "@/lib/ops/workflow";
import { isOperationalAccessRole } from "@/lib/roles";
import { sanitizeOperationalCustomerIdentification } from "@/lib/customers/sensitive-identification";

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

  const baseInclude = {
    customer: {
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        preferredLanguage: true,
        dateOfBirth: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        qbBalance: true,
        qbTotalInvoiced: true,
        qbTotalPaid: true,
        lastQbBalanceSync: true,
        contracts: {
          orderBy: { createdAt: "desc" as const },
          take: 3,
          select: {
            id: true,
            status: true,
            docusign_env_id: true,
            sentAt: true,
            signedAt: true,
            expiresAt: true,
            signedS3Key: true,
            signedS3Url: true,
          },
        },
        invoices: {
          orderBy: { createdAt: "desc" as const },
          take: 8,
          select: {
            id: true,
            invoiceNumber: true,
            amount: true,
            amountPaid: true,
            dueDate: true,
            paidAt: true,
            status: true,
            paymentMethod: true,
            quickbooks_invoice_link: true,
          },
        },
        deals: {
          orderBy: { createdAt: "desc" as const },
          take: 4,
          select: {
            id: true,
            title: true,
            value: true,
            currency: true,
            status: true,
            createdAt: true,
            owner: { select: { name: true } },
          },
        },
      },
    },
    currentPhase: { select: { id: true, key: true, label: true, sortOrder: true, slaDays: true } },
    assignedTo: { select: { id: true, name: true } },
    transitions: {
      orderBy: { createdAt: "asc" as const },
      include: {
        fromPhase: { select: { key: true, label: true, sortOrder: true } },
        toPhase: { select: { key: true, label: true, sortOrder: true } },
        triggeredBy: { select: { name: true } },
      },
    },
    sessions: {
      orderBy: { sessionDate: "desc" as const },
          take: 20,
          include: {
            conductor: { select: { name: true } },
            performedByUser: { select: { name: true } },
            performedByStaff: { select: { name: true, status: true } },
          },
    },
  };

  let opsNativeMigrationRequired = false;
  let enrollment;
  try {
    enrollment = await prisma.mentorshipEnrollment.findUnique({
      where: { id: params.id },
      include: {
        ...baseInclude,
      opsProfile: true,
        opsDocuments: {
          orderBy: [{ uploadedAt: "desc" as const }],
          take: 12,
          include: {
            uploadedBy: { select: { name: true } },
            reviewedBy: { select: { name: true } },
          },
        },
        opsActivities: {
          orderBy: [{ activityDate: "desc" as const }],
          take: 20,
          include: {
            createdBy: { select: { name: true } },
            performedByUser: { select: { name: true } },
            performedByStaff: { select: { name: true, status: true } },
          },
        },
      },
    });
  } catch (error) {
    if (!isMissingOpsNativeTable(error)) throw error;
    opsNativeMigrationRequired = true;
    const fallback = await prisma.mentorshipEnrollment.findUnique({
      where: { id: params.id },
      include: baseInclude,
    });
    enrollment = fallback
      ? { ...fallback, opsProfile: null, opsDocuments: [], opsActivities: [] }
      : null;
  }

  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  const [placementTest, realtimeTest, totalSessions, formAssignments, mockInterviews] = await Promise.all([
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
    prisma.aiMockInterviewSession.findMany({
      where: { customerId: enrollment.customer.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        targetRole: true,
        interviewFocus: true,
        overallScore: true,
        communicationScore: true,
        experienceScore: true,
        problemSolvingScore: true,
        roleFitScore: true,
        executivePresenceScore: true,
        hiringSignal: true,
        summary: true,
        strengths: true,
        risks: true,
        focusAreas: true,
        durationSeconds: true,
        completedAt: true,
        createdAt: true,
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
    enrollment.programType === "PASS" || enrollment.programType === "ADVANCED"
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

  const safeEnrollment = {
    ...enrollment,
    customer: sanitizeOperationalCustomerIdentification(enrollment.customer),
  };

  return NextResponse.json({
    enrollment: {
      ...safeEnrollment,
      formAssignments,
    },
    placementTest: englishTest,
    totalSessions,
    workflow,
    availableFormTemplates,
    npsResults,
    mockInterviews,
    opsNativeMigrationRequired,
  });
}
