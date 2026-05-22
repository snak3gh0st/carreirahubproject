import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateMentorshipRenewalDate,
  shouldRecalculateRenewalDateOnProfilePatch,
} from "../lib/ops/renewal";

test("calculateMentorshipRenewalDate defaults to 185 days after start", () => {
  assert.equal(
    calculateMentorshipRenewalDate(new Date("2026-05-01T00:00:00.000Z")).toISOString(),
    "2026-11-02T00:00:00.000Z"
  );
});

test("calculateMentorshipRenewalDate adds pause extension days", () => {
  assert.equal(
    calculateMentorshipRenewalDate(new Date("2026-05-01T00:00:00.000Z"), 10).toISOString(),
    "2026-11-12T00:00:00.000Z"
  );
});

test("shouldRecalculateRenewalDateOnProfilePatch recalculates when pause changed and date was not manually edited", () => {
  assert.equal(
    shouldRecalculateRenewalDateOnProfilePatch({
      requestedRenewalDate: new Date("2026-11-02T00:00:00.000Z"),
      existingRenewalDate: new Date("2026-11-02T00:00:00.000Z"),
      requestedPauseExtensionDays: 10,
      existingPauseExtensionDays: 0,
    }),
    true
  );
});

test("shouldRecalculateRenewalDateOnProfilePatch preserves explicit manual renewal date", () => {
  assert.equal(
    shouldRecalculateRenewalDateOnProfilePatch({
      requestedRenewalDate: new Date("2026-12-01T00:00:00.000Z"),
      existingRenewalDate: new Date("2026-11-02T00:00:00.000Z"),
      requestedPauseExtensionDays: 10,
      existingPauseExtensionDays: 0,
    }),
    false
  );
});
