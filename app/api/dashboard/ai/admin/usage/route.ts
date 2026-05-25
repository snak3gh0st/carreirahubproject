import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { estimateCostUSD } from '@/lib/ai/pricing';
import { resolveAiGatewayModel } from '@/lib/ai/gateway';
import { UserRole } from '@prisma/client';

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string; role?: string } | undefined;
  if (!session || !sessionUser?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (sessionUser.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: 'Acesso restrito a ADMIN' }, { status: 403 });
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

  const [todayAgg, last30Agg, topUsers, topTools, recentErrors] = await Promise.all([
    prisma.aiMessage.aggregate({
      where: { role: 'ASSISTANT', createdAt: { gte: startOfToday } },
      _sum: { tokensIn: true, tokensOut: true },
      _count: { _all: true },
    }),
    prisma.aiMessage.aggregate({
      where: { role: 'ASSISTANT', createdAt: { gte: thirtyDaysAgo } },
      _sum: { tokensIn: true, tokensOut: true },
      _count: { _all: true },
    }),
    prisma.aiConversation.groupBy({
      by: ['userId'],
      where: { updatedAt: { gte: thirtyDaysAgo } },
      _count: { _all: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 10,
    }),
    prisma.aiMessage.groupBy({
      by: ['toolName'],
      where: { role: 'TOOL', createdAt: { gte: thirtyDaysAgo }, toolName: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { toolName: 'desc' } },
      take: 10,
    }),
    prisma.aiMessage.findMany({
      where: { errorMessage: { not: null }, createdAt: { gte: thirtyDaysAgo } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, conversationId: true, errorMessage: true, toolName: true, createdAt: true, modelUsed: true },
    }),
  ]);

  const modelDefault = resolveAiGatewayModel({ task: "dashboard_copilot" });
  const todayCost = estimateCostUSD(todayAgg._sum.tokensIn ?? 0, todayAgg._sum.tokensOut ?? 0, modelDefault);
  const last30Cost = estimateCostUSD(last30Agg._sum.tokensIn ?? 0, last30Agg._sum.tokensOut ?? 0, modelDefault);

  // Attach user names
  const userIds = topUsers.map(u => u.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, name: true, role: true },
  });
  const userMap = new Map(users.map(u => [u.id, u]));

  return NextResponse.json({
    today: {
      messages: todayAgg._count._all,
      tokensIn: todayAgg._sum.tokensIn ?? 0,
      tokensOut: todayAgg._sum.tokensOut ?? 0,
      estimatedCostUSD: todayCost,
    },
    last30d: {
      messages: last30Agg._count._all,
      tokensIn: last30Agg._sum.tokensIn ?? 0,
      tokensOut: last30Agg._sum.tokensOut ?? 0,
      estimatedCostUSD: last30Cost,
    },
    topUsers: topUsers.map(u => ({
      userId: u.userId,
      email: userMap.get(u.userId)?.email ?? 'unknown',
      name: userMap.get(u.userId)?.name ?? null,
      role: userMap.get(u.userId)?.role ?? null,
      conversations: u._count._all,
    })),
    topTools: topTools.map(t => ({ toolName: t.toolName, calls: t._count._all })),
    recentErrors: recentErrors.map(e => ({ ...e, createdAt: e.createdAt.toISOString() })),
  });
}
