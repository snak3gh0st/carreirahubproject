import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { validatePipedriveWebhookSignature } from "@/lib/utils/webhook-validation";
import { acceptWebhook, webhookResponse } from "@/lib/utils/webhook-handler";
import { integrationLogger } from "@/lib/utils/logger";

/**
 * POST /api/webhooks/pipedrive/deal
 *
 * Webhook receiver for Deal status changes in Pipedrive
 *
 * CORRECT WORKFLOW: Invoice creation drives deal updates, not vice versa
 * This webhook ONLY updates Hub deal status to match Pipedrive
 * 
 * Pattern:
 * 1. Validate signature
 * 2. Accept webhook (store in DB)
 * 3. Update Hub deal status to match Pipedrive
 * 4. Return 200 OK immediately
 *
 * NOTE: Deal won does NOT trigger invoice creation
 * Invoices are created in Hub → Update Pipedrive deal → Contract signed → Mark deal won
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
        console.error("[Pipedrive Webhook Deal] Invalid signature");

        await prisma.integrationLog.create({
          data: {
            service: "PIPEDRIVE",
            action: "WEBHOOK_DEAL_SIGNATURE_INVALID",
            status: "ERROR",
            error: "Invalid webhook signature",
            payload: {
              hasSignature: !!signature,
              hasSecret: !!webhookSecret,
            } as any,
          },
        }).catch(() => {});

        // Still return 200 OK to prevent external retries
        return webhookResponse({
          success: true,
          status: "accepted",
          message: "Webhook received (signature validation failed)",
        });
      }

      console.log("[Pipedrive Webhook Deal] Signature validated successfully");
    } else if (signature && !webhookSecret) {
      console.warn(
        "[Pipedrive Webhook Deal] Webhook secret not configured, skipping validation"
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

    // Update deal status in Hub if deal status changed
    // IMPORTANT: Invoice creation drives deal updates, not vice versa
    // Deal won webhook should ONLY update Hub deal status to match Pipedrive
    if (body.current && body.current.status) {
      const dealId = body.current.id;
      const status = body.current.status; // "OPEN", "WON", "LOST", etc.

      // Find deal in our database by Pipedrive ID
      const deal = await prisma.deal.findUnique({
        where: { pipedrive_deal_id: dealId },
      });

      if (deal) {
        // Update Hub deal status to match Pipedrive (simple sync)
        await prisma.deal.update({
          where: { id: deal.id },
          data: { 
            status: status,
            lastPipedriveSyncAt: new Date()
          }
        });

        await integrationLogger.logSuccess(
          "PIPEDRIVE",
          "DEAL_STATUS_UPDATED",
          { dealId: deal.id, pipedriveId: dealId, status }
        );

        console.log(`[Pipedrive Webhook Deal] Updated deal ${deal.id} status to ${status}`);
      } else {
        console.log(`[Pipedrive Webhook Deal] Deal ${dealId} not found in database, no update needed`);
        await integrationLogger.logSuccess(
          "PIPEDRIVE",
          "DEAL_NOT_FOUND",
          { pipedriveId: dealId, status }
        );
      }
    }

    // Return 200 OK immediately
    return webhookResponse(result);
  } catch (error) {
    console.error("[Pipedrive Webhook Deal] Error:", error);

    // Log error
    await prisma.integrationLog.create({
      data: {
        service: "PIPEDRIVE",
        action: "WEBHOOK_DEAL_ERROR",
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
