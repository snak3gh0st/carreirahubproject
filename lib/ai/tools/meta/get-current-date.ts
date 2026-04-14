import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { defineAiTool, requireRole } from '../_base';

const ALL_ROLES = [
  UserRole.ADMIN, UserRole.SALES, UserRole.SDR, UserRole.FINANCE,
  UserRole.SUPPORT, UserRole.OPERATIONAL, UserRole.COMMERCIAL,
];

export const getCurrentDate = defineAiTool({
  name: 'getCurrentDate',
  description: 'Retorna a data e hora atual no fuso horário de Nova York (ET). Use quando o usuário perguntar que dia é hoje, que horas são, ou quando precisar de referência de data para qualquer cálculo.',
  allowedRoles: ALL_ROLES,
  inputSchema: z.object({}),
  async handler(_args, ctx) {
    requireRole(ctx.user.role, ALL_ROLES);
    const now = new Date();
    return {
      iso: now.toISOString(),
      formattedPtBR: Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/New_York',
        dateStyle: 'full',
        timeStyle: 'short',
      }).format(now),
      timezone: 'America/New_York',
    };
  },
});
