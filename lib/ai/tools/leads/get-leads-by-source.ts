import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { defineAiTool, requireRole } from '../_base';
import { prisma } from '@/lib/db';

export const getLeadsBySource = defineAiTool({
  name: 'getLeadsBySource',
  description: 'Agrupa leads por fonte de origem dentro de um período. Use quando o usuário perguntar sobre canais de aquisição, desempenho de campanhas ou ROI por canal.',
  allowedRoles: [UserRole.ADMIN, UserRole.COMMERCIAL],
  inputSchema: z.object({
    source: z.enum(['WEBSITE', 'WHATSAPP', 'REFERRAL', 'SOCIAL_MEDIA', 'OTHER', 'PIPEDRIVE']).optional(),
    days: z.number().int().min(1).max(365).default(30),
    limit: z.number().int().min(1).max(100).default(50),
  }),
  async handler({ source, days, limit }, ctx) {
    requireRole(ctx.user.role, [UserRole.ADMIN, UserRole.COMMERCIAL]);
    try {
      const since = new Date(Date.now() - (days ?? 30) * 86_400_000);
      const where: Record<string, unknown> = { createdAt: { gte: since } };
      if (source) where.source = source;

      const leads = await prisma.lead.findMany({
        where,
        select: { id: true, source: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      // Aggregate by source
      const counts: Record<string, number> = {};
      for (const l of leads) {
        counts[l.source] = (counts[l.source] ?? 0) + 1;
      }
      const bySource = Object.entries(counts)
        .map(([src, count]) => ({ source: src, count }))
        .sort((a, b) => b.count - a.count);

      return {
        period: `${days} dias`,
        totalLeads: leads.length,
        bySource,
        filterApplied: source ?? 'ALL',
      };
    } catch (err) {
      return { error: `Falha ao buscar leads por fonte: ${(err as Error).message}` };
    }
  },
});
