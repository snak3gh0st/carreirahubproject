import { prisma } from "@/lib/db";
import { quickbooksService } from "./quickbooks.service";
import { contractWorkflowService } from "./contract-workflow.service";

/**
 * Invoice Sync Service
 *
 * Manages invoice synchronization to external systems:
 * 1. Sync invoice to QuickBooks (create and optionally send email)
 * 2. Sync to Pipedrive (add note to deal)
 * 3. Trigger contract workflow if applicable
 */
export class InvoiceSyncService {
  /**
   * Sync invoice to QuickBooks and Pipedrive
   * Public method - can be called from invoice creation or cron jobs
   */
  async syncInvoiceToQuickBooks(invoiceId: string): Promise<void> {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          customer: true,
          deal: true,
        },
      });

      if (!invoice) {
        throw new Error(`Invoice ${invoiceId} not found`);
      }

      // Extract installment metadata if present
      const installmentMeta = invoice.installments as any;
      const isInstallment = installmentMeta?.seriesId;
      const isFirstInstallment = installmentMeta?.isFirstInstallment === true;
      const priceLevelId = installmentMeta?.priceLevelId;
      const paymentTermId = installmentMeta?.paymentTermId;

      // Sync to QuickBooks (if not already synced)
      if (!invoice.quickbooks_invoice_id) {
        try {
          // Initialize QB service
          await quickbooksService.initialize();

          // Get or create QB customer
          const qbCustomer = await quickbooksService.getOrCreateCustomer({
            email: invoice.customer.email,
            name: invoice.customer.name,
            phone: invoice.customer.phone || undefined,
          });

          // Ensure QB customer has correct email before sending invoice
          if (invoice.customer.email) {
            const emailVerified = await quickbooksService.ensureCustomerEmail(qbCustomer.Id, invoice.customer.email);

            // Log email verification result
            await prisma.integrationLog.create({
              data: {
                service: "quickbooks",
                action: emailVerified ? "customer_email_verified" : "customer_email_verification_failed",
                status: emailVerified ? "SUCCESS" : "ERROR",
                payload: {
                  qbCustomerId: qbCustomer.Id,
                  customerEmail: invoice.customer.email,
                  emailVerified,
                  context: "invoice_sync",
                } as any,
              },
            });
          }

          // Prepare line items from invoice data
          const lineItems = (invoice.lineItems as any[]) || [];
          const qbLineItems = lineItems.map((item: any) => ({
            description: item.description || (invoice.deal ? `Invoice for Deal: ${invoice.deal.title}` : `Invoice for ${invoice.customer.name}`),
            amount: Number(item.amount || invoice.amount),
            itemRef: item.serviceItemId || "1", // Use service item from invoice or default
          }));

          // If no line items, create default one
          if (qbLineItems.length === 0) {
            qbLineItems.push({
              description: invoice.deal ? `Invoice for Deal: ${invoice.deal.title}` : `Invoice for ${invoice.customer.name}`,
              amount: Number(invoice.amount),
              itemRef: "1",
            });
          }

          // Prepare QB invoice data with optional payment term
          const qbInvoiceData: any = {
            customerId: qbCustomer.Id,
            customerEmail: invoice.customer.email,
            dueDate: invoice.dueDate,
            lineItems: qbLineItems,
          };

          // Add payment term if specified
          if (paymentTermId) {
            qbInvoiceData.paymentTermId = paymentTermId;
          }

          // Create QB invoice with BillEmail set (enables automatic email delivery)
          const qbInvoice = await quickbooksService.createInvoiceWithBillEmail(qbInvoiceData);

          // Update invoice with QB ID
          await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
              quickbooks_invoice_id: String(qbInvoice.Id),
              invoiceNumber: qbInvoice.DocNumber,
            },
          });

          // Determine if we should send email immediately
          // ONLY send for: first installment OR non-installment invoices
          const shouldSendEmail = !isInstallment || isFirstInstallment;

          if (shouldSendEmail) {
            // Send invoice via email (only if customer has email)
            if (invoice.customer.email) {
              try {
                console.log(`[INVOICE_SYNC] Sending QB invoice ${qbInvoice.Id} to ${invoice.customer.email}...`);
                await quickbooksService.sendInvoice(qbInvoice.Id, invoice.customer.email);
                console.log(`[INVOICE_SYNC] ✓ Successfully sent QB invoice email for ${qbInvoice.Id} to ${invoice.customer.email}`);

                // Log email sent
                await prisma.integrationLog.create({
                  data: {
                    service: "quickbooks",
                    action: "invoice_email_sent",
                    status: "SUCCESS",
                    payload: {
                      invoiceId,
                      qbInvoiceId: qbInvoice.Id,
                      recipientEmail: invoice.customer.email,
                      context: "invoice_sync",
                      isInstallment,
                      isFirstInstallment,
                    } as any,
                  },
                });

              } catch (emailError) {
                console.error(`[INVOICE_SYNC] ✗ Failed to send QB invoice email for ${qbInvoice.Id}:`, emailError);

                // Log email failure
                await prisma.integrationLog.create({
                  data: {
                    service: "quickbooks",
                    action: "invoice_email_failed",
                    status: "ERROR",
                    error: emailError instanceof Error ? emailError.message : "Unknown error",
                    payload: {
                      invoiceId,
                      qbInvoiceId: qbInvoice.Id,
                      customerEmail: invoice.customer.email,
                      context: "invoice_sync",
                    } as any,
                  },
                });

                // Don't fail the whole operation if email fails
              }
            } else {
              // Customer has no email - skip email sending but log warning
              console.warn(`[INVOICE_SYNC] ⚠️  Customer ${invoice.customer.name} has no email, skipping invoice email send`);

              await prisma.integrationLog.create({
                data: {
                  service: "quickbooks",
                  action: "invoice_email_skipped",
                  status: "SUCCESS",
                  payload: {
                    invoiceId,
                    qbInvoiceId: qbInvoice.Id,
                    customerId: invoice.customer.id,
                    customerName: invoice.customer.name,
                    reason: "Customer has no email address",
                    context: "invoice_sync",
                  } as any,
                },
              });
            }
          } else {
            // Subsequent installment - do NOT send email (will be sent by cron 5 days before due)
            console.log(`[INVOICE_SYNC] Created installment invoice ${qbInvoice.Id} as DRAFT (will email 5 days before due date)`);

            await prisma.integrationLog.create({
              data: {
                service: "quickbooks",
                action: "installment_invoice_created_as_draft",
                status: "SUCCESS",
                payload: {
                  invoiceId,
                  qbInvoiceId: qbInvoice.Id,
                  dueDate: invoice.dueDate,
                  isFirstInstallment: false,
                  context: "invoice_sync",
                } as any,
              },
            });
          }

          // Log to IntegrationLog
          await prisma.integrationLog.create({
            data: {
              service: "quickbooks",
              action: "invoice_synced",
              status: "SUCCESS",
              payload: {
                invoiceId,
                qbInvoiceId: qbInvoice.Id,
                isInstallment,
                installmentMeta,
              } as any,
            },
          });

          console.log(`[INVOICE_SYNC] Synced invoice ${invoiceId} to QuickBooks: ${qbInvoice.Id}`);
        } catch (error) {
          console.error(`[INVOICE_SYNC] Error syncing invoice to QuickBooks:`, error);

          // Log error to IntegrationLog
          await prisma.integrationLog.create({
            data: {
              service: "quickbooks",
              action: "invoice_sync_failed",
              status: "ERROR",
              error: error instanceof Error ? error.message : "Unknown error",
              payload: { invoiceId } as any,
            },
          });

          // Don't throw - continue
        }
      }
    } catch (error) {
      console.error(`[INVOICE_SYNC] Error in syncInvoiceToQuickBooks:`, error);
      throw error;
    }
  }
}

export const invoiceSyncService = new InvoiceSyncService();
