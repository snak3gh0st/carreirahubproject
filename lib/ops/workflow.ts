export const OPS_SESSION_TYPES = [
  "passagem_de_bastao",
  "teste_de_ingles",
  "onboarding",
  "bussola",
  "raio_x",
  "suporte_15_min",
  "devolutiva",
  "treinamento_de_entrevista",
  "mock_interview_1",
  "mock_interview_2",
  "analise_vaga_entrevista",
  "recolocacao",
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
  suporte_15_min: "15 minutos com o suporte",
  devolutiva: "Devolutiva",
  treinamento_de_entrevista: "Treinamento de Entrevista",
  mock_interview_1: "1ª Mock Interview",
  mock_interview_2: "2ª Mock Interview",
  analise_vaga_entrevista: "Análise de vaga/entrevista",
  recolocacao: "Recolocação",
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
  hubFocus: string;
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
  hubFocus: string;
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
  "Atualizar o status oficial do aluno no Hub.",
  "Registrar data da etapa e quem executou a ação.",
  "Deixar observações críticas no histórico do aluno.",
];

type SimpleWorkflowDefinitionInput = Pick<
  OpsWorkflowDefinition,
  "key" | "label" | "shortLabel" | "description" | "primaryOwner" | "supportOwner" | "hubFocus"
> &
  Partial<
    Pick<
      OpsWorkflowDefinition,
      | "checklist"
      | "nextActions"
      | "requiredRecords"
      | "communication"
      | "automations"
      | "slackChannels"
    >
  >;

function simplePhase(input: SimpleWorkflowDefinitionInput): OpsWorkflowDefinition {
  return {
    checklist: [
      `Confirmar critérios de entrada para ${input.label}.`,
      "Atualizar o histórico operacional do aluno no Hub.",
      "Registrar responsável, data e próximo passo claro.",
      ...(input.checklist ?? []),
    ],
    nextActions: input.nextActions ?? ["Avançar somente quando a etapa estiver comprovada."],
    requiredRecords: input.requiredRecords ?? COMMON_REQUIRED_RECORDS,
    communication: input.communication ?? ["Registrar contato com o aluno no histórico operacional."],
    automations: input.automations ?? ["Usar alertas internos do Hub para evitar perda de prazo."],
    slackChannels: input.slackChannels ?? [],
    ...input,
  };
}

