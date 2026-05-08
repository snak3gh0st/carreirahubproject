import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildCustomerIdExclusionWhere } from "@/lib/financial/hub-exclusions";
import { getFinancialHubExcludedCustomerIds } from "@/lib/financial/hub-exclusions-db";
import { addDays, format, differenceInDays, subDays, startOfMonth, startOfYear } from "date-fns";

export const dynamic = "force-dynamic";

/**
 * Customer Payment Pattern Analysis
 */
interface CustomerPaymentPattern {
  customerId: string;
  customerName: string;
  avgDaysToPayment: number;
  onTimePaymentRate: number; // % of invoices paid by due date
  totalInvoicesPaid: number;
  totalRevenue: number;
  lastPaymentDate: Date | null;
  currentOutstanding: number;
}

/**
 * Invoice Forecast Details
 */
interface InvoiceForecast {
  invoiceId: string;
  invoiceNumber: string | null;
  customerId: string;
  customerName: string;
  amount: number;
  dueDate: Date;
  daysOverdue: number;
  status: string;
  predictedPaymentDate: Date;
  collectionProbability: number; // 0-100
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reasonForRisk: string[];
  isStale: boolean; // Invoice > 180 days overdue (likely bad debt)
}

/**
 * Cash Flow Projection by Period
 */
interface CashFlowProjection {
  period: string; // "next7", "next30", "next60", "next90"
  periodLabel: string;
  expectedAmount: number;
  pessimisticAmount: number; // Weighted by collection probability
  optimisticAmount: number; // Assuming all paid
  invoiceCount: number;
  avgCollectionProbability: number;
}

