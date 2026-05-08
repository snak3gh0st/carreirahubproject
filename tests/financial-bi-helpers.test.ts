import test from "node:test";
import assert from "node:assert/strict";

import {
  buildReceivableAgingSummary,
  getFinancialDateRange,
  getOpenAmount,
} from "../lib/financial/bi-helpers";

test("getFinancialDateRange supports this_month aliases", () => {
  const now = new Date("2026-05-04T15:30:00.000Z");

  const snake = getFinancialDateRange("this_month", { now });
  const camel = getFinancialDateRange("thisMonth", { now });

  assert.equal(snake.startDate.toISOString().slice(0, 10), "2026-05-01");
  assert.equal(snake.endDate.toISOString(), now.toISOString());
  assert.equal(camel.startDate.toISOString().slice(0, 10), "2026-05-01");
  assert.equal(camel.endDate.toISOString(), now.toISOString());
});

test("getFinancialDateRange supports last_month aliases", () => {
  const now = new Date("2026-05-04T15:30:00.000Z");

  const snake = getFinancialDateRange("last_month", { now });
  const camel = getFinancialDateRange("lastMonth", { now });

  assert.equal(snake.startDate.toISOString().slice(0, 10), "2026-04-01");
  assert.equal(snake.endDate.getFullYear(), 2026);
  assert.equal(snake.endDate.getMonth(), 3);
  assert.equal(snake.endDate.getDate(), 30);
  assert.equal(camel.startDate.toISOString().slice(0, 10), "2026-04-01");
  assert.equal(camel.endDate.getFullYear(), 2026);
  assert.equal(camel.endDate.getMonth(), 3);
  assert.equal(camel.endDate.getDate(), 30);
});

test("getOpenAmount uses remaining balance instead of gross invoice amount", () => {
  assert.equal(getOpenAmount(1000, 250), 750);
  assert.equal(getOpenAmount(1000, null), 1000);
  assert.equal(getOpenAmount(1000, 1200), 0);
});

test("buildReceivableAgingSummary uses only the already-visible receivable rows", () => {
  const snapshot = buildReceivableAgingSummary(
    [
      { dueDate: new Date("2026-05-20T00:00:00.000Z"), amount: 1000, amountPaid: 250 },
      { dueDate: new Date("2026-04-20T00:00:00.000Z"), amount: 500, amountPaid: 100 },
      { dueDate: new Date("2026-01-01T00:00:00.000Z"), amount: 300, amountPaid: 0 },
    ],
    new Date("2026-05-06T00:00:00.000Z"),
  );

  assert.equal(snapshot.totalOpenReceivables, 1450);
  assert.equal(snapshot.overdueAmount, 700);
  assert.deepEqual(
    snapshot.buckets.map((bucket) => ({ bucket: bucket.bucket, amount: bucket.amount, count: bucket.count })),
    [
      { bucket: "Current", amount: 750, count: 1 },
      { bucket: "1-30", amount: 400, count: 1 },
      { bucket: "31-60", amount: 0, count: 0 },
      { bucket: "61-90", amount: 0, count: 0 },
      { bucket: "90+", amount: 300, count: 1 },
    ],
  );
});
