import assert from "node:assert/strict";
import test from "node:test";

import { getCronFailureMessage } from "@/lib/utils/cron-with-telegram";

test("getCronFailureMessage prefers response error", () => {
  assert.equal(
    getCronFailureMessage({ success: false, error: "database unavailable" }, 200),
    "database unavailable"
  );
});

test("getCronFailureMessage falls back to response message before HTTP status", () => {
  assert.equal(
    getCronFailureMessage({ success: false, message: "Collection call service is not configured" }, 200),
    "Collection call service is not configured"
  );
});

test("getCronFailureMessage falls back to HTTP status when body has no details", () => {
  assert.equal(getCronFailureMessage({ success: false }, 503), "HTTP 503");
});
