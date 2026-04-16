import { prisma } from "@/lib/db";
import { Invoice } from "@prisma/client";
import { quickbooksService } from "./quickbooks.service";
import { contractWorkflowService } from "./contract-workflow.service";
import { notificationService } from "./notification.service";

/**
 * Invoice Approval Service
 *
 * NOTE: The approvalStatus field has not been added to the Invoice schema yet.
 * This service is currently a placeholder. Once the schema is updated with
 * the approval workflow fields, the methods below can be fully implemented.
 */
export class InvoiceApprovalService {
  async submitForApproval(invoiceId: string, submittedBy: string): Promise<Invoice> {
    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "DRAFT" },
      include: { customer: true, deal: true },
    });

    console.log(`[INVOICE_APPROVAL] Invoice ${invoiceId} submitted for approval by ${submittedBy}`);
    return invoice;
  }

  async approveInvoice(invoiceId: string, approvedBy: string): Promise<Invoice> {
    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "SENT" },
      include: { customer: true, deal: true },
    });

    await this.syncApprovedInvoice(invoiceId);

    await prisma.integrationLog.create({
      data: {
        service: "INVOICE_APPROVAL",
        action: "INVOICE_APPROVED",
        status: "SUCCESS",
        payload: { invoiceId, approvedBy } as any,
      },
    });

    console.log(`[INVOICE_APPROVAL] Invoice ${invoiceId} approved by ${approvedBy}`);
    return invoice;
  }

  async rejectInvoice(invoiceId: string, rejectedBy: string, reason: string): Promise<Invoice> {
    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "DRAFT" },
      include: { customer: true, deal: true },
    });

    await prisma.integrationLog.create({
      data: {
        service: "INVOICE_APPROVAL",
        action: "INVOICE_REJECTED",
        status: "SUCCESS",
        payload: { invoiceId, rejectedBy, reason } as any,
      },
    });

    console.log(`[INVOICE_APPROVAL] Invoice ${invoiceId} rejected by ${rejectedBy}: ${reason}`);
    return invoice;
  }

  async syncApprovedInvoice(invoiceId: string): Promise<void> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true, deal: true },
    });

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    // Sync to QuickBooks (if not already synced)
    if (!invoice.quickbooks_invoice_id) {
      try {
        await quickbooksService.initialize();

        const qbCustomer = await quickbooksService.getOrCreateCustomer({
          email: invoice.customer.email,
          name: invoice.customer.name,
          phone: invoice.customer.phone || undefined,
        });

        if (invoice.customer.email) {
          await quickbooksService.ensureCustomerEmail(qbCustomer.Id, invoice.customer.email);
        }

        const lineItems = (invoice.lineItems as any[]) || [];
        const qbLineItems = lineItems.map((item: any) => ({
          description: item.description || (invoice.deal ? `Invoice for Deal: ${invoice.deal.title}` : `Invoice for ${invoice.customer.name}`),
          amount: Number(item.amount || invoice.amount),
          itemRef: item.serviceItemId || "1",
        }));

        if (qbLineItems.length === 0) {
          qbLineItems.push({
            description: invoice.deal ? `Invoice for Deal: ${invoice.deal.title}` : `Invoice for ${invoice.customer.name}`,
            amount: Number(invoice.amount),
            itemRef: "1",
          });
        }

        const installmentMeta = invoice.installments as any;
        const paymentTermId = installmentMeta?.paymentTermId;

        const qbInvoiceData: any = {
          customerId: qbCustomer.Id,
          dueDate: invoice.dueDate,
          lineItems: qbLineItems,
        };

        if (paymentTermId) {
          qbInvoiceData.paymentTermId = paymentTermId;
        }

        const qbInvoice = await quickbooksService.createInvoice(qbInvoiceData);

        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            quickbooks_invoice_id: String(qbInvoice.Id),
            invoiceNumber: qbInvoice.DocNumber,
          },
        });

        if (invoice.customer.email) {
          try {
            await quickbooksService.sendInvoice(qbInvoice.Id, invoice.customer.email);
            console.log(`[INVOICE_APPROVAL] Sent QB invoice ${qbInvoice.Id} to ${invoice.customer.email}`);
          } catch (emailError) {
            console.error(`[INVOICE_APPROVAL] Failed to send QB invoice email:`, emailError);
          }
        }

        console.log(`[INVOICE_APPROVAL] Synced invoice ${invoiceId} to QuickBooks: ${qbInvoice.Id}`);
      } catch (error) {
        console.error(`[INVOICE_APPROVAL] Error syncing invoice to QuickBooks:`, error);
      }
    }

  }
}

export const invoiceApprovalService = new InvoiceApprovalService();
