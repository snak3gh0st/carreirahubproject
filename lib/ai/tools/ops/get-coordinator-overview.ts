import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { defineAiTool, requireRole } from '../_base';
import { prisma } from '@/lib/db';

export const getCoordinatorOverview = defineAiTool({
  name: 'getCoordinatorOverview',
  description: 'Retorna uma visão geral do coordenador: total de alunos ativos, distribuição por fase e por status, e contagem de atrasados. Use quando o usuário quiser um resumo executivo do programa de mentoria.',
  allowedRoles: [UserRole.ADMIN, UserRole.OPERATIONAL],
  inputSchema: z.object({}),
  async handler(_args, ctx) {
    requireRole(ctx.user.role, [UserRole.ADMIN, UserRole.OPERATIONAL]);
    try {
      const [totalActive, byStatus, byPhaseRaw, overdueCount] = await Promise.all([
        prisma.mentorshipEnrollment.count({ where: { status: 'ACTIVE' } }),
        prisma.mentorshipEnrollment.groupBy({
          by: ['status'],
          _count: { id: true },
        }),
        prisma.mentorshipEnrollment.findMany({
          where: { status: 'ACTIVE' },
          include: { currentPhase: { select: { key: true, label: true } } },
        }),
        prisma.mentorshipEnrollment.count({
          where: {
            status: 'ACTIVE',
            transitions: {
              none: { createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
            },
          },
        }),
      ]);

      // Aggregate by phase in memory
      const phaseCounts: Record<string, { key: string; label: string; count: number }> = {};
      for (const e of byPhaseRaw) {
        const key = e.currentPhase?.key ?? '(sem fase)';
        const label = e.currentPhase?.label ?? '—';
        if (!phaseCounts[key]) phaseCounts[key] = { key, label, count: 0 };
        phaseCounts[key].count++;
      }
      const byPhase = Object.values(phaseCounts).sort((a, b) => b.count - a.count);

      return {
        totals: { active: totalActive, overdueActionItems: overdueCount },
        byPhase,
        byStatus: byStatus.map(s => ({ status: s.status, count: s._count.id })),
      };
    } catch (err) {
      return { error: `Falha ao buscar visão geral do coordenador: ${(err as Error).message}` };
    }
  },
});
