import { prisma } from "@/lib/db";
import { pipedriveService } from "./pipedrive.service";
import { identityMapper } from "./identity-mapper";
import { Customer, Deal } from "@prisma/client";

const SYNC_DEBOUNCE_MS = 5000; // 5 seconds

/**
 * Pipedrive Sync Service
 *
 * Responsible for bidirectional synchronization between Hub and Pipedrive.
 * Implements Last-Write-Wins conflict resolution with webhook loop prevention.
 */
export class PipedriveSyncService {
  /**
   * Sync Customer update from Hub to Pipedrive
   */
  async syncCustomerToPipedrive(customerId: string): Promise<void> {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        throw new Error(`Customer ${customerId} not found`);
      }

      if (!customer.pipedrive_id) {
        console.warn(`[PIPEDRIVE_SYNC] Customer ${customerId} has no pipedrive_id, cannot sync`);
        return;
      }

      // Check if recently synced (prevent webhook loop)
      if (this.isRecentlySynced(customer.lastPipedriveSyncAt)) {
        console.log(`[PIPEDRIVE_SYNC] Customer ${customerId} recently synced, skipping to prevent loop`);
        return;
      }

      // Update person in Pipedrive
      await pipedriveService.updatePerson(customer.pipedrive_id, {
        name: customer.name,
        email: customer.email,
        phone: customer.phone || undefined,
      });

      // Update last sync timestamp
      await prisma.customer.update({
        where: { id: customerId },
        data: { lastPipedriveSyncAt: new Date() },
      });

      // Log success
      await prisma.integrationLog.create({
        data: {
          service: "PIPEDRIVE_SYNC",
          action: "CUSTOMER_SYNCED_TO_PIPEDRIVE",
          status: "SUCCESS",
          payload: {
            customerId,
            pipedrive_id: customer.pipedrive_id,
          } as any,
        },
      });

