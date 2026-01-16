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
      servicesData,
    ] = await Promise.all([
      // Total Revenue (sum of amountPaid from PAID invoices)
      prisma.invoice.aggregate({
        where: {
          status: "PAID",
          ...(dateFilter && { paidAt: dateFilter }),
        },
        _sum: { amountPaid: true },
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

      // Total Paid (sum of amountPaid from PAID or PARTIALLY_PAID invoices)
      prisma.invoice.aggregate({
        where: {
          status: { in: ["PAID", "PARTIALLY_PAID"] },
          ...(dateFilter && { paidAt: dateFilter }),
        },
        _sum: { amountPaid: true },
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

      // Revenue by Month (from paid or partially paid invoices)
      prisma.invoice.findMany({
        where: {
          status: { in: ["PAID", "PARTIALLY_PAID"] },
          paidAt: {
            gte: revenueTrendStartDate,
            ...(endDate && { lte: endDate }),
          },
        },
        select: { paidAt: true, amountPaid: true },
        orderBy: { paidAt: "asc" },
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

      // Top Customers (by amountPaid from paid or partially paid invoices)
      prisma.invoice.groupBy({
        by: ["customerId"],
        where: {
          status: { in: ["PAID", "PARTIALLY_PAID"] },
          ...(dateFilter && { paidAt: dateFilter }),
        },
        _sum: { amountPaid: true },
        orderBy: { _sum: { amountPaid: "desc" } },
        take: 10,
      }).then(async (invoiceGroups) => {
        // Get customer details for these groups
        const customerIds = invoiceGroups.map(ig => ig.customerId);
        const customers = await prisma.customer.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, name: true, email: true },
        });

        // Merge customer data with total paid amounts
        return invoiceGroups.map(ig => {
          const customer = customers.find(c => c.id === ig.customerId);
          return {
            ...customer,
            totalPaid: Number(ig._sum.amountPaid || 0),
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

      // Services sold (from invoice line items)
      prisma.invoice.findMany({
        where: {
          status: { notIn: ["DRAFT", "VOID"] },
          ...(dateFilter && { createdAt: dateFilter }),
        },
        select: {
          lineItems: true,
          amount: true,
          createdAt: true,
        },
      }),
    ]);

    // Calculate KPIs
    const totalRevenue = Number(totalRevenueResult._sum.amountPaid || 0);
    const overdueAmount = Number(overdueAmountResult._sum.amount || 0);
    const totalInvoiced = Number(totalInvoicedResult._sum.amount || 0);
    const totalPaid = Number(totalPaidResult._sum.amountPaid || 0);
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

    // Format revenue trend with proper year/month grouping
    const revenueByMonthMap = new Map<string, number>();

    // Calculate date range from data
    let minDate = new Date();
    let maxDate = new Date(now.getTime() - 12 * 30 * 24 * 60 * 60 * 1000); // Default 12 months back

    if (revenueByMonth.length > 0) {
      revenueByMonth.forEach((inv) => {
        if (inv.paidAt) {
          const d = new Date(inv.paidAt);
          if (d < minDate) minDate = d;
          if (d > maxDate) maxDate = d;
        }
      });
    }

    // Initialize all months in range
    let current = startOfMonth(minDate);
    while (current <= maxDate) {
      const monthKey = format(current, "yyyy-MM");
      revenueByMonthMap.set(monthKey, 0);
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }

    revenueByMonth.forEach((invoice) => {
      if (invoice.paidAt) {
        const monthKey = format(startOfMonth(invoice.paidAt), "yyyy-MM");
        const current = revenueByMonthMap.get(monthKey) || 0;
        revenueByMonthMap.set(monthKey, current + Number(invoice.amountPaid || 0));
      }
    });

    const revenueTrend = Array.from(revenueByMonthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({
        month: format(new Date(month + "-01"), "MMM yy"),
        fullMonth: month,
        revenue: Math.round(revenue),
      }));

    // Format invoice count trend with proper year/month grouping
    const invoiceCountByMonthMap = new Map<string, number>();

    // Calculate date range from data
    let minDateInv = new Date();
    let maxDateInv = new Date(now.getTime() - 12 * 30 * 24 * 60 * 60 * 1000);

    if (invoiceCountByMonth.length > 0) {
      invoiceCountByMonth.forEach((inv) => {
        const d = new Date(inv.createdAt);
        if (d < minDateInv) minDateInv = d;
        if (d > maxDateInv) maxDateInv = d;
      });
    }

    // Initialize all months in range
    let currentInv = startOfMonth(minDateInv);
    while (currentInv <= maxDateInv) {
      const monthKey = format(currentInv, "yyyy-MM");
      invoiceCountByMonthMap.set(monthKey, 0);
      currentInv = new Date(currentInv.getFullYear(), currentInv.getMonth() + 1, 1);
    }

    invoiceCountByMonth.forEach((invoice) => {
      const monthKey = format(startOfMonth(invoice.createdAt), "yyyy-MM");
      const current = invoiceCountByMonthMap.get(monthKey) || 0;
      invoiceCountByMonthMap.set(monthKey, current + 1);
    });

    const invoiceCountTrend = Array.from(invoiceCountByMonthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({
        month: format(new Date(month + "-01"), "MMM yy"),
        fullMonth: month,
        count,
      }));

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

    // Aggregate services sold
    const servicesMap = new Map<string, { quantity: number; revenue: number }>();
    servicesData.forEach((invoice) => {
      if (invoice.lineItems && Array.isArray(invoice.lineItems)) {
        const lineItems = invoice.lineItems as Array<{ description: string; amount: number; quantity?: number }>;
        lineItems.forEach((item) => {
          const serviceName = item.description || "Unknown Service";
          const current = servicesMap.get(serviceName) || { quantity: 0, revenue: 0 };
          servicesMap.set(serviceName, {
            quantity: current.quantity + (item.quantity || 1),
            revenue: current.revenue + Number(item.amount || 0),
          });
        });
      }
    });

    const topServices = Array.from(servicesMap.entries())
      .map(([name, data]) => ({
        name,
        quantity: data.quantity,
        revenue: Math.round(data.revenue),
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    // Calculate additional KPIs
    const totalInvoices = invoiceCountByMonth.length;
    const paidInvoiceCount = invoiceStatusDistribution.find(item => item.status === "PAID")?._count.id || 0;
    const paidInvoicePercentage = totalInvoices > 0 ? (paidInvoiceCount / totalInvoices) * 100 : 0;
    const overdueInvoiceCount = invoiceStatusDistribution.find(item => item.status === "OVERDUE")?._count.id || 0;
    const overdueInvoicePercentage = totalInvoices > 0 ? (overdueInvoiceCount / totalInvoices) * 100 : 0;

    // Average days to payment (calculated from median invoice age)
    // Simplified: use collection rate and payment timing to estimate DSO
    const avgDaysToPayment = totalPaid > 0 && totalInvoiced > 0
      ? Math.round((pendingAmount / (totalInvoiced / 365)))
      : 0;

    // Revenue concentration (% from top 20% customers)
    const top20PercentCount = Math.ceil(activeCustomers * 0.2);
    const topCustomersByConcentration = topCustomersByRevenue.slice(0, Math.max(1, top20PercentCount));
    const topCustomersRevenue = topCustomersByConcentration.reduce((sum, c) => sum + Number(c.totalPaid || 0), 0);
    const revenueConcentration = totalRevenue > 0 ? (topCustomersRevenue / totalRevenue) * 100 : 0;

    // Service diversity
    const uniqueServices = servicesMap.size;

    return NextResponse.json({
      kpis: {
        // Financial KPIs
        totalRevenue,
        totalInvoiced,
        totalPaid,
        pendingAmount,
        overdueAmount,
        collectionRate: Number(collectionRate.toFixed(1)),
        overduePercentage: Number(overduePercentage.toFixed(1)),

        // Invoice KPIs
        totalInvoices,
        paidInvoiceCount,
        paidInvoicePercentage: Number(paidInvoicePercentage.toFixed(1)),
        overdueInvoiceCount,
        overdueInvoicePercentage: Number(overdueInvoicePercentage.toFixed(1)),
        avgDaysToPayment,

        // Customer KPIs
        activeCustomers,
        newCustomers: newCustomersResult,
        avgCustomerValue: Math.round(avgCustomerValue),
        revenueConcentration: Number(revenueConcentration.toFixed(1)),

        // Sales KPIs
        totalDeals,
        wonDeals,
        winRate: Number(winRate.toFixed(1)),
        avgDealValue: Math.round(avgDealValue),
        totalLeads,
        qualifiedLeads,
        leadQualificationRate: Number(leadQualificationRate.toFixed(1)),

        // Service KPIs
        uniqueServices,
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
        topServices,
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
