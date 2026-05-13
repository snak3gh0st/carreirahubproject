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
  AlertCircle,
  RefreshCw,
  BarChart,
  CreditCard,
  Receipt,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { QuickFilters } from "@/components/dashboard/quick-filters";
import { DashboardActionCenter } from "@/components/dashboard/action-center";
import { useEffect, useState } from "react";

/**
 * Main Dashboard - Quick Overview & Actions
 *
 * Shows high-level KPIs and quick navigation buttons
 * The executive cockpit is the primary BI entry point.
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
    actions: {
      openInvoiceCount: 0,
      partialInvoiceCount: 0,
      pendingContractCount: 0,
      openDealCount: 0,
      qualifiedLeadCount: 0,
      quickbooksGapCount: 0,
      autoChargeRiskCount: 0,
    },
  });
  const [metricsLoading, setMetricsLoading] = useState(true);

  // Get filter params from URL (default to thisYear instead of allTime)
  const dateRange = searchParams.get("dateRange") || "thisYear";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const segment = searchParams.get("segment");
  const invoiceStatus = searchParams.get("invoiceStatus");
  const dealStatus = searchParams.get("dealStatus");

  // Fetch comprehensive metrics from API - MUST be before any conditional returns
  useEffect(() => {
    const controller = new AbortController();
    let isCurrent = true;

    async function fetchMetrics() {
      setMetricsLoading(true);

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
          signal: controller.signal,
        });
        if (response.ok) {
          const data = await response.json();
          if (isCurrent && data.sales && data.finance && data.customers) {
            setMetrics(data);
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Failed to fetch metrics:", error);
        }
      } finally {
        if (isCurrent) {
          setMetricsLoading(false);
        }
      }
    }

    if (session) {
      fetchMetrics();
    }

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [session, dateRange, from, to, segment, invoiceStatus, dealStatus]);

  // Format currency helper
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);

  const formatNumber = (value: number) => value.toLocaleString("en-US");

  const rangeLabel =
    dateRange === "last7"
      ? "ultimos 7 dias"
      : dateRange === "last30"
      ? "ultimos 30 dias"
      : dateRange === "last90"
      ? "ultimos 90 dias"
      : dateRange === "thisMonth"
      ? "mes atual"
      : dateRange === "lastMonth"
      ? "mes passado"
      : dateRange === "allTime"
      ? "todo o periodo"
      : "este ano";

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

  if (userRole === "EXECUTIVE") {
    redirect("/dashboard/executive");
  }

  if (userRole === "HEAD_COMERCIAL") {
    redirect("/dashboard/commercial-bi");
  }

  // COMMERCIAL users see simplified dashboard
  if (userRole === "COMMERCIAL") {
    return (
      <div className="bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 py-8">
          <div className="mb-6 flex flex-col gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-verde">Comercial</p>
            <h1 className="text-3xl font-semibold text-gray-900">
              {getGreeting()}, {firstName}
            </h1>
            <p className="text-sm text-gray-500">
              Sua carteira, suas invoices e seus contratos no periodo: {rangeLabel}.
            </p>
          </div>

          <div className="mb-6">
            <QuickFilters isLoading={metricsLoading} />
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Recebido"
              value={formatCurrency(metrics.finance.totalPaid)}
              description="pagamentos da sua carteira"
              icon={<DollarSign className="h-5 w-5 text-success-600" />}
              isLoading={metricsLoading}
            />
            <StatCard
              label="Faturado"
              value={formatCurrency(metrics.finance.totalInvoiced)}
              description={`${metrics.finance.totalInvoices} invoice${metrics.finance.totalInvoices === 1 ? "" : "s"}`}
              icon={<Receipt className="h-5 w-5 text-brand-verde" />}
              isLoading={metricsLoading}
            />
            <StatCard
              label="Em Aberto"
              value={formatCurrency(metrics.finance.pendingAmount)}
              description="criado ainda nao recebido"
              icon={<CreditCard className="h-5 w-5 text-brand-tangerina" />}
              isLoading={metricsLoading}
            />
            <StatCard
              label="Clientes"
              value={formatNumber(metrics.customers.totalCustomers)}
              description={`${metrics.customers.newCustomersThisMonth} novos este mes`}
              icon={<Users className="h-5 w-5 text-info-600" />}
              isLoading={metricsLoading}
            />
          </div>

          <div className="mb-8">
            <DashboardActionCenter role={userRole} actions={metrics.actions} isLoading={metricsLoading} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Fila comercial</h2>
                  <p className="text-sm text-gray-500">Acoes que movem cliente para pagamento e contrato.</p>
                </div>
                <Link href="/dashboard/invoices" className="text-sm font-semibold text-brand-verde hover:underline">
                  Ver invoices
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Link
                  href="/dashboard/customers/new"
                  className="rounded-lg border border-gray-100 bg-gray-50 p-4 transition hover:border-brand-verde hover:bg-white"
                >
                  <Users className="mb-3 h-5 w-5 text-brand-verde" />
                  <p className="text-sm font-semibold text-gray-900">Criar cliente</p>
                  <p className="mt-1 text-xs text-gray-500">Cadastro com dono correto.</p>
                </Link>
                <Link
                  href="/dashboard/invoices/new"
                  className="rounded-lg border border-gray-100 bg-gray-50 p-4 transition hover:border-brand-verde hover:bg-white"
                >
                  <FileText className="mb-3 h-5 w-5 text-brand-verde" />
                  <p className="text-sm font-semibold text-gray-900">Criar invoice</p>
                  <p className="mt-1 text-xs text-gray-500">Fatura enviada via QuickBooks.</p>
                </Link>
                <Link
                  href="/dashboard/contracts/new"
                  className="rounded-lg border border-gray-100 bg-gray-50 p-4 transition hover:border-brand-verde hover:bg-white"
                >
                  <Target className="mb-3 h-5 w-5 text-brand-verde" />
                  <p className="text-sm font-semibold text-gray-900">Criar contrato</p>
                  <p className="mt-1 text-xs text-gray-500">DocuSign com cliente certo.</p>
                </Link>
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Saude da carteira</h2>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <span className="text-sm text-gray-600">Taxa de cobranca</span>
                  <span className="text-sm font-bold text-gray-900">{metricsLoading ? "..." : `${metrics.finance.collectionRate}%`}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-red-50 p-3">
                  <span className="text-sm text-red-700">Vencido</span>
                  <span className="text-sm font-bold text-red-800">{metricsLoading ? "..." : formatCurrency(metrics.finance.overdueAmount)}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <span className="text-sm text-gray-600">Ticket medio recebido</span>
                  <span className="text-sm font-bold text-gray-900">{metricsLoading ? "..." : formatCurrency(metrics.customers.avgCustomerValue)}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  if (userRole === "FINANCE") {
    return (
      <div className="bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 py-8">
          <div className="mb-6 flex flex-col gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-verde">Financeiro</p>
            <h1 className="text-3xl font-semibold text-gray-900">
              {getGreeting()}, {firstName}
            </h1>
            <p className="text-sm text-gray-500">
              Caixa recebido, contas a receber e riscos de cobranca no periodo: {rangeLabel}.
            </p>
          </div>

          <div className="mb-6">
            <QuickFilters isLoading={metricsLoading} />
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Recebido"
              value={formatCurrency(metrics.finance.totalPaid)}
              description="pagamentos registrados"
              icon={<DollarSign className="h-5 w-5 text-success-600" />}
              isLoading={metricsLoading}
            />
            <StatCard
              label="Faturado"
              value={formatCurrency(metrics.finance.totalInvoiced)}
              description="invoices criadas no periodo"
              icon={<Receipt className="h-5 w-5 text-brand-verde" />}
              isLoading={metricsLoading}
            />
            <StatCard
              label="Em Aberto"
              value={formatCurrency(metrics.finance.pendingAmount)}
              description={`${metrics.finance.collectionRate}% de cobranca`}
              icon={<CreditCard className="h-5 w-5 text-brand-tangerina" />}
              isLoading={metricsLoading}
            />
            <StatCard
              label="Vencido"
              value={formatCurrency(metrics.finance.overdueAmount)}
              description={`${metrics.finance.overdueCount} invoices precisam acao`}
              icon={<AlertCircle className="h-5 w-5 text-error-600" />}
              isLoading={metricsLoading}
            />
          </div>

          <div className="mb-8">
            <DashboardActionCenter role={userRole} actions={metrics.actions} isLoading={metricsLoading} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Painel financeiro</h2>
                  <p className="text-sm text-gray-500">Atalhos para rotinas de cobranca e conciliacao.</p>
                </div>
                <Link href="/dashboard/bi" className="text-sm font-semibold text-brand-verde hover:underline">
                  Abrir BI Executivo
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Link href="/dashboard/invoices?status=OVERDUE" className="rounded-lg border border-red-100 bg-red-50 p-4 transition hover:border-red-300">
                  <AlertCircle className="mb-3 h-5 w-5 text-red-600" />
                  <p className="text-sm font-semibold text-red-900">Cobrar vencidas</p>
                  <p className="mt-1 text-xs text-red-700">Fila com maior risco.</p>
                </Link>
                <Link href="/dashboard/invoices/approval-queue" className="rounded-lg border border-gray-100 bg-gray-50 p-4 transition hover:border-brand-verde hover:bg-white">
                  <FileText className="mb-3 h-5 w-5 text-brand-verde" />
                  <p className="text-sm font-semibold text-gray-900">Aprovacoes</p>
                  <p className="mt-1 text-xs text-gray-500">Revisar invoices pendentes.</p>
                </Link>
                <Link href="/dashboard/payments" className="rounded-lg border border-gray-100 bg-gray-50 p-4 transition hover:border-brand-verde hover:bg-white">
                  <CreditCard className="mb-3 h-5 w-5 text-brand-verde" />
                  <p className="text-sm font-semibold text-gray-900">Pagamentos</p>
                  <p className="mt-1 text-xs text-gray-500">Conferir recebimentos.</p>
                </Link>
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Leitura rapida</h2>
              <div className="mt-4 space-y-3">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Efetividade</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{metricsLoading ? "..." : `${metrics.finance.collectionRate}%`}</p>
                </div>
                <div className="rounded-lg bg-red-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-500">Risco atual</p>
                  <p className="mt-1 text-sm font-semibold text-red-800">
                    {metricsLoading ? "Atualizando risco..." : `${metrics.finance.overdueCount} invoices vencidas somam ${formatCurrency(metrics.finance.overdueAmount)}`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Admin/Finance users see full dashboard
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
          <QuickFilters isLoading={metricsLoading} />
        </div>

        <div className="mb-8">
          <DashboardActionCenter role={userRole || "ADMIN"} actions={metrics.actions} isLoading={metricsLoading} />
        </div>

        {/* ========== FINANCE SECTION ========== */}
        <div className="mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2 mb-6">
            <DollarSign className="h-6 w-6 text-brand-verde" />
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
              isLoading={metricsLoading}
            />
            <StatCard
              label="Total de Faturas"
              value={formatNumber(metrics.finance.totalInvoices)}
              description={`${metrics.finance.totalInvoices - metrics.finance.overdueCount} pagas`}
              icon={<FileText className="h-5 w-5 text-brand-verde" />}
              isLoading={metricsLoading}
            />
            <StatCard
              label="Clientes Ativos"
              value={formatNumber(metrics.customers.totalCustomers)}
              change={`+${metrics.customers.newCustomersThisMonth}`}
              trend="up"
              description="novos este mês"
              icon={<Users className="h-5 w-5 text-info-600" />}
              isLoading={metricsLoading}
            />
            <StatCard
              label="Faturas Vencidas"
              value={formatCurrency(metrics.finance.overdueAmount)}
              description={`${metrics.finance.overdueCount} faturas precisam de atenção`}
              icon={<AlertCircle className="h-5 w-5 text-error-600" />}
              isLoading={metricsLoading}
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
              className="group block bg-white rounded-lg border border-gray-200 p-6 hover:border-brand-caramelo hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-brand-creme rounded-lg flex items-center justify-center">
                  <FileText className="h-5 w-5 text-brand-verde" />
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
              className="group block bg-white rounded-lg border border-gray-200 p-6 hover:border-brand-caramelo hover:shadow-md transition-all duration-200"
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
              href="/dashboard/bi"
              className="group block bg-white rounded-lg border border-gray-200 p-6 hover:border-brand-caramelo hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-brand-creme rounded-lg flex items-center justify-center">
                  <BarChart className="h-5 w-5 text-brand-verde" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-1">
                    Abrir BI Executivo
                  </h3>
                  <p className="text-base text-gray-500">
                    BI unificado com QuickBooks, Clint e visão operacional
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