      console.log(`[PIPEDRIVE_SYNC] Successfully synced customer ${customerId} to Pipedrive`);
    } catch (error) {
      console.error(`[PIPEDRIVE_SYNC] Error syncing customer ${customerId}:`, error);

      // Log error
      await prisma.integrationLog.create({
        data: {
          service: "PIPEDRIVE_SYNC",
          action: "CUSTOMER_SYNCED_TO_PIPEDRIVE",
          status: "ERROR",
          error: error instanceof Error ? error.message : "Unknown error",
          payload: { customerId } as any,
        },
      });

      throw error;
    }
  }

  /**
   * Sync Deal update from Hub to Pipedrive
   */
  async syncDealToPipedrive(dealId: string): Promise<void> {
    try {
      const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        include: {
          customer: true,
        },
      });

      if (!deal) {
        throw new Error(`Deal ${dealId} not found`);
      }

      if (!deal.pipedrive_deal_id) {
        console.warn(`[PIPEDRIVE_SYNC] Deal ${dealId} has no pipedrive_deal_id, cannot sync`);
        return;
      }

      // Check if recently synced (prevent webhook loop)
      if (this.isRecentlySynced(deal.lastPipedriveSyncAt)) {
        console.log(`[PIPEDRIVE_SYNC] Deal ${dealId} recently synced, skipping to prevent loop`);
        return;
      }

      // Update deal in Pipedrive
      await pipedriveService.updateDeal(deal.pipedrive_deal_id, {
        title: deal.title,
        value: Number(deal.value),
        currency: deal.currency,
        status: deal.status.toLowerCase(), // Convert OPEN/WON/LOST to open/won/lost
      });

      // Update last sync timestamp
      await prisma.deal.update({
        where: { id: dealId },
        data: { lastPipedriveSyncAt: new Date() },
      });

      // Log success
      await prisma.integrationLog.create({
        data: {
          service: "PIPEDRIVE_SYNC",
          action: "DEAL_SYNCED_TO_PIPEDRIVE",
          status: "SUCCESS",
          payload: {
            dealId,
            pipedrive_deal_id: deal.pipedrive_deal_id,
          } as any,
        },
      });

      console.log(`[PIPEDRIVE_SYNC] Successfully synced deal ${dealId} to Pipedrive`);
    } catch (error) {
      console.error(`[PIPEDRIVE_SYNC] Error syncing deal ${dealId}:`, error);

      // Log error
      await prisma.integrationLog.create({
        data: {
          service: "PIPEDRIVE_SYNC",
          action: "DEAL_SYNCED_TO_PIPEDRIVE",
          status: "ERROR",
          error: error instanceof Error ? error.message : "Unknown error",
          payload: { dealId } as any,
        },
      });

      throw error;
    }
  }

  /**
   * Sync Invoice information to Pipedrive as a Deal Note
   */
  async syncInvoiceToPipedrive(invoiceId: string): Promise<void> {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          deal: true,
          customer: true,
        },
      });

      if (!invoice) {
        throw new Error(`Invoice ${invoiceId} not found`);
      }

      if (!invoice.deal || !invoice.deal.pipedrive_deal_id) {
        console.warn(`[PIPEDRIVE_SYNC] Invoice ${invoiceId} has no associated Pipedrive deal, cannot sync`);
        return;
      }

      // Create note in Pipedrive deal
      const noteContent = `
📄 Invoice #${invoice.invoiceNumber || "Pending"}

Amount: ${invoice.amount} ${invoice.deal.currency || 'USD'}
Due Date: ${invoice.dueDate.toLocaleDateString()}
Status: ${invoice.status}
Approval Status: ${invoice.approvalStatus}

QuickBooks Invoice ID: ${invoice.quickbooks_invoice_id || "Not synced yet"}
      `.trim();

      await pipedriveService.addNoteToDeal(invoice.deal.pipedrive_deal_id, noteContent);

      // Log success
      await prisma.integrationLog.create({
        data: {
          service: "PIPEDRIVE_SYNC",
          action: "INVOICE_SYNCED_TO_PIPEDRIVE",
          status: "SUCCESS",
          payload: {
            invoiceId,
            pipedrive_deal_id: invoice.deal.pipedrive_deal_id,
          } as any,
        },
      });

      console.log(`[PIPEDRIVE_SYNC] Successfully synced invoice ${invoiceId} to Pipedrive`);
    } catch (error) {
      console.error(`[PIPEDRIVE_SYNC] Error syncing invoice ${invoiceId}:`, error);

      // Log error
      await prisma.integrationLog.create({
        data: {
          service: "PIPEDRIVE_SYNC",
          action: "INVOICE_SYNCED_TO_PIPEDRIVE",
          status: "ERROR",
          error: error instanceof Error ? error.message : "Unknown error",
          payload: { invoiceId } as any,
        },
      });

      throw error;
    }
  }

  /**
   * Bulk import all Pipedrive Persons into Leads/Customers
   */
  async importAllPersons(importId: string): Promise<void> {
    const CHUNK_SIZE = 100;
    let start = 0;
    let hasMore = true;
    let totalProcessed = 0;
    let successCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    try {
      await prisma.bulkImport.update({
        where: { id: importId },
        data: { status: "RUNNING" },
      });

      while (hasMore) {
        // Fetch persons from Pipedrive
        const result = await pipedriveService.getAllPersons({
          start,
          limit: CHUNK_SIZE,
        });

        const persons = result.data || [];
        hasMore = result.hasMore;

        // Update total records count
        if (start === 0) {
          const totalEstimate = persons.length < CHUNK_SIZE ? persons.length : persons.length * 10; // Rough estimate
          await prisma.bulkImport.update({
            where: { id: importId },
            data: { totalRecords: totalEstimate },
          });
        }

        // Process each person
        for (const person of persons) {
          try {
            // Extract email (primary email)
            const email = person.email?.[0]?.value || person.primary_email;
            if (!email) {
              errors.push({ person_id: person.id, error: "No email found" });
              errorCount++;
              continue;
            }

            // Reconcile customer via Identity Mapper
            await identityMapper.reconcileCustomer({
              email,
              name: person.name,
              phone: person.phone?.[0]?.value,
              externalIds: {
                pipedrive_id: person.id,
              },
              metadata: {
                pipedrive_person_data: person,
              },
            });

            successCount++;
          } catch (error) {
            console.error(`[BULK_IMPORT] Error importing person ${person.id}:`, error);
            errors.push({
              person_id: person.id,
              error: error instanceof Error ? error.message : "Unknown error",
            });
            errorCount++;
          }

          totalProcessed++;

          // Update progress every 10 records
          if (totalProcessed % 10 === 0) {
            await prisma.bulkImport.update({
              where: { id: importId },
              data: {
                processedRecords: totalProcessed,
                successCount,
                errorCount,
              },
            });
          }
        }

        start += CHUNK_SIZE;
      }

      // Mark as completed
      await prisma.bulkImport.update({
        where: { id: importId },
        data: {
          status: "COMPLETED",
          processedRecords: totalProcessed,
          successCount,
          errorCount,
          errors: errors.length > 0 ? (errors as any) : null,
          completedAt: new Date(),
        },
      });

      console.log(`[BULK_IMPORT] Completed Pipedrive persons import: ${successCount} success, ${errorCount} errors`);
    } catch (error) {
      console.error("[BULK_IMPORT] Fatal error during Pipedrive persons import:", error);

      // Mark as failed
      await prisma.bulkImport.update({
        where: { id: importId },
        data: {
          status: "FAILED",
          processedRecords: totalProcessed,
          successCount,
          errorCount,
          errors: [...errors, { error: error instanceof Error ? error.message : "Unknown error" }] as any,
          completedAt: new Date(),
        },
      });

      throw error;
    }
  }

  /**
   * Bulk import all Pipedrive Deals
   */
  async importAllDeals(importId: string): Promise<void> {
    const CHUNK_SIZE = 100;
    let start = 0;
    let hasMore = true;
    let totalProcessed = 0;
    let successCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    try {
      await prisma.bulkImport.update({
        where: { id: importId },
        data: { status: "RUNNING" },
      });

      while (hasMore) {
        // Fetch deals from Pipedrive
        const result = await pipedriveService.getAllDeals({
          start,
          limit: CHUNK_SIZE,
          status: "all_not_deleted",
        });

        const deals = result.data || [];
        hasMore = result.hasMore;

        // Update total records count
        if (start === 0) {
          const totalEstimate = deals.length < CHUNK_SIZE ? deals.length : deals.length * 10;
          await prisma.bulkImport.update({
            where: { id: importId },
            data: { totalRecords: totalEstimate },
          });
        }

        // Process each deal
        for (const pipedriveDealsData of deals) {
          try {
            // Fetch person data if person_id exists
            let customer: Customer | null = null;
            if (pipedriveDealsData.person_id?.value) {
              const personData = await pipedriveService.getPerson(pipedriveDealsData.person_id.value);

              const email = personData.email?.[0]?.value || personData.primary_email;
              if (email) {
                customer = await identityMapper.reconcileCustomer({
                  email,
                  name: personData.name,
                  phone: personData.phone?.[0]?.value,
                  externalIds: {
                    pipedrive_id: personData.id,
                  },
                });
              }
            }

            // Check if deal already exists
            const existingDeal = await prisma.deal.findUnique({
              where: { pipedrive_deal_id: pipedriveDealsData.id },
            });

            if (existingDeal) {
              // Update existing deal
              await prisma.deal.update({
                where: { id: existingDeal.id },
                data: {
                  title: pipedriveDealsData.title,
                  value: pipedriveDealsData.value || 0,
                  currency: pipedriveDealsData.currency || "USD",
                  status: pipedriveDealsData.status === "won" ? "WON" : pipedriveDealsData.status === "lost" ? "LOST" : "OPEN",
                  customerId: customer?.id,
                  lastPipedriveSyncAt: new Date(),
                },
              });
            } else {
              // Create new deal
              await prisma.deal.create({
                data: {
                  title: pipedriveDealsData.title,
                  value: pipedriveDealsData.value || 0,
                  currency: pipedriveDealsData.currency || "USD",
                  status: pipedriveDealsData.status === "won" ? "WON" : pipedriveDealsData.status === "lost" ? "LOST" : "OPEN",
                  pipedrive_deal_id: pipedriveDealsData.id,
                  customerId: customer?.id,
                  lastPipedriveSyncAt: new Date(),
                },
              });
            }

            successCount++;
          } catch (error) {
            console.error(`[BULK_IMPORT] Error importing deal ${pipedriveDealsData.id}:`, error);
            errors.push({
              deal_id: pipedriveDealsData.id,
              error: error instanceof Error ? error.message : "Unknown error",
            });
            errorCount++;
          }

          totalProcessed++;

          // Update progress every 10 records
          if (totalProcessed % 10 === 0) {
            await prisma.bulkImport.update({
              where: { id: importId },
              data: {
                processedRecords: totalProcessed,
                successCount,
                errorCount,
              },
            });
          }
        }

        start += CHUNK_SIZE;
      }

      // Mark as completed
      await prisma.bulkImport.update({
        where: { id: importId },
        data: {
          status: "COMPLETED",
          processedRecords: totalProcessed,
          successCount,
          errorCount,
          errors: errors.length > 0 ? (errors as any) : null,
          completedAt: new Date(),
        },
      });

      console.log(`[BULK_IMPORT] Completed Pipedrive deals import: ${successCount} success, ${errorCount} errors`);
    } catch (error) {
      console.error("[BULK_IMPORT] Fatal error during Pipedrive deals import:", error);

      // Mark as failed
      await prisma.bulkImport.update({
        where: { id: importId },
        data: {
          status: "FAILED",
          processedRecords: totalProcessed,
          successCount,
          errorCount,
          errors: [...errors, { error: error instanceof Error ? error.message : "Unknown error" }] as any,
          completedAt: new Date(),
        },
      });

      throw error;
    }
  }

  /**
   * Conflict resolution: Check if entity was recently synced
   * Used to prevent webhook loops
   */
  private isRecentlySynced(lastSyncAt: Date | null): boolean {
    if (!lastSyncAt) return false;

    const now = new Date();
    const timeSinceSync = now.getTime() - lastSyncAt.getTime();

    return timeSinceSync < SYNC_DEBOUNCE_MS;
  }

  /**
   * Resolve conflict between Hub and Pipedrive records
   * Strategy: Last-Write-Wins
   */
  private resolveConflict(
    hubUpdatedAt: Date,
    pipedriveUpdateTime: string
  ): "hub" | "pipedrive" {
    const hubTime = hubUpdatedAt.getTime();
    const pipedriveTime = new Date(pipedriveUpdateTime).getTime();

    return hubTime > pipedriveTime ? "hub" : "pipedrive";
  }
}

export const pipedriveSyncService = new PipedriveSyncService();
