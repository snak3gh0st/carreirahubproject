import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LeadStatus, DealStatus, InvoiceStatus } from "@prisma/client";
import { AnalyticsSection } from "@/components/dashboard/analytics-section";

/**
 * Dashboard Principal
 *
 * Exibe métricas gerais e visão geral do sistema
 */
export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  // Buscar métricas básicas
  const [
    totalLeads,
    qualifiedLeads,
    totalDeals,
    wonDeals,
    totalInvoices,
    overdueInvoices,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { status: LeadStatus.QUALIFIED } }),
    prisma.deal.count(),
    prisma.deal.count({ where: { status: DealStatus.WON } }),
    prisma.invoice.count(),
    prisma.invoice.count({
      where: {
        status: InvoiceStatus.OVERDUE,
      },
    }),
  ]);

  const conversionRate =
    totalLeads > 0 ? ((wonDeals / totalLeads) * 100).toFixed(1) : "0.0";

  return (
    <div className="container mx-auto px-6 py-8">
        {/* Métricas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Leads */}
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Leads</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {totalLeads}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-blue-600"
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
            </div>
          </div>

          {/* Leads Qualificados */}
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Leads Qualificados
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {qualifiedLeads}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Total Deals */}
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Deals</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {totalDeals}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-purple-600"
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
            </div>
          </div>

          {/* Deals Ganhos */}
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-indigo-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Deals Ganhos
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {wonDeals}
                </p>
              </div>
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-indigo-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Métricas Secundárias */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Taxa de Conversão */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Taxa de Conversão
            </h3>
            <div className="flex items-end">
              <p className="text-4xl font-bold text-gray-900">{conversionRate}%</p>
              <p className="text-sm text-gray-600 ml-2 mb-1">
                de leads convertidos
              </p>
            </div>
            <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${conversionRate}%` }}
              ></div>
            </div>
          </div>

          {/* Invoices */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Invoices
            </h3>
            <div className="flex items-end">
              <p className="text-4xl font-bold text-gray-900">{totalInvoices}</p>
              <p className="text-sm text-gray-600 ml-2 mb-1">total</p>
            </div>
            {overdueInvoices > 0 && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm font-medium text-red-800">
                  ⚠️ {overdueInvoices} invoice(s) vencida(s)
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Analytics */}
        <div className="mb-8">
          <AnalyticsSection />
        </div>

        {/* Ações Rápidas */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Ações Rápidas</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link
              href="/dashboard/leads"
              className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-center"
            >
              <p className="font-medium text-gray-900">Ver Leads</p>
              <p className="text-sm text-gray-600 mt-1">Gerenciar pipeline</p>
            </Link>
            <Link
              href="/dashboard/deals"
              className="p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition text-center"
            >
              <p className="font-medium text-gray-900">Ver Deals</p>
              <p className="text-sm text-gray-600 mt-1">Gerenciar vendas</p>
            </Link>
            <Link
              href="/dashboard/invoices/new"
              className="p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition text-center"
            >
              <p className="font-medium text-gray-900">Gerar Invoice</p>
              <p className="text-sm text-gray-600 mt-1">Criar fatura no QuickBooks</p>
            </Link>
            <Link
              href="/dashboard/customers"
              className="p-4 border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition text-center"
            >
              <p className="font-medium text-gray-900">Ver / Add Customer</p>
              <p className="text-sm text-gray-600 mt-1">Gerenciar clientes</p>
            </Link>
          </div>
        </div>
      </div>
  );
}
