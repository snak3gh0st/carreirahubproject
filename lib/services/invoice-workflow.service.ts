import { prisma } from "@/lib/db";
import { stripeService } from "./stripe.service";
import { quickbooksService } from "./quickbooks.service";
import { docusignService } from "./docusign.service";
import { financeService } from "./finance.service";
import { integrationLogger } from "@/lib/utils/logger";
import { InvoiceStatus, ContractStatus } from "@prisma/client";

/**
 * Invoice Workflow Service
 * 
 * Responsabilidade: Orquestrar workflow completo de fechamento de deal
 * Deal Won → Gerar Contrato (DocuSign) → Criar Fatura (Stripe/Quickbooks) → Liberar LMS
 */
export class InvoiceWorkflowService {
  /**
   * Processar workflow completo de fechamento
   */
  async processDealWon(dealId: string): Promise<{
    contractId?: string;
    invoiceIds: string[];
    success: boolean;
  }> {
    try {
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

      const customer = deal.customer;

      // 2. Gerar Contrato (DocuSign)
      let contractId: string | undefined;
      try {
        contractId = await this.generateContract(dealId, customer.id, {
          email: customer.email,
          name: customer.name,
        });

        await integrationLogger.logSuccess(
          "INVOICE_WORKFLOW",
          "CONTRACT_GENERATED",
          { dealId, contractId }
        );
      } catch (error) {
        await integrationLogger.logError(
          "INVOICE_WORKFLOW",
          "CONTRACT_GENERATION_FAILED",
          error instanceof Error ? error : new Error(String(error)),
          { dealId }
        );
        // Continuar mesmo se contrato falhar
      }

      // 3. Criar Faturas (Stripe e Quickbooks)
      const invoiceIds: string[] = [];

      // 3.1 Stripe Invoice
      try {
        const stripeInvoiceId = await this.createStripeInvoice(
          dealId,
          customer.id,
          Number(deal.value),
          deal.currency
        );
        invoiceIds.push(stripeInvoiceId);

        await integrationLogger.logSuccess(
          "INVOICE_WORKFLOW",
          "STRIPE_INVOICE_CREATED",
          { dealId, invoiceId: stripeInvoiceId }
        );
      } catch (error) {
        await integrationLogger.logError(
          "INVOICE_WORKFLOW",
          "STRIPE_INVOICE_FAILED",
          error instanceof Error ? error : new Error(String(error)),
          { dealId }
        );
      }

      // 3.2 Quickbooks Invoice
      try {
        const quickbooksInvoiceId = await this.createQuickbooksInvoice(
          dealId,
          customer.id,
          Number(deal.value),
          deal.currency
        );
        invoiceIds.push(quickbooksInvoiceId);

        await integrationLogger.logSuccess(
          "INVOICE_WORKFLOW",
          "QUICKBOOKS_INVOICE_CREATED",
          { dealId, invoiceId: quickbooksInvoiceId }
        );
      } catch (error) {
        await integrationLogger.logError(
          "INVOICE_WORKFLOW",
          "QUICKBOOKS_INVOICE_FAILED",
          error instanceof Error ? error : new Error(String(error)),
          { dealId }
        );
      }

      // 4. Liberar LMS (TODO: Implementar quando LMS API estiver disponível)
      try {
        await this.releaseLMSAccess(customer.id, dealId);
        await integrationLogger.logSuccess(
          "INVOICE_WORKFLOW",
          "LMS_ACCESS_RELEASED",
          { dealId, customerId: customer.id }
        );
      } catch (error) {
        await integrationLogger.logError(
          "INVOICE_WORKFLOW",
          "LMS_ACCESS_FAILED",
          error instanceof Error ? error : new Error(String(error)),
          { dealId }
        );
      }

      return {
        contractId,
        invoiceIds,
        success: invoiceIds.length > 0,
      };
    } catch (error) {
      await integrationLogger.logError(
        "INVOICE_WORKFLOW",
        "PROCESS_DEAL_WON_FAILED",
        error instanceof Error ? error : new Error(String(error)),
        { dealId }
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
   * Criar invoice no Stripe
   */
  private async createStripeInvoice(
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

    // Buscar ou criar customer no Stripe
    const stripeCustomer = await stripeService.getOrCreateCustomer({
      email: customer.email,
      name: customer.name,
      phone: customer.phone || undefined,
      metadata: {
        customer_id: customer.id,
        deal_id: dealId,
      },
    });

    // Atualizar customer com Stripe ID
    if (stripeCustomer && !customer.stripe_id) {
      await prisma.customer.update({
        where: { id: customerId },
        data: { stripe_id: stripeCustomer.id },
      });
    }

    // Criar invoice
    const invoiceNumber = financeService.generateInvoiceNumber("INV");
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // 30 dias para pagamento

    if (!stripeCustomer) {
      // Circuit breaker is open, create invoice without Stripe integration
      console.warn("[InvoiceWorkflow] Stripe circuit breaker is open, creating invoice without Stripe");
      const invoice = await prisma.invoice.create({
        data: {
          dealId,
          customerId,
          invoiceNumber,
          amount,
          dueDate,
          status: InvoiceStatus.DRAFT,
        },
      });
      return invoice.id;
    }

    const stripeInvoice = await stripeService.createInvoice({
      customerId: stripeCustomer.id,
      amount,
      currency: currency.toLowerCase(),
      description: `Invoice for Deal ${dealId}`,
      dueDate,
      metadata: {
        deal_id: dealId,
        invoice_number: invoiceNumber,
      },
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
        stripe_invoice_id: stripeInvoice?.id || undefined,
      },
    });

    // Enviar invoice por email
    if (stripeInvoice) {
      await stripeService.sendInvoice(stripeInvoice.id);
    }

    return invoice.id;
  }

  /**
   * Criar invoice no Quickbooks
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

    const qbInvoice = await quickbooksService.createInvoice({
      customerId: qbCustomer.Id,
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

    // Enviar invoice por email
    if (customer.email) {
      await quickbooksService.sendInvoice(qbInvoice.Id, customer.email);
    }

    return invoice.id;
  }

  /**
   * Liberar acesso ao LMS
   */
  private async releaseLMSAccess(customerId: string, dealId: string): Promise<void> {
    // TODO: Implementar integração com LMS quando API estiver disponível
    // Por enquanto, apenas logar
    console.log(`[LMS] Releasing access for customer ${customerId}, deal ${dealId}`);
    
    // Exemplo de implementação:
    // await lmsService.createStudent({
    //   customerId,
    //   dealId,
    //   accessLevel: "full",
    // });
  }
}

export const invoiceWorkflowService = new InvoiceWorkflowService();

