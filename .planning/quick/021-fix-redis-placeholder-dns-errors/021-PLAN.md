---
quick_task: 021
type: execute
autonomous: true
files_modified:
  - lib/utils/queue.ts
  - lib/utils/queue-processor.ts
  - lib/utils/queue-monitor.ts

must_haves:
  truths:
    - "Queue processing gracefully skips when Redis URL is invalid/placeholder"
    - "No DNS lookup errors in logs from placeholder hostnames"
    - "Warning message clearly indicates Redis is not configured"
  artifacts:
    - path: "lib/utils/queue.ts"
      provides: "isRedisConfigured() validation function"
    - path: "lib/utils/queue-processor.ts"
      provides: "Early exit with warning when Redis not configured"
    - path: "lib/utils/queue-monitor.ts"
      provides: "Early exit with warning when Redis not configured"
---

<objective>
Fix Redis DNS lookup errors caused by placeholder hostname in REDIS_URL

**Problem:** The cron job `/api/cron/process-queue` fails with DNS errors because REDIS_URL is set to a URL with "placeholder" as the hostname (e.g., `redis://placeholder:6379`). The URL parsing extracts "placeholder" as a valid hostname, then BullMQ attempts to connect and fails with `getaddrinfo ENOTFOUND placeholder`.

**Root Cause:** The `getConnectionOptions()` function in queue utilities parses any URL without validating whether the hostname is actually resolvable. A placeholder value passes URL parsing but fails DNS lookup at connection time.

**Solution:** Add validation to detect placeholder/invalid Redis URLs BEFORE attempting connection. Return a clear "Redis not configured" response and skip queue processing gracefully.

Output: Queue utilities that detect invalid Redis configuration and gracefully skip processing with a warning log instead of DNS errors.
</objective>

<execution_context>
@/Users/pauloloureiro/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pauloloureiro/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@lib/utils/queue.ts
@lib/utils/queue-processor.ts
@lib/utils/queue-monitor.ts
@app/api/cron/process-queue/route.ts
@app/api/cron/monitor-queues/route.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Redis URL validation utility</name>
  <files>lib/utils/queue.ts</files>
  <action>
Add a new exported function `isRedisConfigured()` that validates REDIS_URL:

1. Check if REDIS_URL environment variable exists and is non-empty
2. Try to parse as URL
3. Validate hostname is not a placeholder value:
   - Not "placeholder"
   - Not "localhost" (unless explicitly intended for dev)
   - Not "example.com" or "your-redis-host"
   - Not empty string
4. Validate port is a valid number (1-65535)
5. Return `{ configured: boolean, reason?: string }` object

Update `getConnectionOptions()` to call this validation first and log a warning if invalid.

Common placeholder patterns to detect:
- "placeholder"
- "your-redis-host"
- "redis-host"
- "example"
- Any hostname containing "placeholder" or "example"
- Empty hostname

The validation should be conservative - only block obvious placeholders, not legitimate hostnames like "redis.internal" or "my-redis-server".
  </action>
  <verify>
TypeScript compiles: `npx tsc --noEmit lib/utils/queue.ts`
  </verify>
  <done>
`isRedisConfigured()` function exported from queue.ts that detects placeholder URLs
  </done>
</task>

<task type="auto">
  <name>Task 2: Add graceful early exit to queue processor and monitor</name>
  <files>lib/utils/queue-processor.ts, lib/utils/queue-monitor.ts</files>
  <action>
Update both files to check Redis configuration BEFORE attempting to connect:

**In queue-processor.ts (`processAllQueues` function):**
1. Import `isRedisConfigured` from `@/lib/utils/queue`
2. At the start of `processAllQueues()`, call `isRedisConfigured()`
3. If not configured, log a warning: `[QUEUE] Redis not configured: {reason}. Skipping queue processing.`
4. Return early with success response (no jobs processed, no errors)
5. This prevents any Redis connection attempts

**In queue-monitor.ts (`monitorAllQueues` function):**
1. Import `isRedisConfigured` from `@/lib/utils/queue`
2. At the start of `monitorAllQueues()`, call `isRedisConfigured()`
3. If not configured, log a warning: `[QUEUE_MONITOR] Redis not configured: {reason}. Skipping queue monitoring.`
4. Return early with empty results (no issues found)

The cron endpoints already return 200 for errors, so this will result in clean cron runs with no DNS errors logged.
  </action>
  <verify>
TypeScript compiles without errors:
- `npx tsc --noEmit lib/utils/queue-processor.ts`
- `npx tsc --noEmit lib/utils/queue-monitor.ts`
  </verify>
  <done>
Queue processor and monitor gracefully skip processing when Redis is not properly configured, logging a single clear warning instead of DNS errors
  </done>
</task>

</tasks>

<verification>
1. Run `npm run build` - should complete without TypeScript errors
2. Set `REDIS_URL=redis://placeholder:6379` and call `/api/cron/process-queue` - should return 200 with `{ success: true, queuesProcessed: 0 }` and log warning about unconfigured Redis
3. Check logs - should see single warning message, no DNS ENOTFOUND errors
</verification>

<success_criteria>
- No more `getaddrinfo ENOTFOUND placeholder` errors in logs
- Cron jobs complete successfully (HTTP 200) when Redis is not configured
- Clear warning message indicates Redis needs configuration
- Existing behavior unchanged when Redis IS properly configured
</success_criteria>

<output>
After completion, create `.planning/quick/021-fix-redis-placeholder-dns-errors/021-SUMMARY.md`
</output>
