export type AiHubKey = "FINANCIAL" | "COMMERCIAL" | "OPERATIONAL" | "ADMIN_EXECUTIVE";

export type AiHubSlug = "financial" | "commercial" | "operational" | "admin";

export type AiRole =
  | "ADMIN"
  | "FINANCE"
  | "OPERATIONAL"
  | "COMMERCIAL";

export type AiHubDefinition = Readonly<{
  key: AiHubKey;
  slug: AiHubSlug;
  routePath: string;
  label: string;
  focus: string;
  starterPrompts: readonly string[];
}>;

export const AI_HUBS: Readonly<Record<AiHubKey, AiHubDefinition>> = {
  FINANCIAL: {
    key: "FINANCIAL",
    slug: "financial",
    routePath: "/dashboard/financial/ai",
    label: "Financeiro AI",
    focus: "saúde financeira, fluxo de caixa, recebimentos, inadimplência e impacto em receita",
    starterPrompts: [
      "Quais faturas estão vencidas hoje?",
      "Qual foi o recebimento do mês atual?",
      "Mostre o P&L do trimestre.",
    ],
  },
  COMMERCIAL: {
    key: "COMMERCIAL",
    slug: "commercial",
    routePath: "/dashboard/commercial/ai",
    label: "Comercial AI",
    focus: "pipeline comercial, leads, conversão, origem de demanda e próximos passos de vendas",
    starterPrompts: [
      "Liste leads qualificados das últimas 48h.",
      "Quais leads vieram de Meta nesta semana?",
      "Mostre a conversão por fonte nos últimos 30 dias.",
    ],
  },
  OPERATIONAL: {
    key: "OPERATIONAL",
    slug: "operational",
    routePath: "/dashboard/operational/ai",
    label: "Operacional AI",
    focus: "execução da mentoria: aluno por fase, SLA, checklist, sessões, formulários, débitos, NPS e próximo follow-up do time",
    starterPrompts: [
      "Quais alunos precisam de ação operacional hoje?",
      "Mostre os gargalos por fase e SLA.",
      "Quais alunos não têm sessão recente ou checklist avançando?",
    ],
  },
  ADMIN_EXECUTIVE: {
    key: "ADMIN_EXECUTIVE",
    slug: "admin",
    routePath: "/dashboard/admin/ai",
    label: "Admin AI",
    focus: "visão executiva, prioridades do CEO e decisões estratégicas entre áreas",
    starterPrompts: [
      "Mostre um resumo executivo das operações.",
      "Quais áreas estão com maior volume de pendências?",
      "Quais alertas precisam de atenção hoje?",
    ],
  },
} as const;

export const ROLE_TO_HUB: Readonly<Record<AiRole, AiHubSlug>> = {
  ADMIN: "admin",
  FINANCE: "financial",
  OPERATIONAL: "operational",
  COMMERCIAL: "commercial",
} as const;

export const ROLE_TO_ROUTE: Readonly<Record<AiRole, string>> = {
  ADMIN: AI_HUBS.ADMIN_EXECUTIVE.routePath,
  FINANCE: AI_HUBS.FINANCIAL.routePath,
  OPERATIONAL: AI_HUBS.OPERATIONAL.routePath,
  COMMERCIAL: AI_HUBS.COMMERCIAL.routePath,
} as const;

const AI_HUBS_BY_SLUG: Readonly<Record<AiHubSlug, AiHubDefinition>> = {
  financial: AI_HUBS.FINANCIAL,
  commercial: AI_HUBS.COMMERCIAL,
  operational: AI_HUBS.OPERATIONAL,
  admin: AI_HUBS.ADMIN_EXECUTIVE,
} as const;

function hasOwn<K extends PropertyKey>(object: object, key: K): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isAiRole(role: string): role is AiRole {
  return hasOwn(ROLE_TO_HUB, role);
}

export function getAiHubForRole(role: string): AiHubDefinition | null {
  if (!isAiRole(role)) {
    return null;
  }

  return AI_HUBS_BY_SLUG[ROLE_TO_HUB[role]];
}

export function getAiRouteForRole(role: string): string | null {
  if (!isAiRole(role)) {
    return null;
  }

  return AI_HUBS_BY_SLUG[ROLE_TO_HUB[role]].routePath;
}

export function getAiHubBySlug(slug: string): AiHubDefinition | null {
  if (!hasOwn(AI_HUBS_BY_SLUG, slug)) {
    return null;
  }

  return AI_HUBS_BY_SLUG[slug as AiHubSlug];
}

export function getAiHubKeyBySlug(slug: string): AiHubKey | null {
  return getAiHubBySlug(slug)?.key ?? null;
}

export function isRoleAllowedForHub(role: string, hubSlug: string): boolean {
  if (role === "ADMIN") {
    return Boolean(getAiHubBySlug(hubSlug));
  }
  return getAiHubForRole(role)?.slug === hubSlug;
}
