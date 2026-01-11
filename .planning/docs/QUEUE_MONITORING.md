# Queue Monitoring Architecture

## Overview

Queue monitoring detects and logs problematic jobs (stale, stuck, dead) to prevent queue exhaustion in Redis. This document explains the monitoring strategy, thresholds, and how to use monitoring data for debugging.

## Problem Statement

Without monitoring, problematic jobs accumulate in Redis:
- **Stale jobs**: Created hours ago but never complete (may be stuck processor)
- **Stuck jobs**: Actively processing for >5 minutes (processor may have crashed)
- **Dead jobs**: Failed >= 5 times (at retry ceiling, need manual intervention)

This accumulation consumes Redis memory, blocks new jobs from processing, and hides underlying issues.

## Solution: Periodic Monitoring

**Endpoint**: `/api/cron/monitor-queues`
**Schedule**: Every 4 hours (via Vercel cron)
**Implementation**: `lib/utils/queue-monitor.ts`

The monitoring system:
1. Scans all 9 queues for problematic jobs (read-only, no modifications)
2. Logs issues to `IntegrationLog` table with category `QUEUE_MONITORING`
3. Returns JSON summary for alerting (Phase 4)
4. Runs separately from job processing to avoid timeout conflicts

## Detection Thresholds

### Stale Jobs
- **Definition**: Created > 24 hours ago, still in waiting/active state
- **Threshold**: 24 hours (adjustable via `staleThresholdMs` option)
- **Reason**: Most jobs should process within hours. If a job is waiting 24h+, something is wrong.
- **Action**: Logged as warning with details (job ID, age, failure count)
- **Manual remediation**: If job is genuinely long-running, increase threshold. Otherwise, investigate processor.

### Dead Jobs
- **Definition**: Failed >= 5 times
- **Threshold**: 5 attempts (configurable via `failureThreshold` option)
- **Reason**: BullMQ exponential backoff defaults to 3 attempts. After 5, we assume permanent failure.
- **Action**: Logged as error. BullMQ will dead-letter these per `removeOnFail` config.
- **Manual remediation**: Check IntegrationLog for error pattern. Fix underlying issue (API, database, permission) before retrying.

### Stuck Active Jobs
- **Definition**: Actively processing for > 5 minutes
- **Threshold**: 5 minutes (configurable via `stuckThresholdMs` option)
- **Reason**: Individual job timeout is 5 seconds. If a job is active 5min+, processor likely crashed or hung.
- **Action**: Logged as warning but NOT removed (job may still complete). Requires human investigation.
- **Manual remediation**: Check processor logs. If processor indeed crashed, restart. Then monitor queue depth.

## Efficient Scanning Strategy

Instead of scanning ALL jobs (expensive O(n) operation), we only check:
- **delayed**: Scheduled jobs that may become stale
- **waiting**: Ready to process, may become stale
- **active**: Currently processing, may be stuck

We SKIP:
- **completed**: Auto-cleaned by BullMQ `removeOnComplete` setting
- **failed**: Auto-cleaned by BullMQ `removeOnFail` setting
- **paused**: Admin-paused, safe to ignore

This reduces scanning from O(all jobs) to O(active + waiting + delayed), typically 10-100 jobs per queue instead of 10,000+.

## Monitoring Data

### View Monitoring Results

Query IntegrationLog to see all monitoring runs and issues:

```sql
-- All monitoring activities (last 7 days)
SELECT * FROM integration_logs
WHERE service = 'QUEUE_MONITORING'
AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- Specific queue issues (last 24 hours)
SELECT * FROM integration_logs
WHERE service = 'QUEUE_MONITORING'
AND metadata->'queueName' = '"leadQualification"'
AND created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;

-- Stale job summary (count by queue)
SELECT
  metadata->'queueName' as queue,
  COUNT(*) as issue_count,
  COUNT(*) FILTER (WHERE metadata->>'reason' LIKE 'Stale%') as stale_count,
  COUNT(*) FILTER (WHERE metadata->>'reason' LIKE 'Stuck%') as stuck_count,
  COUNT(*) FILTER (WHERE metadata->>'reason' LIKE 'Dead%') as dead_count
FROM integration_logs
WHERE service = 'QUEUE_MONITORING'
AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY metadata->'queueName'
ORDER BY issue_count DESC;
```

