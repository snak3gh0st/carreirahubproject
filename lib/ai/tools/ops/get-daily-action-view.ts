import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { defineAiTool, requireRole } from '../_base';
import { prisma } from '@/lib/db';

const SLA_DAYS_PER_PHASE = 7;
const SLA_WARNING_DAYS = 2;

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

export const getDailyActionView = defineAiTool({
  name: 'getDailyActionView',
  description: 'Retorna a visão diária de ações agrupadas por urgência de SLA: atrasados, atenção e em dia. Use quando o usuário perguntar quais alunos precisam de atenção hoje ou quem está atrasado.',
  allowedRoles: [UserRole.ADMIN, UserRole.OPERATIONAL, UserRole.SUPPORT],
  inputSchema: z.object({
    assigneeId: z.string().optional(),
    limit: z.number().int().min(1).max(200).default(100),
  }),
  async handler({ assigneeId, limit }, ctx) {
    requireRole(ctx.user.role, [UserRole.ADMIN, UserRole.OPERATIONAL, UserRole.SUPPORT]);
    try {
      const where: Record<string, unknown> = { status: 'ACTIVE' };
      if (assigneeId) where.assignedToId = assigneeId;

      const enrollments = await prisma.mentorshipEnrollment.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          currentPhase: { select: { key: true, label: true, slaDays: true } },
          transitions: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
          sessions: { orderBy: { sessionDate: 'desc' }, take: 1, select: { sessionDate: true } },
        },
        take: limit,
      });

      const now = new Date();
      const overdue: unknown[] = [];
      const warning: unknown[] = [];
      const onTrack: unknown[] = [];

      for (const e of enrollments) {
        const lastTransition = e.transitions[0]?.createdAt ?? e.startDate;
        const phaseAgeDays = daysBetween(lastTransition, now);
        const phaseSlaDays = e.currentPhase?.slaDays ?? SLA_DAYS_PER_PHASE;
        const daysRemaining = phaseSlaDays - phaseAgeDays;

        const row = {
          enrollmentId: e.id,
          studentName: e.customer.name,
          customerId: e.customer.id,
          phaseLabel: e.currentPhase?.label ?? '—',
          daysRemaining,
          lastSessionAt: e.sessions[0]?.sessionDate.toISOString() ?? null,
        };

        if (daysRemaining < 0) {
          overdue.push(row);
        } else if (daysRemaining <= SLA_WARNING_DAYS) {
          warning.push(row);
        } else {
          onTrack.push(row);
        }
      }

      return {
        total: enrollments.length,
        buckets: {
          overdue: { count: (overdue as any[]).length, students: overdue },
          warning: { count: (warning as any[]).length, students: warning },
          onTrack: { count: (onTrack as any[]).length, students: onTrack },
        },
      };
    } catch (err) {
      return { error: `Falha ao buscar visão diária: ${(err as Error).message}` };
    }
  },
});
