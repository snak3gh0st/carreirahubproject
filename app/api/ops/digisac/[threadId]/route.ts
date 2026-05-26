import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDigisacStorageMissing } from "@/lib/ops/digisac-store";
import { buildDigisacContactUrl, getDigisacConfig, sendDigisacMessage } from "@/lib/services/digisac.service";
import { isOperationalAccessRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

function serializeDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function serializeMessage(message: {
  id: string;
  externalId: string | null;
  direction: "INBOUND" | "OUTBOUND" | "SYSTEM";
  content: string;
  type: string | null;
  status: string | null;
  senderName: string | null;
  externalCreatedAt: Date | null;
  createdAt: Date;
  sentBy: { id: string; name: string | null; email: string } | null;
}) {
  return {
    id: message.id,
    externalId: message.externalId,
    direction: message.direction,
    content: message.content,
    type: message.type,
    status: message.status,
    senderName: message.senderName,
    externalCreatedAt: serializeDate(message.externalCreatedAt),
    createdAt: serializeDate(message.createdAt),
    sentBy: message.sentBy,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { threadId: string } }
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOperationalAccessRole(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const config = getDigisacConfig();

  try {
    const thread = await prisma.opsDigisacThread.findUnique({
      where: { id: params.threadId },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true, qbBalance: true } },
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
          orderBy: [{ externalCreatedAt: "asc" }, { createdAt: "asc" }],
          take: 120,
          include: { sentBy: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

    return NextResponse.json({
      config: { enabled: config.enabled, missing: config.missing },
      thread: {
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
        customer: thread.customer,
        enrollment: thread.enrollment,
      },
      messages: thread.messages.map(serializeMessage),
    });
  } catch (error) {
    if (isDigisacStorageMissing(error)) {
      return NextResponse.json({
        config: { enabled: config.enabled, missing: config.missing },
        thread: null,
        messages: [],
        migrationRequired: true,
      });
    }
    throw error;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { threadId: string } }
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  const userId = (session?.user as any)?.id as string | undefined;
  if (!session?.user || !userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOperationalAccessRole(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ error: "Mensagem muito longa" }, { status: 400 });

  const config = getDigisacConfig();
  if (!config.enabled) {
    return NextResponse.json(
      { error: `Digisac nao configurado: ${config.missing.join(", ")}` },
      { status: 503 }
    );
  }

  const thread = await prisma.opsDigisacThread.findUnique({
    where: { id: params.threadId },
    select: {
      id: true,
      phoneNumber: true,
      contactId: true,
      ticketId: true,
      serviceId: true,
      customerId: true,
      enrollmentId: true,
    },
  });

  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  if (!thread.phoneNumber) return NextResponse.json({ error: "Thread sem telefone" }, { status: 400 });

  try {
    const result = await sendDigisacMessage({
      number: thread.phoneNumber,
      text,
      serviceId: config.serviceId,
      dontOpenTicket: false,
    });

    const updatedThread = await prisma.opsDigisacThread.update({
      where: { id: thread.id },
      data: {
        contactId: result.contactId ?? thread.contactId,
        ticketId: result.ticketId ?? thread.ticketId,
        serviceId: result.serviceId ?? thread.serviceId,
        lastMessageAt: new Date(),
        lastSyncedAt: new Date(),
      },
    });

    const data = {
      threadId: updatedThread.id,
      externalId: result.externalId,
      direction: "OUTBOUND" as const,
      content: text,
      type: "chat",
      status: result.status,
      sentById: userId,
      raw: result.raw as Prisma.InputJsonValue,
      externalCreatedAt: new Date(),
    };

    const message = result.externalId
      ? await prisma.opsDigisacMessage.upsert({
          where: { externalId: result.externalId },
          create: data,
          update: data,
          include: { sentBy: { select: { id: true, name: true, email: true } } },
        })
      : await prisma.opsDigisacMessage.create({
          data,
          include: { sentBy: { select: { id: true, name: true, email: true } } },
        });

    await prisma.integrationLog.create({
      data: {
        service: "DIGISAC",
        action: "OPS_THREAD_MESSAGE_SENT",
        status: "SUCCESS",
        payload: {
          threadId: thread.id,
          customerId: thread.customerId,
          enrollmentId: thread.enrollmentId,
          messageId: message.id,
          externalId: result.externalId,
        },
      },
    }).catch(() => {});

    return NextResponse.json({ ok: true, message: serializeMessage(message) }, { status: 201 });
  } catch (error) {
    await prisma.integrationLog.create({
      data: {
        service: "DIGISAC",
        action: "OPS_THREAD_MESSAGE_SENT",
        status: "ERROR",
        error: error instanceof Error ? error.message : String(error),
        payload: { threadId: thread.id, customerId: thread.customerId, enrollmentId: thread.enrollmentId },
      },
    }).catch(() => {});

    if (isDigisacStorageMissing(error)) {
      return NextResponse.json(
        { error: "Migration Digisac ainda nao foi aplicada." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao enviar pelo Digisac" },
      { status: 502 }
    );
  }
}