### Monitoring Results Format

Each monitoring run creates an IntegrationLog entry with:
```json
{
  "service": "QUEUE_MONITORING",
  "action": "monitor_all_queues",
  "status": "WARNING",  // SUCCESS if no issues, WARNING if stale/stuck found, ERROR if monitoring failed
  "durationMs": 2150,
  "errorCategory": "QUEUE_MONITORING",
  "errorSeverity": "warning",  // info, warning, error, or critical
  "metadata": {
    "queuesMonitored": 9,
    "totalStaleJobs": 3,
    "totalDeadJobs": 1,
    "totalStuckJobs": 0,
    "totalIssuesAcrossQueues": 4,
    "detailedResults": {
      "leadQualification": { "staleFailed": 1, "deadJobs": 0, "stuckJobs": 0, "totalIssues": 1 },
      "whatsappMessages": { "staleFailed": 2, "deadJobs": 1, "stuckJobs": 0, "totalIssues": 3 },
      // ... other queues
    }
  }
}
```

## Scaling & Remediation

### If Stale Jobs Accumulate

1. **Check processor logs**: Is `/api/cron/process-queue` running?
2. **Check queue depth**: `LLEN queue:leadQualification:waiting` in Redis
3. **Identify bottleneck**:
   - If AI qualification slow → reduce `leadQualification.maxJobs` in queue-processor.ts
   - If external API slow → check circuit breaker status
   - If database slow → check PostgreSQL connection pool
4. **Increase cron frequency** (last resort): Change `*/5` to `*/3` in vercel.json (requires restart)

### If Dead Jobs Accumulate

1. **Identify error pattern**: Group IntegrationLog entries by error message
2. **Fix root cause**:
   - Missing credentials? Add to env vars
   - API endpoint changed? Update service
   - Permission denied? Check token expiration
3. **Retry**:
   - Option A: Manual via queue dashboard (Phase 4 feature)
   - Option B: Script to manually re-queue failed jobs
   - Option C: Wait for BullMQ exponential backoff (retries every 2 seconds)

### If Stuck Active Jobs Accumulate

1. **Check processor**: Is `/api/cron/process-queue` responding?
2. **Check external service**: Is the API/database reachable?
3. **Restart processor**: Since cron-based, just wait for next 5-minute cron run
4. **Reduce max jobs**: If pattern repeats, reduce `maxJobs` for that queue

## Safety: No Auto-Remediation

