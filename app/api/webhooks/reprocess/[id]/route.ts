import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { integrationLogger } from "@/lib/utils/logger";

/**
 * POST /api/webhooks/reprocess/:id
 *
 * Reprocess a webhook event from the dead letter queue
 *
 * This endpoint allows administrators to retry permanently failed webhooks
 * by resetting their status to "pending" and scheduling them for immediate retry.
 *
 * Authentication: ADMIN or OPERATIONAL roles required
 *
 * Returns:
 * - success: true if webhook was successfully reset
 * - event: Updated webhook event object
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;

    // Check authorization (ADMIN or OPERATIONAL roles only)
    if (userRole !== "ADMIN" && userRole !== "OPERATIONAL") {
      await integrationLogger.logError(
        "WEBHOOK_REPROCESS",
        "UNAUTHORIZED_ACCESS",
        "User does not have permission to reprocess webhooks",
        {
          userId: (session.user as any).id,
          userRole,
          webhookEventId: params.id,
        }
      );

      return NextResponse.json(
        { error: "Forbidden: ADMIN or OPERATIONAL role required" },
        { status: 403 }
      );
    }

    const eventId = params.id;

    // Find the webhook event
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { id: eventId },
    });

    if (!existingEvent) {
      await integrationLogger.logError(
        "WEBHOOK_REPROCESS",
        "EVENT_NOT_FOUND",
        "Webhook event not found",
        {
          userId: (session.user as any).id,
          webhookEventId: eventId,
        }
      );

      return NextResponse.json(
        { error: "Webhook event not found" },
        { status: 404 }
      );
    }

    // Verify event is in dead letter queue
    if (existingEvent.status !== "dead_letter") {
      await integrationLogger.logError(
        "WEBHOOK_REPROCESS",
        "INVALID_STATUS",
        "Webhook event is not in dead letter queue",
        {
          userId: (session.user as any).id,
          webhookEventId: eventId,
          currentStatus: existingEvent.status,
        }
      );

      return NextResponse.json(
        {
          error: "Webhook event is not in dead letter queue",
          currentStatus: existingEvent.status,
        },
        { status: 400 }
      );
    }

    // Reset webhook event for reprocessing
    const updatedEvent = await prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: "pending",
        retry_count: 0,
        next_retry_at: new Date(), // Process immediately
        last_error: null,
        updated_at: new Date(),
      },
    });

    await integrationLogger.logSuccess(
      "WEBHOOK_REPROCESS",
      "EVENT_RESET",
      {
        userId: (session.user as any).id,
        webhookEventId: eventId,
        service: updatedEvent.service,
        eventType: updatedEvent.event_type,
        eventIdExternal: updatedEvent.event_id,
      }
    );

    return NextResponse.json({
      success: true,
      message: "Webhook event reset for reprocessing",
      event: {
        id: updatedEvent.id,
        service: updatedEvent.service,
        event_type: updatedEvent.event_type,
        event_id: updatedEvent.event_id,
        status: updatedEvent.status,
        retry_count: updatedEvent.retry_count,
        next_retry_at: updatedEvent.next_retry_at,
      },
    });
  } catch (error: any) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    await integrationLogger.logError(
      "WEBHOOK_REPROCESS",
      "RESET_ERROR",
      errorMessage,
      {
        webhookEventId: params.id,
      }
    );

    console.error("[REPROCESS] Reset error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
