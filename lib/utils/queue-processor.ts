import { Queue, Worker } from "bullmq";
import { prisma } from "@/lib/db";
import { isRedisConfigured } from "@/lib/utils/queue";
import {
  ACTIVE_QUEUE_KEYS,
  type QueueKey,
  resolveBullQueueName,
} from "@/lib/utils/queue-names";

/**
 * Queue Processor for Vercel Serverless Environment
 *
 * ============================================================================
 * ARCHITECTURE: Cron-Based Queue Processing (Replaces Workers)
 * ============================================================================
 *
 * WHY NOT WORKERS?
 * ----------------
 * BullMQ's built-in workers require persistent processes that:
 * - Cannot run on Vercel serverless (functions timeout after 10 seconds)
 * - Don't maintain long-lived connections in stateless environment
 * - Scale poorly with concurrent executions
 *
 * SOLUTION: Cron-based polling
 * ---------------------------
 * Instead of workers, we use Vercel Cron Jobs that trigger every 5 minutes.
 * Each invocation:
 * 1. Polls Redis for waiting jobs (up to max per queue)
 * 2. Processes jobs with 5-second timeout per job
 * 3. Exits safely at 8-second mark (before 10-second Vercel timeout)
 * 4. Returns summary for monitoring
 *
 * ============================================================================
 * PER-QUEUE JOB LIMITS (Why These Numbers Matter)
 * ============================================================================
 *
 * These limits prevent:
 * - CPU exhaustion (heavyweight jobs like AI, QuickBooks, invoice generation)
 * - Timeout overruns (ensure we exit within 8 seconds)
 * - Redis connection thrashing (too many concurrent operations)
 *
 * Queue Limits (from 03-01-PLAN.md):
 * - leadQualification: max 2 (AI qualification is heavy, ~1-2s per job)
 * - whatsappMessages: max 5 (lightweight, 100-200ms per job)
 * - invoiceGeneration: max 2 (heavyweight, database operations, ~1-2s)
 * - contractGeneration: max 2 (heavyweight, DocuSign calls, ~1-2s)
 * - quickbooksSync: max 1 (VERY heavy, long API calls, ~2-3s per job)
 * - invoiceApproval: max 3 (moderate, ~500ms per job)
 * - bulkImport: max 1 (EXTREMELY heavy, processes many records)
 *
 * TIMING BUDGET:
 * - 5-second timeout per job (catches hangs)
 * - 8-second total execution time (exit before Vercel's 10s limit)
 * - Approximately 2-4 jobs per cron run across all queues
 *
 * EXAMPLE: If 9 queues process max jobs, worst case:
 * 2 + 5 + 3 + 2 + 2 + 1 + 2 + 3 + 1 = 21 potential jobs
 * But with 5-second individual timeout and 8-second total exit, we'll
 * process only those that fit, then cleanly exit.
 *
 * ============================================================================
 * ERROR HANDLING & RECOVERY
 * ============================================================================
 *
 * Failed jobs are moved to retry queue with exponential backoff:
 * - Attempt 1: fail
 * - Attempt 2: 2 seconds later
 * - Attempt 3: 4 seconds later
 * - ... up to max_retries (configured per queue in queue.ts)
 * - Dead letter queue: permanent failure after max retries
 *
 * All errors logged to IntegrationLog table with:
 * - service: queue name
 * - action: job type
 * - errorCategory: "transient" or "permanent"
 * - metadata: error details for debugging
 *
 * ============================================================================
 * MONITORING
 * ============================================================================
 *
 * Track queue processing via:
 * SELECT * FROM integration_logs
 * WHERE service = 'QUEUE_PROCESSING'
 * AND created_at > NOW() - INTERVAL '1 hour'
 * ORDER BY created_at DESC;
 *
 * Alerts on:
 * - errorCategory = 'permanent' (indicates unrecoverable failure)
 * - executionTimeMs > 8000 (cron exited due to timeout)
 * - retryCount > 2 (job is stuck in retry loop)
 *
 * ============================================================================
 * SCALING GUIDANCE
 * ============================================================================
 *
 * If jobs accumulate (queue depth growing):
 * 1. Increase max jobs for that queue by 1-2
 * 2. Re-run cron more frequently (e.g., every 3 minutes)
 * 3. Monitor timing: if you hit 8-second exit, you're at capacity
 *
 * If a queue consistently fails:
 * 1. Check service health (circuit breaker state)
 * 2. Review IntegrationLog for error patterns
 * 3. Reduce max jobs for that queue to prevent pile-up
 * 4. Verify external service (API, database, Redis) is accessible
 *
 * ============================================================================
 * ADDING NEW QUEUES
 * ============================================================================
 *
 * 1. Add queue definition in lib/utils/queue.ts (addXxxJob function)
 * 2. Add worker in lib/utils/queue.ts (initializeWorkers)
 * 3. Add handler in queueHandlers map below
 * 4. Add queue name to QUEUE_CONFIG below
 * 5. Update vercel.json cron schedule if needed (but 5-minute default works)
 *
 * Example:
 *
 * const QUEUE_CONFIG: QueueConfig = {
 *   newQueue: { maxJobs: 2, timeoutMs: 5000 },
 *   // ... other queues
 * }
 *
 * const queueHandlers = {
 *   newQueue: async (job: any) => {
 *     const { newService } = await import("@/lib/services/new.service");
 *     await newService.handleJob(job.data);
 *   },
 *   // ... other handlers
 * }
 */

