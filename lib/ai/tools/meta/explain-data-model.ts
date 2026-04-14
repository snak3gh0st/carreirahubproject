import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { defineAiTool, requireRole } from '../_base';

const ALL_ROLES = [
  UserRole.ADMIN, UserRole.SALES, UserRole.SDR, UserRole.FINANCE,
  UserRole.SUPPORT, UserRole.OPERATIONAL, UserRole.COMMERCIAL,
];

const DATA_MODEL_DOCS: Record<string, string> = {
  leads: `
## Leads
- Um **Lead** é um prospecto que ainda não se tornou cliente.
- Possui status: NEW → QUALIFYING → QUALIFIED/UNQUALIFIED → CONVERTED/LOST.
- Ao ser convertido, gera um **Deal** (negócio ganho).
- Fonte (source): WEBSITE, WHATSAPP, REFERRAL, SOCIAL_MEDIA, OTHER, PIPEDRIVE.
- A pontuação de qualificação (0-100) é calculada via IA com critérios: interesse, orçamento, prazo, motivação e perfil.
`,
  students: `
## Students (Alunos)
- Um **MentorshipEnrollment** representa a matrícula de um cliente no programa.
- Está vinculado a um **Customer** (cliente) — não é uma entidade separada.
- Progride por **MentorshipPhase** (fases: ex. Bastão, A1, A2, B1, B2, C1, C2, Renovação).
- Cada transição de fase é registrada em **PhaseTransition** (auditoria completa).
- Sessões de mentoria são registradas em **MentorshipSession**.
`,
  invoices: `
## Invoices (Faturas)
- Uma **Invoice** pode ser criada internamente (hub) ou sincronizada do QuickBooks.
- Status: DRAFT → SENT → PAID/OVERDUE/VOID/PARTIALLY_PAID.
- Pagamentos são registrados em **Payment** e vinculados à fatura.
- Faturas vencidas têm status OVERDUE ou são filtradas por dueDate < hoje.
- Fonte de verdade financeira: QuickBooks (QB) para faturas emitidas oficialmente.
`,
  contracts: `
## Contracts (Contratos)
- Um **Contract** é gerado pelo DocuSign após um Deal ser fechado.
- Status: DRAFT → SENT_FOR_SIGNATURE → SIGNED/DECLINED/EXPIRED/VOIDED.
- O campo **docusign_env_id** é o ID do envelope no DocuSign.
- Contratos assinados têm **signedAt** preenchido.
`,
  deals: `
## Deals (Negócios)
- Um **Deal** representa um negócio fechado originado de um Lead convertido.
- Está vinculado a um **Customer** (cliente).
- Ao ser fechado (WON), gera Invoice e Contract automaticamente via webhook do Pipedrive.
- Status: OPEN, WON, LOST, HOLD.
`,
  general: `
## Modelo de Dados — Visão Geral

**Fluxo principal:** Lead → Deal → Customer → Invoice + Contract + MentorshipEnrollment

- **Lead**: prospecto pré-venda
- **Customer**: cliente (identidade única por email — Identity Mapper)
- **Deal**: negócio fechado (vincula Lead a Customer)
- **Invoice**: fatura (hub = interno, quickbooks = externo)
- **Contract**: contrato DocuSign
- **MentorshipEnrollment**: matrícula do aluno no programa

**Importante:** Este copiloto é SOMENTE LEITURA. Nenhuma escrita no banco.
**Fonte de verdade para finanças:** QuickBooks.
**Fonte de verdade para leads:** Pipedrive + banco local.
`,
};

export const explainDataModel = defineAiTool({
  name: 'explainDataModel',
  description: 'Explica o modelo de dados do sistema e as relações entre entidades. Use quando o usuário tiver dúvidas sobre como os dados estão estruturados, o que é um lead versus cliente, ou como as faturas se relacionam com contratos.',
  allowedRoles: ALL_ROLES,
  inputSchema: z.object({
    entity: z.enum(['leads', 'students', 'invoices', 'contracts', 'deals']).optional(),
  }),
  async handler({ entity }, ctx) {
    requireRole(ctx.user.role, ALL_ROLES);
    const doc = entity ? (DATA_MODEL_DOCS[entity] ?? DATA_MODEL_DOCS.general) : DATA_MODEL_DOCS.general;
    return { entity: entity ?? 'general', documentation: doc.trim() };
  },
});
