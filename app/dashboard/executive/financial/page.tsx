import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  DollarSign,
  Receipt,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

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
        <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-md", toneClasses[tone])}>
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

function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function daysOverdue(dueDate: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)));
}

// Aging bucket — based on dueDate vs now
function bucketForOverdue(daysLate: number): "0-30" | "31-60" | "61-90" | "90+" {
  if (daysLate <= 30) return "0-30";
  if (daysLate <= 60) return "31-60";
  if (daysLate <= 90) return "61-90";
  return "90+";
}

async function loadFinancialDrillDown(now: Date) {
  const dayMs = 24 * 60 * 60 * 1000;
  const last90Start = new Date(now.getTime() - 90 * dayMs);

  // Inline Prisma queries — mirroring the financial-bi service patterns but
  // simplified for read-only EXECUTIVE drill-down (no internal HTTP fetches).
  const [
    // Top 5 overdue invoices by dueDate ascending (canonical decision-grade widget per PATTERNS.md §7)
    topOverdueInvoices,
    // All open + overdue invoices for AR aging bucket distribution
    openAndOverdueInvoices,
    // Paid invoices last 90 days for cash trend
    paidInvoicesLast90,
    // Aggregates
    arOpenAgg,
    arOverdueAgg,
    mrrAgg,
  ] = await Promise.all([
    // EXECUTIVE financial drill-down — read-only; sourced from Invoice findMany (OVERDUE, top 5 by dueDate asc)
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
        customer: { select: { name: true, email: true } },
      },
    }),
    // EXECUTIVE financial drill-down — read-only; sourced from Invoice findMany (open+overdue) for aging buckets
    prisma.invoice.findMany({
      where: { status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] } },
      select: { id: true, amount: true, amountPaid: true, dueDate: true, status: true },
    }),
    // EXECUTIVE financial drill-down — read-only; sourced from Invoice findMany (PAID last 90d) for cash trend
    prisma.invoice.findMany({
      where: { status: "PAID", paidAt: { gte: last90Start } },
      orderBy: { paidAt: "asc" },
      select: { id: true, amount: true, paidAt: true },
    }),
    // EXECUTIVE financial drill-down — read-only; sourced from Invoice aggregate (open AR sum)
    prisma.invoice.aggregate({
      _sum: { amount: true },
      _count: { _all: true },
      where: { status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] } },
    }),
    // EXECUTIVE financial drill-down — read-only; sourced from Invoice aggregate (overdue sum)
    prisma.invoice.aggregate({
      _sum: { amount: true },
      _count: { _all: true },
      where: { status: "OVERDUE" },
    }),
    // EXECUTIVE financial drill-down — read-only; sourced from Invoice aggregate (PAID last 30d) for MRR
    prisma.invoice.aggregate({
      _sum: { amount: true },
      where: { status: "PAID", paidAt: { gte: new Date(now.getTime() - 30 * dayMs) } },
    }),
  ]);

  // Aging buckets — count + sum per bucket
  const aging: Record<"0-30" | "31-60" | "61-90" | "90+", { count: number; total: number }> = {
    "0-30": { count: 0, total: 0 },
    "31-60": { count: 0, total: 0 },
    "61-90": { count: 0, total: 0 },
    "90+": { count: 0, total: 0 },
  };
  for (const inv of openAndOverdueInvoices) {
    const days = daysOverdue(inv.dueDate, now);
    const bucket = bucketForOverdue(days);
    const openAmount = Math.max(0, Number(inv.amount) - Number(inv.amountPaid ?? 0));
    aging[bucket].count += 1;
    aging[bucket].total += openAmount;
  }

  // Cash trend — bucket by week (last 13 weeks of paid invoices)
  const weekBuckets = new Map<string, number>();
  for (let i = 12; i >= 0; i -= 1) {
    const weekStart = new Date(now.getTime() - i * 7 * dayMs);
    const key = `${weekStart.getUTCFullYear()}-W${String(Math.ceil((weekStart.getUTCDate()) / 7)).padStart(2, "0")}-${weekStart.getUTCMonth() + 1}`;
    weekBuckets.set(key, 0);
  }
  const weeklyCash: { weekStart: Date; total: number }[] = [];
  for (let i = 12; i >= 0; i -= 1) {
    const weekEnd = new Date(now.getTime() - i * 7 * dayMs);
    const weekStart = new Date(weekEnd.getTime() - 7 * dayMs);
    const total = paidInvoicesLast90
      .filter((inv) => inv.paidAt && inv.paidAt >= weekStart && inv.paidAt < weekEnd)
      .reduce((acc, inv) => acc + Number(inv.amount), 0);
    weeklyCash.push({ weekStart, total });
  }

  return {
    topOverdue: topOverdueInvoices,
    aging,
    weeklyCash,
    arValue: Number(arOpenAgg._sum.amount ?? 0),
    arCount: arOpenAgg._count._all ?? 0,
    overdueValue: Number(arOverdueAgg._sum.amount ?? 0),
    overdueCount: arOverdueAgg._count._all ?? 0,
    mrrValue: Number(mrrAgg._sum.amount ?? 0),
  };
}