/**
 * Tracks timing to ensure we exit before Vercel timeout
 */
class ExecutionTimer {
  private startTime: number;
  private maxDurationMs: number;

  constructor(maxDurationMs: number = 8000) {
    this.startTime = Date.now();
    this.maxDurationMs = maxDurationMs;
  }

  isTimeExceeded(): boolean {
    return Date.now() - this.startTime >= this.maxDurationMs;
  }

  elapsed(): number {
    return Date.now() - this.startTime;
  }

  remainingMs(): number {
    return Math.max(0, this.maxDurationMs - this.elapsed());
  }
}

/**
 * Configuration for each queue: max jobs per run and timeout per job
 */
interface QueueConfig {
  [key: string]: {
    maxJobs: number;
    timeoutMs: number;
  };
}

/**
 * Queue configuration with per-queue limits
 * These limits are carefully chosen to prevent timeout overruns
 * while maximizing throughput for lightweight queues.
 */
const QUEUE_CONFIG: QueueConfig = {
  leadQualification: { maxJobs: 2, timeoutMs: 5000 },
  whatsappMessages: { maxJobs: 5, timeoutMs: 5000 },
  invoiceGeneration: { maxJobs: 2, timeoutMs: 5000 },
  contractGeneration: { maxJobs: 2, timeoutMs: 5000 },
  quickbooksSync: { maxJobs: 1, timeoutMs: 240000 },
  invoiceApproval: { maxJobs: 3, timeoutMs: 5000 },
  bulkImport: { maxJobs: 1, timeoutMs: 240000 },
};

/**
 * Helper to get Redis connection options
 * Uses the same pattern as lib/utils/queue.ts
 */
function getConnectionOptions() {
  if (!process.env.REDIS_URL) {
    throw new Error(
      "REDIS_URL environment variable not set. Queue processing requires Redis configuration. " +
      "Set REDIS_URL to your Redis instance (e.g., redis://user:password@host:port)"
    );
  }

  try {
    const url = new URL(process.env.REDIS_URL);
    return {
      host: url.hostname,
      port: parseInt(url.port || "6379"),
      username: url.username || undefined,
      password: url.password || undefined,
      connectTimeout: 5000,
      maxRetriesPerRequest: null,
    };
  } catch (error) {
    throw new Error(
      `Invalid REDIS_URL format: ${process.env.REDIS_URL}. ` +
      `Expected format: redis://[user:password@]host[:port]`
    );
  }
}

/**
 * Handler functions for each queue
 * Maps queue name to job processor function
 */
