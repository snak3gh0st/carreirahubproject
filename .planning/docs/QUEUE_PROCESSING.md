# Queue Processing Architecture

**Status:** Implemented 2026-01-11 (Phase 3, Plan 1)

## Overview

Carreira AI Hub uses BullMQ for async job queues (leadQualification, whatsappMessages, pipedriveSync, invoiceGeneration, contractGeneration, quickbooksSync, pipedriveReverseSync, invoiceApproval, bulkImport). Since Vercel serverless doesn't support persistent worker processes, we use a **cron-based polling strategy** to process jobs safely within the 10-second timeout constraint.

## The Problem: Workers Don't Run on Vercel

### Why Workers Fail
BullMQ's built-in `Worker` class requires:
- Long-lived connections to Redis
- Persistent process that can sleep/wait for events
- Process lifetime > job completion time

Vercel serverless:
- Timeout: 10 seconds hard limit
- Stateless: process terminates after response
- No background processing capability

Result: **Workers are non-functional in Vercel production**

### Prior Solution Limitation
The existing `/api/cron/process-queue` only handled **bulk imports**. It didn't process the 9 core BullMQ queues, leaving jobs stuck in Redis indefinitely.

## The Solution: Cron-Based Polling

### Architecture

```
┌─────────────────────────────────────────────┐
│ Vercel Cron Job (every 5 minutes)           │
│ Schedule: "*/5 * * * *"                     │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│ GET /api/cron/process-queue                 │
│ - Validates VERCEL_CRON_SECRET (optional)   │
│ - Calls processAllQueues()                  │
│ - Returns 200 for healthcheck               │
│ - Total execution: max 8 seconds            │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│ processAllQueues()                          │
│ lib/utils/queue-processor.ts                │
│ - Instantiates ExecutionTimer (8s limit)    │
│ - Processes 9 queues in priority order      │
│ - Exits at 8s mark (2s Vercel buffer)       │
│ - Logs metrics to IntegrationLog            │
└──────────────┬──────────────────────────────┘
               │
               ├─► whatsappMessages (5 max)
               ├─► invoiceApproval (3 max)
               ├─► pipedriveReverseSync (2 max)
               ├─► pipedriveSync (3 max)
               ├─► leadQualification (2 max)
               ├─► invoiceGeneration (2 max)
               ├─► contractGeneration (2 max)
               ├─► quickbooksSync (1 max)
               └─► bulkImport (1 max)
                   [each queue calls processQueue()]
                   [processQueue() processes max N jobs]
                   [Each job wrapped with 5s timeout]
                   [Failed jobs moved to retry queue]
                   [Results logged to IntegrationLog]
```

## Key Components

### 1. ExecutionTimer (5-second granularity)

```typescript
class ExecutionTimer {
  isTimeExceeded(): boolean // true at 8 seconds
  elapsed(): number         // ms since start
  remainingMs(): number     // time left before 8s limit
}
```

Ensures we exit before Vercel's 10s timeout:
- Start timer at cron invocation
- Check before each queue: `if (timer.isTimeExceeded()) break`
- Logs when time limit is hit

### 2. Per-Queue Configuration

```typescript
const QUEUE_CONFIG = {
  leadQualification: { maxJobs: 2, timeoutMs: 5000 },  // AI heavy
  whatsappMessages: { maxJobs: 5, timeoutMs: 5000 },   // lightweight
  pipedriveSync: { maxJobs: 3, timeoutMs: 5000 },      // API heavy
  invoiceGeneration: { maxJobs: 2, timeoutMs: 5000 },  // heavyweight
  contractGeneration: { maxJobs: 2, timeoutMs: 5000 }, // heavyweight
  quickbooksSync: { maxJobs: 1, timeoutMs: 5000 },     // VERY heavy
  pipedriveReverseSync: { maxJobs: 2, timeoutMs: 5000 },
  invoiceApproval: { maxJobs: 3, timeoutMs: 5000 },
  bulkImport: { maxJobs: 1, timeoutMs: 5000 },         // EXTREMELY heavy
}
```

