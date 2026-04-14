import { differenceInDays, format } from "date-fns";

export interface CustomerPaymentTrend {
  customerName: string;
  customerId: string;
  currentAvgDays: number;
  previousAvgDays: number;
  consecutiveSlowing: number;
}

interface PaidInvoiceSample {
  customerId: string;
  customerName: string;
  issuedAt: Date;
  paidAt: Date;
}

export function buildCustomerPaymentTrends(samples: PaidInvoiceSample[]): CustomerPaymentTrend[] {
  const byCustomer = new Map<string, Array<{ customerName: string; month: string; days: number }>>();

  for (const sample of samples) {
    const month = format(sample.paidAt, "yyyy-MM");
    const days = Math.max(differenceInDays(sample.paidAt, sample.issuedAt), 0);
    const existing = byCustomer.get(sample.customerId) || [];
    existing.push({ customerName: sample.customerName, month, days });
    byCustomer.set(sample.customerId, existing);
  }

  const trends: CustomerPaymentTrend[] = [];

  for (const [customerId, entries] of byCustomer.entries()) {
    const monthly = new Map<string, { customerName: string; totalDays: number; count: number }>();
    for (const entry of entries) {
      const bucket = monthly.get(entry.month) || {
        customerName: entry.customerName,
        totalDays: 0,
        count: 0,
      };
      bucket.totalDays += entry.days;
      bucket.count += 1;
      monthly.set(entry.month, bucket);
    }

    const orderedMonths = Array.from(monthly.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        customerName: data.customerName,
        avgDays: Math.round(data.totalDays / data.count),
      }));

    if (orderedMonths.length < 2) continue;

    let consecutiveSlowing = 0;
    for (let i = 1; i < orderedMonths.length; i++) {
      if (orderedMonths[i]!.avgDays > orderedMonths[i - 1]!.avgDays) {
        consecutiveSlowing += 1;
      } else {
        consecutiveSlowing = 0;
      }
    }

    if (consecutiveSlowing === 0) continue;

    const current = orderedMonths[orderedMonths.length - 1]!;
    const previous = orderedMonths[Math.max(orderedMonths.length - 2, 0)]!;

    trends.push({
      customerId,
      customerName: current.customerName,
      currentAvgDays: current.avgDays,
      previousAvgDays: previous.avgDays,
      consecutiveSlowing,
    });
  }

  return trends
    .filter((trend) => trend.currentAvgDays > trend.previousAvgDays)
    .sort((a, b) => {
      if (b.consecutiveSlowing !== a.consecutiveSlowing) {
        return b.consecutiveSlowing - a.consecutiveSlowing;
      }
      return b.currentAvgDays - a.currentAvgDays;
    });
}

export function buildPatternAlerts(input: {
  collectionRateChange: number;
  aging90PlusAmount: number;
  worstOverdue: { customer: string; amount: number; days: number } | null;
  customerPaymentTrends: CustomerPaymentTrend[];
}): string[] {
  const alerts: string[] = [];

  if (input.collectionRateChange < -3) {
    alerts.push(`Collection rate fell ${Math.abs(input.collectionRateChange).toFixed(1)} points versus the prior period.`);
  }

  if (input.aging90PlusAmount > 0) {
    alerts.push(`AR over 90 days is $${Math.round(input.aging90PlusAmount).toLocaleString()}.`);
  }

  if (input.worstOverdue) {
    alerts.push(
      `${input.worstOverdue.customer} has the worst overdue balance at $${Math.round(input.worstOverdue.amount).toLocaleString()} and is ${input.worstOverdue.days} days late.`
    );
  }

  const slowing = input.customerPaymentTrends[0];
  if (slowing) {
    alerts.push(
      `${slowing.customerName} payment speed has slowed to ${slowing.currentAvgDays} days from ${slowing.previousAvgDays} days over ${slowing.consecutiveSlowing} consecutive months.`
    );
  }

  return alerts.slice(0, 4);
}
