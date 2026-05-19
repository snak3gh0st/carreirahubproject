import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ApprovalStatusBadge } from "@/components/invoices/approval-status-badge";
import { isWindowedQuickBooksInstallmentDraft } from "@/lib/invoices/installment-publishing";

export const dynamic = 'force-dynamic';

/**
 * Invoice Approval Queue Page
 *
 * Displays all invoices pending approval for Finance team
 */
export default async function ApprovalQueuePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  // Check permissions (FINANCE and ADMIN only)
  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN" && userRole !== "FINANCE") {
    redirect("/dashboard");
  }

  // Fetch pending invoices (using status DRAFT as "pending approval")
  const pendingInvoices = await prisma.invoice.findMany({
    where: {
      status: "DRAFT",
    },
    orderBy: {
      createdAt: "asc", // Oldest first (FIFO)
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      deal: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  const actionablePendingInvoices = pendingInvoices.filter(
    (invoice) => !isWindowedQuickBooksInstallmentDraft(invoice)
  );

  // Get statistics by invoice status
  const stats = await prisma.invoice.groupBy({
    by: ["status"],
    _count: {
      id: true,
    },
  });

  const statsMap = stats.reduce(
    (acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    },
    {} as Record<string, number>
  );

  // Calculate wait times
  const now = new Date();
  const invoicesWithWaitTime = actionablePendingInvoices.map((invoice) => {
    const waitTimeMs = now.getTime() - invoice.createdAt.getTime();
    const waitTimeHours = Math.floor(waitTimeMs / (1000 * 60 * 60));
    const waitTimeDays = Math.floor(waitTimeHours / 24);

    return {
      ...invoice,
      waitTimeHours,
      waitTimeDays,
    };
  });

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Invoice Approval Queue</h1>
          <p className="text-gray-600 mt-1">
            Review and approve invoices submitted by the Sales team
          </p>
        </div>
        <Link
          href="/dashboard/invoices"
          className="px-4 py-2 text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 transition"
        >
          View All Invoices
        </Link>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-orange-50 border border-orange-200 p-6 rounded-lg">
          <h3 className="text-sm font-medium text-orange-700">Draft (Pending)</h3>
          <p className="text-4xl font-bold mt-2 text-orange-900">
            {actionablePendingInvoices.length}
          </p>
          <p className="text-sm text-orange-600 mt-1">Require your attention</p>
        </div>
        <div className="bg-green-50 border border-green-200 p-6 rounded-lg">
          <h3 className="text-sm font-medium text-green-700">Sent</h3>
          <p className="text-4xl font-bold mt-2 text-green-900">
            {statsMap.SENT || 0}
          </p>
          <p className="text-sm text-green-600 mt-1">Synced to systems</p>
        </div>
        <div className="bg-red-50 border border-red-200 p-6 rounded-lg">
          <h3 className="text-sm font-medium text-red-700">Overdue</h3>
          <p className="text-4xl font-bold mt-2 text-red-900">
            {statsMap.OVERDUE || 0}
          </p>
          <p className="text-sm text-red-600 mt-1">Past due date</p>
        </div>
      </div>

      {/* Pending Invoices List */}
      {actionablePendingInvoices.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            All Caught Up!
          </h3>
          <p className="text-gray-600">
            There are no invoices pending approval at the moment.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Pending Invoices ({actionablePendingInvoices.length})
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Oldest invoices shown first
            </p>
            {pendingInvoices.length > actionablePendingInvoices.length && (
              <p className="text-xs text-gray-500 mt-1">
                Future installments scheduled for later QuickBooks publishing are excluded from this queue.
              </p>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Invoice
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Deal
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Wait Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoicesWithWaitTime.map((invoice) => {
                  const isUrgent = invoice.waitTimeHours >= 24;

                  return (
                    <tr
                      key={invoice.id}
                      className={`hover:bg-gray-50 ${
                        isUrgent ? "bg-orange-50" : ""
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/dashboard/invoices/${invoice.id}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {invoice.invoiceNumber || invoice.id.slice(0, 8)}
                        </Link>
                        {isUrgent && (
                          <span className="ml-2 text-xs text-orange-600 font-medium">
                            🔥 URGENT
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="font-medium text-gray-900">
                            {invoice.customer.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {invoice.customer.email}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {invoice.deal ? (
                          <Link
                            href={`/dashboard/deals/${invoice.deal.id}`}
                            className="text-blue-600 hover:underline text-sm"
                          >
                            {invoice.deal.title}
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">
                        ${Number(invoice.amount).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {invoice.createdAt.toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`text-sm font-medium ${
                            invoice.waitTimeDays > 0
                              ? "text-orange-600"
                              : "text-gray-600"
                          }`}
                        >
                          {invoice.waitTimeDays > 0
                            ? `${invoice.waitTimeDays}d ${invoice.waitTimeHours % 24}h`
                            : `${invoice.waitTimeHours}h`}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <ApprovalStatusBadge status="PENDING" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/dashboard/invoices/${invoice.id}`}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          Review →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
