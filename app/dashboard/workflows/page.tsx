import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { WorkflowStatusBadge } from "@/components/dashboard/workflow-status-badge";
import { Pagination } from "@/components/ui/pagination";

const ITEMS_PER_PAGE = 25;

/**
 * Finance Workflow Monitoring Dashboard
 *
 * Shows all Deal workflows with status, invoice info, contract info, and actions
 */
export default async function WorkflowsPage({
  searchParams,
}: {
  searchParams: {
    workflowStatus?: string;
    page?: string;
  };
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  // Check permission - Finance and Admin only
  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN" && userRole !== "FINANCE") {
    redirect("/dashboard");
  }

  const currentPage = Math.max(1, parseInt(searchParams.page || "1"));
  const workflowStatus = searchParams.workflowStatus || "";

  // Build filter
  const whereClause: any = {
    status: "WON", // Only show Won deals (workflows start on Deal Won)
  };

  if (workflowStatus) {
    whereClause.workflowStatus = workflowStatus;
  }

  // Get total count
  const totalDeals = await prisma.deal.count({ where: whereClause });

  // Fetch deals with workflow info
  const deals = await prisma.deal.findMany({
    where: whereClause,
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      invoices: {
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 1, // Most recent invoice
      },
      contracts: {
        select: {
          id: true,
          status: true,
          signedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 1, // Most recent contract
      },
      _count: {
        select: {
          invoices: true,
          contracts: true,
        },
      },
    },
    orderBy: { workflowStartedAt: "desc" },
    take: ITEMS_PER_PAGE,
    skip: (currentPage - 1) * ITEMS_PER_PAGE,
  });

  const totalPages = Math.ceil(totalDeals / ITEMS_PER_PAGE);

  // Count by status for filters
  const statusCounts = await prisma.deal.groupBy({
    by: ["workflowStatus"],
    where: { status: "WON" },
    _count: true,
  });

  const statusCountMap = statusCounts.reduce((acc: any, item) => {
    acc[item.workflowStatus || "null"] = item._count;
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Finance Workflows</h1>
        <p className="text-gray-600 mt-2">
          Monitor Deal Won workflows: Invoice creation → Contract generation → Payment
        </p>
      </div>

      {/* Status Filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/dashboard/workflows"
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            !workflowStatus
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          All ({totalDeals})
        </Link>
        <Link
          href="/dashboard/workflows?workflowStatus=IN_PROGRESS"
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            workflowStatus === "IN_PROGRESS"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          In Progress ({statusCountMap["IN_PROGRESS"] || 0})
        </Link>
        <Link
          href="/dashboard/workflows?workflowStatus=FAILED"
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            workflowStatus === "FAILED"
              ? "bg-red-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Failed ({statusCountMap["FAILED"] || 0})
        </Link>
        <Link
          href="/dashboard/workflows?workflowStatus=COMPLETED"
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            workflowStatus === "COMPLETED"
              ? "bg-green-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Completed ({statusCountMap["COMPLETED"] || 0})
        </Link>
      </div>

      {/* Workflows Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Workflow Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contract
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {deals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No workflows found matching the selected filters.
                  </td>
                </tr>
              ) : (
                deals.map((deal) => {
                  const invoice = deal.invoices[0];
                  const contract = deal.contracts[0];

                  return (
                    <tr key={deal.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {deal.title}
                        </div>
                        <div className="text-sm text-gray-500">
                          ${Number(deal.value).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {deal.customer?.name || "—"}
                        </div>
                        <div className="text-sm text-gray-500">
                          {deal.customer?.email || "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <WorkflowStatusBadge
                          status={deal.workflowStatus}
                          error={deal.workflowError}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {invoice ? (
                          <div>
                            <Link
                              href={`/dashboard/invoices/${invoice.id}`}
                              className="text-sm font-medium text-blue-600 hover:text-blue-800"
                            >
                              {invoice.invoiceNumber || invoice.id.slice(0, 8)}
                            </Link>
                            <div className="text-xs text-gray-500 capitalize">
                              {invoice.status.toLowerCase()}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">No invoice</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {contract ? (
                          <div>
                            <div className="text-sm font-medium text-gray-900 capitalize">
                              {contract.status.toLowerCase().replace(/_/g, " ")}
                            </div>
                            {contract.signedAt && (
                              <div className="text-xs text-gray-500">
                                Signed {new Date(contract.signedAt).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">No contract</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-2">
                          <Link
                            href={`/dashboard/deals/${deal.id}/workflow`}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            View Details
                          </Link>
                          {deal.workflowStatus === "FAILED" && (
                            <form
                              action={`/api/deals/${deal.id}/workflow/retry`}
                              method="POST"
                              className="inline"
                            >
                              <button
                                type="submit"
                                className="text-red-600 hover:text-red-800 font-medium"
                              >
                                Retry
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalDeals}
            itemsPerPage={ITEMS_PER_PAGE}
            baseUrl="/dashboard/workflows"
            searchParams={searchParams}
          />
        </div>
      )}
    </div>
  );
}
