import test from "node:test";
import assert from "node:assert/strict";

import { buildCostBreakdownFromParsedPnl } from "../lib/financial/cost-breakdown";

test("buildCostBreakdownFromParsedPnl uses the current QB month for COGS and OpEx mix", () => {
  const breakdown = buildCostBreakdownFromParsedPnl(
    {
      months: ["Apr 2026", "May 1-5, 2026"],
      income: { total: 118000, byMonth: [90000, 28000] },
      cogs: {
        total: 37000,
        byMonth: [26000, 11000],
        byCategory: [
          { category: "Contract instructors", amount: 27000, byMonth: [19000, 8000] },
          { category: "Program materials", amount: 10000, byMonth: [7000, 3000] },
        ],
      },
      expenses: {
        total: 24000,
        byMonth: [17000, 7000],
        byCategory: [
          { category: "Payroll", amount: 16000, byMonth: [11000, 5000] },
          { category: "Software", amount: 8000, byMonth: [6000, 2000] },
        ],
      },
      netIncome: { total: 57000, byMonth: [47000, 10000] },
    },
    { now: new Date("2026-05-05T12:00:00.000Z") },
  );

  assert.equal(breakdown?.periodLabel, "May 1-5, 2026");
  assert.equal(breakdown?.revenue, 28000);
  assert.equal(breakdown?.cogsTotal, 11000);
  assert.equal(breakdown?.operatingExpensesTotal, 7000);
  assert.equal(breakdown?.totalCost, 18000);
  assert.equal(breakdown?.cogsToExpenseRatio, 1.57);
  assert.equal(breakdown?.cogsSharePct, 61.1);
  assert.equal(breakdown?.expensesSharePct, 38.9);
  assert.deepEqual(breakdown?.cogsByCategory, [
    { category: "Contract instructors", amount: 8000, pctOfCogs: 72.7 },
    { category: "Program materials", amount: 3000, pctOfCogs: 27.3 },
  ]);
});
