"use client";

import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FinancialBIResponse, DateRangeParam } from "@/lib/types/financial-bi";
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

const tabs = [
  { key: "revenue", label: "Revenue & Growth" },
  { key: "ar", label: "AR & Collections" },
  { key: "cashflow", label: "Cash Flow" },
  { key: "customers", label: "Customer Analysis" },
  { key: "pnl", label: "P&L & Expenses" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

function buildParams(dateRange: string, from?: string, to?: string, tab?: string) {
  const params = new URLSearchParams();
  params.set("dateRange", dateRange);
  if (tab) params.set("tab", tab);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return params.toString();
}

export default function FinancialDashboardPage() {
  const searchParams = useSearchParams();
  const dateRange = (searchParams.get("dateRange") || "last30") as DateRangeParam;
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;

  const [activeTab, setActiveTab] = useState<TabKey>("revenue");
  const queryPlan = getFinancialQueryPlan(activeTab);

  // Phase 1: summary + P&L only. Heavy tab payloads load separately so the page opens faster.
  const { data: summaryData, isLoading: summaryLoading, isError, refetch } = useQuery<FinancialBIResponse>({
    queryKey: ["financial-bi-summary", dateRange, from, to],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/financial-bi?${buildParams(dateRange, from, to, queryPlan.summaryTab)}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // Heavy tab payloads are lazy-loaded after the summary data is available.
  const {
    data: activeTabData,
    isLoading: activeTabLoading,
  } = useQuery<FinancialBIResponse>({
    queryKey: ["financial-bi-tab", dateRange, from, to, activeTab],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/financial-bi?${buildParams(dateRange, from, to, queryPlan.activeTabRequest || undefined)}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: Boolean(queryPlan.activeTabRequest) && Boolean(summaryData),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const data = summaryData;
  const revenueData = activeTab === "revenue" ? activeTabData?.revenueGrowth : undefined;
  const arData = activeTab === "ar" ? activeTabData?.arCollections : undefined;
  const cashFlowData = activeTab === "cashflow" ? activeTabData?.cashFlow : undefined;
  const customerData = activeTab === "customers" ? activeTabData?.customerAnalysis : undefined;
  const pnl = data?.pnl;

  const handleExport = async (format: "pdf" | "excel") => {
    const endpoint = format === "pdf"
      ? `/api/analytics/financial-bi/export/pdf?${buildParams(dateRange, from, to)}`
      : `/api/analytics/financial-bi/export/excel?${buildParams(dateRange, from, to)}`;

    const res = await fetch(endpoint);
    if (!res.ok) return;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = format === "pdf" ? "financial-report.pdf" : "financial-report.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-gray-500">Failed to load financial data.</p>
        <button onClick={() => refetch()} className="mt-3 rounded-md bg-brand-tangerina px-4 py-2 text-sm text-white">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Financial Overview</h1>
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
              url.searchParams.set("dateRange", e.target.value);
              window.history.pushState({}, "", url.toString());
              window.location.reload();
            }}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs"
          >
            <option value="last7">Last 7 days</option>
            <option value="last30">Last 30 days</option>
            <option value="last90">Last 90 days</option>
            <option value="thisYear">This Year</option>
            <option value="allTime">All Time</option>
          </select>
          <button onClick={() => handleExport("pdf")} className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs hover:bg-gray-50">
            Export PDF
          </button>
          <button onClick={() => handleExport("excel")} className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs hover:bg-gray-50">
            Export Excel
          </button>
        </div>
      </div>

      {summaryLoading && (
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded-xl bg-gray-200" />
          <div className="h-16 animate-pulse rounded-xl bg-gray-200" />
          <div className="grid grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-200" />)}
          </div>
        </div>
      )}

      {data && (
        <>
          <CfoBriefing insight={data.cfoInsight} />
          <CfoActionItems actions={data.cfoInsight.actions} />
          <FinancialKpiRow
            revenue={data.summary.revenue}
            collectionRate={data.summary.collectionRate}
            outstandingAR={data.summary.outstandingAR}
            mrr={data.summary.mrr}
            topClientConcentration={data.summary.topClientConcentration}
            totalExpenses={pnl?.totalExpenses}
            netIncome={pnl?.netIncome}
            cashOnHand={pnl?.cashOnHand}
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
            {activeTab === "cashflow" && cashFlowData && <CashFlowTab data={cashFlowData} />}
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
