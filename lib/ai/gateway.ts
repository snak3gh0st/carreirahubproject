export type AiGatewayTask =
  | "dashboard_copilot"
  | "persona_analysis"
  | "collection_call_analysis"
  | "critical_report"
  | "general_chat";

export type AiGatewayQuality = "economy" | "balanced" | "high";

export interface AiGatewayProfile {
  task: AiGatewayTask;
  model: string;
  quality: AiGatewayQuality;
  source: "default" | "env" | "normalized_legacy";
}

export const AI_GATEWAY_DEFAULT_MODELS: Record<AiGatewayTask, string> = {
  dashboard_copilot: "gpt-5-mini",
  persona_analysis: "gpt-5.2-chat-latest",
  collection_call_analysis: "gpt-5-nano",
  critical_report: "gpt-5.2-chat-latest",
  general_chat: "gpt-5-mini",
};

const AI_GATEWAY_DEFAULT_QUALITY: Record<AiGatewayTask, AiGatewayQuality> = {
  dashboard_copilot: "balanced",
  persona_analysis: "high",
  collection_call_analysis: "economy",
  critical_report: "high",
  general_chat: "balanced",
};

const AI_GATEWAY_ENV_KEYS: Record<AiGatewayTask, string> = {
  dashboard_copilot: "AI_GATEWAY_MODEL_DASHBOARD_COPILOT",
  persona_analysis: "AI_GATEWAY_MODEL_PERSONA_ANALYSIS",
  collection_call_analysis: "AI_GATEWAY_MODEL_COLLECTION_CALL_ANALYSIS",
  critical_report: "AI_GATEWAY_MODEL_CRITICAL_REPORT",
  general_chat: "AI_GATEWAY_MODEL_GENERAL_CHAT",
};

const LEGACY_UNAVAILABLE_MODELS = new Set([
  "gpt-3.5-turbo",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-4-turbo-preview",
]);

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function resolveAiGatewayProfile(input: {
  task: AiGatewayTask;
  preferredModel?: string;
  env?: Record<string, string | undefined>;
}): AiGatewayProfile {
  const env = input.env ?? process.env;
  const envModel = clean(env[AI_GATEWAY_ENV_KEYS[input.task]]);
  const preferredModel = clean(input.preferredModel);
  const candidate = envModel ?? preferredModel ?? AI_GATEWAY_DEFAULT_MODELS[input.task];
  const defaultModel = AI_GATEWAY_DEFAULT_MODELS[input.task];

  if (LEGACY_UNAVAILABLE_MODELS.has(candidate)) {
    return {
      task: input.task,
      model: defaultModel,
      quality: AI_GATEWAY_DEFAULT_QUALITY[input.task],
      source: "normalized_legacy",
    };
  }

  return {
    task: input.task,
    model: candidate,
    quality: AI_GATEWAY_DEFAULT_QUALITY[input.task],
    source: candidate === defaultModel && !envModel && !preferredModel ? "default" : "env",
  };
}

export function resolveAiGatewayModel(input: {
  task: AiGatewayTask;
  preferredModel?: string;
  env?: Record<string, string | undefined>;
}): string {
  return resolveAiGatewayProfile(input).model;
}
