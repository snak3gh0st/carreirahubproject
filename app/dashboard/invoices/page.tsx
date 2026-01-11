import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InvoiceStatus } from "@prisma/client";
import Link from "next/link";
import { ApprovalStatusBadge } from "@/components/invoices/approval-status-badge";
import { Pagination } from "@/components/ui/pagination";

const ITEMS_PER_PAGE = 25;

/**
 * Dashboard de Invoices
 *
 * Exibe lista de invoices e status de pagamento com paginação
 */
export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: {
    approvalStatus?: string;
    status?: string;
    page?: string;
    search?: string;
    source?: string;
    sortBy?: string;
    sortOrder?: string;
  };
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  // Verificar permissão
  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN" && userRole !== "FINANCE") {
    redirect("/dashboard");
  }

  const currentPage = Math.max(1, parseInt(searchParams.page || "1"));
  const search = searchParams.search || "";
  const source = searchParams.source || "";
  const sortBy = searchParams.sortBy || "createdAt";
  const sortOrder = (searchParams.sortOrder || "desc") as "asc" | "desc";

  // Valid sort fields
  const validSortFields = ["invoiceNumber", "amount", "dueDate", "status", "createdAt"];
  const actualSortBy = validSortFields.includes(sortBy) ? sortBy : "createdAt";

  // Build filter based on params
  const whereClause: any = {};

  if (searchParams.approvalStatus) {
    whereClause.approvalStatus = searchParams.approvalStatus;
  }

  if (searchParams.status) {
    whereClause.status = searchParams.status;
  }

  if (source === "quickbooks") {
    whereClause.quickbooks_invoice_id = { not: null };
  }

  if (search) {
    whereClause.OR = [
      { invoiceNumber: { contains: search, mode: "insensitive" } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { customer: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  // Get total count
  const totalInvoices = await prisma.invoice.count({ where: whereClause });
  const totalPages = Math.ceil(totalInvoices / ITEMS_PER_PAGE);

  // Buscar invoices with pagination and sorting
  const invoices = await prisma.invoice.findMany({
    where: whereClause,
    skip: (currentPage - 1) * ITEMS_PER_PAGE,
    take: ITEMS_PER_PAGE,
    orderBy: { [actualSortBy]: sortOrder },
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

  // Global statistics (not filtered)
  const globalStats = await prisma.invoice.groupBy({
    by: ["status"],
    _count: { id: true },
    _sum: { amount: true },
  });

  const statsMap = globalStats.reduce(
    (acc, item) => {
      acc[item.status] = {
        count: item._count.id,
        amount: Number(item._sum.amount || 0),
      };
      return acc;
    },
    {} as Record<InvoiceStatus, { count: number; amount: number }>
  );

  // Approval statistics
  const approvalStats = await prisma.invoice.groupBy({
    by: ["approvalStatus"],
    _count: { id: true },
  });

  const approvalStatsMap = approvalStats.reduce(
    (acc, item) => {
      acc[item.approvalStatus] = item._count.id;
      return acc;
    },
    {} as Record<string, number>
  );

  // QuickBooks synced count
  const qbInvoices = await prisma.invoice.count({
    where: { quickbooks_invoice_id: { not: null } },
  });

  // Calculate totals
  const totalAmount = Object.values(statsMap).reduce(
    (sum, s) => sum + s.amount,
    0
  );
  const paidAmount = statsMap.PAID?.amount || 0;
  const overdueAmount = statsMap.OVERDUE?.amount || 0;
  const pendingAmount =
    (statsMap.SENT?.amount || 0) + (statsMap.DRAFT?.amount || 0);

  const pendingApprovalCount = approvalStatsMap.PENDING || 0;

  // Build search params for pagination
  const paginationParams: Record<string, string> = {};
  if (search) paginationParams.search = search;
  if (source) paginationParams.source = source;
  if (searchParams.approvalStatus)
    paginationParams.approvalStatus = searchParams.approvalStatus;
  if (searchParams.status) paginationParams.status = searchParams.status;
  if (sortBy !== "createdAt") paginationParams.sortBy = sortBy;
  if (sortOrder !== "desc") paginationParams.sortOrder = sortOrder;

  // Helper function to build sort URL
  const buildSortUrl = (field: string) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (source) params.set("source", source);
    if (searchParams.approvalStatus) params.set("approvalStatus", searchParams.approvalStatus);
    if (searchParams.status) params.set("status", searchParams.status);
    params.set("sortBy", field);
    params.set("sortOrder", sortBy === field && sortOrder === "asc" ? "desc" : "asc");
    return `/dashboard/invoices?${params.toString()}`;
  };

  // Sort indicator component
  const SortIndicator = ({ field }: { field: string }) => {
    if (sortBy !== field) return null;
    return sortOrder === "asc" ? " ↑" : " ↓";
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Invoices & Financeiro</h1>
        <div className="flex items-center gap-3">
          {pendingApprovalCount > 0 && (
            <Link
              href="/dashboard/invoices/approval-queue"
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition flex items-center gap-2"
            >
              <span className="font-semibold">{pendingApprovalCount}</span>
              Pending Approvals
            </Link>
          )}
          <Link
            href="/dashboard/invoices/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            Criar Invoice
          </Link>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Invoices</h3>
          <p className="text-3xl font-bold mt-2">
            {Object.values(statsMap).reduce((s, v) => s + v.count, 0)}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {qbInvoices} from QuickBooks
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Value</h3>
          <p className="text-3xl font-bold mt-2">
            ${totalAmount.toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Paid</h3>
          <p className="text-3xl font-bold mt-2 text-green-600">
            ${paidAmount.toLocaleString()}
          </p>
          <p className="text-sm text-green-600 mt-1">
            {statsMap.PAID?.count || 0} invoices
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Pending</h3>
          <p className="text-3xl font-bold mt-2 text-yellow-600">
            ${pendingAmount.toLocaleString()}
          </p>
          <p className="text-sm text-yellow-600 mt-1">
            {(statsMap.SENT?.count || 0) + (statsMap.DRAFT?.count || 0)} invoices
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Overdue</h3>
          <p className="text-3xl font-bold mt-2 text-red-600">
            ${overdueAmount.toLocaleString()}
          </p>
          <p className="text-sm text-red-600 mt-1">
            {statsMap.OVERDUE?.count || 0} invoices
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <form method="GET" className="flex-1 min-w-[200px]">
            {searchParams.approvalStatus && (
              <input
                type="hidden"
                name="approvalStatus"
                value={searchParams.approvalStatus}
              />
            )}
            {searchParams.status && (
              <input type="hidden" name="status" value={searchParams.status} />
            )}
            {source && <input type="hidden" name="source" value={source} />}
            <div className="relative">
              <input
                type="text"
                name="search"
                defaultValue={search}
                placeholder="Search by invoice #, customer name, or email..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <svg
                className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </form>

          {/* Source Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Source:</span>
            <Link
              href={`/dashboard/invoices${search ? `?search=${search}` : ""}${
                searchParams.status ? `&status=${searchParams.status}` : ""
              }`}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                !source
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All
            </Link>
            <Link
              href={`/dashboard/invoices?source=quickbooks${
                search ? `&search=${search}` : ""
              }${searchParams.status ? `&status=${searchParams.status}` : ""}`}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                source === "quickbooks"
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              QuickBooks ({qbInvoices})
            </Link>
          </div>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600 mr-2">Status:</span>
          <Link
            href={`/dashboard/invoices${source ? `?source=${source}` : ""}${
              search ? `${source ? "&" : "?"}search=${search}` : ""
            }`}
            className={`px-3 py-1 rounded-md text-sm font-medium ${
              !searchParams.status
                ? "bg-gray-800 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            All
          </Link>
          {Object.entries(statsMap).map(([status, data]) => (
            <Link
              key={status}
              href={`/dashboard/invoices?status=${status}${
                source ? `&source=${source}` : ""
              }${search ? `&search=${search}` : ""}`}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                searchParams.status === status
                  ? status === "PAID"
                    ? "bg-green-600 text-white"
                    : status === "OVERDUE"
                    ? "bg-red-600 text-white"
                    : status === "SENT"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {status} ({data.count})
            </Link>
          ))}
        </div>
      </div>

      {/* Invoice List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <Link
                  href={buildSortUrl("invoiceNumber")}
                  className="hover:text-gray-900 cursor-pointer"
                >
                  Invoice #<SortIndicator field="invoiceNumber" />
                </Link>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <Link
                  href={buildSortUrl("amount")}
                  className="hover:text-gray-900 cursor-pointer"
                >
                  Amount<SortIndicator field="amount" />
                </Link>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <Link
                  href={buildSortUrl("dueDate")}
                  className="hover:text-gray-900 cursor-pointer"
                >
                  Due Date<SortIndicator field="dueDate" />
                </Link>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Source
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Approval
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <Link
                  href={buildSortUrl("status")}
                  className="hover:text-gray-900 cursor-pointer"
                >
                  Status<SortIndicator field="status" />
                </Link>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  No invoices found
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => {
                const isOverdue =
                  invoice.status !== InvoiceStatus.PAID &&
                  invoice.status !== InvoiceStatus.VOID &&
                  new Date(invoice.dueDate) < new Date();

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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/dashboard/customers/${invoice.customer.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {invoice.customer.name}
                      </Link>
                      <div className="text-xs text-gray-500">
                        {invoice.customer.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">
                      ${Number(invoice.amount).toLocaleString()}
                    </td>
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-sm ${
                        isOverdue ? "text-red-600 font-medium" : "text-gray-500"
                      }`}
                    >
                      {new Date(invoice.dueDate).toLocaleDateString()}
                      {isOverdue && (
                        <div className="text-xs text-red-500">Overdue</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {invoice.quickbooks_invoice_id ? (
                        <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                          QuickBooks
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                          Manual
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <ApprovalStatusBadge status={invoice.approvalStatus as any} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          invoice.status === InvoiceStatus.PAID
                            ? "bg-green-100 text-green-800"
                            : invoice.status === InvoiceStatus.OVERDUE || isOverdue
                            ? "bg-red-100 text-red-800"
                            : invoice.status === InvoiceStatus.SENT
                            ? "bg-blue-100 text-blue-800"
                            : invoice.status === InvoiceStatus.PARTIALLY_PAID
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalInvoices}
          itemsPerPage={ITEMS_PER_PAGE}
          baseUrl="/dashboard/invoices"
          searchParams={paginationParams}
        />
      </div>
    </div>
  );
}
