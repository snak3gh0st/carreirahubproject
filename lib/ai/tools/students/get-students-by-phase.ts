import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { defineAiTool, requireRole } from '../_base';
import { prisma } from '@/lib/db';
import { toStudentSafeDto } from '../../dto';

export const getStudentsByPhase = defineAiTool({
  name: 'getStudentsByPhase',
  description: 'Lista alunos ativos em uma fase específica do programa de mentoria. Use quando o usuário perguntar quais alunos estão em determinada fase, ou quantos alunos estão em cada etapa do programa.',
  allowedRoles: [UserRole.ADMIN, UserRole.OPERATIONAL, UserRole.SUPPORT],
  inputSchema: z.object({
    phaseKey: z.string(),
    limit: z.number().int().min(1).max(100).default(50),
  }),
  async handler({ phaseKey, limit }, ctx) {
    requireRole(ctx.user.role, [UserRole.ADMIN, UserRole.OPERATIONAL, UserRole.SUPPORT]);
    try {
      const enrollments = await prisma.mentorshipEnrollment.findMany({
        where: {
          status: 'ACTIVE',
          currentPhase: { key: phaseKey },
        },
        include: {
          customer: true,
          currentPhase: true,
        },
        take: limit,
      });

      const dtos = enrollments.map(e => toStudentSafeDto({
        id: e.id,
        customerId: e.customerId,
        customer: e.customer,
        programType: e.programType,
        status: e.status,
        currentPhase: e.currentPhase ?? undefined,
        assignedUserId: e.assignedToId,
      }));

      return { count: dtos.length, phaseKey, students: dtos };
    } catch (err) {
      return { error: `Falha ao buscar alunos por fase: ${(err as Error).message}` };
    }
  },
});
