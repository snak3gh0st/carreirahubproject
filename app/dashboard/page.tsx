"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  TrendingUp,
  Users,
  FileText,
  DollarSign,
  ShoppingCart,
  Target,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { DashboardKPICard } from "@/components/dashboard/dashboard-kpi-card";
import { DashboardFilters, type FilterState } from "@/components/dashboard/dashboard-filters";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";

/**
 * Enhanced BI Dashboard
 *
 * Comprehensive view of company KPIs: Sales, Finance, and Customers
 * with real-time filtering and alert monitoring
 */
export default function DashboardPage() {
  const searchParams = useSearchParams();
  const [metrics, setMetrics] = useState({
    sales: {
      wonDealsThisMonth: 0,
      totalDeals: 0,
      wonDeals: 0,
      totalLeads: 0,
      qualifiedLeads: 0,
      conversionRate: "0.0",
      pipelineValue: 0,
      avgDealValue: 0,
    },
    finance: {
      totalRevenue: 0,
      totalInvoiced: 0,
      totalPaid: 0,
      pendingAmount: 0,
      overdueAmount: 0,
      collectionRate: "0.0",
      totalInvoices: 0,
      overdueCount: 0,
      revenueGrowth: "0",
    },
    customers: {
      totalCustomers: 0,
      newCustomersThisMonth: 0,
      avgCustomerValue: 0,
    },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch metrics when search params change
  useEffect(() => {
    fetchMetrics();
  }, [searchParams]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query string from search params
      const queryString = searchParams.toString();
      const url = `/api/dashboard/metrics${queryString ? `?${queryString}` : ""}`;

      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      } else {
        setError("Failed to fetch metrics");
      }
    } catch (err) {
      console.error("Failed to fetch metrics:", err);
      setError("Error loading metrics");
    } finally {
      setLoading(false);
    }
  };

  // Format currency helper
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);

  const formatNumber = (value: number) => value.toLocaleString("en-US");

  return (
    <div className="bg-gray-50 dark:bg-slate-900 min-h-screen">
      <div className="container mx-auto px-4 sm:px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Business Intelligence Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Real-time company metrics and KPIs
          </p>
        </div>

        {/* Alerts Panel */}
        <AlertsPanel />

        {/* Filters Panel */}
        <DashboardFilters onFiltersChange={() => fetchMetrics()} />

        {/* Loading State */}
        {loading && (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-8 mb-8 border border-gray-200 dark:border-gray-700">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-8">
            <p className="text-red-700 dark:text-red-200">{error}</p>
          </div>
        )}

        {!loading && (
          <>
        {/* ========== SALES & REVENUE SECTION ========== */}
        <div className="mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-blue-600" />
            Sales & Revenue
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <DashboardKPICard
              title="Total Deals"
              value={metrics.sales.totalDeals}
              icon={ShoppingCart}
              color="blue"
              subtitle="All-time"
            />
            <DashboardKPICard
              title="Deals Won This Month"
              value={metrics.sales.wonDealsThisMonth}
              icon={Target}
              color="green"
              subtitle="This month"
            />
            <DashboardKPICard
              title="Conversion Rate"
              value={`${metrics.sales.conversionRate}%`}
              icon={ArrowUpRight}
              color="purple"
              subtitle="Leads → Deals"
            />
            <DashboardKPICard
              title="Pipeline Value"
              value={formatCurrency(metrics.sales.pipelineValue)}
              icon={DollarSign}
              color="orange"
              subtitle="Open deals"
            />
          </div>
        </div>

        {/* ========== FINANCE SECTION ========== */}
        <div className="mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-green-600" />
            Finance Metrics
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <DashboardKPICard
              title="Total Revenue"
              value={formatCurrency(metrics.finance.totalRevenue)}
              icon={DollarSign}
              color="green"
              trend={{ value: parseFloat(metrics.finance.revenueGrowth), direction: "up", label: "MoM" }}
              subtitle="All-time paid"
            />
            <DashboardKPICard
              title="Total Invoiced"
              value={formatCurrency(metrics.finance.totalInvoiced)}
              icon={FileText}
              color="blue"
              subtitle="Outstanding + Paid"
            />
            <DashboardKPICard
              title="Collection Rate"
              value={`${metrics.finance.collectionRate}%`}
              icon={TrendingUp}
              color="purple"
              subtitle="Paid / Invoiced"
            />
            <DashboardKPICard
              title="Overdue Amount"
              value={formatCurrency(metrics.finance.overdueAmount)}
              icon={ArrowDownRight}
              color="red"
              subtitle={`${metrics.finance.overdueCount} invoices`}
            />
          </div>
        </div>

        {/* ========== CUSTOMER SECTION ========== */}
        <div className="mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-600" />
            Customer Metrics
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <DashboardKPICard
              title="Total Customers"
              value={formatNumber(metrics.customers.totalCustomers)}
              icon={Users}
              color="indigo"
              subtitle="All-time"
            />
            <DashboardKPICard
              title="New Customers (This Month)"
              value={metrics.customers.newCustomersThisMonth}
              icon={Users}
              color="green"
              subtitle="New acquisitions"
            />
            <DashboardKPICard
              title="Avg Customer Value"
              value={formatCurrency(metrics.customers.avgCustomerValue)}
              icon={DollarSign}
              color="orange"
              subtitle="Total revenue / customers"
            />
          </div>
        </div>

        {/* ========== QUICK ACTIONS ========== */}
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Link
              href="/dashboard/leads"
              className="group relative overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 transition-all hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500"
            >
              <div className="relative">
                <p className="font-semibold text-gray-900 dark:text-white">Leads</p>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Manage pipeline
                </p>
              </div>
            </Link>
            <Link
              href="/dashboard/deals"
              className="group relative overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 transition-all hover:shadow-lg hover:border-purple-400 dark:hover:border-purple-500"
            >
              <div className="relative">
                <p className="font-semibold text-gray-900 dark:text-white">Deals</p>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Track sales
                </p>
              </div>
            </Link>
            <Link
              href="/dashboard/invoices"
              className="group relative overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 transition-all hover:shadow-lg hover:border-green-400 dark:hover:border-green-500"
            >
              <div className="relative">
                <p className="font-semibold text-gray-900 dark:text-white">Invoices</p>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                  View & create
                </p>
              </div>
            </Link>
            <Link
              href="/dashboard/customers"
              className="group relative overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 transition-all hover:shadow-lg hover:border-indigo-400 dark:hover:border-indigo-500"
            >
              <div className="relative">
                <p className="font-semibold text-gray-900 dark:text-white">Customers</p>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Manage accounts
                </p>
              </div>
            </Link>
            <Link
              href="/dashboard/insights"
              className="group relative overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 transition-all hover:shadow-lg hover:border-orange-400 dark:hover:border-orange-500"
            >
              <div className="relative">
                <p className="font-semibold text-gray-900 dark:text-white">Insights</p>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Analytics & BI
                </p>
              </div>
            </Link>
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
