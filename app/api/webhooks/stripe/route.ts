import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { paymentWorkflowService } from '@/lib/services/payment-workflow.service';
import { InvoiceStatus } from '@prisma/client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events
 *
 * Events:
 * - payment_intent.succeeded: Payment completed successfully
 * - payment_intent.payment_failed: Payment failed
 * - checkout.session.completed: Checkout session completed
 * - invoice.paid: Invoice paid (Stripe invoice, not our invoice)
 * - invoice.payment_failed: Invoice payment failed
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('[STRIPE_WEBHOOK] Missing signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    if (!webhookSecret) {
      console.error('[STRIPE_WEBHOOK] STRIPE_WEBHOOK_SECRET not configured');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('[STRIPE_WEBHOOK] Signature verification failed:', err);
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${err instanceof Error ? err.message : 'Unknown error'}` },
        { status: 400 }
      );
    }

    console.log(`[STRIPE_WEBHOOK] Received event: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case 'refund.created':
      case 'refund.updated':
        await handleRefundEvent(event.data.object as Stripe.Refund, event.type);
        break;

      case 'payment_link.created':
      case 'payment_link.updated':
        // Log but don't process
        console.log(`[STRIPE_WEBHOOK] Payment link event: ${event.type}`);
        break;

      default:
        console.log(`[STRIPE_WEBHOOK] Unhandled event type: ${event.type}`);
    }

    // Log webhook event
    await prisma.integrationLog.create({
      data: {
        service: 'STRIPE',
        action: `WEBHOOK_${event.type.toUpperCase().replace(/\./g, '_')}`,
        status: 'SUCCESS',
        payload: {
          eventId: event.id,
          eventType: event.type,
        } as any,
      },
    });

    return NextResponse.json({
      success: true,
      received: true,
      eventType: event.type,
    });

  } catch (error) {
    console.error('[STRIPE_WEBHOOK] Error processing webhook:', error);

    // Log error
    await prisma.integrationLog.create({
      data: {
        service: 'STRIPE',
        action: 'WEBHOOK_ERROR',
        status: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
        payload: { error: String(error) } as any,
      },
    });

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * Handle payment_intent.succeeded event
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  try {
    console.log(`[STRIPE_WEBHOOK] Processing payment intent succeeded: ${paymentIntent.id}`);

    // Get invoice ID from metadata
    const invoiceId = paymentIntent.metadata.invoice_id || paymentIntent.metadata.hub_invoice_id;

    if (!invoiceId) {
      console.error('[STRIPE_WEBHOOK] No invoice ID in payment intent metadata');
      return;
    }

    // Find invoice and update with payment intent ID
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
      },
    });

    if (!invoice) {
      console.error(`[STRIPE_WEBHOOK] Invoice ${invoiceId} not found`);
      return;
    }

    // Update invoice with payment intent ID
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        stripePaymentIntentId: paymentIntent.id,
      },
    });

    // Handle successful payment
    await paymentWorkflowService.handlePaymentSuccess(paymentIntent.id);

    console.log(`[STRIPE_WEBHOOK] Payment intent succeeded processed for invoice ${invoiceId}`);

  } catch (error) {
    console.error('[STRIPE_WEBHOOK] Error handling payment intent succeeded:', error);
    throw error;
  }
}

/**
 * Handle payment_intent.payment_failed event
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  try {
    console.log(`[STRIPE_WEBHOOK] Processing payment intent failed: ${paymentIntent.id}`);

    // Handle failed payment
    await paymentWorkflowService.handlePaymentFailed(paymentIntent.id);

    console.log(`[STRIPE_WEBHOOK] Payment intent failed processed: ${paymentIntent.id}`);

  } catch (error) {
    console.error('[STRIPE_WEBHOOK] Error handling payment intent failed:', error);
    throw error;
  }
}

/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  try {
    console.log(`[STRIPE_WEBHOOK] Processing checkout session completed: ${session.id}`);

    // Get invoice ID from metadata
    const invoiceId = session.metadata?.invoice_id;

    if (!invoiceId) {
      console.error('[STRIPE_WEBHOOK] No invoice ID in session metadata');
      return;
    }

    // Get payment intent ID from session
    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;

    if (!paymentIntentId) {
      console.error('[STRIPE_WEBHOOK] No payment intent in checkout session');
      return;
    }

    // Update invoice with payment intent ID
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        stripePaymentIntentId: paymentIntentId,
      },
    });

    // The payment_intent.succeeded event will handle the rest
    console.log(`[STRIPE_WEBHOOK] Checkout session completed processed for invoice ${invoiceId}`);

  } catch (error) {
    console.error('[STRIPE_WEBHOOK] Error handling checkout session completed:', error);
    throw error;
  }
}

/**
 * Handle invoice.paid event (Stripe invoice, not our invoice)
 */
