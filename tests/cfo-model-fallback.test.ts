import test from "node:test";
import assert from "node:assert/strict";

import { getCfoModelCandidates, modelSupportsJsonResponseFormat } from "../lib/services/cfo-models";

test("getCfoModelCandidates prioritizes explicit env model and keeps accessible fallbacks", () => {
  assert.deepEqual(getCfoModelCandidates("gpt-4"), ["gpt-4", "gpt-3.5-turbo"]);
  assert.deepEqual(getCfoModelCandidates("gpt-4-turbo-preview"), [
    "gpt-4-turbo-preview",
    "gpt-4",
    "gpt-3.5-turbo",
  ]);
  assert.deepEqual(getCfoModelCandidates(undefined), ["gpt-4", "gpt-3.5-turbo"]);
});

test("modelSupportsJsonResponseFormat only enables json_object for compatible models", () => {
  assert.equal(modelSupportsJsonResponseFormat("gpt-4-turbo-preview"), true);
  assert.equal(modelSupportsJsonResponseFormat("gpt-4.1-mini"), true);
  assert.equal(modelSupportsJsonResponseFormat("gpt-4"), false);
  assert.equal(modelSupportsJsonResponseFormat("gpt-3.5-turbo"), false);
});
