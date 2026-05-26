import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getDigisacMessagesForEnrollment,
  isDigisacStorageMissing,
  storeOutboundDigisacMessage,
} from "@/lib/ops/digisac-store";
import { getDigisacConfig, sendDigisacMessage } from "@/lib/services/digisac.service";
import { prisma } from "@/lib/db";
import { isOperationalAccessRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

function canUseOps(role: string | undefined) {
  return isOperationalAccessRole(role);
}

function serializeDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUseOps(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const config = getDigisacConfig();
  try {
    const data = await getDigisacMessagesForEnrollment(params.id);
    if (!data) return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });

    return NextResponse.json({
      config: { enabled: config.enabled, missing: config.missing },
      thread: {
        id: data.thread.id,
        phoneNumber: data.thread.phoneNumber,
        contactId: data.thread.contactId,
        contactName: data.thread.contactName,
        ticketId: data.thread.ticketId,
        serviceId: data.thread.serviceId,
        status: data.thread.status,
        contactUrl: data.contactUrl,
        lastMessageAt: serializeDate(data.thread.lastMessageAt),
        lastSyncedAt: serializeDate(data.thread.lastSyncedAt),
      },
      messages: data.messages.map((message) => ({
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
      })),
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
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  const userId = (session?.user as any)?.id as string | undefined;
  if (!session?.user || !userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUseOps(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

  const enrollment = await prisma.mentorshipEnrollment.findUnique({
    where: { id: params.id },
    include: { customer: { select: { phone: true } } },
  });
  if (!enrollment) return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  if (!enrollment.customer.phone) {
    return NextResponse.json({ error: "Cliente sem telefone cadastrado" }, { status: 400 });
  }

  try {
    const result = await sendDigisacMessage({
      number: enrollment.customer.phone,
      text,
      serviceId: config.serviceId,
      dontOpenTicket: false,
    });
    const message = await storeOutboundDigisacMessage({
      enrollmentId: params.id,
      sentById: userId,
      text,
      result,
    });

    await prisma.integrationLog.create({
      data: {
        service: "DIGISAC",
        action: "OPS_MESSAGE_SENT",
        status: "SUCCESS",
        payload: {
          enrollmentId: params.id,
          messageId: message.id,
          externalId: result.externalId,
        },
      },
    }).catch(() => {});

    return NextResponse.json({ ok: true, messageId: message.id }, { status: 201 });
  } catch (error) {
    await prisma.integrationLog.create({
      data: {
        service: "DIGISAC",
        action: "OPS_MESSAGE_SENT",
        status: "ERROR",
        error: error instanceof Error ? error.message : String(error),
        payload: { enrollmentId: params.id },
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
