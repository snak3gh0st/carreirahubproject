/**
 * Central changelog and version info.
 * Add new entries at the TOP of the array (newest first).
 * Keep only highlights — one impactful line per improvement, no redundancy.
 */

export const APP_VERSION = "2.2";

export type ChangelogEntry = {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  titlePt?: string;
  items: { text: string; textPt?: string; type: "feature" | "fix" | "improvement" }[];
};

export const changelog: ChangelogEntry[] = [
  {
    version: "2.2.0",
    date: "2026-03-25",
    title: "New Brand Identity",
    titlePt: "Nova Identidade Visual",
    items: [
      { text: "Complete Carreira U.S.A. visual rebrand", textPt: "Rebrand visual completo Carreira U.S.A.", type: "feature" },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-03-18",
    title: "Client Portal",
    titlePt: "Portal do Cliente",
    items: [
      { text: "Bilingual client hub (EN/PT-BR)", textPt: "Portal bilíngue (EN/PT-BR)", type: "feature" },
      { text: "Online payments (Card & ACH)", textPt: "Pagamentos online (Cartão e ACH)", type: "feature" },
      { text: "Onboarding forms & progress tracking", textPt: "Formulários e acompanhamento de progresso", type: "feature" },
    ],
  },
  {
    version: "0.9.0",
    date: "2026-03-10",
    title: "Dashboard Improvements",
    titlePt: "Melhorias no Painel",
    items: [
      { text: "English proficiency test on customer profile", textPt: "Teste de proficiência no perfil do cliente", type: "feature" },
      { text: "Better invoice workflow & QuickBooks sync", textPt: "Fluxo de faturas e sync QuickBooks aprimorados", type: "improvement" },
    ],
  },
  {
    version: "0.8.0",
    date: "2026-02-28",
    title: "Payments & Security",
    titlePt: "Pagamentos e Segurança",
    items: [
      { text: "PCI compliance & DocuSign contracts", textPt: "Conformidade PCI e contratos DocuSign", type: "feature" },
    ],
  },
];
