import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { defineAiTool, requireRole } from '../_base';
import { prisma } from '@/lib/db';

export const getStudentSessions = defineAiTool({
  name: 'getStudentSessions',
  description: 'Lista as sessões de mentoria de um aluno em ordem cronológica inversa. Use quando o usuário perguntar sobre sessões realizadas, frequência de atendimento ou progresso nas sessões.',
  allowedRoles: [UserRole.ADMIN, UserRole.OPERATIONAL, UserRole.SUPPORT],
  inputSchema: z.object({
    enrollmentId: z.string(),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  async handler({ enrollmentId, limit }, ctx) {
    requireRole(ctx.user.role, [UserRole.ADMIN, UserRole.OPERATIONAL, UserRole.SUPPORT]);
    try {
      const sessions = await prisma.mentorshipSession.findMany({
        where: { enrollmentId },
        orderBy: { sessionDate: 'desc' },
        take: limit,
        include: {
          conductor: { select: { id: true, name: true } },
        },
      });

      return {
        count: sessions.length,
        enrollmentId,
        sessions: sessions.map(s => ({
          id: s.id,
          sessionType: s.sessionType,
          sessionDate: s.sessionDate.toISOString(),
          notes: s.notes,
          conductorName: s.conductor?.name ?? '(desconhecido)',
          createdAt: s.createdAt.toISOString(),
        })),
      };
    } catch (err) {
      return { error: `Falha ao buscar sessões do aluno: ${(err as Error).message}` };
    }
  },
});
