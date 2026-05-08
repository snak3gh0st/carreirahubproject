import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCollectionComparisonSummaries,
  buildCollectionYearSummary,
} from "../lib/financial/ar-collections-helpers";

test("buildCollectionYearSummary aggregates cash, rate and payment speed for one year", () => {
  const summary = buildCollectionYearSummary([
    { month: "2025-01", invoiced: 1000, collected: 300, collectionRate: 40, avgDaysToPayment: 120 },
    { month: "2025-02", invoiced: 2000, collected: 900, collectionRate: 60, avgDaysToPayment: 80 },
    { month: "2026-01", invoiced: 1500, collected: 1200, collectionRate: 70, avgDaysToPayment: 30 },
  ], "2025");

  assert.equal(summary.year, "2025");
  assert.equal(summary.invoiced, 3000);
  assert.equal(summary.collected, 1200);
  assert.equal(summary.avgCollectionRate, 50);
  assert.equal(summary.avgDaysToPayment, 100);
  assert.equal(summary.months, 2);
  assert.equal(summary.monthsWithPaymentSample, 2);
});

test("buildCollectionYearSummary keeps avg days null when there is no payment sample", () => {
  const summary = buildCollectionYearSummary([
    { month: "2026-04", invoiced: 400, collected: 200, collectionRate: 15, avgDaysToPayment: null },
    { month: "2026-05", invoiced: 100, collected: 0, collectionRate: 0, avgDaysToPayment: null },
  ], "2026");

  assert.equal(summary.avgDaysToPayment, null);
  assert.equal(summary.monthsWithPaymentSample, 0);
});

test("buildCollectionComparisonSummaries returns sorted yearly comparisons", () => {
  const summaries = buildCollectionComparisonSummaries([
    { month: "2026-02", invoiced: 500, collected: 250, collectionRate: 25, avgDaysToPayment: 20 },
    { month: "2025-11", invoiced: 700, collected: 600, collectionRate: 80, avgDaysToPayment: 45 },
    { month: "2025-12", invoiced: 900, collected: 700, collectionRate: 65, avgDaysToPayment: 30 },
  ]);

  assert.deepEqual(summaries.map((summary) => summary.year), ["2025", "2026"]);
  assert.equal(Math.round(summaries[0].avgDaysToPayment || 0), 38);
  assert.equal(summaries[1].invoiced, 500);
});

