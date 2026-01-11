import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { retellService } from "@/lib/services/retell.service";
import { collectionCallService } from "@/lib/services/collection-call.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/retell
 * Handle RetellAI webhook events
 * Events: call_started, call_ended, call_analyzed
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-retell-signature") || "";

    // Verify webhook signature
    if (!retellService.verifyWebhookSignature(rawBody, signature)) {
      console.error("[RETELL_WEBHOOK] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const event = retellService.parseWebhookEvent(body);

    console.log("[RETELL_WEBHOOK] Received event:", event.event, "Call ID:", event.call.call_id);

    // Log the webhook
    await prisma.integrationLog.create({
      data: {
        service: "RETELL",
        action: `WEBHOOK_${event.event.toUpperCase()}`,
        status: "SUCCESS",
        payload: {
          event: event.event,
          callId: event.call.call_id,
          callStatus: event.call.call_status,
          metadata: event.call.metadata,
        } as any,
      },
    });

    // Handle different event types
    switch (event.event) {
      case "call_started":
        await collectionCallService.handleCallStarted(event);
        break;

      case "call_ended":
        await collectionCallService.handleCallEnded(event);
        break;

      case "call_analyzed":
        await collectionCallService.handleCallAnalyzed(event);
        break;

      default:
        console.log("[RETELL_WEBHOOK] Unknown event type:", event.event);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[RETELL_WEBHOOK_ERROR]", error);

    // Log the error
    await prisma.integrationLog.create({
      data: {
        service: "RETELL",
        action: "WEBHOOK_ERROR",
        status: "ERROR",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    // Return 200 to prevent retries for invalid payloads
    return NextResponse.json(
      { error: "Webhook processing failed", received: true },
      { status: 200 }
    );
  }
}

/**
 * GET /api/webhooks/retell
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "retell-webhook",
    configured: retellService.isConfigured(),
  });
}
