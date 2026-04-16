import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { contractWorkflowService } from '@/lib/services/contract-workflow.service';

import { notificationService } from '@/lib/services/notification.service';
import { emailService } from '@/lib/services/email.service';
import { ContractStatus } from '@prisma/client';
import { verifyHmacSignature } from '@/lib/utils/hmac';
import { integrationLogger } from '@/lib/utils/logger';

/**
 * Resolve the SALES seller for a contract:
 *   1) Deal.owner (preferred — Deal.ownerId is the assigned seller)
 *   2) Invoice.owner (fallback — when contract has no deal but does have invoices)
 * Returns null if no SALES-role user can be found.
 */
async function resolveSellerForContract(contract: {
  id: string;
  dealId?: string | null;
  invoices?: Array<{ id: string }> | null;
}): Promise<{ seller: { id: string; name: string | null; email: string; role: string } | null; dealTitle: string | null }> {
  let dealTitle: string | null = null;

  if (contract.dealId) {
    const deal = await prisma.deal.findUnique({
      where: { id: contract.dealId },
      include: { owner: true },
    });
    if (deal) {
      dealTitle = deal.title;
      if (deal.owner && deal.owner.email && deal.owner.role === 'SALES') {
        return { seller: deal.owner, dealTitle };
      }
    }
  }

  if (contract.invoices && contract.invoices.length > 0) {
    const inv = await prisma.invoice.findUnique({
      where: { id: contract.invoices[0].id },
      include: { owner: true },
    });
    if (inv && inv.owner && inv.owner.email && inv.owner.role === 'SALES') {
      return { seller: inv.owner, dealTitle };
    }
  }

  return { seller: null, dealTitle };
}

/**
 * Notify the SALES seller that a contract is unsigned (declined / voided / expired).
 * Best-effort — never throws.
 */
async function notifySellerContractUnsigned(
  contract: any,
  reason: 'expired' | 'declined' | 'voided'
): Promise<void> {
  try {
    const { seller } = await resolveSellerForContract({
      id: contract.id,
      dealId: contract.dealId,
      invoices: contract.invoices,
    });
    if (!seller) {
      console.log(`[SellerNotify] Contract ${contract.id} ${reason} - no SALES seller resolved`);
      return;
    }
    await emailService.sendSellerContractUnsigned(
      {
        id: contract.id,
        docusign_env_id: contract.docusign_env_id,
        status: contract.status,
        signedUrl: contract.signedS3Url || contract.signedUrl,
        sentAt: contract.sentAt,
        expiresAt: contract.expiresAt,
        reminderCount: contract.reminderCount,
        signerEmail: contract.signerEmail,
        signerName: contract.signerName,
      },
      seller,
      reason
    );
    console.log(`[SellerNotify] Contract ${contract.id} ${reason} -> ${seller.email}`);
  } catch (notifyErr) {
    console.error(`[SellerNotify] Failed to notify seller of ${reason} contract ${contract.id}:`, notifyErr);
  }
}

/**
 * POST /api/webhooks/docusign
 * Handle DocuSign webhook events
 *
 * Events:
 * - envelope-sent: Contract email sent
 * - envelope-delivered: Client opened email
 * - envelope-completed: Contract signed
 * - envelope-declined: Client declined to sign
 * - envelope-voided: Contract voided/cancelled
 */
