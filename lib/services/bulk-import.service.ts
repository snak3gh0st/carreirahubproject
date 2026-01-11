import { prisma } from "@/lib/db";
import { BulkImport, ImportStatus } from "@prisma/client";

/**
 * Bulk Import Service
 *
 * Orchestrates bulk import operations from Pipedrive and QuickBooks.
 * Provides progress tracking, error handling, and cancellation support.
 */
export class BulkImportService {
  /**
   * Start bulk import from Pipedrive
   */
  async startPipedriveImport(options: {
    importPersons: boolean;
    importDeals: boolean;
    startedBy?: string;
  }): Promise<string> {
    try {
      const { importPersons, importDeals, startedBy } = options;

      // Determine import type
      let type = "";
      if (importPersons && importDeals) {
        type = "PERSONS_AND_DEALS";
      } else if (importPersons) {
        type = "PERSONS";
      } else if (importDeals) {
        type = "DEALS";
      } else {
        throw new Error("Must select at least one entity to import");
      }

      // Create bulk import record
      const bulkImport = await prisma.bulkImport.create({
        data: {
          source: "PIPEDRIVE",
          type,
          status: "RUNNING",
          startedBy: startedBy || undefined,
        },
      });

      // Queue import jobs (will be processed by workers)
      // Note: The actual import will be triggered via queue workers
      // For now, we just create the record and return the ID
      // The queue worker will call pipedriveSyncService.importAllPersons() etc.

      console.log(`[BULK_IMPORT] Started Pipedrive import ${bulkImport.id}: ${type}`);

      return bulkImport.id;
    } catch (error) {
      console.error("[BULK_IMPORT] Error starting Pipedrive import:", error);
      throw error;
    }
  }

  /**
   * Start bulk import from QuickBooks
   */
  async startQuickBooksImport(options: {
    importCustomers: boolean;
    importInvoices: boolean;
    importItems: boolean;
    startedBy?: string;
  }): Promise<string> {
    try {
      const { importCustomers, importInvoices, importItems, startedBy } = options;

      // Determine import type
      const types: string[] = [];
      if (importCustomers) types.push("CUSTOMERS");
      if (importInvoices) types.push("INVOICES");
      if (importItems) types.push("ITEMS");

      if (types.length === 0) {
        throw new Error("Must select at least one entity to import");
      }

      const type = types.join("_AND_");

      // Create bulk import record
      const bulkImport = await prisma.bulkImport.create({
        data: {
          source: "QUICKBOOKS",
          type,
          status: "RUNNING",
          startedBy: startedBy || undefined,
        },
      });

      // Queue import jobs (will be processed by workers)
      console.log(`[BULK_IMPORT] Started QuickBooks import ${bulkImport.id}: ${type}`);

      return bulkImport.id;
    } catch (error) {
      console.error("[BULK_IMPORT] Error starting QuickBooks import:", error);
      throw error;
    }
  }

  /**
   * Get import status and progress
   */
  async getImportStatus(importId: string): Promise<BulkImport | null> {
    try {
      const bulkImport = await prisma.bulkImport.findUnique({
        where: { id: importId },
        include: {
          initiator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return bulkImport;
    } catch (error) {
      console.error(`[BULK_IMPORT] Error getting import status for ${importId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel running import
   */
  async cancelImport(importId: string): Promise<void> {
    try {
      const bulkImport = await prisma.bulkImport.findUnique({
        where: { id: importId },
      });

      if (!bulkImport) {
        throw new Error(`Import ${importId} not found`);
      }

      if (bulkImport.status !== "RUNNING") {
        throw new Error(`Cannot cancel import ${importId}: status is ${bulkImport.status}`);
      }

      // Update status to CANCELLED
      await prisma.bulkImport.update({
        where: { id: importId },
        data: {
          status: "CANCELLED",
          completedAt: new Date(),
        },
      });

      // Note: The worker will check this status and stop processing
      console.log(`[BULK_IMPORT] Cancelled import ${importId}`);
    } catch (error) {
      console.error(`[BULK_IMPORT] Error cancelling import ${importId}:`, error);
      throw error;
    }
  }

  /**
   * Get all bulk imports with optional filters
   */
  async getAllImports(filters?: {
    source?: "PIPEDRIVE" | "QUICKBOOKS";
    status?: ImportStatus;
    startedBy?: string;
    limit?: number;
  }): Promise<BulkImport[]> {
    try {
      const where: any = {};

      if (filters?.source) {
        where.source = filters.source;
      }

      if (filters?.status) {
        where.status = filters.status;
      }

      if (filters?.startedBy) {
        where.startedBy = filters.startedBy;
      }

      const bulkImports = await prisma.bulkImport.findMany({
        where,
        include: {
          initiator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          startedAt: "desc",
        },
        take: filters?.limit || 50,
      });

      return bulkImports;
    } catch (error) {
      console.error("[BULK_IMPORT] Error getting all imports:", error);
      throw error;
    }
  }

  /**
   * Get import statistics
   */
  async getImportStats(): Promise<{
    total: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  }> {
    try {
      const [total, running, completed, failed, cancelled] = await Promise.all([
        prisma.bulkImport.count(),
        prisma.bulkImport.count({ where: { status: "RUNNING" } }),
        prisma.bulkImport.count({ where: { status: "COMPLETED" } }),
        prisma.bulkImport.count({ where: { status: "FAILED" } }),
        prisma.bulkImport.count({ where: { status: "CANCELLED" } }),
      ]);

      return {
        total,
        running,
        completed,
        failed,
        cancelled,
      };
    } catch (error) {
      console.error("[BULK_IMPORT] Error getting import stats:", error);
      throw error;
    }
  }

  /**
   * Clean up old completed/failed imports
   * Call this periodically (e.g., via cron job) to prevent database bloat
   */
  async cleanupOldImports(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await prisma.bulkImport.deleteMany({
        where: {
          status: {
            in: ["COMPLETED", "FAILED", "CANCELLED"],
          },
          completedAt: {
            lt: cutoffDate,
          },
        },
      });

      console.log(`[BULK_IMPORT] Cleaned up ${result.count} old imports`);
      return result.count;
    } catch (error) {
      console.error("[BULK_IMPORT] Error cleaning up old imports:", error);
      throw error;
    }
  }
}

export const bulkImportService = new BulkImportService();
