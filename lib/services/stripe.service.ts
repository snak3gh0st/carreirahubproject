import Stripe from "stripe";
import { prisma } from '@/lib/db';
import { quickbooksService } from './quickbooks.service';

interface Invoice {
  id: string;
  invoiceNumber: string | null;
  amount: any;
  dueDate: Date;
  quickbooks_invoice_id: string | null;
  customer: {
    id: string;
    name: string;
    email: string;
    stripe_id: string | null;
    quickbooks_id: string | null;
  };
}

interface PaymentStatus {
  status: Stripe.PaymentIntent.Status;
  amount: number;
  currency: string;
  paymentMethod?: string;
  paidAt?: Date;
}

/**
 * Stripe Service
 *
 * Handles Stripe API integration for invoice and payment management
 */
export class StripeService {
  private stripe: Stripe;
  private readonly successUrl: string;
  private readonly cancelUrl: string;

  constructor() {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    this.stripe = new Stripe(apiKey, {
      apiVersion: "2023-10-16",
    });

    this.successUrl = process.env.STRIPE_PAYMENT_SUCCESS_URL || `${process.env.NEXT_PUBLIC_APP_URL}/payment/success`;
    this.cancelUrl = process.env.STRIPE_PAYMENT_CANCEL_URL || `${process.env.NEXT_PUBLIC_APP_URL}/payment/cancel`;
  }

