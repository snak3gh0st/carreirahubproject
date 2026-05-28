import { NextRequest, NextResponse } from "next/server";
import {
  processAllQueues,
  QUICKBOOKS_SYNC_QUEUE_KEYS,
} from "@/lib/utils/queue-processor";
import { prisma } from "@/lib/db";
import { withCronTelemetry } from "@/lib/utils/cron-with-telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 1500;

export const GET = withCronTelemetry("process-quickbooks-sync", async (request: NextRequest) => {
  const startTime = Date.now();

  try {
    const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn("[CRON] Unauthorized QuickBooks sync processor request");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    console.log("[CRON] Starting QuickBooks sync queue processing");
    const result = await processAllQueues(QUICKBOOKS_SYNC_QUEUE_KEYS);

    return NextResponse.json(
      {
        success: true,
        hadFailures: result.totalJobsFailed > 0,
        queuesProcessed: result.queuesProcessed,
        totalJobsProcessed: result.totalJobsProcessed,
        totalFailures: result.totalJobsFailed,
        executionTimeMs: result.totalExecutionTimeMs,
        details: result.queueResults,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[CRON] Error in process-quickbooks-sync:", error);

    try {
      await prisma.integrationLog.create({
        data: {
          service: "QUEUE_PROCESSING",
          action: "process_quickbooks_sync_queue",
          status: "ERROR",
          error: error instanceof Error ? error.message : "Unknown error",
          errorCategory: "permanent",
          errorSeverity: "critical",
          metadata: {
            errorName: error instanceof Error ? error.name : typeof error,
          },
        },
      });
    } catch (logError) {
      console.error("[CRON] Failed to log QuickBooks sync processor error:", logError);
    }

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
