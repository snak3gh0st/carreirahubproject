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
    <div className="bg-gray-50 dark:bg-slate-900 min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Comprehensive Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Database + QuickBooks Data Integration
          </p>
        </div>

        {/* Error State */}
        {isError && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-red-500" />
              <div>
                <h3 className="text-red-800 dark:text-red-200 font-semibold">Error Loading Analytics</h3>
                <p className="text-red-600 dark:text-red-300 text-sm">{error?.message}</p>
              </div>
            </div>
          </div>
        )}

        {/* QuickBooks Receivables Section */}
        {data?.combined && (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <DollarSign className="h-6 w-6 text-blue-600" />
                QuickBooks Receivables
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  title="Total Receivables"
                  value={formatCurrency(data.combined.totalReceivables)}
                  subtitle="Outstanding balance"
                  icon={<div className="text-blue-500"><DollarSign className="w-5 h-5" /></div>}
                  isLoading={isLoading}
                />
                <KpiCard
                  title="Days Outstanding (DSO)"
                  value={`${data.combined.daysOutstanding} days`}
                  subtitle="Average collection period"
                  icon={<div className="text-orange-500"><TrendingUp className="w-5 h-5" /></div>}
                  isLoading={isLoading}
                />
                <KpiCard
                  title="QB Customers"
                  value={data.quickbooks?.summary?.totalCustomers || "0"}
                  subtitle={data.syncStatus?.syncPercentageCustomers + "% synced"}
                  icon={<div className="text-purple-500"><Users className="w-5 h-5" /></div>}
                  isLoading={isLoading}
                />
                <KpiCard
                  title="QB Invoices"
                  value={data.quickbooks?.summary?.totalInvoices || "0"}
                  subtitle={data.syncStatus?.syncPercentageInvoices + "% synced"}
                  icon={<div className="text-green-500"><FileText className="w-5 h-5" /></div>}
                  isLoading={isLoading}
                />
              </div>
            </div>

            {/* Aging Analysis */}
            {data.combined.receivablesAging && (
              <div className="mb-8 bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Receivables Aging Analysis
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Current</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(data.combined.receivablesAging.current)}
                    </p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400">1-30 Days</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(data.combined.receivablesAging.days1to30)}
                    </p>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400">31-60 Days</p>
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                      {formatCurrency(data.combined.receivablesAging.days31to60)}
                    </p>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400">61-90 Days</p>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {formatCurrency(data.combined.receivablesAging.days61to90)}
                    </p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400">90+ Days</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {formatCurrency(data.combined.receivablesAging.days90plus)}
                    </p>
                  </div>
                </div>

                {/* Aging Chart */}
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[
                      { name: "Current", value: data.combined.receivablesAging.current },
                      { name: "1-30 Days", value: data.combined.receivablesAging.days1to30 },
                      { name: "31-60 Days", value: data.combined.receivablesAging.days31to60 },
                      { name: "61-90 Days", value: data.combined.receivablesAging.days61to90 },
                      { name: "90+ Days", value: data.combined.receivablesAging.days90plus },
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
              <div className="mb-8 bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Top QB Customers by Receivables
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-3 px-4 text-gray-900 dark:text-white font-semibold">Customer</th>
                        <th className="text-right py-3 px-4 text-gray-900 dark:text-white font-semibold">Receivables</th>
                        <th className="text-right py-3 px-4 text-gray-900 dark:text-white font-semibold">Total Paid</th>
                        <th className="text-right py-3 px-4 text-gray-900 dark:text-white font-semibold">Invoices</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.combined.topQBCustomersByAR.map((customer: any, idx: number) => (
                        <tr key={idx} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="py-3 px-4 text-gray-900 dark:text-white">{customer.name}</td>
                          <td className="text-right py-3 px-4 text-red-600 dark:text-red-400 font-semibold">
                            {formatCurrency(customer.totalReceivables)}
                          </td>
                          <td className="text-right py-3 px-4 text-green-600 dark:text-green-400">
                            {formatCurrency(customer.totalPaid)}
                          </td>
                          <td className="text-right py-3 px-4 text-gray-600 dark:text-gray-400">
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
          <div className="mb-8 bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Data Sync Status
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 dark:text-gray-400">Invoices Synced</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {data.syncStatus.invoicesSynced} / {data.syncStatus.invoicesInQB}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all"
                    style={{ width: `${data.syncStatus.syncPercentageInvoices}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  {data.syncStatus.syncPercentageInvoices}% synced
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 dark:text-gray-400">Customers Synced</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {data.syncStatus.customersSynced} / {data.syncStatus.customersInQB}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-green-600 h-3 rounded-full transition-all"
                    style={{ width: `${data.syncStatus.syncPercentageCustomers}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  {data.syncStatus.syncPercentageCustomers}% synced
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Company Info */}
        {data?.combined?.qbCompanyInfo && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              QuickBooks Company Info
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Company Name</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {data.combined.qbCompanyInfo.name}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
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
