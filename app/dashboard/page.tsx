"use client"

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
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
import { useEffect, useState } from "react";

/**
 * Main Dashboard - Quick Overview & Actions
 *
 * Shows high-level KPIs and quick navigation buttons
 * Detailed analytics and filters are in the Insights tab
 */
export default function DashboardPage() {
  const { data: session, status } = useSession();
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

  // Fetch comprehensive metrics from API - MUST be before any conditional returns
  useEffect(() => {
    async function fetchMetrics() {
      try {
        const response = await fetch("/api/dashboard/metrics", {
          cache: "no-store",
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          if (data.sales && data.finance && data.customers) {
            setMetrics(data);
          }
        }
      } catch (error) {
        console.error("Failed to fetch metrics:", error);
      }
    }

    if (session) {
      fetchMetrics();
    }
  }, [session]);

  // Format currency helper
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);

  const formatNumber = (value: number) => value.toLocaleString("en-US");

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  // Check authentication status AFTER all hooks and function definitions
  if (status === "unauthenticated") {
    redirect("/auth/signin");
  }

  if (status === "loading") {
    return <div>Carregando...</div>;
  }

  const userName = session?.user?.name || "Usuário";
  const firstName = userName.split(" ")[0]; // Get first name only
  const userRole = (session?.user as any)?.role;

  // COMMERCIAL users see simplified dashboard
  if (userRole === "COMMERCIAL") {
    return (
      <div className="bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 py-8">
          {/* Page Header with Greeting */}
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
              {getGreeting()}, {firstName}! 👋
            </h1>
            <p className="text-gray-600">
              Área Comercial - Gestão de Invoices
            </p>
          </div>

          {/* Quick Actions for COMMERCIAL */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            <Link
              href="/dashboard/customers/new"
              className="group rounded-xl border border-purple-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative">
                <p className="text-lg font-bold text-gray-900">Criar Cliente</p>
                <p className="text-sm text-gray-600">
                  Novo cliente no QuickBooks
                </p>
              </div>
            </Link>
            <Link
              href="/dashboard/invoices/new"
              className="group rounded-xl border border-blue-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative">
                <p className="text-lg font-bold text-gray-900">Criar Invoice</p>
                <p className="text-sm text-gray-600">
                  Nova invoice para cliente
                </p>
              </div>
            </Link>
            <Link
              href="/dashboard/invoices"
              className="group rounded-xl border border-green-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative">
                <p className="text-lg font-bold text-gray-900">Minhas Invoices</p>
                <p className="text-sm text-gray-600">
                  Ver invoices criadas por mim
                </p>
              </div>
            </Link>
          </div>

          <div className="rounded-xl border border-blue-100 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Fluxo comercial (resumo)
            </h3>
            <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1">
              <li>Crie o cliente e confirme o e-mail</li>
              <li>Monte a invoice com um ou mais itens</li>
              <li>Envio imediato: invoice + contrato DocuSign</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // Admin/Finance/Sales users see full dashboard
  return (
    <div className="bg-gray-50">
      <div className="container mx-auto px-4 sm:px-6 py-8">
        {/* Page Header with Greeting */}
        <div className="mb-8">
          <h1 className="text-5xl font-semibold text-gray-900 mb-2">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-lg text-gray-500">
            Here's what's happening with your business today
          </p>
        </div>

        {/* ========== SALES & REVENUE SECTION ========== */}
        <div className="mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
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
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
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
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
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
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Link
              href="/dashboard/leads"
              className="group relative overflow-hidden rounded-lg border border-gray-200"
            >
              <div className="relative">
                <p className="font-semibold text-gray-900">Leads</p>
                <p className="text-xs sm:text-sm text-gray-600">
                  Manage pipeline
                </p>
              </div>
            </Link>
            <Link
              href="/dashboard/deals"
              className="group relative overflow-hidden rounded-lg border border-gray-200"
            >
              <div className="relative">
                <p className="font-semibold text-gray-900">Deals</p>
                <p className="text-xs sm:text-sm text-gray-600">
                  Track sales
                </p>
              </div>
            </Link>
            <Link
              href="/dashboard/invoices"
              className="group relative overflow-hidden rounded-lg border border-gray-200"
            >
              <div className="relative">
                <p className="font-semibold text-gray-900">Invoices</p>
                <p className="text-xs sm:text-sm text-gray-600">
                  View & create
                </p>
              </div>
            </Link>
            <Link
              href="/dashboard/customers"
              className="group relative overflow-hidden rounded-lg border border-gray-200"
            >
              <div className="relative">
                <p className="font-semibold text-gray-900">Customers</p>
                <p className="text-xs sm:text-sm text-gray-600">
                  Manage accounts
                </p>
              </div>
            </Link>
            <Link
              href="/dashboard/insights"
              className="group relative overflow-hidden rounded-lg border border-gray-200"
            >
              <div className="relative">
                <p className="font-semibold text-gray-900">Insights</p>
                <p className="text-xs sm:text-sm text-gray-600">
                  Analytics & BI
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
