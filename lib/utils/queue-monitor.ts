import { Queue } from "bullmq";
import { prisma } from "@/lib/db";
import { isRedisConfigured } from "@/lib/utils/queue";
import { resolveBullQueueName } from "@/lib/utils/queue-names";

/**
 * Queue Monitoring Service
 *
 * ============================================================================
 * PURPOSE: Detect stale, stuck, and dead jobs to prevent queue exhaustion
 * ============================================================================
 *
 * PROBLEM: Without monitoring, problematic jobs accumulate in Redis:
 * - Stale jobs: Created hours ago but still waiting/active (may be stuck)
 * - Stuck jobs: Active for >5 minutes (processor may have crashed)
 * - Dead jobs: Failed > 5 times (hitting retry ceiling)
 *
 * SOLUTION: Periodic monitoring scan (runs every 4 hours via cron)
 * - Detect problematic jobs via Redis inspection
 * - Log issues to IntegrationLog for visibility
 * - Remove stale failed jobs from queue (completed jobs auto-clean)
 * - Warn about stuck active jobs but don't force remove (may still process)
 *
 * ============================================================================
 * STALE JOB DETECTION THRESHOLDS
 * ============================================================================
 *
 * Stale threshold: 24 hours (configurable)
 * - Jobs created > 24 hours ago and still in waiting/active state
 * - Usually indicates processor that can't finish or got stuck
 * - Action: Log warning, remove if failed
 *
 * Failure threshold: 5 attempts
 * - Jobs that have failed 5 times are at retry ceiling
 * - BullMQ will dead-letter these per removeOnFail config
 * - Action: Log as permanent failure, cleaned up by BullMQ
 *
 * Stuck active threshold: 5 minutes
 * - Jobs actively processing for >5 minutes
 * - May indicate long-running job (legitimate) or crashed processor
 * - Action: Log warning only (don't remove - job may still complete)
 *
 * ============================================================================
 * EFFICIENT SCANNING
 * ============================================================================
 *
 * Instead of scanning ALL jobs (expensive), we only check:
 * - delayed: Scheduled for later (may become stale)
 * - waiting: Ready to process (may become stale)
 * - active: Currently processing (may be stuck)
 *
 * We SKIP:
 * - completed: Auto-cleaned by BullMQ removeOnComplete setting
 * - failed: Auto-cleaned by BullMQ removeOnFail setting
 * - paused: Admin-paused, safe to ignore during monitoring
 *
 * This reduces scanning from O(all jobs) to O(active + waiting + delayed),
 * which is typically 10-100 jobs per queue.
 *
 * ============================================================================
 * SAFETY: NO AUTO-REMEDIATION
 * ============================================================================
 *
 * This monitoring is LOGGING-ONLY to prevent unintended side effects:
 * - No force removal of stuck jobs (processor may still be running)
 * - No modification of job data
 * - No automatic retry triggering
 * - All issues logged to IntegrationLog for human review
 *
 * Manual remediation options (Phase 4):
 * - Dashboard UI to view problematic jobs
 * - API endpoint to force remove stale jobs
 * - Alerts to notify on repeated stale patterns
 * - Circuit breaker for queues with >N stale jobs
 *
 * ============================================================================
 */

/**
 * Monitor options for controlling detection thresholds
 */
export interface MonitorOptions {
  /** Jobs older than this (ms) are considered stale. Default: 24 hours */
  staleThresholdMs?: number;
  /** Jobs failed this many times are dead. Default: 5 */
  failureThreshold?: number;
  /** Jobs active longer than this (ms) are stuck. Default: 5 minutes */
  stuckThresholdMs?: number;
}

/**
 * Helper to get Redis connection options
 * Uses the same pattern as lib/utils/queue-processor.ts
 */
function getConnectionOptions() {
  if (!process.env.REDIS_URL) {
    return { host: "localhost", port: 6379, maxRetriesPerRequest: null };
  }

  try {
    const url = new URL(process.env.REDIS_URL);
    return {
      host: url.hostname,
      port: parseInt(url.port || "6379"),
      username: url.username ? decodeURIComponent(url.username) : undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      maxRetriesPerRequest: null,
    };
  } catch {
    return { host: "localhost", port: 6379, maxRetriesPerRequest: null };
  }
}

