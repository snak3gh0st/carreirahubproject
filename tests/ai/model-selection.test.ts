import test from "node:test";
import assert from "node:assert/strict";

import { resolveDashboardAiModel } from "../../lib/ai/model-selection.ts";

test("resolveDashboardAiModel routes through the internal gateway default", () => {
  assert.equal(resolveDashboardAiModel(undefined), "gpt-5-mini");
  assert.equal(resolveDashboardAiModel("gpt-4o-mini"), "gpt-5-mini");
  assert.equal(resolveDashboardAiModel("gpt-4-turbo"), "gpt-5-mini");
  assert.equal(resolveDashboardAiModel("gpt-4-turbo-preview"), "gpt-5-mini");
});

test("resolveDashboardAiModel preserves explicitly supported chat models", () => {
  assert.equal(resolveDashboardAiModel("gpt-5.2-chat-latest"), "gpt-5.2-chat-latest");
  assert.equal(resolveDashboardAiModel("gpt-5.2"), "gpt-5.2");
  assert.equal(resolveDashboardAiModel("gpt-5-mini"), "gpt-5-mini");
  assert.equal(resolveDashboardAiModel("gpt-5-nano"), "gpt-5-nano");
  assert.equal(resolveDashboardAiModel("gpt-4"), "gpt-4");
});
