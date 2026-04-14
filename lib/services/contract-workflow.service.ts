import { prisma } from '@/lib/db';
import { docusignService, validateCustomerForContract } from './docusign.service';
import { notificationService } from './notification.service';
import { ContractStatus } from '@prisma/client';

interface Invoice {
  id: string;
  invoiceNumber: string | null;
  amount: any;
  dueDate: Date;
  deal?: {
    id: string;
    title: string;
  } | null;
  customer: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    cpf?: string | null;
    passport?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    country?: string | null;
    ssn?: string | null;
  };
}

/**
 * Contract Workflow Service
 *
 * Orchestrates the contract signing workflow:
 * 1. Send contract after invoice approval
 * 2. Track signature status
 * 3. Send reminders at 3 and 7 days
 * 4. Expire contracts after 30 days
 * 5. Handle signed/declined/expired states
 */
export class ContractWorkflowService {
  /**
   * Send contract for signature after invoice approval
   * Main entry point for the contract workflow
   */
  async sendContractOnApproval(invoice: Invoice): Promise<any> {
    try {
      console.log(`[CONTRACT_WORKFLOW] Starting contract workflow for invoice ${invoice.id}`);

      // Validate customer has required fields for contract
      const missingFields = validateCustomerForContract(invoice.customer as any);
      if (missingFields.length > 0) {
        const fieldNames = missingFields.map(f => f.label).join(', ');
        console.warn(`[CONTRACT_WORKFLOW] Customer ${invoice.customer.id} missing required fields: ${fieldNames}. Contract will be created as DRAFT.`);

        // Create contract in DRAFT status - cannot send without complete data
        const draftContract = await prisma.contract.create({
          data: {
            status: ContractStatus.DRAFT,
            signerEmail: invoice.customer.email,
            signerName: invoice.customer.name,
            dealId: invoice.deal?.id || '',
            customerId: invoice.customer.id,
            reminderCount: 0,
          },
        });

        // Link all invoices in the series to this contract
        const seriesInvoiceIds = await this.getSeriesInvoiceIds(invoice.id);
        await prisma.invoice.updateMany({
          where: { id: { in: seriesInvoiceIds } },
          data: { contractId: draftContract.id },
        });

        console.log(`[CONTRACT_WORKFLOW] Contract ${draftContract.id} saved as DRAFT - waiting for customer data completion`);

        // Log the blocked contract for visibility
        await prisma.integrationLog.create({
          data: {
            service: 'DOCUSIGN',
            action: 'CONTRACT_BLOCKED_MISSING_DATA',
            status: 'WARNING',
            payload: {
              contractId: draftContract.id,
              customerId: invoice.customer.id,
              customerName: invoice.customer.name,
              invoiceId: invoice.id,
              missingFields: missingFields.map(f => f.field),
            },
            error: `Contrato bloqueado - dados faltando: ${fieldNames}`,
          },
        });

        return draftContract;
      }

      // Create contract record in database (status: DRAFT)
      const contract = await prisma.contract.create({
        data: {
          status: ContractStatus.DRAFT,
          signerEmail: invoice.customer.email,
          signerName: invoice.customer.name,
          dealId: invoice.deal?.id || '',
          customerId: invoice.customer.id,
          reminderCount: 0,
        },
      });

      // Link all invoices in the series to this contract
      const seriesInvoiceIds = await this.getSeriesInvoiceIds(invoice.id);
      await prisma.invoice.updateMany({
        where: { id: { in: seriesInvoiceIds } },
        data: { contractId: contract.id },
      });

      console.log(`[CONTRACT_WORKFLOW] Contract record created: ${contract.id}`);

      // Generate and send contract via DocuSign (using program-specific template)
      const envelopeId = await docusignService.createEnvelopeFromTemplate(
        {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.amount,
          dueDate: invoice.dueDate,
          deal: invoice.deal,
          lineItems: (invoice as any).lineItems || null,
        },
        {
          id: invoice.customer.id,
          name: invoice.customer.name,
          email: invoice.customer.email,
          phone: invoice.customer.phone,
          cpf: invoice.customer.cpf,
          passport: invoice.customer.passport,
          address: invoice.customer.address,
          city: invoice.customer.city,
          state: invoice.customer.state,
          zipCode: invoice.customer.zipCode,
          country: invoice.customer.country,
          ssn: invoice.customer.ssn,
        }
      );

      console.log(`[CONTRACT_WORKFLOW] DocuSign envelope created: ${envelopeId}`);

      // Update contract with DocuSign envelope ID and status
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      const updatedContract = await prisma.contract.update({
        where: { id: contract.id },
        data: {
          docusign_env_id: envelopeId,
          status: ContractStatus.SENT_FOR_SIGNATURE,
          sentAt: now,
          expiresAt: expiresAt,
        },
      });

      console.log(`[CONTRACT_WORKFLOW] Contract status updated to SENT_FOR_SIGNATURE`);

      // Send email notification to client
      await notificationService.sendContractForSignature(
        {
          id: updatedContract.id,
          docusign_env_id: envelopeId,
          status: ContractStatus.SENT_FOR_SIGNATURE,
          signedUrl: null,
          sentAt: now,
          expiresAt: expiresAt,
          reminderCount: 0,
          signerEmail: invoice.customer.email,
          signerName: invoice.customer.name,
        },
        invoice.customer,
        invoice.invoiceNumber || invoice.id
      );

      console.log(`[CONTRACT_WORKFLOW] Contract signature notification sent to ${invoice.customer.email}`);

      return updatedContract;

    } catch (error) {
      console.error(`[CONTRACT_WORKFLOW] Failed to send contract for invoice ${invoice.id}:`, error);
      throw new Error('Failed to send contract: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Handle contract signed event (triggered by DocuSign webhook)
   */
  async handleContractSigned(contractId: string): Promise<void> {
    try {
      console.log(`[CONTRACT_WORKFLOW] Processing signed contract: ${contractId}`);

      // Get contract with relations
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        include: {
          customer: true,
          invoices: true,
        },
      });

      if (!contract) {
        throw new Error(`Contract ${contractId} not found`);
      }

      // Update contract status
      const updatedContract = await prisma.contract.update({
        where: { id: contractId },
        data: {
          status: ContractStatus.SIGNED,
          signedAt: new Date(),
        },
      });

      console.log(`[CONTRACT_WORKFLOW] Contract ${contractId} marked as SIGNED`);

      // Download signed document from DocuSign
      if (contract.docusign_env_id) {
        try {
          const documents = await docusignService.getEnvelopeDocuments(contract.docusign_env_id);
          if (documents.length > 0) {
            // Store the signed document URL (DocuSign provides a URI)
            await prisma.contract.update({
              where: { id: contractId },
              data: {
                signedUrl: documents[0].uri,
              },
            });
            console.log(`[CONTRACT_WORKFLOW] Signed document URL stored`);
          }
        } catch (error) {
          console.error(`[CONTRACT_WORKFLOW] Failed to get signed document:`, error);
          // Don't fail the workflow if we can't get the document
        }
      }

      // Send notification to finance team
      await notificationService.sendContractSigned(
        {
          id: updatedContract.id,
          docusign_env_id: updatedContract.docusign_env_id,
          status: ContractStatus.SIGNED,
          signedUrl: updatedContract.signedUrl,
          sentAt: updatedContract.sentAt,
          expiresAt: updatedContract.expiresAt,
          reminderCount: updatedContract.reminderCount,
          signerEmail: updatedContract.signerEmail,
          signerName: updatedContract.signerName,
        },
        contract.customer
      );

      console.log(`[CONTRACT_WORKFLOW] Contract signed notification sent to finance team`);

      // Note: Payment workflow will be triggered separately by the payment workflow service

    } catch (error) {
      console.error(`[CONTRACT_WORKFLOW] Failed to handle signed contract ${contractId}:`, error);
      throw error;
    }
  }

  /**
   * Handle contract declined event (triggered by DocuSign webhook)
   */
  async handleContractDeclined(contractId: string): Promise<void> {
    try {
      console.log(`[CONTRACT_WORKFLOW] Processing declined contract: ${contractId}`);

      // Get contract with relations
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        include: {
          customer: true,
          invoices: true,
        },
      });

      if (!contract) {
        throw new Error(`Contract ${contractId} not found`);
      }

      // Update contract status
      await prisma.contract.update({
        where: { id: contractId },
        data: {
          status: ContractStatus.DECLINED,
          declinedAt: new Date(),
        },
      });

      console.log(`[CONTRACT_WORKFLOW] Contract ${contractId} marked as DECLINED`);

      // Void ALL linked invoices
      if (contract.invoices && contract.invoices.length > 0) {
        await prisma.invoice.updateMany({
          where: { contractId: contractId },
          data: { status: 'VOID' },
        });
        console.log(`[CONTRACT_WORKFLOW] ${contract.invoices.length} invoice(s) marked as VOID`);
      }

      // Notification will be sent by webhook handler or manually

    } catch (error) {
      console.error(`[CONTRACT_WORKFLOW] Failed to handle declined contract ${contractId}:`, error);
      throw error;
    }
  }

  /**
   * Handle contract expired (30 days without signature)
   */
  async handleContractExpired(contractId: string): Promise<void> {
    try {
      console.log(`[CONTRACT_WORKFLOW] Processing expired contract: ${contractId}`);

      // Get contract with relations
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        include: {
          customer: true,
          invoices: true,
        },
      });

      if (!contract) {
        throw new Error(`Contract ${contractId} not found`);
      }

      // Update contract status
      await prisma.contract.update({
        where: { id: contractId },
        data: {
          status: ContractStatus.EXPIRED,
          voidedAt: new Date(),
        },
      });

      console.log(`[CONTRACT_WORKFLOW] Contract ${contractId} marked as EXPIRED`);

      // Void the envelope in DocuSign
      if (contract.docusign_env_id) {
        try {
          await docusignService.voidExpiredEnvelope(contract.docusign_env_id);
          console.log(`[CONTRACT_WORKFLOW] DocuSign envelope voided: ${contract.docusign_env_id}`);
        } catch (error) {
          console.error(`[CONTRACT_WORKFLOW] Failed to void DocuSign envelope:`, error);
          // Don't fail the workflow
        }
      }

      // Void ALL linked invoices
      if (contract.invoices && contract.invoices.length > 0) {
        await prisma.invoice.updateMany({
          where: { contractId: contractId },
          data: { status: 'VOID' },
        });
        console.log(`[CONTRACT_WORKFLOW] ${contract.invoices.length} invoice(s) marked as VOID`);
      }

      // Send expiration notification to finance team
      await notificationService.sendContractExpired(
        {
          id: contract.id,
          docusign_env_id: contract.docusign_env_id,
          status: ContractStatus.EXPIRED,
          signedUrl: contract.signedUrl,
          sentAt: contract.sentAt,
          expiresAt: contract.expiresAt,
          reminderCount: contract.reminderCount,
          signerEmail: contract.signerEmail,
          signerName: contract.signerName,
        },
        contract.customer
      );

      console.log(`[CONTRACT_WORKFLOW] Contract expiration notification sent to finance team`);

    } catch (error) {
      console.error(`[CONTRACT_WORKFLOW] Failed to handle expired contract ${contractId}:`, error);
      throw error;
    }
  }

  /**
   * Check for expired contracts and mark them as expired
   * Called by cron job daily
   */
  async checkExpiredContracts(): Promise<{ expired: number; errors: number }> {
    try {
      console.log(`[CONTRACT_WORKFLOW] Checking for expired contracts...`);

      const now = new Date();

      // Find contracts that are expired (expiresAt < now)
      const expiredContracts = await prisma.contract.findMany({
        where: {
          status: ContractStatus.SENT_FOR_SIGNATURE,
          expiresAt: { lt: now },
        },
        include: {
          customer: true,
          invoices: true,
        },
      });

      console.log(`[CONTRACT_WORKFLOW] Found ${expiredContracts.length} expired contracts`);

      let expired = 0;
      let errors = 0;

      for (const contract of expiredContracts) {
        try {
          await this.handleContractExpired(contract.id);
          expired++;
        } catch (error) {
          console.error(`[CONTRACT_WORKFLOW] Failed to expire contract ${contract.id}:`, error);
          errors++;
        }
      }

      console.log(`[CONTRACT_WORKFLOW] Expiration check complete: ${expired} expired, ${errors} errors`);

      return { expired, errors };

    } catch (error) {
      console.error(`[CONTRACT_WORKFLOW] Failed to check expired contracts:`, error);
      throw error;
    }
  }

  /**
   * Detect if this is the first invoice for this customer in this invoice series
   * 
   * Invoice series examples:
   * - "JD-2026-01-001" -> series prefix "JD" (customer initials)
   * - "AB-2026-01-001" -> series prefix "AB"
   * 
   * First invoice: invoice number ends in -001 (first in series)
   */
  async isFirstInvoiceInSeries(invoiceId: string): Promise<{
    isFirst: boolean;
    seriesPrefix: string | null;
    existingContract: any | null;
  }> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true }
    });
    
    if (!invoice || !invoice.invoiceNumber) {
      return { isFirst: false, seriesPrefix: null, existingContract: null };
    }
    
    // Extract series prefix from invoice number (e.g., "JD-2026-01-001" -> "JD")
    const match = invoice.invoiceNumber.match(/^([A-Z]+)-/);
    const seriesPrefix = match ? match[1] : null;
    
    if (!seriesPrefix) {
      console.log(`[CONTRACT_WORKFLOW] No series prefix detected in invoice number: ${invoice.invoiceNumber}`);
      return { isFirst: false, seriesPrefix: null, existingContract: null };
    }
    
    // Check if invoice number ends with -001 (first invoice)
    const isFirst = invoice.invoiceNumber.endsWith('-001');
    
    if (!isFirst) {
      console.log(`[CONTRACT_WORKFLOW] Not first invoice in series (${invoice.invoiceNumber})`);
      return { isFirst: false, seriesPrefix, existingContract: null };
    }
    
    // Check if customer already has contract for this series
    const invoicesInSeries = await prisma.invoice.findMany({
      where: {
        customerId: invoice.customerId,
        invoiceNumber: { startsWith: `${seriesPrefix}-` }
      },
      select: { id: true }
    });
    
    const existingContract = await prisma.contract.findFirst({
      where: {
        customerId: invoice.customerId,
        invoices: {
          some: {
            id: { in: invoicesInSeries.map(i => i.id) }
          }
        }
      }
    });
    
    if (existingContract) {
      console.log(`[CONTRACT_WORKFLOW] Customer already has contract for series ${seriesPrefix}: ${existingContract.id}`);
    }
    
    return { isFirst: true, seriesPrefix, existingContract };
  }

  /**
   * Get all invoice IDs in the same series as the given invoice.
   * If the invoice has a seriesId, returns all invoices in that series.
   * Otherwise returns just the single invoice ID.
   */
  async getSeriesInvoiceIds(invoiceId: string): Promise<string[]> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, installments: true, customerId: true },
    });

    if (!invoice) return [invoiceId];

    const installmentData = invoice.installments as any;
    if (installmentData?.seriesId) {
      const seriesInvoices = await prisma.invoice.findMany({
        where: {
          customerId: invoice.customerId,
          installments: { path: ['seriesId'], equals: installmentData.seriesId },
        },
        select: { id: true },
      });
      return seriesInvoices.map(i => i.id);
    }

    return [invoiceId];
  }

  /**
   * Trigger contract generation after 5-10 minute delay
   * Only for first invoice in series, with duplicate prevention
   * 
   * MVP Implementation: Uses setTimeout (7 minutes)
   * Production Note: setTimeout may not be reliable in Vercel serverless (10s timeout)
   * Future production hardening: Use Vercel Cron + database flag or BullMQ queue
   */
  async triggerContractAfterDelay(invoiceId: string, delayMinutes: number = 7): Promise<void> {
    console.log(`[CONTRACT_WORKFLOW] Scheduling contract generation for invoice ${invoiceId} in ${delayMinutes} minutes`);
    
    // Use setTimeout for delay (MVP approach)
    // Better approach for production: Use Vercel Cron or external queue
    setTimeout(async () => {
      try {
        console.log(`[CONTRACT_WORKFLOW] Delay complete, checking if contract should be generated for invoice ${invoiceId}`);
        
        // Check if this is first invoice and no existing contract
        const { isFirst, seriesPrefix, existingContract } = await this.isFirstInvoiceInSeries(invoiceId);
        
        if (!isFirst) {
          console.log(`[CONTRACT_WORKFLOW] Skipping contract - not first invoice in series`);
          return;
        }
        
        if (existingContract) {
          console.log(`[CONTRACT_WORKFLOW] Skipping contract - customer already has contract for series ${seriesPrefix}`);
          
          // TODO: Alert commercial team about duplicate attempt
          // await notificationService.alertCommercialTeam({
          //   type: 'DUPLICATE_CONTRACT_ATTEMPT',
          //   invoiceId,
          //   existingContractId: existingContract.id,
          //   seriesPrefix
          // });
          
          return;
        }
        
        // All checks passed - generate contract
        console.log(`[CONTRACT_WORKFLOW] Generating contract for first invoice ${invoiceId} in series ${seriesPrefix}`);
        
        const invoice = await prisma.invoice.findUnique({
          where: { id: invoiceId },
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                cpf: true,
                passport: true,
                address: true,
                city: true,
                state: true,
                zipCode: true,
                country: true,
                ssn: true,
              },
            },
            deal: true
          }
        });
        
        if (!invoice) {
          console.error(`[CONTRACT_WORKFLOW] Invoice ${invoiceId} not found`);
          return;
        }
        
        // Generate and send contract
        await this.sendContractOnApproval(invoice as any);
        
        console.log(`[CONTRACT_WORKFLOW] Contract sent successfully for invoice ${invoiceId}`);
        
      } catch (error) {
        console.error(`[CONTRACT_WORKFLOW] Failed to generate contract after delay:`, error);
        
        // Don't throw - invoice is already sent, just log error
        // Finance team can manually retry contract generation
        const { integrationLogger } = await import("@/lib/utils/logger");
        await integrationLogger.logError(
          'contract-workflow',
          'delayed_contract_generation',
          error as Error,
          { 
            errorCode: "DELAYED_CONTRACT_FAILED",
            category: "unknown",
          },
          { invoiceId }
        );
      }
    }, delayMinutes * 60 * 1000);
    
    console.log(`[CONTRACT_WORKFLOW] Contract generation scheduled`);
  }

  /**
   * Get contract status by ID
   */
  async getContractStatus(contractId: string): Promise<any> {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        customer: true,
        invoices: true,
      },
    });

    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    // If contract has DocuSign envelope ID, get latest status from DocuSign
    if (contract.docusign_env_id) {
      try {
        const docusignStatus = await docusignService.getEnvelopeStatus(contract.docusign_env_id);
        console.log(`[CONTRACT_WORKFLOW] DocuSign status for ${contractId}: ${docusignStatus.status}`);
      } catch (error) {
        console.error(`[CONTRACT_WORKFLOW] Failed to get DocuSign status:`, error);
        // Continue with database status
      }
    }

    return contract;
  }
}

export const contractWorkflowService = new ContractWorkflowService();