**Rationale for Limits:**

| Queue | Max Jobs | Reason |
|-------|----------|--------|
| leadQualification | 2 | OpenAI calls take 1-2 seconds each |
| whatsappMessages | 5 | Lightweight, 100-200ms, high priority |
| pipedriveSync | 3 | Pipedrive API calls, 500ms-1s each |
| invoiceGeneration | 2 | Database operations, PDF generation, 1-2s |
| contractGeneration | 2 | DocuSign API calls, 1-2s |
| quickbooksSync | 1 | QuickBooks API is very heavy, 2-3s per call |
| pipedriveReverseSync | 2 | Reverse sync (Hub → Pipedrive), 500ms-1s |
| invoiceApproval | 3 | Moderate complexity, ~500ms |
| bulkImport | 1 | Processes hundreds of records, very heavy |

**Timing Budget Example:**
```
Worst case (all queues at max):
2 + 5 + 3 + 2 + 2 + 1 + 2 + 3 + 1 = 21 potential jobs

With 5-second individual timeout + 8-second total exit:
- 8s / 5s = ~1.6 jobs can complete in parallel
- If faster (1s each): ~8 jobs per run
- If slower (2s each): ~4 jobs per run
- Actual mix: ~6 jobs per run average

With 5-minute cron frequency: 6 * 12 = 72 jobs/hour capacity
Should handle most production loads (typical systems: 10-50 jobs/hour)
```

### 3. Job Handler Mapping

```typescript
const queueHandlers = {
  leadQualification: async (job) => {
    const { sdrService } = await import("@/lib/services/sdr.service");
    await sdrService.processNewLead(job.data.leadId);
  },
  whatsappMessages: async (job) => {
    const { whatsappService } = await import("@/lib/services/whatsapp.service");
    await whatsappService.sendMessage(job.data.phone, job.data.message);
  },
  // ... 7 more handlers
}
```

Maps queue name → service method. All handlers are lazy-loaded (dynamic import) to reduce startup time.

### 4. processQueue Function

```typescript
async function processQueue(
  queueName: string,
  maxJobsPerRun: number = 3,
  timer?: ExecutionTimer
): Promise<{
  jobsProcessed: number
  jobsFailed: number
  executionTimeMs: number
}>
```

For each queue:
1. Fetch waiting jobs from Redis (up to maxJobsPerRun)
2. For each job:
   - Wrap handler with 5-second timeout
   - Log to IntegrationLog on success/failure
   - On timeout: move to retry queue (BullMQ handles exponential backoff)
   - Mark completed only after handler returns
3. Return summary for monitoring

### 5. processAllQueues Function

```typescript
async function processAllQueues(): Promise<{
  queueResults: Record<string, any>
  totalJobsProcessed: number
  totalJobsFailed: number
  totalExecutionTimeMs: number
  queuesProcessed: number
}>
```

Main entry point:
- Processes 9 queues in priority order (high-priority lightweight first)
- Checks timer before each queue
- Exits gracefully at 8-second mark
- Logs overall metrics to IntegrationLog

## Error Handling & Recovery

### Job Failure Strategy

When a job fails:
1. **Log to IntegrationLog** with:
   - service: "QUEUE_PROCESSING"
   - action: "{queueName}:{jobName}"
   - errorCategory: "transient" (timeout) or "permanent" (other)
   - metadata: job data for debugging

2. **Move to Retry Queue** using BullMQ's `moveToFailed()`
   - BullMQ automatically applies exponential backoff
   - Retry delay: 2s, 4s, 8s, 16s, 32m per job config
   - Max retries: 3-5 (configured per queue in queue.ts)
   - After max retries: moved to dead letter queue

### Dead Letter Queue Handling

Failed jobs that exceed max retries go to dead letter queue:
- Can be retried manually via API (future phase)
- Tracked in IntegrationLog for alerting
- Visible in Prisma Studio (npx prisma studio)

### Circuit Breaker Integration

