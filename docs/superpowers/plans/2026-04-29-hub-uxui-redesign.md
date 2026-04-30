# Hub do Cliente — Redesign UX/UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the client hub portal with modern, friendly UX — 5-section top-nav (Início, Financeiro, Meu Programa, Documentos, Conta), richer data from all 3 systems (commercial/operational/financial), and consistent visual polish.

**Architecture:** Server components for data pages (Prisma queries directly via JWT payload), client component for Conta (form state). New routes `/hub/financeiro`, `/hub/programa`, `/hub/documentos`, `/hub/conta` are created; old routes `/hub/settings`, `/hub/documents`, `/hub/status`, `/hub/forms`, `/hub/test` remain accessible (backwards compat for email links). `HubNavLinks` is extracted as a client component to handle mobile hamburger while keeping the layout a server component.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS v4, Prisma + PostgreSQL, `lib/i18n/hub.ts` for translations, JWT cookie `hub-token` for auth (decoded in server components), `getHubAuth()` for API routes.

---

## File Map

**Create:**
- `app/hub/HubNavLinks.tsx` — client component: desktop nav links + mobile hamburger drawer
- `app/hub/financeiro/page.tsx` — Financeiro section (server component)
- `app/hub/programa/page.tsx` — Meu Programa section (server component)
- `app/hub/documentos/page.tsx` — Documentos redesign (server component)
- `app/hub/conta/page.tsx` — Conta redesign (client component)

**Modify:**
- `lib/i18n/hub.ts` — add translation keys for all new sections
- `app/hub/layout.tsx` — new header with nav links + avatar
- `app/hub/page.tsx` — Início redesign (server component)

**Redirect (add single line):**
- `app/hub/settings/page.tsx` — redirect to `/hub/conta`
- `app/hub/documents/page.tsx` — redirect to `/hub/documentos`

---

## Task 1: Add i18n keys for new sections

**Files:**
- Modify: `lib/i18n/hub.ts`

- [ ] **Step 1: Add keys to the English translations object**

Find the closing brace of the `en` object and add these keys before it:

```typescript
    // Navigation
    "navigation.inicio": "Home",
    "navigation.financeiro": "Financial",
    "navigation.programa": "My Program",
    "navigation.documentos": "Documents",
    "navigation.conta": "Account",

    // Início
    "inicio.hello": "Hello",
    "inicio.since": "Since",
    "inicio.currentPhase": "Current Phase",
    "inicio.openBalance": "Open Balance",
    "inicio.totalPaid": "Total Paid",
    "inicio.englishLevel": "English Level",
    "inicio.pendingForms": "Pending Forms",
    "inicio.notTaken": "Not taken",
    "inicio.pending": "pending",
    "inicio.allDone": "all done",
    "inicio.installments": "installments",
    "inicio.invoice": "invoice",
    "inicio.invoicesPaid": "invoices paid",
    "inicio.alertInvoiceOverdue": "Invoice is overdue",
    "inicio.alertInvoiceDue": "Invoice due soon",
    "inicio.alertFormsPending": "forms waiting for your response",
    "inicio.payNow": "Pay Now",
    "inicio.fillNow": "Fill Now →",
    "inicio.financeirotSubtitle": "Invoices & payments",
    "inicio.programaSubtitle": "Phases & progress",
    "inicio.documentosSubtitle": "Contracts & receipts",
    "inicio.testSubtitle": "English test",

    // Financeiro
    "financeiro.title": "Financial",
    "financeiro.nextDue": "Next Due",
    "financeiro.installmentPlan": "Installment Plan",
    "financeiro.paidInstallments": "paid",
    "financeiro.openInstallments": "open",
    "financeiro.futureInstallments": "upcoming",
    "financeiro.total": "Total",
    "financeiro.openInvoices": "Open Invoices",
    "financeiro.noOpenInvoices": "No open invoices. You're all caught up!",
    "financeiro.paymentHistory": "Payment History",
    "financeiro.noHistory": "No payments yet.",
    "financeiro.receiptLink": "Receipt →",
    "financeiro.overdueBy": "Overdue by",
    "financeiro.dueIn": "Due in",
    "financeiro.days": "days",

    // Meu Programa
    "programa.title": "My Program",
    "programa.activeProgram": "Active Program",
    "programa.since": "Started",
    "programa.phases": "phases",
    "programa.months": "months",
    "programa.currentPhase": "current phase",
    "programa.onboardingJourney": "Onboarding Journey",
    "programa.formsTitle": "Operational Forms",
    "programa.testTitle": "English Test",
    "programa.fillNow": "Fill Now →",
    "programa.submitted": "Submitted",
    "programa.pending": "Pending",
    "programa.takeTest": "Take Test Now",
    "programa.viewResult": "View full result →",
    "programa.notTaken": "Not taken yet",
    "programa.awaitingEnrollment": "Awaiting enrollment by the team",
    "programa.completeSteps": "Complete previous steps",
    "programa.noProgram": "No active program found.",

    // Documentos
    "documentos.title": "Documents",
    "documentos.subtitle": "Your legal and financial documents",
    "documentos.contracts": "Signed Contracts",
    "documentos.receipts": "Payment Receipts",
    "documentos.docusignVerified": "DocuSign verified",
    "documentos.view": "View",
    "documentos.download": "Download",
    "documentos.noContracts": "No signed contracts yet. Contact your Carreira team.",
    "documentos.installment": "Installment",
    "documentos.of": "of",
    "documentos.noDocuments": "No documents found.",

    // Conta
    "conta.title": "Account",
    "conta.activeAccount": "Active account",
    "conta.languageSubtitle": "Changes the language across the entire platform",
    "conta.passwordSubtitle": "Minimum 8 characters",
    "conta.currentPassword": "Current Password",
    "conta.newPassword": "New Password",
    "conta.confirmPassword": "Confirm New Password",
    "conta.updatePassword": "Update Password",
    "conta.updating": "Updating...",
    "conta.signOut": "Sign Out",
    "conta.passwordSuccess": "Password updated successfully.",
    "conta.passwordError": "Failed to update password.",
```

- [ ] **Step 2: Add the same keys to the pt-BR translations object**

Find the pt-BR translations and add:

