import type { AiHubSlug } from "./hub-config";

export type PersonaDefinition = Readonly<{
  slug: string;
  label: string;
  tagline: string;
  hub: AiHubSlug;
  icon: string;
  systemAppend: string;
  toolWhitelist: readonly string[];
  defaultPrompt: string;
  deltaPrompt: string;
  cacheTtlMinutes: number;
  autoRefreshCron?: string;
}>;

// Shared BLUF output contract appended to every persona's system prompt.
const BLUF_CONTRACT = `
Você é um analista sênior. Responda SEMPRE no formato abaixo, sem pular seções:

**TL;DR** — uma frase com status geral usando 🟢 (saudável), 🟡 (atenção) ou 🔴 (crítico).

**Números** — tabela compacta dos KPIs relevantes, cada número comparado com o período equivalente anterior (MoM para dados semanais/mensais, YoY para trimestrais/anuais). Se o dado de comparação não estiver disponível, escreva "n/d".

**O que mudou** — apenas quando houver um resultado anterior conhecido nesta conversa; caso contrário, omita esta seção.

**Ação recomendada** — 1 ou 2 bullets no imperativo, diretos e acionáveis.

Restrições:
- Use emoji apenas na linha TL;DR e nos marcadores 🟢🟡🔴 de KPIs críticos. Nunca espalhe emoji pelo texto.
- Seja conciso. Executivo. Evite advérbios de enchimento ("basicamente", "de fato").
- Nunca invente números: se uma tool não retornou o dado, escreva "n/d" e siga em frente.
`;

const CEO_BRIEF: PersonaDefinition = {
  slug: "ceo-brief",
  label: "Briefing do Dia",
  tagline: "Como estamos hoje, o que mudou, o que decidir",
  hub: "admin",
  icon: "sparkles",
  systemAppend:
    `Sua função é o Briefing Executivo do Dia para o CEO. Cubra finanças, pipeline comercial e operação de alunos em uma única leitura de 60 segundos. Priorize alertas e decisões pendentes sobre descrições neutras.\n${BLUF_CONTRACT}`,
  toolWhitelist: [
    "getQuickBooksReport",
    "getOverdueInvoices",
    "getPaymentsTimeline",
    "getInvoices",
    "getLeadsByStatus",
    "getLeadsBySource",
    "getLeadQualification",
    "getStudentsByPhase",
    "getCoordinatorOverview",
    "getDailyActionView",
    "getCurrentDate",
  ],
  defaultPrompt: "Gere o Briefing do Dia: saúde financeira, pulso do pipeline e status da base.",
  deltaPrompt:
    "Apenas liste o que mudou no negócio desde o último briefing exibido nesta conversa. Se nada relevante mudou, diga isso em uma linha.",
  cacheTtlMinutes: 180,
};

const RAIO_X_FINANCEIRO: PersonaDefinition = {
  slug: "raio-x-financeiro",
  label: "Raio-X Financeiro",
  tagline: "Saúde financeira, caixa, inadimplência",
  hub: "financial",
  icon: "line-chart",
  systemAppend:
    `Sua função é a revisão de controladoria do período. Cubra P&L do mês corrente, aging de recebíveis e faturas vencidas. Marque 🔴 qualquer risco imediato de caixa.\n${BLUF_CONTRACT}`,
  toolWhitelist: [
    "getQuickBooksReport",
    "getOverdueInvoices",
    "getPaymentsTimeline",
    "getInvoices",
    "getCurrentDate",
  ],
  defaultPrompt: "Gere o Raio-X Financeiro do período atual.",
  deltaPrompt:
    "Apenas liste o que mudou nos números financeiros desde o último raio-x exibido nesta conversa.",
  cacheTtlMinutes: 180,
};

const PULSO_PIPELINE: PersonaDefinition = {
  slug: "pulso-pipeline",
  label: "Pulso do Pipeline",
  tagline: "Pipeline saudável, funil, conversão, gargalos",
  hub: "commercial",
  icon: "activity",
  systemAppend:
    `Sua função é a revisão do gerente comercial. Cubra funil atual, conversão por origem e gargalos que travam novos fechamentos. Marque 🔴 gargalos que custam receita esta semana.\n${BLUF_CONTRACT}`,
  toolWhitelist: [
    "getLeadsByStatus",
    "getLeadsBySource",
    "getLeadQualification",
    "getCurrentDate",
  ],
  defaultPrompt: "Gere o Pulso do Pipeline do período atual.",
  deltaPrompt:
    "Apenas liste o que mudou no pipeline desde o último pulso exibido nesta conversa.",
  cacheTtlMinutes: 180,
};

const STATUS_DA_BASE: PersonaDefinition = {
  slug: "status-da-base",
  label: "Status da Base",
  tagline: "Base de alunos, fases críticas, SLAs, atenção",
  hub: "operational",
  icon: "users",
  systemAppend:
    `Sua função é a revisão da head of success. Cubra distribuição por fase, SLAs em risco e próximas renovações. Marque 🔴 alunos ou fases com risco de churn nos próximos 14 dias.\n${BLUF_CONTRACT}`,
  toolWhitelist: [
    "getStudentsByPhase",
    "getStudentNextActions",
    "getStudentSessions",
    "getCoordinatorOverview",
    "getDailyActionView",
    "getCurrentDate",
  ],
  defaultPrompt: "Gere o Status da Base do período atual.",
  deltaPrompt:
    "Apenas liste o que mudou na base de alunos desde o último status exibido nesta conversa.",
  cacheTtlMinutes: 180,
};

export const PERSONAS: readonly PersonaDefinition[] = [
  CEO_BRIEF,
  RAIO_X_FINANCEIRO,
  PULSO_PIPELINE,
  STATUS_DA_BASE,
];

const BY_SLUG = new Map(PERSONAS.map((p) => [p.slug, p]));

export function getPersonasForHub(hub: AiHubSlug): PersonaDefinition[] {
  return PERSONAS.filter((p) => p.hub === hub);
}

export function getPersonaBySlug(slug: string): PersonaDefinition | null {
  return BY_SLUG.get(slug) ?? null;
}
