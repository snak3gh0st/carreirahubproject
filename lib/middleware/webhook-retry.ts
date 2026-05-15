import { prisma } from "@/lib/db";
import { integrationLogger } from "@/lib/utils/logger";
import { calculateNextRetryAt, shouldRetry } from "@/lib/utils/retry-logic";

/**
 * Webhook Retry Middleware
 *
 * Provides webhook persistence, retry logic with exponential backoff,
 * and dead letter queue for permanently failed webhooks.
 *
 * Key behaviors:
 * - Persists all incoming webhooks to WebhookEvent table
 * - Returns 200 OK immediately to webhook sender (don't block their retry logic)
 * - On failure: schedules retry with exponential backoff
 * - After max retries: moves to dead letter queue (status="dead_letter")
 * - Logs all operations to IntegrationLog for debugging
 *
 * Constraints:
 * - Designed for Vercel serverless (no long-running workers)
 * - Retries are processed by cron jobs (implemented in Phase 3)
 */

export interface WebhookHandlerResult {
  success: boolean;
  error?: string;
}

export interface WebhookRetryResult {
  status: "success" | "duplicate" | "error";
  httpStatus: number;
  message: string;
}

export type WebhookHandler = (
  payload: any,
  headers: any
) => Promise<WebhookHandlerResult>;

/**
 * Handle webhook with automatic retry and dead letter queue
 *
 * This function wraps webhook processing to ensure zero lost events:
 * 1. Persists webhook to database (status="pending")
 * 2. Attempts to process webhook via provided handler
 * 3. On success: updates status="success", sets processed_at
 * 4. On failure: increments retry_count, schedules next retry with exponential backoff
 * 5. If max retries exceeded: sets status="dead_letter" (permanent failure)
 * 6. Always returns 200 OK to webhook sender
 *
 * @param service Service name (e.g., "quickbooks", "docusign")
 * @param eventType Event type (e.g., "person.created", "invoice.updated")
 * @param eventId External event ID for deduplication
 * @param payload Raw webhook payload
 * @param headers Relevant headers (including signature)
 * @param handler Async function that processes the webhook
 * @returns Response object with status, message, and HTTP status code
 */
