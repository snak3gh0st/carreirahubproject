import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractEventId } from "./webhook-event-id";
import {
  enqueueQuickBooksWebhook,
  enqueueDocuSignWebhook,
  enqueueTwilioWebhook,
  WebhookQueueJob,
} from "./webhook-queue";

/**
 * Webhook Handler Utility
 *
 * Implements the proper webhook pattern:
 * 1. Validate signature (caller's responsibility - must be done before calling this)
 * 2. Check for duplicates (idempotency)
 * 3. Store webhook in WebhookEvent table
 * 4. Enqueue for async processing
 * 5. Return 200 OK immediately
 *
 * This ensures webhooks respond within milliseconds, not seconds.
 */

export interface WebhookAcceptResult {
  success: boolean;
  status: "accepted" | "duplicate" | "error";
  webhookEventId?: string;
  message: string;
}

const enqueueMap = {
  QUICKBOOKS: enqueueQuickBooksWebhook,
  DOCUSIGN: enqueueDocuSignWebhook,
  TWILIO: enqueueTwilioWebhook,
} as const;

/**
 * Accept and enqueue webhook for async processing
 *
 * @param service Service name (e.g., "QUICKBOOKS", "DOCUSIGN")
 * @param eventType Event type (e.g., "person.created", "invoice.updated")
 * @param payload Webhook payload (parsed JSON)
 * @param headers Relevant headers (including signature)
 * @returns Result indicating acceptance status
 */
export async function acceptWebhook(
  service: keyof typeof enqueueMap,
  eventType: string,
  payload: any,
  headers: any
): Promise<WebhookAcceptResult> {
  try {
    // Step 1: Extract event ID for deduplication
    const eventId = extractEventId(service, payload);

    if (!eventId) {
      throw new Error("Failed to extract event ID from payload");
    }

    // Step 2: Check for duplicate
    const existingEvent = await prisma.webhookEvent.findFirst({
      where: {
        service,
        event_id: eventId,
      },
      select: {
        id: true,
        status: true,
        processed_at: true,
      },
    });

    if (existingEvent) {
      // Already processed successfully
      if (existingEvent.status === "success" && existingEvent.processed_at) {
        await prisma.integrationLog.create({
          data: {
            service,
            action: "WEBHOOK_DUPLICATE_DETECTED",
            status: "SUCCESS",
            payload: {
              eventType,
              eventId,
              existingEventId: existingEvent.id,
              reason: "already_processed",
            } as any,
          },
        });

        return {
          success: true,
          status: "duplicate",
          webhookEventId: existingEvent.id,
          message: "Event already processed",
        };
      }

      // Currently processing or pending
      if (
        existingEvent.status === "processing" ||
        existingEvent.status === "pending"
      ) {
        await prisma.integrationLog.create({
          data: {
            service,
            action: "WEBHOOK_DUPLICATE_DETECTED",
            status: "SUCCESS",
            payload: {
              eventType,
              eventId,
              existingEventId: existingEvent.id,
              reason: "currently_processing",
            } as any,
          },
        });

        return {
          success: true,
          status: "duplicate",
          webhookEventId: existingEvent.id,
          message: "Event currently being processed",
        };
      }

      // Failed or dead_letter - allow retry
      // Continue to re-enqueue
    }

    // Step 3: Store webhook event
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        service,
        event_type: eventType,
        event_id: eventId,
        payload,
        headers,
        status: "pending",
        retry_count: 0,
        max_retries: 5,
        next_retry_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Step 4: Enqueue for async processing
    const enqueueFunc = enqueueMap[service];
    if (!enqueueFunc) {
      throw new Error(`No enqueue function for service: ${service}`);
    }

    const queueJob: WebhookQueueJob = {
      webhookEventId: webhookEvent.id,
      service,
      eventType,
      payload,
      headers,
    };

    await enqueueFunc(queueJob);

    // Step 5: Log acceptance
    await prisma.integrationLog.create({
      data: {
        service,
        action: "WEBHOOK_ACCEPTED",
        status: "SUCCESS",
        payload: {
          webhookEventId: webhookEvent.id,
          eventType,
          eventId,
        } as any,
      },
    });

    return {
      success: true,
      status: "accepted",
      webhookEventId: webhookEvent.id,
      message: "Webhook accepted and queued for processing",
    };
  } catch (error: any) {
    // Log error but still return success to prevent external retries
    await prisma.integrationLog.create({
      data: {
        service,
        action: "WEBHOOK_ACCEPT_ERROR",
        status: "ERROR",
        error: error.message || "Unknown error",
        payload: {
          eventType,
          payloadSample: JSON.stringify(payload).substring(0, 500),
        } as any,
      },
    }).catch(() => {
      // Ignore logging errors
      console.error("[Webhook] Failed to log acceptance error:", error);
    });

    return {
      success: false,
      status: "error",
      message: "Error accepting webhook",
    };
  }
}

/**
 * Helper to return 200 OK response for webhook
 *
 * Always returns 200 OK to prevent external webhook systems from retrying.
 * Internal errors are logged and handled asynchronously.
 */
export function webhookResponse(result: WebhookAcceptResult): NextResponse {
  return NextResponse.json(
    {
      success: true,
      status: result.status,
      message: result.message,
      webhookEventId: result.webhookEventId,
    },
    { status: 200 }
  );
}
