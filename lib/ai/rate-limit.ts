import { prisma } from '@/lib/db';

const WINDOW_MS = 60 * 60 * 1000; // 1 hour

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
  remaining: number;
}

export async function checkRateLimit(
  userId: string,
  limitPerHour: number
): Promise<RateLimitResult> {
  const now = new Date();
  const existing = await prisma.aiRateLimit.findUnique({ where: { userId } });

  if (!existing) {
    await prisma.aiRateLimit.create({
      data: { userId, windowStart: now, count: 1 },
    });
    return { allowed: true, retryAfterSec: 0, remaining: limitPerHour - 1 };
  }

  const windowAgeMs = now.getTime() - existing.windowStart.getTime();
  if (windowAgeMs >= WINDOW_MS) {
    await prisma.aiRateLimit.update({
      where: { userId },
      data: { windowStart: now, count: 1 },
    });
    return { allowed: true, retryAfterSec: 0, remaining: limitPerHour - 1 };
  }

  if (existing.count >= limitPerHour) {
    const retryAfterSec = Math.ceil((WINDOW_MS - windowAgeMs) / 1000);
    return { allowed: false, retryAfterSec, remaining: 0 };
  }

  await prisma.aiRateLimit.update({
    where: { userId },
    data: { count: { increment: 1 } },
  });
  return {
    allowed: true,
    retryAfterSec: 0,
    remaining: limitPerHour - existing.count - 1,
  };
}
