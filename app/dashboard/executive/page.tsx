import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Activity,
  Briefcase,
  Receipt,
  Users,
  type LucideIcon,
} from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAiHubForRole } from "@/lib/ai/hub-config";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

// ----------------------------------------------------------------------------
// KpiCard — extracted verbatim from app/dashboard/commercial-bi/page.tsx:73-106
// ----------------------------------------------------------------------------
function KpiCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone?: "neutral" | "green" | "amber" | "blue" | "red";
}) {
  const toneClasses = {
    neutral: "bg-gray-50 text-gray-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    red: "bg-red-50 text-red-700",
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        <span
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-md",
            toneClasses[tone],
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="text-2xl font-semibold tabular-nums text-gray-950">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{helper}</p>
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number, fractionDigits = 1): string {
  return `${value.toFixed(fractionDigits)}%`;
}

// ----------------------------------------------------------------------------
// Data fetch — direct Prisma aggregates for the four KPI cards + three summary
// cards. Read-only, server-side per D-05/D-06. Avoid internal HTTP fetches
// from a server component (per Plan 20-05 Task 2 action step 2).
// ----------------------------------------------------------------------------
async function loadExecutiveBriefing(now: Date) {
  // Rolling windows — MRR is paid invoices last 30d; comparator is the 30d
  // window before that. Growth = % delta in new customers (this month vs last).
  const dayMs = 24 * 60 * 60 * 1000;
  const last30Start = new Date(now.getTime() - 30 * dayMs);
  const prev30Start = new Date(now.getTime() - 60 * dayMs);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const prevMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const prevMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
  const weekStart = new Date(now.getTime() - 7 * dayMs);

  const [
    // Commercial summary card — sourced from Deal aggregate (won/open pipeline)
    wonDealsThisMonth,
    openDealsAgg,
    leadsLast30,

    // Financial KPIs / summary — sourced from Invoice aggregate
    mrrAgg, // paid invoices last 30d
    prevMrrAgg, // paid invoices in the 30d before that (for MRR delta helper)
    arOpenAgg, // outstanding AR (SENT + PARTIALLY_PAID + OVERDUE)
    arOverdueAgg,
    topOverdueInvoices,

    // Operational summary card — sourced from MentorshipEnrollment + Session
    activeEnrollments,
    pausedEnrollments,
    sessionsThisWeek,

    // Customer growth — for Growth KPI + ops summary "Alunos ativos"
    activeCustomers,
    newCustomersThisMonth,
    newCustomersPrevMonth,
  ] = await Promise.all([
    // EXECUTIVE landing — read-only; sourced from Deal aggregate (status=WON, this month)
    prisma.deal.aggregate({
      _sum: { value: true },
      _count: { _all: true },
      where: { status: "WON", updatedAt: { gte: monthStart } },
    }),
    // EXECUTIVE landing — read-only; sourced from Deal aggregate (status=OPEN)
    prisma.deal.aggregate({
      _sum: { value: true },
      _count: { _all: true },
      where: { status: "OPEN" },
    }),
    // EXECUTIVE landing — read-only; sourced from Lead count (last 30 days)
    prisma.lead.count({ where: { createdAt: { gte: last30Start } } }),

    // EXECUTIVE landing — read-only; sourced from Invoice aggregate (PAID, paidAt last 30d) — MRR proxy
    prisma.invoice.aggregate({
      _sum: { amount: true },
      where: { status: "PAID", paidAt: { gte: last30Start } },
    }),
    // EXECUTIVE landing — read-only; sourced from Invoice aggregate (PAID, paidAt prev 30d)
    prisma.invoice.aggregate({
      _sum: { amount: true },
      where: { status: "PAID", paidAt: { gte: prev30Start, lt: last30Start } },
    }),
    // EXECUTIVE landing — read-only; sourced from Invoice aggregate (open balance) — AR
    prisma.invoice.aggregate({
      _sum: { amount: true },
      _count: { _all: true },
      where: { status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] } },
    }),
    // EXECUTIVE landing — read-only; sourced from Invoice aggregate (OVERDUE) — Churn proxy (overdue ratio)
    prisma.invoice.aggregate({
      _sum: { amount: true },
      _count: { _all: true },
      where: { status: "OVERDUE" },
    }),
    // EXECUTIVE landing — read-only; sourced from Invoice query (top 5 OVERDUE by dueDate asc)
    prisma.invoice.findMany({
      where: { status: "OVERDUE" },
      orderBy: { dueDate: "asc" },
      take: 5,
      select: {
        id: true,
        invoiceNumber: true,
        amount: true,
        amountPaid: true,
        dueDate: true,
        customer: { select: { name: true } },
      },
    }),

    // EXECUTIVE landing — read-only; sourced from MentorshipEnrollment count (active)
    prisma.mentorshipEnrollment.count({ where: { status: "ACTIVE" } }),
    // EXECUTIVE landing — read-only; sourced from MentorshipEnrollment count (paused)
    prisma.mentorshipEnrollment.count({ where: { status: "PAUSED" } }),
    // EXECUTIVE landing — read-only; sourced from MentorshipSession count (sessionDate this week)
    prisma.mentorshipSession.count({ where: { sessionDate: { gte: weekStart } } }),

    // EXECUTIVE landing — read-only; sourced from Customer count (has active enrollment)
    prisma.customer.count({ where: { mentorshipEnrollments: { some: { status: "ACTIVE" } } } }),
    // EXECUTIVE landing — read-only; sourced from Customer count (createdAt this month)
    prisma.customer.count({ where: { createdAt: { gte: monthStart } } }),
    // EXECUTIVE landing — read-only; sourced from Customer count (createdAt prev month)
    prisma.customer.count({
      where: { createdAt: { gte: prevMonthStart, lte: prevMonthEnd } },
    }),
  ]);

  // Numeric coercions (Prisma Decimal → number)
  const mrrValue = Number(mrrAgg._sum.amount ?? 0);
  const prevMrrValue = Number(prevMrrAgg._sum.amount ?? 0);
  const arValue = Number(arOpenAgg._sum.amount ?? 0);
  const arCount = arOpenAgg._count._all ?? 0;
  const overdueValue = Number(arOverdueAgg._sum.amount ?? 0);
  const overdueCount = arOverdueAgg._count._all ?? 0;

  const mrrDeltaPct =
    prevMrrValue > 0 ? ((mrrValue - prevMrrValue) / prevMrrValue) * 100 : mrrValue > 0 ? 100 : 0;

  // Churn proxy: overdue invoice count / total open invoice count (collection failure rate).
  // Not a literal customer-churn rate — a working financial proxy until v1.5 introduces
  // enrollment-cancellation tracking.
  const churnRatePct =
    arCount + 0 > 0 ? (overdueCount / Math.max(arCount, 1)) * 100 : 0;

  const growthDeltaPct =
    newCustomersPrevMonth > 0
      ? ((newCustomersThisMonth - newCustomersPrevMonth) / newCustomersPrevMonth) * 100
      : newCustomersThisMonth > 0
        ? 100
        : 0;

  return {
    kpis: {
      mrrValue,
      mrrDeltaPct,
      arValue,
      arCount,
      churnRatePct,
      overdueCount,
      growthDeltaPct,
      newCustomersThisMonth,
    },
    commercial: {
      wonDealsCount: wonDealsThisMonth._count._all ?? 0,
      wonDealsValue: Number(wonDealsThisMonth._sum.value ?? 0),
      openDealsCount: openDealsAgg._count._all ?? 0,
      openPipelineValue: Number(openDealsAgg._sum.value ?? 0),
      leadsLast30,
    },
    financial: {
      mrrValue,
      arValue,
      overdueValue,
      overdueCount,
      topOverdueInvoices,
    },
    operational: {
      activeEnrollments,
      pausedEnrollments,
      sessionsThisWeek,
      activeCustomers,
    },
  };
}

