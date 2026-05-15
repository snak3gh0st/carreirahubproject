import { prisma } from "@/lib/db";

export function resolveSyncTimestamp(
  primary?: Date | null,
  fallback?: Date | null
): Date | null {
  if (primary && fallback) {
    return primary > fallback ? primary : fallback;
  }

  return primary ?? fallback ?? null;
}

export async function getEffectiveSyncTimestamps(): Promise<{
  quickbooksLastSync: Date | null;
  clintLastSync: Date | null;
}> {
  const [systemConfig, latestQuickbooksLog, latestClintLog] = await Promise.all([
    prisma.systemConfig.findUnique({
      where: { id: "system" },
      select: {
        last_qb_sync: true,
        last_clint_sync: true,
      },
    }),
    prisma.integrationLog.findFirst({
      where: {
        service: { in: ["QUICKBOOKS", "quickbooks"] },
        action: "SYNC",
        status: "SUCCESS",
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.integrationLog.findMany({
      where: {
        service: { in: ["clint-sync", "CLINT"] },
        action: { in: ["syncAll", "SYNC"] },
        status: "SUCCESS",
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { createdAt: true, payload: true },
    }),
  ]);
  const latestFullClintLog = latestClintLog.find((log) => {
    const payload = (log as { payload?: unknown }).payload as Record<string, any> | null | undefined;
    if (!payload) return false;
    if (payload.completedFullSync === true) return true;
    return payload.maxPages == null
      && payload.contacts?.errors === 0
      && payload.deals?.errors === 0;
  });

  return {
    quickbooksLastSync: resolveSyncTimestamp(
      systemConfig?.last_qb_sync,
      latestQuickbooksLog?.createdAt
    ),
    clintLastSync: resolveSyncTimestamp(
      systemConfig?.last_clint_sync,
      latestFullClintLog?.createdAt
    ),
  };
}
