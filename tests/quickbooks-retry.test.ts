import test from "node:test";
import assert from "node:assert/strict";

import {
  computeQuickBooksRateLimitDelayMs,
  parseRetryAfterMs,
} from "@/lib/utils/quickbooks-retry";

test("parseRetryAfterMs supports delta seconds", () => {
  assert.equal(parseRetryAfterMs("12"), 12_000);
});

test("parseRetryAfterMs supports HTTP dates", () => {
  const now = new Date("2026-05-27T12:00:00.000Z");
  const retryAt = new Date("2026-05-27T12:00:07.000Z");

  assert.equal(parseRetryAfterMs(retryAt.toUTCString(), now), 7_000);
});

test("computeQuickBooksRateLimitDelayMs prefers Retry-After header over computed backoff", () => {
  const delay = computeQuickBooksRateLimitDelayMs({
    attempt: 2,
    retryAfterHeader: "9",
    random: () => 0.99,
  });

  assert.equal(delay, 9_000);
});

test("computeQuickBooksRateLimitDelayMs applies exponential backoff with bounded jitter", () => {
  const low = computeQuickBooksRateLimitDelayMs({
    attempt: 3,
    random: () => 0,
  });
  const high = computeQuickBooksRateLimitDelayMs({
    attempt: 3,
    random: () => 1,
  });

  assert.equal(low, 4_000);
  assert.equal(high, 5_000);
});
