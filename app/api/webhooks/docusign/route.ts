import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { contractWorkflowService } from '@/lib/services/contract-workflow.service';
import { paymentWorkflowService } from '@/lib/services/payment-workflow.service';
import { ContractStatus } from '@prisma/client';

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
    // Verify webhook signature
    const signature = request.headers.get('X-DocuSign-Signature-1');
    const webhookSecret = process.env.DOCUSIGN_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      // TODO: Implement HMAC signature verification
      // For now, we'll just check if the secret exists
      // In production, you should verify the signature properly
      console.log('[DOCUSIGN_WEBHOOK] Signature verification placeholder');
    }

    // Parse webhook payload
    const payload = await request.json();
    console.log('[DOCUSIGN_WEBHOOK] Received event:', JSON.stringify(payload, null, 2));

    const event = payload.event;
    const envelopeId = payload.data?.envelopeId || payload.envelopeId;

    if (!envelopeId) {
      console.error('[DOCUSIGN_WEBHOOK] No envelope ID in payload');
      return NextResponse.json({ error: 'Missing envelope ID' }, { status: 400 });
    }

    // Find contract by DocuSign envelope ID
    const contract = await prisma.contract.findFirst({
      where: { docusign_env_id: envelopeId },
      include: {
        customer: true,
        invoice: {
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

        // Trigger payment workflow
        if (contract.invoice) {
          try {
            await paymentWorkflowService.sendPaymentLinkAfterSignature(
              {
                id: contract.invoice.id,
                invoiceNumber: contract.invoice.invoiceNumber,
                amount: contract.invoice.amount,
                dueDate: contract.invoice.dueDate,
                status: contract.invoice.status,
                stripePaymentLinkId: contract.invoice.stripePaymentLinkId,
                paymentReminderCount: contract.invoice.paymentReminderCount,
                customer: contract.invoice.customer,
              },
              {
                id: contract.id,
                status: ContractStatus.SIGNED,
              }
            );
            console.log(`[DOCUSIGN_WEBHOOK] Payment workflow initiated for invoice ${contract.invoice.id}`);
          } catch (error) {
            console.error('[DOCUSIGN_WEBHOOK] Failed to initiate payment workflow:', error);
            // Don't fail the webhook - log and continue
            await prisma.integrationLog.create({
              data: {
                service: 'PAYMENT_WORKFLOW',
                action: 'SEND_PAYMENT_LINK_FAILED',
                status: 'ERROR',
                error: error instanceof Error ? error.message : 'Unknown error',
                payload: { contractId: contract.id, invoiceId: contract.invoice.id } as any,
              },
            });
          }
        }
        break;

      case 'envelope-declined':
        // Client declined to sign
        console.log(`[DOCUSIGN_WEBHOOK] Envelope declined for contract ${contract.id}`);
        await contractWorkflowService.handleContractDeclined(contract.id);
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

    return NextResponse.json({
      success: true,
      message: `Event ${event} processed successfully`,
      contractId: contract.id,
    });

  } catch (error) {
    console.error('[DOCUSIGN_WEBHOOK] Error processing webhook:', error);

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
