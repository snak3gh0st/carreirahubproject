"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { QuickBooksKpiCard } from "@/components/analytics/quickbooks-kpi-card";
import { RevenueTrendChart } from "@/components/analytics/revenue-trend-chart";
import { InvoiceStatusChart } from "@/components/analytics/invoice-status-chart";
import { InvoiceAgingChart } from "@/components/analytics/invoice-aging-chart";
import { TopCustomersChart } from "@/components/analytics/top-customers-chart";
import { PaymentMethodsChart } from "@/components/analytics/payment-methods-chart";
import { CashFlowChart } from "@/components/analytics/cash-flow-chart";
import { CustomerSegmentsChart } from "@/components/analytics/customer-segments-chart";
import { CustomerAcquisitionChart } from "@/components/analytics/customer-acquisition-chart";
import { CashFlowProjectionChart } from "@/components/analytics/cash-flow-projection-chart";
import { CollectionProbabilityGauge } from "@/components/analytics/collection-probability-gauge";
import { AtRiskInvoicesTable } from "@/components/analytics/at-risk-invoices-table";
import { ReceivablesForecastChart } from "@/components/analytics/receivables-forecast-chart";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  CreditCard,
  AlertCircle,
  BarChart3,
  PieChart,
  Wallet,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Activity,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Info,
} from "lucide-react";

interface QuickBooksAnalytics {
  kpis: {
    totalRevenue: number;
    mrr: number;
    arr: number;
    collectionRate: number;
    overdueAmount: number;
    overdueRate: number;
    avgInvoiceValue: number;
    invoicedAmount: number;
    totalInvoices: number;
    avgDaysToPayment: number;
    overdueInvoices: number;
    activeCustomers: number;
    newCustomers: number;
    avgLtv: number;
    totalCustomers: number;
    totalPayments: number;
    avgPaymentAmount: number;
    refundsCount: number;
    refundsAmount: number;
  };
  charts: {
    revenueTrend: Array<{ month: string; revenue: number; invoices: number }>;
    invoiceStatus: Array<{ status: string; count: number; amount: number }>;
    invoiceAging: Array<{ bucket: string; count: number; amount: number }>;
    topCustomers: Array<{ name: string; revenue: number }>;
    paymentMethods: Array<{ method: string; count: number; amount: number }>;
    customerSegments: Array<{ segment: string; count: number; revenue: number }>;
    geographicDist: Array<{ state: string; customers: number; revenue: number }>;
    cashFlow: Array<{ month: string; received: number; invoiced: number }>;
    customerAcquisition: Array<{ month: string; new: number; active: number }>;
  };
}

interface ReceivablesForecast {
  summary: {
    totalOutstanding: number;
    weightedOutstanding: number;
    expectedBadDebt: number;
    avgCollectionProbability: number;
    atRiskAmount: number;
    atRiskCount: number;
    totalOpenInvoices: number;
    staleInvoiceCount: number;
    staleAmount: number;
    activeInvoiceCount: number;
    activeAmount: number;
  };
  dataQuality: {
    usingPaymentTable: boolean;
    totalCustomersWithHistory: number;
    averageDaysToPayment: number;
  };
  cashFlowProjections: Array<{
    period: string;
    periodLabel: string;
    expectedAmount: number;
    pessimisticAmount: number;
    optimisticAmount: number;
    invoiceCount: number;
    avgCollectionProbability: number;
  }>;
  atRiskInvoices: Array<{
    invoiceId: string;
    invoiceNumber: string | null;
    customerId: string;
    customerName: string;
    amount: number;
    dueDate: Date;
    daysOverdue: number;
    status: string;
    predictedPaymentDate: Date;
    collectionProbability: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    reasonForRisk: string[];
    isStale: boolean;
  }>;
  staleInvoices: Array<{
    invoiceId: string;
    invoiceNumber: string | null;
    customerId: string;
    customerName: string;
    amount: number;
    dueDate: Date;
    daysOverdue: number;
    status: string;
    predictedPaymentDate: Date;
    collectionProbability: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    reasonForRisk: string[];
    isStale: boolean;
  }>;
  allForecasts: Array<{
    invoiceId: string;
    amount: number;
    predictedPaymentDate: Date;
    collectionProbability: number;
  }>;
}

// Format currency
const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

// Format percentage
const formatPercentage = (value: number): string => `${value.toFixed(1)}%`;

// Format integer with commas
const formatInteger = (value: number): string => value.toLocaleString();

