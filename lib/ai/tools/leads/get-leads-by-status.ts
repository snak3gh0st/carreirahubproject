import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { defineAiTool, requireRole } from '../_base';
import { prisma } from '@/lib/db';
import { toLeadSafeDto } from '../../dto';

export const getLeadsByStatus = defineAiTool({
  name: 'getLeadsByStatus',
  description: 'Lista leads filtrados por status. Use quando o usuário perguntar sobre leads novos, qualificados, convertidos ou perdidos, ou quiser ver o pipeline de prospecção.',
  allowedRoles: [UserRole.ADMIN, UserRole.SALES, UserRole.SDR],
  inputSchema: z.object({
    status: z.enum(['NEW', 'QUALIFYING', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED', 'LOST']).optional(),
    limit: z.number().int().min(1).max(100).default(50),
  }),
  async handler({ status, limit }, ctx) {
    requireRole(ctx.user.role, [UserRole.ADMIN, UserRole.SALES, UserRole.SDR]);
    try {
      const where: Record<string, unknown> = {};
      if (status) where.status = status;

      const leads = await prisma.lead.findMany({
        where,
        include: {
          qualifications: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      const dtos = leads.map(l => toLeadSafeDto({
        id: l.id,
        name: l.name,
        email: l.email,
        phone: l.phone,
        status: l.status,
        source: l.source,
        qualifications: l.qualifications,
        createdAt: l.createdAt,
        lastContactedAt: null,
      }));

      return { count: dtos.length, status: status ?? 'ALL', leads: dtos };
    } catch (err) {
      return { error: `Falha ao buscar leads: ${(err as Error).message}` };
    }
  },
});
