/**
 * Central changelog and version info.
 * Keep only highlights — one impactful line per improvement, no redundancy.
 *
 * Two changelogs:
 * - `changelog` (admin) — internal team updates (integrations, sync, workflows)
 * - `hubChangelog` (client) — client-facing improvements only
 */

import packageJson from "../package.json";

export const APP_VERSION = packageJson.version;
export const APP_VERSION_LABEL = `V${APP_VERSION.split(".")[0]}`;

export type ChangelogEntry = {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  titlePt?: string;
  items: { text: string; textPt?: string; type: "feature" | "fix" | "improvement" }[];
};

/** Admin dashboard changelog — internal team */
export const changelog: ChangelogEntry[] = [
  {
    version: APP_VERSION,
    date: "2026-05-19",
    title: "Platform V3",
    titlePt: "Plataforma V3",
    items: [
      { text: "Hub V3 with recurring invoices, AI mock interview, and realtime English test workflows.", textPt: "Hub V3 com faturas recorrentes, mock interview com IA e fluxos de teste de inglês em tempo real.", type: "feature" },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-03-18",
    title: "Client Portal Launch",
    titlePt: "Lançamento Portal do Cliente",
    items: [
      { text: "Client hub with bilingual support", textPt: "Portal bilíngue (EN/PT-BR)", type: "feature" },
      { text: "Online payments (Card & ACH)", textPt: "Pagamentos online (Cartão e ACH)", type: "feature" },
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

/** Client hub changelog — client-facing only, no internal details */
export const hubChangelog: ChangelogEntry[] = [
  {
    version: APP_VERSION,
    date: "2026-05-19",
    title: "Portal V3",
    titlePt: "Portal V3",
    items: [
      { text: "New portal version with AI mock interview, live English testing, and a better invoice experience.", textPt: "Nova versão do portal com mock interview com IA, teste de inglês ao vivo e melhor experiência de faturas.", type: "feature" },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-03-18",
    title: "Portal Launch",
    titlePt: "Lançamento do Portal",
    items: [
      { text: "View and pay invoices online", textPt: "Visualize e pague faturas online", type: "feature" },
      { text: "Track your progress", textPt: "Acompanhe seu progresso", type: "feature" },
      { text: "Available in English and Portuguese", textPt: "Disponível em inglês e português", type: "feature" },
    ],
  },
];

export const latestAdminChangelog = changelog[0];
export const latestHubChangelog = hubChangelog[0];
