import test from "node:test";
import assert from "node:assert/strict";

import {
  isHubAccessPausedForCheckout,
  isHubAccessPausedForProgramType,
} from "../lib/ops/hub-access-policy";

test("isHubAccessPausedForProgramType pauses PASS and ADVANCED only", () => {
  assert.equal(isHubAccessPausedForProgramType("PASS"), true);
  assert.equal(isHubAccessPausedForProgramType("ADVANCED"), true);
  assert.equal(isHubAccessPausedForProgramType("EARLY_CAREER"), false);
});

test("isHubAccessPausedForCheckout detects PASS and ADVANCED programs", () => {
  assert.equal(
    isHubAccessPausedForCheckout({ programSlug: "pass-advanced", programName: "Programa Pass Advanced" }),
    true,
  );
  assert.equal(
    isHubAccessPausedForCheckout({ programSlug: "new-pass", programName: "Programa Pass" }),
    true,
  );
  assert.equal(
    isHubAccessPausedForCheckout({ programSlug: "early-career", programName: "Early Career" }),
    false,
  );
});
