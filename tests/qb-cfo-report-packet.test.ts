import test from "node:test";
import assert from "node:assert/strict";

import { buildQbCfoReportPacket, buildQbCfoReportNarrative } from "../lib/financial/qb-cfo-report-packet";

test("buildQbCfoReportPacket consolidates cached QB reports for the CFO", () => {
  const packet = buildQbCfoReportPacket({
    ProfitAndLoss: {
      income: { total: 120000 },
      expenses: {
        total: 70000,
        byCategory: [
          { category: "Payroll", amount: 30000 },
          { category: "Marketing", amount: 12000 },
        ],
      },
      cogs: { total: 5000 },
      netIncome: { total: 45000 },
      months: ["2026-01", "2026-02"],
    },
    BalanceSheet: {
      bankAccounts: {
        total: 38000,
        accounts: [{ name: "Operating", balance: 38000 }],
      },
      totalAssets: 90000,
      totalLiabilities: 25000,
      totalEquity: 65000,
    },
    CashFlow: {
      sections: [
        { name: "Operating Activities", total: 18000 },
        { name: "Investing Activities", total: -3000 },
        { name: "Financing Activities", total: 5000 },
      ],
      netCashChange: 20000,
    },
    AgedReceivables: {
      columns: ["Current", "1-30", "31-60", "61-90", "90+", "Total"],
      rows: [
        { name: "Acme", values: [3000, 2000, 1000, 0, 500, 6500] },
        { name: "Beta", values: [2500, 0, 0, 0, 0, 2500] },
      ],
    },
    VendorExpenses: {
      rows: [
        { name: "Vendor A", total: 12000 },
        { name: "Vendor B", total: 9000 },
      ],
    },
    CustomerSales: {
      rows: [
        { name: "Acme", total: 42000 },
        { name: "Beta", total: 18000 },
      ],
    },
  });

  assert.equal(packet.profitAndLoss?.totalIncome, 120000);
  assert.equal(packet.balanceSheet?.cash, 38000);
  assert.equal(packet.cashFlow?.netCashChange, 20000);
  assert.equal(packet.arAging?.totalOpenReceivables, 9000);
  assert.equal(packet.arAging?.buckets["90+"], 500);
  assert.equal(packet.vendorExpenses?.topVendors[0]?.name, "Vendor A");
  assert.equal(packet.salesByCustomer?.topCustomers[0]?.name, "Acme");
});

test("buildQbCfoReportNarrative renders a concise report packet for the AI prompt", () => {
  const narrative = buildQbCfoReportNarrative({
    profitAndLoss: {
      totalIncome: 120000,
      totalExpenses: 75000,
      netIncome: 45000,
      topExpenseCategories: [{ name: "Payroll", amount: 30000 }],
    },
    balanceSheet: {
      cash: 38000,
      totalAssets: 90000,
      totalLiabilities: 25000,
      totalEquity: 65000,
    },
    cashFlow: {
      netCashChange: 20000,
      operating: 18000,
      investing: -3000,
      financing: 5000,
    },
    arAging: {
      totalOpenReceivables: 9000,
      buckets: { Current: 5500, "1-30": 2000, "31-60": 1000, "61-90": 0, "90+": 500 },
      topCustomers: [{ name: "Acme", total: 6500 }],
    },
    salesByCustomer: {
      topCustomers: [{ name: "Acme", total: 42000 }],
    },
    vendorExpenses: {
      topVendors: [{ name: "Vendor A", total: 12000 }],
    },
  });

  assert.match(narrative, /QuickBooks report packet/);
  assert.match(narrative, /P&L: income \$120,000/);
  assert.match(narrative, /Cash Flow: net cash change \$20,000/);
  assert.match(narrative, /A\/R Aging: total open receivables \$9,000/);
  assert.match(narrative, /Top customer sales: Acme \$42,000/);
  assert.match(narrative, /Top vendor expense: Vendor A \$12,000/);
});
