import { z } from 'zod';
import { InvoiceStatus } from '@prisma/client';
import { defineAiTool, requireRole } from '../_base';
import { prisma } from '@/lib/db';
import { toStudentSafeDto } from '../../dto';
import { OPERATIONAL_AI_ROLES } from '../role-groups';
import { isMissingOpsNativeTable } from '@/lib/ops/native-schema';

export const getStudentProfile = defineAiTool({
  name: 'getStudentProfile',
  description: 'Retorna o perfil completo de um aluno: fase atual, sessões, faturas abertas e histórico de transições. Use quando o usuário perguntar sobre um aluno específico.',
  allowedRoles: OPERATIONAL_AI_ROLES,
  inputSchema: z.object({
    enrollmentId: z.string(),
  }),
  async handler({ enrollmentId }, ctx) {
    requireRole(ctx.user.role, OPERATIONAL_AI_ROLES);
    try {
      const baseInclude = {
        customer: true,
        currentPhase: true,
        sessions: {
          orderBy: { sessionDate: 'desc' as const },
          take: 1,
        },
        transitions: {
          orderBy: { createdAt: 'desc' as const },
          take: 5,
          include: {
            fromPhase: { select: { key: true, label: true } },
            toPhase: { select: { key: true, label: true } },
          },
        },
      };

      let opsNativeMigrationRequired = false;
      let enrollment;
      try {
        enrollment = await prisma.mentorshipEnrollment.findUnique({
          where: { id: enrollmentId },
          include: {
            ...baseInclude,
            opsProfile: true,
            opsActivities: {
              orderBy: { activityDate: 'desc' as const },
              take: 20,
            },
            opsDocuments: {
              orderBy: { uploadedAt: 'desc' as const },
              take: 10,
              select: {
                kind: true,
                status: true,
                title: true,
                filename: true,
                version: true,
                uploadedAt: true,
              },
            },
          },
        });
      } catch (error) {
        if (!isMissingOpsNativeTable(error)) throw error;
        opsNativeMigrationRequired = true;
        const fallback = await prisma.mentorshipEnrollment.findUnique({
          where: { id: enrollmentId },
          include: baseInclude,
        });
        enrollment = fallback
          ? { ...fallback, opsProfile: null, opsActivities: [], opsDocuments: [] }
          : null;
      }

      if (!enrollment) {
        return { error: `Matrícula "${enrollmentId}" não encontrada.` };
      }

      const openInvoicesCount = await prisma.invoice.count({
        where: {
          customerId: enrollment.customerId,
          status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE, InvoiceStatus.PARTIALLY_PAID] },
        },
      });

      const studentDto = toStudentSafeDto({
        id: enrollment.id,
        customerId: enrollment.customerId,
        customer: enrollment.customer,
        programType: enrollment.programType,
        status: enrollment.status,
        currentPhase: enrollment.currentPhase ?? undefined,
        assignedUserId: enrollment.assignedToId,
      });

      const phaseHistory = enrollment.transitions.map(t => ({
        from: t.fromPhase?.label ?? '(início)',
        to: t.toPhase.label,
        at: t.createdAt.toISOString(),
      }));

      return {
        studentDto,
        openInvoices: openInvoicesCount,
        lastSessionAt: enrollment.sessions[0]?.sessionDate.toISOString() ?? null,
        phaseHistory,
        opsProfile: enrollment.opsProfile,
        activities: enrollment.opsActivities.map((activity) => ({
          type: activity.type,
          date: activity.activityDate.toISOString(),
          company: activity.company,
          roleTitle: activity.roleTitle,
          outcome: activity.outcome,
        })),
        documents: enrollment.opsDocuments,
        opsNativeMigrationRequired,
      };
    } catch (err) {
      return { error: `Falha ao buscar perfil do aluno: ${(err as Error).message}` };
    }
  },
});
