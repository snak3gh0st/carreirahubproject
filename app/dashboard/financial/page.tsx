"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FinancialBIResponse, DateRangeParam } from "@/lib/types/financial-bi";
import type { ExecutiveBIResponse } from "@/lib/types/executive-bi";
import { LegacyExecutiveSummary } from "@/components/executive-bi/LegacyExecutiveSummary";
import { CfoBriefing } from "@/components/financial/CfoBriefing";
import { CfoActionItems } from "@/components/financial/CfoActionItems";
import { FinancialKpiRow } from "@/components/financial/FinancialKpiRow";
import { MiniChartRow } from "@/components/financial/MiniChartRow";
import { RevenueGrowthTab } from "@/components/financial/tabs/RevenueGrowthTab";
import { ArCollectionsTab } from "@/components/financial/tabs/ArCollectionsTab";
import { CashFlowTab } from "@/components/financial/tabs/CashFlowTab";
import { CustomerAnalysisTab } from "@/components/financial/tabs/CustomerAnalysisTab";
import { PnlExpensesTab } from "@/components/financial/tabs/PnlExpensesTab";
import { useState } from "react";
import { getFinancialQueryPlan } from "@/lib/financial/query-plan";
import {
  buildLegacyExecutiveCards,
  buildLegacyWindowParams,
} from "@/lib/executive-bi/legacy-summary";

