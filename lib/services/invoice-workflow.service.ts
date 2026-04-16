import { prisma } from "@/lib/db";
import { quickbooksService } from "./quickbooks.service";
import { docusignService } from "./docusign.service";
import { identityMapper } from "./identity-mapper";
import { workflowStatusService } from "./workflow-status.service";
import { financeService } from "./finance.service";
import { integrationLogger } from "@/lib/utils/logger";
import { InvoiceStatus, ContractStatus } from "@prisma/client";

/**
 * Invoice Workflow Service
 *
 * Responsabilidade: Orquestrar workflow completo de fechamento de deal
 * Deal Won → Create Invoice (QuickBooks) → Generate Contract (DocuSign)
 *
 * Sprint 1 Focus: QuickBooks + DocuSign
 */
export class InvoiceWorkflowService {
  /**
   * Processar workflow completo de fechamento
   * Sprint 1: QuickBooks Invoice + DocuSign Contract
   */
  async processDealWon(dealId: string): Promise<{
    contractId?: string;
    invoiceIds: string[];
    success: boolean;
  }> {
    try {
      await integrationLogger.logSuccess(
        "WORKFLOW",
        "PROCESS_DEAL_WON_START",
        { dealId }
      );

      // Set workflow status to IN_PROGRESS
      await workflowStatusService.updateWorkflowStatus(
        dealId,
        "IN_PROGRESS"
      );

      // 1. Buscar Deal e Customer
      const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        include: {
          customer: true,
        },
      });

      if (!deal || !deal.customer) {
        throw new Error("Deal or customer not found");
      }

      if (deal.status !== "WON") {
        throw new Error("Deal is not won");
      }

      let customer = deal.customer;

      // 2. Reconcile customer via Identity Mapper
      // Ensures QuickBooks and DocuSign IDs are populated
      try {
        customer = await identityMapper.reconcileCustomer({
          email: customer.email,
          name: customer.name,
          phone: customer.phone || undefined,
          ssn: customer.ssn || undefined,
          address: customer.address || undefined,
          city: customer.city || undefined,
          state: customer.state || undefined,
          zipCode: customer.zipCode || undefined,
          country: customer.country || undefined,
          externalIds: {
            quickbooks_id: customer.quickbooks_id || undefined,
          },
        });

        await integrationLogger.logSuccess(
          "WORKFLOW",
          "CUSTOMER_RECONCILED",
          { dealId, customerId: customer.id }
        );
      } catch (error) {
        await integrationLogger.logError(
          "WORKFLOW",
          "CUSTOMER_RECONCILIATION_FAILED",
          error instanceof Error ? error : new Error(String(error)),
          { dealId }
        );
        // Continue workflow even if reconciliation fails
      }

      // 3. Create Invoice in QuickBooks (with retry logic)
      const invoiceIds: string[] = [];
      const maxRetries = 3;
      let qbInvoiceId: string | undefined;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          qbInvoiceId = await this.createQuickbooksInvoice(
            dealId,
            customer.id,
            Number(deal.value),
            deal.currency
          );
          invoiceIds.push(qbInvoiceId);

          await integrationLogger.logSuccess(
            "WORKFLOW",
            "INVOICE_CREATED",
            { dealId, invoiceId: qbInvoiceId, attempt }
          );

          // Mark invoice as created
          await workflowStatusService.markInvoiceCreated(dealId);

