import assert from "node:assert/strict";
import test from "node:test";

import {
  didCronTelemetryFail,
  getCronFailureMessage,
} from "@/lib/utils/cron-with-telegram";

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

test("didCronTelemetryFail treats success false as failure by default", () => {
  assert.equal(
    didCronTelemetryFail({ success: false }, 200),
    true,
  );
});

test("didCronTelemetryFail can ignore body success false for http 200 crons", () => {
  assert.equal(
    didCronTelemetryFail({ success: false }, 200, { alertOnBodyFailure: false }),
    false,
  );
});

test("didCronTelemetryFail still treats 4xx/5xx as failure even when body failures are ignored", () => {
  assert.equal(
    didCronTelemetryFail({ success: true }, 500, { alertOnBodyFailure: false }),
    true,
  );
});
