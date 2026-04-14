export function buildPageContext(pathname: string, params: Record<string, string | string[] | undefined>): string {
  if (pathname === '/dashboard' || pathname === '/dashboard/') return 'Usuário está no dashboard principal';
  if (pathname.startsWith('/dashboard/students/') && params.id) return `Usuário está no perfil do aluno ${params.id}`;
  if (pathname.startsWith('/dashboard/students')) return 'Usuário está na lista de alunos';
  if (pathname.startsWith('/dashboard/invoices/') && params.id) return `Usuário está visualizando a fatura ${params.id}`;
  if (pathname.startsWith('/dashboard/invoices')) return 'Usuário está na listagem de faturas';
  if (pathname.startsWith('/dashboard/leads/') && params.id) return `Usuário está no lead ${params.id}`;
  if (pathname.startsWith('/dashboard/leads')) return 'Usuário está na listagem de leads';
  if (pathname.startsWith('/dashboard/financial')) return 'Usuário está no dashboard financeiro';
  if (pathname.startsWith('/dashboard/ai')) return 'Usuário está na página do AI Copilot';
  if (pathname.startsWith('/ops')) return 'Usuário está no Ops Hub';
  return `Usuário está em ${pathname}`;
}

export function currentDateInET(): string {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/New_York',
    dateStyle: 'full',
  });
  return `${fmt.format(now)} (${now.toISOString()})`;
}