/**
 * Monitor a single queue for stale, stuck, and dead jobs
 *
 * @param queueName - Name of the queue (must match BullMQ queue name)
 * @param options - Detection thresholds
 * @returns Summary of problematic jobs found
 *
 * RETURN VALUE MEANING:
 * - staleFailed: Stale jobs that also failed (will be cleaned up)
 * - deadJobs: Jobs at failure ceiling (will be dead-lettered by BullMQ)
 * - stuckJobs: Jobs active for >5 minutes (may be processing legitimately)
 *
 * All found issues are logged to IntegrationLog with errorCategory="QUEUE_MONITORING"
 * for visibility and debugging.
 */
export async function monitorQueue(
  queueName: string,
  options?: MonitorOptions
): Promise<{
  staleFailed: number;
  deadJobs: number;
  stuckJobs: number;
  totalIssues: number;
}> {
  const startTime = Date.now();

  // Set defaults
  const staleThresholdMs = options?.staleThresholdMs || 24 * 3600 * 1000; // 24 hours
  const failureThreshold = options?.failureThreshold || 5;
  const stuckThresholdMs = options?.stuckThresholdMs || 5 * 60 * 1000; // 5 minutes

  let staleFailed = 0;
  let deadJobs = 0;
  let stuckJobs = 0;

  try {
    const connectionOptions = getConnectionOptions();
    const bullQueueName = resolveBullQueueName(queueName);
    const queue = new Queue(bullQueueName, { connection: connectionOptions });

    // Get jobs in various states (only check relevant states for efficiency)
    const [delayedJobs, waitingJobs, activeJobs] = await Promise.all([
      queue.getDelayed(0, -1), // All delayed jobs
      queue.getWaiting(0, -1), // All waiting jobs
      queue.getActive(0, -1), // All active jobs
    ]);

    const now = Date.now();

    // ====================================================================
    // CHECK DELAYED JOBS: May become stale if processor can't handle them
    // ====================================================================
    for (const job of delayedJobs) {
      // Delayed jobs shouldn't be stale unless stuck in queue structure
      // But we check createdAt anyway for edge cases
      const jobAgeMs = now - job.timestamp;
      if (jobAgeMs > staleThresholdMs) {
        await logMonitoringIssue({
          queueName,
          jobId: job.id || "",
          jobName: job.name,
          jobState: "delayed",
          ageMs: jobAgeMs,
          reason: "Stale delayed job (>24h in queue)",
          failureCount: 0,
        });
        staleFailed++;
      }
    }

    // ====================================================================
    // CHECK WAITING JOBS: Should be processed quickly
    // ====================================================================
    for (const job of waitingJobs) {
      const jobAgeMs = now - job.timestamp;

      // Check if stale
      if (jobAgeMs > staleThresholdMs) {
        // Check if failed multiple times
        const attemptsMade = job.attemptsMade || 0;
        if (attemptsMade >= failureThreshold) {
          deadJobs++;
        } else {
          staleFailed++;
        }

        await logMonitoringIssue({
          queueName,
          jobId: job.id || "",
          jobName: job.name,
          jobState: "waiting",
          ageMs: jobAgeMs,
          reason: `Stale waiting job (${Math.floor(jobAgeMs / (3600 * 1000))}h in queue)`,
          failureCount: attemptsMade,
        });
      } else if (job.attemptsMade && job.attemptsMade >= failureThreshold) {
        // Not stale but at failure ceiling
        deadJobs++;

        await logMonitoringIssue({
          queueName,
          jobId: job.id || "",
          jobName: job.name,
          jobState: "waiting",
          ageMs: jobAgeMs,
          reason: `Dead job (${job.attemptsMade} attempts, threshold=${failureThreshold})`,
          failureCount: job.attemptsMade,
        });
      }
    }

    // ====================================================================
    // CHECK ACTIVE JOBS: Should complete within reasonable time
    // ====================================================================
    for (const job of activeJobs) {
      const jobAgeMs = now - job.timestamp;

      // Check if stuck (active for >5 minutes)
      if (jobAgeMs > stuckThresholdMs) {
        stuckJobs++;

        await logMonitoringIssue({
          queueName,
          jobId: job.id || "",
          jobName: job.name,
          jobState: "active",
          ageMs: jobAgeMs,
          reason: `Stuck active job (${Math.floor(jobAgeMs / 1000)}s processing, threshold=300s)`,
          failureCount: job.attemptsMade || 0,
        });
      }
    }

    await queue.close();
  } catch (error) {
    // Log queue monitoring error
    await prisma.integrationLog.create({
      data: {
        service: "QUEUE_MONITORING",
        action: `monitor_queue:${queueName}`,
        status: "ERROR",
        error:
          error instanceof Error
            ? error.message
            : "Failed to monitor queue",
        errorCategory: "QUEUE_MONITORING",
        errorSeverity: "warning",
        metadata: {
          queueName,
          durationMs: Date.now() - startTime,
        },
      },
    });

    console.error(
      `[QUEUE_MONITOR] Error monitoring queue ${queueName}:`,
      error
    );
  }

  const totalIssues = staleFailed + deadJobs + stuckJobs;

  return {
    staleFailed,
    deadJobs,
    stuckJobs,
    totalIssues,
  };
}

