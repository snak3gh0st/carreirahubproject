import test from "node:test";
import assert from "node:assert/strict";

import { buildHubAccessResetUrl, getHubAccessResetExpiry, HUB_ACCESS_RESET_TTL_MS } from "../lib/ops/hub-access";

test("buildHubAccessResetUrl creates a Hub set-password URL and encodes the token", () => {
  const url = buildHubAccessResetUrl("token with spaces", "https://app.carreira.com/");

  assert.equal(url, "https://app.carreira.com/hub/set-password?token=token%20with%20spaces");
});

test("getHubAccessResetExpiry uses the 72 hour manual access window", () => {
  const now = new Date("2026-05-22T12:00:00.000Z");
  const expiresAt = getHubAccessResetExpiry(now);

  assert.equal(expiresAt.getTime() - now.getTime(), HUB_ACCESS_RESET_TTL_MS);
});
