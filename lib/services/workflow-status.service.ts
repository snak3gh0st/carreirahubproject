import { prisma } from "@/lib/db";
import { quickbooksService } from "./quickbooks.service";
import { docusignService } from "./docusign.service";
import { integrationLogger } from "@/lib/utils/logger";
import { extractQuickbooksInvoiceLink } from "@/lib/quickbooks/invoice-link";

/**
 * Workflow Status Service
 *
 * Manages workflow status tracking and manual retry capabilities for Finance workflow
 */
export class WorkflowStatusService {
  /**
   * Update workflow status for a deal
   */
  async updateWorkflowStatus(
    dealId: string,
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED",
    error?: string
  ): Promise<void> {
    try {
      const updates: any = {
        workflowStatus: status,
      };

      if (status === "IN_PROGRESS" && !error) {
        updates.workflowStartedAt = new Date();
      }

      if (status === "COMPLETED") {
        updates.workflowCompletedAt = new Date();
        updates.workflowError = null; // Clear any previous errors
      }

      if (status === "FAILED" && error) {
        updates.workflowError = error;
      }

      await prisma.deal.update({
        where: { id: dealId },
        data: updates,
      });

      await integrationLogger.logSuccess(
        "WORKFLOW_STATUS",
        "STATUS_UPDATED",
        { dealId, status, hasError: !!error }
      );
    } catch (err) {
      await integrationLogger.logError(
        "WORKFLOW_STATUS",
        "UPDATE_FAILED",
        err instanceof Error ? err : new Error(String(err)),
        { dealId, status }
      );
      throw err;
    }
  }

  /**
   * Mark invoice as created for a deal
   */
  async markInvoiceCreated(dealId: string): Promise<void> {
    try {
      await prisma.deal.update({
        where: { id: dealId },
        data: { invoiceCreatedAt: new Date() },
      });

      await integrationLogger.logSuccess(
        "WORKFLOW_STATUS",
        "INVOICE_MARKED",
        { dealId }
      );
    } catch (err) {
      await integrationLogger.logError(
        "WORKFLOW_STATUS",
        "INVOICE_MARK_FAILED",
        err instanceof Error ? err : new Error(String(err)),
        { dealId }
      );
    }
  }

  /**
   * Mark contract as sent for a deal
   */
  async markContractSent(dealId: string): Promise<void> {
    try {
      await prisma.deal.update({
        where: { id: dealId },
        data: { contractSentAt: new Date() },
      });

      await integrationLogger.logSuccess(
        "WORKFLOW_STATUS",
        "CONTRACT_MARKED",
        { dealId }
      );
    } catch (err) {
      await integrationLogger.logError(
        "WORKFLOW_STATUS",
        "CONTRACT_MARK_FAILED",
        err instanceof Error ? err : new Error(String(err)),
        { dealId }
      );
    }
  }

  /**
   * Get current workflow status for a deal
   */
  async getWorkflowStatus(dealId: string): Promise<{
    deal: any;
    steps: Array<{ name: string; status: string; timestamp: Date | null }>;
    errors: string[];
    canRetry: boolean;
  }> {
    try {
      const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        include: {
          customer: true,
          invoices: true,
          contracts: true,
        },
      });

      if (!deal) {
        throw new Error("Deal not found");
      }

      // Build workflow steps
      const steps = [
        {
          name: "Customer Reconciliation",
          status: deal.customer ? "completed" : "pending",
          timestamp: deal.createdAt,
        },
        {
          name: "Invoice Creation",
          status: deal.invoiceCreatedAt
            ? "completed"
            : deal.workflowStatus === "IN_PROGRESS"
            ? "in_progress"
            : "pending",
          timestamp: deal.invoiceCreatedAt,
        },
        {
          name: "Contract Generation",
          status: deal.contractSentAt
            ? "completed"
            : deal.workflowStatus === "IN_PROGRESS"
            ? "in_progress"
            : "pending",
          timestamp: deal.contractSentAt,
        },
      ];