/**
 * Helper to log a monitoring issue to IntegrationLog
 */
async function logMonitoringIssue(details: {
  queueName: string;
  jobId: string;
  jobName: string;
  jobState: string;
  ageMs: number;
  reason: string;
  failureCount: number;
}): Promise<void> {
  try {
    await prisma.integrationLog.create({
      data: {
        service: "QUEUE_MONITORING",
        action: `${details.queueName}:${details.jobName}`,
        status: "WARNING",
        errorCategory: "QUEUE_MONITORING",
        errorSeverity: "warning",
        metadata: {
          queueName: details.queueName,
          jobId: details.jobId,
          jobName: details.jobName,
          jobState: details.jobState,
          ageMs: details.ageMs,
          ageHours: Math.floor(details.ageMs / (3600 * 1000)),
          ageDays: Math.floor(details.ageMs / (24 * 3600 * 1000)),
          failureCount: details.failureCount,
          reason: details.reason,
        },
      },
    });
  } catch (error) {
    console.error(
      `[QUEUE_MONITOR] Failed to log monitoring issue:`,
      error
    );
  }
}


/**
 * Monitor all queues in parallel
 *
 * @param queueNames - List of queue names to monitor
 * @param options - Monitoring options (applied to all queues)
 * @returns Aggregated results across all queues
 *
 * Used by the monitoring cron endpoint to check all queues at once.
 * Returns summary per queue for dashboarding.
 */
export async function monitorAllQueues(
  queueNames: string[],
  options?: MonitorOptions
): Promise<{
  results: Record<
    string,
    {
      staleFailed: number;
      deadJobs: number;
      stuckJobs: number;
      totalIssues: number;
    }
  >;
  totalStaleJobs: number;
  totalDeadJobs: number;
  totalStuckJobs: number;
  totalIssuesAcrossQueues: number;
}> {
  // Check if Redis is properly configured before attempting to connect
  const redisCheck = isRedisConfigured();
  if (!redisCheck.configured) {
    console.warn(`[QUEUE_MONITOR] Redis not configured: ${redisCheck.reason}. Skipping queue monitoring.`);

    return {
      results: {},
      totalStaleJobs: 0,
      totalDeadJobs: 0,
      totalStuckJobs: 0,
      totalIssuesAcrossQueues: 0,
    };
  }

  const results: Record<
    string,
    {
      staleFailed: number;
      deadJobs: number;
      stuckJobs: number;
      totalIssues: number;
    }
  > = {};

  let totalStaleJobs = 0;
  let totalDeadJobs = 0;
  let totalStuckJobs = 0;

  // Monitor queues in parallel for efficiency
  const monitorPromises = queueNames.map(async (queueName) => {
    const result = await monitorQueue(queueName, options);
    results[queueName] = result;
    totalStaleJobs += result.staleFailed;
    totalDeadJobs += result.deadJobs;
    totalStuckJobs += result.stuckJobs;
  });

  await Promise.all(monitorPromises);

  const totalIssuesAcrossQueues =
    totalStaleJobs + totalDeadJobs + totalStuckJobs;

  return {
    results,
    totalStaleJobs,
    totalDeadJobs,
    totalStuckJobs,
    totalIssuesAcrossQueues,
  };
}
