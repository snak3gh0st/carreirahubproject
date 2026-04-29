import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { defineAiTool, requireRole } from '../_base';
import { prisma } from '@/lib/db';
import { toStudentSafeDto } from '../../dto';

export const searchStudents = defineAiTool({
  name: 'searchStudents',
  description: 'Busca alunos matriculados por nome ou email (busca parcial, insensível a maiúsculas). Use quando o usuário quiser encontrar um aluno específico para ver seu perfil, sessões ou próximas ações.',
  allowedRoles: [UserRole.ADMIN, UserRole.OPERATIONAL],
  inputSchema: z.object({
    query: z.string().min(2),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  async handler({ query, limit }, ctx) {
    requireRole(ctx.user.role, [UserRole.ADMIN, UserRole.OPERATIONAL]);
    try {
      const enrollments = await prisma.mentorshipEnrollment.findMany({
        where: {
          customer: {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
            ],
          },
        },
        include: {
          customer: true,
          currentPhase: true,
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
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

      return { count: dtos.length, query, students: dtos };
    } catch (err) {
      return { error: `Falha ao buscar alunos: ${(err as Error).message}` };
    }
  },
});
