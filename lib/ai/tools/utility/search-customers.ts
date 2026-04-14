import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { defineAiTool, requireRole } from '../_base';
import { prisma } from '@/lib/db';
import { toCustomerSafeDto } from '../../dto';

export const searchCustomers = defineAiTool({
  name: 'searchCustomers',
  description: 'Busca clientes por nome ou email (busca parcial, insensível a maiúsculas). Use quando o usuário quiser encontrar um cliente específico para ver faturas, contratos ou histórico.',
  allowedRoles: [UserRole.ADMIN, UserRole.SALES, UserRole.FINANCE],
  inputSchema: z.object({
    query: z.string().min(2),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  async handler({ query, limit }, ctx) {
    requireRole(ctx.user.role, [UserRole.ADMIN, UserRole.SALES, UserRole.FINANCE]);
    try {
      const customers = await prisma.customer.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: { name: 'asc' },
      });

      const dtos = customers.map(c => toCustomerSafeDto(c));
      return { count: dtos.length, query, customers: dtos };
    } catch (err) {
      return { error: `Falha ao buscar clientes: ${(err as Error).message}` };
    }
  },
});
