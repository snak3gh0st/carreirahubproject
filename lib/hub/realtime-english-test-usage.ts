export interface RealtimeEnglishUsageTotals {
  inputTextTokens: number;
  cachedInputTextTokens: number;
  inputAudioTokens: number;
  outputTextTokens: number;
  outputAudioTokens: number;
  totalTokens: number;
}

export interface RealtimeEnglishUsagePricing {
  inputTextUsdPerMillion: number;
  cachedInputTextUsdPerMillion: number;
  inputAudioUsdPerMillion: number;
  outputTextUsdPerMillion: number;
  outputAudioUsdPerMillion: number;
}

export const EMPTY_REALTIME_ENGLISH_USAGE_TOTALS: RealtimeEnglishUsageTotals = {
  inputTextTokens: 0,
  cachedInputTextTokens: 0,
  inputAudioTokens: 0,
  outputTextTokens: 0,
  outputAudioTokens: 0,
  totalTokens: 0,
};

const DEFAULT_REALTIME_ENGLISH_USAGE_PRICING: RealtimeEnglishUsagePricing = {
  inputTextUsdPerMillion: 4,
  cachedInputTextUsdPerMillion: 0.4,
  inputAudioUsdPerMillion: 32,
  outputTextUsdPerMillion: 24,
  outputAudioUsdPerMillion: 64,
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function asTokenCount(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function usageFromEvent(value: unknown): Record<string, unknown> {
  const root = asRecord(value);
  const directUsage = asRecord(root.usage);
  if (Object.keys(directUsage).length > 0) return directUsage;

  const response = asRecord(root.response);
  const responseUsage = asRecord(response.usage);
  if (Object.keys(responseUsage).length > 0) return responseUsage;

  return root;
}

export function normalizeRealtimeEnglishUsage(value: unknown): RealtimeEnglishUsageTotals {
  const usage = usageFromEvent(value);
  const inputDetails = asRecord(usage.input_token_details);
  const outputDetails = asRecord(usage.output_token_details);

  const promptTokens = asTokenCount(usage.prompt_tokens);
  const completionTokens = asTokenCount(usage.completion_tokens);
  const inputTokens = asTokenCount(usage.input_tokens);
  const outputTokens = asTokenCount(usage.output_tokens);
  const totalTokens = asTokenCount(usage.total_tokens);

  const inputTextTokens =
    asTokenCount(inputDetails.text_tokens) ||
    promptTokens ||
    Math.max(0, inputTokens - asTokenCount(inputDetails.audio_tokens));
  const outputTextTokens =
    asTokenCount(outputDetails.text_tokens) ||
    completionTokens ||
    Math.max(0, outputTokens - asTokenCount(outputDetails.audio_tokens));

  return {
    inputTextTokens,
    cachedInputTextTokens: asTokenCount(inputDetails.cached_tokens),
    inputAudioTokens: asTokenCount(inputDetails.audio_tokens),
    outputTextTokens,
    outputAudioTokens: asTokenCount(outputDetails.audio_tokens),
    totalTokens:
      totalTokens ||
      inputTextTokens +
        asTokenCount(inputDetails.audio_tokens) +
        outputTextTokens +
        asTokenCount(outputDetails.audio_tokens),
  };
}

export function mergeRealtimeEnglishUsageTotals(
  current: RealtimeEnglishUsageTotals,
  incoming: RealtimeEnglishUsageTotals
): RealtimeEnglishUsageTotals {
  return {
    inputTextTokens: current.inputTextTokens + incoming.inputTextTokens,
    cachedInputTextTokens:
      current.cachedInputTextTokens + incoming.cachedInputTextTokens,
    inputAudioTokens: current.inputAudioTokens + incoming.inputAudioTokens,
    outputTextTokens: current.outputTextTokens + incoming.outputTextTokens,
    outputAudioTokens: current.outputAudioTokens + incoming.outputAudioTokens,
    totalTokens: current.totalTokens + incoming.totalTokens,
  };
}

export function hasRealtimeEnglishUsage(tokens: RealtimeEnglishUsageTotals): boolean {
  return Object.values(tokens).some((value) => value > 0);
}

function envPrice(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function getRealtimeEnglishUsagePricingFromEnv(): RealtimeEnglishUsagePricing {
  return {
    inputTextUsdPerMillion: envPrice(
      "OPENAI_REALTIME_TEXT_INPUT_USD_PER_1M",
      DEFAULT_REALTIME_ENGLISH_USAGE_PRICING.inputTextUsdPerMillion
    ),
    cachedInputTextUsdPerMillion: envPrice(
      "OPENAI_REALTIME_CACHED_TEXT_INPUT_USD_PER_1M",
      DEFAULT_REALTIME_ENGLISH_USAGE_PRICING.cachedInputTextUsdPerMillion
    ),
    inputAudioUsdPerMillion: envPrice(
      "OPENAI_REALTIME_AUDIO_INPUT_USD_PER_1M",
      DEFAULT_REALTIME_ENGLISH_USAGE_PRICING.inputAudioUsdPerMillion
    ),
    outputTextUsdPerMillion: envPrice(
      "OPENAI_REALTIME_TEXT_OUTPUT_USD_PER_1M",
      DEFAULT_REALTIME_ENGLISH_USAGE_PRICING.outputTextUsdPerMillion
    ),
    outputAudioUsdPerMillion: envPrice(
      "OPENAI_REALTIME_AUDIO_OUTPUT_USD_PER_1M",
      DEFAULT_REALTIME_ENGLISH_USAGE_PRICING.outputAudioUsdPerMillion
    ),
  };
}

export function estimateRealtimeEnglishUsageCostUsd(
  totals: RealtimeEnglishUsageTotals,
  pricing: RealtimeEnglishUsagePricing = getRealtimeEnglishUsagePricingFromEnv()
): number {
  const cost =
    (totals.inputTextTokens / 1_000_000) * pricing.inputTextUsdPerMillion +
    (totals.cachedInputTextTokens / 1_000_000) * pricing.cachedInputTextUsdPerMillion +
    (totals.inputAudioTokens / 1_000_000) * pricing.inputAudioUsdPerMillion +
    (totals.outputTextTokens / 1_000_000) * pricing.outputTextUsdPerMillion +
    (totals.outputAudioTokens / 1_000_000) * pricing.outputAudioUsdPerMillion;

  return Math.round(cost * 10_000) / 10_000;
}
