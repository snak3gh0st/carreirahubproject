import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { defineAiTool, requireRole } from '../_base';
import { prisma } from '@/lib/db';
import { toInvoiceSafeDto } from '../../dto';

export const getOverdueInvoices = defineAiTool({
  name: 'getOverdueInvoices',
  description: 'Lista faturas vencidas e não pagas. Use quando o usuário perguntar sobre inadimplência, atrasos, ou faturas em aberto.',
  allowedRoles: [UserRole.ADMIN, UserRole.FINANCE],
  inputSchema: z.object({
    minDaysOverdue: z.number().int().min(0).default(1),
    limit: z.number().int().min(1).max(100).default(50),
  }),
  async handler({ minDaysOverdue, limit }, ctx) {
    requireRole(ctx.user.role, [UserRole.ADMIN, UserRole.FINANCE]);
    try {
      const cutoff = new Date(Date.now() - (minDaysOverdue ?? 1) * 86_400_000);
      const invoices = await prisma.invoice.findMany({
        where: {
          status: { in: ['OPEN', 'OVERDUE'] as any[] },
          dueDate: { lt: cutoff },
        },
        include: { customer: { select: { id: true, name: true, email: true } } },
        orderBy: { dueDate: 'asc' },
        take: limit,
      });

      const dtos = invoices.map(inv => toInvoiceSafeDto(inv, 'hub'));
      return {
        count: dtos.length,
        totalAmount: dtos.reduce((s, i) => s + i.amount, 0),
        invoices: dtos,
      };
    } catch (err) {
      return { error: `Falha ao buscar faturas vencidas: ${(err as Error).message}` };
    }
  },
});
