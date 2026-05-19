import assert from "node:assert/strict";
import test from "node:test";

import { buildOpenAIAuthHeaders } from "../lib/services/openai-auth-headers";

function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const previous: Record<string, string | undefined> = {};

  for (const key of Object.keys(env)) {
    previous[key] = process.env[key];
    if (env[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = env[key];
    }
  }

  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("buildOpenAIAuthHeaders includes optional organization and project routing headers", () => {
  withEnv(
    {
      OPENAI_API_KEY: "sk-test",
      OPENAI_ORGANIZATION_ID: "org_123",
      OPENAI_ORG_ID: undefined,
      OPENAI_PROJECT_ID: "proj_123",
    },
    () => {
      assert.deepEqual(
        buildOpenAIAuthHeaders({
          contentType: "application/json",
          safetyIdentifier: "hub_hash",
        }),
        {
          Authorization: "Bearer sk-test",
          "OpenAI-Organization": "org_123",
          "OpenAI-Project": "proj_123",
          "Content-Type": "application/json",
          "OpenAI-Safety-Identifier": "hub_hash",
        }
      );
    }
  );
});

test("buildOpenAIAuthHeaders supports OPENAI_ORG_ID alias and explicit API key override", () => {
  withEnv(
    {
      OPENAI_API_KEY: "sk-env",
      OPENAI_ORGANIZATION_ID: undefined,
      OPENAI_ORG_ID: "org_alias",
      OPENAI_PROJECT_ID: undefined,
    },
    () => {
      assert.deepEqual(buildOpenAIAuthHeaders({ apiKey: "sk-explicit" }), {
        Authorization: "Bearer sk-explicit",
        "OpenAI-Organization": "org_alias",
      });
    }
  );
});
