import { createOpenAI, type OpenAIProviderSettings } from "@ai-sdk/openai";

type OpenAIProviderEnv = Record<string, string | undefined>;

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function resolveOpenAIProviderSettings(
  env: OpenAIProviderEnv = process.env,
): OpenAIProviderSettings {
  const apiKey = clean(env.OPENAI_API_KEY);
  const organization = clean(env.OPENAI_ORGANIZATION_ID) ?? clean(env.OPENAI_ORG_ID);
  const project = clean(env.OPENAI_PROJECT_ID);
  const settings: OpenAIProviderSettings = {};

  if (apiKey) settings.apiKey = apiKey;
  if (organization) settings.organization = organization;
  if (project) settings.project = project;

  return settings;
}

export function createOpenAIProvider(env: OpenAIProviderEnv = process.env) {
  return createOpenAI(resolveOpenAIProviderSettings(env));
}