/**
 * GET /api/analytics/receivables-forecast
 *
 * Returns comprehensive receivables forecasting data:
 * - Customer payment patterns (historical analysis)
 * - Invoice-level collection predictions
 * - Cash flow projections (7/30/60/90 days)
 * - At-risk invoices identification
 * - Overall receivables health metrics
 *
 * Query Parameters:
 * - dateRange: last7 | last30 | last90 | mtd | ytd | thisYear | allTime | custom
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

    const now = new Date();

    // Parse date range filters from query params
    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get("dateRange");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    // Calculate date filter based on query params
    let startDate: Date | null = null;
    let endDate: Date | null = null;

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
    const excludedCustomerIds = await getFinancialHubExcludedCustomerIds();
    const customerVisibilityWhere = buildCustomerIdExclusionWhere(excludedCustomerIds);

    // ==========================================
    // STEP 1: Analyze Customer Payment Patterns
    // ==========================================

    // Get all paid invoices with customer and payment data (filtered by date range)
    const paidInvoices = await prisma.invoice.findMany({
      where: {
        status: "PAID",
        paidAt: { not: null },
        ...(dateFilter && { paidAt: dateFilter }),
        ...customerVisibilityWhere,
      },
      select: {
        id: true,
        amount: true,
        amountPaid: true,
        dueDate: true,
        paidAt: true,
        createdAt: true,
        customerId: true,
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { paidAt: "desc" },
      take: 10000, // Limit for performance
    });

    // Check if we have Payment table data (more reliable than invoice.paidAt)
    const paymentCount = await prisma.payment.count({
      where: customerVisibilityWhere,
    });
    const usePaymentTable = paymentCount > 0;

    // Build customer payment patterns using Payment table if available
    const customerPatternsMap = new Map<string, {
      customerId: string;
      customerName: string;
      totalInvoices: number;
      totalAmount: number;
      totalDaysToPayment: number;
      validPaymentCount: number; // Only count valid dates
      onTimeCount: number;
      lastPaymentDate: Date | null;
    }>();

    if (usePaymentTable) {
      // Use Payment table (more reliable)
      const payments = await prisma.payment.findMany({
        where: {
          invoice: {
            status: "PAID",
          },
          ...(dateFilter && { paymentDate: dateFilter }),
          ...customerVisibilityWhere,
        },
        select: {
          customerId: true,
          amount: true,
          paymentDate: true,
          invoice: {
            select: {
              createdAt: true,
              dueDate: true,
              customer: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        take: 10000,
      });

      payments.forEach((payment) => {
        const customerId = payment.customerId;
        const customerName = payment.invoice.customer.name;

        // Calculate days to payment (validate dates)
        const paymentDate = new Date(payment.paymentDate);
        const createdDate = new Date(payment.invoice.createdAt);
        const daysToPayment = differenceInDays(paymentDate, createdDate);

        // Skip invalid data (payment before creation or unrealistic delays)
        if (daysToPayment < 0 || daysToPayment > 730) {
          return; // Skip this payment
        }

        const paidOnTime = payment.invoice.dueDate
          ? paymentDate <= new Date(payment.invoice.dueDate)
          : false;

        if (!customerPatternsMap.has(customerId)) {
          customerPatternsMap.set(customerId, {
            customerId,
            customerName,
            totalInvoices: 0,
            totalAmount: 0,
            totalDaysToPayment: 0,
            validPaymentCount: 0,
            onTimeCount: 0,
            lastPaymentDate: null,
          });
        }

        const pattern = customerPatternsMap.get(customerId)!;
        pattern.totalInvoices += 1;
        pattern.validPaymentCount += 1;
        pattern.totalAmount += Number(payment.amount);
        pattern.totalDaysToPayment += daysToPayment;
        if (paidOnTime) pattern.onTimeCount += 1;
        if (!pattern.lastPaymentDate || paymentDate > pattern.lastPaymentDate) {
          pattern.lastPaymentDate = paymentDate;
        }
      });
    } else {
      // Fallback: Use Invoice.paidAt (less reliable)
      paidInvoices.forEach((invoice) => {
        const customerId = invoice.customerId;

        // Calculate days to payment (validate dates)
        if (!invoice.paidAt || !invoice.createdAt) return;

        const paidDate = new Date(invoice.paidAt);
        const createdDate = new Date(invoice.createdAt);
        const daysToPayment = differenceInDays(paidDate, createdDate);

        // Skip invalid data (payment before creation or unrealistic delays)
        if (daysToPayment < 0 || daysToPayment > 730) {
          return; // Skip this invoice
        }

        const paidOnTime = invoice.dueDate
          ? paidDate <= new Date(invoice.dueDate)
          : false;

        if (!customerPatternsMap.has(customerId)) {
          customerPatternsMap.set(customerId, {
            customerId,
            customerName: invoice.customer.name,
            totalInvoices: 0,
            totalAmount: 0,
            totalDaysToPayment: 0,
            validPaymentCount: 0,
            onTimeCount: 0,
            lastPaymentDate: null,
          });
        }

        const pattern = customerPatternsMap.get(customerId)!;
        pattern.totalInvoices += 1;
        pattern.validPaymentCount += 1;
        pattern.totalAmount += Number(invoice.amountPaid || invoice.amount);
        pattern.totalDaysToPayment += daysToPayment;
        if (paidOnTime) pattern.onTimeCount += 1;
        if (!pattern.lastPaymentDate || paidDate > pattern.lastPaymentDate) {
          pattern.lastPaymentDate = paidDate;
        }
      });
    }

    // Get current outstanding balance per customer
    const outstandingByCustomer = await prisma.invoice.groupBy({
      by: ["customerId"],
      where: {
        status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] },
        ...customerVisibilityWhere,
      },
      _sum: { amount: true },
    });

    const outstandingMap = new Map(
      outstandingByCustomer.map((item) => [
        item.customerId,
        Number(item._sum.amount || 0),
      ])
    );

    // Calculate customer payment patterns (using only valid data)
    const customerPatterns: CustomerPaymentPattern[] = Array.from(customerPatternsMap.values())
      .filter((pattern) => pattern.validPaymentCount > 0) // Only include customers with valid payment history
      .map((pattern) => ({
        customerId: pattern.customerId,
        customerName: pattern.customerName,
        avgDaysToPayment: pattern.validPaymentCount > 0
          ? Math.round(pattern.totalDaysToPayment / pattern.validPaymentCount)
          : 30, // Default to 30 days for new customers
        onTimePaymentRate: pattern.validPaymentCount > 0
          ? (pattern.onTimeCount / pattern.validPaymentCount) * 100
          : 50, // Default to 50% for new customers
        totalInvoicesPaid: pattern.validPaymentCount,
        totalRevenue: pattern.totalAmount,
        lastPaymentDate: pattern.lastPaymentDate,
        currentOutstanding: outstandingMap.get(pattern.customerId) || 0,
      }));

    // ==========================================
    // STEP 2: Forecast Open Invoices
    // ==========================================

    // Get all open invoices
    const openInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] },
        ...customerVisibilityWhere,
      },
      select: {
        id: true,
        invoiceNumber: true,
        amount: true,
        dueDate: true,
        status: true,
        createdAt: true,
        customerId: true,
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    // Create customer pattern lookup for quick access
    const customerPatternLookup = new Map(
      customerPatterns.map((p) => [p.customerId, p])
    );

    // Predict payment date and collection probability for each invoice
    const invoiceForecasts: InvoiceForecast[] = openInvoices.map((invoice) => {
      const customerPattern = customerPatternLookup.get(invoice.customerId);
      const daysOverdue = differenceInDays(now, new Date(invoice.dueDate));

      // Predict payment date based on customer history
      const avgDaysToPayment = customerPattern?.avgDaysToPayment || 30;
      const predictedPaymentDate = addDays(new Date(invoice.createdAt), avgDaysToPayment);

      // Calculate collection probability
      let collectionProbability = 100;
      const reasonsForRisk: string[] = [];

      // Factor 1: Customer on-time payment rate (40% weight)
      const onTimeRate = customerPattern?.onTimePaymentRate || 50;
      collectionProbability = onTimeRate * 0.4;

      // Check if invoice is stale (180+ days overdue - likely bad debt)
      const isStale = daysOverdue >= 180;
      if (isStale) {
        reasonsForRisk.push(`STALE: ${daysOverdue} days overdue (likely bad debt)`);
      }

      // Factor 2: Days overdue (30% weight)
      if (daysOverdue > 0) {
        if (daysOverdue >= 180) {
          collectionProbability += 1; // -29% impact (very unlikely to collect)
          if (!isStale) reasonsForRisk.push(`${daysOverdue} days overdue (180+)`);
        } else if (daysOverdue > 90) {
          collectionProbability += 3; // -27% impact
          reasonsForRisk.push(`${daysOverdue} days overdue (90+)`);
        } else if (daysOverdue > 60) {
          collectionProbability += 8; // -22% impact
          reasonsForRisk.push(`${daysOverdue} days overdue (61-90)`);
        } else if (daysOverdue > 30) {
          collectionProbability += 15; // -15% impact
          reasonsForRisk.push(`${daysOverdue} days overdue (31-60)`);
        } else {
          collectionProbability += 25; // -5% impact
          reasonsForRisk.push(`${daysOverdue} days overdue`);
        }
      } else {
        collectionProbability += 30; // Not overdue yet
      }

      // Factor 3: Customer history (20% weight)
      if (customerPattern) {
        if (customerPattern.totalInvoicesPaid >= 10) {
          collectionProbability += 20; // Good history
        } else if (customerPattern.totalInvoicesPaid >= 5) {
          collectionProbability += 15; // Some history
        } else if (customerPattern.totalInvoicesPaid >= 1) {
          collectionProbability += 10; // Limited history
          reasonsForRisk.push("Limited payment history");
        } else {
          collectionProbability += 5; // New customer
          reasonsForRisk.push("New customer - no payment history");
        }
      } else {
        collectionProbability += 5; // New customer
        reasonsForRisk.push("New customer - no payment history");
      }

      // Factor 4: Outstanding balance vs. historical spend (10% weight)
      if (customerPattern) {
        const outstandingRatio = customerPattern.currentOutstanding / Math.max(customerPattern.totalRevenue, 1);
        if (outstandingRatio > 2) {
          collectionProbability += 2; // High outstanding balance
          reasonsForRisk.push("Outstanding balance exceeds historical spend");
        } else if (outstandingRatio > 1) {
          collectionProbability += 5; // Moderate outstanding balance
          reasonsForRisk.push("Outstanding balance high relative to history");
        } else {
          collectionProbability += 10; // Normal outstanding balance
        }
      } else {
        collectionProbability += 5; // Unknown
      }

      // Cap probability between 0-100
      collectionProbability = Math.max(0, Math.min(100, collectionProbability));

      // Determine risk level
      let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      if (collectionProbability >= 80) {
        riskLevel = "LOW";
      } else if (collectionProbability >= 60) {
        riskLevel = "MEDIUM";
      } else if (collectionProbability >= 40) {
        riskLevel = "HIGH";
      } else {
        riskLevel = "CRITICAL";
      }

      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId,
        customerName: invoice.customer.name,
        amount: Number(invoice.amount),
        dueDate: new Date(invoice.dueDate),
        daysOverdue,
        status: invoice.status,
        predictedPaymentDate,
        collectionProbability: Math.round(collectionProbability),
        riskLevel,
        reasonForRisk: reasonsForRisk,
        isStale: daysOverdue >= 180, // Flag invoices 180+ days overdue
      };
    });

    // ==========================================
    // STEP 3: Project Cash Flow by Period
    // ==========================================

    const periods = [
      { key: "next7", label: "Next 7 Days", days: 7 },
      { key: "next30", label: "Next 30 Days", days: 30 },
      { key: "next60", label: "Next 60 Days", days: 60 },
      { key: "next90", label: "Next 90 Days", days: 90 },
    ];

    const cashFlowProjections: CashFlowProjection[] = periods.map((period) => {
      const periodEndDate = addDays(now, period.days);

      // Filter invoices predicted to be paid within this period
      const invoicesInPeriod = invoiceForecasts.filter((forecast) => {
        return forecast.predictedPaymentDate <= periodEndDate;
      });

      const expectedAmount = invoicesInPeriod.reduce((sum, inv) => sum + inv.amount, 0);
      const pessimisticAmount = invoicesInPeriod.reduce(
        (sum, inv) => sum + (inv.amount * inv.collectionProbability / 100),
        0
      );
      const optimisticAmount = expectedAmount; // Assume all paid

      const avgProbability = invoicesInPeriod.length > 0
        ? invoicesInPeriod.reduce((sum, inv) => sum + inv.collectionProbability, 0) / invoicesInPeriod.length
        : 0;

      return {
        period: period.key,
        periodLabel: period.label,
        expectedAmount,
        pessimisticAmount,
        optimisticAmount,
        invoiceCount: invoicesInPeriod.length,
        avgCollectionProbability: Math.round(avgProbability),
      };
    });

    // ==========================================
    // STEP 4: Calculate Summary Metrics
    // ==========================================

    // Separate stale invoices from active forecasts
    const staleInvoices = invoiceForecasts.filter((inv) => inv.isStale);
    const activeInvoices = invoiceForecasts.filter((inv) => !inv.isStale);

    const totalOutstanding = invoiceForecasts.reduce((sum, inv) => sum + inv.amount, 0);
    const staleAmount = staleInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const activeAmount = activeInvoices.reduce((sum, inv) => sum + inv.amount, 0);

    const weightedOutstanding = invoiceForecasts.reduce(
      (sum, inv) => sum + (inv.amount * inv.collectionProbability / 100),
      0
    );
    const atRiskAmount = invoiceForecasts
      .filter((inv) => inv.riskLevel === "HIGH" || inv.riskLevel === "CRITICAL")
      .reduce((sum, inv) => sum + inv.amount, 0);
    const atRiskCount = invoiceForecasts.filter(
      (inv) => inv.riskLevel === "HIGH" || inv.riskLevel === "CRITICAL"
    ).length;

    const avgCollectionProbability = activeInvoices.length > 0
      ? activeInvoices.reduce((sum, inv) => sum + inv.collectionProbability, 0) / activeInvoices.length
      : 0;

    // Get top at-risk invoices (sorted by amount * risk)
    const atRiskInvoices = invoiceForecasts
      .filter((inv) => inv.riskLevel === "HIGH" || inv.riskLevel === "CRITICAL")
      .sort((a, b) => {
        const aRiskScore = a.amount * (100 - a.collectionProbability);
        const bRiskScore = b.amount * (100 - b.collectionProbability);
        return bRiskScore - aRiskScore;
      })
      .slice(0, 20); // Top 20 at-risk

    // ==========================================
    // RESPONSE
    // ==========================================

    return NextResponse.json({
      summary: {
        totalOutstanding,
        weightedOutstanding, // Adjusted by collection probability
        expectedBadDebt: totalOutstanding - weightedOutstanding,
        avgCollectionProbability: Math.round(avgCollectionProbability),
        atRiskAmount,
        atRiskCount,
        totalOpenInvoices: invoiceForecasts.length,
        // Stale invoice metrics (180+ days overdue)
        staleInvoiceCount: staleInvoices.length,
        staleAmount,
        activeInvoiceCount: activeInvoices.length,
        activeAmount,
      },
      dataQuality: {
        usingPaymentTable: usePaymentTable,
        totalCustomersWithHistory: customerPatterns.length,
        averageDaysToPayment: customerPatterns.length > 0
          ? Math.round(
              customerPatterns.reduce((sum, p) => sum + p.avgDaysToPayment, 0) / customerPatterns.length
            )
          : 0,
      },
      cashFlowProjections,
      atRiskInvoices,
      staleInvoices: staleInvoices
        .sort((a, b) => b.daysOverdue - a.daysOverdue)
        .slice(0, 20), // Top 20 stalest invoices
      customerPatterns: customerPatterns
        .sort((a, b) => b.currentOutstanding - a.currentOutstanding)
        .slice(0, 20), // Top 20 by outstanding balance
      allForecasts: activeInvoices, // Only active forecasts for charts (exclude stale)
    });
  } catch (error) {
    console.error("Error generating receivables forecast:", error);
    return NextResponse.json(
      {
        error: "Failed to generate receivables forecast",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
