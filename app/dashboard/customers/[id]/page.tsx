import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { InvoiceStatus } from "@prisma/client";
import Link from "next/link";
import { DeleteInvoiceButtonCustomer } from "@/components/customers/delete-invoice-button-customer";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Phone, FileText, DollarSign, AlertCircle } from "lucide-react";

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
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 md:p-8 max-w-7xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
          <Link href="/dashboard/customers" className="hover:text-primary-600 transition-colors">
            Customers
          </Link>
          <span>›</span>
          <span className="text-gray-900 font-medium">{customer.name}</span>
        </div>

        {/* Customer Header */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 text-primary-600">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-3xl font-display font-semibold text-gray-900">{customer.name}</h1>
                  <div className="flex gap-2 mt-2">
                    {customer.quickbooks_id && (
                      <Badge variant="success">QuickBooks</Badge>
                    )}
                    {customer.pipedrive_id && (
                      <Badge variant="info">Pipedrive</Badge>
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
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-display font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                Edit Customer
              </Link>
              <Link
                href={`/dashboard/invoices/new?customerId=${customer.id}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-display font-semibold text-white hover:bg-primary-700 transition"
              >
                <FileText className="w-4 h-4" />
                Create Invoice
              </Link>
            </div>
        </div>
      </div>

        {/* Financial Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            label="Total Invoiced"
            value={formatCurrency(totalInvoiced)}
            description={`${totalInvoices} invoices`}
            icon={<FileText className="h-5 w-5" />}
          />
          <StatCard
            label="Paid"
            value={formatCurrency(paidAmount)}
            description={`${paidCount} invoices (${totalInvoices > 0 ? Math.round((paidCount / totalInvoices) * 100) : 0}%)`}
            icon={<DollarSign className="h-5 w-5" />}
          />
          <StatCard
            label="Pending"
            value={formatCurrency(pendingAmount)}
            description={`${pendingCount} invoices`}
          />
          <StatCard
            label="Overdue"
            value={formatCurrency(overdueAmount)}
            description={`${overdueCount} invoices`}
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
              <h2 className="text-xl font-display font-semibold text-gray-900">Installment Plan Summary</h2>
              {overdueCount > 0 && (
                <Badge variant="error" className="mt-2">
                  <AlertCircle className="h-3 w-3 mr-1 inline" />
                  {overdueCount} Overdue
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
    </div>
  );
}
