import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { defineAiTool, requireRole } from '../_base';
import { OPS_WORKFLOW_DEFINITIONS } from '@/lib/ops/workflow';

const ALL_ROLES = [
  UserRole.ADMIN, UserRole.FINANCE, UserRole.OPERATIONAL, UserRole.COMMERCIAL, UserRole.HEAD_COMERCIAL,
];

const PROGRAM_CONTEXT =
  'Carreira USA oferece os programas PASS e ADVANCED — mentoria de colocação profissional ' +
  '(currículo, LinkedIn, entrevistas) para brasileiros buscando emprego ou recolocação no mercado americano.';

export const getProcessGuide = defineAiTool({
  name: 'getProcessGuide',
  description:
    'Explica o processo operacional da mentoria Carreira USA: as 11 fases do programa (Bastão → Renovação), ' +
    'o que acontece em cada uma, responsáveis, checklist e próximas ações. ' +
    'Use quando o usuário perguntar sobre processos, fases, o que acontece em "Bússola"/"Raio X"/etc, ' +
    'ou quem é responsável por qual etapa.',
  allowedRoles: ALL_ROLES,
  inputSchema: z.object({
    phase: z
      .enum([
        'bastao',
        'cadastro',
        'teste_de_ingles',
        'onboarding',
        'board',
        'bussola',
        'raio_x',
        'material',
        'devolutiva',
        'ongoing',
        'renovacao',
      ])
      .optional()
      .describe(
        'Key da fase. Se omitido, retorna visão geral de todas as 11 fases.'
      ),
  }),
  async handler({ phase }, ctx) {
    requireRole(ctx.user.role, ALL_ROLES);

    if (phase) {
      const found = OPS_WORKFLOW_DEFINITIONS.find((d) => d.key === phase);
      if (!found) {
        return {
          scope: 'phase' as const,
          programContext: PROGRAM_CONTEXT,
          error: `Fase "${phase}" não encontrada. Fases válidas: ${OPS_WORKFLOW_DEFINITIONS.map((d) => d.key).join(', ')}.`,
        };
      }
      return {
        scope: 'phase' as const,
        programContext: PROGRAM_CONTEXT,
        phase: found,
      };
    }

    // Overview: return summary of all 11 phases
    const phases = OPS_WORKFLOW_DEFINITIONS.map((d) => ({
      key: d.key,
      label: d.label,
      shortLabel: d.shortLabel,
      description: d.description,
      primaryOwner: d.primaryOwner,
    }));

    return {
      scope: 'overview' as const,
      programContext: PROGRAM_CONTEXT,
      totalPhases: phases.length,
      phases,
    };
  },
});
