import test from "node:test";
import assert from "node:assert/strict";

import { getFinancialQueryPlan } from "../lib/financial/query-plan";

test("summary query stays lightweight even when revenue tab is selected", () => {
  const plan = getFinancialQueryPlan("revenue");

  assert.equal(plan.summaryTab, "pnl");
  assert.equal(plan.activeTabRequest, "revenue");
});

test("pnl tab reuses the summary payload instead of issuing a second tab request", () => {
  const plan = getFinancialQueryPlan("pnl");

  assert.equal(plan.summaryTab, "pnl");
  assert.equal(plan.activeTabRequest, null);
});
