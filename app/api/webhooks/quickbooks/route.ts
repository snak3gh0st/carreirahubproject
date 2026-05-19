import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateQuickBooksWebhookSignature } from "@/lib/utils/webhook-validation";
import { acceptWebhook, webhookResponse } from "@/lib/utils/webhook-handler";
import { telegramService } from "@/lib/services/telegram.service";

// Configuração para garantir que a rota seja dinâmica
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function syncQuickBooksPaymentInline(options: {
  webhookEventId?: string;
  paymentId: string;
  eventType: string;
}) {
  const { webhookEventId, paymentId, eventType } = options;
  const timeoutMs = 15_000;

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`QuickBooks inline payment sync timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  const { quickbooksSyncService } = await import("@/lib/services/quickbooks-sync.service");
  const result = await Promise.race([
    quickbooksSyncService.syncSinglePayment(paymentId),
    timeout,
  ]);

  if (!result.success) {
    throw new Error(result.error || `QuickBooks payment ${paymentId} inline sync failed`);
  }

  if (webhookEventId) {
    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: {
        status: "success",
        processed_at: new Date(),
        last_error: null,
        updated_at: new Date(),
      },
    }).catch(() => undefined);
  }

  await prisma.integrationLog.create({
    data: {
      service: "QUICKBOOKS",
      action: "WEBHOOK_PAYMENT_SYNCED_INLINE",
      status: "SUCCESS",
      payload: {
        webhookEventId,
        eventType,
        paymentId,
      } as any,
    },
  }).catch(() => undefined);
}

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

    const expectedRealmId =
      config?.quickbooks_company_id || process.env.QUICKBOOKS_REALM_ID;

    // QuickBooks webhook payload structure can contain multiple entities
    const eventNotifications = body.eventNotifications || [];
    let entitiesEnqueued = 0;
    let notificationsIgnoredWrongRealm = 0;

    for (const notification of eventNotifications) {
      const notificationRealmId = notification.realmId
        ? String(notification.realmId)
        : null;

      if (
        expectedRealmId &&
        notificationRealmId &&
        notificationRealmId !== expectedRealmId
      ) {
        const ignoredEntityCount =
          notification.dataChangeEvent?.entities?.length || 0;

        console.warn(
          `[QuickBooks Webhook] Ignoring realm ${notificationRealmId}; expected ${expectedRealmId}`
        );

        await prisma.integrationLog.create({
          data: {
            service: "QUICKBOOKS",
            action: "WEBHOOK_WRONG_REALM_IGNORED",
            status: "SUCCESS",
            payload: {
              expectedRealmId,
              receivedRealmId: notificationRealmId,
              ignoredEntityCount,
            } as any,
          },
        }).catch(() => {});

        notificationsIgnoredWrongRealm++;
        continue;
      }

      const dataChangeEvent = notification.dataChangeEvent;

      if (dataChangeEvent) {
        const entities = dataChangeEvent.entities || [];

        for (const entity of entities) {
          const name = entity.name; // Invoice, Customer, Payment, etc.
          const operation = entity.operation; // Create, Update, Delete
          const id = entity.id;

          console.log(`[QuickBooks Webhook] ${operation} ${name} with ID: ${id}`);

          // Handle Payment.Create / Payment.Update events - notify the COMMERCIAL owner of the
          // related invoice that payment was received. Best-effort, never fails the webhook.
          if (name === "Payment" && (operation === "Create" || operation === "Update")) {
            try {
              const { emailService } = await import("@/lib/services/email.service");

              const payment = await prisma.payment.findFirst({
                where: { quickbooks_payment_id: id },
                include: {
                  invoice: {
                    include: { customer: true, owner: true, deal: true },
                  },
                },
              });

              const invoice = payment?.invoice;
              if (invoice && invoice.owner && invoice.owner.email && invoice.owner.role === "COMMERCIAL") {
                await emailService.sendSellerInvoicePaid(
                  {
                    id: invoice.id,
                    invoiceNumber: invoice.invoiceNumber,
                    amount: invoice.amount,
                    dueDate: invoice.dueDate,
                    status: invoice.status,
                    customer: { id: invoice.customer.id, name: invoice.customer.name, email: invoice.customer.email },
                    deal: invoice.deal ? { id: invoice.deal.id, title: invoice.deal.title } : null,
                  },
                  {
                    id: invoice.owner.id,
                    name: invoice.owner.name,
                    email: invoice.owner.email,
                    role: invoice.owner.role,
                  }
                );
                console.log(`[SellerNotify] Payment ${id} -> notified seller ${invoice.owner.email}`);
              } else {
                console.log(`[SellerNotify] Payment ${id} - no COMMERCIAL owner to notify (skipped)`);
              }
            } catch (notifyErr) {
              console.error(`[SellerNotify] Failed to notify seller for payment ${id}:`, notifyErr);
            }
          }

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

          if (
            result.status === "accepted" &&
            name === "Payment" &&
            (operation === "Create" || operation === "Update") &&
            id
          ) {
            try {
              await syncQuickBooksPaymentInline({
                webhookEventId: result.webhookEventId,
                paymentId: id,
                eventType,
              });
              console.log(`[QuickBooks Webhook] Inline payment sync completed for ${id}`);
            } catch (inlineError) {
              const message =
                inlineError instanceof Error ? inlineError.message : String(inlineError);
              console.warn(
                `[QuickBooks Webhook] Inline payment sync failed for ${id}; queued fallback will retry:`,
                message
              );

              await prisma.integrationLog.create({
                data: {
                  service: "QUICKBOOKS",
                  action: "WEBHOOK_PAYMENT_INLINE_SYNC_FAILED",
                  status: "ERROR",
                  error: message,
                  payload: {
                    webhookEventId: result.webhookEventId,
                    eventType,
                    paymentId: id,
                  } as any,
                },
              }).catch(() => undefined);
            }
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
        notificationsIgnoredWrongRealm,
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

    await telegramService.alertWebhookError("QuickBooks", "WEBHOOK_ERROR", error, {
      Route: request.nextUrl.pathname,
      Method: request.method,
      EventNotifications: Array.isArray(body?.eventNotifications) ? body.eventNotifications.length : 0,
      PayloadPreview: rawBody ? rawBody.substring(0, 500) : undefined,
    });

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
        url: "https://app.carreirausa.com/api/webhooks/quickbooks",
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
