import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Pagination } from "@/components/ui/pagination";

const ITEMS_PER_PAGE = 25;

/**
 * Dashboard de Customers
 *
 * Exibe lista de customers com paginação e ordenação
 */
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: {
    page?: string;
    search?: string;
    source?: string;
    sortBy?: string;
    sortOrder?: string;
    balanceStatus?: string;
    minInvoices?: string;
    maxInvoices?: string;
    minTotalInvoiced?: string;
    maxTotalInvoiced?: string;
    createdFrom?: string;
    createdTo?: string;
  };
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  const currentPage = Math.max(1, parseInt(searchParams.page || "1"));
  const search = searchParams.search || "";
  const source = searchParams.source || "";
  const sortBy = searchParams.sortBy || "createdAt";
  const sortOrder = (searchParams.sortOrder || "desc") as "asc" | "desc";

  // Valid sort fields
  const validSortFields = ["name", "email", "createdAt", "updatedAt"];
  const actualSortBy = validSortFields.includes(sortBy) ? sortBy : "createdAt";

  // Build where clause
  const whereClause: any = {};

  if (search) {
    whereClause.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }

  if (source === "quickbooks") {
    whereClause.quickbooks_id = { not: null };
  } else if (source === "pipedrive") {
    whereClause.pipedrive_id = { not: null };
  }

  // Advanced filters
  if (searchParams.balanceStatus === "no-balance") {
    whereClause.OR = [
      { qbBalance: { equals: 0 } },
      { qbBalance: null },
    ];
  } else if (searchParams.balanceStatus === "has-balance") {
    whereClause.qbBalance = { gt: 0 };
  }

  if (searchParams.minTotalInvoiced) {
    whereClause.qbTotalInvoiced = {
      ...whereClause.qbTotalInvoiced,
      gte: parseFloat(searchParams.minTotalInvoiced),
    };
  }

  if (searchParams.maxTotalInvoiced) {
    whereClause.qbTotalInvoiced = {
      ...whereClause.qbTotalInvoiced,
      lte: parseFloat(searchParams.maxTotalInvoiced),
    };
  }

  if (searchParams.createdFrom) {
    whereClause.createdAt = {
      ...whereClause.createdAt,
      gte: new Date(searchParams.createdFrom),
    };
  }

  if (searchParams.createdTo) {
    whereClause.createdAt = {
      ...whereClause.createdAt,
      lte: new Date(searchParams.createdTo),
    };
  }

  // Buscar customers with pagination and sorting
  let customers = await prisma.customer.findMany({
    where: whereClause,
    orderBy: { [actualSortBy]: sortOrder },
    include: {
      deals: {
        take: 3,
        orderBy: { createdAt: "desc" },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          amount: true,
          dueDate: true,
        },
      },
    },
  });

  // Apply filters that require in-memory filtering
  const today = new Date();

  // Filter by overdue balance (requires checking invoices)
  if (searchParams.balanceStatus === "overdue-balance") {
    customers = customers.filter((customer) =>
      customer.invoices.some(
        (invoice) =>
          invoice.status !== "PAID" &&
          invoice.status !== "VOID" &&
          new Date(invoice.dueDate) < today
      )
    );
  }

  // Filter by invoice count
  if (searchParams.minInvoices || searchParams.maxInvoices) {
    customers = customers.filter((customer) => {
      const count = customer.invoices.length;
      const minOk = !searchParams.minInvoices || count >= parseInt(searchParams.minInvoices);
      const maxOk = !searchParams.maxInvoices || count <= parseInt(searchParams.maxInvoices);
      return minOk && maxOk;
    });
  }

  // Calculate pagination after filtering
  const totalCustomers = customers.length;
  const totalPages = Math.ceil(totalCustomers / ITEMS_PER_PAGE);
  customers = customers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Statistics
  const stats = await prisma.customer.aggregate({
    _count: { id: true },
  });

  const qbCustomers = await prisma.customer.count({
    where: { quickbooks_id: { not: null } },
  });

  const pipedriveCustomers = await prisma.customer.count({
    where: { pipedrive_id: { not: null } },
  });

  const customersWithInvoices = await prisma.customer.count({
    where: { invoices: { some: {} } },
  });

  // Calculate customers with overdue invoices
  const allCustomersWithInvoices = await prisma.customer.findMany({
    where: { invoices: { some: {} } },
    include: {
      invoices: {
        select: {
          status: true,
          dueDate: true,
        },
      },
    },
  });

  const customersWithOverdue = allCustomersWithInvoices.filter((customer) =>
    customer.invoices.some(
      (invoice) =>
        invoice.status !== "PAID" &&
        invoice.status !== "VOID" &&
        new Date(invoice.dueDate) < today
    )
  ).length;

  // Build search params for pagination
  const paginationParams: Record<string, string> = {};
  if (search) paginationParams.search = search;
  if (source) paginationParams.source = source;
  if (sortBy !== "createdAt") paginationParams.sortBy = sortBy;
  if (sortOrder !== "desc") paginationParams.sortOrder = sortOrder;
  if (searchParams.balanceStatus) paginationParams.balanceStatus = searchParams.balanceStatus;
  if (searchParams.minInvoices) paginationParams.minInvoices = searchParams.minInvoices;
  if (searchParams.maxInvoices) paginationParams.maxInvoices = searchParams.maxInvoices;
  if (searchParams.minTotalInvoiced) paginationParams.minTotalInvoiced = searchParams.minTotalInvoiced;
  if (searchParams.maxTotalInvoiced) paginationParams.maxTotalInvoiced = searchParams.maxTotalInvoiced;
  if (searchParams.createdFrom) paginationParams.createdFrom = searchParams.createdFrom;
  if (searchParams.createdTo) paginationParams.createdTo = searchParams.createdTo;

  // Count active filters
  const activeFilterCount = [
    searchParams.balanceStatus,
    searchParams.minInvoices,
    searchParams.maxInvoices,
    searchParams.minTotalInvoiced,
    searchParams.maxTotalInvoiced,
    searchParams.createdFrom,
    searchParams.createdTo,
  ].filter(Boolean).length;

  // Helper function to build sort URL
  const buildSortUrl = (field: string) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (source) params.set("source", source);
    params.set("sortBy", field);
    params.set("sortOrder", sortBy === field && sortOrder === "asc" ? "desc" : "asc");
    return `/dashboard/customers?${params.toString()}`;
  };

  // Sort indicator component
  const SortIndicator = ({ field }: { field: string }) => {
    if (sortBy !== field) return null;
    return sortOrder === "asc" ? " ↑" : " ↓";
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Customers</h1>
        <Link
          href="/dashboard/customers/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          Add Customer
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <h3 className="text-sm font-medium text-gray-500">Total Customers</h3>
          <p className="text-3xl font-bold mt-2">{stats._count.id}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <h3 className="text-sm font-medium text-gray-500">From QuickBooks</h3>
          <p className="text-3xl font-bold mt-2 text-green-600">{qbCustomers}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <h3 className="text-sm font-medium text-gray-500">From Pipedrive</h3>
          <p className="text-3xl font-bold mt-2 text-blue-600">{pipedriveCustomers}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500">
          <h3 className="text-sm font-medium text-gray-500">With Invoices</h3>
          <p className="text-3xl font-bold mt-2 text-purple-600">{customersWithInvoices}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
          <h3 className="text-sm font-medium text-gray-500">With Overdue</h3>
          <p className="text-3xl font-bold mt-2 text-red-600">{customersWithOverdue}</p>
          {customersWithOverdue > 0 && (
            <p className="text-xs text-red-600 mt-1">⚠️ Needs attention</p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          {/* Search */}
          <form method="GET" className="flex-1 min-w-[200px]">
            <input type="hidden" name="source" value={source} />
            <div className="relative">
              <input
                type="text"
                name="search"
                defaultValue={search}
                placeholder="Search by name, email, or phone..."
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
              href={`/dashboard/customers${search ? `?search=${search}` : ""}`}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                !source
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All
            </Link>
            <Link
              href={`/dashboard/customers?source=quickbooks${search ? `&search=${search}` : ""}`}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                source === "quickbooks"
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              QuickBooks ({qbCustomers})
            </Link>
            <Link
              href={`/dashboard/customers?source=pipedrive${search ? `&search=${search}` : ""}`}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                source === "pipedrive"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Pipedrive ({pipedriveCustomers})
            </Link>
          </div>
        </div>

        {/* Advanced Filters */}
        <details className="border-t pt-4">
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
            {sortBy !== "createdAt" && <input type="hidden" name="sortBy" value={sortBy} />}
            {sortOrder !== "desc" && <input type="hidden" name="sortOrder" value={sortOrder} />}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Balance Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Balance Status
                </label>
                <select
                  name="balanceStatus"
                  defaultValue={searchParams.balanceStatus || ""}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All</option>
                  <option value="no-balance">No Balance</option>
                  <option value="has-balance">Has Balance</option>
                  <option value="overdue-balance">Overdue Balance</option>
                </select>
              </div>

              {/* Invoice Count Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Invoices
                </label>
                <input
                  type="number"
                  name="minInvoices"
                  defaultValue={searchParams.minInvoices}
                  placeholder="0"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Invoices
                </label>
                <input
                  type="number"
                  name="maxInvoices"
                  defaultValue={searchParams.maxInvoices}
                  placeholder="Unlimited"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Total Invoiced Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Total Invoiced ($)
                </label>
                <input
                  type="number"
                  name="minTotalInvoiced"
                  defaultValue={searchParams.minTotalInvoiced}
                  placeholder="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Total Invoiced ($)
                </label>
                <input
                  type="number"
                  name="maxTotalInvoiced"
                  defaultValue={searchParams.maxTotalInvoiced}
                  placeholder="Unlimited"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Created Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Created From
                </label>
                <input
                  type="date"
                  name="createdFrom"
                  defaultValue={searchParams.createdFrom}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Created To
                </label>
                <input
                  type="date"
                  name="createdTo"
                  defaultValue={searchParams.createdTo}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
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
                href="/dashboard/customers"
                className="px-4 py-2 text-gray-700 hover:text-gray-900 transition"
              >
                Clear Filters
              </Link>
            </div>
          </form>
        </details>
      </div>

      {/* Quick Filter Chips */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-gray-500 uppercase">Quick Filters:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {(() => {
            const today = new Date();
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

            const isOverdueActive = searchParams.balanceStatus === "overdue-balance";
            const isHighBalanceActive = searchParams.minTotalInvoiced === "5000";
            const isNoInvoicesActive = searchParams.maxInvoices === "0";
            const isActiveThisMonthActive = searchParams.createdFrom === monthStart && searchParams.createdTo === monthEnd;
            const isFromQBOnlyActive = source === "quickbooks";

            return (
              <>
                {/* Has Overdue Invoices */}
                <Link
                  href={isOverdueActive ? "/dashboard/customers" : `/dashboard/customers?balanceStatus=overdue-balance`}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    isOverdueActive
                      ? "bg-red-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Has Overdue Invoices
                </Link>

                {/* High Balance */}
                <Link
                  href={isHighBalanceActive ? "/dashboard/customers" : `/dashboard/customers?minTotalInvoiced=5000`}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    isHighBalanceActive
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  High Balance (&gt;$5k)
                </Link>

                {/* No Invoices */}
                <Link
                  href={isNoInvoicesActive ? "/dashboard/customers" : `/dashboard/customers?maxInvoices=0`}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    isNoInvoicesActive
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  No Invoices
                </Link>

                {/* Active This Month */}
                <Link
                  href={isActiveThisMonthActive ? "/dashboard/customers" : `/dashboard/customers?createdFrom=${monthStart}&createdTo=${monthEnd}`}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    isActiveThisMonthActive
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Active This Month
                </Link>

                {/* From QuickBooks Only */}
                <Link
                  href={isFromQBOnlyActive ? "/dashboard/customers" : `/dashboard/customers?source=quickbooks`}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    isFromQBOnlyActive
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  From QuickBooks Only
                </Link>
              </>
            );
          })()}
        </div>
      </div>

      {/* Customer List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <Link
                  href={buildSortUrl("name")}
                  className="hover:text-gray-900 cursor-pointer"
                >
                  Name<SortIndicator field="name" />
                </Link>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <Link
                  href={buildSortUrl("email")}
                  className="hover:text-gray-900 cursor-pointer"
                >
                  Email<SortIndicator field="email" />
                </Link>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Source
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Invoices
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Balance
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <Link
                  href={buildSortUrl("createdAt")}
                  className="hover:text-gray-900 cursor-pointer"
                >
                  Created<SortIndicator field="createdAt" />
                </Link>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  No customers found
                </td>
              </tr>
            ) : (
              customers.map((customer) => {
                const totalInvoices = customer.invoices.length;
                const paidInvoices = customer.invoices.filter(
                  (i) => i.status === "PAID"
                ).length;
                const totalBalance = customer.invoices
                  .filter((i) => i.status !== "PAID" && i.status !== "VOID")
                  .reduce((sum, i) => sum + Number(i.amount), 0);

                // Calculate overdue invoices
                const today = new Date();
                const overdueInvoices = customer.invoices.filter(
                  (i) =>
                    i.status !== "PAID" &&
                    i.status !== "VOID" &&
                    new Date(i.dueDate) < today
                );
                const overdueCount = overdueInvoices.length;
                const overdueAmount = overdueInvoices.reduce(
                  (sum, i) => sum + Number(i.amount),
                  0
                );

                return (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/dashboard/customers/${customer.id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {customer.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {customer.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {customer.phone || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-1">
                        {customer.quickbooks_id && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                            QB
                          </span>
                        )}
                        {customer.pipedrive_id && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                            PD
                          </span>
                        )}
                        {!customer.quickbooks_id && !customer.pipedrive_id && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                            Manual
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex flex-col">
                        <span className="text-gray-900">
                          {paidInvoices}/{totalInvoices} <span className="text-gray-500">paid</span>
                        </span>
                        {overdueCount > 0 && (
                          <span className="text-red-600 text-xs font-medium mt-1">
                            ⚠️ {overdueCount} overdue
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex flex-col">
                        {totalBalance > 0 ? (
                          <>
                            <span className="text-red-600 font-medium">
                              ${totalBalance.toLocaleString()}
                            </span>
                            {overdueAmount > 0 && (
                              <span className="text-red-700 text-xs font-bold mt-1">
                                ${overdueAmount.toLocaleString()} overdue
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-green-600">$0</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(customer.createdAt).toLocaleDateString()}
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
          totalItems={totalCustomers}
          itemsPerPage={ITEMS_PER_PAGE}
          baseUrl="/dashboard/customers"
          searchParams={paginationParams}
        />
      </div>
    </div>
  );
}
