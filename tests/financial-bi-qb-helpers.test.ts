import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAgingSnapshotFromQbBuckets,
  buildWindowedQbPnlSnapshot,
  getQbMonthKey,
} from "../lib/financial/qb-bi-helpers";

test("getQbMonthKey normalizes QuickBooks month labels", () => {
  assert.equal(getQbMonthKey("Jan 2025"), "2025-01");
  assert.equal(getQbMonthKey("Dec 31, 2024"), "2024-12");
  assert.equal(getQbMonthKey("May 1-4, 2026"), "2026-05");
  assert.equal(getQbMonthKey("invalid"), null);
});

test("buildAgingSnapshotFromQbBuckets normalizes QuickBooks aging buckets and overdue total", () => {
  const result = buildAgingSnapshotFromQbBuckets({
    Current: 236271.82,
    "1 - 30": 27706.41,
    "31 - 60": 10908.34,
    "61 - 90": 12603.34,
    "91 and over": 197944.96,
  });

  assert.deepEqual(
    result.snapshot.map((entry) => entry.bucket),
    ["Current", "1-30", "31-60", "61-90", "90+"],
  );
  assert.equal(result.overdueAmount, 249163.05);
});

test("buildWindowedQbPnlSnapshot slices QuickBooks monthly P&L into current and previous windows", () => {
  const result = buildWindowedQbPnlSnapshot(
    {
      months: ["Dec 31, 2024", "Mar 2026", "Apr 2026", "May 1-4, 2026"],
      income: { total: 53, byMonth: [1, 7, 30, 15] },
      cogs: { total: 18, byMonth: [0, 2, 8, 5] },
      expenses: { total: 15, byMonth: [0, 1, 6, 4], byCategory: [] },
      netIncome: { total: 20, byMonth: [1, 4, 16, 6] },
    },
    new Date("2026-04-04T00:00:00.000Z"),
    new Date("2026-05-04T23:59:59.000Z"),
    new Date("2026-03-04T00:00:00.000Z"),
    new Date("2026-04-03T23:59:59.000Z"),
  );

  assert.equal(result.current.totalRevenue, 45);
  assert.equal(result.current.totalCOGS, 13);
  assert.equal(result.current.totalExpenses, 23);
  assert.equal(result.current.netIncome, 22);
  assert.equal(result.previous.totalRevenue, 7);
  assert.equal(result.previous.totalCOGS, 2);
  assert.equal(result.previous.totalExpenses, 3);
  assert.equal(result.previous.netIncome, 4);
  assert.deepEqual(
    result.monthlyPnL.map((entry) => entry.month),
    ["Dec 31, 2024", "Mar 2026", "Apr 2026", "May 1-4, 2026"],
  );
});
