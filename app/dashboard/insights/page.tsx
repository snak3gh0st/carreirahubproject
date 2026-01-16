"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { InvoiceStatusChart } from "@/components/dashboard/charts/invoice-status-chart";
import { RevenueTrendChart } from "@/components/dashboard/charts/revenue-trend-chart";
import { TopCustomersChart } from "@/components/dashboard/charts/top-customers-chart";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { exportToCSV, getDateStamp } from "@/lib/utils/export-csv";
import { PieChart, Pie, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, Users, DollarSign, AlertCircle, Target, ShoppingCart, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

interface BIDashboardData {
  kpis: {
    totalRevenue: number;
    overdueAmount: number;
    collectionRate: number;
    overduePercentage: number;
    activeCustomers: number;
    newCustomers: number;
    totalInvoiced: number;
    totalPaid: number;
    pendingAmount: number;
    avgCustomerValue: number;
    totalDeals: number;
    wonDeals: number;
    winRate: number;
    totalLeads: number;
    qualifiedLeads: number;
    leadQualificationRate: number;
    avgDealValue: number;
  };
  charts: {
    invoiceStatus: Array<{ name: string; value: number; amount: number }>;
    dealStatus: Array<{ name: string; value: number; amount: number }>;
    revenueTrend: Array<{ month: string; revenue: number }>;
    invoiceCountTrend: Array<{ month: string; count: number }>;
    topCustomers: Array<{ name: string; value: number }>;
    dealsPipeline: Array<{ status: string; deals: number; value: number }>;
    invoiceAging: Array<{ name: string; value: number }>;
    leadFunnel: Array<{ stage: string; value: number }>;
  };
}

// Format currency using Intl.NumberFormat
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
};

// Format percentage
const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

// Format integer with commas
const formatInteger = (value: number): string => {
  return value.toLocaleString();
};

