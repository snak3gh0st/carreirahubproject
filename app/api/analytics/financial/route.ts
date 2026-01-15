import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { startOfMonth, subMonths, format } from "date-fns";

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/financial
 *
 * Returns aggregated financial analytics data for the BI dashboard:
 * - KPIs: totalRevenue, overdueAmount, collectionRate, activeCustomers
 * - Invoice status distribution
 * - Revenue trend (last 12 months)
 * - Top 10 customers by revenue
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

    // Calculate date 90 days ago for active customers
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Calculate date 12 months ago for revenue trend
    const twelveMonthsAgo = subMonths(startOfMonth(new Date()), 12);

    // Parallel queries for better performance
    const [
      // KPI: Total Revenue (sum of amountPaid where status = PAID)
      totalRevenueResult,

      // KPI: Overdue Amount (sum of amount where status = OVERDUE)
      overdueAmountResult,

      // KPI: Collection Rate calculation (total invoiced and total paid)
      totalInvoicedResult,
      totalPaidResult,

      // KPI: Active Customers (distinct customers with invoices in last 90 days)
      activeCustomersResult,

      // Invoice Status Distribution
      invoiceStatusDistribution,

      // Revenue Trend - Payments grouped by month (last 12 months)
      revenueByMonth,

      // Top 10 Customers by Revenue
      topCustomersByRevenue,
    ] = await Promise.all([
      // Total Revenue
      prisma.invoice.aggregate({
        where: {
          status: "PAID",
        },
        _sum: {
          amountPaid: true,
        },
      }),

      // Overdue Amount
      prisma.invoice.aggregate({
        where: {
          status: "OVERDUE",
        },
        _sum: {
          amount: true,
        },
      }),

      // Total Invoiced (for collection rate)
      prisma.invoice.aggregate({
        where: {
          status: {
            notIn: ["DRAFT", "VOID"], // Exclude drafts and voids from calculation
          },
        },
        _sum: {
          amount: true,
        },
      }),

      // Total Paid (for collection rate)
      prisma.invoice.aggregate({
        where: {
          status: {
            notIn: ["DRAFT", "VOID"],
          },
        },
        _sum: {
          amountPaid: true,
        },
      }),

      // Active Customers (distinct customers with invoices in last 90 days)
      prisma.invoice.findMany({
        where: {
          createdAt: {
            gte: ninetyDaysAgo,
          },
        },
        distinct: ["customerId"],
        select: {
          customerId: true,
        },
      }),

      // Invoice Status Distribution (grouped by status)
      prisma.invoice.groupBy({
        by: ["status"],
        _count: {
          id: true,
        },
        _sum: {
          amount: true,
        },
      }),

      // Revenue by month - using payments for accuracy
      prisma.payment.findMany({
        where: {
          paymentDate: {
            gte: twelveMonthsAgo,
          },
        },
        select: {
          paymentDate: true,
          amount: true,
        },
        orderBy: {
          paymentDate: "asc",
        },
      }),

      // Top Customers by Revenue - using Customer.qbTotalPaid from QB sync
      prisma.customer.findMany({
        where: {
          qbTotalPaid: {
            gt: 0,
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          qbTotalPaid: true,
        },
        orderBy: {
          qbTotalPaid: "desc",
        },
        take: 10,
      }),
    ]);

    // Calculate KPIs
    const totalRevenue = Number(totalRevenueResult._sum.amountPaid || 0);
    const overdueAmount = Number(overdueAmountResult._sum.amount || 0);
    const totalInvoiced = Number(totalInvoicedResult._sum.amount || 0);
    const totalPaid = Number(totalPaidResult._sum.amountPaid || 0);
    const collectionRate = totalInvoiced > 0
      ? (totalPaid / totalInvoiced) * 100
      : 0;
    const activeCustomers = activeCustomersResult.length;

    // Format invoice status distribution
    const formattedInvoiceStatus = invoiceStatusDistribution.map((item) => ({
      status: item.status,
      count: item._count.id,
      value: Number(item._sum.amount || 0),
    }));

    // Format revenue trend by month
    const revenueByMonthMap = new Map<string, number>();

    // Initialize last 12 months with zero values
    for (let i = 0; i < 12; i++) {
      const month = subMonths(startOfMonth(new Date()), 11 - i);
      const monthKey = format(month, "yyyy-MM");
      revenueByMonthMap.set(monthKey, 0);
    }

    // Populate with actual payment data
    revenueByMonth.forEach((payment) => {
      const monthKey = format(startOfMonth(payment.paymentDate), "yyyy-MM");
      const currentTotal = revenueByMonthMap.get(monthKey) || 0;
      revenueByMonthMap.set(monthKey, currentTotal + Number(payment.amount));
    });

    // Convert to array format for chart
    const revenueTrend = Array.from(revenueByMonthMap.entries())
      .map(([month, revenue]) => ({
        month: format(new Date(month + "-01"), "MMM yyyy"), // "Jan 2025"
        revenue: revenue,
      }));

    // Format top customers
    const topCustomers = topCustomersByRevenue.map((customer) => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      totalPaid: Number(customer.qbTotalPaid || 0),
    }));

    // Return complete analytics response
    return NextResponse.json({
      kpis: {
        totalRevenue,
        overdueAmount,
        collectionRate: Number(collectionRate.toFixed(2)),
        activeCustomers,
      },
      invoiceStatusDistribution: formattedInvoiceStatus,
      revenueTrend,
      topCustomers,
    });
  } catch (error) {
    console.error("Error fetching financial analytics:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch financial analytics",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
