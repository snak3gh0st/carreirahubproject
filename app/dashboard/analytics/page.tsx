"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { DollarSign, Users, FileText, TrendingUp, AlertCircle } from "lucide-react";

interface ComprehensiveDashboardData {
  database: any;
  quickbooks: any;
  syncStatus: {
    invoicesSynced: number;
    invoicesInQB: number;
    customersSynced: number;
    customersInQB: number;
    syncPercentageInvoices: number;
    syncPercentageCustomers: number;
  };
  combined: {
    totalReceivables: number;
    daysOutstanding: number;
    receivablesAging: any;
    topQBCustomersByAR: any[];
    qbCompanyInfo: any;
  };
  dataQuality: {
    dbRevenueVsQB: any;
  };
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
};

const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

const COLORS = ["#3b82f6", "#ef4444", "#f97316", "#eab308", "#10b981", "#8b5cf6"];

export default function AnalyticsPage() {
  const { data, isLoading, isError, error } = useQuery<ComprehensiveDashboardData>({
    queryKey: ["comprehensive-dashboard"],
    queryFn: async () => {
      const response = await fetch("/api/analytics/comprehensive-dashboard");
      if (!response.ok) {
        throw new Error("Failed to fetch analytics");
      }
      return response.json();
    },
  });

  return (
    <div className="bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">
            Análises Completas
          </h1>
          <p className="text-gray-600">
            Integração de Dados do Banco + QuickBooks
          </p>
        </div>

        {/* Error State */}
        {isError && (
          <div className="mb-6 bg-red-50">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-red-500" />
              <div>
                <h3 className="text-red-800">Erro ao Carregar Análises</h3>
                <p className="text-red-600">{error?.message}</p>
              </div>
            </div>
          </div>
        )}

        {/* QuickBooks Receivables Section */}
        {data?.combined && (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900">
                <DollarSign className="h-6 w-6 text-blue-600" />
                Contas a Receber QuickBooks
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  title="Total a Receber"
                  value={formatCurrency(data.combined.totalReceivables)}
                  subtitle="Saldo pendente"
                  icon={<div className="text-blue-500"><DollarSign className="w-5 h-5" /></div>}
                  isLoading={isLoading}
                />
                <KpiCard
                  title="Dias em Atraso (DSO)"
                  value={`${data.combined.daysOutstanding} dias`}
                  subtitle="Período médio de recebimento"
                  icon={<div className="text-orange-500"><TrendingUp className="w-5 h-5" /></div>}
                  isLoading={isLoading}
                />
                <KpiCard
                  title="Clientes QB"
                  value={data.quickbooks?.summary?.totalCustomers || "0"}
                  subtitle={data.syncStatus?.syncPercentageCustomers + "% sincronizado"}
                  icon={<div className="text-purple-500"><Users className="w-5 h-5" /></div>}
                  isLoading={isLoading}
                />
                <KpiCard
                  title="Faturas QB"
                  value={data.quickbooks?.summary?.totalInvoices || "0"}
                  subtitle={data.syncStatus?.syncPercentageInvoices + "% sincronizado"}
                  icon={<div className="text-green-500"><FileText className="w-5 h-5" /></div>}
                  isLoading={isLoading}
                />
              </div>
            </div>

            {/* Aging Analysis */}
            {data.combined.receivablesAging && (
              <div className="mb-8 bg-white">
                <h3 className="text-lg font-semibold text-gray-900">
                  Análise de Vencimento de Recebíveis
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                  <div className="bg-green-50">
                    <p className="text-sm text-gray-600">Em dia</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(data.combined.receivablesAging.current)}
                    </p>
                  </div>
                  <div className="bg-blue-50">
                    <p className="text-sm text-gray-600">1-30 Dias</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(data.combined.receivablesAging.days1to30)}
                    </p>
                  </div>
                  <div className="bg-yellow-50">
                    <p className="text-sm text-gray-600">31-60 Dias</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {formatCurrency(data.combined.receivablesAging.days31to60)}
                    </p>
                  </div>
                  <div className="bg-orange-50">
                    <p className="text-sm text-gray-600">61-90 Dias</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {formatCurrency(data.combined.receivablesAging.days61to90)}
                    </p>
                  </div>
                  <div className="bg-red-50">
                    <p className="text-sm text-gray-600">90+ Dias</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(data.combined.receivablesAging.days90plus)}
                    </p>
                  </div>
                </div>

                {/* Aging Chart */}
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[
                      { name: "Em dia", value: data.combined.receivablesAging.current },
                      { name: "1-30 Dias", value: data.combined.receivablesAging.days1to30 },
                      { name: "31-60 Dias", value: data.combined.receivablesAging.days31to60 },
                      { name: "61-90 Dias", value: data.combined.receivablesAging.days61to90 },
                      { name: "90+ Dias", value: data.combined.receivablesAging.days90plus },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Top QB Customers by Receivables */}
            {data.combined.topQBCustomersByAR && data.combined.topQBCustomersByAR.length > 0 && (
              <div className="mb-8 bg-white">
                <h3 className="text-lg font-semibold text-gray-900">
                  Principais Clientes QB por Recebíveis
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-gray-900">Cliente</th>
                        <th className="text-right py-3 px-4 text-gray-900">Recebíveis</th>
                        <th className="text-right py-3 px-4 text-gray-900">Total Pago</th>
                        <th className="text-right py-3 px-4 text-gray-900">Faturas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.combined.topQBCustomersByAR.map((customer: any, idx: number) => (
                        <tr key={idx} className="border-b border-gray-200">
                          <td className="py-3 px-4 text-gray-900">{customer.name}</td>
                          <td className="text-right py-3 px-4 text-red-600">
                            {formatCurrency(customer.totalReceivables)}
                          </td>
                          <td className="text-right py-3 px-4 text-green-600">
                            {formatCurrency(customer.totalPaid)}
                          </td>
                          <td className="text-right py-3 px-4 text-gray-600">
                            {customer.totalInvoices}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Sync Status */}
        {data?.syncStatus && (
          <div className="mb-8 bg-white">
            <h3 className="text-lg font-semibold text-gray-900">
              Status de Sincronização
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">Faturas Sincronizadas</span>
                  <span className="font-semibold text-gray-900">
                    {data.syncStatus.invoicesSynced} / {data.syncStatus.invoicesInQB}
                  </span>
                </div>
                <div className="w-full bg-gray-200">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all"
                    style={{ width: `${data.syncStatus.syncPercentageInvoices}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600">
                  {data.syncStatus.syncPercentageInvoices}% sincronizado
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">Clientes Sincronizados</span>
                  <span className="font-semibold text-gray-900">
                    {data.syncStatus.customersSynced} / {data.syncStatus.customersInQB}
                  </span>
                </div>
                <div className="w-full bg-gray-200">
                  <div
                    className="bg-green-600 h-3 rounded-full transition-all"
                    style={{ width: `${data.syncStatus.syncPercentageCustomers}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600">
                  {data.syncStatus.syncPercentageCustomers}% sincronizado
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Company Info */}
        {data?.combined?.qbCompanyInfo && (
          <div className="bg-white">
            <h3 className="text-lg font-semibold text-gray-900">
              Informações da Empresa QuickBooks
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-600">Nome da Empresa</p>
                <p className="text-lg font-semibold text-gray-900">
                  {data.combined.qbCompanyInfo.name}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="text-lg font-semibold text-gray-900">
                  {data.combined.qbCompanyInfo.email || "N/A"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
