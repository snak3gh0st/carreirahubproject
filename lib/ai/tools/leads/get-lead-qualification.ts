import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { defineAiTool, requireRole } from '../_base';
import { prisma } from '@/lib/db';
import { toLeadSafeDto } from '../../dto';

export const getLeadQualification = defineAiTool({
  name: 'getLeadQualification',
  description: 'Retorna os detalhes de qualificação de um lead específico, incluindo pontuação e critérios de avaliação. Use quando o usuário perguntar sobre a pontuação de um lead ou motivo de qualificação/desqualificação.',
  allowedRoles: [UserRole.ADMIN, UserRole.COMMERCIAL, UserRole.HEAD_COMERCIAL],
  inputSchema: z.object({
    leadId: z.string(),
  }),
  async handler({ leadId }, ctx) {
    requireRole(ctx.user.role, [UserRole.ADMIN, UserRole.COMMERCIAL, UserRole.HEAD_COMERCIAL]);
    try {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: {
          qualifications: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!lead) {
        return { error: `Lead "${leadId}" não encontrado.` };
      }

      const latestQual = lead.qualifications[0];
      const leadDto = toLeadSafeDto({
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        status: lead.status,
        source: lead.source,
        qualifications: lead.qualifications,
        createdAt: lead.createdAt,
        lastContactedAt: null,
      });

      const rubric = latestQual?.criteria
        ? (latestQual.criteria as Record<string, unknown>)
        : null;

      return {
        lead: leadDto,
        latestScore: latestQual?.score ?? null,
        qualifiedAt: latestQual?.createdAt.toISOString() ?? null,
        rubric,
      };
    } catch (err) {
      return { error: `Falha ao buscar qualificação do lead: ${(err as Error).message}` };
    }
  },
});