If an external service (Pipedrive, QuickBooks, OpenAI) is down:
- Circuit breaker opens (from Phase 2 implementation)
- Jobs fail immediately with "circuit open" error
- After 60s, circuit goes HALF_OPEN and retries

## Monitoring & Observability

### IntegrationLog Queries

**Overall Queue Health:**
```sql
SELECT service, action, status, COUNT(*) as count,
       AVG(durationMs) as avg_duration_ms
FROM integration_logs
WHERE service = 'QUEUE_PROCESSING'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY service, action, status
ORDER BY count DESC;
```

**Failed Jobs:**
```sql
SELECT action, error, errorCategory, COUNT(*) as count
FROM integration_logs
WHERE service = 'QUEUE_PROCESSING'
  AND status = 'ERROR'
  AND created_at > NOW() - INTERVAL '6 hours'
GROUP BY action, error, errorCategory
ORDER BY count DESC;
```

**Queue Processing Duration:**
```sql
SELECT metadata->>'queueName', COUNT(*) as jobs,
       AVG(durationMs) as avg_ms, MAX(durationMs) as max_ms
FROM integration_logs
WHERE service = 'QUEUE_PROCESSING'
  AND action LIKE '%queue_%'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY metadata->>'queueName'
ORDER BY max_ms DESC;
```

**Cron Execution Summary:**
```sql
SELECT metadata->>'totalJobsProcessed' as jobs,
       metadata->>'totalJobsFailed' as failures,
       metadata->>'queuesProcessed' as queues,
       durationMs, createdAt
FROM integration_logs
WHERE service = 'QUEUE_PROCESSING'
  AND action = 'process_all_queues'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY createdAt DESC;
```

### Alerts to Configure

| Alert | Condition | Action |
|-------|-----------|--------|
| High Failure Rate | > 20% failed jobs | Check circuit breaker, external APIs |
| Long Execution | durationMs > 7500 | Reduce max jobs per queue |
| Queue Accumulation | queue depth > 100 | Increase max jobs or cron frequency |
| Dead Letter Growth | dead_letter queue > 10 | Review permanent failures, manual recovery |
| Cron Timeout | execution time > 8500ms | Reduce max jobs or disable heavy queue |

## Vercel Configuration

