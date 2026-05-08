import { z } from 'zod';
import { InvoiceStatus, UserRole } from '@prisma/client';
import { defineAiTool, requireRole } from '../_base';
import { prisma } from '@/lib/db';
import { toInvoiceSafeDto } from '../../dto';
import { buildCustomerIdExclusionWhere } from '@/lib/financial/hub-exclusions';
import { getFinancialHubExcludedCustomerIds } from '@/lib/financial/hub-exclusions-db';

export const getInvoices = defineAiTool({
  name: 'getInvoices',
  description: 'Lista faturas do sistema. Use quando o usuário perguntar sobre faturas, cobranças, status de pagamento ou histórico financeiro de um cliente.',
  allowedRoles: [UserRole.ADMIN, UserRole.FINANCE],
  inputSchema: z.object({
    status: z.nativeEnum(InvoiceStatus).optional(),
    customerId: z.string().cuid().optional(),
    limit: z.number().int().min(1).max(100).default(50),
  }),
  async handler({ status, customerId, limit }, ctx) {
    requireRole(ctx.user.role, [UserRole.ADMIN, UserRole.FINANCE]);
    try {
      const excludedCustomerIds = customerId ? [] : await getFinancialHubExcludedCustomerIds();
      const where: Record<string, unknown> = {};
      Object.assign(where, buildCustomerIdExclusionWhere(excludedCustomerIds));
      if (status) where.status = status;
      if (customerId) where.customerId = customerId;

      const invoices = await prisma.invoice.findMany({
        where,
        include: { customer: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      const dtos = invoices.map(inv => toInvoiceSafeDto(inv, 'hub'));
      const totalAmount = dtos.reduce((s, i) => s + i.amount, 0);

      return { count: dtos.length, totalAmount, invoices: dtos };
    } catch (err) {
      return { error: `Falha ao buscar faturas: ${(err as Error).message}` };
    }
  },
});
