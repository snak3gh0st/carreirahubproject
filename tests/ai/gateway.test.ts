import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_GATEWAY_DEFAULT_MODELS,
  resolveAiGatewayModel,
  resolveAiGatewayProfile,
} from "../../lib/ai/gateway";

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const original: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    original[key] = process.env[key];
    if (vars[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = vars[key];
    }
  }

  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("gateway routes dashboard copilot to a cost-efficient default", () => {
  assert.equal(AI_GATEWAY_DEFAULT_MODELS.dashboard_copilot, "gpt-5-mini");
  assert.equal(resolveAiGatewayModel({ task: "dashboard_copilot" }), "gpt-5-mini");
});

test("gateway routes persona analysis to the high-quality model", () => {
  const profile = resolveAiGatewayProfile({ task: "persona_analysis" });

  assert.equal(profile.model, "gpt-5.2-chat-latest");
  assert.equal(profile.quality, "high");
  assert.equal(profile.source, "default");
});

test("gateway routes collection post-call analysis to nano by default", () => {
  assert.equal(resolveAiGatewayModel({ task: "collection_call_analysis" }), "gpt-5-nano");
});

test("gateway routes critical reports to the high-quality report model", () => {
  assert.equal(resolveAiGatewayModel({ task: "critical_report" }), "gpt-5.2-chat-latest");
});

test("gateway supports per-task env overrides", () => {
  withEnv(
    {
      AI_GATEWAY_MODEL_DASHBOARD_COPILOT: "gpt-5.2-chat-latest",
      AI_GATEWAY_MODEL_COLLECTION_CALL_ANALYSIS: "gpt-5-mini",
    },
    () => {
      assert.equal(resolveAiGatewayModel({ task: "dashboard_copilot" }), "gpt-5.2-chat-latest");
      assert.equal(resolveAiGatewayModel({ task: "collection_call_analysis" }), "gpt-5-mini");
    }
  );
});

test("gateway normalizes legacy unavailable models to task defaults", () => {
  withEnv({ AI_GATEWAY_MODEL_DASHBOARD_COPILOT: "gpt-4-turbo-preview" }, () => {
    const profile = resolveAiGatewayProfile({ task: "dashboard_copilot" });

    assert.equal(profile.model, "gpt-5-mini");
    assert.equal(profile.source, "normalized_legacy");
  });
});

test("gateway can keep an explicit supported model", () => {
  withEnv({ AI_GATEWAY_MODEL_DASHBOARD_COPILOT: "gpt-5.2-chat-latest" }, () => {
    const profile = resolveAiGatewayProfile({ task: "dashboard_copilot" });

    assert.equal(profile.model, "gpt-5.2-chat-latest");
    assert.equal(profile.source, "env");
  });
});
