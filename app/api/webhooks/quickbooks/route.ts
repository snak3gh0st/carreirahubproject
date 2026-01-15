import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateQuickBooksWebhookSignature } from "@/lib/utils/webhook-validation";
import { acceptWebhook, webhookResponse } from "@/lib/utils/webhook-handler";

// Configuração para garantir que a rota seja dinâmica
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/quickbooks
 *
 * Webhook receiver for QuickBooks events
 *
 * Pattern:
 * 1. Validate signature
 * 2. Accept webhook (store in DB)
 * 3. Enqueue for async processing
 * 4. Return 200 OK immediately
 *
 * QuickBooks can send multiple entity notifications in one webhook.
 * We enqueue each entity separately for processing.
 */
export async function POST(request: NextRequest) {
  let rawBody = "";
  let body: any = {};

  try {
    rawBody = await request.text();
    body = rawBody ? JSON.parse(rawBody) : {};
    const signature = request.headers.get("intuit-signature");
    const payload = rawBody;

    console.log(
      "[QuickBooks Webhook] Received payload:",
      JSON.stringify(body, null, 2).substring(0, 1000)
    );
    console.log("[QuickBooks Webhook] Signature:", signature);

    // Get secret from database
    const config = await prisma.systemConfig.findUnique({
      where: { id: "system" },
    });

    const webhookSecret =
      config?.quickbooks_webhook_secret ||
      process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN;

    // Enforce webhook signature validation (mandatory)
    if (!webhookSecret) {
      console.error(
        "[QuickBooks Webhook] Webhook secret not configured in database or environment"
      );

      await prisma.integrationLog.create({
        data: {
          service: "QUICKBOOKS",
          action: "WEBHOOK_NO_SECRET",
          status: "ERROR",
          error: "Webhook secret not configured",
        },
      }).catch(() => {});

      // Still return 200 OK to prevent external retries
      return webhookResponse({
        success: false,
        status: "error",
        message: "Webhook secret not configured",
      });
    }

    if (!signature) {
      console.error("[QuickBooks Webhook] Missing intuit-signature header");

      await prisma.integrationLog.create({
        data: {
          service: "QUICKBOOKS",
          action: "WEBHOOK_NO_SIGNATURE",
          status: "ERROR",
          error: "Missing signature header",
        },
      }).catch(() => {});

      // Still return 200 OK to prevent external retries
      return webhookResponse({
        success: false,
        status: "error",
        message: "Missing signature",
      });
    }

    // Validate signature (mandatory)
    const isValid = validateQuickBooksWebhookSignature(
      payload,
      signature,
      webhookSecret
    );

    if (!isValid) {
      console.error("[QuickBooks Webhook] Invalid signature");

      await prisma.integrationLog.create({
        data: {
          service: "QUICKBOOKS",
          action: "WEBHOOK_INVALID_SIGNATURE",
          status: "ERROR",
          error: "Invalid signature",
        },
      }).catch(() => {});

      // Still return 200 OK to prevent external retries
      return webhookResponse({
        success: false,
        status: "error",
        message: "Invalid signature",
      });
    }

    console.log("[QuickBooks Webhook] Signature validated successfully");

    // QuickBooks webhook payload structure can contain multiple entities
    const eventNotifications = body.eventNotifications || [];
    let entitiesEnqueued = 0;

    for (const notification of eventNotifications) {
      const dataChangeEvent = notification.dataChangeEvent;

      if (dataChangeEvent) {
        const entities = dataChangeEvent.entities || [];

        for (const entity of entities) {
          const name = entity.name; // Invoice, Customer, Payment, etc.
          const operation = entity.operation; // Create, Update, Delete
          const id = entity.id;

          console.log(`[QuickBooks Webhook] ${operation} ${name} with ID: ${id}`);

          // Handle Customer.Update events - sync to DocuSign if customer has docusign_id
          if (name === "Customer" && operation === "Update") {
            try {
              // Find customer by QuickBooks ID
              const customer = await prisma.customer.findFirst({
                where: { quickbooks_id: id },
              });

              if (customer?.docusign_id) {
                // Customer exists and has DocuSign ID - sync changes
                const { identityMapper } = await import('@/lib/services/identity-mapper');
                await identityMapper.syncToDocuSign(customer.id);
                console.log(`[QuickBooks Webhook] Synced customer ${customer.id} to DocuSign`);
              }
            } catch (syncError) {
              console.error(`[QuickBooks Webhook] Failed to sync customer ${id} to DocuSign:`, syncError);
              // Don't fail webhook - log and continue
            }
          }

          // Enqueue each entity for async processing
          const eventType = `${name.toLowerCase()}.${operation.toLowerCase()}`;

          const result = await acceptWebhook(
            "QUICKBOOKS",
            eventType,
            {
              realmId: notification.realmId,
              entity: {
                name,
                operation,
                id,
                lastUpdated: entity.lastUpdated,
              },
              originalNotification: notification,
            },
            {
              signature,
              contentType: request.headers.get("content-type"),
            }
          );

          if (result.status === "accepted") {
            entitiesEnqueued++;
          }
        }
      }
    }

    // Return 200 OK with summary
    return NextResponse.json(
      {
        success: true,
        status: "accepted",
        message: `QuickBooks webhook accepted, ${entitiesEnqueued} entities enqueued`,
        entitiesEnqueued,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[QuickBooks Webhook] Error:", error);

    // Log error
    try {
      await prisma.integrationLog.create({
        data: {
          service: "QUICKBOOKS",
          action: "WEBHOOK_ERROR",
          status: "ERROR",
          error: error.message || "Unknown error",
          payload: {
            bodyPreview: JSON.stringify(body).substring(0, 500),
          } as any,
        },
      });
    } catch (logError) {
      console.error("[QuickBooks Webhook] Failed to log error:", logError);
    }

    // Still return 200 OK to prevent external retries
    return webhookResponse({
      success: false,
      status: "error",
      message: error.message || "Failed to process webhook",
    });
  }
}

/**
 * GET /api/webhooks/quickbooks
 *
 * Verification endpoint (QuickBooks may send GET to verify)
 * QuickBooks sends a 'challenge' parameter that must be returned
 */
export async function GET(request: NextRequest) {
  try {
    const challenge = request.nextUrl.searchParams.get("challenge");

    console.log("[QuickBooks Webhook] GET request received, challenge:", challenge);
    console.log("[QuickBooks Webhook] Request URL:", request.url);

    // QuickBooks sends a challenge for verification
    // Must return the same challenge value
    if (challenge) {
      console.log("[QuickBooks Webhook] Returning challenge:", challenge);
      return NextResponse.json(
        { challenge },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    return NextResponse.json(
      {
        status: "ok",
        message: "QuickBooks webhook endpoint is active",
        url: "https://carreirausa.sigmaintel.io/api/webhooks/quickbooks",
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("[QuickBooks Webhook] GET error:", error);
    return NextResponse.json(
      {
        error: error.message || "Internal server error",
        status: "error",
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