export async function handleWebhookWithRetry(
  service: string,
  eventType: string,
  eventId: string,
  payload: any,
  headers: any,
  handler: WebhookHandler
): Promise<WebhookRetryResult> {
  try {
    // Step 1: Check for duplicate webhook (idempotency)
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
      // If already successfully processed, skip
      if (existingEvent.status === "success" && existingEvent.processed_at) {
        await integrationLogger.logSuccess(
          "WEBHOOK_RETRY",
          "DUPLICATE_DETECTED",
          {
            service,
            eventType,
            eventId,
            existingEventId: existingEvent.id,
            existingStatus: existingEvent.status,
            message: "Event already processed",
          }
        );

        return {
          status: "duplicate" as const,
          httpStatus: 200,
          message: "Event already processed",
        };
      }

      // If currently processing or pending, skip to avoid concurrent processing
      if (existingEvent.status === "processing" || existingEvent.status === "pending") {
        await integrationLogger.logSuccess(
          "WEBHOOK_RETRY",
          "DUPLICATE_DETECTED",
          {
            service,
            eventType,
            eventId,
            existingEventId: existingEvent.id,
            existingStatus: existingEvent.status,
            message: "Event currently being processed",
          }
        );

        return {
          status: "duplicate" as const,
          httpStatus: 200,
          message: "Event currently being processed",
        };
      }

      // If failed or dead_letter, continue with retry logic (legitimate retry)
      // This allows for manual reprocessing and automatic retries
    }

    // Step 2: Persist webhook to database
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
        next_retry_at: new Date(), // Process immediately
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    await integrationLogger.logSuccess("WEBHOOK_RETRY", "EVENT_PERSISTED", {
      webhookEventId: webhookEvent.id,
      service,
      eventType,
      eventId,
    });

    // Step 3: Attempt to process webhook
    try {
      const result = await handler(payload, headers);

      if (result.success) {
        // Success: mark as processed
        await prisma.webhookEvent.update({
          where: { id: webhookEvent.id },
          data: {
            status: "success",
            processed_at: new Date(),
            updated_at: new Date(),
          },
        });

        await integrationLogger.logSuccess(
          "WEBHOOK_RETRY",
          "EVENT_PROCESSED",
          {
            webhookEventId: webhookEvent.id,
            service,
            eventType,
            eventId,
          }
        );

        return {
          status: "success" as const,
          httpStatus: 200,
          message: "Webhook processed successfully",
        };
      } else {
        // Handler returned failure
        throw new Error(result.error || "Handler returned failure");
      }
    } catch (processingError: any) {
      // Step 4: Handle processing failure
      const errorMessage =
        processingError instanceof Error
          ? processingError.message
          : String(processingError);

      const currentRetryCount = webhookEvent.retry_count + 1;
      const canRetry = shouldRetry(currentRetryCount, webhookEvent.max_retries);

      if (canRetry) {
        // Schedule retry with exponential backoff
        const nextRetryAt = calculateNextRetryAt(currentRetryCount);

        await prisma.webhookEvent.update({
          where: { id: webhookEvent.id },
          data: {
            status: "failed",
            retry_count: currentRetryCount,
            next_retry_at: nextRetryAt,
            last_error: errorMessage,
            updated_at: new Date(),
          },
        });

        await integrationLogger.logError(
          "WEBHOOK_RETRY",
          "EVENT_FAILED_WILL_RETRY",
          errorMessage,
          {
            webhookEventId: webhookEvent.id,
            service,
            eventType,
            eventId,
            retryCount: currentRetryCount,
            maxRetries: webhookEvent.max_retries,
            nextRetryAt: nextRetryAt.toISOString(),
          },
          currentRetryCount
        );
      } else {
        // Max retries exceeded: move to dead letter queue
        await prisma.webhookEvent.update({
          where: { id: webhookEvent.id },
          data: {
            status: "dead_letter",
            retry_count: currentRetryCount,
            last_error: errorMessage,
            updated_at: new Date(),
          },
        });

        await integrationLogger.logError(
          "WEBHOOK_RETRY",
          "EVENT_DEAD_LETTER",
          errorMessage,
          {
            webhookEventId: webhookEvent.id,
            service,
            eventType,
            eventId,
            retryCount: currentRetryCount,
            maxRetries: webhookEvent.max_retries,
          },
          currentRetryCount
        );
      }

      // Always return 200 OK to webhook sender
      return {
        status: "error" as const,
        httpStatus: 200,
        message: "Webhook received and queued for retry",
      };
    }
  } catch (systemError: any) {
    // Catastrophic failure (database error, etc.)
    const errorMessage =
      systemError instanceof Error
        ? systemError.message
        : String(systemError);

    await integrationLogger.logError(
      "WEBHOOK_RETRY",
      "SYSTEM_ERROR",
      errorMessage,
      {
        service,
        eventType,
        eventId,
        payload,
      }
    );

    // Still return 200 OK to prevent webhook sender from retrying
    return {
      status: "error" as const,
      httpStatus: 200,
      message: "Webhook received but system error occurred",
    };
  }
}

/**
 * Process pending webhook retries
 *
 * This function is called by cron jobs to process webhooks that are
 * scheduled for retry (status="failed" and next_retry_at <= now).
 *
 * @param service Optional service filter (process all if not provided)
 * @param limit Maximum number of webhooks to process in one batch
 * @returns Number of webhooks processed
 */
export async function processWebhookRetries(
  service?: string,
  limit: number = 50
): Promise<number> {
  try {
    const now = new Date();

    const pendingRetries = await prisma.webhookEvent.findMany({
      where: {
        status: "failed",
        next_retry_at: {
          lte: now,
        },
        ...(service && { service }),
      },
      orderBy: {
        next_retry_at: "asc",
      },
      take: limit,
    });

    await integrationLogger.logSuccess(
      "WEBHOOK_RETRY",
      "RETRY_BATCH_STARTED",
      {
        count: pendingRetries.length,
        service: service || "all",
      }
    );

    let processedCount = 0;

    for (const event of pendingRetries) {
      // Mark as processing to prevent duplicate processing
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: "processing",
          updated_at: new Date(),
        },
      });

      // NOTE: Actual retry processing will be implemented when we integrate
      // this middleware with existing webhook endpoints. For now, we just
      // mark the event as processing. The cron job will need to:
      // 1. Determine which webhook endpoint to call based on service + event_type
      // 2. Invoke the appropriate handler with the stored payload
      // 3. Update the webhook event based on the result

      processedCount++;
    }

    await integrationLogger.logSuccess(
      "WEBHOOK_RETRY",
      "RETRY_BATCH_COMPLETED",
      {
        processedCount,
        service: service || "all",
      }
    );

    return processedCount;
  } catch (error: any) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    await integrationLogger.logError(
      "WEBHOOK_RETRY",
      "RETRY_BATCH_ERROR",
      errorMessage,
      {
        service: service || "all",
      }
    );

    return 0;
  }
}
