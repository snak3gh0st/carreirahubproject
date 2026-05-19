import assert from "node:assert/strict";
import test from "node:test";

import { canStartPlacementTest } from "../../lib/hub/placement-test-policy";

test("canStartPlacementTest permits the initial test and one retake", () => {
  assert.equal(canStartPlacementTest(0).allowed, true);
  assert.equal(canStartPlacementTest(1).allowed, true);
});

test("canStartPlacementTest blocks a second retake", () => {
  const result = canStartPlacementTest(2);

  assert.equal(result.allowed, false);
  assert.match(result.reason ?? "", /refazer.*apenas 1 vez/i);
});