      // Get errors from integration logs
      const errorLogs = await prisma.integrationLog.findMany({
        where: {
          status: "ERROR",
          payload: {
            path: ["dealId"],
            equals: dealId,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      const errors = errorLogs.map((log) => log.error || "Unknown error");

      // Can retry if workflow failed or has errors
      const canRetry =
        deal.workflowStatus === "FAILED" || errorLogs.length > 0;

      return {
        deal,
        steps,
        errors,
        canRetry,
      };
    } catch (err) {
      await integrationLogger.logError(
        "WORKFLOW_STATUS",
        "GET_STATUS_FAILED",
        err instanceof Error ? err : new Error(String(err)),
        { dealId }
      );
      throw err;
    }
  }

  /**
   * Retry a failed workflow step
   */
  async retryFailedStep(
    dealId: string,
    step: "invoice" | "contract"
  ): Promise<{ success: boolean; message: string }> {
    try {
      const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        include: { customer: true },
      });

      if (!deal || !deal.customer) {
        return { success: false, message: "Deal or customer not found" };
      }

      await integrationLogger.logSuccess(
        "WORKFLOW_STATUS",
        "RETRY_STARTED",
        { dealId, step }
      );

      if (step === "invoice") {
        // Retry invoice creation
        await quickbooksService.initialize();

        const qbCustomer = await quickbooksService.getOrCreateCustomer({
          email: deal.customer.email,
          name: deal.customer.name,
          phone: deal.customer.phone || undefined,
        });

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        const qbInvoice = await quickbooksService.createInvoiceWithBillEmail({
          customerId: qbCustomer.Id,
          customerEmail: deal.customer.email,
          dueDate,
          lineItems: [
            {
              description: `Invoice for Deal ${deal.title}`,
              amount: Number(deal.value),
            },
          ],
        });

        // Save invoice to database
        await prisma.invoice.create({
          data: {
            dealId: deal.id,
            customerId: deal.customer.id,
            invoiceNumber: `QB-${qbInvoice.DocNumber}`,
            amount: deal.value,
            dueDate,
            status: "SENT",
            quickbooks_invoice_id: qbInvoice.Id,
            ...(extractQuickbooksInvoiceLink(qbInvoice) ? { quickbooks_invoice_link: extractQuickbooksInvoiceLink(qbInvoice) } : {}),
          },
        });

        // Send invoice via email (critical - creation alone doesn't send)
        if (deal.customer.email) {
          await quickbooksService.sendInvoice(qbInvoice.Id, deal.customer.email);
        }

        await this.markInvoiceCreated(dealId);

        return { success: true, message: "Invoice retry successful" };
      } else if (step === "contract") {
        // Retry contract generation
        const documentBase64 = Buffer.from("PDF_CONTENT_PLACEHOLDER").toString(
          "base64"
        );

        const envelope = await docusignService.createEnvelope({
          signerEmail: deal.customer.email,
          signerName: deal.customer.name,
          documentBase64,
          documentName: `Contract-${deal.id}.pdf`,
          subject: "Contrato de Serviços - Carreira USA",
          emailBlurb: "Por favor, revise e assine o contrato anexado.",
        });

        // Save contract to database
        await prisma.contract.create({
          data: {
            dealId: deal.id,
            customerId: deal.customer.id,
            docusign_env_id: envelope.envelopeId,
            status: "SENT_FOR_SIGNATURE",
            sentAt: new Date(),
            signerEmail: deal.customer.email,
            signerName: deal.customer.name,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });

        await this.markContractSent(dealId);

        return { success: true, message: "Contract retry successful" };
      }

      return { success: false, message: "Invalid step specified" };
    } catch (error) {
      await integrationLogger.logError(
        "WORKFLOW_STATUS",
        "RETRY_FAILED",
        error instanceof Error ? error : new Error(String(error)),
        { dealId, step }
      );

      return {
        success: false,
        message: error instanceof Error ? error.message : "Retry failed",
      };
    }
  }
}

export const workflowStatusService = new WorkflowStatusService();