const WORKFLOW_DEFINITIONS: OpsWorkflowDefinition[] = [
  {
    key: "bastao",
    label: "Passagem de Bastão",
    shortLabel: "Bastão",
    description:
      "Entrada oficial do aluno na operação após venda do comercial, com repasse dos dados obrigatórios e contrato.",
    primaryOwner: "Fraenzi / Suporte",
    supportOwner: "Time Comercial",
    hubFocus: "Criar o aluno no Hub operacional e iniciar o atendimento.",
    checklist: [
      "Receber no Slack a passagem de bastão com dados completos do aluno.",
      "Cadastrar o aluno no Hub dentro do produto correto.",
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
    hubFocus: "Status do aluno pronto para marcar teste.",
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
  simplePhase({
    key: "marcar_teste_ingles",
    label: "Marcar Teste de Inglês",
    shortLabel: "Marcar Teste",
    description: "Coletar disponibilidade e deixar o teste de inglês pronto para acontecer.",
    primaryOwner: "Dária / Suporte",
    supportOwner: "Mônica / Leka",
    hubFocus: "Aluno aguardando agenda do teste de inglês.",
    checklist: [
      "Confirmar que o aluno recebeu orientação para o teste.",
      "Registrar horários disponíveis e responsável indicado.",
    ],
    nextActions: ["Agendar o teste e mover para Teste de Inglês."],
  }),
  {
    key: "teste_de_ingles",
    label: "Teste de Inglês",
    shortLabel: "Teste",
    description:
      "Agendar, registrar e concluir o teste de inglês, incluindo retorno operacional para aprovado ou reprovado.",
    primaryOwner: "Dária / Suporte",
    supportOwner: "Mônica / Leka",
    hubFocus: "Marcou o teste, passou ou não passou no teste.",
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
  simplePhase({
    key: "passou_teste_ingles",
    label: "Passou no Teste de Inglês",
    shortLabel: "Passou Inglês",
    description: "Registrar aprovação e preparar a entrada oficial na mentoria.",
    primaryOwner: "Dária / Suporte",
    supportOwner: "Fraenzi",
    hubFocus: "Aluno aprovado e pronto para onboarding.",
    checklist: [
      "Conferir resultado escrito/oral registrado no Hub.",
      "Comunicar aprovação e próximos passos ao aluno.",
    ],
    nextActions: ["Mover para Marcar Onboarding."],
  }),
  simplePhase({
    key: "nao_passou_teste_ingles",
    label: "Não passou no Teste de Inglês",
    shortLabel: "Não passou",
    description: "Registrar reprovação, explicar próximos passos e sinalizar decisão comercial/operacional.",
    primaryOwner: "Dária / Suporte",
    supportOwner: "Comercial",
    hubFocus: "Aluno reprovado no inglês com desfecho operacional pendente.",
    checklist: [
      "Registrar score, CEFR e motivo principal.",
      "Definir se será redirecionado para outro produto ou cancelamento.",
    ],
    nextActions: ["Resolver o desfecho antes de seguir qualquer fase da mentoria."],
  }),
  simplePhase({
    key: "marcar_onboarding",
    label: "Marcar Onboarding",
    shortLabel: "Marcar Onb.",
    description: "Coletar agenda e preparar a sessão de onboarding do aluno aprovado.",
    primaryOwner: "Dária",
    supportOwner: "Fraenzi",
    hubFocus: "Onboarding aguardando marcação.",
    checklist: ["Confirmar disponibilidade do aluno.", "Enviar convite com pauta e responsável."],
    nextActions: ["Mover para Onboarding Marcado quando houver data definida."],
  }),
  simplePhase({
    key: "onboarding_marcado",
    label: "Onboarding Marcado",
    shortLabel: "Onb. Marcado",
    description: "Acompanhar a sessão marcada até a realização e registro.",
    primaryOwner: "Dária",
    supportOwner: "Fraenzi",
    hubFocus: "Onboarding com data definida.",
    checklist: ["Confirmar presença no dia.", "Registrar ausência, remarcação ou conclusão."],
    nextActions: ["Registrar a sessão de onboarding realizada."],
  }),
  {
    key: "onboarding",
    label: "Onboarding",
    shortLabel: "Onboarding",
    description:
      "Transição do aluno aprovado no teste para a mentoria ativa, com envio de instruções e coleta de links do board e do Notion.",
    primaryOwner: "Dária",
    supportOwner: "Fraenzi",
    hubFocus: "Onboarding marcado e concluído.",
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
  simplePhase({
    key: "preparacao_board",
    label: "Preparação do Board",
    shortLabel: "Prep. Board",
    description: "Garantir links, acessos e materiais para a construção do board.",
    primaryOwner: "Dária",
    supportOwner: "Fraenzi",
    hubFocus: "Board ainda em preparação.",
    checklist: ["Salvar URL do board no perfil operacional.", "Salvar URL do Notion no perfil operacional."],
    nextActions: ["Mover para Board quando o aluno estiver construindo ou revisando a entrega."],
  }),
  {
    key: "board",
    label: "Board",
    shortLabel: "Board",
    description:
      "Acompanhar a construção do board em até 7 dias e garantir que o aluno disponibilize tudo o que o time técnico precisa.",
    primaryOwner: "Dária",
    supportOwner: "Fraenzi",
    hubFocus: "Board em construção ou finalizado.",
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
  simplePhase({
    key: "pode_marcar_bussola",
    label: "Pode Marcar a Bússola",
    shortLabel: "Pode Bússola",
    description: "Board pronto o suficiente para o operacional marcar a sessão bússola.",
    primaryOwner: "Dária",
    supportOwner: "Fraenzi",
    hubFocus: "Aluno liberado para agendar bússola.",
    checklist: ["Validar que o board está utilizável.", "Confirmar agenda disponível."],
    nextActions: ["Marcar sessão bússola."],
  }),
  simplePhase({
    key: "bussola_marcada",
    label: "Sessão Bússola Marcada",
    shortLabel: "Bússola Marcada",
    description: "Sessão bússola com data definida, aguardando realização.",
    primaryOwner: "Dária",
    supportOwner: "Fraenzi",
    hubFocus: "Bússola agendada.",
    checklist: ["Enviar invite.", "Fazer lembrete no dia.", "Registrar remarcação se houver."],
    nextActions: ["Registrar a bússola realizada."],
  }),
  {
    key: "bussola",
    label: "Sessão Bússola",
    shortLabel: "Bússola",
    description:
      "Marcar e registrar a sessão bússola com o texto correto do invite e lembrete no dia.",
    primaryOwner: "Dária",
    supportOwner: "Fraenzi",
    hubFocus: "Sessão bússola marcada e realizada.",
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
  simplePhase({
    key: "finalizar_board",
    label: "Finalizar o Board",
    shortLabel: "Finalizar Board",
    description: "Fechar pendências do board depois da bússola antes da sessão Raio-X.",
    primaryOwner: "Dária",
    supportOwner: "Time Técnico",
    hubFocus: "Board em fechamento.",
    checklist: ["Confirmar ajustes pós-bússola.", "Atualizar URL do board final no perfil."],
    nextActions: ["Mover para Marcar Sessão Raio-X."],
  }),
  simplePhase({
    key: "marcar_raio_x",
    label: "Marcar Sessão Raio-X",
    shortLabel: "Marcar Raio-X",
    description: "Coletar disponibilidade e marcar a sessão Raio-X.",
    primaryOwner: "Dária",
    supportOwner: "Fraenzi",
    hubFocus: "Raio-X aguardando agenda.",
    checklist: ["Confirmar condutor.", "Enviar invite e pauta."],
    nextActions: ["Registrar a sessão Raio-X quando realizada."],
  }),
  {
    key: "raio_x",
    label: "Raio X",
    shortLabel: "Raio X",
    description:
      "Marcar, executar e registrar a sessão Raio X antes da fase de escrita/material.",
    primaryOwner: "Dária",
    supportOwner: "Fraenzi",
    hubFocus: "Raio X marcado e realizado.",
    checklist: [
      "Conferir agenda do time e do aluno.",
      "Criar invite da sessão Raio X.",
      "Mandar lembrete no dia da sessão.",
      "Atualizar o Hub com data, responsável e observações.",
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
  simplePhase({
    key: "construcao_material",
    label: "Construção de Material",
    shortLabel: "Construção",
    description: "Material profissional em produção pelo time técnico.",
    primaryOwner: "Time Técnico",
    supportOwner: "Dária",
    hubFocus: "Material em construção.",
    checklist: ["Registrar CV/material recebido.", "Acompanhar prazo de produção e pendências."],
    nextActions: ["Mover para Material ou Revisão conforme o estado da entrega."],
  }),
  {
    key: "material",
    label: "Escrita / Material",
    shortLabel: "Material",
    description:
      "Janela de produção do material técnico do aluno, com acompanhamento de aulas e alinhamento com o time de escrita.",
    primaryOwner: "Dária",
    supportOwner: "Fraenzi / Time Técnico",
    hubFocus: "Escrita em andamento até a entrega do material.",
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
  simplePhase({
    key: "em_revisao",
    label: "Em Processo de Revisão",
    shortLabel: "Revisão",
    description: "Material aguardando revisão final antes da devolutiva.",
    primaryOwner: "Time Técnico",
    supportOwner: "Dária",
    hubFocus: "Material em revisão.",
    checklist: ["Registrar documento revisado.", "Marcar status do material como revisado/final no Hub."],
    nextActions: ["Liberar devolutiva quando a revisão estiver aprovada."],
  }),
  simplePhase({
    key: "realizar_devolutiva",
    label: "Realizar Devolutiva",
    shortLabel: "Realizar Dev.",
    description: "Material aprovado e pronto para devolutiva ao aluno.",
    primaryOwner: "Dária",
    supportOwner: "Time Técnico",
    hubFocus: "Devolutiva precisa ser realizada.",
    checklist: ["Agendar devolutiva.", "Preparar resumo de entrega e próximos passos."],
    nextActions: ["Registrar Devolutiva Feita após a sessão/entrega."],
  }),
  {
    key: "devolutiva",
    label: "Devolutiva",
    shortLabel: "Devolutiva",
    description:
      "Confirmar que o material foi entregue e registrar a passagem da fase inicial para ongoing.",
    primaryOwner: "Dária",
    supportOwner: "Fraenzi / Time Técnico",
    hubFocus: "Material pronto e devolutiva realizada.",
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
  simplePhase({
    key: "suporte_15_min",
    label: "15 Minutos com o Suporte",
    shortLabel: "15 Min.",
    description: "Sessão curta de transição para o acompanhamento de aplicação.",
    primaryOwner: "Rafael",
    supportOwner: "Fraenzi",
    hubFocus: "Aluno precisa fazer a sessão de 15 minutos.",
    checklist: ["Confirmar material entregue.", "Registrar sessão de 15 minutos no Hub."],
    nextActions: ["Mover para Marcado com o Suporte ou Treinamento de Entrevista."],
  }),
  simplePhase({
    key: "suporte_marcado",
    label: "Marcado com o Suporte",
    shortLabel: "Suporte Marcado",
    description: "Sessão com suporte marcada e aguardando realização.",
    primaryOwner: "Rafael",
    supportOwner: "Fraenzi",
    hubFocus: "Suporte com data definida.",
    checklist: ["Confirmar presença.", "Registrar conclusão ou remarcação."],
    nextActions: ["Após realização, avançar para treinamento de entrevista."],
  }),
  simplePhase({
    key: "marcar_treinamento_entrevista",
    label: "Marcar Treinamento de Entrevista",
    shortLabel: "Marcar Treino",
    description: "Preparar o treinamento de entrevista do aluno.",
    primaryOwner: "Rafael",
    supportOwner: "Fraenzi",
    hubFocus: "Treinamento aguardando marcação.",
    checklist: ["Confirmar elegibilidade.", "Agendar treinamento com o responsável."],
    nextActions: ["Mover para Treinamento de Entrevista Marcado."],
  }),
  simplePhase({
    key: "treinamento_entrevista",
    label: "Treinamento de Entrevista",
    shortLabel: "Treinamento",
    description: "Treinar comunicação, respostas e postura antes dos mocks/entrevistas reais.",
    primaryOwner: "Rafael",
    supportOwner: "Fraenzi",
    hubFocus: "Treinamento em execução.",
    checklist: ["Registrar sessão realizada.", "Registrar principais gaps e próximos exercícios."],
    nextActions: ["Avançar para mock interview quando estiver liberado."],
  }),
  simplePhase({
    key: "treinamento_entrevista_marcado",
    label: "Treinamento de Entrevista Marcado",
    shortLabel: "Treino Marcado",
    description: "Treinamento marcado e aguardando realização.",
    primaryOwner: "Rafael",
    supportOwner: "Fraenzi",
    hubFocus: "Treinamento com data definida.",
    checklist: ["Enviar invite.", "Registrar presença, remarcação ou conclusão."],
    nextActions: ["Executar e registrar treinamento."],
  }),
  simplePhase({
    key: "mock_interview_1",
    label: "1ª Mock Interview",
    shortLabel: "Mock 1",
    description: "Primeira mock interview com base em CV, alvo e etapa do aluno.",
    primaryOwner: "Rafael",
    supportOwner: "Fraenzi",
    hubFocus: "Primeira mock interview pendente ou em análise.",
    checklist: ["Confirmar CV/material atualizado.", "Registrar relatório e gravação da mock."],
    nextActions: ["Acompanhar evolução e liberar 2ª mock quando fizer sentido."],
  }),
  simplePhase({
    key: "mock_interview_2",
    label: "2ª Mock Interview",
    shortLabel: "Mock 2",
    description: "Segunda mock interview para ajuste fino e prontidão de entrevista.",
    primaryOwner: "Rafael",
    supportOwner: "Fraenzi",
    hubFocus: "Segunda mock interview pendente ou em análise.",
    checklist: ["Comparar evolução com a primeira mock.", "Registrar score, riscos e plano de prática."],
    nextActions: ["Mover para acompanhamento de aplicação/recolocação."],
  }),
  {
    key: "ongoing",
    label: "Ongoing",
    shortLabel: "Ongoing",
    description:
      "Fase de aplicação com Rafael, incluindo 15 minutos, treinamento, mock interviews, análise de vaga e check-ins recorrentes.",
    primaryOwner: "Rafael",
    supportOwner: "Fraenzi",
    hubFocus: "Acompanhamento ativo da aplicação do aluno.",
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
  simplePhase({
    key: "aguardando_recolocacao",
    label: "Aguardando Recolocação",
    shortLabel: "Recolocação",
    description: "Aluno em acompanhamento ativo até entrevista/oferta/recolocação.",
    primaryOwner: "Rafael",
    supportOwner: "Fraenzi",
    hubFocus: "Aguardar recolocação com atividades registradas.",
    checklist: ["Registrar aplicações, entrevistas, ofertas e recolocação.", "Manter check-ins recorrentes."],
    nextActions: ["Mover para renovação quando a vigência estiver próxima do fim."],
  }),
  simplePhase({
    key: "precisa_renovar",
    label: "Precisa Renovar",
    shortLabel: "Renovar",
    description: "Aluno chegou na janela de renovação e precisa de abordagem comercial/operacional.",
    primaryOwner: "Rafael / Fraenzi",
    supportOwner: "Coordenação",
    hubFocus: "Renovação pendente.",
    checklist: ["Confirmar data de fim da mentoria.", "Preparar contexto de evolução e proposta de renovação."],
    nextActions: ["Enviar áudio de renovação e registrar retorno."],
  }),
  simplePhase({
    key: "audio_renovacao_enviado",
    label: "Áudio de Renovação Enviado",
    shortLabel: "Áudio Enviado",
    description: "Áudio de renovação enviado, aguardando resposta do aluno.",
    primaryOwner: "Rafael / Fraenzi",
    supportOwner: "Coordenação",
    hubFocus: "Aguardando resposta da renovação.",
    checklist: ["Registrar data do áudio.", "Registrar resposta ou follow-up."],
    nextActions: ["Mover para Renovação ou Mentoria Encerrada conforme decisão."],
  }),
  {
    key: "renovacao",
    label: "Renovação",
    shortLabel: "Renovação",
    description:
      "Fase final da mentoria em que o aluno decide renovar por mais 6 meses ou encerrar o acompanhamento.",
    primaryOwner: "Rafael / Fraenzi",
    supportOwner: "Coordenação",
    hubFocus: "Precisa renovar, renovou ou encerrou.",
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
  simplePhase({
    key: "mentoria_encerrada",
    label: "Mentoria Encerrada",
    shortLabel: "Encerrado",
    description: "Ciclo encerrado por término de contrato, não renovação ou cancelamento.",
    primaryOwner: "Fraenzi / Coordenação",
    supportOwner: "Rafael",
    hubFocus: "Encerramento formal do ciclo.",
    checklist: ["Registrar motivo do encerramento.", "Encerrar acessos e salvar documentação final."],
    nextActions: ["Manter histórico completo disponível no Hub."],
  }),
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
          hubFocus: currentDefinition.hubFocus,
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