In `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/process-queue",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Schedule Explanation:**
- `*/5` = every 5 minutes
- First `*` = minute (0-59, "every 5")
- Rest = any hour, day, month, day-of-week

**Cron Frequency Decision:**
- Every 5 minutes: Good for most production loads
- Every 3 minutes: If queue accumulates quickly
- Every 10 minutes: If load is light, cost optimization
- Every 1 minute: Only if jobs must process ASAP (not typical)

## Development vs Production

### In Development (npm run dev)

Workers **can** run:
- `initializeWorkers()` creates persistent workers
- Useful for testing job handlers locally
- Workers process jobs immediately (no cron delay)

But Redis must be running (local Redis or Upstash)

### In Production (Vercel)

Workers **don't** run:
- Only cron-based processing works
- Every 5 minutes, cron wakes up and processes queues
- Up to 8 seconds per invocation
- Jobs may have 5-minute latency before processing

## Scaling Considerations

### If Jobs Accumulate

1. **Check Queue Depth:**
   ```sql
   -- Approximation (BullMQ doesn't expose queue depth easily)
   -- Monitor via Redis CLI: LLEN bull:queueName:wait
   ```

2. **Increase Max Jobs:**
   - Edit QUEUE_CONFIG in queue-processor.ts
   - Increment max jobs for the backed-up queue by 1-2
   - Monitor durationMs to ensure still < 8s

3. **Run Cron More Frequently:**
   - Change vercel.json: `"*/3 * * * *"` (every 3 minutes)
   - Trade-off: More serverless invocations = higher cost

4. **Optimize Slow Handlers:**
   - Review service implementations
   - Add caching if possible
   - Consider batch operations vs individual jobs

### If Specific Queue Fails

1. **Reduce Max Jobs:**
   - If quickbooksSync frequently times out: reduce from 1 to 0.5 (skip every other run)
   - Actually: skip if time-critical, process less frequently if not

2. **Check Circuit Breaker:**
   ```sql
   SELECT serviceName, state, failureCount, lastErrorMessage
   FROM circuit_breaker_states
   WHERE serviceName IN ('pipedrive', 'quickbooks', 'openai')
   ORDER BY lastStateChangeAt DESC;
   ```

3. **Review Error Patterns:**
   - Same error repeatedly? Service issue
   - Random timeouts? Infrastructure load
   - Auth failures? Token expired or invalid

## Adding New Queues

To add a new queue (e.g., `customerExport`):

1. **Define in queue.ts:**
   ```typescript
   export async function addCustomerExportJob(data: any) {
     await queues.customerExport.add("export-customers", data, {
       attempts: 3,
       backoff: { type: "exponential", delay: 3000 },
     });
   }
   ```

2. **Add handler in queue-processor.ts:**
   ```typescript
   const QUEUE_CONFIG: QueueConfig = {
     // ...
     customerExport: { maxJobs: 2, timeoutMs: 5000 },
   }

   const queueHandlers = {
     // ...
     customerExport: async (job: any) => {
       const { exportService } = await import("@/lib/services/export.service");
       await exportService.exportCustomers(job.data);
     },
   }
   ```

3. **Update queue order in processAllQueues():**
   ```typescript
   const queueOrder = [
     "whatsappMessages", // high priority
     // ...
     "customerExport",   // add here
     // ...
     "bulkImport",       // very heavy, last
   ];
   ```

4. **Test locally:**
   - `npm run dev` (workers will process)
   - Create test job: `await addCustomerExportJob({...})`
   - Monitor: `npx prisma studio` → integrationLogs

5. **Deploy and monitor:**
   - Watch IntegrationLog for errors
   - Check execution times
   - Adjust max jobs if needed

## Troubleshooting

### Jobs Not Processing

**Symptom:** Jobs sit in "waiting" status indefinitely

**Causes:**
1. Cron not running: Check vercel.json cron path
2. Redis connection down: Verify REDIS_URL env var
3. Handler throws error: Check IntegrationLog for error message
4. Execution timeout: Check if durationMs > 8000

**Fix:**
1. Check cron logs in Vercel dashboard
2. Verify Redis connection: `redis-cli ping` or `curl $REDIS_URL`
3. Review handler implementation and error logs
4. Reduce max jobs if timeout

### High Failure Rate

**Symptom:** > 20% of jobs fail

**Causes:**
1. External service down: Check circuit breaker state
2. Handler bug: Review error message in IntegrationLog
3. Rate limiting: Pipedrive/QuickBooks throttling requests
4. Timeout too short: Job needs > 5s

**Fix:**
1. Check `CircuitBreakerState` table
2. Review handler code and fix bug
3. Increase max jobs to spread load, or increase cron frequency
4. Review handler timing and optimize if possible

### Cron Timeout (>8s execution)

**Symptom:** Endpoint returns at 8-10s, requests timeout

**Causes:**
1. Too many jobs per queue: Exceeds budget
2. Slow external APIs: Service degradation
3. Database slow: Query optimization needed

**Fix:**
1. Reduce max jobs in QUEUE_CONFIG
2. Monitor external service health
3. Optimize database queries or add indexes

## References

- **BullMQ Docs:** https://docs.bullmq.io/
- **Vercel Cron:** https://vercel.com/docs/cron-jobs
- **Circuit Breaker Pattern:** Phase 2 implementation (02-01-PLAN.md)
- **Webhook Retry:** Phase 1 implementation (01-01-PLAN.md)
- **Architecture Decision Record:** See STATE.md "From 03-01"

## Related Files

- `lib/utils/queue.ts` - Queue definitions and worker initialization
- `lib/utils/queue-processor.ts` - Cron-based processor (this implementation)
- `app/api/cron/process-queue/route.ts` - Cron endpoint
- `vercel.json` - Cron schedule configuration
- `prisma/schema.prisma` - IntegrationLog table definition