**Monitoring is LOGGING-ONLY** to prevent unintended side effects:
- Jobs are never force-removed (processor may still be working)
- Job data is never modified
- No automatic retries triggered (exponential backoff is automatic, monitoring doesn't interfere)
- All decisions logged for human review

This is intentional: stuck jobs may be legitimately long-running (e.g., bulk import of 10,000 records). Automatic removal would cause data loss.

## Future Enhancements (Phase 4)

Monitoring currently logs issues. Phase 4 will add:

1. **Dashboard UI**: Visualize queue health, stale job trends
2. **Alerting**: Slack/Email when stale jobs > threshold
3. **Manual Remediation API**: Force remove, retry, or pause jobs
4. **Circuit Breaker Integration**: Pause queue if error rate > threshold
5. **SLA Monitoring**: Track queue SLAs (e.g., "process 95% of jobs within 1 hour")

## Technical Details

### Implementation Files

- **`lib/utils/queue-monitor.ts`**: Core monitoring logic
  - `monitorQueue()`: Monitor single queue
  - `monitorAllQueues()`: Monitor all queues in parallel
  - Efficient scanning (delayed + waiting + active only)
  - Structured logging to IntegrationLog

- **`app/api/cron/monitor-queues/route.ts`**: Cron endpoint
  - Vercel cron secret validation
  - Calls monitorAllQueues() with standard thresholds
  - Returns JSON for alerts + health checks
  - Logs summary to IntegrationLog

- **`vercel.json`**: Cron schedule
  - Schedule: Every 4 hours (`0 */4 * * *`)
  - Balances monitoring frequency vs. Vercel cost

### Integration with Queue Processing

The `/api/cron/process-queue` endpoint (runs every 5 minutes) processes jobs.
The `/api/cron/monitor-queues` endpoint (runs every 4 hours) monitors health.

**Why separate?**
1. **Timeout safety**: Processing jobs is time-sensitive. Monitoring could slow it down.
2. **Visibility**: Monitoring is read-only and won't interfere with job execution.
3. **Cost**: Monitoring every 5 minutes would be expensive. Every 4 hours is sufficient.

### Error Handling

If monitoring encounters errors:
- Queue connection fails → Logged as QUEUE_MONITORING error
- Job inspection fails → Specific error logged with context
- IntegrationLog write fails → Errors logged to console (last-resort fallback)

All monitoring errors return HTTP 200 (cron shouldn't be marked failed).

## Examples

### Example: Investigate Stale Lead Qualification Jobs

```bash
# Query stale jobs for this queue
SELECT
  id,
  metadata->'jobId' as job_id,
  metadata->'ageHours' as age_hours,
  metadata->'failureCount' as failure_count,
  metadata->'reason' as reason,
  created_at
FROM integration_logs
WHERE service = 'QUEUE_MONITORING'
AND action LIKE 'leadQualification:%'
AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;
```

Output:
```
job_id    | age_hours | failure_count | reason
----------+-----------+---------------+--------------------------------
job_123   | 25        | 2             | Stale waiting job (25h in queue)
job_124   | 23        | 1             | Stale waiting job (23h in queue)
```

**Diagnosis**: Lead qualification jobs waiting 23-25 hours with only 1-2 failures.
- Check if `/api/cron/process-queue` is running
- Check if OpenAI API is reachable (AI qualification is heavy)
- Check if database is slow (persisting results)

### Example: Query Dead Jobs

```bash
SELECT
  metadata->'queueName',
  COUNT(*) as count,
  MAX(created_at) as last_seen
FROM integration_logs
WHERE service = 'QUEUE_MONITORING'
AND metadata->>'reason' LIKE 'Dead job%'
AND created_at > NOW() - INTERVAL '7 days'
GROUP BY metadata->'queueName'
ORDER BY count DESC;
```

Output:
```
queueName              | count | last_seen
-----------------------+-------+------------------------
pipedriveSync          | 12    | 2025-01-11 10:00:00
invoiceGeneration      | 3     | 2025-01-11 08:30:00
contractGeneration     | 1     | 2025-01-10 15:45:00
```

**Diagnosis**: Pipedrive sync has 12 dead jobs in 7 days.
- Check Pipedrive API status (token expiration? rate limits?)
- Review error logs to identify specific API error
- Fix and retry, or increase retry threshold if API is unstable

## Configuration Reference

Monitoring thresholds can be adjusted via environment variables (future enhancement) or by modifying constants in `lib/utils/queue-monitor.ts`:

```typescript
// Current defaults in code:
staleThresholdMs: 24 * 3600 * 1000,  // 24 hours
failureThreshold: 5,                 // Retry ceiling
stuckThresholdMs: 5 * 60 * 1000,     // 5 minutes
```

To adjust, modify and redeploy. Example: Increase stale threshold to 48 hours:
```typescript
await monitorAllQueues(queueNames, {
  staleThresholdMs: 48 * 3600 * 1000,  // 48 hours
  failureThreshold: 5,
  stuckThresholdMs: 5 * 60 * 1000,
});
```

## Related Documentation

- `QUEUE_PROCESSING.md`: Architecture of cron-based queue processing
- `lib/utils/queue-processor.ts`: Job processing implementation
- `lib/utils/queue-monitor.ts`: Job monitoring implementation
- `vercel.json`: Cron schedule configuration
