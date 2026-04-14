export const OPS_SESSION_TYPES = [
  "passagem_de_bastao",
  "teste_de_ingles",
  "onboarding",
  "bussola",
  "raio_x",
  "devolutiva",
  "treinamento_de_entrevista",
  "mock_interview",
  "check_in",
  "renovacao",
  "outro",
] as const;

export type OpsSessionType = (typeof OPS_SESSION_TYPES)[number];

export const OPS_SESSION_TYPE_LABELS: Record<OpsSessionType, string> = {
  passagem_de_bastao: "Passagem de Bastão",
  teste_de_ingles: "Teste de Inglês",
  onboarding: "Onboarding",
  bussola: "Bússola",
  raio_x: "Raio X",
  devolutiva: "Devolutiva",
  treinamento_de_entrevista: "Treinamento de Entrevista",
  mock_interview: "Mock Interview",
  check_in: "Check-in",
  renovacao: "Renovação",
  outro: "Outro",
};

export type WorkflowStepStatus = "completed" | "current" | "upcoming";
export type OpsAlertLevel = "info" | "warning" | "error";

export interface OpsWorkflowDefinition {
  key: string;
  label: string;
  shortLabel: string;
  description: string;
  primaryOwner: string;
  supportOwner: string;
  clickupFocus: string;
  checklist: string[];
  nextActions: string[];
  requiredRecords: string[];
  communication: string[];
  automations: string[];
  slackChannels: Array<{
    name: string;
    purpose: string;
  }>;
}

interface DeriveWorkflowInput {
  enrollment: {
    status: string;
    startDate: Date;
    endDate: Date | null;
    currentPhase: {
      key: string;
      label: string;
      sortOrder: number;
      slaDays: number;
    } | null;
    transitions: Array<{
      createdAt: Date;
      toPhase: {
        key: string;
        label: string;
        sortOrder: number;
      };
    }>;
    sessions: Array<{
      sessionType: string;
      sessionDate: Date;
    }>;
    customer: {
      qbBalance?:
        | number
        | string
        | {
            toNumber?: () => number;
            toString?: () => string;
          }
        | null;
    };
  };
  placementTest: {
    cefrLevel: string;
    displayLevel: string;
    percentage: number;
    createdAt: Date;
  } | null;
}

export interface OpsWorkflowAlert {
  level: OpsAlertLevel;
  title: string;
  description: string;
}

export interface OpsWorkflowStep {
  key: string;
  label: string;
  shortLabel: string;
  status: WorkflowStepStatus;
  owner: string;
  supportOwner: string;
}

export interface OpsCurrentPlaybook {
  key: string;
  label: string;
  description: string;
  primaryOwner: string;
  supportOwner: string;
  clickupFocus: string;
  checklist: string[];
  nextActions: string[];
  requiredRecords: string[];
  communication: string[];
  automations: string[];
  slackChannels: Array<{
    name: string;
    purpose: string;
  }>;
  blockers: string[];
}

export interface DerivedOpsWorkflowState {
  currentPhaseKey: string | null;
  phaseAgeDays: number | null;
  slaDays: number | null;
  daysRemaining: number | null;
  isOverdue: boolean;
  alerts: OpsWorkflowAlert[];
  steps: OpsWorkflowStep[];
  currentPlaybook: OpsCurrentPlaybook | null;
}

function daysBetween(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000);
}

function hasSessionType(
  sessions: DeriveWorkflowInput["enrollment"]["sessions"],
  sessionType: OpsSessionType
) {
  return sessions.some((session) => session.sessionType === sessionType);
}

const COMMON_REQUIRED_RECORDS = [
  "Atualizar o status oficial do aluno no ClickUp.",
  "Registrar data da etapa e quem executou a ação.",
  "Deixar observações críticas no histórico do aluno.",
];

