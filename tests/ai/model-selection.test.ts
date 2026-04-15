import test from "node:test";
import assert from "node:assert/strict";

import { resolveDashboardAiModel } from "../../lib/ai/model-selection.ts";

test("resolveDashboardAiModel normalizes legacy defaults with no project access", () => {
  assert.equal(resolveDashboardAiModel(undefined), "gpt-5.2-chat-latest");
  assert.equal(resolveDashboardAiModel("gpt-4o-mini"), "gpt-5.2-chat-latest");
  assert.equal(resolveDashboardAiModel("gpt-4-turbo"), "gpt-5.2-chat-latest");
  assert.equal(resolveDashboardAiModel("gpt-4-turbo-preview"), "gpt-5.2-chat-latest");
});

test("resolveDashboardAiModel preserves explicitly supported chat models", () => {
  assert.equal(resolveDashboardAiModel("gpt-5.2-chat-latest"), "gpt-5.2-chat-latest");
  assert.equal(resolveDashboardAiModel("gpt-5.2"), "gpt-5.2");
  assert.equal(resolveDashboardAiModel("gpt-4"), "gpt-4");
  assert.equal(resolveDashboardAiModel("gpt-3.5-turbo"), "gpt-3.5-turbo");
});
