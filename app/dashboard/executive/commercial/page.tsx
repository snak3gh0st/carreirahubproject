import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  Briefcase,
  Clock,
  DollarSign,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

import { authOptions } from "@/lib/auth";
import { getCommercialBIData } from "@/lib/services/commercial-bi";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

// KpiCard — mirrored verbatim from commercial-bi/page.tsx:73-106
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

export default async function ExecutiveCommercialPage() {
  // EXECUTIVE drill-down — read-only; sourced from getCommercialBIData()
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (role !== "EXECUTIVE" && role !== "ADMIN") {
    redirect("/dashboard?error=role_not_permitted");
  }

  // Use last-90d window for decision-grade view (vs default 30d for HEAD_COMERCIAL)
  const data = await getCommercialBIData({ preset: "last90" });

  // Top 5 closers by won value (decision-grade ranking)
  const topClosers = [...data.sellers]
    .sort((a, b) => b.wonValue - a.wonValue)
    .slice(0, 5);

  // Top 5 at-risk deals (stale, no movement) — surfaced from actionQueue
  const atRiskDeals = data.actionQueue.staleDeals.slice(0, 5);

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
            <h1 className="text-2xl font-semibold text-gray-900">Resumo Comercial</h1>
          </div>
          {/* D-12: deep-dive into the full commercial BI */}
          <Link
            href="/dashboard/commercial-bi"
            className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
          >
            Análise completa ↗
          </Link>
        </div>

        <p className="max-w-3xl text-sm text-gray-500">
          Visao decision-grade da operacao comercial (ultimos 90 dias). Read-only — abra o Hub Comercial para acoes operacionais.
        </p>

        {/* KPI strip — pipeline, fechado, conversao, vendedores */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard
            label="Pipeline aberto"
            value={formatCurrency(data.summary.openPipelineValue)}
            helper={`${formatNumber(data.summary.openDeals)} deals em aberto`}
            icon={Briefcase}
            tone="blue"
          />
          <KpiCard
            label="Fechado (90d)"
            value={formatCurrency(data.summary.wonValue)}
            helper={`${formatNumber(data.summary.wonDeals)} deals ganhos`}
            icon={DollarSign}
            tone="green"
          />
          <KpiCard
            label="Conversao"
            value={`${data.summary.conversionRate}%`}
            helper={`${data.summary.wonDeals} ganhos / ${data.summary.lostDeals} perdidos`}
            icon={TrendingUp}
            tone="green"
          />
          <KpiCard
            label="Vendedores"
            value={formatNumber(data.summary.sellerCount)}
            helper={`${formatNumber(data.summary.leadCount)} leads no periodo`}
            icon={Users}
          />
        </div>

        {/* Top closers — decision-grade ranking */}
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-950">Top closers (90 dias)</h2>
              <p className="text-sm text-gray-500">Ranking por valor fechado — base para 1:1 e reconhecimento.</p>
            </div>
          </header>
          {topClosers.length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
              Sem deals ganhos no periodo.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Vendedor</th>
                    <th className="px-4 py-3 text-right font-semibold">Fechado</th>
                    <th className="px-4 py-3 text-right font-semibold">Deals ganhos</th>
                    <th className="px-4 py-3 text-right font-semibold">Conversao</th>
                    <th className="px-4 py-3 text-right font-semibold">Pipeline aberto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topClosers.map((seller) => (
                    <tr key={seller.sellerId}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-950">{seller.sellerName}</p>
                        <p className="text-xs text-gray-500">{seller.sellerEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                        {formatCurrency(seller.wonValue)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        {formatNumber(seller.wonDeals)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        {seller.conversionRate}%
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        {formatCurrency(seller.openPipelineValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* At-risk deals — decision-grade actionable list */}
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <header className="mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-950">Deals em risco (sem movimento)</h2>
              <p className="text-sm text-gray-500">Top 5 deals parados ha mais tempo — alvos prioritarios de cobranca de follow-up.</p>
            </div>
          </header>
          {atRiskDeals.length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
              Nenhum deal em risco — pipeline sem stagnacao detectada.
            </p>
          ) : (
            <div className="space-y-2">
              {atRiskDeals.map((deal) => (
                <div key={deal.id} className="rounded-md border border-amber-100 bg-amber-50/40 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-gray-950">{deal.title}</p>
                    <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                      {deal.daysStale} dias parado
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-600">
                    {deal.sellerName} · {formatCurrency(deal.value)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Conversion trend — origem dos leads (existing source breakdown reused) */}
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <header className="mb-4">
            <h2 className="text-lg font-semibold text-gray-950">Conversao por origem (90 dias)</h2>
            <p className="text-sm text-gray-500">Qualidade do funil por canal — orienta investimento de marketing.</p>
          </header>
          {data.sourceBreakdown.length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
              Sem leads no periodo.
            </p>
          ) : (
            <div className="space-y-2">
              {data.sourceBreakdown.slice(0, 6).map((source) => (
                <div
                  key={source.source}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-gray-100 px-3 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{source.source}</p>
                    <p className="text-xs text-gray-500">
                      {source.qualified} qualificados, {source.converted} convertidos
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums text-gray-950">
                      {formatNumber(source.leads)}
                    </p>
                    <p className="text-xs text-gray-500">score {source.avgScore ?? "-"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
