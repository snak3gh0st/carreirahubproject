// USD per 1M tokens (OpenAI pricing checked 2026-05-25 — update as needed)
export const PRICING: Record<string, { in: number; out: number }> = {
  'gpt-4o-mini': { in: 0.15, out: 0.60 },
  'gpt-4o':      { in: 2.50, out: 10.00 },
  'gpt-5': { in: 1.25, out: 10.00 },
  'gpt-5-mini': { in: 0.25, out: 2.00 },
  'gpt-5-nano': { in: 0.05, out: 0.40 },
  'gpt-5.2': { in: 1.75, out: 14.00 },
  'gpt-5.2-chat-latest': { in: 1.75, out: 14.00 },
};

function envPrice(name: string): number | null {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function estimateCostUSD(tokensIn: number, tokensOut: number, model: string): number {
  const p = PRICING[model] ?? {
    in: envPrice('AI_MODEL_INPUT_USD_PER_1M') ?? 0,
    out: envPrice('AI_MODEL_OUTPUT_USD_PER_1M') ?? 0,
  };
  if (!p) return 0;
  return (tokensIn * p.in + tokensOut * p.out) / 1_000_000;
}
