"use client"

import { useSession } from "next-auth/react";
import { redirect, useSearchParams } from "next/navigation";
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
  AlertCircle,
  RefreshCw,
  BarChart,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { QuickFilters } from "@/components/dashboard/quick-filters";
import { useEffect, useState } from "react";

/**
 * Main Dashboard - Quick Overview & Actions
 *
 * Shows high-level KPIs and quick navigation buttons
 * Detailed analytics and filters are in the Insights tab
 */
export default function DashboardPage() {
  const { data: session, status } = useSession();
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

  // Get filter params from URL (default to thisYear instead of allTime)
  const dateRange = searchParams.get("dateRange") || "thisYear";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const segment = searchParams.get("segment");
  const invoiceStatus = searchParams.get("invoiceStatus");
  const dealStatus = searchParams.get("dealStatus");

  // Fetch comprehensive metrics from API - MUST be before any conditional returns
  useEffect(() => {
    async function fetchMetrics() {
      try {
        // Build query params with filters
        const params = new URLSearchParams();
        if (dateRange) params.set("dateRange", dateRange);
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        if (segment) params.set("segment", segment);
        if (invoiceStatus) params.set("invoiceStatus", invoiceStatus);
        if (dealStatus) params.set("dealStatus", dealStatus);

        const url = `/api/dashboard/metrics${params.toString() ? `?${params.toString()}` : ""}`;
        const response = await fetch(url, {
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
  }, [session, dateRange, from, to, segment, invoiceStatus, dealStatus]);

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
              Área Comercial - Gestão de Faturas
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
                <p className="text-lg font-bold text-gray-900">Criar Fatura</p>
                <p className="text-sm text-gray-600">
                  Nova fatura para cliente
                </p>
              </div>
            </Link>
            <Link
              href="/dashboard/invoices"
              className="group rounded-xl border border-green-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative">
                <p className="text-lg font-bold text-gray-900">Minhas Faturas</p>
                <p className="text-sm text-gray-600">
                  Ver faturas criadas por mim
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

  // SUPPORT users see support-focused dashboard
  if (userRole === "SUPPORT") {
    return (
      <div className="bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 py-8">
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
              {getGreeting()}, {firstName}
            </h1>
            <p className="text-gray-600">
              Central de Atendimento
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            <Link
              href="/dashboard/conversations"
              className="group rounded-xl border border-purple-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative">
                <p className="text-lg font-bold text-gray-900">Conversas</p>
                <p className="text-sm text-gray-600">
                  Atender conversas pendentes
                </p>
              </div>
            </Link>
            <Link
              href="/dashboard/customers"
              className="group rounded-xl border border-blue-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative">
                <p className="text-lg font-bold text-gray-900">Clientes</p>
                <p className="text-sm text-gray-600">
                  Consultar dados de clientes
                </p>
              </div>
            </Link>
            <Link
              href="/dashboard/deals"
              className="group rounded-xl border border-green-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative">
                <p className="text-lg font-bold text-gray-900">Negocios</p>
                <p className="text-sm text-gray-600">
                  Acompanhar negocios
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // SDR users see leads-focused dashboard
  if (userRole === "SDR") {
    return (
      <div className="bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 py-8">
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
              {getGreeting()}, {firstName}
            </h1>
            <p className="text-gray-600">
              Qualificacao de Leads
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            <Link
              href="/dashboard/leads"
              className="group rounded-xl border border-purple-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative">
                <p className="text-lg font-bold text-gray-900">Leads</p>
                <p className="text-sm text-gray-600">
                  Qualificar e gerenciar leads
                </p>
              </div>
            </Link>
            <Link
              href="/dashboard/conversations"
              className="group rounded-xl border border-blue-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative">
                <p className="text-lg font-bold text-gray-900">Conversas</p>
                <p className="text-sm text-gray-600">
                  Acompanhar conversas com leads
                </p>
              </div>
            </Link>
            <Link
              href="/dashboard/deals"
              className="group rounded-xl border border-green-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative">
                <p className="text-lg font-bold text-gray-900">Negocios</p>
                <p className="text-sm text-gray-600">
                  Acompanhar negocios
                </p>
              </div>
            </Link>
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
            Veja o que está acontecendo com o seu negócio hoje
          </p>
        </div>

        {/* ========== QUICK FILTERS ========== */}
        <div className="mb-8">
          <QuickFilters />
        </div>

        {/* ========== FINANCE SECTION ========== */}
        <div className="mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2 mb-6">
            <DollarSign className="h-6 w-6 text-gold-600" />
            Métricas Financeiras
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              label="Receita Total"
              value={formatCurrency(metrics.finance.totalRevenue)}
              change={`+${metrics.finance.revenueGrowth}%`}
              trend={parseFloat(metrics.finance.revenueGrowth) > 0 ? "up" : parseFloat(metrics.finance.revenueGrowth) < 0 ? "down" : "neutral"}
              description="em relação ao mês passado"
              icon={<DollarSign className="h-5 w-5 text-success-600" />}
            />
            <StatCard
              label="Total de Faturas"
              value={formatNumber(metrics.finance.totalInvoices)}
              description={`${metrics.finance.totalInvoices - metrics.finance.overdueCount} pagas`}
              icon={<FileText className="h-5 w-5 text-gold-600" />}
            />
            <StatCard
              label="Clientes Ativos"
              value={formatNumber(metrics.customers.totalCustomers)}
              change={`+${metrics.customers.newCustomersThisMonth}`}
              trend="up"
              description="novos este mês"
              icon={<Users className="h-5 w-5 text-info-600" />}
            />
            <StatCard
              label="Faturas Vencidas"
              value={formatCurrency(metrics.finance.overdueAmount)}
              description={`${metrics.finance.overdueCount} faturas precisam de atenção`}
              icon={<AlertCircle className="h-5 w-5 text-error-600" />}
            />
          </div>
        </div>

        {/* ========== QUICK ACTIONS ========== */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Ações Rápidas
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link
              href="/dashboard/invoices/new"
              className="group block bg-white rounded-lg border border-gray-200 p-6 hover:border-gold-200 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-gold-50 rounded-lg flex items-center justify-center">
                  <FileText className="h-5 w-5 text-gold-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-1">
                    Criar Fatura
                  </h3>
                  <p className="text-base text-gray-500">
                    Gerar nova fatura para clientes
                  </p>
                </div>
              </div>
            </Link>
            <Link
              href="/dashboard/settings/integrations"
              className="group block bg-white rounded-lg border border-gray-200 p-6 hover:border-gold-200 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-success-50 rounded-lg flex items-center justify-center">
                  <RefreshCw className="h-5 w-5 text-success-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-1">
                    Sincronizar QuickBooks
                  </h3>
                  <p className="text-base text-gray-500">
                    Atualizar faturas e clientes
                  </p>
                </div>
              </div>
            </Link>
            <Link
              href="/dashboard/insights"
              className="group block bg-white rounded-lg border border-gray-200 p-6 hover:border-gold-200 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-gold-50 rounded-lg flex items-center justify-center">
                  <BarChart className="h-5 w-5 text-gold-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-1">
                    Ver Relatórios
                  </h3>
                  <p className="text-base text-gray-500">
                    Insights e análises do negócio
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
