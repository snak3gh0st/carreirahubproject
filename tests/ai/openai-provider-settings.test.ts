import assert from "node:assert/strict";
import test from "node:test";

import { resolveOpenAIProviderSettings } from "../../lib/ai/openai-provider";

test("AI SDK OpenAI provider settings include project and organization routing", () => {
  assert.deepEqual(
    resolveOpenAIProviderSettings({
      OPENAI_API_KEY: "sk-test",
      OPENAI_PROJECT_ID: "proj_123",
      OPENAI_ORGANIZATION_ID: "org_123",
      OPENAI_ORG_ID: "org_alias",
    }),
    {
      apiKey: "sk-test",
      organization: "org_123",
      project: "proj_123",
    },
  );
});

test("AI SDK OpenAI provider settings support OPENAI_ORG_ID alias and omit empty values", () => {
  assert.deepEqual(
    resolveOpenAIProviderSettings({
      OPENAI_API_KEY: "  ",
      OPENAI_PROJECT_ID: "",
      OPENAI_ORGANIZATION_ID: undefined,
      OPENAI_ORG_ID: "org_alias",
    }),
    {
      organization: "org_alias",
    },
  );
});
