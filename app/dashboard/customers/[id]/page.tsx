import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { InvoiceStatus } from "@prisma/client";
import Link from "next/link";
import { format } from "date-fns";
import { DeleteInvoiceButtonCustomer } from "@/components/customers/delete-invoice-button-customer";
import { DeleteCustomerButton } from "@/components/customers/delete-customer-button";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Phone, FileText, DollarSign, AlertCircle, BookOpen } from "lucide-react";

type BadgeVariant = "success" | "warning" | "error" | "info" | "default";

function getInvoiceStatusVariant(status: InvoiceStatus, isOverdue: boolean): BadgeVariant {
  if (isOverdue && status !== InvoiceStatus.PAID) return "error";
  switch (status) {
    case "PAID": return "success";
    case "SENT": return "info";
    case "OVERDUE": return "error";
    case "PARTIALLY_PAID": return "warning";
    default: return "default";
  }
}

/**
 * Customer Detail Page
 *
 * Displays comprehensive financial summary and installment tracking for a single customer
 */
export default async function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  // Get user role for delete button visibility
  const userRole = (session.user as any).role;

  // Fetch customer with all invoices
  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      invoices: {
        orderBy: { createdAt: "desc" },
      },
      deals: {
        take: 5,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!customer) {
    notFound();
  }

  // Fetch latest completed placement test result (exclude pending tests)
  const latestTest = await prisma.placementTest.findFirst({
    where: { customerId: params.id, totalScore: { not: -1 } },
    orderBy: { createdAt: "desc" },
  });

  // Calculate financial statistics from invoices
  const today = new Date();
  const invoices = customer.invoices;

  const totalInvoices = invoices.length;
  const totalInvoiced = invoices.reduce(
    (sum, inv) => sum + Number(inv.amount),
    0
  );

  const paidInvoices = invoices.filter((inv) => inv.status === InvoiceStatus.PAID);
  const paidCount = paidInvoices.length;
  const paidAmount = paidInvoices.reduce(
    (sum, inv) => sum + Number(inv.amount),
    0
  );

  const pendingInvoices = invoices.filter(
    (inv) =>
      inv.status === InvoiceStatus.SENT || inv.status === InvoiceStatus.DRAFT
  );
  const pendingCount = pendingInvoices.length;
  const pendingAmount = pendingInvoices.reduce(
    (sum, inv) => sum + Number(inv.amount),
    0
  );

  const overdueInvoices = invoices.filter(
    (inv) =>
      inv.status !== InvoiceStatus.PAID &&
      inv.status !== InvoiceStatus.VOID &&
      new Date(inv.dueDate) < today
  );
  const overdueCount = overdueInvoices.length;
  const overdueAmount = overdueInvoices.reduce(
    (sum, inv) => sum + Number(inv.amount),
    0
  );

  const outstandingBalance = totalInvoiced - paidAmount;

  // Installment summary
  const remainingInvoices = invoices.filter(
    (inv) =>
      inv.status !== InvoiceStatus.PAID &&
      inv.status !== InvoiceStatus.VOID &&
      inv.status !== InvoiceStatus.REFUNDED
  );
  const remainingCount = remainingInvoices.length;
  const remainingAmount = remainingInvoices.reduce(
    (sum, inv) => sum + Number(inv.amount),
    0
  );

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return Number(amount).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });
  };

  // Status badge helper with colored dots and days overdue
  const getStatusBadge = (status: InvoiceStatus, dueDate: Date) => {
    const isOverdue =
      status !== InvoiceStatus.PAID &&
      status !== InvoiceStatus.VOID &&
      new Date(dueDate) < today;

    // Calculate days overdue
    const daysOverdue = isOverdue
      ? Math.floor((today.getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    if (isOverdue && status !== InvoiceStatus.OVERDUE) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-red-600 text-white font-medium flex items-center gap-1">
          <span className="inline-block">•</span>
          VENCIDO ({daysOverdue} dias)
        </span>
      );
    }

    const colorMap: Record<InvoiceStatus, { bg: string; text: string; dot: string }> = {
      PAID: { bg: "bg-green-100", text: "text-green-800", dot: "text-green-600" },
      SENT: { bg: "bg-blue-100", text: "text-blue-800", dot: "text-blue-600" },
      OVERDUE: { bg: "bg-red-600", text: "text-white", dot: "text-white" },
      DRAFT: { bg: "bg-gray-100", text: "text-gray-800", dot: "text-gray-600" },
      PARTIALLY_PAID: { bg: "bg-yellow-100", text: "text-yellow-800", dot: "text-yellow-600" },
      VOID: { bg: "bg-gray-100", text: "text-gray-800 line-through", dot: "text-gray-600" },
      REFUNDED: { bg: "bg-purple-100", text: "text-purple-800", dot: "text-purple-600" },
      PARTIALLY_REFUNDED: { bg: "bg-purple-100", text: "text-purple-800", dot: "text-purple-600" },
    };

    const colors = colorMap[status];
    const displayStatus = status === InvoiceStatus.OVERDUE && daysOverdue > 0
      ? `VENCIDO (${daysOverdue} dias)`
      : status;

    return (
      <span className={`px-2 py-1 text-xs rounded-full ${colors.bg} ${colors.text} ${status === InvoiceStatus.OVERDUE ? 'font-medium' : ''} flex items-center gap-1`}>
        <span className={`inline-block ${colors.dot}`}>•</span>
        {displayStatus}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 md:p-8 max-w-7xl">
        {/* Breadcrumb */}
        <nav className="mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-sm">
            <li>
              <Link href="/dashboard/customers" className="text-gray-500 hover:text-gray-700 font-display">
                Clientes
              </Link>
            </li>
            <li className="text-gray-400">›</li>
            <li className="text-gray-900 font-display font-medium">{customer.name}</li>
          </ol>
        </nav>

        {/* Customer Header */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-brand-creme text-brand-verde">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-3xl font-display font-semibold text-gray-900">{customer.name}</h1>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {customer.quickbooks_id && (
                      <Badge variant="success">QuickBooks</Badge>
                    )}
                    {customer.clint_contact_id && (
                      <Badge variant="info">Clint</Badge>
                    )}
                    {latestTest ? (
                      <Badge
                        variant={
                          latestTest.displayLevel.toLowerCase().includes("beginner")
                            ? "error"
                            : latestTest.displayLevel.toLowerCase().includes("intermediate")
                            ? "warning"
                            : latestTest.displayLevel.toLowerCase().includes("advanced")
                            ? "info"
                            : latestTest.displayLevel.toLowerCase().includes("fluent")
                            ? "success"
                            : "default"
                        }
                      >
                        <BookOpen className="h-3 w-3 mr-1 inline" />
                        {latestTest.displayLevel} ({latestTest.cefrLevel}) — {latestTest.totalScore}/{latestTest.questionCount || 25}
                      </Badge>
                    ) : (
                      <Badge variant="default">
                        <BookOpen className="h-3 w-3 mr-1 inline" />
                        English: Not taken
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-2 text-gray-700">
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span>{customer.email}</span>
                </p>
                {customer.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span>{customer.phone}</span>
                  </p>
                )}
              </div>
            </div>
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={`/dashboard/customers/${customer.id}/edit`}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-display font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Editar Cliente
              </Link>
              <DeleteCustomerButton
                customerId={customer.id}
                customerName={customer.name}
                quickbooksId={customer.quickbooks_id}
                userRole={userRole}
              />
              <Link
                href={`/dashboard/contracts/new?customerId=${customer.id}`}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-display font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                <FileText className="w-4 h-4" />
                Criar Contrato
              </Link>
              <Link
                href={`/dashboard/invoices/new?customerId=${customer.id}`}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-600 text-white text-sm font-display font-semibold rounded-lg hover:bg-primary-700 transition-colors"
              >
                <FileText className="w-4 h-4" />
                Criar Fatura
              </Link>
            </div>
        </div>
      </div>

        {/* Financial Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            label="Total Faturado"
            value={formatCurrency(totalInvoiced)}
            description={`${totalInvoices} faturas`}
            icon={<FileText className="h-5 w-5" />}
          />
          <StatCard
            label="Pago"
            value={formatCurrency(paidAmount)}
            description={`${paidCount} faturas (${totalInvoices > 0 ? Math.round((paidCount / totalInvoices) * 100) : 0}%)`}
            icon={<DollarSign className="h-5 w-5" />}
          />
          <StatCard
            label="Pendente"
            value={formatCurrency(pendingAmount)}
            description={`${pendingCount} faturas`}
          />
          <StatCard
            label="Vencido"
            value={formatCurrency(overdueAmount)}
            description={`${overdueCount} faturas`}
            icon={overdueCount > 0 ? <AlertCircle className="h-5 w-5 text-error-500" /> : undefined}
            className={overdueCount > 0 ? "border-error-500 bg-error-50" : undefined}
          />
        </div>

        {/* Installment Plan Summary with Visual Indicators */}
        <div className={`p-6 rounded-lg border mb-6 ${
          overdueCount > 0
            ? 'bg-error-50 border-error-200'
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
            <div>
              <h2 className="text-xl font-display font-semibold text-gray-900">Resumo do Plano de Parcelas</h2>
              {overdueCount > 0 && (
                <Badge variant="error" className="mt-2">
                  <AlertCircle className="h-3 w-3 mr-1 inline" />
                  {overdueCount} Vencidas
                </Badge>
              )}
            </div>

          {/* Payment Status Pie Chart */}
          <div className="flex items-center gap-4">
            <div className="relative flex items-center justify-center">
              <div
                className="w-28 h-28 rounded-full"
                style={{
                  background: `conic-gradient(
                    #16a34a 0% ${totalInvoices > 0 ? (paidCount / totalInvoices) * 100 : 0}%,
                    #dc2626 ${totalInvoices > 0 ? (paidCount / totalInvoices) * 100 : 0}% 100%
                  )`,
                }}
              >
                <div className="absolute inset-2 bg-white rounded-full flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-gray-900">
                    {totalInvoices > 0 ? Math.round((paidCount / totalInvoices) * 100) : 0}%
                  </span>
                  <span className="text-xs text-gray-500">Pago</span>
                </div>
              </div>
            </div>
            <div className="text-sm space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                <span className="text-gray-600">{paidCount} Pagas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                <span className="text-gray-600">{totalInvoices - paidCount} Não Pagas</span>
              </div>
            </div>
          </div>
        </div>

        {/* Installment Progress Bar */}
        <div className="mb-6">
          <div className="flex w-full h-6 rounded-lg overflow-hidden">
            {(() => {
              const paidPercent = totalInvoices > 0 ? (paidCount / totalInvoices) * 100 : 0;
              const remainingPercent = totalInvoices > 0 ? ((remainingCount - overdueCount) / totalInvoices) * 100 : 0;
              const overduePercent = totalInvoices > 0 ? (overdueCount / totalInvoices) * 100 : 0;

              return (
                <>
                  {paidPercent > 0 && (
                    <div
                      className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
                      style={{ width: `${paidPercent}%` }}
                      title={`${paidCount} pagas`}
                    >
                      {paidPercent > 15 && `${paidCount} pagas`}
                    </div>
                  )}
                  {remainingPercent > 0 && (
                    <div
                      className="bg-yellow-400 flex items-center justify-center text-white text-xs font-medium"
                      style={{ width: `${remainingPercent}%` }}
                      title={`${remainingCount - overdueCount} restantes`}
                    >
                      {remainingPercent > 15 && `${remainingCount - overdueCount} restantes`}
                    </div>
                  )}
                  {overduePercent > 0 && (
                    <div
                      className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
                      style={{ width: `${overduePercent}%` }}
                      title={`${overdueCount} vencidas`}
                    >
                      {overduePercent > 15 && `${overdueCount} vencidas`}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-600">
            <span>{paidCount} pagas</span>
            <span>{remainingCount - overdueCount} restantes</span>
            <span>{overdueCount} vencidas</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm font-medium text-gray-500 mb-1">Total de Parcelas</p>
            <p className="text-2xl font-bold text-gray-900">{totalInvoices}</p>
            <p className="text-xs text-gray-500 mt-1">Total de faturas</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-green-200">
            <p className="text-sm font-medium text-gray-500 mb-1">Pago</p>
            <p className="text-2xl font-bold text-green-600">{paidCount}</p>
            <p className="text-xs text-green-600 mt-1">{formatCurrency(paidAmount)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-blue-200">
            <p className="text-sm font-medium text-gray-500 mb-1">Restante</p>
            <p className="text-2xl font-bold text-blue-600">{remainingCount}</p>
            <p className="text-xs text-blue-600 mt-1">{formatCurrency(remainingAmount)}</p>
          </div>
          <div className={`bg-white p-4 rounded-lg border ${overdueCount > 0 ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
            <p className="text-sm font-medium text-gray-500 mb-1">Vencido</p>
            <p className={`text-2xl font-bold ${overdueCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {overdueCount}
            </p>
            <p className={`text-xs mt-1 ${overdueCount > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
              {formatCurrency(overdueAmount)}
            </p>
          </div>
        </div>
      </div>

      {/* Invoice Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-display font-semibold text-gray-900">Faturas</h2>
        </div>

        {invoices.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            Nenhuma fatura encontrada para este cliente
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                    Fatura #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                    Valor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                    Vencimento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                    Data de Pagamento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoices.map((invoice) => {
                  const isOverdue =
                    invoice.status !== InvoiceStatus.PAID &&
                    invoice.status !== InvoiceStatus.VOID &&
                    new Date(invoice.dueDate) < today;

                  return (
                    <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/dashboard/invoices/${invoice.id}`}
                          className="text-sm font-display font-medium text-primary-600 hover:text-primary-700"
                        >
                          {invoice.invoiceNumber || invoice.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-display font-semibold text-gray-900 tabular-nums">
                        ${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 tabular-nums">
                        {format(new Date(invoice.dueDate), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={getInvoiceStatusVariant(invoice.status, isOverdue)}>
                          {invoice.status}
                          {isOverdue && invoice.status !== InvoiceStatus.PAID && " (Vencida)"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 tabular-nums">
                        {invoice.paidAt ? format(new Date(invoice.paidAt), 'MMM dd, yyyy') : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/dashboard/invoices/${invoice.id}`}
                            className="text-primary-600 hover:text-primary-700 font-medium"
                          >
                            Ver
                          </Link>
                          <DeleteInvoiceButtonCustomer
                            invoiceId={invoice.id}
                            invoiceNumber={invoice.invoiceNumber || invoice.id.slice(0, 8)}
                            hasQuickbooksId={!!invoice.quickbooks_invoice_id}
                            userRole={userRole}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