  /**
   * Get or create Customer in Stripe
   */
  async getOrCreateCustomer(data: {
    email: string;
    name: string;
    phone?: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Customer> {
    // Search for existing customer by email
    const existingCustomers = await this.stripe.customers.list({
      email: data.email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      return existingCustomers.data[0];
    }

    // Create new customer
    return this.stripe.customers.create({
      email: data.email,
      name: data.name,
      phone: data.phone,
      metadata: data.metadata || {},
    });
  }

  /**
   * Create Invoice in Stripe
   */
  async createInvoice(data: {
    customerId: string;
    amount: number;
    currency?: string;
    description?: string;
    dueDate?: Date;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Invoice> {
    // Create invoice item
    const invoiceItem = await this.stripe.invoiceItems.create({
      customer: data.customerId,
      amount: Math.round(data.amount * 100), // Stripe uses cents
      currency: data.currency || "usd",
      description: data.description || "Invoice",
    });

    // Create invoice
    const invoice = await this.stripe.invoices.create({
      customer: data.customerId,
      collection_method: "send_invoice",
      days_until_due: data.dueDate
        ? Math.ceil((data.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 30,
      metadata: data.metadata || {},
    });

    // Finalize invoice
    return this.stripe.invoices.finalizeInvoice(invoice.id);
  }

  /**
   * Send Invoice by email
   */
  async sendInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    return this.stripe.invoices.sendInvoice(invoiceId);
  }

  /**
   * Get Invoice by ID
   */
  async getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    return this.stripe.invoices.retrieve(invoiceId);
  }

  /**
   * Create Payment Intent (for direct payment)
   */
  async createPaymentIntent(data: {
    customerId: string;
    amount: number;
    currency?: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.create({
      customer: data.customerId,
      amount: Math.round(data.amount * 100),
      currency: data.currency || "usd",
      metadata: data.metadata || {},
      automatic_payment_methods: {
        enabled: true,
      },
    });
  }

  /**
   * Create Payment Link for invoice
   * Returns a shareable link that the customer can use to pay
   */
  async createPaymentLink(
    invoice: Invoice,
    customer: { id: string; name: string; email: string; stripe_id: string | null }
  ): Promise<{ url: string; id: string }> {
    try {
      // Get or create Stripe customer
      let stripeCustomerId = customer.stripe_id;
      if (!stripeCustomerId) {
        const stripeCustomer = await this.getOrCreateCustomer({
          email: customer.email,
          name: customer.name,
          metadata: {
            hub_customer_id: customer.id,
          },
        });
        stripeCustomerId = stripeCustomer.id;

        // Update customer with Stripe ID
        await prisma.customer.update({
          where: { id: customer.id },
          data: { stripe_id: stripeCustomerId },
        });
      }

      // Create a product for this invoice
      const product = await this.stripe.products.create({
        name: `Invoice ${invoice.invoiceNumber || invoice.id}`,
        metadata: {
          invoice_id: invoice.id,
          invoice_number: invoice.invoiceNumber || invoice.id,
        },
      });

      // Create a price for the product
      const price = await this.stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(Number(invoice.amount) * 100), // Convert to cents
        currency: 'usd',
      });

      // Create payment link
      const paymentLink = await this.stripe.paymentLinks.create({
        line_items: [
          {
            price: price.id,
            quantity: 1,
          },
        ],
        after_completion: {
          type: 'redirect',
          redirect: {
            url: `${this.successUrl}?invoice_id=${invoice.id}`,
          },
        },
        metadata: {
          invoice_id: invoice.id,
          invoice_number: invoice.invoiceNumber || invoice.id,
          customer_id: customer.id,
        },
        customer_creation: 'always',
        invoice_creation: {
          enabled: true,
          invoice_data: {
            description: `Payment for Invoice ${invoice.invoiceNumber || invoice.id}`,
            metadata: {
              hub_invoice_id: invoice.id,
            },
            custom_fields: [
              {
                name: 'Invoice Number',
                value: invoice.invoiceNumber || invoice.id,
              },
            ],
          },
        },
      });

      console.log(`[STRIPE] Payment link created: ${paymentLink.id}`);

      // Store payment link URL and ID in database
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          stripePaymentLinkId: paymentLink.id,
          stripePaymentLinkUrl: paymentLink.url || undefined,
        },
      });

      return {
        url: paymentLink.url,
        id: paymentLink.id,
      };

    } catch (error) {
      console.error('[STRIPE] Failed to create payment link:', error);
      throw new Error('Failed to create Stripe payment link: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Create Checkout Session for invoice
   * Alternative to payment link with more customization options
   */
  async createCheckoutSession(
    invoice: Invoice,
    customer: { id: string; name: string; email: string; stripe_id: string | null }
  ): Promise<{ url: string; sessionId: string }> {
    try {
      // Get or create Stripe customer
      let stripeCustomerId = customer.stripe_id;
      if (!stripeCustomerId) {
        const stripeCustomer = await this.getOrCreateCustomer({
          email: customer.email,
          name: customer.name,
          metadata: {
            hub_customer_id: customer.id,
          },
        });
        stripeCustomerId = stripeCustomer.id;

        // Update customer with Stripe ID
        await prisma.customer.update({
          where: { id: customer.id },
          data: { stripe_id: stripeCustomerId },
        });
      }

      // Create checkout session
      const session = await this.stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        payment_method_types: ['card', 'us_bank_account'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Invoice ${invoice.invoiceNumber || invoice.id}`,
                description: `Payment for services`,
              },
              unit_amount: Math.round(Number(invoice.amount) * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${this.successUrl}?session_id={CHECKOUT_SESSION_ID}&invoice_id=${invoice.id}`,
        cancel_url: `${this.cancelUrl}?invoice_id=${invoice.id}`,
        metadata: {
          invoice_id: invoice.id,
          invoice_number: invoice.invoiceNumber || invoice.id,
          customer_id: customer.id,
        },
        invoice_creation: {
          enabled: true,
          invoice_data: {
            description: `Payment for Invoice ${invoice.invoiceNumber || invoice.id}`,
            metadata: {
              hub_invoice_id: invoice.id,
            },
            custom_fields: [
              {
                name: 'Invoice Number',
                value: invoice.invoiceNumber || invoice.id,
              },
            ],
          },
        },
      });

      console.log(`[STRIPE] Checkout session created: ${session.id}`);

      return {
        url: session.url || '',
        sessionId: session.id,
      };

    } catch (error) {
      console.error('[STRIPE] Failed to create checkout session:', error);
      throw new Error('Failed to create Stripe checkout session: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Get payment status from Payment Intent ID
   */
  async getPaymentStatus(paymentIntentId: string): Promise<PaymentStatus> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

      return {
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100, // Convert from cents
        currency: paymentIntent.currency,
        paymentMethod: paymentIntent.payment_method?.toString(),
        paidAt: paymentIntent.status === 'succeeded' && paymentIntent.created
          ? new Date(paymentIntent.created * 1000)
          : undefined,
      };

    } catch (error) {
      console.error('[STRIPE] Failed to get payment status:', error);
      throw new Error('Failed to get payment status: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Get payment details from Checkout Session ID
   */
  async getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    try {
      return await this.stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent', 'customer'],
      });
    } catch (error) {
      console.error('[STRIPE] Failed to get checkout session:', error);
      throw error;
    }
  }

  /**
   * Create a refund for a payment
   * Supports both full and partial refunds
   */
  async createRefund(data: {
    paymentIntentId: string;
    amount?: number; // Optional for partial refund (in dollars)
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
    metadata?: Record<string, string>;
  }): Promise<Stripe.Refund> {
    try {
      const refundData: Stripe.RefundCreateParams = {
        payment_intent: data.paymentIntentId,
        metadata: data.metadata,
      };

      // Add amount if it's a partial refund
      if (data.amount) {
        refundData.amount = Math.round(data.amount * 100); // Convert to cents
      }

      // Add reason if provided
      if (data.reason) {
        refundData.reason = data.reason;
      }

      console.log(`[STRIPE] Creating refund for payment intent ${data.paymentIntentId}`, refundData);

      const refund = await this.stripe.refunds.create(refundData);

      console.log(`[STRIPE] Refund created successfully: ${refund.id}`);

      return refund;
    } catch (error) {
      console.error('[STRIPE] Failed to create refund:', error);
      throw new Error('Failed to create refund: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Get refund details
   */
  async getRefund(refundId: string): Promise<Stripe.Refund> {
    try {
      return await this.stripe.refunds.retrieve(refundId);
    } catch (error) {
      console.error('[STRIPE] Failed to get refund:', error);
      throw error;
    }
  }

  /**
   * Sync payment to QuickBooks
   * Records the payment against the invoice in QuickBooks
   */
  async syncPaymentToQuickBooks(paymentIntentId: string, invoice: Invoice): Promise<void> {
    try {
      // Get payment details from Stripe
      const paymentStatus = await this.getPaymentStatus(paymentIntentId);

      if (paymentStatus.status !== 'succeeded') {
        console.log(`[STRIPE] Payment not succeeded yet, skipping QB sync. Status: ${paymentStatus.status}`);
        return;
      }

      // Check if invoice has QuickBooks ID
      if (!invoice.quickbooks_invoice_id) {
        console.log(`[STRIPE] Invoice ${invoice.id} has no QuickBooks ID, skipping payment sync`);
        return;
      }

      // Check if customer has QuickBooks ID
      if (!invoice.customer.quickbooks_id) {
        console.log(`[STRIPE] Customer ${invoice.customer.id} has no QuickBooks ID, skipping payment sync`);
        return;
      }

      // Initialize QuickBooks service
      await quickbooksService.initialize();

      // Create payment in QuickBooks
      const qbPayment = await quickbooksService.createPayment({
        customerId: invoice.customer.quickbooks_id,
        invoiceId: invoice.quickbooks_invoice_id,
        amount: paymentStatus.amount,
        paymentDate: paymentStatus.paidAt || new Date(),
        paymentMethod: paymentStatus.paymentMethod || 'Stripe',
        referenceNumber: paymentIntentId,
      });

      console.log(`[STRIPE] Payment synced to QuickBooks: ${qbPayment.Id}`);

      // Update invoice in database
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'PAID',
          paidAt: paymentStatus.paidAt,
          amountPaid: paymentStatus.amount,
          paymentMethod: paymentStatus.paymentMethod || 'Stripe',
        },
      });

      console.log(`[STRIPE] Invoice ${invoice.id} marked as PAID in database`);

    } catch (error) {
      console.error('[STRIPE] Failed to sync payment to QuickBooks:', error);
      // Don't throw - we don't want to fail the webhook processing
      // Log the error and continue
      console.error('[STRIPE] Payment sync failed, but webhook will succeed');
    }
  }

  /**
   * Retrieve customer
   */
  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    return this.stripe.customers.retrieve(customerId) as Promise<Stripe.Customer>;
  }

  /**
   * List payment methods for a customer
   */
  async listPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    const paymentMethods = await this.stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });
    return paymentMethods.data;
  }
}

export const stripeService = new StripeService();
