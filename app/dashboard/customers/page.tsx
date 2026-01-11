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

  // Get total count
  const totalCustomers = await prisma.customer.count({ where: whereClause });
  const totalPages = Math.ceil(totalCustomers / ITEMS_PER_PAGE);

  // Buscar customers with pagination and sorting
  const customers = await prisma.customer.findMany({
    where: whereClause,
    skip: (currentPage - 1) * ITEMS_PER_PAGE,
    take: ITEMS_PER_PAGE,
    orderBy: { [actualSortBy]: sortOrder },
    include: {
      deals: {
        take: 3,
        orderBy: { createdAt: "desc" },
      },
      invoices: {
        take: 3,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          amount: true,
        },
      },
    },
  });

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

  // Build search params for pagination
  const paginationParams: Record<string, string> = {};
  if (search) paginationParams.search = search;
  if (source) paginationParams.source = source;
  if (sortBy !== "createdAt") paginationParams.sortBy = sortBy;
  if (sortOrder !== "desc") paginationParams.sortOrder = sortOrder;

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Customers</h3>
          <p className="text-3xl font-bold mt-2">{stats._count.id}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">From QuickBooks</h3>
          <p className="text-3xl font-bold mt-2 text-green-600">{qbCustomers}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">From Pipedrive</h3>
          <p className="text-3xl font-bold mt-2 text-blue-600">{pipedriveCustomers}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">With Invoices</h3>
          <p className="text-3xl font-bold mt-2">{customersWithInvoices}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
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
                      <span className="text-gray-900">
                        {paidInvoices}/{totalInvoices}
                      </span>
                      <span className="text-gray-500 ml-1">paid</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {totalBalance > 0 ? (
                        <span className="text-red-600 font-medium">
                          ${totalBalance.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-green-600">$0</span>
                      )}
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
