import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CreditCard, Plus } from "lucide-react";

const ITEMS_PER_PAGE = 25;

type BadgeVariant = "success" | "warning" | "error" | "info" | "default";

function getPaymentMethodVariant(method: string | null): BadgeVariant {
  if (!method) return "default";
  switch (method.toUpperCase()) {
    case "CARD":
    case "CREDIT_CARD": return "info";
    case "BANK_TRANSFER":
    case "ACH": return "success";
    case "CASH": return "warning";
    default: return "default";
  }
}

/**
 * Dashboard de Payments
 *
 * Exibe lista de payments com filtering, search, e paginação
 */
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: {
    page?: string;
    search?: string;
    source?: string;
    sortBy?: string;
    sortOrder?: string;
    dateFrom?: string;
    dateTo?: string;
    minAmount?: string;
    maxAmount?: string;
    paymentMethod?: string;
    customerId?: string;
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
  const sortBy = searchParams.sortBy || "paymentDate";
  const sortOrder = (searchParams.sortOrder || "desc") as "asc" | "desc";

  // Valid sort fields
  const validSortFields = ["paymentDate", "amount", "customer", "paymentMethod"];
  const actualSortBy = validSortFields.includes(sortBy) ? sortBy : "paymentDate";

  // Build filter based on params
  const whereClause: any = {};

  if (search) {
    whereClause.OR = [
      { referenceNumber: { contains: search, mode: "insensitive" } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { customer: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  if (source === "quickbooks") {
    whereClause.quickbooks_payment_id = { not: null };
  } else if (source === "manual") {
    whereClause.quickbooks_payment_id = null;
    whereClause.stripe_payment_id = null;
  }

  // Advanced filters
  if (searchParams.dateFrom) {
    whereClause.paymentDate = {
      ...whereClause.paymentDate,
      gte: new Date(searchParams.dateFrom),
    };
  }

  if (searchParams.dateTo) {
    whereClause.paymentDate = {
      ...whereClause.paymentDate,
      lte: new Date(searchParams.dateTo),
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

  if (searchParams.customerId) {
    whereClause.customerId = searchParams.customerId;
  }

  // Get total count
  const totalPayments = await prisma.payment.count({ where: whereClause });
  const totalPages = Math.ceil(totalPayments / ITEMS_PER_PAGE);

  // Determine orderBy based on sortBy
  let orderBy: any = {};
  if (actualSortBy === "customer") {
    orderBy = { customer: { name: sortOrder } };
  } else {
    orderBy = { [actualSortBy]: sortOrder };
  }

  // Buscar payments with pagination and sorting
  const payments = await prisma.payment.findMany({
    where: whereClause,
    skip: (currentPage - 1) * ITEMS_PER_PAGE,
    take: ITEMS_PER_PAGE,
    orderBy,
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          amount: true,
        },
      },
    },
  });

  // Global statistics
  const stats = await prisma.payment.aggregate({
    _count: { id: true },
    _sum: { amount: true },
  });

  const totalPaymentsAmount = Number(stats._sum.amount || 0);
  const averagePayment = stats._count.id > 0 ? totalPaymentsAmount / stats._count.id : 0;

  // QuickBooks synced count
  const qbPayments = await prisma.payment.count({
    where: { quickbooks_payment_id: { not: null } },
  });

  const manualPayments = await prisma.payment.count({
    where: {
      quickbooks_payment_id: null,
      stripe_payment_id: null,
    },
  });

  // This month total
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthTotal = await prisma.payment.aggregate({
    where: {
      paymentDate: {
        gte: firstDayOfMonth,
      },
    },
    _sum: { amount: true },
  });

  const thisMonthAmount = Number(thisMonthTotal._sum.amount || 0);

  // Build search params for pagination
  const paginationParams: Record<string, string> = {};
  if (search) paginationParams.search = search;
  if (source) paginationParams.source = source;
  if (sortBy !== "paymentDate") paginationParams.sortBy = sortBy;
  if (sortOrder !== "desc") paginationParams.sortOrder = sortOrder;
  if (searchParams.dateFrom) paginationParams.dateFrom = searchParams.dateFrom;
  if (searchParams.dateTo) paginationParams.dateTo = searchParams.dateTo;
  if (searchParams.minAmount) paginationParams.minAmount = searchParams.minAmount;
  if (searchParams.maxAmount) paginationParams.maxAmount = searchParams.maxAmount;
  if (searchParams.paymentMethod) paginationParams.paymentMethod = searchParams.paymentMethod;
  if (searchParams.customerId) paginationParams.customerId = searchParams.customerId;

  // Count active filters
  const activeFilterCount = [
    searchParams.dateFrom,
    searchParams.dateTo,
    searchParams.minAmount,
    searchParams.maxAmount,
    searchParams.paymentMethod,
    searchParams.customerId,
  ].filter(Boolean).length;

  // Helper function to build sort URL
  const buildSortUrl = (field: string) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (source) params.set("source", source);
    params.set("sortBy", field);
    params.set("sortOrder", sortBy === field && sortOrder === "asc" ? "desc" : "asc");
    return `/dashboard/payments?${params.toString()}`;
  };

  // Sort indicator component
  const SortIndicator = ({ field }: { field: string }) => {
    if (sortBy !== field) return null;
    return sortOrder === "asc" ? " ↑" : " ↓";
  };

  // Calculate month-over-month change for Total Amount
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const lastMonthTotal = await prisma.payment.aggregate({
    where: {
      paymentDate: {
        gte: lastMonthStart,
        lte: lastMonthEnd,
      },
    },
    _sum: { amount: true },
  });
  const lastMonthAmount = Number(lastMonthTotal._sum.amount || 0);
  const totalChangePercent = lastMonthAmount > 0 
    ? (((thisMonthAmount - lastMonthAmount) / lastMonthAmount) * 100).toFixed(1)
    : "0";
  const totalTrend = thisMonthAmount >= lastMonthAmount ? "up" : "down";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 md:p-8 max-w-7xl">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-display font-semibold text-gray-900">Payments</h1>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            label="Total Payments"
            value={`$${totalPaymentsAmount.toLocaleString()}`}
            change={`${totalChangePercent}%`}
            trend={totalTrend as "up" | "down"}
          />
          <StatCard
            label="Total Transactions"
            value={stats._count.id.toString()}
            description={`${qbPayments} from QuickBooks`}
          />
          <StatCard
            label="Average Payment"
            value={`$${averagePayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            description="Per transaction"
          />
          <StatCard
            label="This Month"
            value={`$${thisMonthAmount.toLocaleString()}`}
            description={now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          />
        </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          {/* Search */}
          <form method="GET" className="flex-1 min-w-[200px]">
            {source && <input type="hidden" name="source" value={source} />}
            {searchParams.paymentMethod && (
              <input type="hidden" name="paymentMethod" value={searchParams.paymentMethod} />
            )}
            <div className="relative">
              <input
                type="text"
                name="search"
                defaultValue={search}
                placeholder="Search by transaction ref, customer name, or email..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
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
            <span className="text-sm font-display font-medium text-gray-700">Source:</span>
            <Link
              href={`/dashboard/payments${search ? `?search=${search}` : ""}`}
              className={`px-4 py-2 rounded-lg text-sm font-display font-medium transition-colors ${
                !source
                  ? "bg-primary-600 text-white"
                  : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              All
            </Link>
            <Link
              href={`/dashboard/payments?source=quickbooks${
                search ? `&search=${search}` : ""
              }`}
              className={`px-4 py-2 rounded-lg text-sm font-display font-medium transition-colors ${
                source === "quickbooks"
                  ? "bg-primary-600 text-white"
                  : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              QuickBooks ({qbPayments})
            </Link>
            <Link
              href={`/dashboard/payments?source=manual${
                search ? `&search=${search}` : ""
              }`}
              className={`px-4 py-2 rounded-lg text-sm font-display font-medium transition-colors ${
                source === "manual"
                  ? "bg-primary-600 text-white"
                  : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              Manual ({manualPayments})
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
            {sortBy !== "paymentDate" && <input type="hidden" name="sortBy" value={sortBy} />}
            {sortOrder !== "desc" && <input type="hidden" name="sortOrder" value={sortOrder} />}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Date From
                </label>
                <input
                  type="date"
                  name="dateFrom"
                  defaultValue={searchParams.dateFrom}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Date To
                </label>
                <input
                  type="date"
                  name="dateTo"
                  defaultValue={searchParams.dateTo}
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
                  <option value="stripe">Stripe</option>
                  <option value="quickbooks">QuickBooks</option>
                  <option value="manual">Manual</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="other">Other</option>
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
                href="/dashboard/payments"
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
            const todayStr = today.toISOString().split("T")[0];
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            const weekAgoStr = weekAgo.toISOString().split("T")[0];
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
              .toISOString()
              .split("T")[0];
            const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
              .toISOString()
              .split("T")[0];
            const last30DaysStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0];

            const isTodayActive = searchParams.dateFrom === todayStr && searchParams.dateTo === todayStr;
            const isThisWeekActive = searchParams.dateFrom === weekAgoStr && searchParams.dateTo === todayStr;
            const isThisMonthActive = searchParams.dateFrom === monthStart && searchParams.dateTo === monthEnd;
            const isLast30DaysActive = searchParams.dateFrom === last30DaysStart && searchParams.dateTo === todayStr;
            const isHighValueActive = searchParams.minAmount === "5000";
            const isFromQBActive = source === "quickbooks";
            const isManualActive = source === "manual";

            return (
              <>
                {/* Today */}
                <Link
                  href={
                    isTodayActive
                      ? "/dashboard/payments"
                      : `/dashboard/payments?dateFrom=${todayStr}&dateTo=${todayStr}`
                  }
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    isTodayActive
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Today
                </Link>

                {/* This Week */}
                <Link
                  href={
                    isThisWeekActive
                      ? "/dashboard/payments"
                      : `/dashboard/payments?dateFrom=${weekAgoStr}&dateTo=${todayStr}`
                  }
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    isThisWeekActive
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  This Week
                </Link>

                {/* This Month */}
                <Link
                  href={
                    isThisMonthActive
                      ? "/dashboard/payments"
                      : `/dashboard/payments?dateFrom=${monthStart}&dateTo=${monthEnd}`
                  }
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    isThisMonthActive
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  This Month
                </Link>

                {/* Last 30 Days */}
                <Link
                  href={
                    isLast30DaysActive
                      ? "/dashboard/payments"
                      : `/dashboard/payments?dateFrom=${last30DaysStart}&dateTo=${todayStr}`
                  }
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    isLast30DaysActive
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Last 30 Days
                </Link>

                {/* High Value */}
                <Link
                  href={
                    isHighValueActive
                      ? "/dashboard/payments"
                      : `/dashboard/payments?minAmount=5000`
                  }
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    isHighValueActive
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  High Value (&gt;$5k)
                </Link>

                {/* QuickBooks Synced */}
                <Link
                  href={
                    isFromQBActive
                      ? "/dashboard/payments"
                      : `/dashboard/payments?source=quickbooks`
                  }
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    isFromQBActive
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  QuickBooks Synced
                </Link>

                {/* Manual Entry */}
                <Link
                  href={
                    isManualActive
                      ? "/dashboard/payments"
                      : `/dashboard/payments?source=manual`
                  }
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    isManualActive
                      ? "bg-gray-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Manual Entry
                </Link>
              </>
            );
          })()}
        </div>
      </div>

      {/* Payment List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                  <Link
                    href={buildSortUrl("paymentDate")}
                    className="hover:text-gray-900 cursor-pointer"
                  >
                    Date<SortIndicator field="paymentDate" />
                  </Link>
                </th>
                <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                  Transaction Ref
                </th>
                <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                  <Link
                    href={buildSortUrl("customer")}
                    className="hover:text-gray-900 cursor-pointer"
                  >
                    Customer<SortIndicator field="customer" />
                  </Link>
                </th>
                <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                  <Link
                    href={buildSortUrl("amount")}
                    className="hover:text-gray-900 cursor-pointer"
                  >
                    Amount<SortIndicator field="amount" />
                  </Link>
                </th>
                <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                  <Link
                    href={buildSortUrl("paymentMethod")}
                    className="hover:text-gray-900 cursor-pointer"
                  >
                    Method<SortIndicator field="paymentMethod" />
                  </Link>
                </th>
                <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                  Source
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="py-12">
                      <EmptyState
                        icon={<CreditCard className="h-12 w-12" />}
                        title="No payments found"
                        description="Try adjusting your filters or add a new payment"
                      />
                    </div>
                  </td>
                </tr>
              ) : (
                payments.map((payment) => {
                  const isQBSynced = !!payment.quickbooks_payment_id;
                  const isStripeSynced = !!payment.stripe_payment_id;
                  const isManual = !isQBSynced && !isStripeSynced;

                  // Payment method badge variant
                  const methodVariant = payment.paymentMethod?.toLowerCase().includes("card") || payment.paymentMethod === "stripe" 
                    ? "info" 
                    : payment.paymentMethod?.toLowerCase().includes("bank") || payment.paymentMethod?.toLowerCase().includes("transfer")
                    ? "success"
                    : payment.paymentMethod?.toLowerCase().includes("cash")
                    ? "warning"
                    : "default";

                  return (
                    <tr
                      key={payment.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => (window.location.href = `/dashboard/payments/${payment.id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-display text-gray-900 tabular-nums">
                        {format(new Date(payment.paymentDate), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-gray-700">
                            {payment.referenceNumber || payment.id.slice(0, 8)}
                          </span>
                          {payment.referenceNumber && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(payment.referenceNumber!);
                              }}
                              className="text-gray-400 hover:text-gray-600"
                              title="Copy reference"
                            >
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
                                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <Link
                            href={`/dashboard/customers/${payment.customer.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm font-display font-medium text-primary-600 hover:text-primary-700"
                          >
                            {payment.customer.name}
                          </Link>
                          <span className="text-xs text-gray-500">{payment.customer.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link
                          href={`/dashboard/invoices/${payment.invoice.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm font-display font-medium text-primary-600 hover:text-primary-700"
                        >
                          {payment.invoice.invoiceNumber || payment.invoice.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-display font-semibold text-gray-900 tabular-nums">
                        ${Number(payment.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={getPaymentMethodVariant(payment.paymentMethod)}>
                          {payment.paymentMethod || "N/A"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isQBSynced && <Badge variant="success">QuickBooks</Badge>}
                        {isStripeSynced && <Badge variant="info">Stripe</Badge>}
                        {isManual && <Badge variant="default">Manual</Badge>}
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
          totalItems={totalPayments}
          itemsPerPage={ITEMS_PER_PAGE}
          baseUrl="/dashboard/payments"
          searchParams={paginationParams}
        />
      </div>
      </div>
    </div>
  );
}