const tabs = [
  { key: "revenue", label: "Revenue & Growth" },
  { key: "ar", label: "AR & Collections" },
  { key: "cashflow", label: "Cash Flow" },
  { key: "customers", label: "Customer Analysis" },
  { key: "pnl", label: "P&L & Expenses" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

function buildParams(dateRange: DateRangeParam, from?: string, to?: string, tab?: string) {
  const params = new URLSearchParams(buildLegacyWindowParams(dateRange, from, to));
  if (tab) params.set("tab", tab);
  return params.toString();
}

export default function FinancialDashboardPage() {
  const searchParams = useSearchParams();
  const dateRange = (searchParams.get("dateRange") || "last30") as DateRangeParam;
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;

  const [activeTab, setActiveTab] = useState<TabKey>("revenue");
  const queryPlan = getFinancialQueryPlan(activeTab);
  const preservedWindow = buildLegacyWindowParams(dateRange, from, to);

  // Phase 1: summary + P&L only. Heavy tab payloads load separately so the page opens faster.
  const {
    data: summaryData,
    isLoading: summaryLoading,
    isError: isFinancialError,
    refetch,
  } = useQuery<FinancialBIResponse>({
    queryKey: ["financial-bi-summary", dateRange, from, to],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/financial-bi?${buildParams(dateRange, from, to, queryPlan.summaryTab)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Heavy tab payloads are lazy-loaded after the summary data is available.
  const {
    data: activeTabData,
    isLoading: activeTabLoading,
  } = useQuery<FinancialBIResponse>({
    queryKey: ["financial-bi-tab", dateRange, from, to, activeTab],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/financial-bi?${buildParams(dateRange, from, to, queryPlan.activeTabRequest || undefined)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: Boolean(queryPlan.activeTabRequest) && Boolean(summaryData),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const {
    data: executiveData,
    isLoading: executiveLoading,
    isError: executiveIsError,
  } = useQuery<ExecutiveBIResponse>({
    queryKey: ["executive-bi-financial-summary", dateRange, from, to],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/executive-bi?${preservedWindow}`);
      if (!res.ok) throw new Error("Failed to fetch executive BI");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const data = summaryData;
  const revenueData = activeTab === "revenue" ? activeTabData?.revenueGrowth : undefined;
  const arData = activeTab === "ar" ? activeTabData?.arCollections : undefined;
  const cashFlowData = activeTab === "cashflow" ? activeTabData?.cashFlow : undefined;
  const receivablesProjection = activeTab === "cashflow" ? activeTabData?.receivablesProjection : undefined;
  const customerData = activeTab === "customers" ? activeTabData?.customerAnalysis : undefined;
  const pnl = data?.pnl;
  const executiveCards = executiveData ? buildLegacyExecutiveCards(executiveData) : [];
  const executiveSubtitle = executiveData
    ? `${executiveData.areas.finance.summary} The CFO detail tabs below stay available, but the shared KPI layer is pinned to the canonical cockpit response.`
    : "Use the CEO cockpit as the primary BI entry point. This page remains available for deeper financial detail, exports, and CFO execution work.";
  const executiveStatus = executiveData
    ? executiveData.areas.finance.freshness.summary
    : executiveIsError
      ? "Canonical executive summary is temporarily unavailable."
      : "Loading canonical executive summary.";

  const [qbRefreshing, setQbRefreshing] = useState(false);

  const handleRefreshQb = async () => {
    setQbRefreshing(true);
    try {
      await fetch("/api/analytics/financial-bi/refresh-qb", { method: "POST" });
      window.location.reload();
    } finally {
      setQbRefreshing(false);
    }
  };

  const handleExport = async (format: "pdf" | "excel" | "pptx") => {
    const base = `/api/analytics/financial-bi/export`;
    const qs = buildParams(dateRange, from, to);
    const endpointMap = {
      pdf: `${base}/pdf?${qs}`,
      excel: `${base}/excel?${qs}`,
      pptx: `${base}/presentation?${qs}`,
    };
    const filenameMap = {
      pdf: "financial-report.pdf",
      excel: "financial-report.xlsx",
      pptx: "financial-presentation.pptx",
    };

    const res = await fetch(endpointMap[format]);
    if (!res.ok) return;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filenameMap[format];
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 p-6">
      <LegacyExecutiveSummary
        eyebrow="Finance Deep Dive"
        title="QuickBooks Financial Detail"
        subtitle={executiveSubtitle}
        status={executiveStatus}
        cards={executiveCards}
        loading={executiveLoading && !executiveData}
        actions={
          <>
            <Link
              href={`/dashboard/bi?${preservedWindow}`}
              className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-brand-verde ring-1 ring-white/20 transition hover:bg-white/90"
            >
              Open BI Executivo
            </Link>
            <Link
              href="/ops/pipeline"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white ring-1 ring-white/20 transition hover:bg-white/15"
            >
              Ops detail
            </Link>
            {dateRange === "custom" && (from || to) ? (
              <span className="rounded-full bg-brand-tangerina/20 px-3 py-1.5 text-sm font-medium text-white">
                Custom window {from ?? "start"} to {to ?? "now"}
              </span>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-gray-900">Detail Tabs and Exports</h2>
          {data?.meta && (
            <p className="text-xs text-gray-500">
              Last synced with QuickBooks: {data.meta.lastQbSync === "Never" ? "Never" : new Date(data.meta.lastQbSync).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <select
            defaultValue={dateRange}
            onChange={(e) => {
              const url = new URL(window.location.href);
              const nextDateRange = e.target.value as DateRangeParam;
              url.searchParams.set("dateRange", nextDateRange);
              if (nextDateRange !== "custom") {
                url.searchParams.delete("from");
                url.searchParams.delete("to");
              }
              window.history.pushState({}, "", url.toString());
              window.location.reload();
            }}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs"
          >
            <option value="thisMonth">MTD</option>
            <option value="lastMonth">Last month</option>
            <option value="last7">Last 7 days</option>
            <option value="last30">Last 30 days</option>
            <option value="last90">Last 90 days</option>
            <option value="thisYear">This Year</option>
            <option value="allTime">All Time</option>
            <option value="custom">Custom range</option>
          </select>
          <button
            onClick={handleRefreshQb}
            disabled={qbRefreshing}
            className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            {qbRefreshing ? "Refreshing..." : "Refresh QB Reports"}
          </button>
          <button onClick={() => handleExport("pdf")} className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs hover:bg-gray-50">
            Export PDF
          </button>
          <button onClick={() => handleExport("excel")} className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs hover:bg-gray-50">
            Export Excel
          </button>
          <button onClick={() => handleExport("pptx")} className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs hover:bg-gray-50">
            Export PPTX
          </button>
        </div>
      </div>

      {isFinancialError && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white py-20">
          <p className="text-gray-500">Failed to load financial data.</p>
          <button onClick={() => refetch()} className="mt-3 rounded-md bg-brand-tangerina px-4 py-2 text-sm text-white">
            Retry
          </button>
        </div>
      )}

      {summaryLoading && (
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded-xl bg-gray-200" />
          <div className="h-16 animate-pulse rounded-xl bg-gray-200" />
          <div className="grid grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-200" />)}
          </div>
        </div>
      )}

      {!isFinancialError && data && (
        <>
          <CfoBriefing insight={data.cfoInsight} />
          <CfoActionItems actions={data.cfoInsight.actions} />
          <FinancialKpiRow
            revenue={data.summary.revenue}
            collectionRate={data.summary.collectionRate}
            outstandingAR={data.summary.outstandingAR}
            overdueAR={data.summary.overdueAR}
            mrr={data.summary.mrr}
            topClientConcentration={data.summary.topClientConcentration}
            delinquencyRate={data.summary.delinquencyRate}
            totalExpenses={pnl?.totalExpenses}
            netIncome={pnl?.netIncome}
            cashOnHand={pnl?.cashOnHand}
            burnRate={pnl?.burnRate}
          />
          <MiniChartRow
            revenueTrend={data.summary.revenueTrendMini}
            agingSnapshot={data.summary.agingSnapshotMini}
          />

          <div className="rounded-xl border bg-white p-4">
            <div className="mb-4 flex gap-0 border-b-2 border-gray-100">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-sm font-medium transition ${
                    activeTab === tab.key
                      ? "border-b-2 border-brand-tangerina -mb-[2px] text-brand-tangerina"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "revenue" && revenueData && <RevenueGrowthTab data={revenueData} />}
            {activeTab === "ar" && arData && <ArCollectionsTab data={arData} />}
            {activeTab === "cashflow" && cashFlowData && <CashFlowTab data={cashFlowData} receivablesProjection={receivablesProjection} />}
            {activeTab === "customers" && customerData && <CustomerAnalysisTab data={customerData} />}
            {activeTab === "pnl" && data.pnl && <PnlExpensesTab data={data.pnl} />}

            {/* Tab loading state */}
            {activeTabLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-tangerina border-t-transparent" />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
