interface QuickBooksRateLimitDelayOptions {
  attempt: number;
  retryAfterHeader?: string | null;
  now?: Date;
  baseDelayMs?: number;
  maxDelayMs?: number;
  random?: () => number;
}

export function parseRetryAfterMs(
  retryAfterHeader?: string | null,
  now: Date = new Date(),
): number | null {
  if (!retryAfterHeader) return null;

  const trimmed = retryAfterHeader.trim();
  if (!trimmed) return null;

  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  const retryAtMs = Date.parse(trimmed);
  if (Number.isNaN(retryAtMs)) return null;

  return Math.max(0, retryAtMs - now.getTime());
}

export function computeQuickBooksRateLimitDelayMs({
  attempt,
  retryAfterHeader,
  now = new Date(),
  baseDelayMs = 1000,
  maxDelayMs = 30_000,
  random = Math.random,
}: QuickBooksRateLimitDelayOptions): number {
  const retryAfterMs = parseRetryAfterMs(retryAfterHeader, now);
  if (retryAfterMs !== null) {
    return retryAfterMs;
  }

  const boundedAttempt = Math.max(1, attempt);
  const exponentialDelay = Math.min(
    maxDelayMs,
    baseDelayMs * 2 ** (boundedAttempt - 1),
  );
  const jitterFactor = Math.min(Math.max(random(), 0), 1) * 0.25;

  return Math.round(
    Math.min(maxDelayMs, exponentialDelay * (1 + jitterFactor)),
  );
}

export async function sleepMs(delayMs: number): Promise<void> {
  if (delayMs <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
