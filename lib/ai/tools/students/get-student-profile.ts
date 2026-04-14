import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { defineAiTool, requireRole } from '../_base';
import { prisma } from '@/lib/db';
import { toStudentSafeDto } from '../../dto';

export const getStudentProfile = defineAiTool({
  name: 'getStudentProfile',
  description: 'Retorna o perfil completo de um aluno: fase atual, sessões, faturas abertas e histórico de transições. Use quando o usuário perguntar sobre um aluno específico.',
  allowedRoles: [UserRole.ADMIN, UserRole.OPERATIONAL, UserRole.SUPPORT],
  inputSchema: z.object({
    enrollmentId: z.string(),
  }),
  async handler({ enrollmentId }, ctx) {
    requireRole(ctx.user.role, [UserRole.ADMIN, UserRole.OPERATIONAL, UserRole.SUPPORT]);
    try {
      const enrollment = await prisma.mentorshipEnrollment.findUnique({
        where: { id: enrollmentId },
        include: {
          customer: true,
          currentPhase: true,
          sessions: {
            orderBy: { sessionDate: 'desc' },
            take: 1,
          },
          transitions: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
              fromPhase: { select: { key: true, label: true } },
              toPhase: { select: { key: true, label: true } },
            },
          },
        },
      });

      if (!enrollment) {
        return { error: `Matrícula "${enrollmentId}" não encontrada.` };
      }

      const openInvoicesCount = await prisma.invoice.count({
        where: {
          customerId: enrollment.customerId,
          status: { in: ['OPEN', 'OVERDUE'] as any[] },
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
      };
    } catch (err) {
      return { error: `Falha ao buscar perfil do aluno: ${(err as Error).message}` };
    }
  },
});
