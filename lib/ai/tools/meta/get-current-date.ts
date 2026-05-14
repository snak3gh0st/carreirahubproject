import { z } from 'zod';
import { defineAiTool, requireRole } from '../_base';
import { ALL_AI_ROLES } from '../role-groups';

export const getCurrentDate = defineAiTool({
  name: 'getCurrentDate',
  description: 'Retorna a data e hora atual no fuso horário de Nova York (ET). Use quando o usuário perguntar que dia é hoje, que horas são, ou quando precisar de referência de data para qualquer cálculo.',
  allowedRoles: ALL_AI_ROLES,
  inputSchema: z.object({}),
  async handler(_args, ctx) {
    requireRole(ctx.user.role, ALL_AI_ROLES);
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
