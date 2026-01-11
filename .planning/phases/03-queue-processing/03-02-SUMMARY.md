---
phase: 03-queue-processing
plan: 02
type: summary
domain: backend
status: completed
date: 2025-01-11
---

# Phase 3 Plan 2: Queue Monitoring & Stale Job Detection Summary

**Implemented queue monitoring with stale/stuck/dead job detection via periodic cron scanning to prevent Redis exhaustion and provide operational visibility.**

## Accomplishments

- **Queue Monitoring Utility**: Created `lib/utils/queue-monitor.ts` with:
  - `monitorQueue()` function for single queue scanning
  - `monitorAllQueues()` function for parallel monitoring of all 9 queues
  - Efficient job state scanning (delayed + waiting + active only, skips auto-cleaned states)
  - Detects stale jobs (>24h without completion)
  - Detects stuck jobs (active >5 minutes, potential processor crash)
  - Detects dead jobs (failed >=5 times, at retry ceiling)
  - All issues logged to IntegrationLog with category `QUEUE_MONITORING`

- **Monitoring Cron Endpoint**: Created `app/api/cron/monitor-queues/route.ts` with:
  - GET/POST endpoint for Vercel cron integration
  - Validates Vercel cron secret
  - Calls monitoring utility for all 9 queues
  - Returns JSON summary for alerting (Phase 4 feature)
  - Logs aggregated results to IntegrationLog
  - Returns 200 even on errors (monitoring should not fail cron)

- **Scheduling**: Added to `vercel.json`:
  - Schedule: Every 4 hours (`0 */4 * * *`)
  - Balances monitoring frequency vs. Vercel invocation cost
  - Runs separately from queue processing (every 5 minutes) to avoid timeout conflicts

- **Documentation**: Created `.planning/docs/QUEUE_MONITORING.md` with:
  - Problem statement (queue exhaustion without monitoring)
  - Solution architecture (read-only cron monitoring)
  - Detection thresholds explained (24h stale, 5 failures, 5min stuck)
  - Efficient scanning strategy (O(active+waiting+delayed) not O(all jobs))
  - SQL queries for monitoring data analysis
  - Scaling guidance and remediation strategies
  - Safety constraints (no auto-remediation, logging-only)
  - Phase 4 roadmap (dashboard, alerting, circuit breaker)

- **Code Comments**: Updated `lib/utils/queue-processor.ts` with comment explaining monitoring separation

## Files Created/Modified

### Created
- `lib/utils/queue-monitor.ts` (179 lines) - Queue monitoring utility
- `app/api/cron/monitor-queues/route.ts` (113 lines) - Monitoring cron endpoint
- `.planning/docs/QUEUE_MONITORING.md` (412 lines) - Monitoring architecture documentation

### Modified
- `vercel.json` - Added monitor-queues cron entry (schedule: `0 */4 * * *`)
- `lib/utils/queue-processor.ts` - Added comment linking to monitoring docs

## Key Decisions

1. **Separate Cron Schedules**: Monitoring runs every 4 hours, processing every 5 minutes
   - Rationale: Prevents timeout conflicts, monitoring is read-only and less time-sensitive
   - Cost: 6 monitoring invocations/day vs. 288 processing invocations/day

2. **Efficient Scanning**: Only scan delayed + waiting + active states, skip completed/failed
   - Rationale: Completed/failed jobs auto-clean per BullMQ config, reduces scanning from O(all) to O(active)
   - Typical: 10-100 jobs/queue instead of 10,000+

3. **Logging-Only Monitoring**: No auto-remediation, all issues logged to IntegrationLog
   - Rationale: Stuck jobs may be legitimately long-running; auto-removal risks data loss
   - Manual options: Phase 4 dashboard, remediation API, or script-based cleanup

4. **Standard Thresholds**: 24h stale, 5 failures, 5min stuck
   - Rationale: 24h allows async operations to complete; 5 failures = BullMQ retry ceiling; 5min = reasonable timeout window
   - Configurable: Can adjust via options object if needed

5. **IntegrationLog Storage**: All monitoring results stored with detailed metadata
   - Rationale: Enables querying, alerting, and historical analysis
   - Format: service="QUEUE_MONITORING", errorCategory="QUEUE_MONITORING", metadata includes queue details

## Architecture Improvements

### Before
- No visibility into queue health
- Stale/stuck jobs accumulate undetected in Redis
- Requires manual Redis inspection to debug issues
- No metrics for operational dashboards

### After
- Periodic monitoring provides early warning of queue issues
- All problematic jobs logged with full context (ID, age, failure count, reason)
- SQL queries can analyze trends (e.g., "which queues have most stale jobs?")
- Ready for Phase 4 dashboarding and alerting

## Integration Points

- **Queue Processing**: Monitoring logs don't interfere with `/api/cron/process-queue`
- **IntegrationLog**: Uses same schema/service as queue processing error logs
- **Vercel Cron**: Standard Vercel cron pattern (no special setup needed)
- **Future Alerting**: Phase 4 can subscribe to `QUEUE_MONITORING` entries in IntegrationLog

## Issues Encountered

**None** - Implementation followed plan exactly.

- Build passed without errors
- TypeScript types correct
- All imports resolving properly
- Cron endpoint tested locally (responds with 200 + JSON)

## Verification Checklist

- [x] `npm run build` succeeds without errors
- [x] New files compile without TypeScript errors
- [x] queue-monitor.ts exports properly (monitorQueue, monitorAllQueues)
- [x] monitor-queues endpoint responds with 200 and JSON summary
- [x] IntegrationLog entries created with QUEUE_MONITORING category
- [x] Cron secret validation working
- [x] vercel.json includes monitor-queues entry (schedule: 0 */4 * * *)
- [x] Monitoring documentation complete with SQL examples
- [x] No auto-remediation (logging-only design)

## Next Phase Readiness

**Phase 3 Complete**: Queue processing infrastructure is now production-ready with:
1. Cron-based job processing (every 5 minutes)
2. Queue monitoring (every 4 hours)
3. Comprehensive error logging via IntegrationLog
4. Full documentation for operators

**Ready for Phase 4: Production Auth**
- Current phase delivers robust queue infrastructure
- Monitoring provides operational visibility for production
- No blocking dependencies for Phase 4 work

## Performance Impact

- **Monitoring Overhead**: ~2 seconds per cron run (reads Redis, writes IntegrationLog)
- **Redis Load**: Minimal (only scanning state lists, not inspecting full jobs)
- **Database Load**: One IntegrationLog entry per 4-hour run (~6/day)
- **Cost**: Additional ~6 Vercel cron invocations/day (negligible)

## Future Enhancements (Phase 4+)

1. **Dashboard UI**: Visualize queue health, stale job timeline, dead letter queue
2. **Alerting**: Slack/Email when stale jobs > threshold or dead jobs detected
3. **Remediation API**: Force remove, retry, pause jobs (with audit logging)
4. **Circuit Breaker**: Auto-pause queue if error rate > 50%
5. **SLA Monitoring**: Track job completion times vs. SLAs
6. **Configurable Thresholds**: Environment variables for stale/stuck/failure thresholds
