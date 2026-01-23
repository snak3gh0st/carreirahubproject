import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InvoiceStatus } from "@prisma/client";
import Link from "next/link";
import { Pagination } from "@/components/ui/pagination";
import { MobileFilterModal } from "@/components/dashboard/mobile-filter-modal";
import { DeleteInvoiceButton } from "@/components/invoices/delete-invoice-button";

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
    status?: string;
    page?: string;
    search?: string;
    source?: string;
    sortBy?: string;
    sortOrder?: string;
    dueDateFrom?: string;
    dueDateTo?: string;
    minAmount?: string;
    maxAmount?: string;
    paymentMethod?: string;
  };
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  // Verificar permissão
  const userRole = (session.user as any).role;
  const userId = (session.user as any).id;
  const allowedRoles = ["ADMIN", "FINANCE", "COMMERCIAL", "SALES"];

  if (!allowedRoles.includes(userRole)) {
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

  // COMMERCIAL and SALES users can only see their own invoices
  if (userRole === "COMMERCIAL" || userRole === "SALES") {
    whereClause.ownerId = userId;
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

  // Advanced filters
  if (searchParams.dueDateFrom) {
    whereClause.dueDate = {
      ...whereClause.dueDate,
      gte: new Date(searchParams.dueDateFrom),
    };
  }

  if (searchParams.dueDateTo) {
    whereClause.dueDate = {
      ...whereClause.dueDate,
      lte: new Date(searchParams.dueDateTo),
    };
  }

  if (searchParams.minAmount) {
    whereClause.amount = {
      ...whereClause.amount,
      gte: parseFloat(searchParams.minAmount),
    };
  }

  if (searchParams.maxAmount) {
    whereClause.amount = {
      ...whereClause.amount,
      lte: parseFloat(searchParams.maxAmount),
    };
  }

  if (searchParams.paymentMethod) {
    whereClause.paymentMethod = searchParams.paymentMethod;
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

  // Statistics filtered by same whereClause (respects COMMERCIAL user filter)
  const globalStats = await prisma.invoice.groupBy({
    by: ["status"],
    where: whereClause,
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

  // QuickBooks synced count (respects user filter)
  const qbInvoices = await prisma.invoice.count({
    where: {
      ...whereClause,
      quickbooks_invoice_id: { not: null }
    },
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

  // Build search params for pagination
  const paginationParams: Record<string, string> = {};
  if (search) paginationParams.search = search;
  if (source) paginationParams.source = source;
  if (searchParams.status) paginationParams.status = searchParams.status;
  if (sortBy !== "createdAt") paginationParams.sortBy = sortBy;
  if (sortOrder !== "desc") paginationParams.sortOrder = sortOrder;
  if (searchParams.dueDateFrom) paginationParams.dueDateFrom = searchParams.dueDateFrom;
  if (searchParams.dueDateTo) paginationParams.dueDateTo = searchParams.dueDateTo;
  if (searchParams.minAmount) paginationParams.minAmount = searchParams.minAmount;
  if (searchParams.maxAmount) paginationParams.maxAmount = searchParams.maxAmount;
  if (searchParams.paymentMethod) paginationParams.paymentMethod = searchParams.paymentMethod;

  // Count active filters
  const activeFilterCount = [
    searchParams.dueDateFrom,
    searchParams.dueDateTo,
    searchParams.minAmount,
    searchParams.maxAmount,
    searchParams.paymentMethod,
  ].filter(Boolean).length;

  // Helper function to build sort URL
  const buildSortUrl = (field: string) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (source) params.set("source", source);
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
          <Link
            href="/dashboard/invoices/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            Criar Invoice
          </Link>
        </div>
      </div>

      {/* Status Distribution Bar Chart */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h3 className="text-sm font-medium text-gray-500 mb-3">
          Invoice Status Distribution
        </h3>
        <div className="flex w-full h-8 rounded-lg overflow-hidden">
          {(() => {
            const totalCount = Object.values(statsMap).reduce((s, v) => s + v.count, 0);
            const draftPercent = ((statsMap.DRAFT?.count || 0) / totalCount) * 100;
            const sentPercent = ((statsMap.SENT?.count || 0) / totalCount) * 100;
            const paidPercent = ((statsMap.PAID?.count || 0) / totalCount) * 100;
            const overduePercent = ((statsMap.OVERDUE?.count || 0) / totalCount) * 100;

            return (
              <>
                {draftPercent > 0 && (
                  <div
                    className="bg-gray-400 flex items-center justify-center text-white text-xs font-medium"
                    style={{ width: `${draftPercent}%` }}
                    title={`Draft: ${statsMap.DRAFT?.count || 0} (${draftPercent.toFixed(1)}%)`}
                  >
                    {draftPercent > 10 && `${draftPercent.toFixed(0)}%`}
                  </div>
                )}
                {sentPercent > 0 && (
                  <div
                    className="bg-blue-500 flex items-center justify-center text-white text-xs font-medium"
                    style={{ width: `${sentPercent}%` }}
                    title={`Sent: ${statsMap.SENT?.count || 0} (${sentPercent.toFixed(1)}%)`}
                  >
                    {sentPercent > 10 && `${sentPercent.toFixed(0)}%`}
                  </div>
                )}
                {paidPercent > 0 && (
                  <div
                    className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
                    style={{ width: `${paidPercent}%` }}
                    title={`Paid: ${statsMap.PAID?.count || 0} (${paidPercent.toFixed(1)}%)`}
                  >
                    {paidPercent > 10 && `${paidPercent.toFixed(0)}%`}
                  </div>
                )}
                {overduePercent > 0 && (
                  <div
                    className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
                    style={{ width: `${overduePercent}%` }}
                    title={`Overdue: ${statsMap.OVERDUE?.count || 0} (${overduePercent.toFixed(1)}%)`}
                  >
                    {overduePercent > 10 && `${overduePercent.toFixed(0)}%`}
                  </div>
                )}
              </>
            );
          })()}
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-600">
          <span>Draft: {statsMap.DRAFT?.count || 0}</span>
          <span>Sent: {statsMap.SENT?.count || 0}</span>
          <span>Paid: {statsMap.PAID?.count || 0}</span>
          <span>Overdue: {statsMap.OVERDUE?.count || 0}</span>
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
          {/* TODO: Add trend indicators when historical snapshots available */}
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Paid</h3>
          <p className="text-3xl font-bold mt-2 text-green-600">
            ${paidAmount.toLocaleString()}
          </p>
          <p className="text-sm text-green-600 mt-1">
            {statsMap.PAID?.count || 0} invoices
          </p>
          {/* Progress bar showing paid proportion */}
          <div className="w-full bg-gray-200 rounded-full h-1 mt-2">
            <div
              className="bg-green-600 h-1 rounded-full transition-all"
              style={{
                width: `${Math.min(100, (paidAmount / totalAmount) * 100)}%`,
              }}
              title={`${((paidAmount / totalAmount) * 100).toFixed(1)}% of total value`}
            ></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Pending</h3>
          <p className="text-3xl font-bold mt-2 text-yellow-600">
            ${pendingAmount.toLocaleString()}
          </p>
          <p className="text-sm text-yellow-600 mt-1">
            {(statsMap.SENT?.count || 0) + (statsMap.DRAFT?.count || 0)} invoices
          </p>
          {/* Progress bar showing pending proportion */}
          <div className="w-full bg-gray-200 rounded-full h-1 mt-2">
            <div
              className="bg-yellow-500 h-1 rounded-full transition-all"
              style={{
                width: `${Math.min(100, (pendingAmount / totalAmount) * 100)}%`,
              }}
              title={`${((pendingAmount / totalAmount) * 100).toFixed(1)}% of total value`}
            ></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Overdue</h3>
          <p className="text-3xl font-bold mt-2 text-red-600">
            ${overdueAmount.toLocaleString()}
          </p>
          <p className="text-sm text-red-600 mt-1">
            {statsMap.OVERDUE?.count || 0} invoices
          </p>
          {/* Progress bar showing overdue proportion */}
          <div className="w-full bg-gray-200 rounded-full h-1 mt-2">
            <div
              className="bg-red-600 h-1 rounded-full transition-all"
              style={{
                width: `${Math.min(100, (overdueAmount / totalAmount) * 100)}%`,
              }}
              title={`${((overdueAmount / totalAmount) * 100).toFixed(1)}% of total value`}
            ></div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          {/* Search */}
          <form method="GET" className="flex-1 min-w-[200px]">
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
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300"
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
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300"
              }`}
            >
              QuickBooks ({qbInvoices})
            </Link>
          </div>
        </div>

        {/* Mobile Filter Button */}
        <div className="md:hidden border-t pt-4">
          <MobileFilterModal
            currentFilters={{
              dueDateFrom: searchParams.dueDateFrom,
              dueDateTo: searchParams.dueDateTo,
              minAmount: searchParams.minAmount,
              maxAmount: searchParams.maxAmount,
              paymentMethod: searchParams.paymentMethod,
            }}
            preserveParams={{
              search: search,
              source: source,
              status: searchParams.status || "",
              sortBy: sortBy !== "createdAt" ? sortBy : "",
              sortOrder: sortOrder !== "desc" ? sortOrder : "",
            }}
            filterType="invoices"
            activeFilterCount={activeFilterCount}
          />
        </div>

        {/* Advanced Filters (Desktop) */}
        <details className="hidden md:block border-t pt-4">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 flex items-center gap-2">
            <span>Advanced Filters</span>
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                {activeFilterCount}
              </span>
            )}
          </summary>
          <form method="GET" className="mt-4">
            {/* Preserve existing filters */}
            {search && <input type="hidden" name="search" value={search} />}
            {source && <input type="hidden" name="source" value={source} />}
            {searchParams.status && <input type="hidden" name="status" value={searchParams.status} />}
            {sortBy !== "createdAt" && <input type="hidden" name="sortBy" value={sortBy} />}
            {sortOrder !== "desc" && <input type="hidden" name="sortOrder" value={sortOrder} />}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date From
                </label>
                <input
                  type="date"
                  name="dueDateFrom"
                  defaultValue={searchParams.dueDateFrom}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date To
                </label>
                <input
                  type="date"
                  name="dueDateTo"
                  defaultValue={searchParams.dueDateTo}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Amount Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Amount ($)
                </label>
                <input
                  type="number"
                  name="minAmount"
                  defaultValue={searchParams.minAmount}
                  placeholder="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Amount ($)
                </label>
                <input
                  type="number"
                  name="maxAmount"
                  defaultValue={searchParams.maxAmount}
                  placeholder="Unlimited"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method
                </label>
                <select
                  name="paymentMethod"
                  defaultValue={searchParams.paymentMethod || ""}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All</option>
                  <option value="CARD">Card</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 mt-4">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-medium"
              >
                Apply Filters
              </button>
              <Link
                href="/dashboard/invoices"
                className="px-4 py-2 text-gray-700 hover:text-gray-900 transition"
              >
                Clear Filters
              </Link>
            </div>
          </form>
        </details>
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
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300"
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
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300"
              }`}
            >
              {status} ({data.count})
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Filter Chips */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-gray-500 uppercase">Quick Filters:</span>
        </div>
        <div className="flex md:flex-wrap gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 -mx-2 px-2">
          {(() => {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
            const weekFromNowStr = weekFromNow.toISOString().split('T')[0];
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

            const isOverdueActive = searchParams.status === "OVERDUE";
            const isDueThisWeekActive = searchParams.dueDateFrom === todayStr && searchParams.dueDateTo === weekFromNowStr;
            const isDueThisMonthActive = searchParams.dueDateFrom === monthStart && searchParams.dueDateTo === monthEnd;
            const isHighValueActive = searchParams.minAmount === "10000";
            const isFromQBActive = source === "quickbooks";

            return (
              <>
                {/* Overdue */}
                <Link
                  href={isOverdueActive ? "/dashboard/invoices" : `/dashboard/invoices?status=OVERDUE`}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition whitespace-nowrap snap-start ${
                    isOverdueActive
                      ? "bg-red-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300"
                  }`}
                >
                  Overdue
                </Link>

                {/* Due This Week */}
                <Link
                  href={isDueThisWeekActive ? "/dashboard/invoices" : `/dashboard/invoices?dueDateFrom=${todayStr}&dueDateTo=${weekFromNowStr}`}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition whitespace-nowrap snap-start ${
                    isDueThisWeekActive
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300"
                  }`}
                >
                  Due This Week
                </Link>

                {/* Due This Month */}
                <Link
                  href={isDueThisMonthActive ? "/dashboard/invoices" : `/dashboard/invoices?dueDateFrom=${monthStart}&dueDateTo=${monthEnd}`}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition whitespace-nowrap snap-start ${
                    isDueThisMonthActive
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300"
                  }`}
                >
                  Due This Month
                </Link>

                {/* High Value */}
                <Link
                  href={isHighValueActive ? "/dashboard/invoices" : `/dashboard/invoices?minAmount=10000`}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition whitespace-nowrap snap-start ${
                    isHighValueActive
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300"
                  }`}
                >
                  High Value (&gt;$10k)
                </Link>

                {/* From QuickBooks */}
                <Link
                  href={isFromQBActive ? "/dashboard/invoices" : `/dashboard/invoices?source=quickbooks`}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition whitespace-nowrap snap-start ${
                    isFromQBActive
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300"
                  }`}
                >
                  From QuickBooks
                </Link>
              </>
            );
          })()}
        </div>
      </div>

      {/* Invoice List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide momentum-scroll">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <Link
                    href={buildSortUrl("invoiceNumber")}
                    className="hover:text-gray-900 cursor-pointer"
                  >
                    Invoice #<SortIndicator field="invoiceNumber" />
                  </Link>
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Customer
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <Link
                    href={buildSortUrl("amount")}
                    className="hover:text-gray-900 cursor-pointer"
                  >
                    Amount<SortIndicator field="amount" />
                  </Link>
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <Link
                    href={buildSortUrl("dueDate")}
                    className="hover:text-gray-900 cursor-pointer"
                  >
                    Due Date<SortIndicator field="dueDate" />
                  </Link>
                </th>
                <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Source
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <Link
                    href={buildSortUrl("status")}
                    className="hover:text-gray-900 cursor-pointer"
                  >
                    Status<SortIndicator field="status" />
                  </Link>
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
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
                  <tr key={invoice.id} className="md:hover:bg-gray-50 active:bg-gray-100 transition-colors">
                    <td className="px-4 md:px-6 py-4 md:py-4 whitespace-nowrap">
                      <Link
                        href={`/dashboard/invoices/${invoice.id}`}
                        className="text-blue-600 hover:underline font-medium min-h-[44px] flex items-center"
                      >
                        {invoice.invoiceNumber || invoice.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/dashboard/customers/${invoice.customer.id}`}
                        className="text-blue-600 hover:underline min-h-[44px] flex flex-col justify-center"
                      >
                        <div>{invoice.customer.name}</div>
                        <div className="text-xs text-gray-500 md:block hidden">
                          {invoice.customer.email}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap font-medium">
                      ${Number(invoice.amount).toLocaleString()}
                    </td>
                    <td
                      className={`px-4 md:px-6 py-4 whitespace-nowrap text-sm ${
                        isOverdue ? "text-red-600 font-medium" : "text-gray-500"
                      }`}
                    >
                      {new Date(invoice.dueDate).toLocaleDateString()}
                      {isOverdue && (
                        <div className="text-xs text-red-500">Overdue</div>
                      )}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
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
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
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
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/invoices/${invoice.id}`}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          View
                        </Link>
                        {(() => {
                          // Check if user can edit this invoice
                          const isPaidOrVoid = invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.VOID;
                          const canEditInvoice = (
                            userRole === "ADMIN" || 
                            userRole === "FINANCE" || 
                            (["COMMERCIAL", "SALES"].includes(userRole) && invoice.ownerId === userId)
                          ) && !isPaidOrVoid;

                          return canEditInvoice ? (
                            <Link
                              href={`/dashboard/invoices/${invoice.id}/edit`}
                              className="text-blue-600 hover:underline text-sm"
                            >
                              Edit
                            </Link>
                          ) : (
                            <span
                              className="text-gray-400 text-sm cursor-not-allowed"
                              title={
                                isPaidOrVoid
                                  ? "Cannot edit paid or voided invoices"
                                  : "You don't have permission to edit this invoice"
                              }
                            >
                              Edit
                            </span>
                          );
                        })()}
                        <DeleteInvoiceButton
                          invoiceId={invoice.id}
                          invoiceNumber={invoice.invoiceNumber || invoice.id.slice(0, 8)}
                          hasQuickbooksId={!!invoice.quickbooks_invoice_id}
                          userRole={userRole}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          </table>
        </div>

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
