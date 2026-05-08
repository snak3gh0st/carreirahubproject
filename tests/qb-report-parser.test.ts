import assert from "node:assert/strict";
import test from "node:test";

import { parseBalanceSheet, parseCashFlow, parseProfitAndLoss } from "@/lib/services/qb-report-parser";

test("parseProfitAndLoss reads COGS from QuickBooks reports that use the COGS group", () => {
  const parsed = parseProfitAndLoss({
    Columns: {
      Column: [
        { ColTitle: "", ColType: "Account" },
        { ColTitle: "Jan 2025", ColType: "Money" },
        { ColTitle: "Feb 2025", ColType: "Money" },
        { ColTitle: "Total", ColType: "Money" },
      ],
    },
    Rows: {
      Row: [
        {
          type: "Section",
          group: "Income",
          Summary: { ColData: [{ value: "Total Income" }, { value: "100.00" }, { value: "200.00" }, { value: "300.00" }] },
        },
        {
          type: "Section",
          group: "COGS",
          Header: { ColData: [{ value: "Cost of Goods Sold" }, { value: "" }, { value: "" }, { value: "" }] },
          Summary: { ColData: [{ value: "Total Cost of Goods Sold" }, { value: "40.00" }, { value: "60.00" }, { value: "100.00" }] },
        },
        {
          type: "Section",
          group: "Expenses",
          Summary: { ColData: [{ value: "Total Expenses" }, { value: "20.00" }, { value: "30.00" }, { value: "50.00" }] },
          Rows: { Row: [] },
        },
        {
          type: "Section",
          group: "NetIncome",
          Summary: { ColData: [{ value: "Net Income" }, { value: "40.00" }, { value: "110.00" }, { value: "150.00" }] },
        },
      ],
    },
  });

  assert.equal(parsed.cogs.total, 100);
  assert.deepEqual(parsed.cogs.byMonth, [40, 60]);
});

test("parseProfitAndLoss extracts COGS category breakdown from QuickBooks reports", () => {
  const parsed = parseProfitAndLoss({
    Columns: {
      Column: [
        { ColTitle: "", ColType: "Account" },
        { ColTitle: "Jan 2026", ColType: "Money" },
        { ColTitle: "Feb 2026", ColType: "Money" },
        { ColTitle: "Total", ColType: "Money" },
      ],
    },
    Rows: {
      Row: [
        {
          type: "Section",
          group: "Income",
          Summary: { ColData: [{ value: "Total Income" }, { value: "10000.00" }, { value: "12000.00" }, { value: "22000.00" }] },
        },
        {
          type: "Section",
          group: "COGS",
          Header: { ColData: [{ value: "Cost of Goods Sold" }, { value: "" }, { value: "" }, { value: "" }] },
          Summary: { ColData: [{ value: "Total Cost of Goods Sold" }, { value: "3000.00" }, { value: "4000.00" }, { value: "7000.00" }] },
          Rows: {
            Row: [
              { type: "Data", ColData: [{ value: "Contract instructors" }, { value: "2000.00" }, { value: "2500.00" }, { value: "4500.00" }] },
              { type: "Data", ColData: [{ value: "Program materials" }, { value: "1000.00" }, { value: "1500.00" }, { value: "2500.00" }] },
            ],
          },
        },
        {
          type: "Section",
          group: "Expenses",
          Summary: { ColData: [{ value: "Total Expenses" }, { value: "1500.00" }, { value: "1800.00" }, { value: "3300.00" }] },
          Rows: { Row: [] },
        },
        {
          type: "Section",
          group: "NetIncome",
          Summary: { ColData: [{ value: "Net Income" }, { value: "5500.00" }, { value: "6200.00" }, { value: "11700.00" }] },
        },
      ],
    },
  });

  assert.deepEqual(parsed.cogs.byCategory, [
    { category: "Contract instructors", amount: 4500, byMonth: [2000, 2500] },
    { category: "Program materials", amount: 2500, byMonth: [1000, 1500] },
  ]);
});

