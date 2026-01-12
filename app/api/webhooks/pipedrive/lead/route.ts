import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { validatePipedriveWebhookSignature } from "@/lib/utils/webhook-validation";
import { acceptWebhook, webhookResponse } from "@/lib/utils/webhook-handler";

/**
 * POST /api/webhooks/pipedrive/lead
 *
 * Webhook receiver for new Leads created in Pipedrive
 *
 * Pattern:
 * 1. Validate signature
 * 2. Accept webhook (store in DB)
 * 3. Enqueue for async processing
 * 4. Return 200 OK immediately
 *
 * Actual processing happens in queue processor (see lib/utils/queue-processor.ts)
 */
export async function POST(request: NextRequest) {
  let rawBody = "";
  let body: any = {};

  try {
    rawBody = await request.text();
    body = rawBody ? JSON.parse(rawBody) : {};
    const signature = request.headers.get("x-pipedrive-signature");

    // Get secret from database
    const config = await prisma.systemConfig.findUnique({
      where: { id: "system" },
    });

    const webhookSecret =
      config?.pipedrive_webhook_secret ||
      process.env.PIPEDRIVE_WEBHOOK_SECRET;

    // Validate signature (if configured)
    if (webhookSecret && signature) {
      const isValid = validatePipedriveWebhookSignature(
        rawBody,
        signature,
        webhookSecret
      );

      if (!isValid) {
        console.error("[Pipedrive Webhook Lead] Invalid signature");

        await prisma.integrationLog.create({
          data: {
            service: "PIPEDRIVE",
            action: "WEBHOOK_LEAD_SIGNATURE_INVALID",
            status: "ERROR",
            error: "Invalid webhook signature",
            payload: {
              hasSignature: !!signature,
              hasSecret: !!webhookSecret,
            } as any,
          },
        }).catch(() => {});

        // Still return 200 OK to prevent external retries
        // Invalid signatures are logged for investigation
        return webhookResponse({
          success: true,
          status: "accepted",
          message: "Webhook received (signature validation failed)",
        });
      }

      console.log("[Pipedrive Webhook Lead] Signature validated successfully");
    } else if (signature && !webhookSecret) {
      console.warn(
        "[Pipedrive Webhook Lead] Webhook secret not configured, skipping validation"
      );
    }

    // Determine event type
    const isV2 = body.meta && body.meta.version === "2.0";
    let eventType: string;

    if (isV2) {
      const action = body.meta?.action;
      const entity = body.meta?.entity;
      eventType = `${action}.${entity}`;
    } else {
      eventType = body.event || "unknown";
    }

    // Accept webhook and enqueue for async processing
    const result = await acceptWebhook(
      "PIPEDRIVE",
      eventType,
      body,
      {
        signature,
        contentType: request.headers.get("content-type"),
      }
    );

    // Return 200 OK immediately
    return webhookResponse(result);
  } catch (error) {
    console.error("[Pipedrive Webhook Lead] Error:", error);

    // Log error
    await prisma.integrationLog.create({
      data: {
        service: "PIPEDRIVE",
        action: "WEBHOOK_LEAD_ERROR",
        status: "ERROR",
        error: error instanceof Error ? error.message : "Unknown error",
        payload: {
          bodyPreview: JSON.stringify(body).substring(0, 500),
        } as any,
      },
    }).catch(() => {});

    // Still return 200 OK to prevent external retries
    return webhookResponse({
      success: false,
      status: "error",
      message: "Error processing webhook",
    });
  }
}
