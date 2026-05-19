export interface OpenAIAuthHeaderOptions {
  apiKey?: string;
  contentType?: string;
  safetyIdentifier?: string;
}

function cleanEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function buildOpenAIAuthHeaders(
  options: OpenAIAuthHeaderOptions = {}
): Record<string, string> {
  const apiKey = cleanEnv(options.apiKey) ?? cleanEnv(process.env.OPENAI_API_KEY);
  const organizationId =
    cleanEnv(process.env.OPENAI_ORGANIZATION_ID) ??
    cleanEnv(process.env.OPENAI_ORG_ID);
  const projectId = cleanEnv(process.env.OPENAI_PROJECT_ID);

  const headers: Record<string, string> = {};

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  if (organizationId) {
    headers["OpenAI-Organization"] = organizationId;
  }

  if (projectId) {
    headers["OpenAI-Project"] = projectId;
  }

  if (options.contentType) {
    headers["Content-Type"] = options.contentType;
  }

  if (options.safetyIdentifier) {
    headers["OpenAI-Safety-Identifier"] = options.safetyIdentifier;
  }

  return headers;
}
