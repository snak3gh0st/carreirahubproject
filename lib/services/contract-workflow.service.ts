import { prisma } from '@/lib/db';
import { docusignService } from './docusign.service';
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

      // Create contract record in database (status: DRAFT)
      const contract = await prisma.contract.create({
        data: {
          status: ContractStatus.DRAFT,
          signerEmail: invoice.customer.email,
          signerName: invoice.customer.name,
          dealId: invoice.deal?.id || '',
          customerId: invoice.customer.id,
          invoiceId: invoice.id,
          reminderCount: 0,
        },
      });

      console.log(`[CONTRACT_WORKFLOW] Contract record created: ${contract.id}`);

      // Generate and send contract via DocuSign
      const envelopeId = await docusignService.createEnvelopeFromInvoice(
        {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.amount,
          dueDate: invoice.dueDate,
          deal: invoice.deal,
        },
        {
          id: invoice.customer.id,
          name: invoice.customer.name,
          email: invoice.customer.email,
          phone: invoice.customer.phone,
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
          invoice: true,
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
          invoice: true,
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

      // Update invoice status to VOID
      if (contract.invoiceId) {
        await prisma.invoice.update({
          where: { id: contract.invoiceId },
          data: {
            status: 'VOID',
          },
        });
        console.log(`[CONTRACT_WORKFLOW] Invoice ${contract.invoiceId} marked as VOID`);
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
          invoice: true,
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

      // Update invoice status to VOID
      if (contract.invoiceId) {
        await prisma.invoice.update({
          where: { id: contract.invoiceId },
          data: {
            status: 'VOID',
          },
        });
        console.log(`[CONTRACT_WORKFLOW] Invoice ${contract.invoiceId} marked as VOID`);
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
   * Send reminder for a specific contract
   */
  async sendReminderForContract(contract: any): Promise<void> {
    try {
      console.log(`[CONTRACT_WORKFLOW] Sending reminder for contract ${contract.id}`);

      // Send reminder email
      await notificationService.sendContractReminder(
        {
          id: contract.id,
          docusign_env_id: contract.docusign_env_id,
          status: contract.status,
          signedUrl: contract.signedUrl,
          sentAt: contract.sentAt,
          expiresAt: contract.expiresAt,
          reminderCount: contract.reminderCount,
          signerEmail: contract.signerEmail,
          signerName: contract.signerName,
        },
        contract.customer,
        contract.invoice?.invoiceNumber || contract.invoiceId
      );

      // Update reminder count and timestamp
      await prisma.contract.update({
        where: { id: contract.id },
        data: {
          reminderCount: contract.reminderCount + 1,
          lastReminderAt: new Date(),
        },
      });

      console.log(`[CONTRACT_WORKFLOW] Reminder sent for contract ${contract.id} (reminder #${contract.reminderCount + 1})`);

    } catch (error) {
      console.error(`[CONTRACT_WORKFLOW] Failed to send reminder for contract ${contract.id}:`, error);
      // Don't throw - continue processing other reminders
    }
  }

  /**
   * Send reminders for all contracts that need them
   * Called by cron job daily
   */
  async sendReminders(): Promise<{ sent: number; errors: number }> {
    try {
      console.log(`[CONTRACT_WORKFLOW] Starting reminder check...`);

      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Find contracts needing reminders
      const contractsNeedingReminder = await prisma.contract.findMany({
        where: {
          status: ContractStatus.SENT_FOR_SIGNATURE,
          OR: [
            // First reminder: sent 3+ days ago, no reminders sent yet
            {
              sentAt: { lte: threeDaysAgo },
              reminderCount: 0,
            },
            // Second reminder: sent 7+ days ago, only 1 reminder sent
            {
              sentAt: { lte: sevenDaysAgo },
              reminderCount: 1,
            },
          ],
        },
        include: {
          customer: true,
          invoice: true,
        },
      });

      console.log(`[CONTRACT_WORKFLOW] Found ${contractsNeedingReminder.length} contracts needing reminders`);

      let sent = 0;
      let errors = 0;

      for (const contract of contractsNeedingReminder) {
        try {
          await this.sendReminderForContract(contract);
          sent++;
        } catch (error) {
          console.error(`[CONTRACT_WORKFLOW] Failed to send reminder for contract ${contract.id}:`, error);
          errors++;
        }
      }

      console.log(`[CONTRACT_WORKFLOW] Reminder check complete: ${sent} sent, ${errors} errors`);

      return { sent, errors };

    } catch (error) {
      console.error(`[CONTRACT_WORKFLOW] Failed to send reminders:`, error);
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
          invoice: true,
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
   * Get contract status by ID
   */
  async getContractStatus(contractId: string): Promise<any> {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        customer: true,
        invoice: true,
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
