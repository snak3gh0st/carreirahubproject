/**
 * Retry Logic Utilities
 *
 * Provides exponential backoff calculations and retry decision logic
 * for webhook processing and external API calls.
 */

/**
 * Calculate next retry time using exponential backoff
 *
 * Formula: 2^retry_count * base_delay_ms
 * Examples:
 * - Retry 1: 2^1 * 60000 = 2 minutes
 * - Retry 2: 2^2 * 60000 = 4 minutes
 * - Retry 3: 2^3 * 60000 = 8 minutes
 * - Retry 4: 2^4 * 60000 = 16 minutes
 * - Retry 5: 2^5 * 60000 = 32 minutes
 *
 * @param retryCount Current retry attempt (0-indexed)
 * @param baseDelayMs Base delay in milliseconds (default: 60000 = 1 minute)
 * @returns Date object representing when to retry next
 */
export function calculateNextRetryAt(
  retryCount: number,
  baseDelayMs: number = 60000
): Date {
  const delayMs = Math.pow(2, retryCount) * baseDelayMs;
  return new Date(Date.now() + delayMs);
}

/**
 * Determine if event should be retried based on retry count
 *
 * @param retryCount Current retry attempt
 * @param maxRetries Maximum number of retries allowed
 * @returns true if should retry, false if should move to dead letter queue
 */
export function shouldRetry(retryCount: number, maxRetries: number): boolean {
  return retryCount < maxRetries;
}

/**
 * Get human-readable description of retry delay
 *
 * @param retryCount Current retry attempt
 * @param baseDelayMs Base delay in milliseconds
 * @returns Human-readable string (e.g., "2 minutes", "16 minutes")
 */
export function getRetryDelayDescription(
  retryCount: number,
  baseDelayMs: number = 60000
): string {
  const delayMs = Math.pow(2, retryCount) * baseDelayMs;
  const delayMinutes = Math.round(delayMs / 60000);

  if (delayMinutes < 60) {
    return `${delayMinutes} minute${delayMinutes === 1 ? "" : "s"}`;
  }

  const delayHours = Math.round(delayMinutes / 60);
  return `${delayHours} hour${delayHours === 1 ? "" : "s"}`;
}
