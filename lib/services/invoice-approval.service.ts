import { prisma } from "@/lib/db";
import { Invoice, ApprovalStatus } from "@prisma/client";
import { quickbooksService } from "./quickbooks.service";
import { pipedriveSyncService } from "./pipedrive-sync.service";
import { contractWorkflowService } from "./contract-workflow.service";
import { notificationService } from "./notification.service";

/**
 * Invoice Approval Service
 *
 * Manages the invoice approval workflow:
 * 1. Sales creates invoice (status=DRAFT, approvalStatus=PENDING)
 * 2. Finance approves invoice (approvalStatus=APPROVED)
 * 3. Approved invoices sync to QuickBooks and Pipedrive
 */
export class InvoiceApprovalService {
  /**
   * Submit invoice for approval
   * Sets status to DRAFT and approvalStatus to PENDING
   */
  async submitForApproval(invoiceId: string, submittedBy: string): Promise<Invoice> {
    try {
      // Update invoice status
      const invoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: "DRAFT",
          approvalStatus: "PENDING",
        },
        include: {
          customer: true,
          deal: true,
        },
      });

      // Send notification to Finance team
      // Note: submitter info would come from context - for now using system
      await notificationService.sendInvoiceApprovalRequest(invoice, {
        id: submittedBy,
        name: 'System',
        email: 'system@carreirausa.com',
        role: 'SALES',
      });

      // Log submission
      await prisma.integrationLog.create({
        data: {
          service: "INVOICE_APPROVAL",
          action: "SUBMITTED_FOR_APPROVAL",
          status: "SUCCESS",
          payload: {
            invoiceId,
            submittedBy,
          } as any,
        },
      });

      console.log(`[INVOICE_APPROVAL] Invoice ${invoiceId} submitted for approval by ${submittedBy}`);
      return invoice;
    } catch (error) {
      console.error(`[INVOICE_APPROVAL] Error submitting invoice ${invoiceId}:`, error);

      // Log error
      await prisma.integrationLog.create({
        data: {
          service: "INVOICE_APPROVAL",
          action: "SUBMITTED_FOR_APPROVAL",
          status: "ERROR",
          error: error instanceof Error ? error.message : "Unknown error",
          payload: { invoiceId, submittedBy } as any,
        },
      });

      throw error;
    }
  }

  /**
   * Approve invoice
   * Updates approvalStatus to APPROVED and triggers sync to QB/Pipedrive
   */
  async approveInvoice(invoiceId: string, approvedBy: string): Promise<Invoice> {
    try {
      // Update invoice approval status
      const invoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          approvalStatus: "APPROVED",
          approvedBy,
          approvedAt: new Date(),
          status: "SENT", // Move from DRAFT to SENT upon approval
        },
        include: {
          customer: true,
          deal: true,
          approver: true,
        },
      });

      // Sync to external systems (QuickBooks and Pipedrive)
      // Only sync immediately if dueDate is within 3 days or already past
      const daysUntilDue = Math.ceil((invoice.dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilDue <= 3) {
        // Send immediately if due soon
        await this.syncApprovedInvoice(invoiceId);
        console.log(`[INVOICE_APPROVAL] Invoice ${invoiceId} sent to QB immediately (due in ${daysUntilDue} days)`);
      } else {
        // Schedule for later (will be sent by cron job 3 days before due date)
        console.log(`[INVOICE_APPROVAL] Invoice ${invoiceId} approved but scheduled for QB sync on ${new Date(invoice.dueDate.getTime() - 3 * 24 * 60 * 60 * 1000).toLocaleDateString()} (3 days before due date)`);

        // Log scheduling
        await prisma.integrationLog.create({
          data: {
            service: "quickbooks",
            action: "invoice_sync_scheduled",
            status: "SUCCESS",
            payload: {
              invoiceId,
              dueDate: invoice.dueDate,
              scheduledSendDate: new Date(invoice.dueDate.getTime() - 3 * 24 * 60 * 60 * 1000),
              daysUntilDue,
            } as any,
          },
        });
      }

      // Send approval confirmation notification
      if (invoice.approver) {
        await notificationService.sendInvoiceApproved(invoice, invoice.approver);
      }

      // NEW: Send contract for signature after approval
      try {
        await contractWorkflowService.sendContractOnApproval({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.amount,
          dueDate: invoice.dueDate,
          deal: invoice.deal,
          customer: invoice.customer,
        });
        console.log(`[INVOICE_APPROVAL] Contract workflow initiated for invoice ${invoiceId}`);
      } catch (error) {
        console.error(`[INVOICE_APPROVAL] Failed to send contract for invoice ${invoiceId}:`, error);
        // Log error but don't fail the approval
        await prisma.integrationLog.create({
          data: {
            service: "CONTRACT_WORKFLOW",
            action: "SEND_CONTRACT_FAILED",
            status: "ERROR",
            error: error instanceof Error ? error.message : "Unknown error",
            payload: { invoiceId } as any,
          },
        });
      }

      // Log approval
      await prisma.integrationLog.create({
        data: {
          service: "INVOICE_APPROVAL",
          action: "INVOICE_APPROVED",
          status: "SUCCESS",
          payload: {
            invoiceId,
            approvedBy,
          } as any,
        },
      });

      console.log(`[INVOICE_APPROVAL] Invoice ${invoiceId} approved by ${approvedBy}`);
      return invoice;
    } catch (error) {
      console.error(`[INVOICE_APPROVAL] Error approving invoice ${invoiceId}:`, error);

      // Log error
      await prisma.integrationLog.create({
        data: {
          service: "INVOICE_APPROVAL",
          action: "INVOICE_APPROVED",
          status: "ERROR",
          error: error instanceof Error ? error.message : "Unknown error",
          payload: { invoiceId, approvedBy } as any,
        },
      });

      throw error;
    }
  }

  /**
   * Reject invoice
   * Updates approvalStatus to REJECTED with reason
   */
  async rejectInvoice(invoiceId: string, rejectedBy: string, reason: string): Promise<Invoice> {
    try {
      // Update invoice approval status
      const invoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          approvalStatus: "REJECTED",
          approvedBy: rejectedBy, // Store who rejected it
          approvedAt: new Date(),
          rejectedReason: reason,
        },
        include: {
          customer: true,
          deal: true,
          approver: true,
        },
      });

      // Send rejection notification
      if (invoice.approver) {
        await notificationService.sendInvoiceRejected(invoice, invoice.approver, reason);
      }

      // Log rejection
      await prisma.integrationLog.create({
        data: {
          service: "INVOICE_APPROVAL",
          action: "INVOICE_REJECTED",
          status: "SUCCESS",
          payload: {
            invoiceId,
            rejectedBy,
            reason,
          } as any,
        },
      });

      console.log(`[INVOICE_APPROVAL] Invoice ${invoiceId} rejected by ${rejectedBy}: ${reason}`);
      return invoice;
    } catch (error) {
      console.error(`[INVOICE_APPROVAL] Error rejecting invoice ${invoiceId}:`, error);

      // Log error
      await prisma.integrationLog.create({
        data: {
          service: "INVOICE_APPROVAL",
          action: "INVOICE_REJECTED",
          status: "ERROR",
          error: error instanceof Error ? error.message : "Unknown error",
          payload: { invoiceId, rejectedBy, reason } as any,
        },
      });

      throw error;
    }
  }

  /**
   * Sync approved invoice to QuickBooks and Pipedrive
   * Public method - can be called by cron jobs
   */
  async syncApprovedInvoice(invoiceId: string): Promise<void> {
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
                  context: "approval_flow",
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
            dueDate: invoice.dueDate,
            lineItems: qbLineItems,
          };

          // Add payment term if specified
          if (paymentTermId) {
            qbInvoiceData.paymentTermId = paymentTermId;
          }

          // Create QB invoice (always creates as DRAFT initially)
          const qbInvoice = await quickbooksService.createInvoice(qbInvoiceData);

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
                console.log(`[INVOICE_APPROVAL] Sending QB invoice ${qbInvoice.Id} to ${invoice.customer.email}...`);
                await quickbooksService.sendInvoice(qbInvoice.Id, invoice.customer.email);
                console.log(`[INVOICE_APPROVAL] ✓ Successfully sent QB invoice email for ${qbInvoice.Id} to ${invoice.customer.email}`);

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
                      context: "approval_flow",
                      isInstallment,
                      isFirstInstallment,
                    } as any,
                  },
                });
              } catch (emailError) {
                console.error(`[INVOICE_APPROVAL] ✗ Failed to send QB invoice email for ${qbInvoice.Id}:`, emailError);

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
                      context: "approval_flow",
                    } as any,
                  },
                });

                // Don't fail the whole operation if email fails
              }
            } else {
              // Customer has no email - skip email sending but log warning
              console.warn(`[INVOICE_APPROVAL] ⚠️  Customer ${invoice.customer.name} has no email, skipping invoice email send`);

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
                    context: "approval_flow",
                  } as any,
                },
              });
            }
          } else {
            // Subsequent installment - do NOT send email (will be sent by cron 5 days before due)
            console.log(`[INVOICE_APPROVAL] Created installment invoice ${qbInvoice.Id} as DRAFT (will email 5 days before due date)`);

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
                  context: "approval_flow",
                } as any,
              },
            });
          }

          // Log to IntegrationLog
          await prisma.integrationLog.create({
            data: {
              service: "quickbooks",
              action: "invoice_synced_on_approval",
              status: "SUCCESS",
              payload: {
                invoiceId,
                qbInvoiceId: qbInvoice.Id,
                isInstallment,
                installmentMeta,
              } as any,
            },
          });

          console.log(`[INVOICE_APPROVAL] Synced invoice ${invoiceId} to QuickBooks: ${qbInvoice.Id}`);
        } catch (error) {
          console.error(`[INVOICE_APPROVAL] Error syncing invoice to QuickBooks:`, error);

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

          // Don't throw - continue with Pipedrive sync
        }
      }

      // Sync to Pipedrive (add note to deal) - only if deal exists
      if (invoice.deal && invoice.deal.pipedrive_deal_id) {
        try {
          await pipedriveSyncService.syncInvoiceToPipedrive(invoiceId);
          console.log(`[INVOICE_APPROVAL] Synced invoice ${invoiceId} to Pipedrive`);
        } catch (error) {
          console.error(`[INVOICE_APPROVAL] Error syncing invoice to Pipedrive:`, error);
          // Don't throw - log and continue
        }
      }
    } catch (error) {
      console.error(`[INVOICE_APPROVAL] Error in syncApprovedInvoice:`, error);
      throw error;
    }
  }

  /**
   * Send approval request notification to Finance team
   */
  private async notifyFinanceTeam(invoice: any): Promise<void> {
    try {
      // TODO: Implement email notification using Resend or similar service
      // For now, just log
      console.log(`[INVOICE_APPROVAL] Notification: Invoice ${invoice.id} pending approval`);
      console.log(`  Customer: ${invoice.customer.name}`);
      console.log(`  Amount: ${invoice.amount} ${invoice.deal?.currency || 'USD'}`);
      if (invoice.deal) {
        console.log(`  Deal: ${invoice.deal.title}`);
      }

      // In production, this would send email to EMAIL_FINANCE_TEAM
      // Example:
      // await emailService.send({
      //   to: process.env.EMAIL_FINANCE_TEAM,
      //   subject: `Invoice Approval Required: ${invoice.customer.name}`,
      //   body: ...
      // });
    } catch (error) {
      console.error("[INVOICE_APPROVAL] Error sending Finance notification:", error);
      // Don't throw - notification failure shouldn't block approval workflow
    }
  }

  /**
   * Send approval decision notification to invoice submitter
   */
  private async notifySubmitter(invoice: any, decision: "approved" | "rejected"): Promise<void> {
    try {
      // TODO: Implement email notification
      // For now, just log
      console.log(`[INVOICE_APPROVAL] Notification: Invoice ${invoice.id} ${decision}`);
      console.log(`  Customer: ${invoice.customer.name}`);
      console.log(`  Amount: ${invoice.amount} ${invoice.deal?.currency || 'USD'}`);
      if (invoice.deal) {
        console.log(`  Deal: ${invoice.deal.title}`);
      }
      if (decision === "rejected" && invoice.rejectedReason) {
        console.log(`  Reason: ${invoice.rejectedReason}`);
      }

      // In production, this would send email to the user who created the invoice
      // Example:
      // await emailService.send({
      //   to: submitterEmail,
      //   subject: `Invoice ${decision}: ${invoice.customer.name}`,
      //   body: ...
      // });
    } catch (error) {
      console.error("[INVOICE_APPROVAL] Error sending submitter notification:", error);
      // Don't throw - notification failure shouldn't block approval workflow
    }
  }
}

export const invoiceApprovalService = new InvoiceApprovalService();
