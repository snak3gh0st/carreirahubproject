import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCfoFinancialSnapshot,
  buildConcentrationMetric,
  buildCashOnHandValue,
  buildTrailingAverageTrend,
  computeWeightedAveragePaymentDays,
  computeTrailingClosedMonthCostAverage,
  getPreviousComparablePeriod,
  normalizeRevenueServiceLabel,
  resolveInvoiceBookedDate,
  resolveInvoiceBookedMonth,
} from "../lib/services/financial-bi";

test("getPreviousComparablePeriod preserves inclusive window length", () => {
  const current = getPreviousComparablePeriod(
    new Date("2026-05-01T00:00:00.000Z"),
    new Date("2026-05-05T23:59:59.999Z"),
  );

  assert.equal(current.startDate.toISOString(), "2026-04-26T00:00:00.000Z");
  assert.equal(current.endDate.toISOString(), "2026-04-30T00:00:00.000Z");
});

test("buildConcentrationMetric compares current versus previous concentration", () => {
  const metric = buildConcentrationMetric(56.4, 34.2, [
    { name: "A", percentage: 21.1 },
    { name: "B", percentage: 19.8 },
    { name: "C", percentage: 15.5 },
  ]);

  assert.equal(metric.value, 56.4);
  assert.equal(metric.prevValue, 34.2);
  assert.equal(metric.contextLevel, "danger");
  assert.equal(metric.topClients.length, 3);
});

test("buildCfoFinancialSnapshot keeps CFO expense metrics aligned with pnl and summary", () => {
  const snapshot = buildCfoFinancialSnapshot({
    summary: {
      overdueAmount: 249663.05,
    },
    pnl: {
      totalExpenses: 42156.72,
      netIncome: 34776.47,
      marginPct: 45.55,
      burnRate: 17916.38,
      cashOnHand: 71357.84,
      runwayMonths: 3.98,
    },
    overdueCount: 492,
    worstOverdue: {
      customer: "Elitania Santos",
      amount: 2214.89,
      days: 470,
    },
  });

  assert.equal(snapshot.overdueTotal, 249663.05);
  assert.equal(snapshot.overdueCount, 492);
  assert.equal(snapshot.totalExpenses, 42156.72);
  assert.equal(snapshot.burnRate, 17916.38);
  assert.equal(snapshot.cashOnHand, 71357.84);
  assert.equal(snapshot.runwayMonths, 3.98);
});

test("buildCashOnHandValue prefers ending cash from the cash flow report when available", () => {
  const cashOnHand = buildCashOnHandValue(
    { bankAccounts: { total: 71357.84, accounts: [{ name: "Checking", balance: 71357.84 }] } } as any,
    [
      { name: "Operating Activities", total: 19881.41 },
      { name: "EndingCash", total: 46321.18 },
    ],
  );

  assert.equal(cashOnHand, 46321.18);
});

test("buildCashOnHandValue falls back to balance-sheet bank accounts when ending cash is missing", () => {
  const cashOnHand = buildCashOnHandValue(
    { bankAccounts: { total: 71357.84, accounts: [{ name: "Checking", balance: 71357.84 }] } } as any,
    [],
  );

  assert.equal(cashOnHand, 71357.84);
});

test("resolveInvoiceBookedMonth prefers QuickBooks txn month over local import timestamp", () => {
  const month = resolveInvoiceBookedMonth({
    createdAt: new Date("2026-01-14T00:00:00.000Z"),
    dueDate: new Date("2025-08-22T00:00:00.000Z"),
    quickbooks_invoice_id: "258",
    installments: {
      quickbooks: {
        txnDate: "2025-07-30",
      },
    },
  });

  assert.equal(month, "2025-07");
});

test("resolveInvoiceBookedDate prefers QuickBooks txn date over local import timestamp", () => {
  const bookedAt = resolveInvoiceBookedDate({
    createdAt: new Date("2026-01-14T00:00:00.000Z"),
    dueDate: new Date("2025-08-22T00:00:00.000Z"),
    quickbooks_invoice_id: "258",
    installments: {
      quickbooks: {
        txnDate: "2025-07-30",
      },
    },
  });

  assert.equal(bookedAt.toISOString(), "2025-07-30T00:00:00.000Z");
});

test("normalizeRevenueServiceLabel removes installment and entry-payment suffixes", () => {
  assert.equal(
    normalizeRevenueServiceLabel({ rawName: "Programa Pass - Installment 6 of 12" }),
    "Programa Pass",
  );
  assert.equal(
    normalizeRevenueServiceLabel({ rawName: "Programa Early Career - Entry Payment" }),
    "Programa Early Career",
  );
  assert.equal(
    normalizeRevenueServiceLabel({ rawName: "Service - Installment 1 of 9", fallbackItemName: "Programa Pass" }),
    "Programa Pass",
  );
});

test("buildTrailingAverageTrend smooths partial-month MRR with trailing average", () => {
  const trend = buildTrailingAverageTrend([
    { month: "2026-03", value: 70000 },
    { month: "2026-04", value: 78000 },
    { month: "2026-05", value: 6000 },
  ]);

  assert.equal(trend[0].average, 70000);
  assert.equal(Math.round(trend[1].average), 74000);
  assert.equal(Math.round(trend[2].average), 51333);
});

test("computeTrailingClosedMonthCostAverage excludes the current partial month", () => {
  const average = computeTrailingClosedMonthCostAverage([
    { month: "Jan 2026", monthKey: "2026-01", revenue: 84085.99, cogs: 30477.72, expenses: 26403.1, netIncome: 27205.17 },
    { month: "Feb 2026", monthKey: "2026-02", revenue: 84057.48, cogs: 41156.47, expenses: 24057.39, netIncome: 18843.62 },
    { month: "Mar 2026", monthKey: "2026-03", revenue: 68502.17, cogs: 39132.25, expenses: 26507.45, netIncome: 12862.47 },
    { month: "Apr 2026", monthKey: "2026-04", revenue: 78583.57, cogs: 35972.57, expenses: 27059.53, netIncome: 15551.47 },
    { month: "May 1-5, 2026", monthKey: "2026-05", revenue: 6682.92, cogs: 0, expenses: 182.16, netIncome: 6500.76 },
  ], new Date("2026-05-05T12:00:00.000Z"));

  assert.equal(Math.round(average), 64629);
});

test("computeWeightedAveragePaymentDays uses real payment dates and amounts", () => {
  const average = computeWeightedAveragePaymentDays(
    new Date("2025-11-01T00:00:00.000Z"),
    [
      { paymentDate: new Date("2025-12-01T00:00:00.000Z"), amount: 100 },
      { paymentDate: new Date("2026-01-15T00:00:00.000Z"), amount: 300 },
    ],
  );

  assert.equal(Math.round(average || 0), 63);
});
