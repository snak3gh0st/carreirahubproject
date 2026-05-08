import test from "node:test";
import assert from "node:assert/strict";

import { format } from "date-fns";

import { buildQbReportWindow } from "../lib/financial/qb-window";

test("buildReportWindow keeps the QuickBooks refresh baseline on January 1, 2025", () => {
  const reportWindow = buildQbReportWindow({
    now: new Date("2026-05-04T15:30:00.000Z"),
  });

  assert.equal(format(reportWindow.startDate, "yyyy-MM-dd"), "2025-01-01");
  assert.equal(reportWindow.now.toISOString(), "2026-05-04T15:30:00.000Z");
});
