import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateQuickBooksWebhookSignature } from "@/lib/utils/webhook-validation";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { quickbooksSyncService } from "@/lib/services/quickbooks-sync.service";
import { InvoiceStatus } from "@prisma/client";

// Configuração para garantir que a rota seja dinâmica
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/quickbooks
 *
 * Webhook do QuickBooks para receber notificações de eventos
 * QuickBooks pode enviar notificações para: invoices, customers, payments, etc.
 *
 * URL do webhook: https://carreirausa.sigmaintel.io/api/webhooks/quickbooks
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
      JSON.stringify(body, null, 2)
    );
    console.log("[QuickBooks Webhook] Signature:", signature);

    // Obter secret do banco de dados
    const config = await prisma.systemConfig.findUnique({
      where: { id: "system" },
    });

    const webhookSecret =
      config?.quickbooks_webhook_secret ||
      process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN;

    // Enforce webhook signature validation (mandatory)
    // QuickBooks uses HMAC SHA256 with the webhook secret
    if (!webhookSecret) {
      console.error(
        "[QuickBooks Webhook] Webhook secret not configured in database or environment"
      );
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    if (!signature) {
      console.error("[QuickBooks Webhook] Missing intuit-signature header");
      return NextResponse.json(
        { error: "Missing signature header" },
        { status: 401 }
      );
    }

    // Validate signature (mandatory)
    const isValid = validateQuickBooksWebhookSignature(
      payload,
      signature,
      webhookSecret
    );

    if (!isValid) {
      console.error("[QuickBooks Webhook] Invalid signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    console.log("[QuickBooks Webhook] Signature validated successfully");

    // QuickBooks webhook payload structure
    // Verificar estrutura do webhook do QuickBooks
    const eventNotifications = body.eventNotifications || [];
    
    for (const notification of eventNotifications) {
      const dataChangeEvent = notification.dataChangeEvent;
      
      if (dataChangeEvent) {
        const entities = dataChangeEvent.entities || [];
        
        for (const entity of entities) {
          const name = entity.name; // Invoice, Customer, Payment, etc.
          const operation = entity.operation; // Create, Update, Delete
          const id = entity.id;

          console.log(`[QuickBooks Webhook] ${operation} ${name} with ID: ${id}`);

          // Log do evento
          await prisma.integrationLog.create({
            data: {
              service: "QUICKBOOKS",
              action: `WEBHOOK_${name.toUpperCase()}_${operation.toUpperCase()}`,
              status: "SUCCESS",
              payload: {
                entityType: name,
                operation,
                entityId: id,
                webhookData: entity,
              } as any,
            },
          });

          // Processar diferentes tipos de entidades using real-time sync
          switch (name) {
            case "Invoice":
              try {
                if (operation === "Delete") {
                  // Handle invoice deletion - mark as VOID
                  const deletedInvoice = await prisma.invoice.updateMany({
                    where: { quickbooks_invoice_id: id },
                    data: {
                      status: InvoiceStatus.VOID,
                      updatedAt: new Date()
                    },
                  });
                  console.log(`[QuickBooks Webhook] Invoice ${id} marked as VOID (deleted in QB)`);
                } else {
                  // Use the sync service for real-time sync with full data
                  const syncResult = await quickbooksSyncService.syncSingleInvoice(id);

                  if (syncResult.success) {
                    console.log(`[QuickBooks Webhook] Invoice ${id} synced: ${syncResult.isNew ? 'created' : 'updated'}`);

                    // Update integration log with sync result
                    await prisma.integrationLog.create({
                      data: {
                        service: "QUICKBOOKS",
                        action: `WEBHOOK_INVOICE_${operation.toUpperCase()}_SYNCED`,
                        status: "SUCCESS",
                        payload: {
                          qbInvoiceId: id,
                          localInvoiceId: syncResult.invoice?.id,
                          isNew: syncResult.isNew,
                          status: syncResult.invoice?.status,
                        } as any,
                      },
                    });
                  } else {
                    console.error(`[QuickBooks Webhook] Failed to sync invoice ${id}: ${syncResult.error}`);
                  }
                }
              } catch (error: any) {
                console.error(`[QuickBooks Webhook] Error processing invoice ${id}:`, error);
                // Fallback to timestamp update if sync fails
                await prisma.invoice.updateMany({
                  where: { quickbooks_invoice_id: id },
                  data: { updatedAt: new Date() },
                });
              }
              break;

            case "Customer":
              try {
                if (operation === "Delete") {
                  // Mark customer as deleted (soft delete by clearing QB ID)
                  await prisma.customer.updateMany({
                    where: { quickbooks_id: id },
                    data: {
                      quickbooks_id: null,
                      lastQuickbooksSyncAt: new Date(),
                      updatedAt: new Date()
                    },
                  });
                  console.log(`[QuickBooks Webhook] Customer ${id} QB link removed (deleted in QB)`);
                } else {
                  // Use the sync service for real-time sync with full data
                  const syncResult = await quickbooksSyncService.syncSingleCustomer(id);

                  if (syncResult.success) {
                    console.log(`[QuickBooks Webhook] Customer ${id} synced: ${syncResult.isNew ? 'created' : 'updated'}`);

                    // Update integration log with sync result
                    await prisma.integrationLog.create({
                      data: {
                        service: "QUICKBOOKS",
                        action: `WEBHOOK_CUSTOMER_${operation.toUpperCase()}_SYNCED`,
                        status: "SUCCESS",
                        payload: {
                          qbCustomerId: id,
                          localCustomerId: syncResult.customer?.id,
                          isNew: syncResult.isNew,
                        } as any,
                      },
                    });
                  } else {
                    console.error(`[QuickBooks Webhook] Failed to sync customer ${id}: ${syncResult.error}`);
                  }
                }
              } catch (error: any) {
                console.error(`[QuickBooks Webhook] Error processing customer ${id}:`, error);
              }
              break;

            case "Payment":
              try {
                if (operation === "Delete") {
                  // Handle payment deletion - remove from our system
                  const deletedPayment = await prisma.payment.deleteMany({
                    where: { quickbooks_payment_id: id },
                  });
                  console.log(`[QuickBooks Webhook] Payment ${id} deleted`);
                } else {
                  // Use the sync service for real-time payment sync
                  const syncResult = await quickbooksSyncService.syncSinglePayment(id);

                  if (syncResult.success) {
                    console.log(`[QuickBooks Webhook] Payment ${id} synced: ${syncResult.isNew ? 'created' : 'updated'}, invoice updated: ${syncResult.invoiceUpdated}`);

                    // Update integration log with sync result
                    await prisma.integrationLog.create({
                      data: {
                        service: "QUICKBOOKS",
                        action: `WEBHOOK_PAYMENT_${operation.toUpperCase()}_SYNCED`,
                        status: "SUCCESS",
                        payload: {
                          qbPaymentId: id,
                          localPaymentId: syncResult.payment?.id,
                          isNew: syncResult.isNew,
                          invoiceUpdated: syncResult.invoiceUpdated,
                        } as any,
                      },
                    });
                  } else {
                    console.error(`[QuickBooks Webhook] Failed to sync payment ${id}: ${syncResult.error}`);
                  }
                }
              } catch (error: any) {
                console.error(`[QuickBooks Webhook] Error processing payment ${id}:`, error);
              }
              break;

            default:
              console.log(`[QuickBooks Webhook] Unhandled entity type: ${name}`);
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true,
      message: "Webhook processed successfully" 
    });
  } catch (error: any) {
    console.error("[QuickBooks Webhook] Error:", error);
    
    // Log do erro
    try {
      await prisma.integrationLog.create({
        data: {
          service: "QUICKBOOKS",
          action: "WEBHOOK_ERROR",
          status: "ERROR",
          error: error.message || "Unknown error",
          payload: body as any,
        },
      });
  } catch (logError) {
      console.error("[QuickBooks Webhook] Failed to log error:", logError);
    }

    return NextResponse.json(
      { error: error.message || "Failed to process webhook" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/quickbooks
 * 
 * Verificação de webhook (QuickBooks pode fazer GET para verificar)
 * QuickBooks envia um parâmetro 'challenge' que deve ser retornado
 */
export async function GET(request: NextRequest) {
  try {
    const challenge = request.nextUrl.searchParams.get("challenge");
    
    console.log("[QuickBooks Webhook] GET request received, challenge:", challenge);
    console.log("[QuickBooks Webhook] Request URL:", request.url);
    
    // QuickBooks envia um challenge para verificar o webhook
    // Deve retornar o mesmo valor do challenge
    if (challenge) {
      console.log("[QuickBooks Webhook] Returning challenge:", challenge);
      return NextResponse.json({ challenge }, {
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    return NextResponse.json({ 
      status: "ok",
      message: "QuickBooks webhook endpoint is active",
      url: "https://carreirausa.sigmaintel.io/api/webhooks/quickbooks",
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        "Content-Type": "application/json",
      },
    });
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
