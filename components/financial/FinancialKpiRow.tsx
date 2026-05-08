"use client";

import { KPIMetric, ConcentrationMetric } from "@/lib/types/financial-bi";

interface FinancialKpiRowProps {
  revenue: KPIMetric;
  collectionRate: KPIMetric;
  outstandingAR: KPIMetric;
  overdueAR?: KPIMetric;
  mrr: KPIMetric;
  topClientConcentration: ConcentrationMetric;
  delinquencyRate?: number;
  totalExpenses?: number;
  netIncome?: number;
  cashOnHand?: number;
  burnRate?: number;
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
  const hasQb = props.totalExpenses !== undefined;
  const hasBreakeven = hasQb && props.burnRate !== undefined && props.burnRate > 0;
  const hasDelinquency = props.delinquencyRate !== undefined;
  const hasOverdueAr = props.overdueAR !== undefined;
  const baseCount = hasDelinquency ? (hasOverdueAr ? 7 : 6) : hasOverdueAr ? 6 : 5;
  const colCount = hasBreakeven ? baseCount + 3 : hasQb ? baseCount + 2 : baseCount;
  const gridClass =
    colCount >= 8
      ? "grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8"
      : colCount === 7
      ? "grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7"
      : colCount === 6
      ? "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6"
      : "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5";

  const breakevenGap = hasBreakeven ? props.mrr.value - props.burnRate! : 0;
  const aboveBreakeven = hasBreakeven && props.mrr.value >= props.burnRate!;

  return (
    <div className={gridClass}>
      <KpiCard title="Revenue" metric={props.revenue} fmt="currency" />
      <KpiCard title="Collection Rate" metric={props.collectionRate} fmt="percent" />
      <KpiCard title="Outstanding AR" metric={props.outstandingAR} fmt="currency" />
      {props.overdueAR && <KpiCard title="Overdue AR" metric={props.overdueAR} fmt="currency" />}
      <KpiCard title="MRR" metric={props.mrr} fmt="currency" />
      <KpiCard title="Top 3 Concentration" metric={props.topClientConcentration} fmt="percent" />

      {hasDelinquency && (
        <div className={`rounded-lg border bg-white p-3 text-center ${
          props.delinquencyRate! > 25 ? "border-red-200 bg-red-50" :
          props.delinquencyRate! > 12 ? "border-amber-200 bg-amber-50" : "border-gray-100"
        }`}>
          <div className="text-[10px] uppercase text-gray-500">Delinquency Rate</div>
          <div className={`mt-1 text-xl font-extrabold ${
            props.delinquencyRate! > 25 ? "text-red-600" :
            props.delinquencyRate! > 12 ? "text-amber-600" : "text-green-600"
          }`}>{props.delinquencyRate!.toFixed(1)}%</div>
          <div className="text-[11px] text-gray-400">Overdue / total AR</div>
        </div>
      )}

      {hasQb && (
        <div className="rounded-lg border border-gray-100 bg-white p-3 text-center">
          <div className="text-[10px] uppercase text-gray-500">Expenses</div>
          <div className="mt-1 text-xl font-extrabold text-error-600">{formatCurrency(props.totalExpenses!)}</div>
        </div>
      )}

      {props.netIncome !== undefined && (
        <div className={`rounded-lg border bg-white p-3 text-center ${props.netIncome >= 0 ? "border-gray-100" : "border-red-200"}`}>
          <div className="text-[10px] uppercase text-gray-500">Net Income</div>
          <div className={`mt-1 text-xl font-extrabold ${props.netIncome >= 0 ? "text-success-600" : "text-error-600"}`}>
            {formatCurrency(props.netIncome)}
          </div>
        </div>
      )}

      {hasBreakeven && (
        <div className={`rounded-lg border bg-white p-3 text-center ${aboveBreakeven ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
          <div className="text-[10px] uppercase text-gray-500">MRR vs Breakeven</div>
          <div className={`mt-1 text-xl font-extrabold ${aboveBreakeven ? "text-success-600" : "text-error-600"}`}>
            {aboveBreakeven ? "+" : "-"}{formatCurrency(Math.abs(breakevenGap))}
          </div>
          <div className="text-[11px] text-gray-400">Cost base {formatCurrency(props.burnRate!)}/mo</div>
        </div>
      )}
    </div>
  );
}
