import test from "node:test";
import assert from "node:assert/strict";

import { isEnglishTestPassingResult } from "../lib/hub/english-test-outcome";

test("isEnglishTestPassingResult passes B1 or higher with sufficient score", () => {
  assert.equal(isEnglishTestPassingResult({ cefrLevel: "B1", score: 55 }), true);
  assert.equal(isEnglishTestPassingResult({ cefrLevel: "B2", score: 70 }), true);
});

test("isEnglishTestPassingResult fails low CEFR even with high score", () => {
  assert.equal(isEnglishTestPassingResult({ cefrLevel: "A2", score: 90 }), false);
});

test("isEnglishTestPassingResult fails B1 result below score threshold", () => {
  assert.equal(isEnglishTestPassingResult({ cefrLevel: "B1", score: 54 }), false);
});
