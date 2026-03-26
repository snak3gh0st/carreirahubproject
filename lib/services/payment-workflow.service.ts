import { prisma } from '@/lib/db';
import { InvoiceStatus } from '@prisma/client';

/**
 * Payment Workflow Service
 *
 * Orchestrates payment-adjacent workflows:
 * - Track overdue invoices (daily cron)
 * - Recalculate customer balances
 */
export class PaymentWorkflowService {
  /**
   * Update customer balance from invoices and payments
   */
  async updateCustomerBalance(customerId: string): Promise<void> {
    try {
      const invoiceStats = await prisma.invoice.aggregate({
        where: { customerId },
        _sum: { amount: true, amountPaid: true },
      });

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
   * Check for overdue invoices and mark them as overdue
   * Called by cron job daily at 2:00 AM UTC
   */
  async checkOverdueInvoices(): Promise<{ overdue: number; errors: number }> {
    try {
      console.log(`[PAYMENT_WORKFLOW] Checking for overdue invoices...`);

      const now = new Date();

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
              markedOverdueAt: new Date(),
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
}

export const paymentWorkflowService = new PaymentWorkflowService();
