import test from "node:test";
import assert from "node:assert/strict";

import { resolveSyncTimestamp } from "../lib/integrations/sync-health";

test("resolveSyncTimestamp returns the only available timestamp", () => {
  const primary = new Date("2026-05-05T12:00:04.943Z");

  assert.equal(resolveSyncTimestamp(primary, null)?.toISOString(), primary.toISOString());
  assert.equal(resolveSyncTimestamp(null, primary)?.toISOString(), primary.toISOString());
});

test("resolveSyncTimestamp prefers the most recent timestamp", () => {
  const older = new Date("2026-05-05T06:00:04.524Z");
  const newer = new Date("2026-05-05T12:00:04.943Z");

  assert.equal(resolveSyncTimestamp(older, newer)?.toISOString(), newer.toISOString());
  assert.equal(resolveSyncTimestamp(newer, older)?.toISOString(), newer.toISOString());
});

test("resolveSyncTimestamp returns null when both sources are empty", () => {
  assert.equal(resolveSyncTimestamp(null, null), null);
});