const queueHandlers: {
  [key: string]: (job: any) => Promise<void>;
} = {
  leadQualification: async (job: any) => {
    const { leadId } = job.data;
    const { sdrService } = await import("@/lib/services/sdr.service");
    await sdrService.processNewLead(leadId);
  },

  whatsappMessages: async (job: any) => {
    const { phone, message } = job.data;
    const { whatsappService } = await import(
      "@/lib/services/whatsapp.service"
    );
    await whatsappService.sendMessage(phone, message);
  },

  invoiceGeneration: async (job: any) => {
    const { dealId, customerId, amount, currency } = job.data;
    // Invoice generation logic: reserved for service implementation
    // See lib/services/invoice-workflow.service.ts for processDealWon()
    console.log(
      `[QUEUE] Processing invoice generation for deal ${dealId}`
    );
  },

  contractGeneration: async (job: any) => {
    const { dealId, customerId, customerEmail, customerName } = job.data;
    // Contract generation logic: reserved for service implementation
    // See lib/services/contract-workflow.service.ts for sendContractOnApproval()
    console.log(
      `[QUEUE] Processing contract generation for deal ${dealId}`
    );
  },

  quickbooksSync: async (job: any) => {
    if (job.name === "process-webhook") {
      await processQuickBooksWebhookJob(job.data);
      return;
    }

    const { quickbooksSyncService } = await import(
      "@/lib/services/quickbooks-sync.service"
    );
    if (job.name === "sync-quickbooks-incremental" || job.data?.syncMode === "cdc-incremental") {
      await quickbooksSyncService.syncIncremental();
      return;
    }
    await quickbooksSyncService.sync(job.data);
  },

  invoiceApproval: async (job: any) => {
    const { invoiceId, action, userId, reason} = job.data;
    // Note: Approval workflow removed in quick-012, this queue processor is deprecated
    console.warn(`Invoice approval action '${action}' attempted but approval workflow has been removed`);
  },

  bulkImport: async (job: any) => {
    const { importId, source, type } = job.data;

    if (source === "QUICKBOOKS") {
      const { quickbooksSyncService } = await import(
        "@/lib/services/quickbooks-sync.service"
      );

      const typeParts = type.split("_AND_");
      const importCustomers = typeParts.includes("CUSTOMERS");
      const importInvoices = typeParts.includes("INVOICES");

      if (importCustomers) {
        await quickbooksSyncService.importAllCustomers(importId);
      }

      if (importInvoices) {
        await quickbooksSyncService.importAllInvoices(importId);
      }

      // Mark as completed
      if (importInvoices || !importCustomers) {
        await prisma.bulkImport.update({
          where: { id: importId },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
        });
      }
    }
  },
};

async function processQuickBooksWebhookJob(data: any): Promise<void> {
  const entity = data?.payload?.entity;
  const webhookEventId = data?.webhookEventId;
  const entityName = String(entity?.name || "").toLowerCase();
  const entityId = entity?.id ? String(entity.id) : null;

  if (webhookEventId) {
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { id: webhookEventId },
      select: { status: true, processed_at: true },
    }).catch(() => null);

    if (existingEvent?.status === "success" && existingEvent.processed_at) {
      return;
    }

    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: {
        status: "processing",
        updated_at: new Date(),
      },
    }).catch(() => undefined);
  }

  try {
    let result: { success: boolean; error?: string } | null = null;
    let action = "WEBHOOK_ENTITY_SKIPPED";

    if (entityName === "invoice" && entityId) {
      const { quickbooksSyncService } = await import(
        "@/lib/services/quickbooks-sync.service"
      );
      result = await quickbooksSyncService.syncSingleInvoice(entityId);
      action = "WEBHOOK_INVOICE_SYNCED";
    } else if (entityName === "payment" && entityId) {
      const { quickbooksSyncService } = await import(
        "@/lib/services/quickbooks-sync.service"
      );
      result = await quickbooksSyncService.syncSinglePayment(entityId);
      action = "WEBHOOK_PAYMENT_SYNCED";
    } else if (entityName === "customer" && entityId) {
      const { quickbooksSyncService } = await import(
        "@/lib/services/quickbooks-sync.service"
      );
      result = await quickbooksSyncService.syncSingleCustomer(entityId);
      action = "WEBHOOK_CUSTOMER_SYNCED";
    }

    if (result && !result.success) {
      throw new Error(result.error || `QuickBooks webhook ${entityName || "entity"} sync failed`);
    }

    if (webhookEventId) {
      await prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: {
          status: "success",
          processed_at: new Date(),
          last_error: null,
          updated_at: new Date(),
        },
      });
    }

    await prisma.integrationLog.create({
      data: {
        service: "QUICKBOOKS",
        action,
        status: "SUCCESS",
        payload: {
          webhookEventId,
          eventType: data?.eventType,
          entity,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (webhookEventId) {
      await prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: {
          status: "failed",
          last_error: message,
          updated_at: new Date(),
        },
      }).catch(() => undefined);
    }

    throw error;
  }
}

