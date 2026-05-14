import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyCronRun,
  deriveOverallHealthLevel,
  summarizeStatusCounts,
} from "../lib/admin/system-health";

test("classifyCronRun marks fresh cron runs healthy", () => {
  const now = new Date("2026-05-14T12:00:00.000Z");
  const lastRunAt = new Date("2026-05-14T11:56:00.000Z");

  assert.equal(
    classifyCronRun({ lastRunAt, expectedEveryMinutes: 5, now }),
    "healthy"
  );
});

test("classifyCronRun escalates stale cron runs", () => {
  const now = new Date("2026-05-14T12:00:00.000Z");

  assert.equal(
    classifyCronRun({
      lastRunAt: new Date("2026-05-14T11:20:00.000Z"),
      expectedEveryMinutes: 30,
      now,
    }),
    "warning"
  );
  assert.equal(
    classifyCronRun({
      lastRunAt: new Date("2026-05-14T10:30:00.000Z"),
      expectedEveryMinutes: 30,
      now,
    }),
    "critical"
  );
  assert.equal(
    classifyCronRun({ lastRunAt: null, expectedEveryMinutes: 30, now }),
    "critical"
  );
});

test("summarizeStatusCounts treats only success statuses as ok", () => {
  assert.deepEqual(
    summarizeStatusCounts([
      { status: "SUCCESS", count: 4 },
      { status: "success", count: 2 },
      { status: "ERROR", count: 3 },
      { status: "FAILED", count: 1 },
    ]),
    { ok: 6, err: 4 }
  );
});

test("deriveOverallHealthLevel prioritizes critical signals", () => {
  assert.equal(
    deriveOverallHealthLevel({
      criticalInfraCount: 0,
      warningInfraCount: 1,
      criticalCronCount: 0,
      warningCronCount: 0,
      errorCount24h: 0,
      queueIssueTotal: 0,
      openCircuitBreakers: 0,
      invoiceWarningCount: 0,
      syncWarningCount: 0,
    }),
    "warning"
  );
  assert.equal(
    deriveOverallHealthLevel({
      criticalInfraCount: 1,
      warningInfraCount: 0,
      criticalCronCount: 0,
      warningCronCount: 0,
      errorCount24h: 0,
      queueIssueTotal: 0,
      openCircuitBreakers: 0,
      invoiceWarningCount: 0,
      syncWarningCount: 0,
    }),
    "critical"
  );
});