export async function POST(request: NextRequest) {
  try {
    // CRITICAL: Get raw body BEFORE parsing JSON for HMAC verification
    const rawBody = await request.text();

    // Verify HMAC signature
    const signature = request.headers.get('X-DocuSign-Signature-1');
    const webhookSecret = process.env.DOCUSIGN_WEBHOOK_SECRET;

    // In production, require signature verification
    if (webhookSecret) {
      const isValid = verifyHmacSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        console.error('[DOCUSIGN_WEBHOOK] Invalid HMAC signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
      console.log('[DOCUSIGN_WEBHOOK] HMAC signature verified');
    } else {
      console.warn('[DOCUSIGN_WEBHOOK] DOCUSIGN_WEBHOOK_SECRET not set - skipping signature verification');
    }

    // Parse webhook payload AFTER verification
    const payload = JSON.parse(rawBody);
    console.log('[DOCUSIGN_WEBHOOK] Received event:', JSON.stringify(payload, null, 2));

    const event = payload.event;
    const envelopeId = payload.data?.envelopeId || payload.envelopeId;

    if (!envelopeId) {
      console.error('[DOCUSIGN_WEBHOOK] No envelope ID in payload');
      return NextResponse.json({ error: 'Missing envelope ID' }, { status: 400 });
    }

    // Generate unique event ID for deduplication
    const timestamp = payload.generatedDateTime || new Date().toISOString();
    const eventId = `${envelopeId}-${event}-${timestamp}`;

    // Check for duplicate events (DocuSign retries up to 45 times over 7 days)
    const existingEvent = await prisma.webhookEvent.findFirst({
      where: {
        service: 'docusign',
        event_id: eventId,
      },
    });

    if (existingEvent && existingEvent.status === 'success') {
      console.log(`[DOCUSIGN_WEBHOOK] Duplicate event ${eventId} - skipping`);
      return NextResponse.json({ success: true, duplicate: true }, { status: 200 });
    }

    // Create WebhookEvent record before processing
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        service: 'docusign',
        event_type: event,
        event_id: eventId,
        payload: payload as any,
        headers: { signature: signature || '' } as any,
        status: 'processing',
        max_retries: 5,
      },
    });

    console.log(`[DOCUSIGN_WEBHOOK] Created webhook event ${webhookEvent.id} for ${eventId}`);

    // Find contract by DocuSign envelope ID
    const contract = await prisma.contract.findFirst({
      where: { docusign_env_id: envelopeId },
      include: {
        customer: true,
        invoices: {
          include: {
            customer: true,
          },
        },
      },
    });

    if (!contract) {
      console.error(`[DOCUSIGN_WEBHOOK] Contract not found for envelope ${envelopeId}`);
      // Return 200 to prevent DocuSign from retrying
      return NextResponse.json({
        success: true,
        message: 'Contract not found - webhook acknowledged',
      });
    }

    console.log(`[DOCUSIGN_WEBHOOK] Processing event '${event}' for contract ${contract.id}`);

    // Handle different event types
    switch (event) {
      case 'envelope-sent':
        // Envelope sent to recipient
        console.log(`[DOCUSIGN_WEBHOOK] Envelope sent for contract ${contract.id}`);
        // Status already set to SENT_FOR_SIGNATURE when created
        break;

      case 'envelope-delivered':
        // Recipient opened the email
        console.log(`[DOCUSIGN_WEBHOOK] Envelope delivered for contract ${contract.id}`);
        await prisma.contract.update({
          where: { id: contract.id },
          data: { status: ContractStatus.VIEWED },
        });
        break;

      case 'envelope-completed':
        // Contract signed!
        console.log(`[DOCUSIGN_WEBHOOK] Envelope completed for contract ${contract.id}`);

        // Reconcile customer with Identity Mapper
        if (contract.customer) {
          const { identityMapper } = await import('@/lib/services/identity-mapper');
          await identityMapper.reconcileCustomer({
            email: contract.customer.email,
            name: contract.customer.name,
            phone: contract.customer.phone || undefined,
            externalIds: {
              docusign_id: envelopeId, // Use envelope ID as DocuSign contact ID
            },
          });
          console.log(`[DOCUSIGN_WEBHOOK] Reconciled customer ${contract.customer.id} with DocuSign ID ${envelopeId}`);
        }

        // Handle signed contract
        await contractWorkflowService.handleContractSigned(contract.id);

        // Download and store signed document in S3
        try {
          const { documentStorageService } = await import('@/lib/services/document-storage.service');
          const { docusignService } = await import('@/lib/services/docusign.service');

          if (documentStorageService.isConfigured()) {
            console.log(`[DOCUSIGN_WEBHOOK] Downloading signed document for envelope ${envelopeId}`);

            // Download combined document (all docs + certificate) from DocuSign
            const pdfBuffer = await docusignService.downloadDocument(envelopeId, 'combined');

            // Upload to S3
            const s3Key = await documentStorageService.uploadSignedContract(
              envelopeId,
              pdfBuffer,
              {
                contractId: contract.id,
                customerId: contract.customerId,
                invoiceId: contract.invoices?.[0]?.id || undefined,
              }
            );

            // Generate presigned URL (valid for 7 days)
            const presignedUrl = await documentStorageService.getPresignedUrl(s3Key);
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

            // Update contract with S3 info
            await prisma.contract.update({
              where: { id: contract.id },
              data: {
                signedS3Key: s3Key,
                signedS3Url: presignedUrl,
                signedS3UrlExpiresAt: expiresAt,
              },
            });

            console.log(`[DOCUSIGN_WEBHOOK] Signed document stored in S3: ${s3Key}`);
          } else {
            console.log(`[DOCUSIGN_WEBHOOK] S3 not configured, skipping document storage`);
          }
        } catch (storageError) {
          console.error(`[DOCUSIGN_WEBHOOK] Failed to store signed document:`, storageError);
          // Log error but don't fail the webhook - contract is still signed
          await prisma.integrationLog.create({
            data: {
              service: 'DOCUMENT_STORAGE',
              action: 'S3_UPLOAD_FAILED',
              status: 'ERROR',
              error: storageError instanceof Error ? storageError.message : 'Unknown error',
              payload: { contractId: contract.id, envelopeId } as any,
            },
          });
        }

        // Payment: QB invoice email already sent at creation time
        // (invoice-workflow.service.ts → quickbooksService.sendInvoice)
        if (contract.invoices && contract.invoices.length > 0) {
          console.log(`[DOCUSIGN_WEBHOOK] Contract signed for ${contract.invoices.length} invoice(s) — QB invoice email already sent`);
        }

        // NEW: Mark Pipedrive deal as WON and notify commercial user
        if (contract.dealId) {
          try {
            const deal = await prisma.deal.findUnique({
              where: { id: contract.dealId },
              include: { customer: true }
            });

            if (deal && deal.customer) {
              // Update Hub deal status to WON on contract signed
              await prisma.deal.update({
                where: { id: deal.id },
                data: {
                  status: "WON",
                  lastClintSyncAt: new Date()
                }
              });

              await integrationLogger.logSuccess("CRM", "DEAL_MARKED_WON", {
                dealId: deal.id,
                contractId: contract.id,
                clint_deal_id: deal.clint_deal_id
              });

              // Notify commercial user (properly typed for notificationService)
              const dealForNotification = {
                id: deal.id,
                title: deal.title,
                ownerId: deal.ownerId,
                customer: {
                  name: deal.customer.name,
                  email: deal.customer.email
                }
              };
              await notificationService.notifyCommercialUser(dealForNotification, contract);
            }
          } catch (error) {
            // Log but don't fail webhook processing
            await integrationLogger.logError(
              "PIPEDRIVE",
              "DEAL_WON_SYNC_FAILED",
              error instanceof Error ? error : new Error(String(error)),
              { contractId: contract.id }
            );
            console.error("[DOCUSIGN_WEBHOOK] Pipedrive sync failed (non-blocking):", error);
          }
        }

        // Additive seller notification (does NOT replace finance routing)
        try {
          const { seller, dealTitle } = await resolveSellerForContract({
            id: contract.id,
            dealId: contract.dealId,
            invoices: contract.invoices,
          });
          if (seller) {
            await emailService.sendSellerContractSigned(
              {
                id: contract.id,
                docusign_env_id: contract.docusign_env_id,
                status: contract.status,
                signedUrl: contract.signedS3Url || contract.signedUrl,
                sentAt: contract.sentAt,
                expiresAt: contract.expiresAt,
                reminderCount: contract.reminderCount,
                signerEmail: contract.signerEmail,
                signerName: contract.signerName,
              },
              seller,
              dealTitle || undefined
            );
            console.log(`[SellerNotify] Contract ${contract.id} signed -> ${seller.email}`);
          } else {
            console.log(`[SellerNotify] Contract ${contract.id} signed - no SALES seller resolved`);
          }
        } catch (notifyErr) {
          console.error(`[SellerNotify] Failed to notify seller of signed contract ${contract.id}:`, notifyErr);
        }
        break;

      case 'envelope-declined':
        // Client declined to sign
        console.log(`[DOCUSIGN_WEBHOOK] Envelope declined for contract ${contract.id}`);
        await contractWorkflowService.handleContractDeclined(contract.id);
        await notifySellerContractUnsigned(contract, 'declined');
        break;

      case 'envelope-voided':
        // Contract voided/cancelled
        console.log(`[DOCUSIGN_WEBHOOK] Envelope voided for contract ${contract.id}`);
        await prisma.contract.update({
          where: { id: contract.id },
          data: {
            status: ContractStatus.VOIDED,
            voidedAt: new Date(),
          },
        });
        await notifySellerContractUnsigned(contract, 'voided');
        break;

      default:
        console.log(`[DOCUSIGN_WEBHOOK] Unhandled event type: ${event}`);
    }

    // Log webhook event
    await prisma.integrationLog.create({
      data: {
        service: 'DOCUSIGN',
        action: `WEBHOOK_${event.toUpperCase().replace(/-/g, '_')}`,
        status: 'SUCCESS',
        payload: {
          event,
          envelopeId,
          contractId: contract.id,
        } as any,
      },
    });

    console.log(`[DOCUSIGN_WEBHOOK] Successfully processed event '${event}' for contract ${contract.id}`);

    // Mark webhook event as successful
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { status: 'success', processed_at: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: `Event ${event} processed successfully`,
      contractId: contract.id,
    });

  } catch (error) {
    console.error('[DOCUSIGN_WEBHOOK] Error processing webhook:', error);

    // Try to mark webhook event as failed if it exists
    try {
      const rawBody = await request.clone().text();
      const payload = JSON.parse(rawBody);
      const event = payload.event;
      const envelopeId = payload.data?.envelopeId || payload.envelopeId;
      const timestamp = payload.generatedDateTime || new Date().toISOString();
      const eventId = `${envelopeId}-${event}-${timestamp}`;

      const webhookEvent = await prisma.webhookEvent.findFirst({
        where: { service: 'docusign', event_id: eventId },
      });

      if (webhookEvent) {
        await prisma.webhookEvent.update({
          where: { id: webhookEvent.id },
          data: {
            status: 'failed',
            last_error: error instanceof Error ? error.message : 'Unknown error',
            retry_count: { increment: 1 },
          },
        });
      }
    } catch (updateError) {
      // If we can't update webhook event, just log it
      console.error('[DOCUSIGN_WEBHOOK] Failed to update webhook event:', updateError);
    }

    // Log error
    await prisma.integrationLog.create({
      data: {
        service: 'DOCUSIGN',
        action: 'WEBHOOK_ERROR',
        status: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
        payload: { error: String(error) } as any,
      },
    });

    // Return 200 to prevent retries for unrecoverable errors
    // DocuSign will retry on 4xx/5xx status codes
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 200 });
  }
}

/**
 * GET /api/webhooks/docusign
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    service: 'DocuSign Webhook Handler',
    status: 'active',
    timestamp: new Date().toISOString(),
  });
}
