import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { defineAiTool, requireRole } from '../_base';
import { docusignService } from '@/lib/services/docusign.service';
import { prisma } from '@/lib/db';

export const getDocumentStatus = defineAiTool({
  name: 'getDocumentStatus',
  description: 'Consulta o status ao vivo de um envelope no DocuSign. Use quando o usuário perguntar se um contrato foi assinado, se está pendente, ou quem ainda não assinou.',
  allowedRoles: [UserRole.ADMIN, UserRole.FINANCE],
  inputSchema: z.object({
    envelopeId: z.string().min(10),
  }),
  async handler({ envelopeId }, ctx) {
    requireRole(ctx.user.role, [UserRole.ADMIN, UserRole.FINANCE]);
    const started = Date.now();
    try {
      const status = await Promise.race([
        docusignService.getEnvelopeStatus(envelopeId),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DocuSign timeout 20s')), 20_000)
        ),
      ]);
      await prisma.integrationLog.create({
        data: {
          service: 'docusign',
          action: 'ai.envelope.status',
          status: 'SUCCESS',
          payload: { envelopeId } as never,
        },
      }).catch(() => {});
      return {
        envelopeId,
        ...(status as Record<string, unknown>),
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      const message = (err as Error).message;
      await prisma.integrationLog.create({
        data: {
          service: 'docusign',
          action: 'ai.envelope.status',
          status: 'ERROR',
          error: message,
          payload: { envelopeId } as never,
        },
      }).catch(() => {});
      return { error: `Falha ao consultar DocuSign: ${message}` };
    }
  },
});