export default async function ExecutiveFinancialPage() {
  // EXECUTIVE drill-down — read-only; sourced from direct Prisma aggregates (no internal HTTP)
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (role !== "EXECUTIVE" && role !== "ADMIN") {
    redirect("/dashboard?error=role_not_permitted");
  }

  const now = new Date();
  const data = await loadFinancialDrillDown(now);

  const maxWeeklyCash = data.weeklyCash.reduce((acc, w) => Math.max(acc, w.total), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        {/* Back nav header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/executive" className="text-sm text-brand-verde hover:underline">
              ← Briefing Executivo
            </Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-2xl font-semibold text-gray-900">Resumo Financeiro</h1>
          </div>
          {/* D-12: deep-dive into the full financial BI */}
          <Link
            href="/dashboard/financial"
            className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
          >
            Análise completa ↗
          </Link>
        </div>

        <p className="max-w-3xl text-sm text-gray-500">
          Visao decision-grade de caixa, AR e inadimplencia (vencido). Read-only — abra o Hub Financeiro para conciliacao e cobranca.
        </p>

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard
            label="MRR (30d)"
            value={formatCurrency(data.mrrValue)}
            helper="Faturas pagas nos ultimos 30 dias"
            icon={DollarSign}
            tone="green"
          />
          <KpiCard
            label="AR (em aberto)"
            value={formatCurrency(data.arValue)}
            helper={`${formatNumber(data.arCount)} faturas`}
            icon={Receipt}
            tone="amber"
          />
          <KpiCard
            label="Vencido"
            value={formatCurrency(data.overdueValue)}
            helper={`${formatNumber(data.overdueCount)} faturas vencidas`}
            icon={AlertCircle}
            tone={data.overdueCount > 0 ? "red" : "neutral"}
          />
          <KpiCard
            label="Cobranca eficaz"
            value={
              data.arValue + data.overdueValue > 0
                ? `${((1 - data.overdueValue / Math.max(data.arValue, 1)) * 100).toFixed(1)}%`
                : "100.0%"
            }
            helper="Proporcao do AR ainda nao vencido"
            icon={TrendingUp}
            tone="blue"
          />
        </div>

        {/* Top 5 overdue invoices — canonical decision-grade widget (PATTERNS.md §7) */}
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <header className="mb-4 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-950">Top 5 faturas vencidas</h2>
              <p className="text-sm text-gray-500">Faturas em atraso com vencimento mais antigo — alvos prioritarios de cobranca.</p>
            </div>
          </header>
          {data.topOverdue.length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
              Nenhuma fatura vencida — operacao saudavel.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Fatura</th>
                    <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                    <th className="px-4 py-3 text-right font-semibold">Em aberto</th>
                    <th className="px-4 py-3 text-right font-semibold">Vencimento</th>
                    <th className="px-4 py-3 text-right font-semibold">Dias em atraso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.topOverdue.map((invoice) => {
                    const open = Math.max(
                      0,
                      Number(invoice.amount) - Number(invoice.amountPaid ?? 0),
                    );
                    const lateDays = daysOverdue(invoice.dueDate, now);
                    return (
                      <tr key={invoice.id}>
                        <td className="px-4 py-3 font-semibold text-gray-950">
                          {invoice.invoiceNumber ?? `#${invoice.id.slice(0, 8)}`}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          <p className="font-medium text-gray-900">{invoice.customer.name}</p>
                          <p className="text-xs text-gray-500">{invoice.customer.email}</p>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-red-700">
                          {formatCurrency(open)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                          {formatDateShort(invoice.dueDate)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                          {lateDays}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* AR Aging buckets */}
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <header className="mb-4">
            <h2 className="text-lg font-semibold text-gray-950">Aging do AR</h2>
            <p className="text-sm text-gray-500">Distribuicao do contas a receber por faixa de vencimento.</p>
          </header>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(["0-30", "31-60", "61-90", "90+"] as const).map((bucket) => {
              const cell = data.aging[bucket];
              const tone =
                bucket === "0-30"
                  ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                  : bucket === "31-60"
                    ? "bg-amber-50 border-amber-100 text-amber-800"
                    : bucket === "61-90"
                      ? "bg-orange-50 border-orange-100 text-orange-800"
                      : "bg-red-50 border-red-100 text-red-800";
              return (
                <div key={bucket} className={cn("rounded-md border px-4 py-3", tone)}>
                  <p className="text-xs font-semibold uppercase tracking-wide">{bucket} dias</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {formatCurrency(cell.total)}
                  </p>
                  <p className="text-xs opacity-80">{cell.count} faturas</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Cash trend — last 13 weeks */}
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <header className="mb-4">
            <h2 className="text-lg font-semibold text-gray-950">Caixa recebido (13 semanas)</h2>
            <p className="text-sm text-gray-500">Trend de recebimento por semana — base para projecao de runway.</p>
          </header>
          {maxWeeklyCash === 0 ? (
            <p className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
              Sem recebimentos registrados no periodo.
            </p>
          ) : (
            <div className="space-y-1">
              {data.weeklyCash.map((week) => (
                <div
                  key={week.weekStart.toISOString()}
                  className="grid grid-cols-[100px_1fr_120px] items-center gap-3"
                >
                  <span className="text-xs text-gray-500">{formatDateShort(week.weekStart)}</span>
                  <div className="h-2 w-full rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-brand-verde"
                      style={{
                        width: `${Math.max(4, (week.total / maxWeeklyCash) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-right text-sm font-semibold tabular-nums text-gray-900">
                    {formatCurrency(week.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
