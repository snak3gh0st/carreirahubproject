import test from "node:test";
import assert from "node:assert/strict";
import { computeDayBucket } from "../../lib/ai/persona-cache.ts";

test("computeDayBucket floors to TTL window (180min)", () => {
  // 2026-04-14 14:37:00 UTC with 180min TTL → window starts at 12:00
  const date = new Date("2026-04-14T14:37:00.000Z");
  assert.equal(computeDayBucket(date, 180), "2026-04-14-1200");
});

test("computeDayBucket at exact window boundary picks that window", () => {
  const date = new Date("2026-04-14T15:00:00.000Z");
  assert.equal(computeDayBucket(date, 180), "2026-04-14-1500");
});

test("computeDayBucket at start of day uses 0000", () => {
  const date = new Date("2026-04-14T00:15:00.000Z");
  assert.equal(computeDayBucket(date, 180), "2026-04-14-0000");
});

test("computeDayBucket with 60min TTL produces hourly buckets", () => {
  const date = new Date("2026-04-14T09:45:00.000Z");
  assert.equal(computeDayBucket(date, 60), "2026-04-14-0900");
});

test("computeDayBucket pads hour correctly for single-digit hours", () => {
  const date = new Date("2026-04-14T03:10:00.000Z");
  assert.equal(computeDayBucket(date, 60), "2026-04-14-0300");
});
