import test from "node:test";
import assert from "node:assert/strict";

import { buildAverageSalesForecast } from "../lib/financial/receivables-forecast-helpers";

test("buildAverageSalesForecast uses recent closed-month averages and blends existing receivables", () => {
  const forecast = buildAverageSalesForecast(
    [
      { month: "2025-11", invoiced: 80000, collected: 76000 },
      { month: "2025-12", invoiced: 90000, collected: 82000 },
      { month: "2026-01", invoiced: 100000, collected: 87000 },
      { month: "2026-02", invoiced: 95000, collected: 83000 },
      { month: "2026-03", invoiced: 85000, collected: 79000 },
      { month: "2026-04", invoiced: 78000, collected: 74000 },
      { month: "2026-05", invoiced: 5000, collected: 3000 },
    ],
    new Date("2026-05-05T12:00:00.000Z"),
    [
      { month: "2026-05", monthLabel: "May 2026", collectionExpected: 20000, conservative: 14000 },
      { month: "2026-06", monthLabel: "Jun 2026", collectionExpected: 15000, conservative: 11000 },
    ],
    65000,
  );

  assert.equal(forecast.avgProjectedSales, 88000);
  assert.equal(forecast.avgProjectedCashIn, 80416);
  assert.equal(Math.round(forecast.realizationRate * 100), 91);
  assert.equal(forecast.monthly[0].totalExpectedInflow, 100416);
  assert.equal(forecast.monthly[0].gapToBreakeven, 35416);
  assert.equal(forecast.monthly[1].conservativeTotalInflow, 75333);
});
