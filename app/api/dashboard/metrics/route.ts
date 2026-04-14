import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LeadStatus, DealStatus, InvoiceStatus } from "@prisma/client";
import { subDays, startOfYear } from "date-fns";
import { buildDashboardMetrics } from "@/lib/dashboard/metrics-calculations";

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

    // Parse query parameters for filters
    const url = new URL(request.url);
    const dateRange = url.searchParams.get("dateRange") || "allTime"; // last7, last30, last90, thisYear, allTime
    const fromDate = url.searchParams.get("from");
    const toDate = url.searchParams.get("to");
    const customerSegment = url.searchParams.get("segment") || "all"; // all, active, inactive, churned
    const invoiceStatus = url.searchParams.get("invoiceStatus"); // comma-separated: PAID, OVERDUE, PENDING, etc.

    // Calculate date range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = startOfYear(now);

    let dateFilter: { gte?: Date; lte?: Date } = {};

    if (fromDate && toDate) {
      dateFilter = {
        gte: new Date(fromDate),
        lte: new Date(toDate),
      };
    } else {
      switch (dateRange) {
        case "last7":
          dateFilter = { gte: subDays(now, 7) };
          break;
        case "last30":
          dateFilter = { gte: subDays(now, 30) };
          break;
        case "last90":
          dateFilter = { gte: subDays(now, 90) };
          break;
        case "thisYear":
          dateFilter = { gte: yearStart };
          break;
        case "allTime":
        default:
          dateFilter = {}; // No date filter
      }
    }

    // Parse invoice status filter
    const invoiceStatuses = invoiceStatus
      ? (invoiceStatus.split(",") as InvoiceStatus[])
      : undefined;

    // Build where clauses with filters
    const invoiceWhereInvoiceStatus = invoiceStatuses
      ? { status: { in: invoiceStatuses } }
      : {};

    const dealWhereCreatedAt = dateFilter ? { createdAt: dateFilter } : {};
    
    // For revenue metrics, filter by when payment was received (paidAt), not when invoice was created
    // This ensures "Last 30 Days" shows revenue RECEIVED in last 30 days, not invoices CREATED in last 30 days
    const invoiceWherePaidAt = dateFilter ? { paidAt: dateFilter } : {};
    
    // Batch the reads into a single transaction so duplicate requests don't fan out into
    // a large burst of concurrent DB connections.
    const [
      totalLeads,
      qualifiedLeads,
      dealSummary,
      wonDealsThisMonth,
      totalInvoices,
      paidInvoicesInPeriod,
      allInvoicesForOverdue,
      totalCustomers,
      newCustomersThisMonth,
    ] = await prisma.$transaction([
      prisma.lead.count(),
      prisma.lead.count({ where: { status: LeadStatus.QUALIFIED } }),
      prisma.deal.groupBy({
        by: ["status"],
        where: dealWhereCreatedAt,
        orderBy: { status: "asc" },
        _count: { _all: true },
        _sum: { value: true },
      }),
      prisma.deal.count({
        where: {
          status: DealStatus.WON,
          createdAt: { gte: startOfMonth },
        },
      }),
      prisma.invoice.count({
        where: invoiceWhereInvoiceStatus,
      }),
      // Fetch invoices for revenue calculations - filter by paidAt for accurate revenue metrics
      prisma.invoice.findMany({
        where: {
          ...invoiceWhereInvoiceStatus,
          ...invoiceWherePaidAt,
        },
        select: {
          status: true,
          dueDate: true,
          amount: true,
          amountPaid: true,
          paidAt: true,
          createdAt: true,
          customerId: true,
        },
      }),
      // Fetch ALL invoices for overdue calculations (no date filter - current state metric)
      prisma.invoice.findMany({
        where: invoiceWhereInvoiceStatus,
        select: {
          status: true,
          dueDate: true,
          amount: true,
          amountPaid: true,
          paidAt: true,
          createdAt: true,
          customerId: true,
        },
      }),
      prisma.customer.count({
        where: dateFilter ? { createdAt: dateFilter } : {},
      }),
      prisma.customer.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
    ]);

    // Calculate financial metrics
    const today = new Date();
    const totalDeals = dealSummary.reduce((sum, deal) => sum + getGroupCount(deal._count), 0);
    const wonDeals = getGroupCount(dealSummary.find((deal) => deal.status === DealStatus.WON)?._count);

    // Total Revenue = sum of amountPaid from PAID invoices IN THE SELECTED PERIOD (filtered by paidAt)
    const paidInvoices = paidInvoicesInPeriod.filter((inv) => inv.status === InvoiceStatus.PAID);
    const totalRevenue = paidInvoices.reduce((sum, inv) => sum + Number(inv.amountPaid || 0), 0);

    // Total Paid = sum of amountPaid from invoices with payments IN THE SELECTED PERIOD (PAID or PARTIALLY_PAID)
    const paidOrPartialInvoices = paidInvoicesInPeriod.filter(
      (inv) => inv.status === InvoiceStatus.PAID || inv.status === InvoiceStatus.PARTIALLY_PAID
    );
    const totalPaid = paidOrPartialInvoices.reduce((sum, inv) => sum + Number(inv.amountPaid || 0), 0);

    // Overdue calculations use ALL invoices (current state, not filtered by date)
    const overdueInvoices = allInvoicesForOverdue.filter(
      (inv) =>
        inv.status !== InvoiceStatus.PAID &&
        inv.status !== InvoiceStatus.VOID &&
        new Date(inv.dueDate) < today
    );
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);

    // Total invoiced and pending use period-filtered invoices
    const totalInvoiced = paidInvoicesInPeriod.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const pendingAmount = totalInvoiced - totalPaid;
    const collectionRate = totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0;

    // Month-over-month comparison for growth indicators (use ALL invoices, not filtered by period)
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const invoicesPaidLastMonth = allInvoicesForOverdue.filter(
      (inv) =>
        inv.status === InvoiceStatus.PAID &&
        inv.paidAt &&
        new Date(inv.paidAt) >= lastMonth &&
        new Date(inv.paidAt) < startOfMonth
    ).length;

    const invoicesPaidThisMonth = allInvoicesForOverdue.filter(
      (inv) =>
        inv.status === InvoiceStatus.PAID &&
        inv.paidAt &&
        new Date(inv.paidAt) >= startOfMonth
    ).length;

    const metrics = buildDashboardMetrics({
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
      overdueCount: overdueInvoices.length,
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
      appliedDateRange: dateFilter,
    });

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
      error: "Failed to fetch complete metrics",
    }, { status: 200 });
  }
}
