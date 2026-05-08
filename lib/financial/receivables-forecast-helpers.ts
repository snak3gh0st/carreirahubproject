import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";

export type SalesHistoryPoint = {
  month: string;
  invoiced: number;
  collected: number;
};

export type ExistingReceivablesPoint = {
  month: string;
  monthLabel: string;
  collectionExpected: number;
  conservative: number;
};

export type SalesForecastPoint = {
  month: string;
  monthLabel: string;
  projectedSales: number;
  projectedCashIn: number;
  existingReceivables: number;
  totalExpectedInflow: number;
  conservativeTotalInflow: number;
  gapToBreakeven: number;
};

export type SalesForecastSummary = {
  avgProjectedSales: number;
  avgProjectedCashIn: number;
  realizationRate: number;
  monthly: SalesForecastPoint[];
};

export function buildAverageSalesForecast(
  history: SalesHistoryPoint[],
  forecastStartDate: Date,
  existingReceivables: ExistingReceivablesPoint[],
  monthlyBreakeven: number,
  lookbackMonths = 6,
): SalesForecastSummary {
  const currentMonthKey = format(forecastStartDate, "yyyy-MM");
  const currentMonthIsClosed = format(forecastStartDate, "yyyy-MM-dd") === format(endOfMonth(forecastStartDate), "yyyy-MM-dd");
  const closedHistory = history
    .filter((point) => point.month < currentMonthKey || (currentMonthIsClosed && point.month === currentMonthKey))
    .slice(-lookbackMonths);

  const avgProjectedSales = closedHistory.length > 0
    ? closedHistory.reduce((sum, point) => sum + point.invoiced, 0) / closedHistory.length
    : 0;
  const realizationRate = closedHistory.length > 0
    ? closedHistory.reduce((sum, point) => {
      if (point.invoiced <= 0) {
        return sum;
      }
      return sum + Math.min(point.collected / point.invoiced, 1);
    }, 0) / closedHistory.length
    : 0;
  const avgProjectedCashIn = avgProjectedSales * realizationRate;

  const existingMap = new Map(existingReceivables.map((point) => [point.month, point]));
  const monthly = existingReceivables.map((point, index) => {
    const monthDate = startOfMonth(addMonths(forecastStartDate, index));
    const month = format(monthDate, "yyyy-MM");
    const existing = existingMap.get(month);
    const projectedSales = Math.round(avgProjectedSales);
    const projectedCashIn = Math.round(avgProjectedCashIn);
    const existingReceivablesValue = existing?.collectionExpected || 0;
    const totalExpectedInflow = projectedCashIn + existingReceivablesValue;
    const conservativeTotalInflow = Math.round(projectedCashIn * 0.8) + (existing?.conservative || 0);

    return {
      month,
      monthLabel: point.monthLabel,
      projectedSales,
      projectedCashIn,
      existingReceivables: existingReceivablesValue,
      totalExpectedInflow,
      conservativeTotalInflow,
      gapToBreakeven: Math.round(totalExpectedInflow - monthlyBreakeven),
    };
  });

  return {
    avgProjectedSales: Math.round(avgProjectedSales),
    avgProjectedCashIn: Math.round(avgProjectedCashIn),
    realizationRate,
    monthly,
  };
}