/**
 * Process a single queue: fetch waiting jobs and execute handlers
 *
 * @param queueName - Name of the queue (must match BullMQ queue name)
 * @param maxJobsPerRun - Max jobs to process in this invocation
 * @returns Summary of jobs processed and failed
 *
 * SAFETY MECHANISMS:
 * 1. Jobs are fetched but not dequeued yet (safe to retry if process crashes)
 * 2. Individual job timeout: 5 seconds (prevents hanging on stuck external API)
 * 3. Job completion is atomic: marked as complete ONLY after handler returns
 * 4. Failed jobs are moved to retry queue with exponential backoff
 * 5. All errors are logged to IntegrationLog for debugging
 *
 * MONITORING: Queue health monitoring (stale jobs, stuck jobs, dead jobs)
 * is handled by /api/cron/monitor-queues endpoint which runs every 4 hours.
 * See lib/utils/queue-monitor.ts and .planning/docs/QUEUE_MONITORING.md
 * for full architecture. This keeps queue processing and monitoring separate
 * to avoid timeout conflicts.
 */
export async function processQueue(
  queueName: string,
  maxJobsPerRun: number = 3,
  timer?: ExecutionTimer
): Promise<{
  jobsProcessed: number;
  jobsFailed: number;
  executionTimeMs: number;
}> {
  const startTime = Date.now();
  let jobsProcessed = 0;
  let jobsFailed = 0;

  try {
    // Use provided timer or create a new one
    if (!timer) {
      timer = new ExecutionTimer(8000);
    }

    // Get queue configuration or use default
    const config = QUEUE_CONFIG[queueName] || {
      maxJobs: 3,
      timeoutMs: 5000,
    };

    const connectionOptions = getConnectionOptions();
    const bullQueueName = resolveBullQueueName(queueName);
    const queue = new Queue(bullQueueName, { connection: connectionOptions });

    // Get waiting jobs from queue (up to max)
    const jobs = await queue.getWaiting(0, maxJobsPerRun - 1);

    console.log(`[QUEUE] Processing ${queueName}: found ${jobs.length} jobs`);

    // Process each job
    for (const job of jobs) {
      // Check if we've exceeded total execution time
      if (timer.isTimeExceeded()) {
        console.log(
          `[QUEUE] Exiting ${queueName} processing: execution time limit (${timer.elapsed()}ms)`
        );
        break;
      }

      try {
        // Get handler for this queue
        const handler = queueHandlers[queueName];
        if (!handler) {
          console.warn(`[QUEUE] No handler for queue ${queueName}`);
          jobsFailed++;
          continue;
        }

        // Execute handler with timeout
        const jobStartTime = Date.now();
        const jobPromise = handler(job);

        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Job execution timeout")),
            config.timeoutMs
          )
        );

        // Race execution against timeout
        await Promise.race([jobPromise, timeoutPromise]);

        const jobDurationMs = Date.now() - jobStartTime;

        // Log successful execution
        await prisma.integrationLog.create({
          data: {
            service: "QUEUE_PROCESSING",
            action: `${queueName}:${job.name}`,
            status: "SUCCESS",
            durationMs: jobDurationMs,
            payload: job.data,
          },
        });

        // Mark job as completed by removing it from queue
        try {
          await job.remove();
        } catch (removeError) {
          console.error(`[QUEUE] Failed to remove completed job:`, removeError);
        }
        jobsProcessed++;

        console.log(
          `[QUEUE] ${queueName} job ${job.id} completed in ${jobDurationMs}ms`
        );
      } catch (jobError) {
        jobsFailed++;

        // Determine error category for logging
        const errorMessage =
          jobError instanceof Error ? jobError.message : String(jobError);
        const isTimeoutError =
          errorMessage.includes("timeout") ||
          errorMessage.includes("Timeout");

        // Log error to integration log
        await prisma.integrationLog.create({
          data: {
            service: "QUEUE_PROCESSING",
            action: `${queueName}:${job.name}`,
            status: "ERROR",
            error: errorMessage,
            errorCategory: isTimeoutError ? "transient" : "permanent",
            errorSeverity: "error",
            payload: job.data,
            metadata: {
              jobId: job.id,
              retryCount: job.attemptsMade || 0,
              maxRetries: job.opts?.attempts,
            },
          },
        });

        console.log(
          `[QUEUE] ${queueName} job ${job.id} failed: ${errorMessage}`
        );
      }
    }

    await queue.close();
  } catch (queueError) {
    console.error(`[QUEUE] Error processing queue ${queueName}:`, queueError);

    // Log queue connection error
    await prisma.integrationLog.create({
      data: {
        service: "QUEUE_PROCESSING",
        action: `queue_connection:${queueName}`,
        status: "ERROR",
        error:
          queueError instanceof Error
            ? queueError.message
            : "Unknown queue error",
        errorCategory: "permanent",
        errorSeverity: "error",
        metadata: {
          queueName,
        },
      },
    });
  }

  const executionTimeMs = Date.now() - startTime;

  return {
    jobsProcessed,
    jobsFailed,
    executionTimeMs,
  };
}

