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
        },
      },
      select: { paidAt: true, amountPaid: true },
      orderBy: { paidAt: "asc" },
    });

    console.log(`Total paid invoices: ${revenueByMonth.length}`);

    // Format revenue trend with proper year/month grouping (NEW LOGIC)
    const revenueByMonthMap = new Map<string, number>();

    // Calculate date range from data
    let minDate = new Date();
    let maxDate = new Date(now.getTime() - 12 * 30 * 24 * 60 * 60 * 1000);

    if (revenueByMonth.length > 0) {
      revenueByMonth.forEach((inv) => {
        if (inv.paidAt) {
          const d = new Date(inv.paidAt);
          if (d < minDate) minDate = d;
          if (d > maxDate) maxDate = d;
        }
      });
    }

    console.log(`Date range: ${minDate.toISOString()} to ${maxDate.toISOString()}`);

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

    return NextResponse.json({
      summary: {
        totalInvoices: revenueByMonth.length,
        monthCount: revenueByMonthMap.size,
      },
      revenueTrend: revenueTrend.slice(0, 15),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
