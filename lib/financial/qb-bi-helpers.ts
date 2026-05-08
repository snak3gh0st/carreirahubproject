import { format } from "date-fns";

type QbPnlSection = {
  total: number;
  byMonth: number[];
};

type QbPnlShape = {
  months: string[];
  income: QbPnlSection;
  cogs: QbPnlSection;
  expenses: QbPnlSection & { byCategory?: Array<{ category: string; amount: number }> };
  netIncome: QbPnlSection;
};

type MonthlyPnlRow = {
  month: string;
  monthKey: string;
  revenue: number;
  cogs: number;
  expenses: number;
  netIncome: number;
};

const QB_MONTHS: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getQbMonthKey(label: string): string | null {
  const monthOnly = label.match(/^([A-Z][a-z]{2}) (\d{4})$/);
  if (monthOnly) {
    const [, month, year] = monthOnly;
    return QB_MONTHS[month] ? `${year}-${QB_MONTHS[month]}` : null;
  }

  const singleDay = label.match(/^([A-Z][a-z]{2}) \d{1,2}, (\d{4})$/);
  if (singleDay) {
    const [, month, year] = singleDay;
    return QB_MONTHS[month] ? `${year}-${QB_MONTHS[month]}` : null;
  }

  const dayRange = label.match(/^([A-Z][a-z]{2}) \d{1,2}-\d{1,2}, (\d{4})$/);
  if (dayRange) {
    const [, month, year] = dayRange;
    return QB_MONTHS[month] ? `${year}-${QB_MONTHS[month]}` : null;
  }

  return null;
}

export function buildAgingSnapshotFromQbBuckets(buckets: Record<string, number> | undefined) {
  const map = buckets ?? {};
  const normalized = [
    { bucket: "Current", amount: roundCurrency(map.Current || 0), count: 0 },
    { bucket: "1-30", amount: roundCurrency(map["1-30"] || map["1 - 30"] || 0), count: 0 },
    { bucket: "31-60", amount: roundCurrency(map["31-60"] || map["31 - 60"] || 0), count: 0 },
    { bucket: "61-90", amount: roundCurrency(map["61-90"] || map["61 - 90"] || 0), count: 0 },
    { bucket: "90+", amount: roundCurrency(map["90+"] || map["91 and over"] || map["91+"] || 0), count: 0 },
  ];

  return {
    snapshot: normalized,
    overdueAmount: roundCurrency(
      normalized
        .filter((entry) => entry.bucket !== "Current")
        .reduce((sum, entry) => sum + entry.amount, 0),
    ),
    totalAmount: roundCurrency(normalized.reduce((sum, entry) => sum + entry.amount, 0)),
  };
}

function buildMonthlyPnlRows(pnl: QbPnlShape): MonthlyPnlRow[] {
  return pnl.months
    .map((month, index) => {
      const monthKey = getQbMonthKey(month);
      if (!monthKey) return null;
      return {
        month,
        monthKey,
        revenue: pnl.income.byMonth[index] || 0,
        cogs: pnl.cogs.byMonth[index] || 0,
        expenses: pnl.expenses.byMonth[index] || 0,
        netIncome: pnl.netIncome.byMonth[index] || 0,
      };
    })
    .filter((row): row is MonthlyPnlRow => Boolean(row));
}

function sumMonthlyRows(rows: MonthlyPnlRow[]) {
  return rows.reduce(
    (acc, row) => ({
      totalRevenue: acc.totalRevenue + row.revenue,
      totalCOGS: acc.totalCOGS + row.cogs,
      totalExpenses: acc.totalExpenses + row.expenses + row.cogs,
      netIncome: acc.netIncome + row.netIncome,
    }),
    { totalRevenue: 0, totalCOGS: 0, totalExpenses: 0, netIncome: 0 },
  );
}

export function buildWindowedQbPnlSnapshot(
  pnl: QbPnlShape,
  startDate: Date,
  endDate: Date,
  prevStart: Date,
  prevEnd: Date,
) {
  const monthlyPnL = buildMonthlyPnlRows(pnl);
  const currentStartKey = format(startDate, "yyyy-MM");
  const currentEndKey = format(endDate, "yyyy-MM");
  const prevStartKey = format(prevStart, "yyyy-MM");

  const currentRows = monthlyPnL.filter((row) => row.monthKey >= currentStartKey && row.monthKey <= currentEndKey);
  const previousRows = monthlyPnL.filter((row) => row.monthKey >= prevStartKey && row.monthKey < currentStartKey);

  return {
    monthlyPnL,
    current: sumMonthlyRows(currentRows),
    previous: sumMonthlyRows(previousRows),
  };
}
