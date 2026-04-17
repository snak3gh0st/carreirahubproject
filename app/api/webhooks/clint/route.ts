import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyHmacSignature } from "@/lib/utils/hmac";
import { clintEventProcessor } from "@/lib/services/clint-event-processor.service";
import { integrationLogger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/clint
 *
 * Receives real-time events from Clint CRM.
 * Always returns 200 — Clint will retry on non-200.
 *
 * Supported events:
 *   contact.created | contact.updated | deal.won | deal.stage_changed
 */
export async function POST(request: NextRequest) {
  let webhookEventId: string | null = null;

  try {
    const rawBody = await request.text();
    const signature = request.headers.get("X-Clint-Signature");
    const secret = process.env.CLINT_WEBHOOK_SECRET;

    // Verify HMAC signature (same utility as DocuSign)
    if (secret) {
      const valid = verifyHmacSignature(rawBody, signature, secret);
      if (!valid) {
        console.error("[CLINT_WEBHOOK] Invalid signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } else {
      console.warn("[CLINT_WEBHOOK] CLINT_WEBHOOK_SECRET not set — skipping verification");
    }

    const payload = JSON.parse(rawBody) as {
      event: string;
      event_id?: string;
      data?: Record<string, unknown>;
    };

    const { event, data = {} } = payload;
    const eventId = payload.event_id ?? `${event}-${Date.now()}`;

    // Deduplicate (Clint may retry)
    const existing = await prisma.webhookEvent.findFirst({
      where: { service: "clint", event_id: eventId, status: "success" },
    });
    if (existing) {
      console.log(`[CLINT_WEBHOOK] Duplicate event ${eventId} — skipping`);
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // Record event
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        service: "clint",
        event_type: event,
        event_id: eventId,
        payload: payload as any,
        headers: { signature: signature ?? "" } as any,
        status: "processing",
        max_retries: 3,
      },
    });
    webhookEventId = webhookEvent.id;

    console.log(`[CLINT_WEBHOOK] Processing event '${event}' id=${eventId}`);

    // Route to processor
    switch (event) {
      case "contact.created":
        await clintEventProcessor.handleContactCreated(data as any);
        break;
      case "contact.updated":
        await clintEventProcessor.handleContactUpdated(data as any);
        break;
      case "deal.won":
        await clintEventProcessor.handleDealWon(data as any);
        break;
      case "deal.stage_changed":
        await clintEventProcessor.handleDealStageChanged(data as any);
        break;
      default:
        console.log(`[CLINT_WEBHOOK] Unhandled event type: ${event}`);
    }

    // Mark success
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { status: "success", processed_at: new Date() },
    });

    await integrationLogger.logSuccess(
      "CLINT",
      `WEBHOOK_${event.toUpperCase().replace(/\./g, "_")}`,
      { event, eventId }
    );

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error("[CLINT_WEBHOOK] Error:", error);

    if (webhookEventId) {
      await prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: {
          status: "failed",
          last_error: error instanceof Error ? error.message : String(error),
          retry_count: { increment: 1 },
        },
      }).catch(() => {});
    }

    await integrationLogger.logError(
      "CLINT",
      "WEBHOOK_ERROR",
      error instanceof Error ? error : new Error(String(error)),
      { errorCode: "PROCESSING_FAILED", category: "transient" },
      {}
    );

    // Return 200 — Clint retries on non-200
    return NextResponse.json({ ok: false, error: String(error) });
  }
}

export async function GET() {
  return NextResponse.json({ service: "Clint Webhook Handler", status: "active" });
}
