/**
 * Central changelog and version info.
 * Add new entries at the TOP of the array (newest first).
 */

export const APP_VERSION = "1.0.0";

export type ChangelogEntry = {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  titlePt?: string;
  items: { text: string; textPt?: string; type: "feature" | "fix" | "improvement" }[];
};

export const changelog: ChangelogEntry[] = [
  {
    version: "1.0.0",
    date: "2026-03-18",
    title: "Client Portal Launch",
    titlePt: "Lançamento do Portal do Cliente",
    items: [
      { text: "Client Hub with bilingual support (EN/PT-BR)", textPt: "Portal do Cliente com suporte bilíngue (EN/PT-BR)", type: "feature" },
      { text: "Online payment via Credit Card and ACH", textPt: "Pagamento online via Cartão de Crédito e ACH", type: "feature" },
      { text: "Programa Pass onboarding form", textPt: "Formulário de onboarding do Programa Pass", type: "feature" },
      { text: "Document downloads (contracts & receipts)", textPt: "Download de documentos (contratos e recibos)", type: "feature" },
      { text: "Visual progress tracking", textPt: "Acompanhamento visual de progresso", type: "feature" },
    ],
  },
  {
    version: "0.9.0",
    date: "2026-03-10",
    title: "Admin Dashboard Enhancements",
    titlePt: "Melhorias no Painel Administrativo",
    items: [
      { text: "English proficiency test results on customer profile", textPt: "Resultados de teste de proficiência em inglês no perfil do cliente", type: "feature" },
      { text: "Improved invoice creation workflow", textPt: "Fluxo de criação de faturas aprimorado", type: "improvement" },
      { text: "QuickBooks sync reliability improvements", textPt: "Melhorias na confiabilidade de sincronização com QuickBooks", type: "fix" },
    ],
  },
  {
    version: "0.8.0",
    date: "2026-02-28",
    title: "Payment & Security Updates",
    titlePt: "Atualizações de Pagamento e Segurança",
    items: [
      { text: "PCI compliance hardening for payment endpoints", textPt: "Reforço de conformidade PCI para endpoints de pagamento", type: "improvement" },
      { text: "Security headers on all API responses", textPt: "Headers de segurança em todas as respostas de API", type: "improvement" },
      { text: "DocuSign contract integration", textPt: "Integração de contratos via DocuSign", type: "feature" },
    ],
  },
];