test("parseProfitAndLoss reads exact-window totals when QuickBooks does not summarize by month", () => {
  const parsed = parseProfitAndLoss({
    Columns: {
      Column: [
        { ColTitle: "", ColType: "Account" },
        { ColTitle: "Total", ColType: "Money" },
      ],
    },
    Rows: {
      Row: [
        {
          type: "Section",
          group: "Income",
          Summary: { ColData: [{ value: "Total Income" }, { value: "5082.92" }] },
        },
        {
          type: "Section",
          group: "COGS",
          Summary: { ColData: [{ value: "Total Cost of Goods Sold" }, { value: "1200.00" }] },
        },
        {
          type: "Section",
          group: "Expenses",
          Summary: { ColData: [{ value: "Total Expenses" }, { value: "1800.00" }] },
          Rows: {
            Row: [
              { type: "Data", ColData: [{ value: "Software" }, { value: "1300.00" }] },
              { type: "Data", ColData: [{ value: "Fees" }, { value: "500.00" }] },
            ],
          },
        },
        {
          type: "Section",
          group: "NetIncome",
          Summary: { ColData: [{ value: "Net Income" }, { value: "2082.92" }] },
        },
      ],
    },
  });

  assert.deepEqual(parsed.months, []);
  assert.equal(parsed.income.total, 5082.92);
  assert.equal(parsed.cogs.total, 1200);
  assert.equal(parsed.expenses.total, 1800);
  assert.equal(parsed.netIncome.total, 2082.92);
  assert.deepEqual(parsed.expenses.byCategory, [
    { category: "Software", amount: 1300 },
    { category: "Fees", amount: 500 },
  ]);
});

test("parseBalanceSheet reads totals and bank accounts from TotalAssets style QuickBooks reports", () => {
  const parsed = parseBalanceSheet({
    Rows: {
      Row: [
        {
          type: "Section",
          group: "TotalAssets",
          Header: { ColData: [{ value: "ASSETS" }, { value: "" }] },
          Summary: { ColData: [{ value: "TOTAL ASSETS" }, { value: "73657.84" }] },
          Rows: {
            Row: [
              {
                type: "Section",
                group: "CurrentAssets",
                Header: { ColData: [{ value: "Current Assets" }, { value: "" }] },
                Summary: { ColData: [{ value: "Total Current Assets" }, { value: "73657.84" }] },
                Rows: {
                  Row: [
                    {
                      type: "Section",
                      group: "BankAccounts",
                      Header: { ColData: [{ value: "Bank Accounts" }, { value: "" }] },
                      Summary: { ColData: [{ value: "Total Bank Accounts" }, { value: "71357.84" }] },
                      Rows: {
                        Row: [
                          {
                            type: "Data",
                            ColData: [{ value: "Business Adv Fundamentals - 2914 - 1" }, { value: "71357.84" }],
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        {
          type: "Section",
          group: "TotalLiabilitiesAndEquity",
          Header: { ColData: [{ value: "LIABILITIES AND EQUITY" }, { value: "" }] },
          Summary: { ColData: [{ value: "TOTAL LIABILITIES AND EQUITY" }, { value: "73657.84" }] },
          Rows: {
            Row: [
              {
                type: "Section",
                group: "Liabilities",
                Header: { ColData: [{ value: "Liabilities" }, { value: "" }] },
                Summary: { ColData: [{ value: "Total Liabilities" }, { value: "9830.18" }] },
              },
              {
                type: "Section",
                group: "Equity",
                Header: { ColData: [{ value: "Equity" }, { value: "" }] },
                Summary: { ColData: [{ value: "Total Equity" }, { value: "63827.66" }] },
              },
            ],
          },
        },
      ],
    },
  });

  assert.equal(parsed.totalAssets, 73657.84);
  assert.equal(parsed.totalLiabilities, 9830.18);
  assert.equal(parsed.totalEquity, 63827.66);
  assert.equal(parsed.bankAccounts.total, 71357.84);
  assert.deepEqual(parsed.bankAccounts.accounts, [
    { name: "Business Adv Fundamentals - 2914 - 1", balance: 71357.84 },
  ]);
});

test("parseCashFlow uses the net cash increase row instead of summing ending cash", () => {
  const parsed = parseCashFlow({
    Rows: {
      Row: [
        {
          type: "Section",
          group: "OperatingActivities",
          Header: { ColData: [{ value: "OPERATING ACTIVITIES" }] },
          Summary: { ColData: [{ value: "Net cash provided by operating activities" }, { value: "19881.41" }] },
        },
        {
          type: "Section",
          group: "FinancingActivities",
          Header: { ColData: [{ value: "FINANCING ACTIVITIES" }] },
          Summary: { ColData: [{ value: "Net cash provided by financing activities" }, { value: "-24578.56" }] },
        },
        {
          type: "Section",
          group: "CashIncrease",
          Summary: { ColData: [{ value: "Net cash increase for period" }, { value: "-4697.15" }] },
        },
        {
          type: "Section",
          group: "EndingCash",
          Summary: { ColData: [{ value: "Cash at end of period" }, { value: "73580.04" }] },
        },
      ],
    },
  });

  assert.equal(parsed.netCashChange, -4697.15);
  assert.deepEqual(parsed.sections.map((section) => section.name), [
    "OPERATING ACTIVITIES",
    "FINANCING ACTIVITIES",
    "CashIncrease",
    "EndingCash",
  ]);
});
