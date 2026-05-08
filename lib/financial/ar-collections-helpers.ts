import type { ArCollectionsData } from "@/lib/types/financial-bi";

export type CollectionPerformancePoint = ArCollectionsData["collectionPerformance"][number];

export type CollectionYearSummary = {
  year: string;
  invoiced: number;
  collected: number;
  avgCollectionRate: number;
  avgDaysToPayment: number | null;
  months: number;
  monthsWithPaymentSample: number;
};

export function buildCollectionYearSummary(
  points: CollectionPerformancePoint[],
  year: string,
): CollectionYearSummary {
  const yearPoints = points.filter((point) => point.month.startsWith(`${year}-`));
  const pointsWithDays = yearPoints.filter((point) => point.avgDaysToPayment !== null);

  return {
    year,
    invoiced: yearPoints.reduce((sum, point) => sum + point.invoiced, 0),
    collected: yearPoints.reduce((sum, point) => sum + point.collected, 0),
    avgCollectionRate: yearPoints.length > 0
      ? yearPoints.reduce((sum, point) => sum + point.collectionRate, 0) / yearPoints.length
      : 0,
    avgDaysToPayment: pointsWithDays.length > 0
      ? pointsWithDays.reduce((sum, point) => sum + (point.avgDaysToPayment || 0), 0) / pointsWithDays.length
      : null,
    months: yearPoints.length,
    monthsWithPaymentSample: pointsWithDays.length,
  };
}

export function buildCollectionComparisonSummaries(points: CollectionPerformancePoint[]) {
  const years = Array.from(new Set(points.map((point) => point.month.slice(0, 4)))).sort();
  return years.map((year) => buildCollectionYearSummary(points, year));
}