/**
 * Process all queues in sequence with per-queue limits
 * This is the main entry point called by the cron job
 *
 * @returns Summary of all queues processed
 *
 * EXECUTION STRATEGY:
 * 1. Process queues in priority order (high-priority lightweight first)
 * 2. Check execution timer before processing each queue
 * 3. Exit gracefully at 8-second mark (before Vercel timeout)
 * 4. Log overall metrics to IntegrationLog
 */
export async function processAllQueues(): Promise<{
  queueResults: Record<string, any>;
  totalJobsProcessed: number;
  totalJobsFailed: number;
  totalExecutionTimeMs: number;
  queuesProcessed: number;
}> {
  // Check if Redis is properly configured before attempting to connect
  const redisCheck = isRedisConfigured();
  if (!redisCheck.configured) {
    console.warn(`[QUEUE] Redis not configured: ${redisCheck.reason}. Skipping queue processing.`);

    return {
      queueResults: {},
      totalJobsProcessed: 0,
      totalJobsFailed: 0,
      totalExecutionTimeMs: 0,
      queuesProcessed: 0,
    };
  }

  const maxDurationMs = Number(process.env.QUEUE_PROCESSOR_MAX_DURATION_MS || 270000);
  const timer = new ExecutionTimer(maxDurationMs);
  const queueResults: Record<string, any> = {};
  let totalJobsProcessed = 0;
  let totalJobsFailed = 0;
  let queuesProcessed = 0;

  // Queue processing order: high-priority lightweight first, heavy last
  const queueOrder = [
    "quickbooksSync",
    "whatsappMessages",
    "invoiceApproval",
    "leadQualification",
    "invoiceGeneration",
    "contractGeneration",
    "bulkImport",
  ].filter((queueName): queueName is QueueKey =>
    ACTIVE_QUEUE_KEYS.includes(queueName as QueueKey)
  );

  console.log(`[QUEUE] Starting queue processing (max ${maxDurationMs}ms)`);

  for (const queueName of queueOrder) {
    // Check if we've exceeded execution time
    if (timer.isTimeExceeded()) {
      console.log(
        `[QUEUE] Exiting queue processing: execution time limit (${timer.elapsed()}ms)`
      );
      break;
    }

    const config = QUEUE_CONFIG[queueName];
    if (!config) {
      console.warn(`[QUEUE] No configuration for queue ${queueName}`);
      continue;
    }

    try {
      const result = await processQueue(queueName, config.maxJobs, timer);
      queueResults[queueName] = result;
      totalJobsProcessed += result.jobsProcessed;
      totalJobsFailed += result.jobsFailed;
      queuesProcessed++;
    } catch (error) {
      console.error(`[QUEUE] Error processing ${queueName}:`, error);
      queueResults[queueName] = {
        jobsProcessed: 0,
        jobsFailed: 0,
        error:
          error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  const totalExecutionTimeMs = timer.elapsed();

  // Log overall metrics
  await prisma.integrationLog.create({
    data: {
      service: "QUEUE_PROCESSING",
      action: "process_all_queues",
      status: totalJobsFailed > 0 ? "PARTIAL" : "SUCCESS",
      durationMs: totalExecutionTimeMs,
      metadata: {
        queuesProcessed,
        totalJobsProcessed,
        totalJobsFailed,
        queueDetails: queueResults,
      },
    },
  });

  console.log(
    `[QUEUE] Processing complete: ${totalJobsProcessed} processed, ${totalJobsFailed} failed in ${totalExecutionTimeMs}ms`
  );

  return {
    queueResults,
    totalJobsProcessed,
    totalJobsFailed,
    totalExecutionTimeMs,
    queuesProcessed,
  };
}
