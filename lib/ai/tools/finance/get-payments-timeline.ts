import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { defineAiTool, requireRole } from '../_base';
import { prisma } from '@/lib/db';

export const getPaymentsTimeline = defineAiTool({
  name: 'getPaymentsTimeline',
  description: 'Lista o histórico de pagamentos recebidos em ordem cronológica. Use quando o usuário perguntar sobre pagamentos realizados, fluxo de recebimentos ou histórico de transações.',
  allowedRoles: [UserRole.ADMIN, UserRole.FINANCE],
  inputSchema: z.object({
    customerId: z.string().cuid().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(50),
  }),
  async handler({ customerId, startDate, endDate, limit }, ctx) {
    requireRole(ctx.user.role, [UserRole.ADMIN, UserRole.FINANCE]);
    try {
      const where: Record<string, unknown> = {};
      if (customerId) where.customerId = customerId;
      if (startDate || endDate) {
        const dateFilter: Record<string, Date> = {};
        if (startDate) dateFilter.gte = new Date(startDate);
        if (endDate) dateFilter.lte = new Date(endDate);
        where.createdAt = dateFilter;
      }

      const payments = await prisma.payment.findMany({
        where,
        include: {
          invoice: { select: { id: true, invoiceNumber: true } },
          customer: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return {
        count: payments.length,
        totalAmount: payments.reduce((s, p) => s + Number(p.amount), 0),
        payments: payments.map(p => ({
          id: p.id,
          amount: Number(p.amount),
          currency: p.currency,
          paymentDate: p.paymentDate.toISOString(),
          paymentMethod: p.paymentMethod,
          invoiceId: p.invoiceId,
          invoiceNumber: p.invoice?.invoiceNumber ?? null,
          customerId: p.customerId,
          customerName: p.customer?.name ?? '(sem nome)',
          customerEmail: p.customer?.email ?? '',
          createdAt: p.createdAt.toISOString(),
        })),
      };
    } catch (err) {
      return { error: `Falha ao buscar histórico de pagamentos: ${(err as Error).message}` };
    }
  },
});
