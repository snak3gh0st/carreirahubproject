import { endOfMonth, startOfMonth, startOfYear, subDays, subMonths } from "date-fns";

import { DateRangeParam } from "@/lib/types/financial-bi";

export type FinancialDateRangeInput =
  | DateRangeParam
  | "thisMonth"
  | "lastMonth"
  | "this_month"
  | "last_month";

function getRollingWindowStart(now: Date, dayCount: number): Date {
  return subDays(now, Math.max(dayCount - 1, 0));
}

export function getFinancialDateRange(
  dateRange: FinancialDateRangeInput,
  options: {
    now?: Date;
    from?: string;
    to?: string;
  } = {}
): { startDate: Date; endDate: Date } {
  const now = options.now ?? new Date();
  const endDate = options.to ? new Date(options.to) : now;

  switch (dateRange) {
    case "last7":
      return { startDate: getRollingWindowStart(now, 7), endDate };
    case "last30":
      return { startDate: getRollingWindowStart(now, 30), endDate };
    case "last90":
      return { startDate: getRollingWindowStart(now, 90), endDate };
    case "thisYear":
      return { startDate: startOfYear(now), endDate };
    case "thisMonth":
    case "this_month":
      return { startDate: startOfMonth(now), endDate };
    case "lastMonth":
    case "last_month": {
      const previousMonth = subMonths(now, 1);
      return {
        startDate: startOfMonth(previousMonth),
        endDate: endOfMonth(previousMonth),
      };
    }
    case "custom":
      return { startDate: options.from ? new Date(options.from) : getRollingWindowStart(now, 30), endDate };
    case "allTime":
    default:
      return { startDate: new Date("2020-01-01"), endDate };
  }
}

export function getOpenAmount(
  amount: number | string | { toString(): string } | null | undefined,
  amountPaid: number | string | { toString(): string } | null | undefined
): number {
  return Math.max(Number(amount || 0) - Number(amountPaid || 0), 0);
}

export interface ReceivableAgingInput {
  dueDate: Date;
  amount: number | string | { toString(): string } | null | undefined;
  amountPaid?: number | string | { toString(): string } | null | undefined;
}

export interface ReceivableAgingBucket {
  bucket: "Current" | "1-30" | "31-60" | "61-90" | "90+";
  amount: number;
  count: number;
}

export function buildReceivableAgingSummary(
  invoices: ReceivableAgingInput[],
  snapshotDate: Date,
): {
  buckets: ReceivableAgingBucket[];
  totalOpenReceivables: number;
  overdueAmount: number;
} {
  const buckets: Array<{ bucket: ReceivableAgingBucket["bucket"]; min: number; max: number }> = [
    { bucket: "Current", min: -Infinity, max: 0 },
    { bucket: "1-30", min: 1, max: 30 },
    { bucket: "31-60", min: 31, max: 60 },
    { bucket: "61-90", min: 61, max: 90 },
    { bucket: "90+", min: 91, max: Infinity },
  ];

  const agingBuckets = buckets.map(({ bucket, min, max }) => {
    const matching = invoices.filter((invoice) => {
      const days = Math.floor(
        (snapshotDate.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      return days >= min && days <= max;
    });

    return {
      bucket,
      amount: matching.reduce(
        (sum, invoice) => sum + getOpenAmount(invoice.amount, invoice.amountPaid),
        0,
      ),
      count: matching.length,
    };
  });

  const totalOpenReceivables = agingBuckets.reduce((sum, bucket) => sum + bucket.amount, 0);
  const overdueAmount = agingBuckets
    .filter((bucket) => bucket.bucket !== "Current")
    .reduce((sum, bucket) => sum + bucket.amount, 0);

  return { buckets: agingBuckets, totalOpenReceivables, overdueAmount };
}
