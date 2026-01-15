"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { InvoiceStatusChart } from "@/components/dashboard/charts/invoice-status-chart";
import { RevenueTrendChart } from "@/components/dashboard/charts/revenue-trend-chart";
import { TopCustomersChart } from "@/components/dashboard/charts/top-customers-chart";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { exportToCSV, getDateStamp } from "@/lib/utils/export-csv";

export const dynamic = "force-dynamic";

interface FinancialAnalytics {
  kpis: {
    totalRevenue: number;
    overdueAmount: number;
    collectionRate: number;
    activeCustomers: number;
  };
  invoiceStatusDistribution: Array<{
    status: string;
    count: number;
    value: number;
  }>;
  revenueTrend: Array<{
    month: string;
    revenue: number;
  }>;
  topCustomers: Array<{
    id: string;
    name: string;
    email: string;
    totalPaid: number;
  }>;
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

  // Fetch financial analytics data with filters
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<FinancialAnalytics>({
    queryKey: ["financial-analytics", dateRange, from, to],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange) params.set("dateRange", dateRange);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const url = `/api/analytics/financial${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch financial analytics");
      }
      return response.json();
    },
  });

  // Export all data as CSV files
  const handleExportAll = () => {
    if (!data) {
      alert("No data to export");
      return;
    }

    setIsExporting(true);

    try {
      const dateStamp = getDateStamp();

      // 1. Export KPIs CSV
      const kpisData = [
        {
          "Total Revenue": formatCurrency(data.kpis.totalRevenue),
          "Overdue Amount": formatCurrency(data.kpis.overdueAmount),
          "Collection Rate": formatPercentage(data.kpis.collectionRate),
          "Active Customers": data.kpis.activeCustomers,
        },
      ];
      exportToCSV(kpisData, `financial-kpis-${dateStamp}.csv`);

      // Small delay between downloads to avoid browser blocking
      setTimeout(() => {
        // 2. Export Invoice Status CSV
        const invoiceStatusData = data.invoiceStatusDistribution.map((item) => ({
          Status: item.status,
          Count: item.count,
          "Total Value": formatCurrency(item.value),
        }));
        exportToCSV(invoiceStatusData, `invoice-status-${dateStamp}.csv`);
      }, 100);

      setTimeout(() => {
        // 3. Export Revenue Trend CSV
        const revenueTrendData = data.revenueTrend.map((item) => ({
          Month: item.month,
          Revenue: formatCurrency(item.revenue),
        }));
        exportToCSV(revenueTrendData, `revenue-trend-${dateStamp}.csv`);
      }, 200);

      setTimeout(() => {
        // 4. Export Top Customers CSV
        const topCustomersData = data.topCustomers.map((customer) => ({
          Name: customer.name,
          Email: customer.email,
          "Total Paid": formatCurrency(customer.totalPaid),
        }));
        exportToCSV(topCustomersData, `top-customers-${dateStamp}.csv`);

        // Show success message after all exports complete
        setTimeout(() => {
          alert("Successfully exported 4 CSV files!");
          setIsExporting(false);
        }, 100);
      }, 300);
    } catch (error) {
      console.error("Error exporting data:", error);
      alert("Error exporting data. Please try again.");
      setIsExporting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Financial Insights
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Analytics and metrics for financial operations
        </p>
      </div>

      {/* Date Range Filter */}
      <DateRangeFilter onFilterChange={() => refetch()} />

      {/* Error State */}
      {isError && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-red-800 dark:text-red-200 font-semibold mb-1">
                Error Loading Analytics
              </h3>
              <p className="text-red-600 dark:text-red-300 text-sm">
                {error instanceof Error ? error.message : "Unknown error"}
              </p>
            </div>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Revenue Card */}
        <KpiCard
          title="Total Revenue"
          value={data ? formatCurrency(data.kpis.totalRevenue) : "$0.00"}
          subtitle="Total paid invoices"
          icon={
            <div className="text-green-500">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          }
          isLoading={isLoading}
        />

        {/* Overdue Amount Card */}
        <KpiCard
          title="Overdue Amount"
          value={data ? formatCurrency(data.kpis.overdueAmount) : "$0.00"}
          subtitle="Outstanding overdue invoices"
          valueColor="text-red-600 dark:text-red-400"
          icon={
            <div className="text-red-500">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          }
          isLoading={isLoading}
        />

        {/* Collection Rate Card */}
        <KpiCard
          title="Collection Rate"
          value={data ? formatPercentage(data.kpis.collectionRate) : "0%"}
          subtitle="Paid vs invoiced amount"
          icon={
            <div className="text-blue-500">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
          }
          isLoading={isLoading}
        />

        {/* Active Customers Card */}
        <KpiCard
          title="Active Customers"
          value={data ? formatInteger(data.kpis.activeCustomers) : "0"}
          subtitle="Last 90 days"
          icon={
            <div className="text-purple-500">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
          }
          isLoading={isLoading}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Invoice Status Distribution Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Invoice Status Distribution
          </h3>
          {isLoading ? (
            <div className="h-[400px] flex items-center justify-center">
              <div className="animate-pulse text-gray-500 dark:text-gray-400">
                Loading chart...
              </div>
            </div>
          ) : data ? (
            <InvoiceStatusChart data={data.invoiceStatusDistribution} />
          ) : (
            <div className="h-[400px] flex items-center justify-center text-gray-500 dark:text-gray-400">
              No data available
            </div>
          )}
        </div>

        {/* Revenue Trend Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Revenue Trend (Last 12 Months)
          </h3>
          {isLoading ? (
            <div className="h-[400px] flex items-center justify-center">
              <div className="animate-pulse text-gray-500 dark:text-gray-400">
                Loading chart...
              </div>
            </div>
          ) : data ? (
            <RevenueTrendChart data={data.revenueTrend} />
          ) : (
            <div className="h-[400px] flex items-center justify-center text-gray-500 dark:text-gray-400">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Top Customers Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Top 10 Customers by Revenue
        </h3>
        {isLoading ? (
          <div className="h-[400px] flex items-center justify-center">
            <div className="animate-pulse text-gray-500 dark:text-gray-400">
              Loading chart...
            </div>
          </div>
        ) : data ? (
          <TopCustomersChart data={data.topCustomers} />
        ) : (
          <div className="h-[400px] flex items-center justify-center text-gray-500 dark:text-gray-400">
            No data available
          </div>
        )}
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
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Exporting...
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Export All Data
            </>
          )}
        </button>
      </div>
    </div>
  );
}