const WORKFLOW_DEFINITIONS: OpsWorkflowDefinition[] = [
  {
    key: "bastao",
    label: "Passagem de Bastão",
    shortLabel: "Bastão",
    description:
      "Entrada oficial do aluno na operação após venda do comercial, com repasse dos dados obrigatórios e contrato.",
    primaryOwner: "Fraenzi / Suporte",
    supportOwner: "Time Comercial",
    clickupFocus: "Criar o aluno no CRM operacional e iniciar o atendimento.",
    checklist: [
      "Receber no Slack a passagem de bastão com dados completos do aluno.",
      "Cadastrar o aluno no ClickUp dentro do CRM do produto correto.",
      "Garantir que contrato e dados-base estejam anexados.",
    ],
    nextActions: [
      "Liberar acessos iniciais e preparar comunicação de boas-vindas.",
      "Mover o aluno para a fase de cadastro e marcar teste.",
    ],
    requiredRecords: [
      "Nome completo, e-mail, telefone, data de nascimento, endereço completo e contrato.",
      ...COMMON_REQUIRED_RECORDS,
    ],
    communication: [
      "Mensagem inicial no Digsac.",
      "E-mail de boas-vindas com manual do cliente e próximos passos.",
    ],
    automations: [
      "Criar o aluno automaticamente a partir da passagem de bastão.",
      "Disparar e-mail de boas-vindas automaticamente.",
    ],
    slackChannels: [
      {
        name: "Passagem de Bastão",
        purpose: "Receber dados do comercial e iniciar o cadastro.",
      },
    ],

  },
  {
    key: "cadastro",
    label: "Cadastro e Acessos",
    shortLabel: "Cadastro",
    description:
      "Preparar o aluno para o início da mentoria com acessos, mensagem inicial e acionamento do teste de inglês.",
    primaryOwner: "Fraenzi / Suporte",
    supportOwner: "Dária",
    clickupFocus: "Status do aluno pronto para marcar teste.",
    checklist: [
      "Liberar acesso na plataforma de vídeos.",
      "Enviar mensagem inicial com manual do cliente.",
      "Solicitar disponibilidade para teste de inglês.",
    ],
    nextActions: [
      "Colocar o status do aluno como marcar teste.",
      "Aguardar disponibilidade do aluno para o teste.",
    ],
    requiredRecords: [
      "Registrar que a plataforma foi liberada.",
      "Registrar data da mensagem inicial.",
      ...COMMON_REQUIRED_RECORDS,
    ],
    communication: [
      "WhatsApp ou Digsac com boas-vindas e manual do cliente.",
      "E-mail inicial reforçando o passo a passo do teste.",
    ],
    automations: [
      "Registrar envio da mensagem inicial automaticamente.",
      "Criar tarefa automática para follow-up de teste.",
    ],
    slackChannels: [],

  },
  {
    key: "teste_de_ingles",
    label: "Teste de Inglês",
    shortLabel: "Teste",
    description:
      "Agendar, registrar e concluir o teste de inglês, incluindo retorno operacional para aprovado ou reprovado.",
    primaryOwner: "Dária / Suporte",
    supportOwner: "Mônica / Leka",
    clickupFocus: "Marcou o teste, passou ou não passou no teste.",
    checklist: [
      "Conferir agenda da Mônica ou da Leka.",
      "Criar invite do teste com data, horário e responsável.",
      "Avisar no Slack o canal obrigatório do teste.",
      "Registrar no sistema se passou ou não passou.",
    ],
    nextActions: [
      "Se passou, seguir para onboarding.",
      "Se não passou, informar o comercial e encerrar o fluxo da mentoria.",
    ],
    requiredRecords: [
      "Data do teste.",
      "Quem aplicou o teste.",
      "Resultado registrado de forma explícita.",
      ...COMMON_REQUIRED_RECORDS,
    ],
    communication: [
      "WhatsApp com confirmação de horário do teste.",
      "Invite com instruções da sessão.",
    ],
    automations: [
      "Gerar invite automaticamente a partir da agenda.",
      "Lembrar a sessão no dia via WhatsApp.",
    ],
    slackChannels: [
      {
        name: "english-test",
        purpose: "Registrar agendamento e obter feedback do teste.",
      },
    ],

  },
  {
    key: "onboarding",
    label: "Onboarding",
    shortLabel: "Onboarding",
    description:
      "Transição do aluno aprovado no teste para a mentoria ativa, com envio de instruções e coleta de links do board e do Notion.",
    primaryOwner: "Dária",
    supportOwner: "Fraenzi",
    clickupFocus: "Onboarding marcado e concluído.",
    checklist: [
      "Parabenizar o aluno pela aprovação no teste.",
      "Pedir agenda e marcar onboarding.",
      "Enviar links do board e do Notion.",
      "Confirmar compartilhamento do board e do Notion até o onboarding.",
    ],
    nextActions: [
      "Se o board/notion não estiverem compartilhados, resolver durante a sessão.",
      "Após onboarding, mover para fase de board.",
    ],
    requiredRecords: [
      "Data do onboarding.",
      "Quem conduziu a sessão.",
      "Confirmação de compartilhamento de board e Notion.",
      ...COMMON_REQUIRED_RECORDS,
    ],
    communication: [
      "WhatsApp com aprovação no teste e instruções de onboarding.",
      "Invite com apresentação da pessoa que fará a sessão.",
    ],
    automations: [
      "Criar invite automaticamente com template da fase.",
      "Disparar lembrete no dia da sessão.",
    ],
    slackChannels: [],

  },
  {
    key: "board",
    label: "Board",
    shortLabel: "Board",
    description:
      "Acompanhar a construção do board em até 7 dias e garantir que o aluno disponibilize tudo o que o time técnico precisa.",
    primaryOwner: "Dária",
    supportOwner: "Fraenzi",
    clickupFocus: "Board em construção ou finalizado.",
    checklist: [
      "Acompanhar se o aluno compartilhou board e Notion corretamente.",
      "Cobrar finalização do board dentro de 7 dias.",
      "Manter histórico das cobranças e bloqueios do aluno.",
    ],
    nextActions: [
      "Quando o board estiver pronto, marcar a sessão bússola.",
      "Registrar qualquer atraso ou comportamento crítico do aluno.",
    ],
    requiredRecords: [
      "Data estimada de entrega do board.",
      "Data real de finalização do board.",
      "Observações sobre atraso ou dificuldade do aluno.",
      ...COMMON_REQUIRED_RECORDS,
    ],
    communication: [
      "Mensagens de acompanhamento até o board ser finalizado.",
      "Cobranças manuais enquanto o aluno não conclui a entrega.",
    ],
    automations: [
      "Lembretes automáticos de cobrança do board.",
      "Alerta de fase vencida se passar dos 7 dias.",
    ],
    slackChannels: [],

  },
  {
    key: "bussola",
    label: "Sessão Bússola",
    shortLabel: "Bússola",
    description:
      "Marcar e registrar a sessão bússola com o texto correto do invite e lembrete no dia.",
    primaryOwner: "Dária",
    supportOwner: "Fraenzi",
    clickupFocus: "Sessão bússola marcada e realizada.",
    checklist: [
      "Confirmar agenda do time e do aluno.",
      "Gerar invite pela agenda do suporte.",
      "Usar o texto padrão de apresentação da pessoa que fará a sessão.",
      "Mandar lembrete no dia pelo WhatsApp.",
    ],
    nextActions: [
      "Após a sessão, registrar a data, responsável e resultado.",
      "Mover o aluno para Raio X.",
    ],
    requiredRecords: [
      "Data da bússola.",
      "Quem fez a sessão.",
      "Resumo operacional do resultado.",
      ...COMMON_REQUIRED_RECORDS,
    ],
    communication: [
      "Invite com apresentação do condutor.",
      "Lembrete pelo WhatsApp no dia.",
    ],
    automations: [
      "Gerar invite automaticamente.",
      "Lembrete automático no dia da sessão.",
    ],
    slackChannels: [],

  },
  {
    key: "raio_x",
    label: "Raio X",
    shortLabel: "Raio X",
    description:
      "Marcar, executar e registrar a sessão Raio X antes da fase de escrita/material.",
    primaryOwner: "Dária",
    supportOwner: "Fraenzi",
    clickupFocus: "Raio X marcado e realizado.",
    checklist: [
      "Conferir agenda do time e do aluno.",
      "Criar invite da sessão Raio X.",
      "Mandar lembrete no dia da sessão.",
      "Atualizar ClickUp com data, responsável e observações.",
    ],
    nextActions: [
      "Quando Raio X terminar, mover o aluno para escrita/material.",
      "Acompanhar dúvidas até a entrega do material.",
    ],
    requiredRecords: [
      "Data do Raio X.",
      "Quem fez a sessão.",
      "Observações relevantes para o time técnico.",
      ...COMMON_REQUIRED_RECORDS,
    ],
    communication: [
      "Invite com texto padrão da fase.",
      "Lembrete pelo WhatsApp no dia.",
    ],
    automations: [
      "Criar invite automaticamente.",
      "Disparar lembrete automático no dia.",
    ],
    slackChannels: [],

  },
  {
    key: "material",
    label: "Escrita / Material",
    shortLabel: "Material",
    description:
      "Janela de produção do material técnico do aluno, com acompanhamento de aulas e alinhamento com o time de escrita.",
    primaryOwner: "Dária",
    supportOwner: "Fraenzi / Time Técnico",
    clickupFocus: "Escrita em andamento até a entrega do material.",
    checklist: [
      "Aguardar prazo operacional do material.",
      "Cobrar que o aluno assista às aulas da plataforma.",
      "Levar dúvidas relevantes para o time técnico.",
      "Acompanhar se há feedback pendente do time.",
    ],
    nextActions: [
      "Quando o material estiver pronto, sinalizar devolutiva.",
      "Preparar transição para ongoing.",
    ],
    requiredRecords: [
      "Data prevista de entrega do material.",
      "Data real da finalização.",
      "Status do aluno em relação às aulas e dúvidas.",
      ...COMMON_REQUIRED_RECORDS,
    ],
    communication: [
      "Mensagens lembrando o aluno de assistir às aulas.",
      "Feedbacks intermediários quando necessário.",
    ],
    automations: [
      "Alertas de prazo da escrita.",
      "Integração com o canal técnico da fase.",
    ],
    slackChannels: [
      {
        name: "escrita",
        purpose: "Alinhar com o time técnico enquanto o material está em produção.",
      },
    ],

  },
  {
    key: "devolutiva",
    label: "Devolutiva",
    shortLabel: "Devolutiva",
    description:
      "Confirmar que o material foi entregue e registrar a passagem da fase inicial para ongoing.",
    primaryOwner: "Dária",
    supportOwner: "Fraenzi / Time Técnico",
    clickupFocus: "Material pronto e devolutiva realizada.",
    checklist: [
      "Confirmar que o time sinalizou material pronto.",
      "Registrar a devolutiva no histórico do aluno.",
      "Preparar handoff para Rafael.",
    ],
    nextActions: [
      "Enviar material de treinamento de entrevista por e-mail.",
      "Criar pasta de gravação e liberar o próximo grupo.",
    ],
    requiredRecords: [
      "Data da devolutiva.",
      "Quem conduziu ou sinalizou a entrega.",
      "Confirmação de handoff para ongoing.",
      ...COMMON_REQUIRED_RECORDS,
    ],
    communication: [
      "Mensagem ao aluno confirmando entrega de material e próximos passos.",
      "E-mail com orientações do ongoing.",
    ],
    automations: [
      "Gerar pacote inicial do ongoing automaticamente.",
      "Disparar e-mail com material de entrevista.",
    ],
    slackChannels: [
      {
        name: "devolutiva",
        purpose: "Conversar com o time sobre entregas e devolutivas do material.",
      },
    ],

  },
  {
    key: "ongoing",
    label: "Ongoing",
    shortLabel: "Ongoing",
    description:
      "Fase de aplicação com Rafael, incluindo 15 minutos, treinamento, mock interviews, análise de vaga e check-ins recorrentes.",
    primaryOwner: "Rafael",
    supportOwner: "Fraenzi",
    clickupFocus: "Acompanhamento ativo da aplicação do aluno.",
    checklist: [
      "Enviar material de treinamento de entrevista por e-mail.",
      "Criar pasta de gravação de entrevistas no Drive.",
      "Liberar o aluno para o novo grupo.",
      "Pedir agenda e marcar os 15 minutos com Rafael.",
      "Acompanhar treinamento, mocks e análises de vaga/entrevista.",
    ],
    nextActions: [
      "Garantir que o treinamento só ocorra com material pronto.",
      "Mock interview só pode acontecer se houver entrevista real.",
      "Fazer check-ins quinzenais com os alunos.",
    ],
    requiredRecords: [
      "Data dos 15 minutos.",
      "Treinamentos realizados.",
      "Quantidade de mock interviews consumidas.",
      "Observações de evolução do aluno na aplicação.",
      ...COMMON_REQUIRED_RECORDS,
    ],
    communication: [
      "E-mail com material de entrevista.",
      "Mensagens quinzenais de acompanhamento.",
      "Lembretes de sessão e envio de links.",
    ],
    automations: [
      "Criar pasta de entrevistas automaticamente.",
      "Automatizar envio de e-mails e check-ins recorrentes.",
      "Lembretes automáticos de sessões e follow-ups.",
    ],
    slackChannels: [],

  },
  {
    key: "renovacao",
    label: "Renovação",
    shortLabel: "Renovação",
    description:
      "Fase final da mentoria em que o aluno decide renovar por mais 6 meses ou encerrar o acompanhamento.",
    primaryOwner: "Rafael / Fraenzi",
    supportOwner: "Coordenação",
    clickupFocus: "Precisa renovar, renovou ou encerrou.",
    checklist: [
      "Enviar áudio de renovação.",
      "Registrar interesse ou recusa do aluno.",
      "Se renovar, reabrir ciclo de acompanhamento.",
      "Se não renovar, encerrar aluno e desligar acessos.",
    ],
    nextActions: [
      "Registrar decisão final do aluno.",
      "Executar renovação ou encerramento com clareza operacional.",
    ],
    requiredRecords: [
      "Data do contato de renovação.",
      "Resultado da negociação.",
      "Data de encerramento ou nova vigência.",
      ...COMMON_REQUIRED_RECORDS,
    ],
    communication: [
      "Áudio de renovação.",
      "Confirmação por WhatsApp ou e-mail do próximo passo.",
    ],
    automations: [
      "Criar alertas automáticos de fim de ciclo.",
      "Automatizar o pacote de encerramento e desligamento de acessos.",
    ],
    slackChannels: [],

  },
];

