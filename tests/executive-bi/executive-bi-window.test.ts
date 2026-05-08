import test from "node:test";
import assert from "node:assert/strict";

import { resolveExecutiveAdminWindow } from "../../lib/services/executive-bi";

test("resolveExecutiveAdminWindow maps MTD and last month to custom date windows", () => {
  const now = new Date("2026-05-05T16:00:00.000Z");

  const mtd = resolveExecutiveAdminWindow("thisMonth", now);
  assert.equal(mtd.preset, "custom");
  assert.equal(mtd.from, "2026-05-01");
  assert.equal(mtd.to, "2026-05-05");

  const lastMonth = resolveExecutiveAdminWindow("lastMonth", now);
  assert.equal(lastMonth.preset, "custom");
  assert.equal(lastMonth.from, "2026-04-01");
  assert.equal(lastMonth.to, "2026-04-30");
});
