"use client";

import { KPIMetric, ConcentrationMetric } from "@/lib/types/financial-bi";

interface FinancialKpiRowProps {
  revenue: KPIMetric;
  collectionRate: KPIMetric;
  outstandingAR: KPIMetric;
  mrr: KPIMetric;
  topClientConcentration: ConcentrationMetric;
}

function formatCurrency(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

const levelBorder = { good: "border-gray-100", warning: "border-amber-200", danger: "border-red-200" };
const levelChangeColor = { good: "text-success-600", warning: "text-amber-600", danger: "text-error-600" };

function KpiCard({ title, metric, fmt }: { title: string; metric: KPIMetric; fmt: "currency" | "percent" }) {
  const displayValue = fmt === "currency" ? formatCurrency(metric.value) : `${metric.value.toFixed(1)}%`;
  const changePrefix = metric.changePct >= 0 ? "▲" : "▼";
  const valueColor = metric.contextLevel === "danger" ? "text-error-600" : metric.contextLevel === "warning" ? "text-amber-600" : "text-success-600";

  return (
    <div className={`rounded-lg border bg-white p-3 text-center ${levelBorder[metric.contextLevel]}`}>
      <div className="text-[10px] uppercase text-gray-500">{title}</div>
      <div className={`mt-1 text-xl font-extrabold ${valueColor}`}>{displayValue}</div>
      <div className={`text-[11px] ${levelChangeColor[metric.contextLevel]}`}>
        {changePrefix} {Math.abs(metric.changePct).toFixed(1)}% — {metric.context}
      </div>
    </div>
  );
}

export function FinancialKpiRow(props: FinancialKpiRowProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      <KpiCard title="Revenue (Collected)" metric={props.revenue} fmt="currency" />
      <KpiCard title="Collection Rate" metric={props.collectionRate} fmt="percent" />
      <KpiCard title="Outstanding AR" metric={props.outstandingAR} fmt="currency" />
      <KpiCard title="MRR" metric={props.mrr} fmt="currency" />
      <KpiCard title="Top 3 Concentration" metric={props.topClientConcentration} fmt="percent" />
    </div>
  );
}