export const OPS_WORKFLOW_DEFINITIONS = WORKFLOW_DEFINITIONS;

const WORKFLOW_BY_KEY = Object.fromEntries(
  WORKFLOW_DEFINITIONS.map((definition) => [definition.key, definition])
) as Record<string, OpsWorkflowDefinition>;

function getWorkflowBlockers({
  enrollment,
  placementTest,
}: DeriveWorkflowInput): string[] {
  const blockers: string[] = [];
  const currentPhaseKey = enrollment.currentPhase?.key;
  const sessions = enrollment.sessions;
  const qbBalance = Number(enrollment.customer.qbBalance ?? 0);

  if (enrollment.status === "PAUSED") {
    blockers.push("A mentoria está pausada. Validar se o aluno pode voltar ao fluxo normal.");
  }

  if (enrollment.status === "COMPLETED") {
    blockers.push("A mentoria está concluída. Só avance se houver renovação explícita.");
  }

  if (qbBalance > 0) {
    blockers.push(
      `Há saldo em aberto no QuickBooks (${qbBalance.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      })}). Validar se o acompanhamento deve seguir normalmente.`
    );
  }

  if (currentPhaseKey === "teste_de_ingles" && !placementTest) {
    blockers.push("O resultado do teste de inglês ainda não foi registrado.");
  }

  if (currentPhaseKey === "onboarding" && !placementTest) {
    blockers.push("O aluno entrou em onboarding sem resultado registrado de teste de inglês.");
  }

  if (currentPhaseKey === "board" && !hasSessionType(sessions, "onboarding")) {
    blockers.push("O onboarding ainda não foi registrado como sessão.");
  }

  if (currentPhaseKey === "bussola" && !hasSessionType(sessions, "onboarding")) {
    blockers.push("Registrar o onboarding antes de seguir com a sessão bússola.");
  }

  if (currentPhaseKey === "raio_x" && !hasSessionType(sessions, "bussola")) {
    blockers.push("A sessão bússola ainda não foi registrada.");
  }

  if (
    (currentPhaseKey === "material" || currentPhaseKey === "devolutiva") &&
    !hasSessionType(sessions, "raio_x")
  ) {
    blockers.push("A sessão Raio X ainda não foi registrada.");
  }

  if (currentPhaseKey === "ongoing" && !hasSessionType(sessions, "devolutiva")) {
    blockers.push("A devolutiva ainda não foi registrada; validar se o material já foi entregue.");
  }

  if (currentPhaseKey === "renovacao" && enrollment.status !== "COMPLETED") {
    blockers.push("Definir claramente se o aluno vai renovar ou encerrar antes de fechar o ciclo.");
  }

  return blockers;
}