async function handleInvoicePaid(stripeInvoice: Stripe.Invoice): Promise<void> {
  try {
    console.log(`[STRIPE_WEBHOOK] Processing Stripe invoice paid: ${stripeInvoice.id}`);

    // Get our invoice ID from metadata
    const invoiceId = stripeInvoice.metadata?.hub_invoice_id;

    if (!invoiceId) {
      console.log('[STRIPE_WEBHOOK] No hub invoice ID in Stripe invoice metadata, skipping');
      return;
    }

    // Get payment intent ID
    const paymentIntentId = typeof stripeInvoice.payment_intent === 'string'
      ? stripeInvoice.payment_intent
      : stripeInvoice.payment_intent?.id;

    if (paymentIntentId) {
      // Update our invoice
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          stripePaymentIntentId: paymentIntentId,
          stripe_invoice_id: stripeInvoice.id,
        },
      });

      // Handle successful payment
      await paymentWorkflowService.handlePaymentSuccess(paymentIntentId);
    }

    console.log(`[STRIPE_WEBHOOK] Stripe invoice paid processed for invoice ${invoiceId}`);

  } catch (error) {
    console.error('[STRIPE_WEBHOOK] Error handling Stripe invoice paid:', error);
    throw error;
  }
}

/**
 * Handle invoice.payment_failed event
 */
async function handleInvoicePaymentFailed(stripeInvoice: Stripe.Invoice): Promise<void> {
  try {
    console.log(`[STRIPE_WEBHOOK] Processing Stripe invoice payment failed: ${stripeInvoice.id}`);

    // Get our invoice ID from metadata
    const invoiceId = stripeInvoice.metadata?.hub_invoice_id;

    if (!invoiceId) {
      console.log('[STRIPE_WEBHOOK] No hub invoice ID in Stripe invoice metadata, skipping');
      return;
    }

    // Get payment intent ID
    const paymentIntentId = typeof stripeInvoice.payment_intent === 'string'
      ? stripeInvoice.payment_intent
      : stripeInvoice.payment_intent?.id;

    if (paymentIntentId) {
      // Handle failed payment
      await paymentWorkflowService.handlePaymentFailed(paymentIntentId);
    }

    console.log(`[STRIPE_WEBHOOK] Stripe invoice payment failed processed for invoice ${invoiceId}`);

  } catch (error) {
    console.error('[STRIPE_WEBHOOK] Error handling Stripe invoice payment failed:', error);
    throw error;
  }
}

/**
 * Handle charge.refunded event
 */
async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  try {
    console.log(`[STRIPE_WEBHOOK] Processing charge refunded: ${charge.id}`);

    // Find invoice by payment intent ID
    const invoice = await prisma.invoice.findFirst({
      where: {
        stripePaymentIntentId: charge.payment_intent as string,
      },
    });

    if (!invoice) {
      console.warn(`[STRIPE_WEBHOOK] Invoice not found for charge ${charge.id}`);
      return;
    }

    // Determine refund status based on amount refunded
    const amountRefunded = (charge.amount_refunded || 0) / 100; // Convert from cents
    const totalAmount = (charge.amount || 0) / 100;

    let newStatus: InvoiceStatus;
    if (amountRefunded === totalAmount) {
      newStatus = InvoiceStatus.REFUNDED;
    } else if (amountRefunded > 0) {
      newStatus = InvoiceStatus.PARTIALLY_REFUNDED;
    } else {
      return; // No refund, skip
    }

    // Update invoice
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: newStatus,
        amountRefunded: amountRefunded,
      },
    });

    console.log(`[STRIPE_WEBHOOK] Invoice ${invoice.id} marked as ${newStatus}`);

  } catch (error) {
    console.error('[STRIPE_WEBHOOK] Error handling charge refunded:', error);
    throw error;
  }
}

/**
 * Handle refund.created or refund.updated events
 */
async function handleRefundEvent(refund: Stripe.Refund, eventType: string): Promise<void> {
  try {
    console.log(`[STRIPE_WEBHOOK] Processing refund ${eventType}: ${refund.id}`);

    // Find invoice by payment intent ID
    const invoice = await prisma.invoice.findFirst({
      where: {
        stripePaymentIntentId: refund.payment_intent as string,
      },
    });

    if (!invoice) {
      console.warn(`[STRIPE_WEBHOOK] Invoice not found for refund ${refund.id}`);
      return;
    }

    const refundAmount = (refund.amount || 0) / 100; // Convert from cents

    // Update invoice with refund amount
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        amountRefunded: refundAmount,
      },
    });

    // Create a payment record for the refund (negative amount)
    await prisma.payment.create({
      data: {
        amount: -refundAmount, // Negative to indicate refund
        currency: 'USD',
        paymentDate: new Date(refund.created * 1000),
        paymentMethod: 'Stripe Refund',
        referenceNumber: refund.id,
        stripe_payment_id: refund.id,
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        metadata: {
          refundStatus: refund.status,
          refundReason: refund.reason,
        } as any,
      },
    });

    console.log(`[STRIPE_WEBHOOK] Refund ${refund.id} processed for invoice ${invoice.id}`);

  } catch (error) {
    console.error('[STRIPE_WEBHOOK] Error handling refund event:', error);
    throw error;
  }
}

/**
 * GET /api/webhooks/stripe
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    service: 'Stripe Webhook Handler',
    status: 'active',
    timestamp: new Date().toISOString(),
  });
}
