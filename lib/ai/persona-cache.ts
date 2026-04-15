import { prisma } from "@/lib/db";
import type { PersonaCacheEntry } from "@prisma/client";

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

export type CacheLookup =
  | { status: "hit"; entry: PersonaCacheEntry; alreadyRead: boolean }
  | { status: "miss" };

/**
 * Look up a cache entry and detect whether this user already read it in this bucket.
 * `alreadyRead = true` signals the caller should use delta mode instead of re-serving.
 */
export async function lookupPersonaCache(params: {
  personaSlug: string;
  dayBucket: string;
  userId: string;
}): Promise<CacheLookup> {
  const entry = await prisma.personaCacheEntry.findUnique({
    where: {
      personaSlug_dayBucket: {
        personaSlug: params.personaSlug,
        dayBucket: params.dayBucket,
      },
    },
  });
  if (!entry) return { status: "miss" };

  const read = await prisma.personaCacheRead.findUnique({
    where: {
      personaSlug_dayBucket_userId: {
        personaSlug: params.personaSlug,
        dayBucket: params.dayBucket,
        userId: params.userId,
      },
    },
  });

  return { status: "hit", entry, alreadyRead: read !== null };
}

/** Record that this user has now read this bucket (idempotent). */
export async function recordPersonaCacheRead(params: {
  personaSlug: string;
  dayBucket: string;
  userId: string;
}): Promise<void> {
  await prisma.personaCacheRead.upsert({
    where: {
      personaSlug_dayBucket_userId: {
        personaSlug: params.personaSlug,
        dayBucket: params.dayBucket,
        userId: params.userId,
      },
    },
    create: { ...params },
    update: {}, // readAt stays at first-read time; we don't update on repeat hits.
  });
}

/** Persist a freshly-generated persona analysis into cache. */
export async function writePersonaCache(params: {
  personaSlug: string;
  dayBucket: string;
  content: string;
  generatedBy: string;
}): Promise<void> {
  await prisma.personaCacheEntry.upsert({
    where: {
      personaSlug_dayBucket: {
        personaSlug: params.personaSlug,
        dayBucket: params.dayBucket,
      },
    },
    create: {
      personaSlug: params.personaSlug,
      dayBucket: params.dayBucket,
      content: params.content,
      generatedBy: params.generatedBy,
    },
    update: {
      content: params.content,
      generatedAt: new Date(),
      generatedBy: params.generatedBy,
    },
  });
}
