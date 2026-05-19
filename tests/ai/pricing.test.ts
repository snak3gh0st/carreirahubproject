import assert from "node:assert/strict";
import test from "node:test";

import { estimateCostUSD } from "../../lib/ai/pricing";

test("estimateCostUSD prices GPT-5.2 dashboard usage by current default rate", () => {
  assert.equal(estimateCostUSD(1_000_000, 1_000_000, "gpt-5.2-chat-latest"), 15.75);
});

test("estimateCostUSD uses env fallback for unknown configured models", () => {
  const originalIn = process.env.AI_MODEL_INPUT_USD_PER_1M;
  const originalOut = process.env.AI_MODEL_OUTPUT_USD_PER_1M;
  process.env.AI_MODEL_INPUT_USD_PER_1M = "2";
  process.env.AI_MODEL_OUTPUT_USD_PER_1M = "6";

  try {
    assert.equal(estimateCostUSD(500_000, 250_000, "custom-model"), 2.5);
  } finally {
    if (originalIn === undefined) {
      delete process.env.AI_MODEL_INPUT_USD_PER_1M;
    } else {
      process.env.AI_MODEL_INPUT_USD_PER_1M = originalIn;
    }

    if (originalOut === undefined) {
      delete process.env.AI_MODEL_OUTPUT_USD_PER_1M;
    } else {
      process.env.AI_MODEL_OUTPUT_USD_PER_1M = originalOut;
    }
  }
});
