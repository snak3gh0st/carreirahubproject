import { z } from 'zod';
import { defineAiTool, requireRole } from '../_base';
import { toolRegistry } from '../index';
import { ALL_AI_ROLES } from '../role-groups';

export const listCapabilities = defineAiTool({
  name: 'listCapabilities',
  description: 'Lista todas as ferramentas disponíveis para o seu perfil de acesso. Use quando o usuário perguntar o que o copiloto pode fazer, quais dados pode consultar, ou como pode ajudar.',
  allowedRoles: ALL_AI_ROLES,
  inputSchema: z.object({}),
  async handler(_args, ctx) {
    requireRole(ctx.user.role, ALL_AI_ROLES);
    const available = toolRegistry
      .filter(t => t.allowedRoles.includes(ctx.user.role))
      .map(t => ({ name: t.name, description: t.description }));

    return {
      count: available.length,
      role: ctx.user.role,
      tools: available,
    };
  },
});
