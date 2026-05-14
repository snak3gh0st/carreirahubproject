import { NextRequest, NextResponse } from "next/server";
import { monitorAllQueues } from "@/lib/utils/queue-monitor";
import { prisma } from "@/lib/db";
import { withCronTelemetry } from "@/lib/utils/cron-with-telegram";
import { ACTIVE_QUEUE_KEYS } from "@/lib/utils/queue-names";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/monitor-queues
 *
 * Monitors all BullMQ queues for stale, stuck, and dead jobs.
 * Detects queue exhaustion issues and logs to IntegrationLog.
 *
 * Called by Vercel Cron every 4 hours (configured in vercel.json).
 * See .planning/docs/QUEUE_MONITORING.md for monitoring architecture.
 *
 * Monitoring thresholds:
 * - Stale: created > 24 hours ago, still waiting/active
 * - Dead: failed >= 5 times (at retry ceiling)
 * - Stuck: active > 5 minutes (processor may have crashed)
 *
 * Vercel configuration: path "/api/cron/monitor-queues", schedule every 4 hours
 *
 * Execution constraints:
 * - Vercel timeout: 10 seconds
 * - Endpoint max execution: 8 seconds (2s buffer)
 * - Monitoring is read-only (no job removal)
 *
 * Returns 200 even if issues found (monitoring shouldn't fail the cron).
 * All issues logged to IntegrationLog for dashboarding and debugging.
 */
export const GET = withCronTelemetry("monitor-queues", async (request) => {
  const startTime = Date.now();

  try {
    // Accept CRON_SECRET (host scheduler) or VERCEL_CRON_SECRET (Vercel overlap)
    const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn("[CRON] Unauthorized monitor-queues request");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    console.log("[CRON] Starting queue monitoring");

    const queueNames = ACTIVE_QUEUE_KEYS;

    // Monitoring thresholds (from plan: 24h stale, 5 failures, 5min stuck)
    const monitoringResults = await monitorAllQueues(queueNames, {
      staleThresholdMs: 24 * 3600 * 1000, // 24 hours
      failureThreshold: 5,
      stuckThresholdMs: 5 * 60 * 1000, // 5 minutes
    });

    const executionTimeMs = Date.now() - startTime;

    // Log monitoring summary to IntegrationLog
    try {
      await prisma.integrationLog.create({
        data: {
          service: "QUEUE_MONITORING",
          action: "monitor_all_queues",
          status:
            monitoringResults.totalIssuesAcrossQueues > 0
              ? "WARNING"
              : "SUCCESS",
          durationMs: executionTimeMs,
          errorCategory: "QUEUE_MONITORING",
          errorSeverity:
            monitoringResults.totalIssuesAcrossQueues > 10
              ? "error"
              : monitoringResults.totalIssuesAcrossQueues > 0
                ? "warning"
                : "info",
          metadata: {
            queuesMonitored: queueNames.length,
            totalStaleJobs: monitoringResults.totalStaleJobs,
            totalDeadJobs: monitoringResults.totalDeadJobs,
            totalStuckJobs: monitoringResults.totalStuckJobs,
            totalIssuesAcrossQueues:
              monitoringResults.totalIssuesAcrossQueues,
            detailedResults: monitoringResults.results,
          },
        },
      });
    } catch (logError) {
      console.error("[CRON] Failed to log monitoring summary:", logError);
    }

    console.log(
      `[CRON] Monitoring complete: stale=${monitoringResults.totalStaleJobs}, ` +
        `dead=${monitoringResults.totalDeadJobs}, ` +
        `stuck=${monitoringResults.totalStuckJobs}, ` +
        `${executionTimeMs}ms`
    );

    // Always return 200 for cron healthcheck
    // Issues are captured in IntegrationLog for monitoring
    return NextResponse.json(
      {
        success: true,
        queuesMonitored: queueNames.length,
        totalStaleJobs: monitoringResults.totalStaleJobs,
        totalDeadJobs: monitoringResults.totalDeadJobs,
        totalStuckJobs: monitoringResults.totalStuckJobs,
        totalIssuesAcrossQueues:
          monitoringResults.totalIssuesAcrossQueues,
        executionTimeMs,
        issues: Object.entries(monitoringResults.results)
          .filter(([_, result]) => result.totalIssues > 0)
          .map(([queue, result]) => ({
            queue,
            totalIssues: result.totalIssues,
            staleFailed: result.staleFailed,
            deadJobs: result.deadJobs,
            stuckJobs: result.stuckJobs,
          })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[CRON] Error in monitor-queues:", error);

    // Log error but still return 200
    try {
      await prisma.integrationLog.create({
        data: {
          service: "QUEUE_MONITORING",
          action: "monitor_all_queues",
          status: "ERROR",
          error:
            error instanceof Error ? error.message : "Unknown error",
          errorCategory: "QUEUE_MONITORING",
          errorSeverity: "critical",
          metadata: {
            errorName:
              error instanceof Error ? error.name : typeof error,
          },
        },
      });
    } catch (logError) {
      console.error("[CRON] Failed to log monitoring error:", logError);
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
