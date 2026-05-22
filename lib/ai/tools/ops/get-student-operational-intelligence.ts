import { z } from "zod";
import { InvoiceStatus } from "@prisma/client";

import { defineAiTool, requireRole } from "../_base";
import { prisma } from "@/lib/db";
import { getPhaseChecklist } from "@/lib/ops/phase-checklists";
import { OPERATIONAL_AI_ROLES } from "../role-groups";

function countBy<T>(items: T[], getKey: (item: T) => string | null | undefined) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = getKey(item) || "Não informado";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function truncateText(value: string | null | undefined, max = 500) {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
}

export const getStudentOperationalIntelligence = defineAiTool({
  name: "getStudentOperationalIntelligence",
  description:
    "Monta um dossiê operacional interno de um aluno: fase, checklist, sessões por responsável, documentos, aplicações, entrevistas, comentários internos, formulários, NPS, mock interviews e pendências. Use para perguntas detalhadas sobre um aluno específico.",
  allowedRoles: OPERATIONAL_AI_ROLES,
  inputSchema: z.object({
    enrollmentId: z.string(),
  }),
  async handler({ enrollmentId }, ctx) {
    requireRole(ctx.user.role, OPERATIONAL_AI_ROLES);

    try {
      const enrollment = await prisma.mentorshipEnrollment.findUnique({
        where: { id: enrollmentId },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              qbBalance: true,
              placementTests: {
                where: { totalScore: { not: -1 } },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { displayLevel: true, cefrLevel: true, percentage: true, createdAt: true },
              },
              englishRealtimeTests: {
                where: { status: "COMPLETED" },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { displayLevel: true, cefrLevel: true, score: true, createdAt: true },
              },
            },
          },
          assignedTo: { select: { id: true, name: true } },
          currentPhase: { select: { key: true, label: true, slaDays: true } },
          transitions: {
            orderBy: { createdAt: "desc" },
            take: 8,
            include: {
              fromPhase: { select: { key: true, label: true } },
              toPhase: { select: { key: true, label: true } },
              triggeredBy: { select: { name: true } },
            },
          },
          sessions: {
            orderBy: { sessionDate: "desc" },
            take: 60,
            include: { conductor: { select: { id: true, name: true } } },
          },
          opsProfile: true,
          opsDocuments: {
            orderBy: { uploadedAt: "desc" },
            take: 40,
            select: {
              kind: true,
              resourceType: true,
              visibility: true,
              status: true,
              title: true,
              filename: true,
              version: true,
              uploadedAt: true,
              reviewedAt: true,
              finalizedAt: true,
              uploadedBy: { select: { name: true } },
              reviewedBy: { select: { name: true } },
            },
          },
          opsActivities: {
            orderBy: { activityDate: "desc" },
            take: 80,
            include: { createdBy: { select: { name: true } } },
          },
          comments: {
            where: { visibility: "INTERNAL" },
            orderBy: { createdAt: "desc" },
            take: 20,
            include: { author: { select: { name: true } } },
          },
          checklistProgress: {
            select: { phaseKey: true, itemKey: true, completedAt: true },
          },
        },
      });

      if (!enrollment) {
        return { error: `Matrícula "${enrollmentId}" não encontrada.` };
      }

      const [openInvoices, formAssignments, mockInterviews, npsAssignments] = await Promise.all([
        prisma.invoice.findMany({
          where: {
            customerId: enrollment.customerId,
            status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE, InvoiceStatus.PARTIALLY_PAID] },
          },
          orderBy: { dueDate: "asc" },
          take: 12,
          select: { invoiceNumber: true, amount: true, amountPaid: true, status: true, dueDate: true },
        }),
        prisma.formAssignment.findMany({
          where: { customerId: enrollment.customerId },
          orderBy: { assignedAt: "desc" },
          take: 20,
          select: {
            templateId: true,
            status: true,
            assignedAt: true,
            submission: { select: { submittedAt: true, answers: true } },
          },
        }),
        prisma.aiMockInterviewSession.findMany({
          where: { enrollmentId },
          orderBy: { createdAt: "desc" },
          take: 12,
          select: {
            status: true,
            targetRole: true,
            interviewFocus: true,
            overallScore: true,
            hiringSignal: true,
            summary: true,
            completedAt: true,
            createdAt: true,
          },
        }),
        prisma.formAssignment.findMany({
          where: { customerId: enrollment.customerId, submission: { isNot: null } },
          select: {
            templateId: true,
            submission: { select: { answers: true, submittedAt: true } },
          },
        }),
      ]);

      const now = new Date();
      const phaseKey = enrollment.currentPhase?.key ?? null;
      const checklist = phaseKey ? getPhaseChecklist(phaseKey) : [];
      const completedChecklistKeys = new Set(
        enrollment.checklistProgress
          .filter((item) => item.phaseKey === phaseKey && item.completedAt)
          .map((item) => item.itemKey)
      );

      const applications = enrollment.opsActivities.filter((activity) => activity.type === "APPLICATION");
      const interviews = enrollment.opsActivities.filter((activity) => activity.type === "INTERVIEW");
      const placements = enrollment.opsActivities.filter(
        (activity) => activity.type === "JOB_PLACED" || activity.status === "RECOLOCADO"
      );
      const lastTransitionAt = enrollment.transitions[0]?.createdAt ?? enrollment.startDate;
      const daysInPhase = Math.max(0, Math.floor((now.getTime() - lastTransitionAt.getTime()) / 86_400_000));
      const lastSessionAt = enrollment.sessions[0]?.sessionDate ?? null;
      const daysSinceLastSession = lastSessionAt
        ? Math.max(0, Math.floor((now.getTime() - lastSessionAt.getTime()) / 86_400_000))
        : null;

      const npsScores = npsAssignments
        .map((assignment) => {
          const answers = assignment.submission?.answers;
          if (!answers || typeof answers !== "object") return null;
          const score = Object.values(answers as Record<string, unknown>).find((value) => {
            const number = Number(value);
            return Number.isFinite(number) && number >= 0 && number <= 10;
          });
          return Number(score);
        })
        .filter((score): score is number => Number.isFinite(score));

      const realtime = enrollment.customer.englishRealtimeTests[0];
      const placement = enrollment.customer.placementTests[0];
      const englishTest =
        realtime && (!placement || realtime.createdAt > placement.createdAt)
          ? {
              source: "realtime",
              level: realtime.displayLevel,
              cefrLevel: realtime.cefrLevel,
              score: realtime.score,
              date: realtime.createdAt.toISOString(),
            }
          : placement
            ? {
                source: "written",
                level: placement.displayLevel,
                cefrLevel: placement.cefrLevel,
                score: placement.percentage,
                date: placement.createdAt.toISOString(),
              }
            : null;

      return {
        source: "Ops Hub interno",
        generatedAt: now.toISOString(),
        student: {
          enrollmentId: enrollment.id,
          customerId: enrollment.customerId,
          name: enrollment.customer.name,
          email: enrollment.customer.email,
          programType: enrollment.programType,
          status: enrollment.status,
          owner: enrollment.assignedTo.name,
          currentPhase: enrollment.currentPhase,
          startDate: enrollment.startDate.toISOString(),
        },
        phase: {
          daysInPhase,
          slaDays: enrollment.currentPhase?.slaDays ?? null,
          overdue: enrollment.currentPhase?.slaDays ? daysInPhase > enrollment.currentPhase.slaDays : false,
          history: enrollment.transitions.map((transition) => ({
            from: transition.fromPhase?.label ?? "Início",
            to: transition.toPhase.label,
            at: transition.createdAt.toISOString(),
            by: transition.triggeredBy.name,
          })),
        },
        checklist: {
          total: checklist.length,
          completed: completedChecklistKeys.size,
          pendingItems: checklist
            .filter((item) => !completedChecklistKeys.has(item.key))
            .map((item) => item.label),
        },
        sessions: {
          total: enrollment.sessions.length,
          byType: countBy(enrollment.sessions, (session) => session.sessionType),
          byStatus: countBy(enrollment.sessions, (session) => session.status),
          byConductor: countBy(enrollment.sessions, (session) => session.conductor?.name),
          lastSessionAt: lastSessionAt?.toISOString() ?? null,
          daysSinceLastSession,
          recent: enrollment.sessions.slice(0, 10).map((session) => ({
            type: session.sessionType,
            status: session.status,
            date: session.sessionDate.toISOString(),
            conductor: session.conductor?.name ?? null,
            notes: truncateText(session.notes, 320),
          })),
        },
        documents: {
          total: enrollment.opsDocuments.length,
          byKind: countBy(enrollment.opsDocuments, (document) => document.kind),
          byStatus: countBy(enrollment.opsDocuments, (document) => document.status),
          studentVisible: enrollment.opsDocuments.filter((document) => document.visibility === "STUDENT_VISIBLE").length,
          recent: enrollment.opsDocuments.slice(0, 12).map((document) => ({
            kind: document.kind,
            status: document.status,
            visibility: document.visibility,
            title: document.title ?? document.filename,
            resourceType: document.resourceType,
            uploadedAt: document.uploadedAt.toISOString(),
            finalizedAt: document.finalizedAt?.toISOString() ?? null,
            uploadedBy: document.uploadedBy?.name ?? null,
            reviewedBy: document.reviewedBy?.name ?? null,
          })),
        },
        applicationsAndInterviews: {
          applications: applications.length,
          applicationsMissingLink: applications.filter((activity) => !activity.jobUrl).length,
          interviews: interviews.length,
          interviewsByStatus: countBy(interviews, (activity) => activity.status),
          placements: placements.length,
          placementsByIndustry: countBy(placements, (activity) => activity.industry),
          recent: enrollment.opsActivities.slice(0, 20).map((activity) => ({
            type: activity.type,
            status: activity.status,
            date: activity.activityDate.toISOString(),
            company: activity.company,
            roleTitle: activity.roleTitle,
            industry: activity.industry,
            source: activity.source,
            hasJobUrl: Boolean(activity.jobUrl),
            outcome: truncateText(activity.outcome, 240),
            notes: truncateText(activity.notes, 320),
            createdBy: activity.createdBy?.name ?? null,
          })),
        },
        forms: {
          total: formAssignments.length,
          pending: formAssignments.filter((assignment) => assignment.status !== "COMPLETED").length,
          byStatus: countBy(formAssignments, (assignment) => assignment.status),
          recent: formAssignments.slice(0, 10).map((assignment) => ({
            templateId: assignment.templateId,
            status: assignment.status,
            assignedAt: assignment.assignedAt.toISOString(),
            submittedAt: assignment.submission?.submittedAt.toISOString() ?? null,
          })),
        },
        mockInterviews: {
          total: mockInterviews.length,
          completed: mockInterviews.filter((mock) => mock.status === "COMPLETED" || mock.completedAt).length,
          recent: mockInterviews.map((mock) => ({
            status: mock.status,
            targetRole: mock.targetRole,
            focus: mock.interviewFocus,
            overallScore: mock.overallScore,
            hiringSignal: mock.hiringSignal,
            summary: truncateText(mock.summary, 420),
            completedAt: mock.completedAt?.toISOString() ?? null,
            createdAt: mock.createdAt.toISOString(),
          })),
        },
        internalComments: {
          total: enrollment.comments.length,
          byCategory: countBy(enrollment.comments, (comment) => comment.category),
          recent: enrollment.comments.slice(0, 12).map((comment) => ({
            category: comment.category,
            author: comment.author?.name ?? null,
            createdAt: comment.createdAt.toISOString(),
            body: truncateText(comment.body, 420),
          })),
        },
        finance: {
          qbBalance: Number(enrollment.customer.qbBalance ?? 0),
          openInvoices: openInvoices.map((invoice) => ({
            invoiceNumber: invoice.invoiceNumber,
            status: invoice.status,
            amount: Number(invoice.amount),
            amountPaid: Number(invoice.amountPaid ?? 0),
            dueDate: invoice.dueDate.toISOString(),
          })),
        },
        outcomes: {
          englishTest,
          npsAverage: npsScores.length
            ? Math.round((npsScores.reduce((sum, score) => sum + score, 0) / npsScores.length) * 10) / 10
            : null,
          npsCount: npsScores.length,
        },
        opsProfile: {
          seniority: enrollment.opsProfile?.seniority ?? null,
          optStatus: enrollment.opsProfile?.optStatus ?? null,
          renewalDate: enrollment.opsProfile?.renewalDate?.toISOString() ?? null,
          renewalState: enrollment.opsProfile?.renewalState ?? null,
          pauseExtensionDays: enrollment.opsProfile?.pauseExtensionDays ?? null,
          canvaConfigured: Boolean(enrollment.opsProfile?.canvaUrl),
          studentMaterialConfigured: Boolean(enrollment.opsProfile?.studentMaterialUrl),
        },
      };
    } catch (err) {
      return { error: `Falha ao montar inteligência operacional do aluno: ${(err as Error).message}` };
    }
  },
});
