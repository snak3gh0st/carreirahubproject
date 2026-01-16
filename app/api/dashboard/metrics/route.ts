import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LeadStatus, DealStatus, InvoiceStatus } from "@prisma/client";
import { subDays, startOfYear } from "date-fns";

export const dynamic = "force-dynamic";

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
    const invoiceWhereCreatedAt = dateFilter ? { createdAt: dateFilter } : {};

    // Fetch all data in parallel
    const [
      totalLeads,
      qualifiedLeads,
      totalDeals,
      wonDeals,
      wonDealsThisMonth,
      totalInvoices,
      allInvoices,
      allCustomers,
      newCustomersThisMonth,
      allDeals,
    ] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { status: LeadStatus.QUALIFIED } }),
      prisma.deal.count({ where: dealWhereCreatedAt }),
      prisma.deal.count({
        where: {
          status: DealStatus.WON,
          ...dealWhereCreatedAt,
        },
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
      prisma.customer.count(),
      prisma.customer.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      prisma.deal.findMany({
        where: dealWhereCreatedAt,
        select: { value: true, status: true },
      }),
    ]);

    // Calculate financial metrics
    const today = new Date();

    // Total Revenue = sum of amountPaid from PAID invoices
    const paidInvoices = allInvoices.filter((inv) => inv.status === InvoiceStatus.PAID);
    const totalRevenue = paidInvoices.reduce((sum, inv) => sum + Number(inv.amountPaid || 0), 0);

    // Total Paid = sum of amountPaid from invoices with payments (PAID or PARTIALLY_PAID)
    const paidOrPartialInvoices = allInvoices.filter(
      (inv) => inv.status === InvoiceStatus.PAID || inv.status === InvoiceStatus.PARTIALLY_PAID
    );
    const totalPaid = paidOrPartialInvoices.reduce((sum, inv) => sum + Number(inv.amountPaid || 0), 0);

    const overdueInvoices = allInvoices.filter(
      (inv) =>
        inv.status !== InvoiceStatus.PAID &&
        inv.status !== InvoiceStatus.VOID &&
        new Date(inv.dueDate) < today
    );
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);

    const totalInvoiced = allInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const pendingAmount = totalInvoiced - totalPaid;
    const collectionRate = totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0;

    // Calculate sales metrics
    const conversionRate = totalLeads > 0 ? (wonDeals / totalLeads) * 100 : 0;
    const pipelineValue = allDeals
      .filter((deal) => deal.status !== DealStatus.WON && deal.status !== DealStatus.LOST)
      .reduce((sum, deal) => sum + Number(deal.value || 0), 0);
    const avgDealValue = wonDeals > 0 ? totalRevenue / wonDeals : 0;

    // Calculate customer metrics
    const avgCustomerValue = allCustomers > 0 ? totalRevenue / allCustomers : 0;

    // Month-over-month comparison for growth indicators
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const invoicesPaidLastMonth = allInvoices.filter(
      (inv) =>
        inv.status === InvoiceStatus.PAID &&
        inv.paidAt &&
        new Date(inv.paidAt) >= lastMonth &&
        new Date(inv.paidAt) < startOfMonth
    ).length;

    const invoicesPaidThisMonth = allInvoices.filter(
      (inv) =>
        inv.status === InvoiceStatus.PAID &&
        inv.paidAt &&
        new Date(inv.paidAt) >= startOfMonth
    ).length;

    const revenueGrowth =
      invoicesPaidLastMonth > 0
        ? (((invoicesPaidThisMonth - invoicesPaidLastMonth) / invoicesPaidLastMonth) * 100).toFixed(1)
        : "0";

    // Build comprehensive metrics response
    const metrics = {
      sales: {
        wonDealsThisMonth,
        totalDeals,
        wonDeals,
        totalLeads,
        qualifiedLeads,
        conversionRate: conversionRate.toFixed(1),
        pipelineValue: Math.round(pipelineValue),
        avgDealValue: Math.round(avgDealValue),
      },
      finance: {
        totalRevenue: Math.round(totalRevenue),
        totalInvoiced: Math.round(totalInvoiced),
        totalPaid: Math.round(totalPaid),
        pendingAmount: Math.round(pendingAmount),
        overdueAmount: Math.round(overdueAmount),
        collectionRate: collectionRate.toFixed(1),
        totalInvoices,
        overdueCount: overdueInvoices.length,
        revenueGrowth,
      },
      customers: {
        totalCustomers: allCustomers,
        newCustomersThisMonth,
        avgCustomerValue: Math.round(avgCustomerValue),
      },
      summary: {
        totalMetrics: totalLeads + totalDeals + totalInvoices + allCustomers,
        activeUsers: totalLeads,
      },
      filters: {
        dateRange,
        customerSegment,
        invoiceStatus: invoiceStatuses || [],
        appliedDateRange: dateFilter,
      },
    };

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