          break; // Success, exit retry loop
        } catch (error) {
          const isLastAttempt = attempt === maxRetries;
          await integrationLogger.logError(
            "WORKFLOW",
            isLastAttempt ? "INVOICE_CREATION_FAILED" : "INVOICE_CREATION_RETRY",
            error instanceof Error ? error : new Error(String(error)),
            { dealId, attempt, maxRetries }
          );

          if (!isLastAttempt) {
            // Exponential backoff: 1s, 2s, 4s
            const delayMs = Math.pow(2, attempt - 1) * 1000;
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
          // Continue even if invoice fails after all retries
        }
      }

      // 4. Generate Contract via DocuSign
      let contractId: string | undefined;
      try {
        contractId = await this.generateContract(dealId, customer.id, {
          email: customer.email,
          name: customer.name,
        });

        await integrationLogger.logSuccess(
          "WORKFLOW",
          "CONTRACT_SENT",
          { dealId, contractId }
        );

        // Mark contract as sent
        await workflowStatusService.markContractSent(dealId);
      } catch (error) {
        await integrationLogger.logError(
          "WORKFLOW",
          "CONTRACT_GENERATION_FAILED",
          error instanceof Error ? error : new Error(String(error)),
          { dealId }
        );
        // Mark contract as FAILED but continue
        // Finance team can manually resend via dashboard
      }

      await integrationLogger.logSuccess(
        "WORKFLOW",
        "PROCESS_DEAL_WON_COMPLETE",
        {
          dealId,
          invoiceCount: invoiceIds.length,
          hasContract: !!contractId,
        }
      );

      // Mark workflow as complete
      await workflowStatusService.updateWorkflowStatus(dealId, "COMPLETED");

      return {
        contractId,
        invoiceIds,
        success: invoiceIds.length > 0 || !!contractId,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await integrationLogger.logError(
        "WORKFLOW",
        "PROCESS_DEAL_WON_FAILED",
        error instanceof Error ? error : new Error(String(error)),
        { dealId }
      );

      // Mark workflow as failed
      await workflowStatusService.updateWorkflowStatus(
        dealId,
        "FAILED",
        errorMessage
      );

      throw error;
    }
  }

  /**
   * Gerar contrato via DocuSign
   */
  private async generateContract(
    dealId: string,
    customerId: string,
    customerData: { email: string; name: string }
  ): Promise<string> {
    // TODO: Gerar PDF do contrato baseado em template
    // Por enquanto, criar envelope vazio (em produção, precisa gerar PDF)
    const documentBase64 = Buffer.from("PDF_CONTENT_PLACEHOLDER").toString("base64");

    const envelope = await docusignService.createEnvelope({
      signerEmail: customerData.email,
      signerName: customerData.name,
      documentBase64,
      documentName: `Contract-${dealId}.pdf`,
      subject: "Contrato de Serviços - Carreira USA",
      emailBlurb: "Por favor, revise e assine o contrato anexado.",
    });

    // Salvar contrato no banco
    const contract = await prisma.contract.create({
      data: {
        dealId,
        customerId,
        docusign_env_id: envelope.envelopeId,
        status: ContractStatus.SENT_FOR_SIGNATURE,
        sentAt: new Date(),
        signerEmail: customerData.email,
        signerName: customerData.name,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      },
    });

    return contract.id;
  }

  /**
   * Create invoice in QuickBooks
   * QuickBooks only
   */
  private async createQuickbooksInvoice(
    dealId: string,
    customerId: string,
    amount: number,
    currency: string
  ): Promise<string> {
    // Buscar customer no banco
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new Error("Customer not found");
    }

    // Buscar ou criar customer no Quickbooks
    const qbCustomer = await quickbooksService.getOrCreateCustomer({
      email: customer.email,
      name: customer.name,
      phone: customer.phone || undefined,
    });

    // Atualizar customer com Quickbooks ID
    if (!customer.quickbooks_id) {
      await prisma.customer.update({
        where: { id: customerId },
        data: { quickbooks_id: qbCustomer.Id },
      });
    }

    // Criar invoice
    const invoiceNumber = financeService.generateInvoiceNumber("QB");
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const qbInvoice = await quickbooksService.createInvoiceWithBillEmail({
      customerId: qbCustomer.Id,
      customerEmail: customer.email,
      dueDate,
      lineItems: [
        {
          description: `Invoice for Deal ${dealId}`,
          amount: amount,
        },
      ],
    });

    // Salvar invoice no banco
    const invoice = await prisma.invoice.create({
      data: {
        dealId,
        customerId,
        invoiceNumber,
        amount,
        dueDate,
        status: InvoiceStatus.SENT,
        quickbooks_invoice_id: qbInvoice.Id,
      },
    });

    // **REALTIME SYNC**: Immediately sync invoice back from QuickBooks
    try {
      const { quickbooksSyncService } = await import('@/lib/services/quickbooks-sync.service');
      await quickbooksSyncService.syncSingleInvoice(qbInvoice.Id);
      console.log(`[INVOICE_WORKFLOW] Invoice ${qbInvoice.Id} synced from QuickBooks`);
    } catch (syncError) {
      console.error(`[INVOICE_WORKFLOW] Failed to sync invoice ${qbInvoice.Id} from QuickBooks:`, syncError);
      // Don't fail invoice creation if sync fails - cron will catch it later
    }

    // Enviar invoice por email
    if (customer.email) {
      await quickbooksService.sendInvoice(qbInvoice.Id, customer.email);

      // Trigger contract workflow with delay (fire-and-forget)
      // This spawns async work, doesn't block response
      const { contractWorkflowService } = await import('@/lib/services/contract-workflow.service');
      contractWorkflowService.triggerContractAfterDelay(invoice.id, 7).catch(err => {
        console.error('[INVOICE_WORKFLOW] Failed to schedule contract generation:', err);
        // Don't fail invoice send if contract scheduling fails
        // Finance team can manually trigger contract via UI if needed
      });
    }


    return invoice.id;
  }

}

export const invoiceWorkflowService = new InvoiceWorkflowService();