export default function InsightsPage() {
  const searchParams = useSearchParams();
  const [isExporting, setIsExporting] = useState(false);

  // Get filter params from URL
  const dateRange = searchParams.get("dateRange");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Fetch BI dashboard data with filters
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<BIDashboardData>({
    queryKey: ["bi-dashboard", dateRange, from, to],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange) params.set("dateRange", dateRange);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const url = `/api/analytics/bi-dashboard${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch BI analytics");
      }
      return response.json();
    },
  });

  const handleExportAll = () => {
    if (!data) {
      alert("No data to export");
      return;
    }
    setIsExporting(true);
    try {
      const dateStamp = getDateStamp();
      const kpisData = [
        {
          "Total Revenue": formatCurrency(data.kpis.totalRevenue),
          "Total Invoiced": formatCurrency(data.kpis.totalInvoiced),
          "Total Paid": formatCurrency(data.kpis.totalPaid),
          "Pending Amount": formatCurrency(data.kpis.pendingAmount),
          "Overdue Amount": formatCurrency(data.kpis.overdueAmount),
          "Collection Rate": formatPercentage(data.kpis.collectionRate),
          "Active Customers": data.kpis.activeCustomers,
          "Total Deals": data.kpis.totalDeals,
          "Won Deals": data.kpis.wonDeals,
          "Win Rate": formatPercentage(data.kpis.winRate),
          "Total Leads": data.kpis.totalLeads,
          "Qualified Leads": data.kpis.qualifiedLeads,
        },
      ];
      exportToCSV(kpisData, `bi-dashboard-kpis-${dateStamp}.csv`);
      setTimeout(() => {
        alert("Successfully exported BI dashboard data!");
        setIsExporting(false);
      }, 100);
    } catch (error) {
      console.error("Error exporting data:", error);
      alert("Error exporting data. Please try again.");
      setIsExporting(false);
    }
  };

  const COLORS = ["#3b82f6", "#ef4444", "#f97316", "#eab308", "#10b981", "#8b5cf6"];
  const chartColors = {
    revenue: "#3b82f6",
    invoiceCount: "#10b981",
    pending: "#f97316",
  };

  return (
    <div className="bg-gray-50 dark:bg-slate-900 min-h-screen">
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          Business Intelligence Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Comprehensive analytics powered by QuickBooks data
        </p>
      </div>

      {/* Alerts & Filters */}
      <AlertsPanel />
      <DashboardFilters onFiltersChange={() => refetch()} />

      {/* Error State */}
      {isError && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-red-500" />
            <div className="flex-1">
              <h3 className="text-red-800 dark:text-red-200 font-semibold">Error Loading Analytics</h3>
              <p className="text-red-600 dark:text-red-300 text-sm">{error?.message}</p>
            </div>
            <button onClick={() => refetch()} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Retry</button>
          </div>
        </div>
      )}

      {/* Main KPI Grid - 4 rows x 4 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Revenue KPIs */}
        <KpiCard
          title="Total Revenue"
          value={data ? formatCurrency(data.kpis.totalRevenue) : "$0"}
          subtitle="Total paid invoices"
          icon={<div className="text-green-500"><DollarSign className="w-5 h-5" /></div>}
          isLoading={isLoading}
        />
        <KpiCard
          title="Total Invoiced"
          value={data ? formatCurrency(data.kpis.totalInvoiced) : "$0"}
          subtitle="All outstanding + paid"
          icon={<div className="text-blue-500"><FileText className="w-5 h-5" /></div>}
          isLoading={isLoading}
        />
        <KpiCard
          title="Total Paid"
          value={data ? formatCurrency(data.kpis.totalPaid) : "$0"}
          subtitle="Collected payments"
          icon={<div className="text-green-600"><TrendingUp className="w-5 h-5" /></div>}
          isLoading={isLoading}
        />
        <KpiCard
          title="Pending Amount"
          value={data ? formatCurrency(data.kpis.pendingAmount) : "$0"}
          subtitle="Awaiting payment"
          icon={<div className="text-yellow-500"><AlertCircle className="w-5 h-5" /></div>}
          isLoading={isLoading}
        />

        {/* Financial Health KPIs */}
        <KpiCard
          title="Overdue Amount"
          value={data ? formatCurrency(data.kpis.overdueAmount) : "$0"}
          subtitle={data ? `${formatPercentage(data.kpis.overduePercentage)} of invoiced` : "0%"}
          valueColor="text-red-600 dark:text-red-400"
          icon={<div className="text-red-500"><AlertCircle className="w-5 h-5" /></div>}
          isLoading={isLoading}
        />
        <KpiCard
          title="Collection Rate"
          value={data ? formatPercentage(data.kpis.collectionRate) : "0%"}
          subtitle="Paid vs invoiced"
          icon={<div className="text-blue-500"><TrendingUp className="w-5 h-5" /></div>}
          isLoading={isLoading}
        />
        <KpiCard
          title="Avg Customer Value"
          value={data ? formatCurrency(data.kpis.avgCustomerValue) : "$0"}
          subtitle="Per active customer"
          icon={<div className="text-purple-500"><Users className="w-5 h-5" /></div>}
          isLoading={isLoading}
        />
        <KpiCard
          title="Active Customers"
          value={data ? formatInteger(data.kpis.activeCustomers) : "0"}
          subtitle="Last 90 days"
          icon={<div className="text-indigo-500"><Users className="w-5 h-5" /></div>}
          isLoading={isLoading}
        />

        {/* Sales KPIs */}
        <KpiCard
          title="Total Deals"
          value={data ? formatInteger(data.kpis.totalDeals) : "0"}
          subtitle="All pipeline"
          icon={<div className="text-orange-500"><ShoppingCart className="w-5 h-5" /></div>}
          isLoading={isLoading}
        />
        <KpiCard
          title="Won Deals"
          value={data ? formatInteger(data.kpis.wonDeals) : "0"}
          subtitle={data ? `${formatPercentage(data.kpis.winRate)} win rate` : "0%"}
          icon={<div className="text-green-600"><Target className="w-5 h-5" /></div>}
          isLoading={isLoading}
        />
        <KpiCard
          title="Avg Deal Value"
          value={data ? formatCurrency(data.kpis.avgDealValue) : "$0"}
          subtitle="Per won deal"
          icon={<div className="text-green-500"><DollarSign className="w-5 h-5" /></div>}
          isLoading={isLoading}
        />
        <KpiCard
          title="Total Leads"
          value={data ? formatInteger(data.kpis.totalLeads) : "0"}
          subtitle={data ? `${formatInteger(data.kpis.qualifiedLeads)} qualified` : "0 qualified"}
          icon={<div className="text-cyan-500"><Users className="w-5 h-5" /></div>}
          isLoading={isLoading}
        />
      </div>

      {/* Charts Grid - 2x2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Revenue Trend Line Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Revenue Trend (12 Months)</h3>
          {isLoading ? (
            <div className="h-80 animate-pulse bg-gray-200 dark:bg-gray-700 rounded" />
          ) : data?.charts.revenueTrend?.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.charts.revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke={chartColors.revenue} strokeWidth={2} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-500">No data</div>
          )}
        </div>

        {/* Invoice Count Trend */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Invoice Count Trend</h3>
          {isLoading ? (
            <div className="h-80 animate-pulse bg-gray-200 dark:bg-gray-700 rounded" />
          ) : data?.charts.invoiceCountTrend?.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.charts.invoiceCountTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="count" stroke={chartColors.invoiceCount} strokeWidth={2} name="Invoices Created" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-500">No data</div>
          )}
        </div>

        {/* Invoice Status Pie */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Invoice Distribution by Status</h3>
          {isLoading ? (
            <div className="h-80 animate-pulse bg-gray-200 dark:bg-gray-700 rounded" />
          ) : data?.charts.invoiceStatus?.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={data.charts.invoiceStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {data.charts.invoiceStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-500">No data</div>
          )}
        </div>

        {/* Deal Status Pie */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Deal Distribution by Status</h3>
          {isLoading ? (
            <div className="h-80 animate-pulse bg-gray-200 dark:bg-gray-700 rounded" />
          ) : data?.charts.dealStatus?.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={data.charts.dealStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {data.charts.dealStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `$${(value as number).toLocaleString()}` } />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-500">No data</div>
          )}
        </div>

        {/* Top Customers Bar Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top 10 Customers by Revenue</h3>
          {isLoading ? (
            <div className="h-80 animate-pulse bg-gray-200 dark:bg-gray-700 rounded" />
          ) : data?.charts.topCustomers?.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.charts.topCustomers}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Legend />
                <Bar dataKey="value" fill={chartColors.revenue} name="Total Revenue" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-500">No data</div>
          )}
        </div>
      </div>

      {/* Invoice Aging & Pipeline Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Invoice Aging */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Invoice Aging Distribution</h3>
          {isLoading ? (
            <div className="h-80 animate-pulse bg-gray-200 dark:bg-gray-700 rounded" />
          ) : data?.charts.invoiceAging?.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.charts.invoiceAging}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Legend />
                <Bar dataKey="value" fill="#f97316" name="Amount" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-500">No data</div>
          )}
        </div>

        {/* Sales Pipeline */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Sales Pipeline Value by Status</h3>
          {isLoading ? (
            <div className="h-80 animate-pulse bg-gray-200 dark:bg-gray-700 rounded" />
          ) : data?.charts.dealsPipeline?.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.charts.dealsPipeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Legend />
                <Bar yAxisId="left" dataKey="deals" fill="#3b82f6" name="Deal Count" />
                <Bar yAxisId="right" dataKey="value" fill="#10b981" name="Pipeline Value" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-500">No data</div>
          )}
        </div>
      </div>

      {/* Export Button */}
      <div className="flex justify-end">
        <button
          onClick={handleExportAll}
          disabled={isLoading || isExporting || !data}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isExporting ? (
            <>
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Exporting...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export BI Dashboard
            </>
          )}
        </button>
      </div>
    </div>
    </div>
  );
}