```typescript
    // Navigation
    "navigation.inicio": "Início",
    "navigation.financeiro": "Financeiro",
    "navigation.programa": "Meu Programa",
    "navigation.documentos": "Documentos",
    "navigation.conta": "Conta",

    // Início
    "inicio.hello": "Olá",
    "inicio.since": "Desde",
    "inicio.currentPhase": "Fase Atual",
    "inicio.openBalance": "Em Aberto",
    "inicio.totalPaid": "Total Pago",
    "inicio.englishLevel": "Inglês",
    "inicio.pendingForms": "Forms Pendentes",
    "inicio.notTaken": "Não realizado",
    "inicio.pending": "pendente(s)",
    "inicio.allDone": "tudo concluído",
    "inicio.installments": "parcelas",
    "inicio.invoice": "fatura",
    "inicio.invoicesPaid": "faturas pagas",
    "inicio.alertInvoiceOverdue": "Fatura está vencida",
    "inicio.alertInvoiceDue": "Fatura vencendo em breve",
    "inicio.alertFormsPending": "forms aguardando sua resposta",
    "inicio.payNow": "Pagar Agora",
    "inicio.fillNow": "Preencher Agora →",
    "inicio.financeirotSubtitle": "Faturas e pagamentos",
    "inicio.programaSubtitle": "Fases e progresso",
    "inicio.documentosSubtitle": "Contratos e recibos",
    "inicio.testSubtitle": "Teste de inglês",

    // Financeiro
    "financeiro.title": "Financeiro",
    "financeiro.nextDue": "Próx. Vencimento",
    "financeiro.installmentPlan": "Plano de Parcelas",
    "financeiro.paidInstallments": "pagas",
    "financeiro.openInstallments": "em aberto",
    "financeiro.futureInstallments": "futuras",
    "financeiro.total": "Total",
    "financeiro.openInvoices": "Faturas em Aberto",
    "financeiro.noOpenInvoices": "Nenhuma fatura em aberto. Tudo certo!",
    "financeiro.paymentHistory": "Histórico de Pagamentos",
    "financeiro.noHistory": "Nenhum pagamento ainda.",
    "financeiro.receiptLink": "Recibo →",
    "financeiro.overdueBy": "Vencida há",
    "financeiro.dueIn": "Vence em",
    "financeiro.days": "dias",

    // Meu Programa
    "programa.title": "Meu Programa",
    "programa.activeProgram": "Programa Ativo",
    "programa.since": "Iniciado em",
    "programa.phases": "fases",
    "programa.months": "meses",
    "programa.currentPhase": "fase atual",
    "programa.onboardingJourney": "Jornada de Onboarding",
    "programa.formsTitle": "Forms do Operacional",
    "programa.testTitle": "Teste de Inglês",
    "programa.fillNow": "Preencher →",
    "programa.submitted": "Enviado",
    "programa.pending": "Pendente",
    "programa.takeTest": "Fazer Teste Agora",
    "programa.viewResult": "Ver resultado completo →",
    "programa.notTaken": "Ainda não realizado",
    "programa.awaitingEnrollment": "Aguardando matrícula pela equipe",
    "programa.completeSteps": "Conclua as etapas anteriores",
    "programa.noProgram": "Nenhum programa ativo encontrado.",

    // Documentos
    "documentos.title": "Documentos",
    "documentos.subtitle": "Seus documentos legais e financeiros",
    "documentos.contracts": "Contratos Assinados",
    "documentos.receipts": "Recibos de Pagamento",
    "documentos.docusignVerified": "Verificado pelo DocuSign",
    "documentos.view": "Visualizar",
    "documentos.download": "Download",
    "documentos.noContracts": "Nenhum contrato assinado ainda. Entre em contato com sua equipe Carreira.",
    "documentos.installment": "Parcela",
    "documentos.of": "de",
    "documentos.noDocuments": "Nenhum documento encontrado.",

    // Conta
    "conta.title": "Conta",
    "conta.activeAccount": "Conta ativa",
    "conta.languageSubtitle": "Altera o idioma de toda a plataforma",
    "conta.passwordSubtitle": "Mínimo 8 caracteres",
    "conta.currentPassword": "Senha Atual",
    "conta.newPassword": "Nova Senha",
    "conta.confirmPassword": "Confirmar Nova Senha",
    "conta.updatePassword": "Atualizar Senha",
    "conta.updating": "Atualizando...",
    "conta.signOut": "Sair da Conta",
    "conta.passwordSuccess": "Senha atualizada com sucesso.",
    "conta.passwordError": "Falha ao atualizar a senha.",
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/pauloloureiro/Dev/SigmaProjects/carreirahubproject
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to i18n keys.

- [ ] **Step 4: Commit**

```bash
git add lib/i18n/hub.ts
git commit -m "feat(hub): add i18n keys for redesigned sections (inicio/financeiro/programa/documentos/conta)"
```

---

## Task 2: Create HubNavLinks client component

**Files:**
- Create: `app/hub/HubNavLinks.tsx`

- [ ] **Step 1: Create the component**

```typescript
// app/hub/HubNavLinks.tsx
"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { t, Language } from "@/lib/i18n/hub";

interface Props {
  lang: Language;
}

const NAV_ITEMS = [
  { labelKey: "navigation.inicio" as const, href: "/hub", exact: true },
  { labelKey: "navigation.financeiro" as const, href: "/hub/financeiro", exact: false },
  { labelKey: "navigation.programa" as const, href: "/hub/programa", exact: false },
  { labelKey: "navigation.documentos" as const, href: "/hub/documentos", exact: false },
];

