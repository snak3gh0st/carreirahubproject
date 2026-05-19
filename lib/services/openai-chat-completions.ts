import { buildOpenAIAuthHeaders } from "@/lib/services/openai-auth-headers";

const CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionResult {
  model: string;
  content: string;
  usage?: unknown;
}

function parseError(responseText: string): { code: string | null; message: string } {
  try {
    const body = JSON.parse(responseText) as {
      error?: { code?: unknown; message?: unknown };
    };
    return {
      code: typeof body.error?.code === "string" ? body.error.code : null,
      message:
        typeof body.error?.message === "string"
          ? body.error.message
          : responseText.slice(0, 300),
    };
  } catch {
    return { code: null, message: responseText.slice(0, 300) };
  }
}

function extractContent(body: unknown): string {
  const raw = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const choices = Array.isArray(raw.choices) ? raw.choices : [];
  const first = choices[0] as Record<string, unknown> | undefined;
  const message =
    first?.message && typeof first.message === "object"
      ? first.message as Record<string, unknown>
      : {};
  return typeof message.content === "string" ? message.content : "";
}

export async function createOpenAIChatCompletion(input: {
  models: string[];
  messages: ChatMessage[];
  json?: boolean;
  maxCompletionTokens?: number;
  apiKey?: string;
}): Promise<ChatCompletionResult> {
  let lastError = "OpenAI chat completion failed";

  for (const model of input.models) {
    const response = await fetch(CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: buildOpenAIAuthHeaders({
        apiKey: input.apiKey,
        contentType: "application/json",
      }),
      body: JSON.stringify({
        model,
        messages: input.messages,
        ...(input.json ? { response_format: { type: "json_object" } } : {}),
        max_completion_tokens: input.maxCompletionTokens ?? 700,
      }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      const parsed = parseError(responseText);
      lastError = parsed.message;
      if (parsed.code === "model_not_found" && model !== input.models[input.models.length - 1]) {
        continue;
      }
      throw new Error(lastError);
    }

    let body: unknown;
    try {
      body = JSON.parse(responseText);
    } catch {
      throw new Error("OpenAI returned an invalid chat completion response");
    }

    const content = extractContent(body);
    if (!content.trim()) {
      throw new Error("OpenAI returned an empty chat completion response");
    }

    const bodyRecord = body && typeof body === "object" ? body as Record<string, unknown> : {};

    return {
      model,
      content,
      usage: bodyRecord.usage,
    };
  }

  throw new Error(lastError);
}
