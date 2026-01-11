import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { pipedriveSyncService } from "@/lib/services/pipedrive-sync.service";
import { quickbooksSyncService } from "@/lib/services/quickbooks-sync.service";

/**
 * POST /api/cron/process-queue
 *
 * Processes pending bulk import jobs
 * This should be called by a cron job (e.g., Vercel Cron)
 *
 * In vercel.json, add:
 * {
 *   "crons": [{
 *     "path": "/api/cron/process-queue",
 *     "schedule": "every 5 minutes"
 *   }]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret if configured
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    console.log("[CRON] Processing queue...");

    // Find pending bulk imports
    const pendingImports = await prisma.bulkImport.findMany({
      where: {
        status: "RUNNING",
      },
      orderBy: {
        startedAt: "asc",
      },
      take: 5, // Process up to 5 at a time
    });

    console.log(`[CRON] Found ${pendingImports.length} pending imports`);

    const results = [];

    for (const bulkImport of pendingImports) {
      try {
        console.log(`[CRON] Processing import ${bulkImport.id} (${bulkImport.source} - ${bulkImport.type})`);

        if (bulkImport.source === "PIPEDRIVE") {
          const typeParts = bulkImport.type.split("_AND_");

          if (typeParts.includes("PERSONS")) {
            await pipedriveSyncService.importAllPersons(bulkImport.id);
          }

          if (typeParts.includes("DEALS")) {
            await pipedriveSyncService.importAllDeals(bulkImport.id);
          }
        } else if (bulkImport.source === "QUICKBOOKS") {
          const typeParts = bulkImport.type.split("_AND_");

          if (typeParts.includes("CUSTOMERS")) {
            await quickbooksSyncService.importAllCustomers(bulkImport.id);
          }

          if (typeParts.includes("INVOICES")) {
            await quickbooksSyncService.importAllInvoices(bulkImport.id);
          }

          // Mark as completed
          await prisma.bulkImport.update({
            where: { id: bulkImport.id },
            data: {
              status: "COMPLETED",
              completedAt: new Date(),
            },
          });
        }

        results.push({
          importId: bulkImport.id,
          status: "processed",
        });
      } catch (error) {
        console.error(`[CRON] Error processing import ${bulkImport.id}:`, error);

        // Mark as failed
        await prisma.bulkImport.update({
          where: { id: bulkImport.id },
          data: {
            status: "FAILED",
            completedAt: new Date(),
          },
        });

        results.push({
          importId: bulkImport.id,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error("[CRON] Error in process-queue:", error);

    return NextResponse.json(
      {
        error: "Failed to process queue",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Also allow GET for testing
export async function GET(request: NextRequest) {
  return POST(request);
}
