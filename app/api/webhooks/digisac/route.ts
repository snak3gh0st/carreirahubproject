import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storeInboundDigisacWebhookMessage } from "@/lib/ops/digisac-store";
import { extractDigisacWebhookMessage } from "@/lib/services/digisac.service";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.DIGISAC_WEBHOOK_SECRET?.trim();
  if (!secret) return true;

  const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const explicitSecret =
    request.headers.get("x-digisac-secret") ??
    request.headers.get("x-webhook-secret") ??
    request.headers.get("x-api-key");

  return auth === secret || explicitSecret === secret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = extractDigisacWebhookMessage(payload);
  if (!message) {
    await prisma.integrationLog.create({
      data: {
        service: "DIGISAC",
        action: "WEBHOOK_IGNORED",
        status: "SUCCESS",
        payload: payload as any,
      },
    }).catch(() => {});
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const stored = await storeInboundDigisacWebhookMessage(message);
    await prisma.integrationLog.create({
      data: {
        service: "DIGISAC",
        action: "WEBHOOK_MESSAGE_RECEIVED",
        status: "SUCCESS",
        payload: {
          messageId: stored.id,
          externalId: message.externalId,
          contactId: message.contactId,
          phoneNumber: message.phoneNumber,
          direction: message.direction,
        },
      },
    }).catch(() => {});

    return NextResponse.json({ ok: true, messageId: stored.id });
  } catch (error) {
    await prisma.integrationLog.create({
      data: {
        service: "DIGISAC",
        action: "WEBHOOK_MESSAGE_RECEIVED",
        status: "ERROR",
        error: error instanceof Error ? error.message : String(error),
        payload: payload as any,
      },
    }).catch(() => {});

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro no webhook Digisac" },
      { status: 500 }
    );
  }
}
