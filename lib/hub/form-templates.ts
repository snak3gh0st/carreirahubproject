// ---------------------------------------------------------------------------
// Form Templates for the Client Hub
// ---------------------------------------------------------------------------

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "radio"
  | "scale"
  | "checkbox"
  | "file";

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  labelPt: string;
  required: boolean;
  hint?: string;
  hintPt?: string;
  options?: { value: string; label: string; labelPt: string }[];
  /** For file fields — mime accept string (default: ".pdf,.jpg,.jpeg,.png,.doc,.docx") */
  accept?: string;
  /** For scale fields */
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMinLabelPt?: string;
  scaleMaxLabel?: string;
  scaleMaxLabelPt?: string;
}

export interface FormTemplate {
  id: string;
  title: string;
  titlePt: string;
  description: string;
  descriptionPt: string;
  fields: FormField[];
}

export const NPS_SCORE_FIELD = "npsScore";
export const NPS_TEMPLATE_IDS = ["nps-entry", "nps-exit"] as const;

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const FORM_TEMPLATES: Record<string, FormTemplate> = {
  // -----------------------------------------------------------------------
  // 1. Career Onboarding (generic)
  // -----------------------------------------------------------------------
  "onboarding-career": {
    id: "onboarding-career",
    title: "Career Onboarding Form",
    titlePt: "Formulário de Onboarding de Carreira",
    description:
      "Complete this form so we can start building your personalized career plan in the USA.",
    descriptionPt:
      "Preencha este formulário para que possamos começar a construir seu plano de carreira personalizado nos EUA.",
    fields: [
      {
        id: "fullName",
        type: "text",
        label: "Full Name",
        labelPt: "Nome Completo",
        required: true,
      },
      {
        id: "dob",
        type: "date",
        label: "Date of Birth",
        labelPt: "Data de Nascimento",
        required: true,
      },
      {
        id: "phone",
        type: "text",
        label: "Phone Number",
        labelPt: "Número de Telefone",
        required: true,
      },
      {
        id: "address",
        type: "text",
        label: "Address",
        labelPt: "Endereço",
        required: true,
      },
      {
        id: "resume",
        type: "file",
        label: "Resume / CV",
        labelPt: "Currículo",
        required: true,
      },
      {
        id: "workExperience",
        type: "textarea",
        label: "Work Experience Summary",
        labelPt: "Resumo da Experiência Profissional",
        required: false,
      },
      {
        id: "desiredRole",
        type: "text",
        label: "Desired Role in the USA",
        labelPt: "Cargo Desejado nos EUA",
        required: false,
      },
      {
        id: "linkedIn",
        type: "text",
        label: "LinkedIn Profile",
        labelPt: "Perfil do LinkedIn",
        required: false,
      },
    ],
  },

  // -----------------------------------------------------------------------
  // 2. Programa Pass — Onboarding Completo
  // -----------------------------------------------------------------------
  "onboarding-pass": {
    id: "onboarding-pass",
    title: "Programa Pass — Get to Know You",
    titlePt: "Programa Pass — Queremos te Conhecer",
    description:
      "Hello, it's a pleasure to have you with us! We want to get to know you better to understand where you are in your journey and how we can help through the Pass Program. Your answers are very important so we can provide a service tailored to your needs. Filling out this form is mandatory to continue the process. Please answer all questions carefully and honestly. Let's go!",
    descriptionPt:
      "Olá, é um prazer ter você conosco! Por isso, queremos conhecer você melhor para entender em que momento da sua jornada se encontra e como podemos ajudar através do Programa Pass. Suas respostas são muito importantes para podermos oferecer um atendimento mais adequado às suas necessidades. O preenchimento deste formulário é obrigatório para dar continuidade ao processo, e solicitamos que todas as perguntas sejam respondidas com atenção e sinceridade. Vamos lá!",
    fields: [
      {
        id: "fullName",
        type: "text",
        label: "Your first and last name.",
        labelPt: "Seu nome e sobrenome.",
        required: true,
      },
      {
        id: "dob",
        type: "date",
        label: "Date of birth (important so we can celebrate with you and maybe give you some treats!)",
        labelPt: "Data de nascimento (importante para comemorarmos com você e quem sabe te dar uns mimos)",
        required: true,
      },
      {
        id: "fieldOfWork",
        type: "textarea",
        label: "What is your field of work and education?",
        labelPt: "Qual é sua área de atuação e formação?",
        required: true,
      },
      {
        id: "resume",
        type: "file",
        label: "Upload your current CV or resume.",
        labelPt: "Envie seu CV ou currículo atual.",
        required: false,
        accept: ".pdf,.doc,.docx",
      },
      {
        id: "linkedIn",
        type: "text",
        label: "LinkedIn profile",
        labelPt: "Perfil do LinkedIn",
        required: false,
      },
      {
        id: "workPermitOptCpt",
        type: "radio",
        label: "Is your work permit OPT/CPT (work permit granted to students)?",
        labelPt: "A sua permissão de trabalho é OPT/CPT (é a permissão de trabalho concedida aos estudantes para poder trabalhar)?",
        required: true,
        options: [
          {
            value: "yes",
            label: "Yes, it is OPT/CPT.",
            labelPt: "Sim, é OPT/CPT.",
          },
          {
            value: "no",
            label: "No, my work permit is a different type.",
            labelPt: "Não, minha permissão de trabalho é em outro modelo.",
          },
        ],
      },
      {
        id: "cptOptArea",
        type: "textarea",
        label: "If you have OPT/CPT, what field does your college allow you to work in to obtain CPT/OPT?",
        labelPt: "Caso tenha OPT e CPT, qual área de atuação sua faculdade permite que você atue para obter o CPT/OPT?",
        required: true,
      },
      {
        id: "currentlyWorking",
        type: "textarea",
        label: "Are you currently working in your field? If not, what do you do?",
        labelPt: "Atualmente, está trabalhando na sua área? Caso não seja, pode colocar no que trabalha.",
        required: true,
      },
      {
        id: "diagnosis",
        type: "textarea",
        label: "Do you have any diagnosis we should know about to better help you? For example: anxiety, depression, etc.",
        labelPt: "Você tem algum diagnóstico que precisamos saber para melhor te ajudar e trabalhar com você? Por exemplo: ansiedade, depressão, etc.",
        required: true,
      },
      {
        id: "familyLifeSupport",
        type: "textarea",
        label: "Tell us: do you have children, family, a support network (someone to help with them), pets, a life you consider enjoyable in America?",
        labelPt: "Conte aqui para a gente: você tem filhos, família, rede de apoio (alguém que ajude com eles), cachorro, uma vida que considere agradável de viver na América?",
        required: true,
      },
      {
        id: "timeInUsa",
        type: "textarea",
        label: "Tell us: how long have you been in the USA and why did you decide to come here?",
        labelPt: "Conte aqui para a gente: há quanto tempo está nos EUA e por qual motivo resolveu vir para cá?",
        required: true,
      },
      {
        id: "relocationGoal",
        type: "textarea",
        label: "What is your biggest goal in your career relocation? For example: enter the market, good salary, home office, return to your field, etc.",
        labelPt: "Qual é o seu maior objetivo no seu processo de recolocação? Por exemplo: entrar no mercado, bom salário, home office, voltar para sua área, etc.",
        required: true,
      },
      {
        id: "metaBeyondRelocation",
        type: "textarea",
        label: "What is your goal beyond relocation? For example: have more time for self-care, take care of children, be healthier, etc.",
        labelPt: "Qual é a sua meta além da recolocação? Por exemplo: ter mais tempo para se cuidar, cuidar dos filhos, ter mais saúde, etc.",
        required: true,
      },
      {
        id: "personalValues",
        type: "textarea",
        label: "What personal values do you have that you consider non-negotiable?",
        labelPt: "Quais valores pessoais você tem que considera inegociáveis?",
        required: true,
      },
      {
        id: "goldQuestion",
        type: "textarea",
        label: "Gold question: what would make you recommend Carreira USA and what would make you NOT recommend it?",
        labelPt: "Pergunta de ouro: o que faria você recomendar a Carreira USA e o que faria você não recomendar?",
        required: true,
      },
      {
        id: "firstSalaryDream",
        type: "textarea",
        label: "Question to show you when you get placed: do you have a dream or wish for your first corporate salary in America?",
        labelPt: "Pergunta para mostrarmos para você quando for recolocado: você tem algum sonho ou desejo para o seu primeiro salário no corporativo americano?",
        required: true,
      },
      {
        id: "photo",
        type: "file",
        label: "Send us a photo of you doing something you love or at your current job. In the future, we'll show you where you were and where you went on your journey.",
        labelPt: "Nos envie uma foto sua fazendo algo que você ama ou no seu cargo atual. No futuro, te mostraremos onde estava e para onde foi com a sua jornada no mercado.",
        required: false,
        accept: "image/*",
      },
      {
        id: "priorityLevel",
        type: "scale",
        label: "Considering all other areas of your life (beyond the American market), from 1 to 10, what is your priority level for focusing on the mentorship and entering the market?",
        labelPt: "Considerando todos os outros campos da sua vida (além do mercado americano), de 1 a 10, qual o nível de prioridade para você estar focado na mentoria e entrar no mercado?",
        required: true,
        scaleMin: 1,
        scaleMax: 10,
        scaleMinLabel: "Not a priority",
        scaleMinLabelPt: "Não é prioridade",
        scaleMaxLabel: "Total priority",
        scaleMaxLabelPt: "Prioridade total",
      },
      {
        id: "contactPoints",
        type: "textarea",
        label: "What are the 2 best ways to contact you? We will use them to communicate better. For example: WhatsApp, audio, phone call, etc.",
        labelPt: "Quais são os 02 melhores pontos de contato com você? Nós os usaremos para nos comunicarmos melhor. Por exemplo: Whatsapp, áudio, ligação, etc.",
        required: true,
      },
      {
        id: "specialNotes",
        type: "textarea",
        label: "Is there any observation or special need we should know about your enrollment?",
        labelPt: "Há alguma observação ou necessidade especial que devemos saber sobre sua inscrição?",
        required: true,
      },
      {
        id: "friendReferrals",
        type: "textarea",
        label: "If you have two or more friends who you'd like to go through this process to enter the market, leave their contact below.",
        labelPt: "Se você tiver dois ou mais amigos que gostaria que estivessem nesse processo para entrar no mercado, deixe o contato deles abaixo.",
        required: false,
      },
      {
        id: "productAwareness",
        type: "radio",
        label: "Are you aware that the product acquired is an entry product to understand the American market, assist you in this process, and give you the necessary tools to achieve career relocation, but it does not guarantee employment or a visa?",
        labelPt: "Você está ciente que o produto adquirido é um produto de entrada para entender o mercado americano, te auxiliar nesse processo e te dar as ferramentas necessárias para chegar na recolocação, mas que não possui garantia de emprego ou visto?",
        required: true,
        options: [
          {
            value: "yes",
            label: "Yes, I am aware!",
            labelPt: "Sim, tenho ciência!",
          },
          {
            value: "no",
            label: "No, I will contact support to understand better!",
            labelPt: "Não, vou chamar o suporte para entender melhor!",
          },
        ],
      },
    ],
  },

  "nps-entry": {
    id: "nps-entry",
    title: "Carreira USA - Entry Feedback",
    titlePt: "Carreira USA - Feedback de Entrada",
    description:
      "Help us understand your expectations at the start of your journey.",
    descriptionPt:
      "Nos ajude a entender suas expectativas no início da sua jornada.",
    fields: [
      {
        id: NPS_SCORE_FIELD,
        type: "scale",
        label:
          "How likely are you to recommend Carreira USA to a friend or colleague?",
        labelPt:
          "Qual a probabilidade de você recomendar a Carreira USA a um amigo ou colega?",
        required: true,
        scaleMin: 0,
        scaleMax: 10,
        scaleMinLabel: "0 - Not likely",
        scaleMinLabelPt: "0 - Pouco provável",
        scaleMaxLabel: "10 - Extremely likely",
        scaleMaxLabelPt: "10 - Muito provável",
      },
      {
        id: "npsComment",
        type: "textarea",
        label: "What is the main reason for your score?",
        labelPt: "Qual é o principal motivo da sua nota?",
        required: false,
      },
    ],
  },

  "nps-exit": {
    id: "nps-exit",
    title: "Carreira USA - Exit Feedback",
    titlePt: "Carreira USA - Feedback de Saída",
    description:
      "Tell us how your journey felt now that this cycle is ending.",
    descriptionPt:
      "Conte para nós como foi sua jornada agora que este ciclo está terminando.",
    fields: [
      {
        id: NPS_SCORE_FIELD,
        type: "scale",
        label:
          "How likely are you to recommend Carreira USA to a friend or colleague?",
        labelPt:
          "Qual a probabilidade de você recomendar a Carreira USA a um amigo ou colega?",
        required: true,
        scaleMin: 0,
        scaleMax: 10,
        scaleMinLabel: "0 - Not likely",
        scaleMinLabelPt: "0 - Pouco provável",
        scaleMaxLabel: "10 - Extremely likely",
        scaleMaxLabelPt: "10 - Muito provável",
      },
      {
        id: "npsComment",
        type: "textarea",
        label: "What should we keep doing or improve?",
        labelPt: "O que deveríamos continuar fazendo ou melhorar?",
        required: false,
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the FormTemplate for the given slug, or `null` if it does not exist.
 */
export function getTemplate(slug: string): FormTemplate | null {
  return FORM_TEMPLATES[slug] ?? null;
}
