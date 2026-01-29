import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InvoiceStatus } from "@prisma/client";
import Link from "next/link";
import { format } from "date-fns";
import { Pagination } from "@/components/ui/pagination";
import { MobileFilterModal } from "@/components/dashboard/mobile-filter-modal";
import { DeleteInvoiceButton } from "@/components/invoices/delete-invoice-button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText, TrendingUp, AlertCircle } from "lucide-react";

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

  // Helper function to get status badge variant
  function getStatusVariant(status: InvoiceStatus): "success" | "warning" | "error" | "info" | "default" {
    switch (status) {
      case "PAID": return "success";
      case "SENT": return "info";
      case "OVERDUE": return "error";
      case "PARTIALLY_PAID": return "warning";
      default: return "default";
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-display font-semibold text-gray-900">
              Invoices
            </h1>
            <Link
              href="/dashboard/invoices/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white text-sm font-display font-semibold rounded-lg hover:bg-primary-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Invoice
            </Link>
          </div>
        </div>

        {/* Summary Stats - KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            label="Total Invoices"
            value={Object.values(statsMap).reduce((s, v) => s + v.count, 0).toString()}
            description={`${qbInvoices} from QuickBooks`}
          />
          <StatCard
            label="Paid"
            value={`$${paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            change={totalAmount > 0 ? `${((paidAmount / totalAmount) * 100).toFixed(1)}% of total` : undefined}
            trend="up"
            icon={<TrendingUp className="w-5 h-5" />}
            description={`${statsMap.PAID?.count || 0} invoices`}
          />
          <StatCard
            label="Pending"
            value={`$${pendingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            change={totalAmount > 0 ? `${((pendingAmount / totalAmount) * 100).toFixed(1)}% of total` : undefined}
            description={`${(statsMap.SENT?.count || 0) + (statsMap.DRAFT?.count || 0)} invoices`}
          />
          <StatCard
            label="Overdue"
            value={`$${overdueAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            change={totalAmount > 0 ? `${((overdueAmount / totalAmount) * 100).toFixed(1)}% of total` : undefined}
            trend="down"
            icon={<AlertCircle className="w-5 h-5" />}
            description={`${statsMap.OVERDUE?.count || 0} invoices`}
          />
        </div>

      {/* Filter Bar - Simplified like mockup */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Left side - Filter dropdowns */}
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Status Filter Dropdown */}
            <div className="min-w-[160px]">
              <select
                value={searchParams.status || ""}
                onChange={(e) => {
                  const params = new URLSearchParams();
                  if (search) params.set("search", search);
                  if (source) params.set("source", source);
                  if (e.target.value) params.set("status", e.target.value);
                  window.location.href = `/dashboard/invoices${params.toString() ? '?' + params.toString() : ''}`;
                }}
                className="w-full px-4 py-2 bg-white border border-gray-200 text-sm font-display font-medium text-gray-700 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              >
                <option value="">All Status</option>
                {Object.entries(statsMap).map(([status, data]) => (
                  <option key={status} value={status}>
                    {status} ({data.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Quick Filter */}
            <div className="min-w-[160px]">
              <select
                value={(() => {
                  const today = new Date();
                  const todayStr = today.toISOString().split('T')[0];
                  const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
                  
                  if (searchParams.dueDateFrom === todayStr && searchParams.dueDateTo === weekFromNow) return "week";
                  if (searchParams.dueDateFrom === monthStart && searchParams.dueDateTo === monthEnd) return "month";
                  return "";
                })()}
                onChange={(e) => {
                  const params = new URLSearchParams();
                  if (search) params.set("search", search);
                  if (source) params.set("source", source);
                  if (searchParams.status) params.set("status", searchParams.status);
                  
                  if (e.target.value === "week") {
                    const today = new Date();
                    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
                    params.set("dueDateFrom", today.toISOString().split('T')[0]);
                    params.set("dueDateTo", weekFromNow.toISOString().split('T')[0]);
                  } else if (e.target.value === "month") {
                    const today = new Date();
                    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    params.set("dueDateFrom", monthStart.toISOString().split('T')[0]);
                    params.set("dueDateTo", monthEnd.toISOString().split('T')[0]);
                  }
                  
                  window.location.href = `/dashboard/invoices${params.toString() ? '?' + params.toString() : ''}`;
                }}
                className="w-full px-4 py-2 bg-white border border-gray-200 text-sm font-display font-medium text-gray-700 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              >
                <option value="">All Time</option>
                <option value="week">Due This Week</option>
                <option value="month">Due This Month</option>
              </select>
            </div>

            {/* Search */}
            <form method="GET" className="flex-1 min-w-[200px]">
              {searchParams.status && <input type="hidden" name="status" value={searchParams.status} />}
              {source && <input type="hidden" name="source" value={source} />}
              {searchParams.dueDateFrom && <input type="hidden" name="dueDateFrom" value={searchParams.dueDateFrom} />}
              {searchParams.dueDateTo && <input type="hidden" name="dueDateTo" value={searchParams.dueDateTo} />}
              <div className="relative">
                <input
                  type="text"
                  name="search"
                  defaultValue={search}
                  placeholder="Search invoices..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 text-sm rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
          </div>
        </div>

        {/* Advanced Filters - Collapsible */}
        <details className="border-t border-gray-200 pt-4 mt-4">
          <summary className="cursor-pointer text-sm font-display font-medium text-gray-700 hover:text-gray-900 flex items-center gap-2">
            <span>More Filters</span>
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 bg-primary-600 text-white text-xs font-semibold rounded-full">
                {activeFilterCount}
              </span>
            )}
          </summary>
          
          <div className="mt-4 space-y-4">
            {/* Quick Filters Chips */}
            <div>
              <label className="block text-xs font-display font-medium text-gray-500 uppercase tracking-wide mb-2">
                Quick Filters
              </label>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const today = new Date();
                  const todayStr = today.toISOString().split('T')[0];
                  const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
                  const weekFromNowStr = weekFromNow.toISOString().split('T')[0];
                  
                  const isHighValueActive = searchParams.minAmount === "10000";
                  const isFromQBActive = source === "quickbooks";

                  return (
                    <>
                      {/* High Value */}
                      <Link
                        href={isHighValueActive ? "/dashboard/invoices" : `/dashboard/invoices?minAmount=10000${search ? `&search=${search}` : ""}${searchParams.status ? `&status=${searchParams.status}` : ""}`}
                        className={`px-3 py-1.5 rounded-full text-xs font-display font-medium transition whitespace-nowrap ${
                          isHighValueActive
                            ? "bg-primary-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        High Value (&gt;$10k)
                      </Link>

                      {/* From QuickBooks */}
                      <Link
                        href={isFromQBActive ? "/dashboard/invoices" : `/dashboard/invoices?source=quickbooks${search ? `&search=${search}` : ""}${searchParams.status ? `&status=${searchParams.status}` : ""}`}
                        className={`px-3 py-1.5 rounded-full text-xs font-display font-medium transition whitespace-nowrap ${
                          isFromQBActive
                            ? "bg-success-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        From QuickBooks ({qbInvoices})
                      </Link>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Advanced Filter Form */}
            <form method="GET">
              {search && <input type="hidden" name="search" value={search} />}
              {source && <input type="hidden" name="source" value={source} />}
              {searchParams.status && <input type="hidden" name="status" value={searchParams.status} />}
              {sortBy !== "createdAt" && <input type="hidden" name="sortBy" value={sortBy} />}
              {sortOrder !== "desc" && <input type="hidden" name="sortOrder" value={sortOrder} />}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Custom Date Range */}
                <div>
                  <label className="block text-xs font-display font-medium text-gray-700 mb-1">
                    Due Date From
                  </label>
                  <input
                    type="date"
                    name="dueDateFrom"
                    defaultValue={searchParams.dueDateFrom}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-display font-medium text-gray-700 mb-1">
                    Due Date To
                  </label>
                  <input
                    type="date"
                    name="dueDateTo"
                    defaultValue={searchParams.dueDateTo}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-xs font-display font-medium text-gray-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    name="paymentMethod"
                    defaultValue={searchParams.paymentMethod || ""}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">All</option>
                    <option value="CARD">Card</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CASH">Cash</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                {/* Amount Range */}
                <div>
                  <label className="block text-xs font-display font-medium text-gray-700 mb-1">
                    Min Amount ($)
                  </label>
                  <input
                    type="number"
                    name="minAmount"
                    defaultValue={searchParams.minAmount}
                    placeholder="0.00"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-display font-medium text-gray-700 mb-1">
                    Max Amount ($)
                  </label>
                  <input
                    type="number"
                    name="maxAmount"
                    defaultValue={searchParams.maxAmount}
                    placeholder="Unlimited"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 mt-4">
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary-600 text-white text-sm font-display font-semibold rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Apply Filters
                </button>
                <Link
                  href="/dashboard/invoices"
                  className="px-5 py-2 text-gray-700 text-sm font-display font-medium hover:text-gray-900 transition-colors"
                >
                  Clear All
                </Link>
              </div>
            </form>
          </div>
        </details>
      </div>

        {/* Invoice List */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                    <Link
                      href={buildSortUrl("invoiceNumber")}
                      className="hover:text-gray-900 cursor-pointer"
                    >
                      Invoice #<SortIndicator field="invoiceNumber" />
                    </Link>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                    Customer
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
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                    <Link
                      href={buildSortUrl("dueDate")}
                      className="hover:text-gray-900 cursor-pointer"
                    >
                      Date<SortIndicator field="dueDate" />
                    </Link>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-0">
                    <EmptyState
                      icon={<FileText className="w-16 h-16" />}
                      title="No invoices found"
                      description="Try adjusting your filters or create a new invoice to get started."
                    />
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => {
                  const isOverdue =
                    invoice.status !== InvoiceStatus.PAID &&
                    invoice.status !== InvoiceStatus.VOID &&
                    new Date(invoice.dueDate) < new Date();

                  return (
                    <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/dashboard/invoices/${invoice.id}`}
                          className="text-sm font-display font-medium text-primary-600 hover:text-primary-700"
                        >
                          {invoice.invoiceNumber || invoice.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-display text-gray-900">{invoice.customer.name}</div>
                        <div className="text-xs text-gray-500">{invoice.customer.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-display font-semibold text-gray-900 tabular-nums">
                        ${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={getStatusVariant(invoice.status)}>
                          {invoice.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 tabular-nums">
                        {format(new Date(invoice.dueDate), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/dashboard/invoices/${invoice.id}`}
                            className="text-primary-600 hover:text-primary-700 font-medium"
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
                                className="text-primary-600 hover:text-primary-700 font-medium"
                              >
                                Edit
                              </Link>
                            ) : null;
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
    </div>
  );
}
