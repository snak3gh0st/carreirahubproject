"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { InvoiceStatusChart } from "@/components/dashboard/charts/invoice-status-chart";
import { RevenueTrendChart } from "@/components/dashboard/charts/revenue-trend-chart";
import { TopCustomersChart } from "@/components/dashboard/charts/top-customers-chart";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { AlertsWidget } from "@/components/dashboard/alerts-widget";
import { exportToCSV, getDateStamp } from "@/lib/utils/export-csv";
import { PieChart, Pie, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, Users, DollarSign, AlertCircle, Target, ShoppingCart, FileText, Database } from "lucide-react";

interface BIDashboardData {
  kpis: {
    // Financial KPIs
    totalRevenue: number;
    totalInvoiced: number;
    totalPaid: number;
    pendingAmount: number;
    overdueAmount: number;
    collectionRate: number;
    overduePercentage: number;

    // Invoice KPIs
    totalInvoices: number;
    paidInvoiceCount: number;
    paidInvoicePercentage: number;
    overdueInvoiceCount: number;
    overdueInvoicePercentage: number;
    avgDaysToPayment: number;

    // Customer KPIs
    activeCustomers: number;
    newCustomers: number;
    avgCustomerValue: number;
    revenueConcentration: number;

    // Sales KPIs
    totalDeals: number;
    wonDeals: number;
    winRate: number;
    avgDealValue: number;
    totalLeads: number;
    qualifiedLeads: number;
    leadQualificationRate: number;

    // Service KPIs
    uniqueServices: number;
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
    topServices: Array<{ name: string; quantity: number; revenue: number }>;
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

  // Get ALL filter params from URL
  const dateRange = searchParams.get("dateRange");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const segment = searchParams.get("segment");
  const invoiceStatus = searchParams.get("invoiceStatus");
  const dealStatus = searchParams.get("dealStatus");

  // Calculate active filter count for visual indicator
  const activeFilterCount = [
    dateRange && dateRange !== "allTime",
    segment && segment !== "all",
    invoiceStatus,
    dealStatus,
  ].filter(Boolean).length;

  // Fetch BI dashboard data with ALL filters
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<BIDashboardData>({
    // Include ALL filter params in query key to trigger refetch on any change
    queryKey: ["bi-dashboard", dateRange, from, to, segment, invoiceStatus, dealStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      // Add all filter params to API request
      if (dateRange) params.set("dateRange", dateRange);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (segment) params.set("segment", segment);
      if (invoiceStatus) params.set("invoiceStatus", invoiceStatus);
      if (dealStatus) params.set("dealStatus", dealStatus);

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
    <div className="bg-gray-50">
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">
              Business Insights
            </h1>
            <p className="text-gray-600 mt-1">
              High-impact metrics and visual analytics for strategic decision-making
            </p>
          </div>
          <Link
            href="/dashboard/analytics"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
            title="View QuickBooks analytics including receivables and aging"
          >
            <Database className="w-5 h-5" />
            QB Analytics
          </Link>
        </div>
      </div>

      {/* Filters with active count badge */}
      <div className="relative mb-6">
        <DashboardFilters onFiltersChange={() => refetch()} />
        {activeFilterCount > 0 && (
          <div className="absolute top-4 right-4 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
            {activeFilterCount} {activeFilterCount === 1 ? "filter" : "filters"} active
          </div>
        )}
      </div>

      {/* Alerts Widget (fixed position) */}
      <AlertsWidget />

      {/* Error State */}
      {isError && (
        <div className="mb-6 bg-red-50">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-red-500" />
            <div className="flex-1">
              <h3 className="text-red-800">Error Loading Analytics</h3>
              <p className="text-red-600">{error?.message}</p>
            </div>
            <button onClick={() => refetch()} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Retry</button>
          </div>
        </div>
      )}

      {/* Core KPI Grid - 2 rows x 4 columns (8 high-impact metrics) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Row 1: Financial Health */}
        <KpiCard
          title="Total Revenue"
          value={data ? formatCurrency(data.kpis.totalRevenue) : "$0"}
          subtitle={data ? `${formatPercentage(data.kpis.collectionRate)} collection rate` : "0% collection"}
          icon={<div className="text-green-500"><DollarSign className="w-5 h-5" /></div>}
          isLoading={isLoading}
        />
        <KpiCard
          title="Overdue Amount"
          value={data ? formatCurrency(data.kpis.overdueAmount) : "$0"}
          subtitle={data ? `${formatPercentage(data.kpis.overduePercentage)} of invoiced` : "0%"}
          valueColor="text-red-600"
          icon={<div className="text-red-500"><AlertCircle className="w-5 h-5" /></div>}
          isLoading={isLoading}
        />
        <KpiCard
          title="Avg Days to Payment"
          value={data ? `${data.kpis.avgDaysToPayment}d` : "0d"}
          subtitle="Payment cycle time"
          icon={<div className="text-orange-500"><AlertCircle className="w-5 h-5" /></div>}
          isLoading={isLoading}
        />
        <KpiCard
          title="Active Customers"
          value={data ? formatInteger(data.kpis.activeCustomers) : "0"}
          subtitle={data ? `${formatCurrency(data.kpis.avgCustomerValue)} avg value` : "$0 avg"}
          icon={<div className="text-indigo-500"><Users className="w-5 h-5" /></div>}
          isLoading={isLoading}
        />

        {/* Row 2: Sales & Growth */}
        <KpiCard
          title="Won Deals"
          value={data ? formatInteger(data.kpis.wonDeals) : "0"}
          subtitle={data ? `${formatPercentage(data.kpis.winRate)} win rate • ${formatCurrency(data.kpis.avgDealValue)} avg` : "0%"}
          icon={<div className="text-green-600"><Target className="w-5 h-5" /></div>}
          isLoading={isLoading}
        />
        <KpiCard
          title="Lead Qualification"
          value={data ? formatPercentage(data.kpis.leadQualificationRate) : "0%"}
          subtitle={data ? `${data.kpis.qualifiedLeads} of ${data.kpis.totalLeads} leads` : "0 qualified"}
          icon={<div className="text-cyan-500"><Users className="w-5 h-5" /></div>}
          isLoading={isLoading}
        />
        <KpiCard
          title="Revenue Concentration"
          value={data ? formatPercentage(data.kpis.revenueConcentration) : "0%"}
          subtitle="From top 20% customers"
          icon={<div className="text-purple-500"><TrendingUp className="w-5 h-5" /></div>}
          isLoading={isLoading}
        />
        <KpiCard
          title="Service Diversity"
          value={data ? formatInteger(data.kpis.uniqueServices) : "0"}
          subtitle="Unique services sold"
          icon={<div className="text-indigo-500"><ShoppingCart className="w-5 h-5" /></div>}
          isLoading={isLoading}
        />
      </div>

      {/* Priority Charts Grid - High-value visualizations first */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Revenue Trend - MOST IMPORTANT */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend (12 Months)</h3>
          {isLoading ? (
            <div className="h-80 animate-pulse bg-gray-200 rounded" />
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

        {/* Lead Funnel - CRITICAL MISSING VISUALIZATION */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Conversion Funnel</h3>
          {isLoading ? (
            <div className="h-80 animate-pulse bg-gray-200 rounded" />
          ) : data?.charts.leadFunnel?.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.charts.leadFunnel} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="stage" type="category" width={100} />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#3b82f6" name="Leads" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-500">No lead data</div>
          )}
        </div>

        {/* Invoice Aging - Financial health indicator */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Aging Distribution</h3>
          {isLoading ? (
            <div className="h-80 animate-pulse bg-gray-200 rounded" />
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

        {/* Top Customers - Concentration risk */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Customers by Revenue</h3>
          {isLoading ? (
            <div className="h-80 animate-pulse bg-gray-200 rounded" />
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

        {/* Top Services - Product mix analysis */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Services by Quantity & Revenue</h3>
          {isLoading ? (
            <div className="h-80 animate-pulse bg-gray-200 rounded" />
          ) : data?.charts.topServices?.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.charts.topServices}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === "revenue") return [formatCurrency(value as number), "Revenue"];
                    return [value, "Quantity"];
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="quantity" fill="#8b5cf6" name="Quantity" />
                <Bar yAxisId="right" dataKey="revenue" fill="#f59e0b" name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-500">No service data</div>
          )}
        </div>

        {/* Sales Pipeline - Deal visibility */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Pipeline Value by Status</h3>
          {isLoading ? (
            <div className="h-80 animate-pulse bg-gray-200 rounded" />
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
