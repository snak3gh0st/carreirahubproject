import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { startOfMonth, subMonths, subDays, startOfYear, format, eachMonthOfInterval, endOfMonth } from "date-fns";

/**
 * Parse a date string from PostgreSQL as UTC to avoid timezone issues.
 * PostgreSQL stores dates as UTC, but JavaScript's new Date() parses them in local time,
 * causing early-morning UTC dates to shift to the previous day in local time.
 */
function parseUtcDate(dateStr: string | Date): Date {
  if (dateStr instanceof Date) {
    return dateStr;
  }
  // If the date string doesn't have timezone info, append 'Z' to treat it as UTC
  if (!dateStr.includes('Z') && !dateStr.includes('+')) {
    dateStr = dateStr + 'Z';
  }
  return new Date(dateStr);
}

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/quickbooks
 *
 * Returns comprehensive QuickBooks-focused analytics data for the BI dashboard:
 * - Financial KPIs: totalRevenue, mrr, arr, cashFlow, collectionRate, overdueRate
 * - Invoice Analytics: status distribution, aging buckets, avg days to payment
 * - Customer Analytics: active/new customers, avgLTV, segments, geography
 * - Payment Analytics: totals by method, refunds, reconciliation
 *
 * Uses Payment table when available, falls back to Invoice fields (amountPaid, paidAt, paymentMethod)
 * for revenue metrics when Payment table is empty.
 *
 * Query Parameters:
 * - dateRange: last7 | last30 | last90 | thisYear | allTime | custom
 * - from: ISO date string (for custom range)
 * - to: ISO date string (for custom range)
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse date range filters from query params
    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get("dateRange");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    // Calculate date filter based on query params
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
        case "mtd":
          startDate = startOfMonth(now);
          endDate = now;
          break;
        case "ytd":
          startDate = startOfYear(now);
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

    // Build date filter for Prisma queries
    const dateFilter = startDate && endDate
      ? { gte: startDate, lte: endDate }
      : undefined;

    // Detect if Payment table has data — drives fallback logic throughout
    const paymentCount = await prisma.payment.count();
    const hasPayments = paymentCount > 0;

    // Calculate chart data range
    let chartStartDate = startDate || subMonths(startOfMonth(now), 11);
    let chartEndDate = endDate || endOfMonth(now);

    // For "allTime", find actual min/max dates from payments or paid invoices
    if (dateRange === "allTime") {
      if (hasPayments) {
        const oldestPayment = await prisma.payment.findFirst({
          orderBy: { paymentDate: "asc" },
          select: { paymentDate: true },
        });
        const newestPayment = await prisma.payment.findFirst({
          orderBy: { paymentDate: "desc" },
          select: { paymentDate: true },
        });

        if (oldestPayment && newestPayment) {
          chartStartDate = startOfMonth(parseUtcDate(oldestPayment.paymentDate));
          chartEndDate = endOfMonth(parseUtcDate(newestPayment.paymentDate));
        }
      } else {
        const oldestPaidInvoice = await prisma.invoice.findFirst({
          where: { status: "PAID", paidAt: { not: null } },
          orderBy: { paidAt: "asc" },
          select: { paidAt: true },
        });
        const newestPaidInvoice = await prisma.invoice.findFirst({
          where: { status: "PAID", paidAt: { not: null } },
          orderBy: { paidAt: "desc" },
          select: { paidAt: true },
        });

        if (oldestPaidInvoice?.paidAt && newestPaidInvoice?.paidAt) {
          chartStartDate = startOfMonth(parseUtcDate(oldestPaidInvoice.paidAt));
          chartEndDate = endOfMonth(parseUtcDate(newestPaidInvoice.paidAt));
        }
      }
    }

    // ====================
    // FINANCIAL KPIs
    // ====================

    // Total Revenue — from Payment.amount or Invoice.amountPaid (PAID invoices)
    let totalRevenueInRange: number;

    if (hasPayments) {
      const totalRevenueResult = await prisma.payment.aggregate({
        where: {
          ...(dateFilter && { paymentDate: dateFilter }),
        },
        _sum: { amount: true },
      });
      totalRevenueInRange = Number(totalRevenueResult._sum.amount || 0);
    } else {
      const totalRevenueResult = await prisma.invoice.aggregate({
        where: {
          status: "PAID",
          amountPaid: { not: null },
          ...(dateFilter && { paidAt: dateFilter }),
        },
        _sum: { amountPaid: true },
      });
      totalRevenueInRange = Number(totalRevenueResult._sum.amountPaid || 0);
    }

    // MRR - Monthly Recurring Revenue (average per month in range)
    const monthsInRange = startDate && endDate
      ? Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)))
      : 3;
    const mrr = totalRevenueInRange > 0 ? totalRevenueInRange / monthsInRange : 0;

    // ARR - Annual Recurring Revenue
    const arr = mrr * 12;

    // Cash Flow - Payments received vs Invoiced in period
    const invoicedResult = await prisma.invoice.aggregate({
      where: {
        ...(dateFilter && { dueDate: dateFilter }),
        status: { notIn: ["DRAFT", "VOID"] },
      },
      _sum: { amount: true },
    });
    const cashFlow = totalRevenueInRange;
    const invoicedAmount = Number(invoicedResult._sum.amount || 0);

    // Collection Rate
    const totalInvoicedResult = await prisma.invoice.aggregate({
      where: {
        status: { notIn: ["DRAFT", "VOID"] },
        ...(dateFilter && { createdAt: dateFilter }),
      },
      _sum: { amount: true },
    });
    const totalPaidResult = await prisma.invoice.aggregate({
      where: {
        status: "PAID",
        ...(dateFilter && { paidAt: dateFilter }),
      },
      _sum: { amountPaid: true },
    });
    const totalInvoiced = Number(totalInvoicedResult._sum.amount || 0);
    const totalPaid = Number(totalPaidResult._sum.amountPaid || 0);
    const collectionRate = totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0;

    // Overdue Amount and Rate
    const overdueResult = await prisma.invoice.aggregate({
      where: {
        status: "OVERDUE",
        ...(dateFilter && { createdAt: dateFilter }),
      },
      _sum: { amount: true },
    });
    const overdueAmount = Number(overdueResult._sum.amount || 0);
    const overdueRate = totalInvoiced > 0 ? (overdueAmount / totalInvoiced) * 100 : 0;

    // Average Invoice Value
    const avgInvoiceValueResult = await prisma.invoice.aggregate({
      where: {
        status: { notIn: ["DRAFT", "VOID"] },
        ...(dateFilter && { createdAt: dateFilter }),
      },
      _avg: { amount: true },
    });
    const avgInvoiceValue = Number(avgInvoiceValueResult._avg.amount || 0);

    // ====================
    // INVOICE ANALYTICS
    // ====================

    // Invoice Status Distribution
    const invoiceStatusDist = await prisma.invoice.groupBy({
      by: ["status"],
      where: dateFilter ? { createdAt: dateFilter } : undefined,
      _count: { id: true },
      _sum: { amount: true },
    });

    // Invoice Aging Buckets
    const nowDate = new Date();
    const agingResult = await prisma.invoice.findMany({
      where: {
        status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] },
        ...(dateFilter && { createdAt: dateFilter }),
      },
      select: {
        amount: true,
        dueDate: true,
        paidAt: true,
      },
    });

    const aging = {
      "0-30": { count: 0, amount: 0 },
      "31-60": { count: 0, amount: 0 },
      "61-90": { count: 0, amount: 0 },
      "90+": { count: 0, amount: 0 },
    };

    agingResult.forEach((inv) => {
      const dueDate = new Date(inv.dueDate);
      const daysOverdue = Math.floor((nowDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const amount = Number(inv.amount);

      if (daysOverdue <= 0) {
        aging["0-30"].count++;
        aging["0-30"].amount += amount;
      } else if (daysOverdue <= 30) {
        aging["0-30"].count++;
        aging["0-30"].amount += amount;
      } else if (daysOverdue <= 60) {
        aging["31-60"].count++;
        aging["31-60"].amount += amount;
      } else if (daysOverdue <= 90) {
        aging["61-90"].count++;
        aging["61-90"].amount += amount;
      } else {
        aging["90+"].count++;
        aging["90+"].amount += amount;
      }
    });

    // Average Days to Payment
    const paidInvoices = await prisma.invoice.findMany({
      where: {
        status: "PAID",
        paidAt: { not: null },
        ...(dateFilter && { createdAt: dateFilter }),
      },
      select: {
        createdAt: true,
        paidAt: true,
      },
      take: 1000,
    });

    let avgDaysToPayment = 0;
    if (paidInvoices.length > 0) {
      const totalDays = paidInvoices.reduce((sum, inv) => {
        if (inv.paidAt && inv.createdAt) {
          const days = Math.floor(
            (new Date(inv.paidAt).getTime() - new Date(inv.createdAt).getTime()) / (1000 * 60 * 60 * 24)
          );
          return sum + Math.max(0, days);
        }
        return sum;
      }, 0);
      avgDaysToPayment = Math.round(totalDays / paidInvoices.length);
    }

    // Invoice Volume Trends
    const invoiceTrendStartDate = startDate || subMonths(startOfMonth(now), 11);
    const invoicesByMonth = await prisma.invoice.groupBy({
      by: ["createdAt"],
      where: {
        createdAt: { gte: invoiceTrendStartDate },
        status: { notIn: ["DRAFT", "VOID"] },
      },
      _count: { id: true },
      _sum: { amount: true },
    });

    // ====================
    // CUSTOMER ANALYTICS
    // ====================

    // Active Customers (with invoices in period)
    const activeCustomersResult = await prisma.invoice.findMany({
      where: dateFilter ? { createdAt: dateFilter } : undefined,
      distinct: ["customerId"],
      select: { customerId: true },
    });
    const activeCustomers = activeCustomersResult.length;

    // New Customers (created in period)
    const newCustomersResult = await prisma.customer.count({
      where: {
        ...(dateFilter && { createdAt: dateFilter }),
      },
    });
    const newCustomers = newCustomersResult;

    // Average LTV — from Payment or Invoice (paid) data
    const customerPayments = new Map<string, number>();

    if (hasPayments) {
      const paymentsForLtv = await prisma.payment.findMany({
        where: {
          ...(dateFilter && { paymentDate: dateFilter }),
        },
        select: { customerId: true, amount: true },
      });

      paymentsForLtv.forEach((p) => {
        const current = customerPayments.get(p.customerId) || 0;
        customerPayments.set(p.customerId, current + Number(p.amount));
      });
    } else {
      const invoicesForLtv = await prisma.invoice.findMany({
        where: {
          status: "PAID",
          amountPaid: { not: null },
          ...(dateFilter && { paidAt: dateFilter }),
        },
        select: { customerId: true, amountPaid: true },
      });

      invoicesForLtv.forEach((inv) => {
        const current = customerPayments.get(inv.customerId) || 0;
        customerPayments.set(inv.customerId, current + Number(inv.amountPaid || 0));
      });
    }

    // Get customer details for segments and top customers
    const customerIds = Array.from(customerPayments.keys());
    const customersWithPayments = customerIds.length > 0
      ? await prisma.customer.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, name: true, qbTotalPaid: true },
        })
      : [];

    // Update with actual paid amounts from date-filtered data
    const customersWithLtv = customersWithPayments.map((c) => ({
      ...c,
      totalPaidInRange: customerPayments.get(c.id) || 0,
    }));

    let avgLtv = 0;
    if (customersWithLtv.length > 0) {
      const totalLtv = customersWithLtv.reduce((sum, c) => sum + c.totalPaidInRange, 0);
      avgLtv = totalLtv / customersWithLtv.length;
    }

    // Customer Segments by Revenue
    const segments = {
      "Premium ($10k+)": { count: 0, revenue: 0 },
      "High ($5k-10k)": { count: 0, revenue: 0 },
      "Medium ($1k-5k)": { count: 0, revenue: 0 },
      "Low (<$1k)": { count: 0, revenue: 0 },
    };

    customersWithLtv.forEach((c) => {
      const paid = c.totalPaidInRange;
      if (paid >= 10000) {
        segments["Premium ($10k+)"].count++;
        segments["Premium ($10k+)"].revenue += paid;
      } else if (paid >= 5000) {
        segments["High ($5k-10k)"].count++;
        segments["High ($5k-10k)"].revenue += paid;
      } else if (paid >= 1000) {
        segments["Medium ($1k-5k)"].count++;
        segments["Medium ($1k-5k)"].revenue += paid;
      } else {
        segments["Low (<$1k)"].count++;
        segments["Low (<$1k)"].revenue += paid;
      }
    });

    // Geographic Distribution
    const geoResult = await prisma.customer.groupBy({
      by: ["state"],
      where: {
        state: { not: null },
      },
      _count: { id: true },
      _sum: { qbTotalPaid: true },
    });

    // ====================
    // PAYMENT ANALYTICS
    // ====================

    // Total Payments, Payments by Method, Avg Payment Amount — from Payment or Invoice
    let totalPaymentsCount: number;
    let paymentsByMethod: { method: string; count: number; amount: number }[];
    let avgPaymentAmount: number;

    if (hasPayments) {
      const totalPaymentsResult = await prisma.payment.aggregate({
        where: dateFilter ? { paymentDate: dateFilter } : undefined,
        _count: { id: true },
        _sum: { amount: true },
      });
      totalPaymentsCount = totalPaymentsResult._count.id;

      const paymentsByMethodResult = await prisma.payment.groupBy({
        by: ["paymentMethod"],
        where: dateFilter ? { paymentDate: dateFilter } : undefined,
        _count: { id: true },
        _sum: { amount: true },
      });
      paymentsByMethod = paymentsByMethodResult.map((item) => ({
        method: item.paymentMethod || "Unknown",
        count: item._count.id,
        amount: Number(item._sum.amount || 0),
      }));

      const avgPaymentAmountResult = await prisma.payment.aggregate({
        where: dateFilter ? { paymentDate: dateFilter } : undefined,
        _avg: { amount: true },
      });
      avgPaymentAmount = Number(avgPaymentAmountResult._avg.amount || 0);
    } else {
      const totalPaidInvoicesResult = await prisma.invoice.aggregate({
        where: {
          status: "PAID",
          amountPaid: { not: null },
          ...(dateFilter && { paidAt: dateFilter }),
        },
        _count: { id: true },
        _sum: { amountPaid: true },
        _avg: { amountPaid: true },
      });
      totalPaymentsCount = totalPaidInvoicesResult._count.id;
      avgPaymentAmount = Number(totalPaidInvoicesResult._avg.amountPaid || 0);

      const invoicesByMethodResult = await prisma.invoice.groupBy({
        by: ["paymentMethod"],
        where: {
          status: "PAID",
          amountPaid: { not: null },
          ...(dateFilter && { paidAt: dateFilter }),
        },
        _count: { id: true },
        _sum: { amountPaid: true },
      });
      paymentsByMethod = invoicesByMethodResult.map((item) => ({
        method: item.paymentMethod || "Unknown",
        count: item._count.id,
        amount: Number(item._sum.amountPaid || 0),
      }));
    }

    // Refunds
    const refundsResult = await prisma.invoice.aggregate({
      where: {
        status: { in: ["REFUNDED", "PARTIALLY_REFUNDED"] },
        ...(dateFilter && { updatedAt: dateFilter }),
      },
      _count: { id: true },
      _sum: { amountRefunded: true },
    });

    // ====================
    // CHART DATA
    // ====================

    // Revenue Trend chart data
    const revenueByMonthMap = new Map<string, { revenue: number; invoices: number }>();
    eachMonthOfInterval({
      start: chartStartDate,
      end: chartEndDate,
    }).forEach((month) => {
      const key = format(month, "yyyy-MM");
      revenueByMonthMap.set(key, { revenue: 0, invoices: 0 });
    });

    // Revenue trend data source — Payment or paid Invoice
    type TrendItem = { date: Date; amount: number };
    let trendData: TrendItem[];

    if (hasPayments) {
      const paymentsForTrend = await prisma.payment.findMany({
        where: {
          paymentDate: { gte: chartStartDate, lte: chartEndDate },
        },
        select: { paymentDate: true, amount: true },
      });
      trendData = paymentsForTrend.map((p) => ({
        date: parseUtcDate(p.paymentDate),
        amount: Number(p.amount),
      }));
    } else {
      const invoicesForTrend = await prisma.invoice.findMany({
        where: {
          status: "PAID",
          amountPaid: { not: null },
          paidAt: { gte: chartStartDate, lte: chartEndDate },
        },
        select: { paidAt: true, amountPaid: true },
      });
      trendData = invoicesForTrend
        .filter((inv): inv is typeof inv & { paidAt: Date; amountPaid: NonNullable<typeof inv.amountPaid> } => inv.paidAt !== null && inv.amountPaid !== null)
        .map((inv) => ({
          date: parseUtcDate(inv.paidAt),
          amount: Number(inv.amountPaid),
        }));
    }

    trendData.forEach((item) => {
      const key = format(startOfMonth(item.date), "yyyy-MM");
      const existing = revenueByMonthMap.get(key) || { revenue: 0, invoices: 0 };
      revenueByMonthMap.set(key, {
        revenue: existing.revenue + item.amount,
        invoices: existing.invoices + 1,
      });
    });

    const revenueTrend = Array.from(revenueByMonthMap.entries())
      .map(([month, data]) => ({
        month: format(new Date(month + "-01"), "MMM yyyy"),
        revenue: data.revenue,
        invoices: data.invoices,
      }));

    // Invoice Status Distribution for Chart
    const invoiceStatus = invoiceStatusDist.map((item) => ({
      status: item.status,
      count: item._count.id,
      amount: Number(item._sum.amount || 0),
    }));

    // Invoice Aging for Chart
    const invoiceAging = Object.entries(aging).map(([bucket, data]) => ({
      bucket,
      count: data.count,
      amount: data.amount,
    }));

    // Top Customers by Revenue
    const topCustomers = customersWithLtv
      .sort((a, b) => b.totalPaidInRange - a.totalPaidInRange)
      .slice(0, 10)
      .map((c) => ({
        name: c.name,
        revenue: c.totalPaidInRange,
      }));

    // Customer Segments for Chart
    const customerSegments = Object.entries(segments).map(([segment, data]) => ({
      segment,
      count: data.count,
      revenue: data.revenue,
    }));

    // Geographic Distribution for Chart
    const geographicDist = geoResult.map((item) => ({
      state: item.state || "Unknown",
      customers: item._count.id,
      revenue: Number(item._sum.qbTotalPaid || 0),
    }));

    // Cash Flow Trend (Area Chart)
    const cashFlowByMonthMap = new Map<string, { received: number; invoiced: number }>();
    eachMonthOfInterval({
      start: chartStartDate,
      end: chartEndDate,
    }).forEach((month) => {
      const key = format(month, "yyyy-MM");
      cashFlowByMonthMap.set(key, { received: 0, invoiced: 0 });
    });

    // Add invoiced data
    const invoicesForCashFlow = await prisma.invoice.findMany({
      where: {
        dueDate: { gte: chartStartDate, lte: chartEndDate },
        status: { notIn: ["DRAFT", "VOID"] },
      },
      select: { dueDate: true, amount: true, status: true },
    });

    invoicesForCashFlow.forEach((inv) => {
      const key = format(startOfMonth(parseUtcDate(inv.dueDate)), "yyyy-MM");
      const existing = cashFlowByMonthMap.get(key) || { received: 0, invoiced: 0 };
      cashFlowByMonthMap.set(key, {
        received: existing.received,
        invoiced: existing.invoiced + Number(inv.amount),
      });
    });

    // Add received data — reuse trendData (payments or paid invoices)
    trendData.forEach((item) => {
      const key = format(startOfMonth(item.date), "yyyy-MM");
      const existing = cashFlowByMonthMap.get(key) || { received: 0, invoiced: 0 };
      cashFlowByMonthMap.set(key, {
        received: existing.received + item.amount,
        invoiced: existing.invoiced,
      });
    });

    const cashFlowChartData = Array.from(cashFlowByMonthMap.entries())
      .map(([month, data]) => ({
        month: format(new Date(month + "-01"), "MMM yyyy"),
        received: data.received,
        invoiced: data.invoiced,
      }));

    // Customer Acquisition Trend - fetch customers and group manually
    const customersForAcquisition = await prisma.customer.findMany({
      where: {
        createdAt: { gte: chartStartDate, lte: chartEndDate },
      },
      select: {
        createdAt: true,
      },
    });

    // Initialize all months with 0
    const acquisitionByMonthMap = new Map<string, number>();
    eachMonthOfInterval({
      start: chartStartDate,
      end: chartEndDate,
    }).forEach((month) => {
      const key = format(month, "yyyy-MM");
      acquisitionByMonthMap.set(key, 0);
    });

    // Group customers by month
    customersForAcquisition.forEach((customer) => {
      const key = format(startOfMonth(parseUtcDate(customer.createdAt)), "yyyy-MM");
      const existing = acquisitionByMonthMap.get(key) || 0;
      acquisitionByMonthMap.set(key, existing + 1);
    });

    const customerAcquisition = Array.from(acquisitionByMonthMap.entries())
      .map(([month, count]) => ({
        month: format(new Date(month + "-01"), "MMM yyyy"),
        new: count,
        active: 0, // Keep for backward compatibility with chart component
      }));

    // ====================
    // RESPONSE
    // ====================

    return NextResponse.json({
      kpis: {
        // Financial
        totalRevenue: cashFlow,
        mrr,
        arr,
        collectionRate: Number(collectionRate.toFixed(2)),
        overdueAmount,
        overdueRate: Number(overdueRate.toFixed(2)),
        avgInvoiceValue,
        invoicedAmount,

        // Invoice
        totalInvoices: invoiceStatusDist.reduce((sum, s) => sum + s._count.id, 0),
        avgDaysToPayment,
        overdueInvoices: aging["31-60"].count + aging["61-90"].count + aging["90+"].count,

        // Customer
        activeCustomers,
        newCustomers,
        avgLtv: Number(avgLtv.toFixed(2)),
        totalCustomers: customersWithLtv.length,

        // Payment
        totalPayments: totalPaymentsCount,
        avgPaymentAmount,
        refundsCount: refundsResult._count.id,
        refundsAmount: Number(refundsResult._sum.amountRefunded || 0),
      },
      charts: {
        revenueTrend,
        invoiceStatus,
        invoiceAging,
        topCustomers,
        paymentMethods: paymentsByMethod,
        customerSegments,
        geographicDist,
        cashFlow: cashFlowChartData,
        customerAcquisition,
      },
    });
  } catch (error) {
    console.error("Error fetching QuickBooks analytics:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch QuickBooks analytics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
