import { prisma } from '@/lib/db';
import { stripeService } from './stripe.service';
import { notificationService } from './notification.service';
import { quickbooksService } from './quickbooks.service';
import { InvoiceStatus } from '@prisma/client';

interface Invoice {
  id: string;
  invoiceNumber: string | null;
  amount: any;
  dueDate: Date;
  status: string;
  stripePaymentLinkId: string | null;
  paymentReminderCount: number;
  customer: {
    id: string;
    name: string;
    email: string;
    stripe_id: string | null;
    quickbooks_id: string | null;
  };
}

interface Contract {
  id: string;
  status: string;
}

/**
 * Payment Workflow Service
 *
 * Orchestrates the payment collection workflow:
 * 1. Send payment link after contract is signed
 * 2. Track payment status via Stripe webhooks
 * 3. Send payment reminders (7, 3, 1 days before due date)
 * 4. Sync payments to QuickBooks
 * 5. Send payment confirmation emails
 */
export class PaymentWorkflowService {
  /**
   * Send payment link after contract signature
   * Main entry point for the payment workflow
   */
  async sendPaymentLinkAfterSignature(
    invoice: Invoice,
    contract: Contract
  ): Promise<void> {
    try {
      console.log(`[PAYMENT_WORKFLOW] Starting payment workflow for invoice ${invoice.id}`);

      // Verify contract is signed
      if (contract.status !== 'SIGNED') {
        throw new Error(`Contract ${contract.id} is not signed (status: ${contract.status})`);
      }

      // Create Stripe payment link
      const paymentLink = await stripeService.createPaymentLink(
        {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.amount,
          dueDate: invoice.dueDate,
          quickbooks_invoice_id: null,
          customer: invoice.customer,
        },
        invoice.customer
      );

      console.log(`[PAYMENT_WORKFLOW] Stripe payment link created: ${paymentLink.id}`);

      // Update invoice with payment link ID and status
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          stripePaymentLinkId: paymentLink.id,
          status: InvoiceStatus.SENT,
        },
      });

      console.log(`[PAYMENT_WORKFLOW] Invoice ${invoice.id} status updated to SENT`);

      // Send payment link email to customer
      await notificationService.sendPaymentLink(
        {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.amount,
          dueDate: invoice.dueDate,
          status: InvoiceStatus.SENT,
          approvalStatus: 'APPROVED',
          customer: invoice.customer,
        },
        invoice.customer,
        paymentLink.url
      );

      console.log(`[PAYMENT_WORKFLOW] Payment link email sent to ${invoice.customer.email}`);

    } catch (error) {
      console.error(`[PAYMENT_WORKFLOW] Failed to send payment link for invoice ${invoice.id}:`, error);
      throw new Error('Failed to send payment link: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Handle successful payment (triggered by Stripe webhook)
   */
  async handlePaymentSuccess(paymentIntentId: string): Promise<void> {
    try {
      console.log(`[PAYMENT_WORKFLOW] Processing successful payment: ${paymentIntentId}`);

      // Get payment status from Stripe
      const paymentStatus = await stripeService.getPaymentStatus(paymentIntentId);

      if (paymentStatus.status !== 'succeeded') {
        console.log(`[PAYMENT_WORKFLOW] Payment not succeeded, status: ${paymentStatus.status}`);
        return;
      }

      // Find invoice by Stripe payment intent ID
      const invoice = await prisma.invoice.findFirst({
        where: {
          stripePaymentIntentId: paymentIntentId,
        },
        include: {
          customer: true,
        },
      });

      if (!invoice) {
        console.error(`[PAYMENT_WORKFLOW] Invoice not found for payment intent ${paymentIntentId}`);
        // This might be a payment that was created directly in Stripe
        // We'll need to handle this case by looking at metadata
        return;
      }

      // Update invoice status to PAID
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: InvoiceStatus.PAID,
          paidAt: paymentStatus.paidAt,
          amountPaid: paymentStatus.amount,
          paymentMethod: paymentStatus.paymentMethod || 'Stripe',
        },
      });

      console.log(`[PAYMENT_WORKFLOW] Invoice ${invoice.id} marked as PAID`);

      // Create local Payment record
      const localPayment = await this.createLocalPayment({
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        amount: paymentStatus.amount,
        paymentMethod: 'stripe',
        stripePaymentId: paymentIntentId,
        paymentDate: paymentStatus.paidAt || new Date(),
      });

      // Sync payment to QuickBooks and update local record
      await this.syncPaymentToQuickBooks(invoice, localPayment?.id);

      // Send payment confirmation email
      await notificationService.sendPaymentReceived(
        {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.amount,
          dueDate: invoice.dueDate,
          status: InvoiceStatus.PAID,
          approvalStatus: 'APPROVED',
          customer: invoice.customer,
        },
        invoice.customer
      );

      console.log(`[PAYMENT_WORKFLOW] Payment confirmation email sent`);

    } catch (error) {
      console.error(`[PAYMENT_WORKFLOW] Failed to handle successful payment ${paymentIntentId}:`, error);
      // Don't throw - we don't want to fail the webhook
      console.error(`[PAYMENT_WORKFLOW] Payment processing failed, but webhook will succeed`);
    }
  }

  /**
   * Create a local Payment record in the database
   */
  async createLocalPayment(data: {
    invoiceId: string;
    customerId: string;
    amount: number;
    paymentMethod: string;
    stripePaymentId?: string;
    quickbooksPaymentId?: string;
    paymentDate: Date;
  }): Promise<any> {
    try {
      // Check if payment already exists
      if (data.stripePaymentId) {
        const existing = await prisma.payment.findUnique({
          where: { stripe_payment_id: data.stripePaymentId },
        });
        if (existing) {
          console.log(`[PAYMENT_WORKFLOW] Payment already exists for Stripe ${data.stripePaymentId}`);
          return existing;
        }
      }

      const payment = await prisma.payment.create({
        data: {
          invoiceId: data.invoiceId,
          customerId: data.customerId,
          amount: data.amount,
          currency: 'USD',
          paymentMethod: data.paymentMethod,
          paymentDate: data.paymentDate,
          stripe_payment_id: data.stripePaymentId,
          quickbooks_payment_id: data.quickbooksPaymentId,
          syncedToQb: false,
        },
      });

      console.log(`[PAYMENT_WORKFLOW] Local payment record created: ${payment.id}`);
      return payment;
    } catch (error) {
      console.error(`[PAYMENT_WORKFLOW] Failed to create local payment record:`, error);
      return null;
    }
  }

  /**
   * Handle failed payment (triggered by Stripe webhook)
   */
  async handlePaymentFailed(paymentIntentId: string): Promise<void> {
    try {
      console.log(`[PAYMENT_WORKFLOW] Processing failed payment: ${paymentIntentId}`);

      // Find invoice by Stripe payment intent ID
      const invoice = await prisma.invoice.findFirst({
        where: {
          stripePaymentIntentId: paymentIntentId,
        },
        include: {
          customer: true,
        },
      });

      if (!invoice) {
        console.error(`[PAYMENT_WORKFLOW] Invoice not found for payment intent ${paymentIntentId}`);
        return;
      }

      // Update invoice status if it was marked as processing
      if (invoice.status !== InvoiceStatus.SENT && invoice.status !== InvoiceStatus.OVERDUE) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: InvoiceStatus.SENT, // Reset to sent so customer can retry
          },
        });
        console.log(`[PAYMENT_WORKFLOW] Invoice ${invoice.id} status reset to SENT`);
      }

      // Could send notification to customer about failed payment
      // For now, we'll just log it

      console.log(`[PAYMENT_WORKFLOW] Payment failed for invoice ${invoice.id}`);

    } catch (error) {
      console.error(`[PAYMENT_WORKFLOW] Failed to handle failed payment ${paymentIntentId}:`, error);
    }
  }

  /**
   * Sync payment to QuickBooks
   * Creates a payment in QuickBooks and updates the local Payment record
   */
  async syncPaymentToQuickBooks(invoice: any, localPaymentId?: string): Promise<void> {
    try {
      console.log(`[PAYMENT_WORKFLOW] Syncing payment to QuickBooks for invoice ${invoice.id}`);

      // Check if invoice has QuickBooks ID
      if (!invoice.quickbooks_invoice_id) {
        console.log(`[PAYMENT_WORKFLOW] Invoice ${invoice.id} has no QuickBooks ID, skipping QB sync`);
        return;
      }

      // Check if customer has QuickBooks ID
      if (!invoice.customer?.quickbooks_id) {
        console.log(`[PAYMENT_WORKFLOW] Customer has no QuickBooks ID, skipping QB sync`);
        return;
      }

      // Get payment status from Stripe if available
      let paymentAmount = Number(invoice.amountPaid || invoice.amount);
      let paymentDate = invoice.paidAt || new Date();
      let referenceNumber = invoice.stripePaymentIntentId;

      if (invoice.stripePaymentIntentId) {
        try {
          const paymentStatus = await stripeService.getPaymentStatus(invoice.stripePaymentIntentId);
          if (paymentStatus.status === 'succeeded') {
            paymentAmount = paymentStatus.amount;
            paymentDate = paymentStatus.paidAt || new Date();
          }
        } catch (error) {
          console.log(`[PAYMENT_WORKFLOW] Could not get Stripe payment status, using invoice data`);
        }
      }

      // Initialize QuickBooks service
      await quickbooksService.initialize();

      // Create payment in QuickBooks
      const qbPayment = await quickbooksService.createPayment({
        customerId: invoice.customer.quickbooks_id,
        invoiceId: invoice.quickbooks_invoice_id,
        amount: paymentAmount,
        paymentDate: paymentDate,
        paymentMethod: 'Stripe',
        referenceNumber: referenceNumber,
      });

      console.log(`[PAYMENT_WORKFLOW] Payment synced to QuickBooks: ${qbPayment.Id}`);

      // Update local Payment record with QB payment ID
      if (localPaymentId) {
        await prisma.payment.update({
          where: { id: localPaymentId },
          data: {
            quickbooks_payment_id: qbPayment.Id,
            syncedToQb: true,
            lastSyncAt: new Date(),
          },
        });
        console.log(`[PAYMENT_WORKFLOW] Local payment ${localPaymentId} updated with QB ID ${qbPayment.Id}`);
      }

      // Update customer balance
      await this.updateCustomerBalance(invoice.customerId);

      // Log integration action
      await prisma.integrationLog.create({
        data: {
          service: 'QUICKBOOKS',
          action: 'PAYMENT_SYNCED_FROM_STRIPE',
          status: 'SUCCESS',
          payload: {
            qbPaymentId: qbPayment.Id,
            qbInvoiceId: invoice.quickbooks_invoice_id,
            stripePaymentId: invoice.stripePaymentIntentId,
            amount: paymentAmount,
            localPaymentId,
          } as any,
        },
      });

    } catch (error) {
      console.error(`[PAYMENT_WORKFLOW] Failed to sync payment to QuickBooks:`, error);

      // Log the error
      await prisma.integrationLog.create({
        data: {
          service: 'QUICKBOOKS',
          action: 'PAYMENT_SYNC_FAILED',
          status: 'ERROR',
          error: error instanceof Error ? error.message : 'Unknown error',
          payload: {
            invoiceId: invoice.id,
            stripePaymentId: invoice.stripePaymentIntentId,
            localPaymentId,
          } as any,
        },
      });

      // Don't throw - payment was successful, QB sync is secondary
    }
  }

  /**
   * Update customer balance from invoices and payments
   */
  async updateCustomerBalance(customerId: string): Promise<void> {
    try {
      // Calculate totals from invoices
      const invoiceStats = await prisma.invoice.aggregate({
        where: { customerId },
        _sum: { amount: true, amountPaid: true },
      });

      // Calculate total paid from payments
      const paymentStats = await prisma.payment.aggregate({
        where: { customerId },
        _sum: { amount: true },
      });

      const totalInvoiced = Number(invoiceStats._sum.amount || 0);
      const totalPaid = Number(paymentStats._sum.amount || invoiceStats._sum.amountPaid || 0);
      const balance = totalInvoiced - totalPaid;

      await prisma.customer.update({
        where: { id: customerId },
        data: {
          qbTotalInvoiced: totalInvoiced,
          qbTotalPaid: totalPaid,
          qbBalance: Math.max(0, balance),
          lastQbBalanceSync: new Date(),
        },
      });

      console.log(`[PAYMENT_WORKFLOW] Customer ${customerId} balance updated: $${balance.toFixed(2)}`);
    } catch (error) {
      console.error(`[PAYMENT_WORKFLOW] Failed to update customer balance:`, error);
    }
  }

  /**
   * Send payment reminder for a specific invoice
   */
  async sendReminderForInvoice(invoice: any, paymentUrl: string): Promise<void> {
    try {
      console.log(`[PAYMENT_WORKFLOW] Sending payment reminder for invoice ${invoice.id}`);

      // Send reminder email
      await notificationService.sendPaymentReminder(
        {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.amount,
          dueDate: invoice.dueDate,
          status: invoice.status,
          approvalStatus: invoice.approvalStatus,
          customer: invoice.customer,
        },
        invoice.customer,
        paymentUrl
      );

      // Update reminder count and timestamp
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          paymentReminderCount: (invoice.paymentReminderCount || 0) + 1,
          lastPaymentReminderAt: new Date(),
        },
      });

      console.log(`[PAYMENT_WORKFLOW] Reminder sent for invoice ${invoice.id} (reminder #${(invoice.paymentReminderCount || 0) + 1})`);

    } catch (error) {
      console.error(`[PAYMENT_WORKFLOW] Failed to send reminder for invoice ${invoice.id}:`, error);
      // Don't throw - continue processing other reminders
    }
  }

  /**
   * Send payment reminders for all invoices that need them
   * Called by cron job daily
   */
  async sendPaymentReminders(): Promise<{ sent: number; errors: number }> {
    try {
      console.log(`[PAYMENT_WORKFLOW] Starting payment reminder check...`);

      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

      // Find invoices needing reminders
      const invoicesNeedingReminder = await prisma.invoice.findMany({
        where: {
          status: InvoiceStatus.SENT,
          stripePaymentLinkId: { not: null },
          OR: [
            // First reminder: 7 days before due date, no reminders sent
            {
              dueDate: { lte: sevenDaysFromNow, gte: threeDaysFromNow },
              paymentReminderCount: 0,
            },
            // Second reminder: 3 days before due date, 1 reminder sent
            {
              dueDate: { lte: threeDaysFromNow, gte: oneDayFromNow },
              paymentReminderCount: 1,
            },
            // Final reminder: 1 day before due date, 2 reminders sent
            {
              dueDate: { lte: oneDayFromNow, gte: now },
              paymentReminderCount: 2,
            },
          ],
        },
        include: {
          customer: true,
        },
      });

      console.log(`[PAYMENT_WORKFLOW] Found ${invoicesNeedingReminder.length} invoices needing reminders`);

      let sent = 0;
      let errors = 0;

      for (const invoice of invoicesNeedingReminder) {
        try {
          // Get payment link URL from Stripe
          let paymentUrl = '';
          if (invoice.stripePaymentLinkId) {
            // For payment links, we can construct the URL or fetch from Stripe
            // Stripe payment links have predictable URLs
            paymentUrl = `https://buy.stripe.com/${invoice.stripePaymentLinkId}`;
          }

          await this.sendReminderForInvoice(invoice, paymentUrl);
          sent++;
        } catch (error) {
          console.error(`[PAYMENT_WORKFLOW] Failed to send reminder for invoice ${invoice.id}:`, error);
          errors++;
        }
      }

      console.log(`[PAYMENT_WORKFLOW] Reminder check complete: ${sent} sent, ${errors} errors`);

      return { sent, errors };

    } catch (error) {
      console.error(`[PAYMENT_WORKFLOW] Failed to send payment reminders:`, error);
      throw error;
    }
  }

  /**
   * Check for overdue invoices and mark them as overdue
   * Called by cron job daily
   */
  async checkOverdueInvoices(): Promise<{ overdue: number; errors: number }> {
    try {
      console.log(`[PAYMENT_WORKFLOW] Checking for overdue invoices...`);

      const now = new Date();

      // Find invoices that are overdue (dueDate < now and still SENT)
      const overdueInvoices = await prisma.invoice.findMany({
        where: {
          status: InvoiceStatus.SENT,
          dueDate: { lt: now },
        },
        include: {
          customer: true,
        },
      });

      console.log(`[PAYMENT_WORKFLOW] Found ${overdueInvoices.length} overdue invoices`);

      let overdue = 0;
      let errors = 0;

      for (const invoice of overdueInvoices) {
        try {
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              status: InvoiceStatus.OVERDUE,
              markedOverdueAt: new Date(), // Track when it became overdue for collection calls
            },
          });
          overdue++;
          console.log(`[PAYMENT_WORKFLOW] Invoice ${invoice.id} marked as OVERDUE`);
        } catch (error) {
          console.error(`[PAYMENT_WORKFLOW] Failed to mark invoice ${invoice.id} as overdue:`, error);
          errors++;
        }
      }

      console.log(`[PAYMENT_WORKFLOW] Overdue check complete: ${overdue} marked overdue, ${errors} errors`);

      return { overdue, errors };

    } catch (error) {
      console.error(`[PAYMENT_WORKFLOW] Failed to check overdue invoices:`, error);
      throw error;
    }
  }

  /**
   * Resend payment link for an invoice
   */
  async resendPaymentLink(invoiceId: string): Promise<string> {
    try {
      console.log(`[PAYMENT_WORKFLOW] Resending payment link for invoice ${invoiceId}`);

      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          customer: true,
          contract: true,
        },
      });

      if (!invoice) {
        throw new Error(`Invoice ${invoiceId} not found`);
      }

      // Verify contract is signed
      if (invoice.contract?.status !== 'SIGNED') {
        throw new Error(`Contract must be signed before payment`);
      }

      // If payment link already exists, reuse it
      let paymentUrl = '';
      if (invoice.stripePaymentLinkId) {
        paymentUrl = `https://buy.stripe.com/${invoice.stripePaymentLinkId}`;
      } else {
        // Create new payment link
        const paymentLink = await stripeService.createPaymentLink(
          {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            amount: invoice.amount,
            dueDate: invoice.dueDate,
            quickbooks_invoice_id: invoice.quickbooks_invoice_id,
            customer: invoice.customer,
          },
          invoice.customer
        );

        paymentUrl = paymentLink.url;

        // Update invoice with new payment link ID
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            stripePaymentLinkId: paymentLink.id,
          },
        });
      }

      // Send payment link email
      await notificationService.sendPaymentLink(
        {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.amount,
          dueDate: invoice.dueDate,
          status: invoice.status,
          approvalStatus: invoice.approvalStatus,
          customer: invoice.customer,
        },
        invoice.customer,
        paymentUrl
      );

      console.log(`[PAYMENT_WORKFLOW] Payment link resent for invoice ${invoiceId}`);

      return paymentUrl;

    } catch (error) {
      console.error(`[PAYMENT_WORKFLOW] Failed to resend payment link for invoice ${invoiceId}:`, error);
      throw error;
    }
  }
}

export const paymentWorkflowService = new PaymentWorkflowService();
