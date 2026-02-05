import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { startOfMonth, subMonths, subDays, startOfYear, format, eachMonthOfInterval, endOfMonth } from "date-fns";

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

    // Calculate 12 months ago for revenue trend
    const revenueTrendStartDate = startDate || subMonths(startOfMonth(now), 11);
    const twelveMonthsAgo = subMonths(startOfMonth(now), 11); // Kept for chart data

    // ====================
    // FINANCIAL KPIs
    // ====================

    // Total Revenue (all payments received)
    const totalRevenueResult = await prisma.payment.aggregate({
      where: {
        ...(dateFilter && { paymentDate: dateFilter }),
      },
      _sum: { amount: true },
    });

    // MRR - Monthly Recurring Revenue (average of last 3 months)
    // FIXED: Now uses dateFilter to calculate MRR based on payments in range
    const totalRevenueInRange = Number(totalRevenueResult._sum.amount || 0);
    const monthsInRange = startDate && endDate
      ? Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)))
      : 3;
    const mrr = totalRevenueInRange > 0 ? totalRevenueInRange / monthsInRange : 0;

    // ARR - Annual Recurring Revenue
    const arr = mrr * 12;

    // Cash Flow - Payments received vs Invoiced in period
    const invoicedResult = await prisma.invoice.aggregate({
      where: {
        ...(dateFilter && { createdAt: dateFilter }),
        status: { notIn: ["DRAFT", "VOID"] },
      },
      _sum: { amount: true },
    });
    const cashFlow = Number(totalRevenueResult._sum.amount || 0);
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
    // FIXED: Added dateFilter to filter by createdAt in date range
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
    // FIXED: Added dateFilter to filter invoices by createdAt in date range
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
    // FIXED: Added dateFilter to filter by createdAt in date range
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
    // FIXED: Now uses dateFilter instead of fixed 12 months
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

    // Average LTV
    // FIXED: Now calculates from payments in dateFilter instead of all-time qbTotalPaid
    const paymentsForLtv = await prisma.payment.findMany({
      where: {
        ...(dateFilter && { paymentDate: dateFilter }),
      },
      select: { customerId: true, amount: true },
    });

    // Aggregate payments by customer
    const customerPayments = new Map<string, number>();
    paymentsForLtv.forEach((p) => {
      const current = customerPayments.get(p.customerId) || 0;
      customerPayments.set(p.customerId, current + Number(p.amount));
    });

    // Get customer details for segments and top customers
    const customerIds = Array.from(customerPayments.keys());
    const customersWithPayments = customerIds.length > 0
      ? await prisma.customer.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, name: true, qbTotalPaid: true },
        })
      : [];

    // Update with actual paid amounts from date-filtered payments
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
    // FIXED: Now uses totalPaidInRange from date-filtered payments
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

    // Total Payments
    const totalPaymentsResult = await prisma.payment.aggregate({
      where: dateFilter ? { paymentDate: dateFilter } : undefined,
      _count: { id: true },
      _sum: { amount: true },
    });

    // Payments by Method
    const paymentsByMethodResult = await prisma.payment.groupBy({
      by: ["paymentMethod"],
      where: dateFilter ? { paymentDate: dateFilter } : undefined,
      _count: { id: true },
      _sum: { amount: true },
    });

    // Average Payment Amount
    const avgPaymentAmountResult = await prisma.payment.aggregate({
      where: dateFilter ? { paymentDate: dateFilter } : undefined,
      _avg: { amount: true },
    });
    const avgPaymentAmount = Number(avgPaymentAmountResult._avg.amount || 0);

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

    // Revenue Trend (12 months)
    const revenueByMonthMap = new Map<string, { revenue: number; invoices: number }>();
    eachMonthOfInterval({
      start: twelveMonthsAgo,
      end: endOfMonth(now),
    }).forEach((month) => {
      const key = format(month, "yyyy-MM");
      revenueByMonthMap.set(key, { revenue: 0, invoices: 0 });
    });

    // Add payment data
    const paymentsForTrend = await prisma.payment.findMany({
      where: {
        paymentDate: { gte: twelveMonthsAgo },
      },
      select: { paymentDate: true, amount: true },
    });

    paymentsForTrend.forEach((p) => {
      const key = format(startOfMonth(new Date(p.paymentDate)), "yyyy-MM");
      const existing = revenueByMonthMap.get(key) || { revenue: 0, invoices: 0 };
      revenueByMonthMap.set(key, {
        revenue: existing.revenue + Number(p.amount),
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
    // FIXED: Now uses totalPaidInRange from date-filtered payments
    const topCustomers = customersWithLtv
      .sort((a, b) => b.totalPaidInRange - a.totalPaidInRange)
      .slice(0, 10)
      .map((c) => ({
        name: c.name,
        revenue: c.totalPaidInRange,
      }));

    // Payment Methods for Chart
    const paymentMethods = paymentsByMethodResult.map((item) => ({
      method: item.paymentMethod || "Unknown",
      count: item._count.id,
      amount: Number(item._sum.amount || 0),
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

    // Cash Flow Trend (Area Chart) - payments vs invoiced by month
    const cashFlowByMonthMap = new Map<string, { received: number; invoiced: number }>();
    eachMonthOfInterval({
      start: twelveMonthsAgo,
      end: endOfMonth(now),
    }).forEach((month) => {
      const key = format(month, "yyyy-MM");
      cashFlowByMonthMap.set(key, { received: 0, invoiced: 0 });
    });

    // Add invoiced data
    const invoicesForCashFlow = await prisma.invoice.findMany({
      where: {
        createdAt: { gte: twelveMonthsAgo },
        status: { notIn: ["DRAFT", "VOID"] },
      },
      select: { createdAt: true, amount: true, status: true },
    });

    invoicesForCashFlow.forEach((inv) => {
      const key = format(startOfMonth(new Date(inv.createdAt)), "yyyy-MM");
      const existing = cashFlowByMonthMap.get(key) || { received: 0, invoiced: 0 };
      cashFlowByMonthMap.set(key, {
        received: existing.received,
        invoiced: existing.invoiced + Number(inv.amount),
      });
    });

    // Add received data (payments)
    paymentsForTrend.forEach((p) => {
      const key = format(startOfMonth(new Date(p.paymentDate)), "yyyy-MM");
      const existing = cashFlowByMonthMap.get(key) || { received: 0, invoiced: 0 };
      cashFlowByMonthMap.set(key, {
        received: existing.received + Number(p.amount),
        invoiced: existing.invoiced,
      });
    });

    const cashFlowChartData = Array.from(cashFlowByMonthMap.entries())
      .map(([month, data]) => ({
        month: format(new Date(month + "-01"), "MMM yyyy"),
        received: data.received,
        invoiced: data.invoiced,
      }));

    // Customer Acquisition Trend
    const newCustomersByMonth = await prisma.customer.groupBy({
      by: ["createdAt"],
      where: {
        createdAt: { gte: twelveMonthsAgo },
      },
      _count: { id: true },
    });

    const acquisitionByMonthMap = new Map<string, { new: number; active: number }>();
    eachMonthOfInterval({
      start: twelveMonthsAgo,
      end: endOfMonth(now),
    }).forEach((month) => {
      const key = format(month, "yyyy-MM");
      acquisitionByMonthMap.set(key, { new: 0, active: 0 });
    });

    newCustomersByMonth.forEach((c) => {
      const key = format(startOfMonth(new Date(c.createdAt)), "yyyy-MM");
      const existing = acquisitionByMonthMap.get(key) || { new: 0, active: 0 };
      acquisitionByMonthMap.set(key, {
        new: existing.new + c._count.id,
        active: existing.active,
      });
    });

    const customerAcquisition = Array.from(acquisitionByMonthMap.entries())
      .map(([month, data]) => ({
        month: format(new Date(month + "-01"), "MMM yyyy"),
        new: data.new,
        active: data.active,
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
        totalPayments: totalPaymentsResult._count.id,
        avgPaymentAmount,
        refundsCount: refundsResult._count.id,
        refundsAmount: Number(refundsResult._sum.amountRefunded || 0),
      },
      charts: {
        revenueTrend,
        invoiceStatus,
        invoiceAging,
        topCustomers,
        paymentMethods,
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
