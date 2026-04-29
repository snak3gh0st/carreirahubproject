import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { defineAiTool, requireRole } from '../_base';
import { prisma } from '@/lib/db';

const SLA_DAYS_PER_PHASE = 7;

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

export const getStudentNextActions = defineAiTool({
  name: 'getStudentNextActions',
  description: 'Calcula as próximas ações recomendadas para um aluno com base no SLA da fase atual. Use quando o usuário perguntar o que deve ser feito a seguir para um aluno específico.',
  allowedRoles: [UserRole.ADMIN, UserRole.OPERATIONAL],
  inputSchema: z.object({
    enrollmentId: z.string(),
  }),
  async handler({ enrollmentId }, ctx) {
    requireRole(ctx.user.role, [UserRole.ADMIN, UserRole.OPERATIONAL]);
    try {
      const enrollment = await prisma.mentorshipEnrollment.findUnique({
        where: { id: enrollmentId },
        include: {
          currentPhase: { select: { key: true, label: true, slaDays: true } },
          transitions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true },
          },
          sessions: {
            orderBy: { sessionDate: 'desc' },
            take: 1,
            select: { sessionDate: true },
          },
        },
      });

      if (!enrollment) {
        return { error: `Matrícula "${enrollmentId}" não encontrada.` };
      }

      const now = new Date();
      const lastTransitionAt = enrollment.transitions[0]?.createdAt ?? enrollment.startDate;
      const daysSinceLastTransition = daysBetween(lastTransitionAt, now);
      const phaseSlaDays = enrollment.currentPhase?.slaDays ?? SLA_DAYS_PER_PHASE;
      const daysRemainingInPhase = phaseSlaDays - daysSinceLastTransition;
      const overdue = daysRemainingInPhase < 0;

      const lastSessionAt = enrollment.sessions[0]?.sessionDate;
      const daysSinceLastSession = lastSessionAt ? daysBetween(lastSessionAt, now) : null;

      let suggestedNextAction: string;
      if (overdue) {
        suggestedNextAction = `Fase atrasada em ${Math.abs(daysRemainingInPhase)} dia(s). Agende uma sessão de avaliação e considere avançar a fase.`;
      } else if (daysRemainingInPhase <= 2) {
        suggestedNextAction = `SLA expira em ${daysRemainingInPhase} dia(s). Agende uma sessão de encerramento e prepare a próxima fase.`;
      } else if (daysSinceLastSession !== null && daysSinceLastSession >= 7) {
        suggestedNextAction = `Nenhuma sessão nos últimos ${daysSinceLastSession} dia(s). Contate o aluno para agendar a próxima sessão.`;
      } else {
        suggestedNextAction = `Aluno em dia. Próxima ação: manter acompanhamento regular e registrar progresso na sessão.`;
      }

      return {
        enrollmentId,
        currentPhaseKey: enrollment.currentPhase?.key ?? null,
        currentPhaseLabel: enrollment.currentPhase?.label ?? null,
        overdue,
        daysSinceLastTransition,
        daysRemainingInPhase,
        daysSinceLastSession,
        suggestedNextAction,
      };
    } catch (err) {
      return { error: `Falha ao calcular próximas ações: ${(err as Error).message}` };
    }
  },
});
