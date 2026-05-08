import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/analytics/financial-bi/diagnose
// Shows raw QB P&L cache content for debugging breakeven calculation.
export async function GET() {
  const [pnlCache, bsCache] = await Promise.all([
    prisma.qbReportCache.findUnique({ where: { reportType: "ProfitAndLoss" } }),
    prisma.qbReportCache.findUnique({ where: { reportType: "BalanceSheet" } }),
  ]);

  if (!pnlCache) {
    return NextResponse.json({ error: "No P&L cache found. Run QB sync first." }, { status: 404 });
  }

  const pnl = JSON.parse(pnlCache.data);
  const bs = bsCache ? JSON.parse(bsCache.data) : null;

  const expensesByMonth: number[] = pnl.expenses?.byMonth || [];
  const cogsByMonth: number[] = pnl.cogs?.byMonth || [];
  const incomeByMonth: number[] = pnl.income?.byMonth || [];

  const activeMonthsByExpenses = expensesByMonth.filter((v: number) => v > 0).length;
  const activeMonthsByCogs = cogsByMonth.filter((v: number) => v > 0).length;
  const activeMonthsByIncome = incomeByMonth.filter((v: number) => v > 0).length;

  // Combined: months where either expenses or COGS > 0
  const maxLen = Math.max(expensesByMonth.length, cogsByMonth.length);
  const activeMonthsCombined = Array.from({ length: maxLen }, (_, i) =>
    (expensesByMonth[i] || 0) + (cogsByMonth[i] || 0)
  ).filter((v) => v > 0).length;

  const totalExp = (pnl.expenses?.total || 0) + (pnl.cogs?.total || 0);

  return NextResponse.json({
    cacheParameters: pnlCache.parameters ? JSON.parse(pnlCache.parameters as string) : null,
    fetchedAt: pnlCache.fetchedAt,
    months: pnl.months,
    monthCount: pnl.months?.length || 0,
    income: {
      total: pnl.income?.total,
      byMonth: incomeByMonth,
      activeMonths: activeMonthsByIncome,
    },
    cogs: {
      total: pnl.cogs?.total,
      byMonth: cogsByMonth,
      activeMonths: activeMonthsByCogs,
    },
    expenses: {
      total: pnl.expenses?.total,
      byMonth: expensesByMonth,
      activeMonths: activeMonthsByExpenses,
      topCategories: (pnl.expenses?.byCategory || []).slice(0, 10),
    },
    netIncome: {
      total: pnl.netIncome?.total,
      byMonth: pnl.netIncome?.byMonth || [],
    },
    breakeven: {
      totalExpensesAndCogs: totalExp,
      usingRawMonthCount: pnl.months?.length || 1,
      usingActiveExpenseMonths: activeMonthsByExpenses || 1,
      usingActiveCombinedMonths: activeMonthsCombined || 1,
      breakevenRawMonths: totalExp / (pnl.months?.length || 1),
      breakevenActiveExpenseMonths: totalExp / (activeMonthsByExpenses || 1),
      breakevenActiveCombinedMonths: totalExp / (activeMonthsCombined || 1),
    },
    balanceSheet: bs ? {
      cashOnHand: bs.bankAccounts?.total,
      accounts: bs.bankAccounts?.accounts,
    } : null,
  });
}
