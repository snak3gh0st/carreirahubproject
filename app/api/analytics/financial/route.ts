import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { startOfMonth, subMonths, subDays, startOfYear, format } from "date-fns";
import { buildCustomerIdExclusionWhere } from "@/lib/financial/hub-exclusions";
import { getFinancialHubExcludedCustomerIds } from "@/lib/financial/hub-exclusions-db";

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/financial
 *
 * Returns aggregated financial analytics data for the BI dashboard:
 * - KPIs: totalRevenue, overdueAmount, collectionRate, activeCustomers
 * - Invoice status distribution
 * - Revenue trend (last 12 months)
 * - Top 10 customers by revenue
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
          // No date filter - show all time
          startDate = null;
          endDate = null;
          break;
      }
    }

    // Build date filter for Prisma queries
    const dateFilter = startDate && endDate
      ? {
          gte: startDate,
          lte: endDate,
        }
      : undefined;

    // Calculate date 90 days ago for active customers (or use date filter)
    const activeCustomersDateFilter = dateFilter || {
      gte: subDays(now, 90),
    };

    // Calculate date 12 months ago for revenue trend (or use date filter)
    const revenueTrendStartDate = startDate || subMonths(startOfMonth(now), 12);
    const excludedCustomerIds = await getFinancialHubExcludedCustomerIds();
    const customerIdExclusionWhere = buildCustomerIdExclusionWhere(excludedCustomerIds);
    const customerVisibilityWhere =
      excludedCustomerIds.length > 0 ? { id: { notIn: excludedCustomerIds } } : {};

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
      // Total Revenue - filter by paidAt date
      prisma.invoice.aggregate({
        where: {
          status: "PAID",
          ...customerIdExclusionWhere,
          ...(dateFilter && {
            paidAt: dateFilter,
          }),
        },
        _sum: {
          amountPaid: true,
        },
      }),

      // Overdue Amount - filter by createdAt
      prisma.invoice.aggregate({
        where: {
          status: "OVERDUE",
          ...customerIdExclusionWhere,
          ...(dateFilter && {
            createdAt: dateFilter,
          }),
        },
        _sum: {
          amount: true,
        },
      }),

      // Total Invoiced (for collection rate) - filter by createdAt
      prisma.invoice.aggregate({
        where: {
          status: {
            notIn: ["DRAFT", "VOID"], // Exclude drafts and voids from calculation
          },
          ...customerIdExclusionWhere,
          ...(dateFilter && {
            createdAt: dateFilter,
          }),
        },
        _sum: {
          amount: true,
        },
      }),

      // Total Paid (for collection rate) - filter by paidAt
      prisma.invoice.aggregate({
        where: {
          status: {
            notIn: ["DRAFT", "VOID"],
          },
          ...customerIdExclusionWhere,
          ...(dateFilter && {
            paidAt: dateFilter,
          }),
        },
        _sum: {
          amountPaid: true,
        },
      }),

      // Active Customers (distinct customers with invoices in date range)
      prisma.invoice.findMany({
        where: {
          createdAt: activeCustomersDateFilter,
          ...customerIdExclusionWhere,
        },
        distinct: ["customerId"],
        select: {
          customerId: true,
        },
      }),

      // Invoice Status Distribution (grouped by status) - filter by createdAt
      prisma.invoice.groupBy({
        by: ["status"],
        where: {
          ...(dateFilter ? { createdAt: dateFilter } : {}),
          ...customerIdExclusionWhere,
        },
        _count: {
          id: true,
        },
        _sum: {
          amount: true,
        },
      }),

      // Revenue by month - using payments for accuracy - filter by paymentDate
      prisma.payment.findMany({
        where: {
          paymentDate: {
            gte: revenueTrendStartDate,
            ...(endDate && { lte: endDate }),
          },
          ...customerIdExclusionWhere,
        },
        select: {
          paymentDate: true,
          amount: true,
        },
        orderBy: {
          paymentDate: "asc",
        },
      }),

      // Top Customers by Revenue - filter invoices by date range then aggregate
      dateFilter
        ? prisma.customer.findMany({
            where: {
              ...customerVisibilityWhere,
              invoices: {
                some: {
                  status: "PAID",
                  paidAt: dateFilter,
                },
              },
            },
            select: {
              id: true,
              name: true,
              email: true,
              invoices: {
                where: {
                  status: "PAID",
                  paidAt: dateFilter,
                },
                select: {
                  amountPaid: true,
                },
              },
            },
            take: 100, // Get more than 10 to calculate totals
          })
        : prisma.customer.findMany({
            where: {
              ...customerVisibilityWhere,
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
    let topCustomers;
    if (dateFilter) {
      // Date-filtered customers with invoices array
      topCustomers = (topCustomersByRevenue as Array<{
        id: string;
        name: string;
        email: string;
        invoices: Array<{ amountPaid: any }>;
      }>)
        .map((customer) => {
          const totalPaid = customer.invoices.reduce(
            (sum, inv) => sum + Number(inv.amountPaid || 0),
            0
          );
          return {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            totalPaid,
          };
        })
        .sort((a, b) => b.totalPaid - a.totalPaid)
        .slice(0, 10);
    } else {
      // All-time customers with qbTotalPaid
      topCustomers = (topCustomersByRevenue as Array<{
        id: string;
        name: string;
        email: string;
        qbTotalPaid: any;
      }>).map((customer) => ({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        totalPaid: Number(customer.qbTotalPaid || 0),
      }));
    }

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
