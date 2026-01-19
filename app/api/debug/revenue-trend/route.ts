import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startOfMonth, format, subMonths } from "date-fns";

export async function GET() {
  try {
    const now = new Date();
    const revenueTrendStartDate = subMonths(startOfMonth(now), 12);

    // Get revenue by month (same logic as BI dashboard)
    const revenueByMonth = await prisma.invoice.findMany({
      where: {
        status: { in: ["PAID", "PARTIALLY_PAID"] },
        paidAt: {
          gte: revenueTrendStartDate,
          lte: now,
        },
      },
      select: { paidAt: true, amountPaid: true },
      orderBy: { paidAt: "asc" },
    });

    // Format revenue by month
    const revenueByMonthMap = new Map<string, number>();
    for (let i = 0; i < 12; i++) {
      const month = subMonths(startOfMonth(new Date()), 11 - i);
      const monthKey = format(month, "yyyy-MM");
      revenueByMonthMap.set(monthKey, 0);
    }

    revenueByMonth.forEach((invoice) => {
      if (invoice.paidAt) {
        const monthKey = format(startOfMonth(invoice.paidAt), "yyyy-MM");
        const current = revenueByMonthMap.get(monthKey) || 0;
        revenueByMonthMap.set(monthKey, current + Number(invoice.amountPaid || 0));
      }
    });

    const revenueTrend = Array.from(revenueByMonthMap.entries()).map(
      ([month, revenue]) => ({
        month: format(new Date(month + "-01"), "MMM"),
        revenue: Math.round(revenue),
        fullMonth: month,
      })
    );

    return NextResponse.json({
      summary: {
        invoicesInRange: revenueByMonth.length,
        totalRevenue: Math.round(revenueByMonth.reduce((sum, inv) => sum + Number(inv.amountPaid || 0), 0)),
        dateRange: {
          start: revenueTrendStartDate.toISOString(),
          end: now.toISOString(),
        },
      },
      revenueTrend,
      lastNonZeroMonth: revenueTrend.filter(m => m.revenue > 0).pop(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
