import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { InvoiceStatus } from "@prisma/client";
import Link from "next/link";
import { DeleteInvoiceButtonCustomer } from "@/components/customers/delete-invoice-button-customer";

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
          OVERDUE ({daysOverdue} days)
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
      ? `OVERDUE (${daysOverdue} days)`
      : status;

    return (
      <span className={`px-2 py-1 text-xs rounded-full ${colors.bg} ${colors.text} ${status === InvoiceStatus.OVERDUE ? 'font-medium' : ''} flex items-center gap-1`}>
        <span className={`inline-block ${colors.dot}`}>•</span>
        {displayStatus}
      </span>
    );
  };

  return (
    <div className="container mx-auto p-6">
      {/* Back Button */}
      <div className="mb-6">
        <Link
          href="/dashboard/customers"
          className="text-blue-600 hover:underline flex items-center gap-2"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Voltar para Clientes
        </Link>
      </div>

      {/* Customer Header */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{customer.name}</h1>
            <div className="space-y-1 text-gray-600">
              <p className="flex items-center gap-2">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                {customer.email}
              </p>
              {customer.phone && (
                <p className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                  {customer.phone}
                </p>
              )}
            </div>
          </div>
          {/* Source Badges */}
          <div className="flex gap-2">
            {customer.quickbooks_id && (
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
                QuickBooks
              </span>
            )}
            {customer.pipedrive_id && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                Pipedrive
              </span>
            )}
          </div>
          {/* Action Buttons */}
          <div className="flex gap-3">
            <Link
              href={`/dashboard/customers/${customer.id}/edit`}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Editar Cliente
            </Link>
            <Link
              href={`/dashboard/invoices/new?customerId=${customer.id}`}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              Criar invoice para este cliente
            </Link>
          </div>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Invoiced */}
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <h3 className="text-sm font-medium text-gray-500 mb-2">
            Total Invoiced
          </h3>
          <p className="text-3xl font-bold text-blue-600">{formatCurrency(totalInvoiced)}</p>
          <p className="text-sm text-gray-500 mt-1">{totalInvoices} invoices</p>
        </div>

        {/* Paid */}
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Paid</h3>
          <p className="text-3xl font-bold text-green-600">
            {formatCurrency(paidAmount)}
          </p>
          <p className="text-sm text-green-600 mt-1">
            {paidCount} invoices ({totalInvoices > 0 ? Math.round((paidCount / totalInvoices) * 100) : 0}%)
          </p>
        </div>

        {/* Pending */}
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-yellow-500">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Pending</h3>
          <p className="text-3xl font-bold text-yellow-600">
            {formatCurrency(pendingAmount)}
          </p>
          <p className="text-sm text-yellow-600 mt-1">{pendingCount} invoices</p>
        </div>

        {/* Overdue */}
        <div className={`bg-white p-6 rounded-lg shadow border-l-4 ${overdueCount > 0 ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}>
          <h3 className="text-sm font-medium text-gray-500 mb-2">Overdue</h3>
          <p className="text-3xl font-bold text-red-600">
            {formatCurrency(overdueAmount)}
          </p>
          <p className="text-sm text-red-600 mt-1">
            {overdueCount} invoices
            {overdueCount > 0 && <span className="ml-2">⚠️</span>}
          </p>
        </div>
      </div>

      {/* Installment Plan Summary with Visual Indicators */}
      <div className={`p-6 rounded-lg shadow mb-6 ${
        overdueCount > 0
          ? 'bg-gradient-to-r from-red-50 to-white border-2 border-red-200'
          : 'bg-white border border-gray-200'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <div>
            <h2 className="text-xl font-bold">Installment Plan Summary</h2>
            {overdueCount > 0 && (
              <span className="inline-block mt-2 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                ⚠️ {overdueCount} Overdue
              </span>
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
                  <span className="text-xs text-gray-500">Paid</span>
                </div>
              </div>
            </div>
            <div className="text-sm space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                <span className="text-gray-600">{paidCount} Paid</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                <span className="text-gray-600">{totalInvoices - paidCount} Unpaid</span>
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
                      title={`${paidCount} paid`}
                    >
                      {paidPercent > 15 && `${paidCount} paid`}
                    </div>
                  )}
                  {remainingPercent > 0 && (
                    <div
                      className="bg-yellow-400 flex items-center justify-center text-white text-xs font-medium"
                      style={{ width: `${remainingPercent}%` }}
                      title={`${remainingCount - overdueCount} remaining`}
                    >
                      {remainingPercent > 15 && `${remainingCount - overdueCount} left`}
                    </div>
                  )}
                  {overduePercent > 0 && (
                    <div
                      className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
                      style={{ width: `${overduePercent}%` }}
                      title={`${overdueCount} overdue`}
                    >
                      {overduePercent > 15 && `${overdueCount} overdue`}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-600">
            <span>{paidCount} paid</span>
            <span>{remainingCount - overdueCount} remaining</span>
            <span>{overdueCount} overdue</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm font-medium text-gray-500 mb-1">Total Installments</p>
            <p className="text-2xl font-bold text-gray-900">{totalInvoices}</p>
            <p className="text-xs text-gray-500 mt-1">Total invoices</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-green-200">
            <p className="text-sm font-medium text-gray-500 mb-1">Paid</p>
            <p className="text-2xl font-bold text-green-600">{paidCount}</p>
            <p className="text-xs text-green-600 mt-1">{formatCurrency(paidAmount)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-blue-200">
            <p className="text-sm font-medium text-gray-500 mb-1">Remaining</p>
            <p className="text-2xl font-bold text-blue-600">{remainingCount}</p>
            <p className="text-xs text-blue-600 mt-1">{formatCurrency(remainingAmount)}</p>
          </div>
          <div className={`bg-white p-4 rounded-lg border ${overdueCount > 0 ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
            <p className="text-sm font-medium text-gray-500 mb-1">Overdue</p>
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
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold">Invoices</h2>
        </div>

        {invoices.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            No invoices found for this customer
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
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
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/dashboard/invoices/${invoice.id}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {invoice.invoiceNumber || invoice.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">
                        {formatCurrency(Number(invoice.amount))}
                      </td>
                      <td
                        className={`px-6 py-4 whitespace-nowrap text-sm ${
                          isOverdue
                            ? "text-red-600 font-medium"
                            : "text-gray-500"
                        }`}
                      >
                        {new Date(invoice.dueDate).toLocaleDateString()}
                        {isOverdue && (
                          <div className="text-xs text-red-500 font-semibold">
                            Overdue
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(invoice.status, invoice.dueDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {invoice.paidAt
                          ? new Date(invoice.paidAt).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/dashboard/invoices/${invoice.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            View Details
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
  );
}
