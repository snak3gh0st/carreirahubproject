import { getAiHubBySlug, getAiHubForRole } from '@/lib/ai/hub-config';

export function getSuggestionsForRole(role: string, hubSlug?: string): string[] {
  const hub = hubSlug ? getAiHubBySlug(hubSlug) : getAiHubForRole(role);
  if (hub) {
    return [...hub.starterPrompts];
  }

  switch (role) {
    case 'ADMIN':
      return [
        'Quais faturas estão vencidas hoje?',
        'Quantos alunos estão em cada fase agora?',
        'Quais leads qualificados ainda não foram contatados?',
        'Mostre o faturamento do mês atual',
      ];
    case 'FINANCE':
      return [
        'Quais faturas estão vencidas há mais de 15 dias?',
        'Qual foi o recebimento do mês?',
        'Liste contratos pendentes de assinatura',
        'Mostre o P&L do QuickBooks deste trimestre',
      ];
    case 'COMMERCIAL':
      return [
        'Liste leads qualificados das últimas 48h',
        'Quais leads vieram de Meta esta semana?',
        'Mostre a conversão por fonte nos últimos 30 dias',
        'Busque o lead de nome "Silva"',
      ];
    case 'HEAD_COMERCIAL':
      return [
        'Compare a performance dos vendedores nos últimos 30 dias',
        'Quais oportunidades abertas estão paradas há mais de 14 dias?',
        'Mostre a conversão por vendedor e por fonte',
        'Quais clientes precisam de ação comercial hoje?',
      ];
    case 'OPERATIONAL':
      return [
        'Quais alunos estão na fase 3?',
        'Mostre o daily action view',
        'Quais alunos estão atrasados na sua fase atual?',
        'Visão geral do coordenador',
      ];
    default:
      return [
        'O que você pode fazer?',
        'Qual é a data de hoje?',
        'Explique o modelo de dados',
      ];
  }
}
