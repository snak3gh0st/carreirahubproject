import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { defineAiTool, requireRole } from '../_base';
import { prisma } from '@/lib/db';
import { toContractSafeDto } from '../../dto';

export const getContracts = defineAiTool({
  name: 'getContracts',
  description: 'Lista contratos por status ou cliente. Use quando o usuário perguntar sobre contratos pendentes de assinatura, contratos assinados ou status contratual de um cliente.',
  allowedRoles: [UserRole.ADMIN, UserRole.FINANCE],
  inputSchema: z.object({
    status: z.enum(['DRAFT', 'SENT_FOR_SIGNATURE', 'SIGNED', 'DECLINED', 'EXPIRED', 'VIEWED', 'VOIDED']).optional(),
    customerId: z.string().cuid().optional(),
    limit: z.number().int().min(1).max(100).default(50),
  }),
  async handler({ status, customerId, limit }, ctx) {
    requireRole(ctx.user.role, [UserRole.ADMIN, UserRole.FINANCE]);
    try {
      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (customerId) where.customerId = customerId;

      const contracts = await prisma.contract.findMany({
        where,
        include: { customer: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      const dtos = contracts.map(c => toContractSafeDto({
        id: c.id,
        customerId: c.customerId,
        customer: { name: c.customer.name },
        status: c.status,
        docusign_envelope_id: c.docusign_env_id,
        signedAt: c.signedAt,
        createdAt: c.createdAt,
      }));

      return { count: dtos.length, contracts: dtos };
    } catch (err) {
      return { error: `Falha ao buscar contratos: ${(err as Error).message}` };
    }
  },
});