function getWorkflowAlerts(input: DeriveWorkflowInput): OpsWorkflowAlert[] {
  const alerts: OpsWorkflowAlert[] = [];
  const currentPhase = input.enrollment.currentPhase;

  if (input.enrollment.status === "PAUSED") {
    alerts.push({
      level: "warning",
      title: "Mentoria pausada",
      description: "O aluno está pausado e precisa de reativação explícita antes de continuar.",
    });
  }

  if (input.enrollment.status === "COMPLETED") {
    alerts.push({
      level: "info",
      title: "Mentoria concluída",
      description: "O aluno concluiu o ciclo atual. Use a fase de renovação para decidir o próximo passo.",
    });
  }

  const qbBalance = Number(input.enrollment.customer.qbBalance ?? 0);
  if (qbBalance > 0) {
    alerts.push({
      level: "warning",
      title: "Saldo em aberto",
      description: `O aluno tem ${qbBalance.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      })} em aberto no QuickBooks.`,
    });
  }

  if (currentPhase) {
    const latestTransitionDate =
      input.enrollment.transitions.at(-1)?.createdAt ?? input.enrollment.startDate;
    const phaseAgeDays = daysBetween(latestTransitionDate, new Date());
    if (phaseAgeDays > currentPhase.slaDays) {
      alerts.push({
        level: "error",
        title: "Fase fora do SLA",
        description: `${currentPhase.label} está há ${phaseAgeDays} dias em andamento para um SLA de ${currentPhase.slaDays} dias.`,
      });
    }
  }

  if (currentPhase?.key === "teste_de_ingles" && !input.placementTest) {
    alerts.push({
      level: "warning",
      title: "Teste sem retorno registrado",
      description: "Há sessão de teste em andamento, mas ainda não existe resultado formal no histórico.",
    });
  }

  return alerts;
}

