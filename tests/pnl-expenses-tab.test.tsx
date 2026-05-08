import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PnlExpensesTab } from "../components/financial/tabs/PnlExpensesTab";

(globalThis as any).React = React;

test("PnlExpensesTab renders COGS category breakdown in the P&L view", () => {
  const html = renderToStaticMarkup(
    React.createElement(PnlExpensesTab, {
      data: {
        totalRevenue: 50000,
        totalExpenses: 28000,
        totalCOGS: 12000,
        netIncome: 22000,
        marginPct: 44,
        prevTotalRevenue: 45000,
        prevTotalExpenses: 26000,
        prevNetIncome: 19000,
        monthlyPnL: [
          { month: "May 2026", revenue: 50000, cogs: 12000, expenses: 16000, netIncome: 22000 },
        ],
        cogsByCategory: [
          { category: "Contract instructors", amount: 9000, pctOfTotal: 75 },
          { category: "Program materials", amount: 3000, pctOfTotal: 25 },
        ],
        expensesByCategory: [
          { category: "Payroll", amount: 10000, pctOfTotal: 62.5 },
          { category: "Software", amount: 6000, pctOfTotal: 37.5 },
        ],
        burnRate: 28000,
        prevBurnRate: 26000,
        cashOnHand: 84000,
        runwayMonths: 3,
        lastFetchedAt: "2026-05-05T12:00:00.000Z",
      },
    }),
  );

  assert.match(html, /COGS Breakdown/);
  assert.match(html, /Contract instructors/);
  assert.match(html, /Program materials/);
  assert.match(html, /75\.0% of COGS/);
});
