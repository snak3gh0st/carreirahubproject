/**
 * Compute the dayBucket key for a persona cache entry.
 *
 * The bucket is a string `YYYY-MM-DD-HHmm` where HHmm is the start of the TTL
 * window containing `now`, aligned to UTC start of day.
 *
 * Example: with ttlMinutes = 180 (3h), windows are 00:00, 03:00, 06:00, … 21:00.
 * A request at 14:37 UTC falls into the 12:00 window → `YYYY-MM-DD-1200`.
 */
export function computeDayBucket(now: Date, ttlMinutes: number): string {
  if (ttlMinutes <= 0) throw new Error("ttlMinutes must be > 0");
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const minutesIntoDay = utcHour * 60 + utcMinute;
  const windowStartMinutes = Math.floor(minutesIntoDay / ttlMinutes) * ttlMinutes;
  const windowHour = Math.floor(windowStartMinutes / 60);
  const windowMinute = windowStartMinutes % 60;
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(windowHour).padStart(2, "0");
  const mi = String(windowMinute).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}-${hh}${mi}`;
}
