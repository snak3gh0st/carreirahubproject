// lib/ops/phase-checklists.ts

export type ChecklistItemType = "whatsapp" | "form" | "session" | "doc" | "advance";

export interface ChecklistItem {
  key: string;
  label: string;
  type: ChecklistItemType;
  /** System marks this automatically (do not show manual checkbox) */
  autoComplete?: boolean;
  /** Only enabled when all previous items in the list are completed */
  requiresAll?: boolean;
}

export const PHASE_CHECKLISTS: Record<string, ChecklistItem[]> = {
  bastao: [
    { key: "welcome_whatsapp",         label: "Boas-vindas enviada por WhatsApp",    type: "whatsapp" },
    { key: "onboarding_form_assigned", label: "Formulário de Onboarding atribuído",  type: "form" },
    { key: "onboarding_form_completed",label: "Formulário de Onboarding respondido", type: "form", autoComplete: true },
    { key: "session_1",                label: "1ª Sessão realizada",                 type: "session", autoComplete: true },
    { key: "session_2",                label: "2ª Sessão realizada",                 type: "session", autoComplete: true },
    { key: "summary_whatsapp",         label: "Resumo da fase enviado ao aluno",     type: "whatsapp" },
    { key: "vision_doc",               label: "Documento de Visão revisado",         type: "doc" },
    { key: "advance_phase",            label: "Aluno avançado para próxima fase",    type: "advance", requiresAll: true },
  ],
  // TODO: define checklist items for each additional phase below.
  // Follow the bastao pattern. Use the exact phase key from mentorship_phases.key in the DB.
  // Example stub for each phase:
  // ancora: [
  //   { key: "session_1", label: "1ª Sessão de Âncora", type: "session", autoComplete: true },
  //   { key: "advance_phase", label: "Aluno avançado para próxima fase", type: "advance", requiresAll: true },
  // ],
};

/**
 * Maps a phase key to the ordered list of session item keys.
 * When a session is logged, the system looks up the session count and marks
 * the nth session key (e.g. 1st session → session_1).
 */
export const SESSION_ITEM_SEQUENCE: Record<string, string[]> = {
  bastao: ["session_1", "session_2"],
  // Add other phases here matching their session item keys.
};

export function getPhaseChecklist(phaseKey: string): ChecklistItem[] {
  return PHASE_CHECKLISTS[phaseKey] ?? [];
}

export function getSessionItemKey(phaseKey: string, sessionCount: number): string | null {
  const sequence = SESSION_ITEM_SEQUENCE[phaseKey];
  if (!sequence) return null;
  return sequence[sessionCount - 1] ?? null;
}
