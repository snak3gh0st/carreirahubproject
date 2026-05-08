import { format } from "date-fns";

import { getQbMonthKey } from "@/lib/financial/qb-bi-helpers";
import type { ParsedPnL, ParsedPnlCategory } from "@/lib/services/qb-report-parser";

export interface CostBreakdownCategory {
  category: string;
  amount: number;
  pctOfCogs?: number;
  pctOfExpenses?: number;
}

export interface CostBreakdown {
  periodLabel: string;
  revenue: number;
  cogsTotal: number;
  operatingExpensesTotal: number;
  totalCost: number;
  grossMarginPct: number;
  cogsToExpenseRatio: number | null;
  cogsSharePct: number;
  expensesSharePct: number;
  cogsByCategory: Array<CostBreakdownCategory & { pctOfCogs: number }>;
  expensesByCategory: Array<CostBreakdownCategory & { pctOfExpenses: number }>;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundPct(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundRatio(value: number): number {
  return Math.round(value * 100) / 100;
}

function getMonthIndex(pnl: ParsedPnL, now: Date): number {
  const currentMonthKey = format(now, "yyyy-MM");
  const currentIndex = pnl.months.findIndex((label) => getQbMonthKey(label) === currentMonthKey);
  if (currentIndex >= 0) return currentIndex;
  return pnl.months.length > 0 ? pnl.months.length - 1 : -1;
}

function valueForPeriod(total: number, byMonth: number[] | undefined, monthIndex: number): number {
  if (monthIndex >= 0 && byMonth && byMonth.length > monthIndex) {
    return Number(byMonth[monthIndex] || 0);
  }

  return Number(total || 0);
}

function categoryAmountForPeriod(category: ParsedPnlCategory, monthIndex: number): number {
  return valueForPeriod(category.amount, category.byMonth, monthIndex);
}

function buildCategoryBreakdown<T extends "pctOfCogs" | "pctOfExpenses">(
  categories: ParsedPnlCategory[],
  total: number,
  monthIndex: number,
  pctKey: T,
): Array<CostBreakdownCategory & Record<T, number>> {
  if (total <= 0) return [];

  return categories
    .map((category) => ({
      category: category.category,
      amount: roundMoney(categoryAmountForPeriod(category, monthIndex)),
    }))
    .filter((category) => category.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((category) => ({
      ...category,
      [pctKey]: roundPct((category.amount / total) * 100),
    })) as Array<CostBreakdownCategory & Record<T, number>>;
}

export function buildCostBreakdownFromParsedPnl(
  pnl: ParsedPnL,
  options: { now?: Date } = {},
): CostBreakdown | null {
  const now = options.now ?? new Date();
  const monthIndex = getMonthIndex(pnl, now);

  const revenue = roundMoney(valueForPeriod(pnl.income.total, pnl.income.byMonth, monthIndex));
  const cogsTotal = roundMoney(valueForPeriod(pnl.cogs.total, pnl.cogs.byMonth, monthIndex));
  const operatingExpensesTotal = roundMoney(valueForPeriod(pnl.expenses.total, pnl.expenses.byMonth, monthIndex));
  const totalCost = roundMoney(cogsTotal + operatingExpensesTotal);

  if (revenue <= 0 && totalCost <= 0) return null;

  const periodLabel = monthIndex >= 0
    ? pnl.months[monthIndex] || "Cached QuickBooks P&L"
    : "Cached QuickBooks P&L";

  return {
    periodLabel,
    revenue,
    cogsTotal,
    operatingExpensesTotal,
    totalCost,
    grossMarginPct: revenue > 0 ? roundPct(((revenue - cogsTotal) / revenue) * 100) : 0,
    cogsToExpenseRatio: operatingExpensesTotal > 0 ? roundRatio(cogsTotal / operatingExpensesTotal) : null,
    cogsSharePct: totalCost > 0 ? roundPct((cogsTotal / totalCost) * 100) : 0,
    expensesSharePct: totalCost > 0 ? roundPct((operatingExpensesTotal / totalCost) * 100) : 0,
    cogsByCategory: buildCategoryBreakdown(pnl.cogs.byCategory || [], cogsTotal, monthIndex, "pctOfCogs"),
    expensesByCategory: buildCategoryBreakdown(pnl.expenses.byCategory || [], operatingExpensesTotal, monthIndex, "pctOfExpenses"),
  };
}
