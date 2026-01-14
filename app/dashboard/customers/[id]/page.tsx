import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { InvoiceStatus } from "@prisma/client";
import Link from "next/link";

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

  // Status badge helper
  const getStatusBadge = (status: InvoiceStatus, dueDate: Date) => {
    const isOverdue =
      status !== InvoiceStatus.PAID &&
      status !== InvoiceStatus.VOID &&
      new Date(dueDate) < today;

    if (isOverdue && status !== InvoiceStatus.OVERDUE) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
          OVERDUE
        </span>
      );
    }

    const colorMap: Record<InvoiceStatus, string> = {
      PAID: "bg-green-100 text-green-800",
      SENT: "bg-blue-100 text-blue-800",
      OVERDUE: "bg-red-100 text-red-800",
      DRAFT: "bg-gray-100 text-gray-800",
      PARTIALLY_PAID: "bg-yellow-100 text-yellow-800",
      VOID: "bg-gray-100 text-gray-800 line-through",
      REFUNDED: "bg-purple-100 text-purple-800",
      PARTIALLY_REFUNDED: "bg-purple-100 text-purple-800",
    };

    return (
      <span className={`px-2 py-1 text-xs rounded-full ${colorMap[status]}`}>
        {status}
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
          Back to Customers
        </Link>
      </div>

      {/* Customer Header */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="flex items-start justify-between">
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

      {/* Installment Plan Summary */}
      <div className={`p-6 rounded-lg shadow mb-6 ${
        overdueCount > 0
          ? 'bg-gradient-to-r from-red-50 to-white border-2 border-red-200'
          : 'bg-white border border-gray-200'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Installment Plan Summary</h2>
          {overdueCount > 0 && (
            <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
              ⚠️ {overdueCount} Overdue
            </span>
          )}
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
                        <Link
                          href={`/dashboard/invoices/${invoice.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          View Details
                        </Link>
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
