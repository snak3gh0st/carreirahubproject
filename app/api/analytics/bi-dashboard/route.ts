import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { startOfMonth, subMonths, subDays, startOfYear, format } from "date-fns";

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/bi-dashboard
 *
 * Comprehensive BI dashboard data including:
 * - Extended KPIs (revenue, collection, overdue, customers, deals, etc.)
 * - Invoice status distribution (pie)
 * - Deal status distribution (pie)
 * - Revenue trend (line)
 * - Invoice count trend (line)
 * - Top customers (bar)
 * - Sales pipeline by stage (bar)
 * - Invoice aging distribution (bar)
 * - Lead conversion funnel
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get("dateRange");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    let startDate: Date | null = null;
    let endDate: Date | null = null;
    const now = new Date();

    if (dateRange === "custom" && fromParam && toParam) {
      startDate = new Date(fromParam);
      endDate = new Date(toParam);
    } else {
      switch (dateRange) {
        case "last7":
          startDate = subDays(now, 7);
          endDate = now;
          break;
        case "last30":
          startDate = subDays(now, 30);
          endDate = now;
          break;
        case "last90":
          startDate = subDays(now, 90);
          endDate = now;
          break;
        case "thisYear":
          startDate = startOfYear(now);
          endDate = now;
          break;
        case "allTime":
        default:
          startDate = null;
          endDate = null;
          break;
      }
    }

    const dateFilter = startDate && endDate
      ? { gte: startDate, lte: endDate }
      : undefined;

    const revenueTrendStartDate = startDate || subMonths(startOfMonth(now), 12);

    // All queries in parallel
    const [
      totalRevenueResult,
      overdueAmountResult,
      totalInvoicedResult,
      totalPaidResult,
      pendingAmountResult,
      activeCustomersResult,
      newCustomersResult,
      totalDealsResult,
      wonDealsResult,
      totalLeadsResult,
      qualifiedLeadsResult,
      invoiceStatusDistribution,
      dealStatusDistribution,
      revenueByMonth,
      invoiceCountByMonth,
      topCustomersByRevenue,
      dealsPipeline,
      invoiceAging,
      leadConversionData,
    ] = await Promise.all([
      // Total Revenue (sum of actual payments)
      prisma.payment.aggregate({
        where: dateFilter ? { paymentDate: dateFilter } : {},
        _sum: { amount: true },
      }),

      // Overdue Amount (invoices status OVERDUE)
      prisma.invoice.aggregate({
        where: {
          status: "OVERDUE",
          ...(dateFilter && { createdAt: dateFilter }),
        },
        _sum: { amount: true },
      }),

      // Total Invoiced (sum of all non-draft, non-void invoices)
      prisma.invoice.aggregate({
        where: {
          status: { notIn: ["DRAFT", "VOID"] },
          ...(dateFilter && { createdAt: dateFilter }),
        },
        _sum: { amount: true },
      }),

      // Total Paid (sum of actual payments in period)
      prisma.payment.aggregate({
        where: dateFilter ? { paymentDate: dateFilter } : {},
        _sum: { amount: true },
      }),

      // Pending Amount (total invoiced - total paid)
      prisma.invoice.aggregate({
        where: {
          status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] },
          ...(dateFilter && { createdAt: dateFilter }),
        },
        _sum: { amount: true },
      }),

      // Active Customers (with invoices)
      prisma.invoice.findMany({
        where: {
          createdAt: dateFilter || { gte: subDays(now, 90) },
        },
        distinct: ["customerId"],
        select: { customerId: true },
      }),

      // New Customers (created in period)
      prisma.customer.count({
        where: dateFilter ? { createdAt: dateFilter } : {},
      }),

      // Total Deals
      prisma.deal.count({
        where: dateFilter ? { createdAt: dateFilter } : {},
      }),

      // Won Deals
      prisma.deal.count({
        where: {
          status: "WON",
          ...(dateFilter && { createdAt: dateFilter }),
        },
      }),

      // Total Leads
      prisma.lead.count(),

      // Qualified Leads
      prisma.lead.count({
        where: { status: "QUALIFIED" },
      }),

      // Invoice Status Distribution
      prisma.invoice.groupBy({
        by: ["status"],
        where: dateFilter ? { createdAt: dateFilter } : undefined,
        _count: { id: true },
        _sum: { amount: true },
      }),

      // Deal Status Distribution
      prisma.deal.groupBy({
        by: ["status"],
        where: dateFilter ? { createdAt: dateFilter } : undefined,
        _count: { id: true },
        _sum: { value: true },
      }),

      // Revenue by Month
      prisma.payment.findMany({
        where: {
          paymentDate: {
            gte: revenueTrendStartDate,
            ...(endDate && { lte: endDate }),
          },
        },
        select: { paymentDate: true, amount: true },
        orderBy: { paymentDate: "asc" },
      }),

      // Invoice Count by Month
      prisma.invoice.findMany({
        where: {
          createdAt: {
            gte: revenueTrendStartDate,
            ...(endDate && { lte: endDate }),
          },
        },
        select: { createdAt: true },
      }),

      // Top Customers (by actual payment amounts)
      prisma.payment.groupBy({
        by: ["customerId"],
        where: dateFilter ? { paymentDate: dateFilter } : undefined,
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 10,
      }).then(async (paymentGroups) => {
        // Get customer details for these payment groups
        const customerIds = paymentGroups.map(pg => pg.customerId);
        const customers = await prisma.customer.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, name: true, email: true },
        });

        // Merge customer data with payment amounts
        return paymentGroups.map(pg => {
          const customer = customers.find(c => c.id === pg.customerId);
          return {
            ...customer,
            totalPaid: Number(pg._sum.amount || 0),
          };
        });
      }),

      // Deals Pipeline by Status
      prisma.deal.groupBy({
        by: ["status"],
        where: { status: { in: ["OPEN", "WON", "LOST"] } },
        _count: { id: true },
        _sum: { value: true },
      }),

      // Invoice Aging (days overdue distribution)
      prisma.invoice.findMany({
        where: {
          status: { in: ["OVERDUE", "SENT", "PARTIALLY_PAID"] },
        },
        select: {
          amount: true,
          dueDate: true,
          createdAt: true,
        },
      }),

      // Lead conversion funnel
      prisma.lead.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
    ]);

    // Calculate KPIs
    const totalRevenue = Number(totalRevenueResult._sum.amount || 0);
    const overdueAmount = Number(overdueAmountResult._sum.amount || 0);
    const totalInvoiced = Number(totalInvoicedResult._sum.amount || 0);
    const totalPaid = Number(totalPaidResult._sum.amount || 0);
    const pendingAmount = Number(pendingAmountResult._sum.amount || 0);
    const collectionRate = totalInvoiced > 0
      ? (totalPaid / totalInvoiced) * 100
      : 0;
    const overduePercentage = totalInvoiced > 0
      ? (overdueAmount / totalInvoiced) * 100
      : 0;
    const activeCustomers = activeCustomersResult.length;
    const totalDeals = totalDealsResult;
    const wonDeals = wonDealsResult;
    const winRate = totalDeals > 0 ? (wonDeals / totalDeals) * 100 : 0;
    const totalLeads = totalLeadsResult;
    const qualifiedLeads = qualifiedLeadsResult;
    const leadQualificationRate = totalLeads > 0
      ? (qualifiedLeads / totalLeads) * 100
      : 0;
    const avgDealValue = wonDeals > 0 ? totalRevenue / wonDeals : 0;
    const avgCustomerValue = activeCustomers > 0
      ? totalRevenue / activeCustomers
      : 0;

    // Format invoice status distribution
    const invoiceStatusChart = invoiceStatusDistribution.map((item) => ({
      name: item.status,
      value: item._count.id,
      amount: Number(item._sum.amount || 0),
    }));

    // Format deal status distribution
    const dealStatusChart = dealStatusDistribution.map((item) => ({
      name: item.status,
      value: item._count.id,
      amount: Number(item._sum.value || 0),
    }));

    // Format revenue trend
    const revenueByMonthMap = new Map<string, number>();
    for (let i = 0; i < 12; i++) {
      const month = subMonths(startOfMonth(new Date()), 11 - i);
      const monthKey = format(month, "yyyy-MM");
      revenueByMonthMap.set(monthKey, 0);
    }
    revenueByMonth.forEach((payment) => {
      const monthKey = format(startOfMonth(payment.paymentDate), "yyyy-MM");
      const current = revenueByMonthMap.get(monthKey) || 0;
      revenueByMonthMap.set(monthKey, current + Number(payment.amount));
    });
    const revenueTrend = Array.from(revenueByMonthMap.entries()).map(
      ([month, revenue]) => ({
        month: format(new Date(month + "-01"), "MMM"),
        revenue: Math.round(revenue),
      })
    );

    // Format invoice count trend
    const invoiceCountByMonthMap = new Map<string, number>();
    for (let i = 0; i < 12; i++) {
      const month = subMonths(startOfMonth(new Date()), 11 - i);
      const monthKey = format(month, "yyyy-MM");
      invoiceCountByMonthMap.set(monthKey, 0);
    }
    invoiceCountByMonth.forEach((invoice) => {
      const monthKey = format(startOfMonth(invoice.createdAt), "yyyy-MM");
      const current = invoiceCountByMonthMap.get(monthKey) || 0;
      invoiceCountByMonthMap.set(monthKey, current + 1);
    });
    const invoiceCountTrend = Array.from(invoiceCountByMonthMap.entries()).map(
      ([month, count]) => ({
        month: format(new Date(month + "-01"), "MMM"),
        count,
      })
    );

    // Format top customers
    const topCustomers = topCustomersByRevenue.map((c) => ({
      name: c.name,
      value: Math.round(c.totalPaid || 0),
    }));

    // Format pipeline
    const pipelineData = dealsPipeline.map((item) => ({
      status: item.status,
      deals: item._count.id,
      value: Math.round(Number(item._sum.value || 0)),
    }));

    // Calculate invoice aging
    const agingBuckets = {
      current: 0,
      overdue1to30: 0,
      overdue30to60: 0,
      overdue60plus: 0,
    };
    invoiceAging.forEach((inv) => {
      const daysOverdue = Math.floor(
        (now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysOverdue <= 0) agingBuckets.current += Number(inv.amount);
      else if (daysOverdue <= 30) agingBuckets.overdue1to30 += Number(inv.amount);
      else if (daysOverdue <= 60) agingBuckets.overdue30to60 += Number(inv.amount);
      else agingBuckets.overdue60plus += Number(inv.amount);
    });

    const invoiceAgingChart = [
      { name: "Current", value: Math.round(agingBuckets.current) },
      { name: "1-30 Days", value: Math.round(agingBuckets.overdue1to30) },
      { name: "30-60 Days", value: Math.round(agingBuckets.overdue30to60) },
      { name: "60+ Days", value: Math.round(agingBuckets.overdue60plus) },
    ];

    // Lead conversion funnel
    const funnelMap = new Map<string, number>();
    leadConversionData.forEach((item) => {
      funnelMap.set(item.status, item._count.id);
    });
    const funnelData = [
      { stage: "New", value: funnelMap.get("NEW") || 0 },
      { stage: "Qualified", value: funnelMap.get("QUALIFIED") || 0 },
      { stage: "Contacted", value: funnelMap.get("CONTACTED") || 0 },
      { stage: "Converted", value: funnelMap.get("CONVERTED") || 0 },
    ];

    return NextResponse.json({
      kpis: {
        totalRevenue,
        overdueAmount,
        collectionRate: Number(collectionRate.toFixed(1)),
        overduePercentage: Number(overduePercentage.toFixed(1)),
        activeCustomers,
        newCustomers: newCustomersResult,
        totalInvoiced,
        totalPaid,
        pendingAmount,
        avgCustomerValue: Math.round(avgCustomerValue),
        totalDeals,
        wonDeals,
        winRate: Number(winRate.toFixed(1)),
        totalLeads,
        qualifiedLeads,
        leadQualificationRate: Number(leadQualificationRate.toFixed(1)),
        avgDealValue: Math.round(avgDealValue),
      },
      charts: {
        invoiceStatus: invoiceStatusChart,
        dealStatus: dealStatusChart,
        revenueTrend,
        invoiceCountTrend,
        topCustomers,
        dealsPipeline: pipelineData,
        invoiceAging: invoiceAgingChart,
        leadFunnel: funnelData,
      },
    });
  } catch (error) {
    console.error("Error fetching BI dashboard data:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch analytics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
