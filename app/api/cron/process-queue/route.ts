import { NextRequest, NextResponse } from "next/server";
import { processAllQueues } from "@/lib/utils/queue-processor";
import { prisma } from "@/lib/db";
import { withCronTelemetry } from "@/lib/utils/cron-with-telegram";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/process-queue
 *
 * Processes all BullMQ queues (leadQualification, whatsappMessages, etc.)
 * with per-queue job limits and automatic timeout handling.
 *
 * Called by the host scheduler every 5 minutes.
 * See .planning/docs/QUEUE_PROCESSING.md for full architecture documentation.
 *
 * Execution constraints:
 * - Swarm scheduler curl timeout: 300 seconds
 * - Endpoint max execution: 270 seconds by default
 * - Heavy QuickBooks/bulk jobs get a longer per-job timeout than lightweight jobs
 *
 * Queue processing order (by priority):
 * 1. whatsappMessages (5 max) - lightweight, high priority
 * 2. invoiceApproval (3 max) - moderate weight
 * 3. pipedriveReverseSync (2 max) - API calls
 * 4. pipedriveSync (3 max) - API calls
 * 5. leadQualification (2 max) - AI heavy
 * 6. invoiceGeneration (2 max) - heavyweight
 * 7. contractGeneration (2 max) - heavyweight
 * 8. quickbooksSync (1 max) - VERY heavy
 * 9. bulkImport (1 max) - EXTREMELY heavy
 *
 * Returns 200 even if jobs fail (cron healthcheck success is endpoint success).
 * Metrics logged to IntegrationLog table for monitoring.
 * Job failures logged with full context for debugging.
 */
export const GET = withCronTelemetry("process-queue", async (request) => {
  const startTime = Date.now();

  try {
    // Accept CRON_SECRET (host scheduler) or VERCEL_CRON_SECRET (Vercel overlap)
    const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn("[CRON] Unauthorized cron request");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    console.log("[CRON] Starting queue processing");

    // Process all queues (built-in 8-second safety limit)
    const result = await processAllQueues();

    const totalExecutionTimeMs = Date.now() - startTime;

    console.log(
      `[CRON] Complete: ${result.totalJobsProcessed} jobs processed, ` +
        `${result.totalJobsFailed} failed, ${result.queuesProcessed} queues, ` +
        `${totalExecutionTimeMs}ms`
    );

    // Always return 200 for cron healthcheck
    // Job failures are captured in IntegrationLog for monitoring
    return NextResponse.json(
      {
        success: result.totalJobsFailed === 0,
        queuesProcessed: result.queuesProcessed,
        totalJobsProcessed: result.totalJobsProcessed,
        totalFailures: result.totalJobsFailed,
        executionTimeMs: result.totalExecutionTimeMs,
        details: result.queueResults,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[CRON] Error in process-queue:", error);

    // Log error but still return 200
    try {
      await prisma.integrationLog.create({
        data: {
          service: "QUEUE_PROCESSING",
          action: "process_all_queues",
          status: "ERROR",
          error:
            error instanceof Error ? error.message : "Unknown error",
          errorCategory: "permanent",
          errorSeverity: "critical",
          metadata: {
            errorName:
              error instanceof Error ? error.name : typeof error,
          },
        },
      });
    } catch (logError) {
      console.error("[CRON] Failed to log error:", logError);
    }

    // Return 200 even on error (cron should see this as success)
    // Details in IntegrationLog table for debugging
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTimeMs: Date.now() - startTime,
      },
      { status: 200 }
    );
  }
});

export const POST = GET;
