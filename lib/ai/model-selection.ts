const LEGACY_UNAVAILABLE_DASHBOARD_MODELS = new Set([
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-4-turbo-preview",
]);

const DASHBOARD_AI_DEFAULT_MODEL = "gpt-5.2-chat-latest";

export function resolveDashboardAiModel(preferredModel?: string): string {
  if (!preferredModel) {
    return DASHBOARD_AI_DEFAULT_MODEL;
  }

  if (LEGACY_UNAVAILABLE_DASHBOARD_MODELS.has(preferredModel)) {
    return DASHBOARD_AI_DEFAULT_MODEL;
  }

  return preferredModel;
}
