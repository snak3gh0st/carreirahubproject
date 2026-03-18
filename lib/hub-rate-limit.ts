import Redis from "ioredis";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60; // 15 minutes
const KEY_PREFIX = "hub-ratelimit:";

// ---------------------------------------------------------------------------
// Lazy Redis client
// ---------------------------------------------------------------------------

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error("REDIS_URL environment variable is not set");
    }
    redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    // Swallow connection errors so the process doesn't crash
    redis.on("error", (err) => {
      console.error("[hub-rate-limit] Redis error:", err.message);
    });
  }
  return redis;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Check whether `email` is allowed to make another login attempt.
 *
 * Uses a sliding-window counter stored in Redis.  If Redis is unavailable the
 * limiter **fails open** (returns `allowed: true`) so that a Redis outage
 * never locks users out.
 */
export async function checkRateLimit(
  email: string
): Promise<RateLimitResult> {
  try {
    const client = getRedis();

    // Ensure the client is connected
    if (client.status === "wait") {
      await client.connect();
    }

    const key = `${KEY_PREFIX}${email.toLowerCase()}`;

    const current = await client.incr(key);

    // Set expiry only on the first increment (when counter == 1)
    if (current === 1) {
      await client.expire(key, WINDOW_SECONDS);
    }

    const allowed = current <= MAX_ATTEMPTS;
    const remaining = Math.max(0, MAX_ATTEMPTS - current);

    return { allowed, remaining };
  } catch (err) {
    // Fail open: if Redis is down, allow the request
    console.error("[hub-rate-limit] Redis unavailable, failing open:", (err as Error).message);
    return { allowed: true, remaining: MAX_ATTEMPTS };
  }
}

/**
 * Clear the rate-limit counter for `email` (e.g. after a successful login).
 */
export async function clearRateLimit(email: string): Promise<void> {
  try {
    const client = getRedis();

    if (client.status === "wait") {
      await client.connect();
    }

    const key = `${KEY_PREFIX}${email.toLowerCase()}`;
    await client.del(key);
  } catch (err) {
    console.error("[hub-rate-limit] Failed to clear rate limit:", (err as Error).message);
  }
}