export function deriveOpsWorkflowState(
  input: DeriveWorkflowInput
): DerivedOpsWorkflowState {
  const now = new Date();
  const currentPhase = input.enrollment.currentPhase;
  const currentPhaseKey = currentPhase?.key ?? null;
  const latestTransitionDate =
    input.enrollment.transitions.at(-1)?.createdAt ?? input.enrollment.startDate;
  const phaseAgeDays = currentPhase ? daysBetween(latestTransitionDate, now) : null;
  const slaDays = currentPhase?.slaDays ?? null;
  const daysRemaining =
    phaseAgeDays !== null && slaDays !== null ? slaDays - phaseAgeDays : null;
  const isOverdue = daysRemaining !== null ? daysRemaining < 0 : false;

  const currentSortOrder = currentPhase?.sortOrder ?? 0;

  const steps: OpsWorkflowStep[] = WORKFLOW_DEFINITIONS.map((definition, index) => {
    const definitionSortOrder = index + 1;
    let status: WorkflowStepStatus = "upcoming";

    if (currentPhaseKey === definition.key) {
      status = "current";
    } else if (definitionSortOrder < currentSortOrder) {
      status = "completed";
    }

    if (input.enrollment.status === "COMPLETED" && definitionSortOrder <= currentSortOrder) {
      status = "completed";
    }

    return {
      key: definition.key,
      label: definition.label,
      shortLabel: definition.shortLabel,
      status,
      owner: definition.primaryOwner,
      supportOwner: definition.supportOwner,
    };
  });

  const currentDefinition = currentPhaseKey ? WORKFLOW_BY_KEY[currentPhaseKey] : null;
  const blockers = getWorkflowBlockers(input);

  return {
    currentPhaseKey,
    phaseAgeDays,
    slaDays,
    daysRemaining,
    isOverdue,
    alerts: getWorkflowAlerts(input),
    steps,
    currentPlaybook: currentDefinition
      ? {
          key: currentDefinition.key,
          label: currentDefinition.label,
          description: currentDefinition.description,
          primaryOwner: currentDefinition.primaryOwner,
          supportOwner: currentDefinition.supportOwner,
          clickupFocus: currentDefinition.clickupFocus,
          checklist: currentDefinition.checklist,
          nextActions: currentDefinition.nextActions,
          requiredRecords: currentDefinition.requiredRecords,
          communication: currentDefinition.communication,
          automations: currentDefinition.automations,
          slackChannels: currentDefinition.slackChannels,

          blockers,
        }
      : null,
  };
}
