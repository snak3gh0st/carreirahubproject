import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDigisacStorageMissing } from "@/lib/ops/digisac-store";
import { buildDigisacContactUrl, getDigisacConfig } from "@/lib/services/digisac.service";
import { isOperationalAccessRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

function serializeDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function includesQuery(value: string | null | undefined, query: string) {
  return value?.toLowerCase().includes(query) ?? false;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOperationalAccessRole(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const config = getDigisacConfig();
  const searchParams = request.nextUrl.searchParams;
  const query = (searchParams.get("q") ?? "").trim().toLowerCase();
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 80), 10), 150);

  try {
    const rows = await prisma.opsDigisacThread.findMany({
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      take: 150,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            qbBalance: true,
          },
        },
        enrollment: {
          select: {
            id: true,
            programType: true,
            status: true,
            currentPhase: { select: { label: true, key: true, slaDays: true } },
            assignedTo: { select: { id: true, name: true } },
          },
        },
        messages: {
          orderBy: [{ externalCreatedAt: "desc" }, { createdAt: "desc" }],
          take: 1,
          include: {
            sentBy: { select: { id: true, name: true, email: true } },
          },
        },
        _count: { select: { messages: true } },
      },
    });

    const threads = rows.map((thread) => {
      const latest = thread.messages[0] ?? null;
      const displayName = thread.customer?.name ?? thread.contactName ?? thread.phoneNumber;
      const needsReply = latest?.direction === "INBOUND";

      return {
        id: thread.id,
        phoneNumber: thread.phoneNumber,
        contactId: thread.contactId,
        contactName: thread.contactName,
        contactUrl: buildDigisacContactUrl(thread.contactId),
        ticketId: thread.ticketId,
        serviceId: thread.serviceId,
        status: thread.status,
        lastMessageAt: serializeDate(thread.lastMessageAt),
        lastSyncedAt: serializeDate(thread.lastSyncedAt),
        messageCount: thread._count.messages,
        needsReply,
        displayName,
        customer: thread.customer,
        enrollment: thread.enrollment,
        latestMessage: latest
          ? {
              id: latest.id,
              direction: latest.direction,
              content: latest.content,
              status: latest.status,
              senderName: latest.senderName,
              externalCreatedAt: serializeDate(latest.externalCreatedAt),
              createdAt: serializeDate(latest.createdAt),
              sentBy: latest.sentBy,
            }
          : null,
      };
    });

    const filteredThreads = query
      ? threads.filter((thread) =>
          includesQuery(thread.displayName, query) ||
          includesQuery(thread.customer?.email, query) ||
          includesQuery(thread.customer?.phone, query) ||
          includesQuery(thread.phoneNumber, query) ||
          includesQuery(thread.enrollment?.currentPhase?.label, query) ||
          includesQuery(thread.enrollment?.assignedTo?.name, query)
        )
      : threads;

    return NextResponse.json({
      config: { enabled: config.enabled, missing: config.missing },
      stats: {
        total: threads.length,
        needsReply: threads.filter((thread) => thread.needsReply).length,
        unmatched: threads.filter((thread) => !thread.customer?.id).length,
        activeEnrollments: threads.filter((thread) => Boolean(thread.enrollment?.id)).length,
      },
      threads: filteredThreads.slice(0, limit),
    });
  } catch (error) {
    if (isDigisacStorageMissing(error)) {
      return NextResponse.json({
        config: { enabled: config.enabled, missing: config.missing },
        stats: { total: 0, needsReply: 0, unmatched: 0, activeEnrollments: 0 },
        threads: [],
        migrationRequired: true,
      });
    }
    throw error;
  }
}