// ----------------------------------------------------------------------------
// Page
// ----------------------------------------------------------------------------
export default async function ExecutivePage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (role !== "EXECUTIVE" && role !== "ADMIN") {
    redirect("/dashboard?error=role_not_permitted");
  }

  const aiHub = getAiHubForRole(role);
  const briefing = await loadExecutiveBriefing(new Date());

  const mrrHelper =
    briefing.kpis.mrrDeltaPct >= 0
      ? `+${briefing.kpis.mrrDeltaPct.toFixed(1)}% vs janela anterior`
      : `${briefing.kpis.mrrDeltaPct.toFixed(1)}% vs janela anterior`;

  const growthHelper =
    briefing.kpis.growthDeltaPct >= 0
      ? `+${briefing.kpis.growthDeltaPct.toFixed(1)}% novos clientes vs mes anterior`
      : `${briefing.kpis.growthDeltaPct.toFixed(1)}% novos clientes vs mes anterior`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        {/* Page header — persona chip is one of two discovery surfaces for CEO Brief (D-08) */}
        <div className="mb-6 flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-verde">Executive</p>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h1 className="text-3xl font-semibold text-gray-900">Briefing Executivo</h1>
            {/* D-12: deep-dive into the legacy executive BI for the full picture */}
            <Link
              href="/dashboard/bi"
              className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
            >
              Ver dashboard completo ↗
            </Link>
          </div>
          <p className="max-w-3xl text-sm text-gray-500">
            Visao consolidada de Comercial, Financeiro e Operacional para a CEO. Pagina somente leitura — para detalhes operacionais use os drill-downs abaixo.
          </p>
          {aiHub && (
            <Link
              href={aiHub.routePath}
              className="inline-flex items-center gap-2 self-start rounded-full bg-brand-verde/10 px-3 py-1 text-sm text-brand-verde hover:bg-brand-verde/20"
            >
              <Sparkles className="h-4 w-4" />
              <span>{aiHub.label} — CEO Brief</span>
            </Link>
          )}
        </div>

        {/* KPI strip — four cards per D-06 (MRR / AR / Churn / Growth) */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard
            label="MRR"
            value={formatCurrency(briefing.kpis.mrrValue)}
            helper={mrrHelper}
            icon={DollarSign}
            tone="green"
          />
          <KpiCard
            label="AR"
            value={formatCurrency(briefing.kpis.arValue)}
            helper={`${formatNumber(briefing.kpis.arCount)} faturas em aberto`}
            icon={Receipt}
            tone="amber"
          />
          <KpiCard
            label="Churn"
            value={formatPercent(briefing.kpis.churnRatePct, 1)}
            helper={`${formatNumber(briefing.kpis.overdueCount)} faturas vencidas (proxy)`}
            icon={AlertCircle}
            tone={briefing.kpis.churnRatePct > 10 ? "red" : "neutral"}
          />
          <KpiCard
            label="Growth"
            value={formatPercent(briefing.kpis.growthDeltaPct, 1)}
            helper={growthHelper}
            icon={TrendingUp}
            tone={briefing.kpis.growthDeltaPct >= 0 ? "green" : "red"}
          />
        </div>

        {/* Three summary cards (D-06 sections 3-5) */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Resumo Comercial */}
          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Resumo Comercial
              </p>
              <div className="flex items-center gap-3 text-sm">
                <Link
                  href="/dashboard/executive/commercial"
                  className="text-brand-verde hover:underline"
                >
                  Ver detalhes →
                </Link>
                {/* D-12: deep-dive into the full commercial BI */}
                <Link
                  href="/dashboard/commercial-bi"
                  className="text-gray-500 hover:text-gray-700 hover:underline"
                >
                  Análise completa ↗
                </Link>
              </div>
            </header>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-600">Deals ganhos no mes</span>
                <span className="text-sm font-semibold tabular-nums text-gray-950">
                  {formatNumber(briefing.commercial.wonDealsCount)} · {formatCurrency(briefing.commercial.wonDealsValue)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-600">Pipeline em aberto</span>
                <span className="text-sm font-semibold tabular-nums text-gray-950">
                  {formatNumber(briefing.commercial.openDealsCount)} · {formatCurrency(briefing.commercial.openPipelineValue)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-600">Leads ultimos 30 dias</span>
                <span className="text-sm font-semibold tabular-nums text-gray-950">
                  {formatNumber(briefing.commercial.leadsLast30)}
                </span>
              </div>
            </div>
          </section>

          {/* Resumo Financeiro */}
          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Resumo Financeiro
              </p>
              <div className="flex items-center gap-3 text-sm">
                <Link
                  href="/dashboard/executive/financial"
                  className="text-brand-verde hover:underline"
                >
                  Ver detalhes →
                </Link>
                {/* D-12: deep-dive into the full financial BI */}
                <Link
                  href="/dashboard/financial"
                  className="text-gray-500 hover:text-gray-700 hover:underline"
                >
                  Análise completa ↗
                </Link>
              </div>
            </header>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-600">MRR (30d)</span>
                <span className="text-sm font-semibold tabular-nums text-gray-950">
                  {formatCurrency(briefing.financial.mrrValue)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-600">AR (em aberto)</span>
                <span className="text-sm font-semibold tabular-nums text-gray-950">
                  {formatCurrency(briefing.financial.arValue)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-600">Vencido</span>
                <span className="text-sm font-semibold tabular-nums text-red-700">
                  {formatCurrency(briefing.financial.overdueValue)} · {formatNumber(briefing.financial.overdueCount)} faturas
                </span>
              </div>
            </div>
          </section>

          {/* Resumo Operacional */}
          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <header className="mb-4 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Resumo Operacional
              </p>
              <Link
                href="/dashboard/executive/operational"
                className="text-sm text-brand-verde hover:underline"
              >
                Ver detalhes →
              </Link>
            </header>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-600">Alunos ativos</span>
                <span className="text-sm font-semibold tabular-nums text-gray-950">
                  {formatNumber(briefing.operational.activeCustomers)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-600">Matriculas (ativas / pausadas)</span>
                <span className="text-sm font-semibold tabular-nums text-gray-950">
                  {formatNumber(briefing.operational.activeEnrollments)} / {formatNumber(briefing.operational.pausedEnrollments)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-600">Sessoes esta semana</span>
                <span className="text-sm font-semibold tabular-nums text-gray-950">
                  {formatNumber(briefing.operational.sessionsThisWeek)}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