export default function InsightsPage() {
  const searchParams = useSearchParams();

  // Get filter params from URL
  const dateRange = searchParams.get("dateRange") || "allTime";
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;

  // Fetch QuickBooks analytics data
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<QuickBooksAnalytics>({
    queryKey: ["quickbooks-analytics", dateRange, from, to],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange) params.set("dateRange", dateRange);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const url = `/api/analytics/quickbooks?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch QuickBooks analytics");
      }
      return response.json();
    },
  });

  // Fetch Receivables Forecast data (respects date range filter)
  const {
    data: forecastData,
    isLoading: forecastLoading,
    isError: forecastError,
    refetch: refetchForecast,
  } = useQuery<ReceivablesForecast>({
    queryKey: ["receivables-forecast", dateRange, from, to],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange) params.set("dateRange", dateRange);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const url = `/api/analytics/receivables-forecast?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch receivables forecast");
      }
      return response.json();
    },
  });

  // Calculate trends (mock for now - would need historical data)
  const revenueTrend = data ? { value: 12.5, isPositive: true } : undefined;
  const collectionTrend = data ? { value: 3.2, isPositive: true } : undefined;

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                QuickBooks Analytics
              </h1>
              <p className="text-gray-600 mt-1">
                Comprehensive financial insights and metrics from QuickBooks
              </p>
            </div>
            <DateRangeFilter onFilterChange={() => refetch()} />
          </div>
        </div>

        {/* Error State */}
        {isError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-red-500 w-5 h-5" />
              <div className="flex-1">
                <h3 className="text-red-800 font-medium">Error Loading Analytics</h3>
                <p className="text-red-600 text-sm">
                  {error?.message || "Failed to load QuickBooks analytics data"}
                </p>
              </div>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* ====================================== */}
        {/* RECEIVABLES FORECAST SECTION */}
        {/* ====================================== */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Target className="w-6 h-6 text-purple-600" />
                Previsão de Recebíveis
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Previsão inteligente de cobranças futuras baseada em padrões de pagamento dos clientes
              </p>
            </div>
            {forecastError && (
              <button
                onClick={() => refetchForecast()}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-sm"
              >
                Tentar Novamente
              </button>
            )}
          </div>

          {/* Forecast Summary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <QuickBooksKpiCard
              title="Total a Receber"
              value={forecastData ? formatCurrency(forecastData.summary.totalOutstanding) : "$0"}
              subtitle="Faturas abertas"
              icon={<Activity className="w-5 h-5 text-purple-600" />}
              isLoading={forecastLoading}
            />
            <QuickBooksKpiCard
              title="Recebimento Esperado"
              value={forecastData ? formatCurrency(forecastData.summary.weightedOutstanding) : "$0"}
              subtitle="Ajustado por risco"
              icon={<Target className="w-5 h-5 text-green-600" />}
              valueColor="text-green-600"
              isLoading={forecastLoading}
            />
            <QuickBooksKpiCard
              title="Inadimplência Esperada"
              value={forecastData ? formatCurrency(forecastData.summary.expectedBadDebt) : "$0"}
              subtitle="Valor não cobrável"
              icon={<AlertCircle className="w-5 h-5 text-red-600" />}
              valueColor="text-red-600"
              isLoading={forecastLoading}
            />
            <QuickBooksKpiCard
              title="Faturas em Risco"
              value={forecastData ? `${forecastData.summary.atRiskCount}` : "0"}
              subtitle={forecastData ? formatCurrency(forecastData.summary.atRiskAmount) : "$0"}
              icon={<AlertTriangle className="w-5 h-5 text-orange-600" />}
              valueColor="text-orange-600"
              isLoading={forecastLoading}
            />
            <div className="bg-white rounded-lg border border-gray-200 p-6 flex items-center justify-center">
              <CollectionProbabilityGauge
                probability={forecastData?.summary.avgCollectionProbability || 0}
                label="Prob. Média de Cobrança"
                size="md"
                isLoading={forecastLoading}
              />
            </div>
          </div>

          {/* Data Quality & Stale Invoices Alert */}
          {forecastData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {/* Data Quality Indicator */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-blue-900 mb-2">
                      Qualidade dos Dados
                    </h4>
                    <div className="space-y-1 text-xs text-blue-800">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        <span>
                          Usando {forecastData.dataQuality.usingPaymentTable ? "tabela de Pagamentos" : "datas de Faturas"}
                          {" "}para análise
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        <span>
                          {forecastData.dataQuality.totalCustomersWithHistory} clientes com histórico de pagamento
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        <span>
                          Média de {forecastData.dataQuality.averageDaysToPayment} dias para pagamento
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stale Invoices Alert */}
              {forecastData.summary.staleInvoiceCount > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-orange-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-orange-900 mb-2">
                        Faturas Antigas (180+ Dias em Atraso)
                      </h4>
                      <div className="text-xs text-orange-800 mb-3">
                        {forecastData.summary.staleInvoiceCount} fatura{forecastData.summary.staleInvoiceCount !== 1 ? "s" : ""}
                        {" "}totalizando {formatCurrency(forecastData.summary.staleAmount)} são provável inadimplência
                      </div>
                      <div className="text-xs text-orange-700">
                        Estas foram excluídas da previsão de cash flow e devem ser revisadas para write-off
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cash Flow Projection Chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Projeção de Fluxo de Caixa (Próximos 90 Dias)
            </h3>
            <CashFlowProjectionChart
              data={forecastData?.cashFlowProjections || []}
              isLoading={forecastLoading}
            />
          </div>

          {/* Receivables Forecast Timeline */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Linha do Tempo de Recebimentos Esperados
            </h3>
            <ReceivablesForecastChart
              forecasts={forecastData?.allForecasts || []}
              isLoading={forecastLoading}
            />
          </div>

          {/* At-Risk Invoices Table */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Faturas em Risco (Alta Prioridade)
            </h3>
            <AtRiskInvoicesTable
              data={forecastData?.atRiskInvoices || []}
              isLoading={forecastLoading}
            />
          </div>

          {/* Stale Invoices Table (180+ days overdue) */}
          {forecastData && forecastData.staleInvoices && forecastData.staleInvoices.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-orange-600" />
                <h3 className="text-lg font-semibold text-orange-900">
                  Faturas Antigas (Provável Inadimplência)
                </h3>
              </div>
              <div className="bg-white rounded-lg">
                <AtRiskInvoicesTable
                  data={forecastData.staleInvoices}
                  isLoading={forecastLoading}
                />
              </div>
            </div>
          )}
        </div>

        {/* Financial KPIs - Row 1 */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            Financial Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <QuickBooksKpiCard
              title="Total Revenue"
              value={data ? formatCurrency(data.kpis.totalRevenue) : "$0"}
              subtitle="Payments received"
              trend={revenueTrend}
              icon={<DollarSign className="w-5 h-5 text-green-600" />}
              isLoading={isLoading}
            />
            <QuickBooksKpiCard
              title="MRR"
              value={data ? formatCurrency(data.kpis.mrr) : "$0"}
              subtitle="Monthly Recurring Revenue"
              icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
              isLoading={isLoading}
            />
            <QuickBooksKpiCard
              title="ARR"
              value={data ? formatCurrency(data.kpis.arr) : "$0"}
              subtitle="Annual Recurring Revenue"
              icon={<Wallet className="w-5 h-5 text-indigo-600" />}
              isLoading={isLoading}
            />
            <QuickBooksKpiCard
              title="Collection Rate"
              value={data ? formatPercentage(data.kpis.collectionRate) : "0%"}
              subtitle={data ? `${formatPercentage(data.kpis.overdueRate)} overdue` : "0% overdue"}
              trend={collectionTrend}
              icon={<Percent className="w-5 h-5 text-green-600" />}
              valueColor={data && data.kpis.collectionRate >= 80 ? "text-green-600" : data && data.kpis.collectionRate >= 60 ? "text-yellow-600" : "text-red-600"}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Financial KPIs - Row 2 */}
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <QuickBooksKpiCard
              title="Overdue Amount"
              value={data ? formatCurrency(data.kpis.overdueAmount) : "$0"}
              subtitle={`${data?.kpis.overdueInvoices || 0} overdue invoices`}
              icon={<AlertCircle className="w-5 h-5 text-red-600" />}
              valueColor="text-red-600"
              isLoading={isLoading}
            />
            <QuickBooksKpiCard
              title="Avg Invoice Value"
              value={data ? formatCurrency(data.kpis.avgInvoiceValue) : "$0"}
              subtitle="Average per invoice"
              icon={<FileText className="w-5 h-5 text-blue-600" />}
              isLoading={isLoading}
            />
            <QuickBooksKpiCard
              title="Avg Days to Pay"
              value={data ? `${data.kpis.avgDaysToPayment} days` : "0 days"}
              subtitle="Payment cycle time"
              icon={<TrendingDown className="w-5 h-5 text-orange-600" />}
              isLoading={isLoading}
            />
            <QuickBooksKpiCard
              title="Invoiced Amount"
              value={data ? formatCurrency(data.kpis.invoicedAmount) : "$0"}
              subtitle={`${formatInteger(data?.kpis.totalInvoices || 0)} invoices`}
              icon={<BarChart3 className="w-5 h-5 text-purple-600" />}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Customer KPIs */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Customer Analytics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <QuickBooksKpiCard
              title="Active Customers"
              value={data ? formatInteger(data.kpis.activeCustomers) : "0"}
              subtitle="With activity in period"
              icon={<Users className="w-5 h-5 text-green-600" />}
              isLoading={isLoading}
            />
            <QuickBooksKpiCard
              title="New Customers"
              value={data ? formatInteger(data.kpis.newCustomers) : "0"}
              subtitle="Acquired this period"
              icon={<ArrowUpRight className="w-5 h-5 text-blue-600" />}
              isLoading={isLoading}
            />
            <QuickBooksKpiCard
              title="Avg LTV"
              value={data ? formatCurrency(data.kpis.avgLtv) : "$0"}
              subtitle="Lifetime Value"
              icon={<TrendingUp className="w-5 h-5 text-indigo-600" />}
              isLoading={isLoading}
            />
            <QuickBooksKpiCard
              title="Total Customers"
              value={data ? formatInteger(data.kpis.totalCustomers) : "0"}
              subtitle="All-time customers"
              icon={<Users className="w-5 h-5 text-gray-600" />}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Payment KPIs */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Payment Analytics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <QuickBooksKpiCard
              title="Total Payments"
              value={data ? formatInteger(data.kpis.totalPayments) : "0"}
              subtitle={data ? formatCurrency(data.kpis.totalRevenue) : "$0"}
              icon={<CreditCard className="w-5 h-5 text-green-600" />}
              isLoading={isLoading}
            />
            <QuickBooksKpiCard
              title="Avg Payment"
              value={data ? formatCurrency(data.kpis.avgPaymentAmount) : "$0"}
              subtitle="Per transaction"
              icon={<DollarSign className="w-5 h-5 text-blue-600" />}
              isLoading={isLoading}
            />
            <QuickBooksKpiCard
              title="Refunds"
              value={data ? formatInteger(data.kpis.refundsCount) : "0"}
              subtitle={data ? formatCurrency(data.kpis.refundsAmount) : "$0"}
              icon={<ArrowDownRight className="w-5 h-5 text-red-600" />}
              valueColor="text-red-600"
              isLoading={isLoading}
            />
            <QuickBooksKpiCard
              title="Payment Methods"
              value={data ? data.charts.paymentMethods.length.toString() : "0"}
              subtitle="Active methods"
              icon={<PieChart className="w-5 h-5 text-purple-600" />}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Charts Section */}
        <div className="space-y-6">
          {/* Revenue Trend - Full Width Hero */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend (12 Months)</h3>
            <RevenueTrendChart
              data={data?.charts.revenueTrend || []}
              isLoading={isLoading}
            />
          </div>

          {/* Cash Flow - Full Width Hero */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cash Flow: Invoiced vs Received</h3>
            <CashFlowChart
              data={data?.charts.cashFlow || []}
              isLoading={isLoading}
            />
          </div>

          {/* Top Customers - Full Width (needs more vertical space) */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Customers by Revenue</h3>
            <TopCustomersChart
              data={data?.charts.topCustomers || []}
              isLoading={isLoading}
            />
          </div>

          {/* Invoice Status + Aging - Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Status Distribution</h3>
              <InvoiceStatusChart
                data={data?.charts.invoiceStatus || []}
                isLoading={isLoading}
              />
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Aging</h3>
              <InvoiceAgingChart
                data={data?.charts.invoiceAging || []}
                isLoading={isLoading}
              />
            </div>
          </div>

          {/* Payment Methods + Customer Segments - Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Payments by Method</h3>
              <PaymentMethodsChart
                data={data?.charts.paymentMethods || []}
                isLoading={isLoading}
              />
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Segments by Revenue</h3>
              <CustomerSegmentsChart
                data={data?.charts.customerSegments || []}
                isLoading={isLoading}
              />
            </div>
          </div>

          {/* Customer Acquisition - Full Width at Bottom */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Acquisition Trend</h3>
            <CustomerAcquisitionChart
              data={data?.charts.customerAcquisition || []}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
