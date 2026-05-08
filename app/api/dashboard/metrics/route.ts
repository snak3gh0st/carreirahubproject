import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AutoChargeStatus, ContractStatus, LeadStatus, DealStatus, InvoiceStatus } from "@prisma/client";
import {
  applyCanonicalFinanceSummary,
  buildDashboardMetrics,
  getDashboardDateFilter,
} from "@/lib/dashboard/metrics-calculations";
import { buildCustomerIdExclusionWhere } from "@/lib/financial/hub-exclusions";
import { getFinancialHubExcludedCustomerIds } from "@/lib/financial/hub-exclusions-db";
import { getFinancialBIData } from "@/lib/services/financial-bi";

export const dynamic = "force-dynamic";

function getGroupCount(count: true | { _all?: number } | undefined): number {
  if (!count || count === true) return 0;
  return count._all || 0;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userRole = (session.user as any).role as string;
    const userId = (session.user as any).id as string;
    const isIndividualCommercial = userRole === "COMMERCIAL";
    const canUseCanonicalFinance = userRole === "ADMIN" || userRole === "FINANCE";

    // Parse query parameters for filters
    const url = new URL(request.url);
    const dateRange = url.searchParams.get("dateRange") || "allTime"; // last7, last30, last90, thisYear, allTime
    const fromDate = url.searchParams.get("from");
    const toDate = url.searchParams.get("to");
    const customerSegment = url.searchParams.get("segment") || "all"; // all, active, inactive, churned
    const invoiceStatus = url.searchParams.get("invoiceStatus"); // comma-separated: PAID, OVERDUE, PENDING, etc.

    // Calculate date range
    const now = new Date();
    const today = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const dateFilter = getDashboardDateFilter(dateRange, {
      now,
      from: fromDate,
      to: toDate,
    });

    // Parse invoice status filter
    const invoiceStatuses = invoiceStatus
      ? (invoiceStatus.split(",") as InvoiceStatus[])
      : undefined;

    // Build where clauses with filters
    const invoiceWhereInvoiceStatus = invoiceStatuses ? { status: { in: invoiceStatuses } } : {};
    const invoiceOwnerWhere = isIndividualCommercial ? { ownerId: userId } : {};
    const dealOwnerWhere = isIndividualCommercial ? { ownerId: userId } : {};
    const leadOwnerWhere = isIndividualCommercial ? { createdById: userId } : {};
    const customerOwnerWhere =
      isIndividualCommercial
        ? {
            OR: [
              { createdById: userId },
              { invoices: { some: { ownerId: userId } } },
              { deals: { some: { ownerId: userId } } },
            ],
          }
        : {};

    const leadWhereCreatedAt = dateFilter ? { createdAt: dateFilter } : {};
    const dealWhereCreatedAt = dateFilter ? { createdAt: dateFilter } : {};
    const invoiceWhereCreatedAt = dateFilter ? { createdAt: dateFilter } : {};
    
    // For revenue metrics, filter by when payment was received (paidAt), not when invoice was created
    // This ensures "Last 30 Days" shows revenue RECEIVED in last 30 days, not invoices CREATED in last 30 days
    const invoiceWherePaidAt = dateFilter ? { paidAt: dateFilter } : {};
    const excludedCustomerIds = await getFinancialHubExcludedCustomerIds();
    const customerIdExclusionWhere = buildCustomerIdExclusionWhere(excludedCustomerIds);
    const customerVisibilityWhere =
      excludedCustomerIds.length > 0 ? { id: { notIn: excludedCustomerIds } } : {};

    const financialSummaryPromise =
      canUseCanonicalFinance
        ? getFinancialBIData(dateRange as any, fromDate || undefined, toDate || undefined, "revenue").catch((error) => {
            console.error("[Dashboard Metrics] Failed to load canonical financial summary:", error);
            return null;
          })
        : Promise.resolve(null);
    
    // Batch the reads into a single transaction so duplicate requests don't fan out into
    // a large burst of concurrent DB connections.
    const [
      totalLeads,
      qualifiedLeads,
      dealSummary,
      wonDealsThisMonth,
      totalInvoices,
      invoiceTotalsInPeriod,
      paidInvoiceFallbackTotals,
      paymentsInPeriod,
      overdueInvoiceTotals,
      invoicesPaidLastMonth,
      invoicesPaidThisMonth,
      openInvoiceCount,
      partialInvoiceCount,
      pendingContractCount,
      openDealCount,
      qualifiedLeadCount,
      quickbooksGapCount,
      autoChargeRiskCount,
      totalCustomers,
      newCustomersThisMonth,
    ] = await prisma.$transaction([
      prisma.lead.count({ where: { ...leadOwnerWhere, ...leadWhereCreatedAt } }),
      prisma.lead.count({ where: { ...leadOwnerWhere, ...leadWhereCreatedAt, status: LeadStatus.QUALIFIED } }),
      prisma.deal.groupBy({
        by: ["status"],
        where: { ...dealOwnerWhere, ...dealWhereCreatedAt, ...customerIdExclusionWhere },
        orderBy: { status: "asc" },
        _count: { _all: true },
        _sum: { value: true },
      }),
      prisma.deal.count({
        where: {
          ...dealOwnerWhere,
          ...customerIdExclusionWhere,
          status: DealStatus.WON,
          createdAt: { gte: startOfMonth },
        },
      }),
      prisma.invoice.count({
        where: {
          ...invoiceOwnerWhere,
          ...customerIdExclusionWhere,
          ...invoiceWhereInvoiceStatus,
          ...invoiceWhereCreatedAt,
        },
      }),
      prisma.invoice.aggregate({
        where: {
          ...invoiceOwnerWhere,
          ...customerIdExclusionWhere,
          ...invoiceWhereInvoiceStatus,
          ...invoiceWhereCreatedAt,
        },
        _sum: {
          amount: true,
        },
      }),
      // Fallback only used when Payment rows are not available for the selected period.
      prisma.invoice.aggregate({
        where: {
          ...invoiceOwnerWhere,
          ...customerIdExclusionWhere,
          ...invoiceWhereInvoiceStatus,
          ...invoiceWherePaidAt,
          status: { in: [InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID] },
        },
        _sum: {
          amountPaid: true,
        },
      }),
      prisma.payment.aggregate({
        where: {
          ...(dateFilter ? { paymentDate: dateFilter } : {}),
          ...customerIdExclusionWhere,
          ...(isIndividualCommercial ? { invoice: { ownerId: userId } } : {}),
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      // Current overdue state: no selected-period date filter.
      prisma.invoice.aggregate({
        where: {
          ...invoiceOwnerWhere,
          ...customerIdExclusionWhere,
          ...invoiceWhereInvoiceStatus,
          status: { notIn: [InvoiceStatus.PAID, InvoiceStatus.VOID] },
          dueDate: { lt: today },
        },
        _count: { _all: true },
        _sum: {
          amount: true,
          amountPaid: true,
        },
      }),
      prisma.invoice.count({
        where: {
          ...invoiceOwnerWhere,
          ...customerIdExclusionWhere,
          status: InvoiceStatus.PAID,
          paidAt: {
            gte: lastMonth,
            lt: startOfMonth,
          },
        },
      }),
      prisma.invoice.count({
        where: {
          ...invoiceOwnerWhere,
          ...customerIdExclusionWhere,
          status: InvoiceStatus.PAID,
          paidAt: {
            gte: startOfMonth,
          },
        },
      }),
      prisma.invoice.count({
        where: {
          ...invoiceOwnerWhere,
          ...customerIdExclusionWhere,
          status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE, InvoiceStatus.PARTIALLY_PAID] },
        },
      }),
      prisma.invoice.count({
        where: {
          ...invoiceOwnerWhere,
          ...customerIdExclusionWhere,
          status: InvoiceStatus.PARTIALLY_PAID,
        },
      }),
      prisma.contract.count({
        where: {
          ...customerIdExclusionWhere,
          ...(isIndividualCommercial ? { deal: { ownerId: userId } } : {}),
          status: { in: [ContractStatus.SENT_FOR_SIGNATURE, ContractStatus.VIEWED] },
        },
      }),
      prisma.deal.count({
        where: {
          ...dealOwnerWhere,
          ...customerIdExclusionWhere,
          status: DealStatus.OPEN,
        },
      }),
      prisma.lead.count({
        where: {
          ...leadOwnerWhere,
          status: LeadStatus.QUALIFIED,
        },
      }),
      prisma.customer.count({
        where: {
          ...customerOwnerWhere,
          ...customerVisibilityWhere,
          quickbooks_id: null,
        },
      }),
      prisma.invoice.count({
        where: {
          ...invoiceOwnerWhere,
          ...customerIdExclusionWhere,
          autoChargeStatus: { in: [AutoChargeStatus.FAILED, AutoChargeStatus.RETRY_PENDING] },
        },
      }),
      prisma.customer.count({
        where: {
          ...customerOwnerWhere,
          ...customerVisibilityWhere,
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
      }),
      prisma.customer.count({
        where: {
          ...customerOwnerWhere,
          ...customerVisibilityWhere,
          createdAt: { gte: startOfMonth },
        },
      }),
    ]);

    const financialSummary = await financialSummaryPromise;

    // Calculate financial metrics
    const totalDeals = dealSummary.reduce((sum, deal) => sum + getGroupCount(deal._count), 0);
    const wonDeals = getGroupCount(dealSummary.find((deal) => deal.status === DealStatus.WON)?._count);

    // Total Revenue/Paid = payments received in the selected period. If the
    // Payment table is empty in an older environment, fall back to invoice paidAt.
    const paymentRows = getGroupCount(paymentsInPeriod._count);
    const totalRevenue = paymentRows > 0
      ? Number(paymentsInPeriod._sum.amount || 0)
      : Number(paidInvoiceFallbackTotals._sum.amountPaid || 0);
    const totalPaid = totalRevenue;

    const overdueAmount = Math.max(
      Number(overdueInvoiceTotals._sum.amount || 0) - Number(overdueInvoiceTotals._sum.amountPaid || 0),
      0
    );
    const overdueCount = getGroupCount(overdueInvoiceTotals._count);

    // Total invoiced and pending use period-filtered invoices
    const totalInvoiced = Number(invoiceTotalsInPeriod._sum.amount || 0);
    const pendingAmount = totalInvoiced - totalPaid;
    const collectionRate = totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0;

    let metrics = buildDashboardMetrics({
      totalLeads,
      qualifiedLeads,
      totalDeals,
      wonDeals,
      wonDealsThisMonth,
      totalInvoices,
      totalRevenue,
      totalInvoiced,
      totalPaid,
      overdueAmount,
      overdueCount,
      totalCustomers,
      newCustomersThisMonth,
      dealStatusSummary: dealSummary.map((deal) => ({
        status: deal.status,
        valueSum: Number(deal._sum?.value || 0),
      })),
      invoicesPaidThisMonth,
      invoicesPaidLastMonth,
      dateRange,
      customerSegment,
      invoiceStatuses: invoiceStatuses || [],
      appliedDateRange: dateFilter ?? {},
      actions: {
        openInvoiceCount,
        partialInvoiceCount,
        pendingContractCount,
        openDealCount,
        qualifiedLeadCount,
        quickbooksGapCount,
        autoChargeRiskCount,
      },
    });

    if (financialSummary?.summary && canUseCanonicalFinance) {
      metrics = applyCanonicalFinanceSummary(metrics, financialSummary.summary);
    }

    return NextResponse.json(metrics);
  } catch (error) {
    console.error("[Dashboard Metrics Error]:", error);
    // Return partial data on error instead of complete failure
    return NextResponse.json({
      sales: {
        wonDealsThisMonth: 0,
        totalDeals: 0,
        wonDeals: 0,
        totalLeads: 0,
        qualifiedLeads: 0,
        conversionRate: "0.0",
        pipelineValue: 0,
        avgDealValue: 0,
      },
      finance: {
        totalRevenue: 0,
        totalInvoiced: 0,
        totalPaid: 0,
        pendingAmount: 0,
        overdueAmount: 0,
        collectionRate: "0.0",
        totalInvoices: 0,
        overdueCount: 0,
        revenueGrowth: "0",
      },
      customers: {
        totalCustomers: 0,
        newCustomersThisMonth: 0,
        avgCustomerValue: 0,
      },
      actions: {
        openInvoiceCount: 0,
        partialInvoiceCount: 0,
        pendingContractCount: 0,
        openDealCount: 0,
        qualifiedLeadCount: 0,
        quickbooksGapCount: 0,
        autoChargeRiskCount: 0,
      },
      error: "Failed to fetch complete metrics",
    }, { status: 200 });
  }
}