export default function HubNavLinks({ lang }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden sm:flex items-center gap-0.5">
        {NAV_ITEMS.map(({ labelKey, href, exact }) => (
          <Link
            key={href}
            href={href}
            className={`px-3 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              isActive(href, exact)
                ? "text-brand-tangerina border-brand-tangerina"
                : "text-white/65 border-transparent hover:text-white hover:border-white/20"
            }`}
          >
            {t(lang, labelKey)}
          </Link>
        ))}
      </nav>

      {/* Mobile hamburger button */}
      <button
        className="sm:hidden flex items-center justify-center w-9 h-9 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
      >
        {open ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Mobile drawer */}
      {open && (
        <div className="sm:hidden absolute top-full left-0 right-0 bg-brand-verde border-t border-white/10 shadow-lg z-20">
          {NAV_ITEMS.map(({ labelKey, href, exact }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`block px-6 py-4 text-sm font-medium border-b border-white/5 transition-colors ${
                isActive(href, exact)
                  ? "text-brand-tangerina bg-white/5"
                  : "text-white/80 hover:text-white hover:bg-white/5"
              }`}
            >
              {t(lang, labelKey)}
            </Link>
          ))}
          <Link
            href="/hub/conta"
            onClick={() => setOpen(false)}
            className="block px-6 py-4 text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5"
          >
            {t(lang, "navigation.conta")}
          </Link>
          <form action="/api/hub/auth/logout" method="POST">
            <button
              type="submit"
              className="w-full text-left px-6 py-4 text-sm font-medium text-red-300 hover:text-red-200 hover:bg-white/5 transition-colors"
            >
              {t(lang, "conta.signOut")}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/hub/HubNavLinks.tsx
git commit -m "feat(hub): add HubNavLinks client component with desktop nav + mobile hamburger"
```

---

## Task 3: Update layout header

**Files:**
- Modify: `app/hub/layout.tsx`

- [ ] **Step 1: Replace the header section**

Replace the entire `<header>` block (from `{isAuthenticated && (` through the closing `)}` of the header) with:

```tsx
      {isAuthenticated && (
        <header className="bg-brand-verde sticky top-0 z-10 shadow-md">
          <div className="max-w-4xl mx-auto px-6 py-0 flex items-center gap-4 relative">
            {/* Logo */}
            <Link href="/hub" className="flex items-center gap-3 shrink-0 py-3.5">
              <Logo className="w-8 h-8" />
              <span className="font-display font-bold text-white text-sm hidden md:block">
                Carreira <span className="text-brand-tangerina">U.S.A.</span>
              </span>
            </Link>

            {/* Nav links — flex-1 so it fills the middle */}
            <div className="flex-1 flex items-stretch h-full">
              <HubNavLinks lang={lang} />
            </div>

            {/* Right: language, news, avatar */}
            <div className="flex items-center gap-2 shrink-0 py-3.5">
              <LanguageToggle currentLang={lang} />
              <NewsNotification lang={lang} />
              <Link
                href="/hub/conta"
                className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-tangerina text-white text-xs font-bold hover:opacity-90 transition-opacity"
                title={t(lang, "navigation.conta")}
              >
                {(payload.name as string | undefined)
                  ? (payload.name as string).charAt(0).toUpperCase()
                  : (payload.email as string | undefined)?.charAt(0).toUpperCase() ?? "U"}
              </Link>
            </div>
          </div>
        </header>
      )}
```

- [ ] **Step 2: Add HubNavLinks import at the top of the file**

Add after the existing imports:

```tsx
import HubNavLinks from "./HubNavLinks";
```

- [ ] **Step 3: Verify the layout still compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/hub/layout.tsx
git commit -m "feat(hub): update header — 4-section nav links + avatar → Conta, hamburger on mobile"
```

---

## Task 4: Redesign Início (dashboard) page

**Files:**
- Modify: `app/hub/page.tsx`

- [ ] **Step 1: Replace the entire file content**

```tsx
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { t, Language } from "@/lib/i18n/hub";
import { InvoiceStatus, FormAssignmentStatus } from "@prisma/client";

function getPayload(token: string) {
  try {
    const [, b64] = token.split(".");
    return JSON.parse(Buffer.from(b64!, "base64url").toString());
  } catch {
    return null;
  }
}

function fmtAmount(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function HubHomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("hub-token")?.value;
  if (!token) redirect("/hub/login");
  const payload = getPayload(token);
  if (!payload?.customerId) redirect("/hub/login");

  const lang = (payload.language || "en") as Language;
  const dateLocale = lang === "pt-BR" ? "pt-BR" : "en-US";
  const customerId: string = payload.customerId;

  const [invoices, placementTest, formAssignments, enrollment, deal] = await Promise.all([
    prisma.invoice.findMany({
      where: { customerId },
      select: { id: true, status: true, amount: true, amountPaid: true, dueDate: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.placementTest.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: { displayLevel: true, cefrLevel: true },
    }),
    prisma.formAssignment.findMany({
      where: { customerId },
      select: { status: true },
    }),
    prisma.mentorshipEnrollment.findFirst({
      where: { customerId, status: "ACTIVE" },
      select: { currentPhase: { select: { label: true } } },
    }),
    prisma.deal.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: { title: true, createdAt: true },
    }),
  ]);

  // Financials
  const openInvoices = invoices.filter((i) =>
    [InvoiceStatus.SENT, InvoiceStatus.OVERDUE, InvoiceStatus.PARTIALLY_PAID].includes(i.status as InvoiceStatus)
  );
  const totalDue = openInvoices.reduce(
    (sum, i) => sum + (Number(i.amount) - Number(i.amountPaid ?? 0)),
    0
  );
  const paidInvoices = invoices.filter((i) => i.status === InvoiceStatus.PAID);
  const totalPaid = paidInvoices.reduce((sum, i) => sum + Number(i.amount), 0);

  // Smart alert (priority: overdue > due-soon > forms)
  const overdueInv = invoices.find((i) => i.status === InvoiceStatus.OVERDUE);
  const soonInv = !overdueInv
    ? openInvoices.find((i) => {
        if (!i.dueDate || i.status !== InvoiceStatus.SENT) return false;
        const days = Math.ceil((new Date(i.dueDate).getTime() - Date.now()) / 86400000);
        return days >= 0 && days <= 7;
      })
    : undefined;
  const alertInv = overdueInv ?? soonInv;
  const pendingForms = formAssignments.filter(
    (f) => f.status !== FormAssignmentStatus.COMPLETED
  ).length;

  // Alert label
  const alertDays = alertInv?.dueDate
    ? Math.abs(Math.ceil((new Date(alertInv.dueDate).getTime() - Date.now()) / 86400000))
    : 0;
  const alertAmountDue = alertInv
    ? Number(alertInv.amount) - Number(alertInv.amountPaid ?? 0)
    : 0;

  // Program info
  const programName = deal?.title ?? "";
  const programSince = deal?.createdAt
    ? new Date(deal.createdAt).toLocaleDateString(dateLocale, { month: "short", year: "numeric" })
    : "";
  const phaseLabel = enrollment?.currentPhase?.label ?? "";
  const firstName = (payload.name as string | undefined)?.split(" ")[0]
    ?? (payload.email as string | undefined)?.split("@")[0]
    ?? "";

  return (
    <div className="space-y-4">
      {/* Welcome hero */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 flex items-start sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {t(lang, "inicio.hello")}, {firstName} 👋
          </h1>
          {programName && (
            <p className="text-sm text-gray-500 mt-1 truncate">
              {programName}
              {programSince && (
                <> · {t(lang, "inicio.since")} {programSince}</>
              )}
            </p>
          )}
        </div>
        {phaseLabel && (
          <div className="shrink-0 bg-orange-50 rounded-xl px-4 py-3 text-center min-w-[88px]">
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">
              {t(lang, "inicio.currentPhase")}
            </p>
            <p className="text-base font-bold text-brand-tangerina leading-tight">{phaseLabel}</p>
          </div>
        )}
      </div>

      {/* Smart alert */}
      {alertInv && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-700 truncate">
                {overdueInv
                  ? `${t(lang, "inicio.alertInvoiceOverdue")} — ${alertDays} ${t(lang, "financeiro.days")}`
                  : `${t(lang, "inicio.alertInvoiceDue")} — ${alertDays} ${t(lang, "financeiro.days")}`}
              </p>
              <p className="text-xs text-red-500 mt-0.5">${fmtAmount(alertAmountDue)}</p>
            </div>
          </div>
          <Link
            href={`/hub/pay/${alertInv.id}`}
            className="shrink-0 bg-red-500 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-red-600 transition-colors whitespace-nowrap"
          >
            {t(lang, "inicio.payNow")}
          </Link>
        </div>
      )}
      {!alertInv && pendingForms > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 bg-brand-tangerina rounded-full flex-shrink-0" />
            <p className="text-sm font-semibold text-orange-700">
              {pendingForms} {t(lang, "inicio.alertFormsPending")}
            </p>
          </div>
          <Link
            href="/hub/programa"
            className="shrink-0 bg-brand-tangerina text-white text-xs font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            {t(lang, "inicio.fillNow")}
          </Link>
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            {t(lang, "inicio.openBalance")}
          </p>
          <p className={`text-xl sm:text-2xl font-extrabold ${totalDue > 0 ? "text-red-600" : "text-green-600"}`}>
            ${fmtAmount(totalDue)}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            {openInvoices.length} {t(lang, "inicio.invoice")}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            {t(lang, "inicio.totalPaid")}
          </p>
          <p className="text-xl sm:text-2xl font-extrabold text-green-600">${fmtAmount(totalPaid)}</p>
          <p className="text-[11px] text-gray-400 mt-1">
            {paidInvoices.length} {t(lang, "inicio.installments")}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            {t(lang, "inicio.englishLevel")}
          </p>
          {placementTest ? (
            <>
              <p className="text-xl sm:text-2xl font-extrabold text-blue-600">{placementTest.cefrLevel}</p>
              <p className="text-[11px] text-gray-400 mt-1">{placementTest.displayLevel}</p>
            </>
          ) : (
            <>
              <p className="text-xl sm:text-2xl font-extrabold text-gray-300">—</p>
              <p className="text-[11px] text-gray-400 mt-1">{t(lang, "inicio.notTaken")}</p>
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            {t(lang, "inicio.pendingForms")}
          </p>
          <p className={`text-xl sm:text-2xl font-extrabold ${pendingForms > 0 ? "text-brand-tangerina" : "text-green-600"}`}>
            {pendingForms > 0 ? pendingForms : "✓"}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            {pendingForms > 0 ? t(lang, "inicio.pending") : t(lang, "inicio.allDone")}
          </p>
        </div>
      </div>

      {/* Quick nav cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          href="/hub/financeiro"
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 text-center hover:border-gray-200 hover:shadow-md transition-all"
        >
          <div className="text-2xl mb-2">💰</div>
          <p className="text-sm font-semibold text-gray-900">{t(lang, "navigation.financeiro")}</p>
          <p className="text-[11px] text-gray-400 mt-1">{t(lang, "inicio.financeirotSubtitle")}</p>
        </Link>

        <Link
          href="/hub/programa"
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 text-center hover:border-gray-200 hover:shadow-md transition-all"
        >
          <div className="text-2xl mb-2">🎓</div>
          <p className="text-sm font-semibold text-gray-900">{t(lang, "navigation.programa")}</p>
          <p className="text-[11px] text-gray-400 mt-1">{t(lang, "inicio.programaSubtitle")}</p>
        </Link>

        <Link
          href="/hub/documentos"
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 text-center hover:border-gray-200 hover:shadow-md transition-all"
        >
          <div className="text-2xl mb-2">📄</div>
          <p className="text-sm font-semibold text-gray-900">{t(lang, "navigation.documentos")}</p>
          <p className="text-[11px] text-gray-400 mt-1">{t(lang, "inicio.documentosSubtitle")}</p>
        </Link>

        {pendingForms > 0 ? (
          <Link
            href="/hub/programa"
            className="bg-gradient-to-br from-orange-50 to-white rounded-2xl border-2 border-brand-tangerina shadow-sm p-4 sm:p-5 text-center hover:opacity-90 transition-opacity"
          >
            <div className="text-2xl mb-2">📋</div>
            <p className="text-sm font-semibold text-brand-tangerina">
              {pendingForms} {t(lang, "inicio.pendingForms")}
            </p>
            <p className="text-[11px] text-orange-400 mt-1">{t(lang, "inicio.fillNow")}</p>
          </Link>
        ) : (
          <Link
            href="/hub/test"
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 text-center hover:border-gray-200 hover:shadow-md transition-all"
          >
            <div className="text-2xl mb-2">🎯</div>
            <p className="text-sm font-semibold text-gray-900">{t(lang, "dashboard.englishTest")}</p>
            <p className="text-[11px] text-gray-400 mt-1">{t(lang, "inicio.testSubtitle")}</p>
          </Link>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add app/hub/page.tsx
git commit -m "feat(hub): redesign Início page — hero, smart alert, KPI grid, quick nav cards"
```

---

## Task 5: Create Financeiro page

**Files:**
- Create: `app/hub/financeiro/page.tsx`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p app/hub/financeiro
```

- [ ] **Step 2: Write the page**

```tsx
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { t, Language } from "@/lib/i18n/hub";
import { InvoiceStatus } from "@prisma/client";

function getPayload(token: string) {
  try {
    const [, b64] = token.split(".");
    return JSON.parse(Buffer.from(b64!, "base64url").toString());
  } catch {
    return null;
  }
}

function fmtAmount(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function FinanceiroPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("hub-token")?.value;
  if (!token) redirect("/hub/login");
  const payload = getPayload(token);
  if (!payload?.customerId) redirect("/hub/login");

  const lang = (payload.language || "en") as Language;
  const dateLocale = lang === "pt-BR" ? "pt-BR" : "en-US";
  const customerId: string = payload.customerId;

  const invoices = await prisma.invoice.findMany({
    where: { customerId },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      amount: true,
      amountPaid: true,
      dueDate: true,
      paidAt: true,
    },
    orderBy: { dueDate: "asc" },
  });

  // Segment invoices
  const openStatuses = [InvoiceStatus.SENT, InvoiceStatus.OVERDUE, InvoiceStatus.PARTIALLY_PAID];
  const openInvoices = invoices.filter((i) => openStatuses.includes(i.status as InvoiceStatus));
  const paidInvoices = invoices
    .filter((i) => i.status === InvoiceStatus.PAID)
    .sort((a, b) => new Date(b.paidAt ?? 0).getTime() - new Date(a.paidAt ?? 0).getTime());

  const totalDue = openInvoices.reduce(
    (sum, i) => sum + (Number(i.amount) - Number(i.amountPaid ?? 0)),
    0
  );
  const totalPaid = paidInvoices.reduce((sum, i) => sum + Number(i.amount), 0);

  // Next due (earliest unpaid)
  const nextDue = invoices
    .filter((i) => i.status === InvoiceStatus.SENT && i.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())[0];

  // Installment bar colors per invoice
  function barColor(status: string) {
    if (status === InvoiceStatus.PAID) return "bg-green-500";
    if (status === InvoiceStatus.OVERDUE) return "bg-red-500";
    if (status === InvoiceStatus.PARTIALLY_PAID) return "bg-yellow-400";
    if (status === InvoiceStatus.SENT) {
      // check if due soon (≤7 days)
      return "bg-orange-400";
    }
    return "bg-gray-200";
  }

  // Days status for open invoices
  function daysStatus(inv: (typeof invoices)[0]) {
    if (!inv.dueDate) return null;
    const days = Math.ceil((new Date(inv.dueDate).getTime() - Date.now()) / 86400000);
    if (inv.status === InvoiceStatus.OVERDUE || days < 0) {
      return {
        label: `${t(lang, "financeiro.overdueBy")} ${Math.abs(days)} ${t(lang, "financeiro.days")}`,
        badgeClass: "bg-red-50 text-red-700",
        borderClass: "border-red-300",
      };
    }
    if (days <= 7) {
      return {
        label: `${t(lang, "financeiro.dueIn")} ${days} ${t(lang, "financeiro.days")}`,
        badgeClass: "bg-orange-50 text-orange-700",
        borderClass: "border-orange-300",
      };
    }
    return {
      label: `${t(lang, "financeiro.dueIn")} ${days} ${t(lang, "financeiro.days")}`,
      badgeClass: "bg-gray-100 text-gray-600",
      borderClass: "border-gray-200",
    };
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t(lang, "financeiro.title")}</h1>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            {t(lang, "inicio.openBalance")}
          </p>
          <p className={`text-xl sm:text-2xl font-extrabold ${totalDue > 0 ? "text-red-600" : "text-green-600"}`}>
            ${fmtAmount(totalDue)}
          </p>
          {totalDue > 0 && (
            <p className="text-[11px] text-red-400 mt-1">
              {openInvoices.length} {t(lang, "inicio.invoice")}
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            {t(lang, "inicio.totalPaid")}
          </p>
          <p className="text-xl sm:text-2xl font-extrabold text-green-600">${fmtAmount(totalPaid)}</p>
          <p className="text-[11px] text-gray-400 mt-1">
            {paidInvoices.length} {t(lang, "inicio.installments")}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            {t(lang, "financeiro.nextDue")}
          </p>
          {nextDue?.dueDate ? (
            <>
              <p className="text-xl sm:text-2xl font-extrabold text-gray-900">
                {new Date(nextDue.dueDate).toLocaleDateString(dateLocale, { month: "short", day: "numeric" })}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">${fmtAmount(Number(nextDue.amount) - Number(nextDue.amountPaid ?? 0))}</p>
            </>
          ) : (
            <p className="text-xl sm:text-2xl font-extrabold text-gray-300">—</p>
          )}
        </div>
      </div>

      {/* Installment progress bar */}
      {invoices.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-bold text-gray-900">{t(lang, "financeiro.installmentPlan")}</p>
            <p className="text-xs text-gray-400">
              {paidInvoices.length} {t(lang, "financeiro.paidInstallments")} ·{" "}
              {openInvoices.length} {t(lang, "financeiro.openInstallments")} ·{" "}
              {invoices.length - paidInvoices.length - openInvoices.length}{" "}
              {t(lang, "financeiro.futureInstallments")} · {t(lang, "financeiro.total")} $
              {fmtAmount(invoices.reduce((s, i) => s + Number(i.amount), 0))}
            </p>
          </div>
          <div className="flex gap-0.5 h-2">
            {invoices.map((inv, idx) => (
              <div
                key={inv.id}
                className={`flex-1 h-full ${barColor(inv.status)} ${
                  idx === 0 ? "rounded-l-full" : ""
                } ${idx === invoices.length - 1 ? "rounded-r-full" : ""}`}
                title={`${inv.invoiceNumber ?? inv.id.slice(0, 8)} — ${inv.status}`}
              />
            ))}
          </div>
          <div className="flex gap-4 mt-2">
            <span className="text-[10px] text-green-600 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              {t(lang, "financeiro.paidInstallments")} ({paidInvoices.length})
            </span>
            {openInvoices.length > 0 && (
              <span className="text-[10px] text-red-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                {t(lang, "financeiro.openInstallments")} ({openInvoices.length})
              </span>
            )}
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-200 inline-block" />
              {t(lang, "financeiro.futureInstallments")} ({invoices.length - paidInvoices.length - openInvoices.length})
            </span>
          </div>
        </div>
      )}

      {/* Open invoices */}
      <div>
        <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
          {t(lang, "financeiro.openInvoices")}
        </h2>
        {openInvoices.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
            <p className="text-sm text-gray-400">{t(lang, "financeiro.noOpenInvoices")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {openInvoices.map((inv) => {
              const ds = daysStatus(inv);
              const amountDue = Number(inv.amount) - Number(inv.amountPaid ?? 0);
              return (
                <div
                  key={inv.id}
                  className={`bg-white rounded-2xl border-2 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${ds?.borderClass ?? "border-gray-200"}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-bold text-gray-900">
                        #{inv.invoiceNumber ?? inv.id.slice(0, 8)}
                      </span>
                      {ds && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${ds.badgeClass}`}>
                          {ds.label}
                        </span>
                      )}
                    </div>
                    {inv.dueDate && (
                      <p className="text-xs text-gray-400">
                        {new Date(inv.dueDate).toLocaleDateString(dateLocale, { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 sm:gap-6">
                    <p className="text-xl font-extrabold text-red-600">${fmtAmount(amountDue)}</p>
                    <Link
                      href={`/hub/pay/${inv.id}`}
                      className="bg-red-500 hover:bg-red-600 transition-colors text-white text-sm font-semibold px-5 py-2.5 rounded-xl whitespace-nowrap"
                    >
                      {t(lang, "inicio.payNow")}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payment history */}
      <div>
        <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          {t(lang, "financeiro.paymentHistory")}
        </h2>
        {paidInvoices.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
            <p className="text-sm text-gray-400">{t(lang, "financeiro.noHistory")}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {paidInvoices.map((inv, idx) => (
              <div
                key={inv.id}
                className={`flex items-center gap-4 px-5 py-3.5 ${idx < paidInvoices.length - 1 ? "border-b border-gray-50" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    #{inv.invoiceNumber ?? inv.id.slice(0, 8)}
                  </p>
                  {inv.paidAt && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(inv.paidAt).toLocaleDateString(dateLocale, { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}
                </div>
                <p className="text-sm font-bold text-green-600">${fmtAmount(Number(inv.amount))}</p>
                <span className="bg-green-50 text-green-700 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide hidden sm:block">
                  {t(lang, "dashboard.paid")}
                </span>
                <Link
                  href={`/hub/documents/receipt/${inv.id}`}
                  className="text-xs text-gray-400 hover:text-gray-600 underline whitespace-nowrap"
                >
                  {t(lang, "financeiro.receiptLink")}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add app/hub/financeiro/
git commit -m "feat(hub): add Financeiro page — KPIs, installment bar, open invoices, payment history"
```

---

## Task 6: Create Meu Programa page

**Files:**
- Create: `app/hub/programa/page.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p app/hub/programa
```

- [ ] **Step 2: Write the page**

```tsx
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { t, Language } from "@/lib/i18n/hub";
import { ContractStatus, InvoiceStatus, FormAssignmentStatus } from "@prisma/client";
import { FORM_TEMPLATES } from "@/lib/hub/form-templates";

function getPayload(token: string) {
  try {
    const [, b64] = token.split(".");
    return JSON.parse(Buffer.from(b64!, "base64url").toString());
  } catch {
    return null;
  }
}

export default async function ProgramaPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("hub-token")?.value;
  if (!token) redirect("/hub/login");
  const payload = getPayload(token);
  if (!payload?.customerId) redirect("/hub/login");

  const lang = (payload.language || "en") as Language;
  const dateLocale = lang === "pt-BR" ? "pt-BR" : "en-US";
  const customerId: string = payload.customerId;

  const [contracts, invoices, formAssignments, placementTest, enrollment, deal] = await Promise.all([
    prisma.contract.findMany({
      where: { customerId },
      select: { status: true, signedAt: true },
    }),
    prisma.invoice.findMany({
      where: { customerId },
      select: { status: true, paidAt: true },
    }),
    prisma.formAssignment.findMany({
      where: { customerId },
      include: { submission: true },
      orderBy: { assignedAt: "desc" },
    }),
    prisma.placementTest.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: {
        displayLevel: true,
        cefrLevel: true,
        score: true,
        totalQuestions: true,
        createdAt: true,
        sectionScores: true,
      },
    }),
    prisma.mentorshipEnrollment.findFirst({
      where: { customerId, status: "ACTIVE" },
      select: { currentPhase: { select: { label: true } } },
    }),
    prisma.deal.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: { title: true, createdAt: true },
    }),
  ]);

  // Onboarding step logic (mirrors status route)
  const contractSigned = contracts.some((c) => c.status === ContractStatus.SIGNED);
  const contractDate = contracts.find((c) => c.status === ContractStatus.SIGNED)?.signedAt;
  const anyPaid = invoices.some((i) => i.status === InvoiceStatus.PAID);
  const firstPaidDate = invoices.find((i) => i.status === InvoiceStatus.PAID)?.paidAt;
  const totalForms = formAssignments.length;
  const completedForms = formAssignments.filter((f) => f.status === FormAssignmentStatus.COMPLETED).length;
  const onboardingFormsApplicable = totalForms > 0;
  const onboardingDone = !onboardingFormsApplicable || completedForms === totalForms;
  const testDone = !!placementTest;
  const phaseLabel = enrollment?.currentPhase?.label ?? "";

  type StepStatus = "completed" | "current" | "pending";

  interface Step {
    id: string;
    label: string;
    detail: string;
    status: StepStatus;
    badge?: React.ReactNode;
  }

  const steps: Step[] = [
    {
      id: "contract",
      label: t(lang, "status.contract"),
      status: contractSigned ? "completed" : "current",
      detail: contractSigned && contractDate
        ? new Date(contractDate).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })
        : lang === "pt-BR" ? "Pendente de assinatura" : "Pending signature",
    },
    {
      id: "payment",
      label: t(lang, "status.payment"),
      status: anyPaid ? "completed" : contractSigned ? "current" : "pending",
      detail: anyPaid && firstPaidDate
        ? new Date(firstPaidDate).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })
        : lang === "pt-BR" ? "Aguardando pagamento" : "Awaiting payment",
    },
    ...(onboardingFormsApplicable
      ? [
          {
            id: "onboarding",
            label: "Onboarding",
            status: (onboardingDone ? "completed" : anyPaid ? "current" : "pending") as StepStatus,
            detail: `${completedForms}/${totalForms} ${lang === "pt-BR" ? "formulários" : "forms"}`,
          },
        ]
      : []),
    {
      id: "test",
      label: t(lang, "programa.testTitle"),
      status: testDone ? "completed" : anyPaid ? "current" : "pending",
      detail: testDone
        ? `${placementTest!.cefrLevel} — ${placementTest!.displayLevel}`
        : t(lang, "programa.notTaken"),
      badge: testDone ? (
        <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
          {placementTest!.cefrLevel}
        </span>
      ) : undefined,
    },
    {
      id: "mentorship",
      label: t(lang, "status.mentorship"),
      status: phaseLabel ? "current" : "pending",
      detail: phaseLabel || (testDone ? t(lang, "programa.awaitingEnrollment") : t(lang, "programa.completeSteps")),
    },
  ];

  // Program info
  const programName = deal?.title ?? "";
  const programSince = deal?.createdAt
    ? new Date(deal.createdAt).toLocaleDateString(dateLocale, { month: "long", year: "numeric" })
    : "";

  // Pending and completed forms
  const pendingAssignments = formAssignments.filter((a) => a.status !== FormAssignmentStatus.COMPLETED);
  const completedAssignments = formAssignments.filter((a) => a.status === FormAssignmentStatus.COMPLETED);

  // Section scores (may be null/undefined on older tests)
  const sectionScores = placementTest?.sectionScores as Record<string, number> | null | undefined;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t(lang, "programa.title")}</h1>

      {/* Program hero */}
      {programName ? (
        <div className="bg-gradient-to-br from-brand-verde to-[#3d5c55] rounded-2xl p-5 sm:p-6 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-white/60 uppercase tracking-widest mb-2">
              {t(lang, "programa.activeProgram")}
            </p>
            <h2 className="text-lg sm:text-xl font-extrabold text-white truncate">{programName}</h2>
            {programSince && (
              <p className="text-sm text-white/60 mt-1">{t(lang, "programa.since")} {programSince}</p>
            )}
          </div>
          {phaseLabel && (
            <div className="shrink-0 text-center">
              <div className="w-16 h-16 rounded-full border-[3px] border-brand-tangerina flex items-center justify-center bg-brand-tangerina/15">
                <span className="text-xs font-bold text-brand-tangerina leading-tight text-center px-1 truncate max-w-[52px]">
                  {phaseLabel}
                </span>
              </div>
              <p className="text-[9px] text-brand-tangerina font-semibold mt-1.5">{t(lang, "programa.currentPhase")}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
          <p className="text-sm text-gray-400">{t(lang, "programa.noProgram")}</p>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left: Onboarding timeline */}
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-3">{t(lang, "programa.onboardingJourney")}</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {steps.map((step, idx) => (
              <div
                key={step.id}
                className={`flex items-center gap-4 px-5 py-4 ${
                  idx < steps.length - 1 ? "border-b border-gray-50" : ""
                } ${step.status === "current" ? "bg-orange-50/50" : ""}`}
              >
                {/* Status icon */}
                <div className="shrink-0">
                  {step.status === "completed" ? (
                    <div className="w-7 h-7 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : step.status === "current" ? (
                    <div className="w-7 h-7 bg-brand-tangerina rounded-full flex items-center justify-center ring-4 ring-orange-100">
                      <div className="w-2.5 h-2.5 bg-white rounded-full" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 bg-gray-100 rounded-full border-2 border-gray-200" />
                  )}
                </div>

                {/* Label + detail */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${
                    step.status === "current" ? "text-brand-tangerina" :
                    step.status === "completed" ? "text-gray-900" : "text-gray-400"
                  }`}>
                    {step.label}
                  </p>
                  <p className={`text-xs mt-0.5 ${step.status === "pending" ? "text-gray-300" : "text-gray-500"}`}>
                    {step.detail}
                  </p>
                </div>

                {/* Optional badge */}
                {step.badge && <div className="shrink-0">{step.badge}</div>}
                {step.status === "current" && (
                  <span className="shrink-0 bg-brand-tangerina text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                    {lang === "pt-BR" ? "Atual" : "Current"}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Forms + English test */}
        <div className="space-y-5">
          {/* Forms */}
          <div>
            <h2 className="text-sm font-bold text-gray-900 mb-3">{t(lang, "programa.formsTitle")}</h2>
            {formAssignments.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
                <p className="text-sm text-gray-400">{t(lang, "forms.noForms")}</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {[...pendingAssignments, ...completedAssignments].map((a, idx, arr) => {
                  const tpl = FORM_TEMPLATES[a.templateId];
                  const title = lang === "pt-BR" ? tpl?.titlePt : tpl?.title;
                  const isPending = a.status !== FormAssignmentStatus.COMPLETED;
                  return (
                    <div
                      key={a.id}
                      className={`flex items-center gap-3 px-5 py-3.5 ${idx < arr.length - 1 ? "border-b border-gray-50" : ""}`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isPending ? "bg-brand-tangerina" : "bg-green-500"}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${isPending ? "text-gray-900" : "text-gray-400"}`}>
                          {title ?? a.templateId}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(a.assignedAt).toLocaleDateString(dateLocale, { month: "short", day: "numeric" })}
                        </p>
                      </div>
                      {isPending ? (
                        <Link
                          href={`/hub/forms/${a.id}`}
                          className="shrink-0 bg-orange-50 text-brand-tangerina text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-orange-100 transition-colors"
                        >
                          {t(lang, "programa.fillNow")}
                        </Link>
                      ) : (
                        <span className="shrink-0 bg-green-50 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-lg">
                          ✓ {t(lang, "programa.submitted")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* English test card */}
          <div>
            <h2 className="text-sm font-bold text-gray-900 mb-3">{t(lang, "programa.testTitle")}</h2>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              {placementTest ? (
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                      <span className="text-lg font-extrabold text-blue-600">{placementTest.cefrLevel}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900">{placementTest.displayLevel}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {placementTest.createdAt
                          ? new Date(placementTest.createdAt).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })
                          : ""}
                        {placementTest.score != null && placementTest.totalQuestions != null
                          ? ` · ${placementTest.score}/${placementTest.totalQuestions}`
                          : ""}
                      </p>
                    </div>
                  </div>

                  {/* Section bars (only if sectionScores available) */}
                  {sectionScores && (
                    <div className="space-y-1.5">
                      {Object.entries(sectionScores).map(([section, score]) => (
                        <div key={section} className="flex items-center gap-3">
                          <p className="text-[10px] text-gray-400 w-20 truncate">{section}</p>
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${score >= 3 ? "bg-green-500" : "bg-red-400"}`}
                              style={{ width: `${(score / 5) * 100}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-400 w-6 text-right">{score}/5</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <Link
                    href="/hub/test/result"
                    className="block mt-4 text-xs text-gray-400 hover:text-gray-600 underline text-right"
                  >
                    {t(lang, "programa.viewResult")}
                  </Link>
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-sm text-gray-400 mb-4">{t(lang, "programa.notTaken")}</p>
                  <Link
                    href="/hub/test"
                    className="inline-block bg-brand-tangerina text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
                  >
                    {t(lang, "programa.takeTest")}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add app/hub/programa/
git commit -m "feat(hub): add Meu Programa page — hero, onboarding timeline, forms, english test"
```

---

## Task 7: Create Documentos page (redesign)

**Files:**
- Create: `app/hub/documentos/page.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p app/hub/documentos
```

- [ ] **Step 2: Write the page**

```tsx
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { t, Language } from "@/lib/i18n/hub";
import { ContractStatus, InvoiceStatus } from "@prisma/client";

function getPayload(token: string) {
  try {
    const [, b64] = token.split(".");
    return JSON.parse(Buffer.from(b64!, "base64url").toString());
  } catch {
    return null;
  }
}

function fmtAmount(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function DocumentosPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("hub-token")?.value;
  if (!token) redirect("/hub/login");
  const payload = getPayload(token);
  if (!payload?.customerId) redirect("/hub/login");

  const lang = (payload.language || "en") as Language;
  const dateLocale = lang === "pt-BR" ? "pt-BR" : "en-US";
  const customerId: string = payload.customerId;

  const [contracts, invoices] = await Promise.all([
    prisma.contract.findMany({
      where: { customerId, status: ContractStatus.SIGNED },
      select: {
        id: true,
        signedAt: true,
        signedS3Url: true,
        signedS3UrlExpiresAt: true,
        deal: { select: { title: true } },
      },
      orderBy: { signedAt: "desc" },
    }),
    prisma.invoice.findMany({
      where: { customerId, status: InvoiceStatus.PAID },
      select: {
        id: true,
        invoiceNumber: true,
        amount: true,
        paidAt: true,
      },
      orderBy: { paidAt: "desc" },
    }),
  ]);

  const hasDocuments = contracts.length > 0 || invoices.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t(lang, "documentos.title")}</h1>
        <p className="text-sm text-gray-400 mt-1">{t(lang, "documentos.subtitle")}</p>
      </div>

      {!hasDocuments && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-creme flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-brand-verde" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm text-gray-400">{t(lang, "documentos.noDocuments")}</p>
        </div>
      )}

      {/* Contracts */}
      {contracts.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl">📝</span>
            <div>
              <h2 className="text-sm font-bold text-gray-900">{t(lang, "documentos.contracts")}</h2>
              <p className="text-xs text-gray-400">{t(lang, "documentos.docusignVerified")}</p>
            </div>
          </div>
          <div className="space-y-3">
            {contracts.map((c) => {
              const urlValid = c.signedS3Url && (!c.signedS3UrlExpiresAt || new Date(c.signedS3UrlExpiresAt) > new Date());
              return (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  {/* PDF icon */}
                  <div className="w-10 h-12 bg-gray-50 border border-gray-100 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span className="text-[8px] text-gray-400 font-bold mt-0.5">PDF</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {c.deal?.title ?? t(lang, "status.contract")}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-400">
                        {t(lang, "documents.signedOn")}{" "}
                        {c.signedAt
                          ? new Date(c.signedAt).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })
                          : ""}
                      </span>
                      <span className="text-[10px] text-green-600 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
                        {t(lang, "documentos.docusignVerified")}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {urlValid && (
                      <>
                        <a
                          href={c.signedS3Url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="border border-gray-200 text-gray-600 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors"
                        >
                          {t(lang, "documentos.view")}
                        </a>
                        <a
                          href={c.signedS3Url!}
                          download
                          className="bg-brand-verde text-white text-xs font-semibold px-3 py-2 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          {t(lang, "documentos.download")}
                        </a>
                      </>
                    )}
                    {!urlValid && (
                      <span className="text-xs text-gray-400">{t(lang, "documents.contactSupport")}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Receipts */}
      {invoices.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl">🧾</span>
            <div>
              <h2 className="text-sm font-bold text-gray-900">{t(lang, "documentos.receipts")}</h2>
              <p className="text-xs text-gray-400">{invoices.length} {t(lang, "inicio.installments")}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header row */}
            <div className="hidden sm:flex items-center gap-4 px-5 py-2.5 bg-gray-50 border-b border-gray-100">
              <p className="flex-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{t(lang, "documents.invoice")}</p>
              <p className="w-28 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{t(lang, "documents.paidOn")}</p>
              <p className="w-24 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right">{lang === "pt-BR" ? "Valor" : "Amount"}</p>
              <p className="w-32" />
            </div>

            {invoices.map((inv, idx) => (
              <div
                key={inv.id}
                className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-5 py-3.5 ${
                  idx < invoices.length - 1 ? "border-b border-gray-50" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    #{inv.invoiceNumber ?? inv.id.slice(0, 8)}
                  </p>
                </div>
                <p className="w-28 text-xs text-gray-500">
                  {inv.paidAt
                    ? new Date(inv.paidAt).toLocaleDateString(dateLocale, { day: "numeric", month: "short", year: "numeric" })
                    : ""}
                </p>
                <p className="w-24 text-sm font-bold text-green-600 sm:text-right">
                  ${fmtAmount(Number(inv.amount))}
                </p>
                <div className="flex items-center gap-2 w-32 justify-end">
                  <Link
                    href={`/hub/documents/receipt/${inv.id}`}
                    className="border border-gray-200 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {t(lang, "documentos.view")}
                  </Link>
                  <Link
                    href={`/hub/documents/receipt/${inv.id}`}
                    className="bg-green-50 border border-green-200 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    PDF
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add app/hub/documentos/
git commit -m "feat(hub): add Documentos page — contracts with DocuSign badge, receipts table"
```

---

## Task 8: Create Conta page (redesign)

**Files:**
- Create: `app/hub/conta/page.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p app/hub/conta
```

- [ ] **Step 2: Write the page**

```tsx
"use client";

import { useState, FormEvent, useEffect } from "react";
import { t, Language } from "@/lib/i18n/hub";
import { BRAND_COLORS } from "@/lib/constants/brand";

function getLangFromCookie(): Language {
  try {
    const match = document.cookie.match(/(?:^|;\s*)hub-token=([^;]*)/);
    if (!match?.[1]) return "en";
    const [, b64] = match[1].split(".");
    if (!b64) return "en";
    const payload = JSON.parse(atob(b64.replace(/-/g, "+").replace(/_/g, "/")));
    return (payload?.language || "en") as Language;
  } catch {
    return "en";
  }
}

function getProfileFromCookie(): { name?: string; email?: string } {
  try {
    const match = document.cookie.match(/(?:^|;\s*)hub-token=([^;]*)/);
    if (!match?.[1]) return {};
    const [, b64] = match[1].split(".");
    if (!b64) return {};
    return JSON.parse(atob(b64.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}

export default function ContaPage() {
  const [lang, setLang] = useState<Language>("en");
  const [language, setLanguage] = useState("en");
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cookieLang = getLangFromCookie();
    setLang(cookieLang);
    setLanguage(cookieLang);

    // Prefer cookie payload, supplement with API
    const cookieProfile = getProfileFromCookie();
    if (cookieProfile.name) setProfileName(cookieProfile.name);
    if (cookieProfile.email) setProfileEmail(cookieProfile.email);

    fetch("/api/hub/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.name) setProfileName(data.name);
        if (data.email) setProfileEmail(data.email);
        if (data.language) {
          setLanguage(data.language);
          setLang(data.language as Language);
        }
      })
      .catch(() => {});
  }, []);

  const avatarInitial = profileName?.charAt(0)?.toUpperCase() ?? profileEmail?.charAt(0)?.toUpperCase() ?? "U";

  async function handleLanguageChange(newLang: string) {
    setLanguage(newLang);
    setLang(newLang as Language);
    setMessage(null);
    try {
      await fetch("/api/hub/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: newLang }),
      });
      window.location.reload();
    } catch {
      setMessage({ type: "error", text: t(newLang as Language, "settings.languageUpdateFailed") });
    }
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (newPassword.length < 8) {
      setMessage({ type: "error", text: t(lang, "settings.passwordMinLength") });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: t(lang, "settings.passwordsNoMatch") });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/hub/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || t(lang, "conta.passwordError") });
        return;
      }
      setMessage({ type: "success", text: t(lang, "conta.passwordSuccess") });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setMessage({ type: "error", text: t(lang, "errors.connectionError") });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">{t(lang, "conta.title")}</h1>

      {message && (
        <div
          className={`px-4 py-3 rounded-xl text-sm ${
            message.type === "success"
              ? "bg-green-50 border border-green-100 text-green-700"
              : "bg-red-50 border border-red-100 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Avatar hero */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-extrabold flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${BRAND_COLORS.VERDE}, ${BRAND_COLORS.TANGERINA})` }}
        >
          {avatarInitial}
        </div>
        <div className="min-w-0">
          <p className="text-base font-bold text-gray-900 truncate">{profileName || "—"}</p>
          <p className="text-sm text-gray-400 truncate">{profileEmail}</p>
          <p className="text-xs text-green-600 font-semibold mt-1">
            ● {t(lang, "conta.activeAccount")}
          </p>
        </div>
      </div>

      {/* Language */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-1">{t(lang, "settings.language")}</h2>
        <p className="text-xs text-gray-400 mb-4">{t(lang, "conta.languageSubtitle")}</p>
        <div className="flex gap-3">
          <button
            onClick={() => handleLanguageChange("en")}
            className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all border-2 flex items-center justify-center gap-2"
            style={{
              borderColor: language === "en" ? BRAND_COLORS.TANGERINA : "#E5E7EB",
              backgroundColor: language === "en" ? "#fff7ed" : "transparent",
              color: language === "en" ? BRAND_COLORS.TANGERINA : "#6B7280",
            }}
          >
            <span>🇺🇸</span> English
          </button>
          <button
            onClick={() => handleLanguageChange("pt-BR")}
            className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all border-2 flex items-center justify-center gap-2"
            style={{
              borderColor: language === "pt-BR" ? BRAND_COLORS.TANGERINA : "#E5E7EB",
              backgroundColor: language === "pt-BR" ? "#fff7ed" : "transparent",
              color: language === "pt-BR" ? BRAND_COLORS.TANGERINA : "#6B7280",
            }}
          >
            <span>🇧🇷</span> Português
          </button>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-1">{t(lang, "settings.changePassword")}</h2>
        <p className="text-xs text-gray-400 mb-4">{t(lang, "conta.passwordSubtitle")}</p>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t(lang, "conta.currentPassword")}</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-brand-verde bg-gray-50 focus:outline-none focus:border-brand-verde focus:ring-1 focus:ring-brand-verde transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t(lang, "conta.newPassword")}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-brand-verde bg-gray-50 focus:outline-none focus:border-brand-verde focus:ring-1 focus:ring-brand-verde transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t(lang, "conta.confirmPassword")}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-brand-verde bg-gray-50 focus:outline-none focus:border-brand-verde focus:ring-1 focus:ring-brand-verde transition"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-opacity disabled:opacity-60"
            style={{ backgroundColor: BRAND_COLORS.VERDE }}
          >
            {loading ? t(lang, "conta.updating") : t(lang, "conta.updatePassword")}
          </button>
        </form>
      </div>

      {/* Sign out */}
      <div className="text-center pt-2 pb-4">
        <form action="/api/hub/auth/logout" method="POST" className="inline">
          <button
            type="submit"
            className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors flex items-center gap-1.5 mx-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {t(lang, "conta.signOut")}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add app/hub/conta/
git commit -m "feat(hub): add Conta page — avatar hero, language toggle, password change, sign out"
```

---

## Task 9: Redirect old settings and documents routes

**Files:**
- Modify: `app/hub/settings/page.tsx`
- Modify: `app/hub/documents/page.tsx`

- [ ] **Step 1: Replace settings page with redirect**

Replace the entire `app/hub/settings/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

export default function HubSettingsRedirect() {
  redirect("/hub/conta");
}
```

- [ ] **Step 2: Replace documents page with redirect**

Replace the entire `app/hub/documents/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

export default function HubDocumentsRedirect() {
  redirect("/hub/documentos");
}
```

- [ ] **Step 3: Commit**

```bash
git add app/hub/settings/page.tsx app/hub/documents/page.tsx
git commit -m "feat(hub): redirect /hub/settings → /hub/conta and /hub/documents → /hub/documentos"
```

---

## Task 10: Build verification

- [ ] **Step 1: Run full build**

```bash
npm run build 2>&1 | tail -30
```

Expected: `✓ Compiled successfully` with no type errors.

- [ ] **Step 2: If build fails, fix TypeScript errors**

Common issues:
- Missing Prisma model fields → remove the field from the select or add `?` for optional access
- i18n key not found → add the missing key in Task 1 (both `en` and `pt-BR`)
- Import path wrong → verify with `ls app/hub/`

- [ ] **Step 3: Start dev server and verify each page visually**

```bash
npm run dev
```

Visit in browser (with a logged-in hub session):
- `http://localhost:3000/hub` → Início with hero, KPIs, quick nav
- `http://localhost:3000/hub/financeiro` → Financeiro with installment bar
- `http://localhost:3000/hub/programa` → Meu Programa with timeline
- `http://localhost:3000/hub/documentos` → Documentos with contracts/receipts
- `http://localhost:3000/hub/conta` → Conta with avatar and forms
- `http://localhost:3000/hub/settings` → should redirect to `/hub/conta`
- `http://localhost:3000/hub/documents` → should redirect to `/hub/documentos`

- [ ] **Step 4: Verify mobile nav on smaller viewport**

In browser devtools, set viewport to 375px width. Confirm hamburger menu appears and opens the drawer with all 5 nav links.

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(hub): post-build fixes"
```
