# Codebase Concerns

**Analysis Date:** 2026-01-27

## Tech Debt

**Authentication System - Password Implementation Incomplete:**
- Issue: Password validation bypassed in development. Auth service has bcrypt hashing but schema field is optional for "backward compatibility"
- Files: `lib/auth.ts` (lines 74-77), `prisma/schema.prisma` (line 130), `lib/services/auth.service.ts`
- Impact: Security vulnerability if deployed to production. Login succeeds without proper password verification. Try-catch wraps password field selection suggesting incomplete migration.
- Fix approach: 
  1. Make `password` field required in schema (non-nullable)
  2. Create migration to hash all existing passwords
  3. Remove backward compatibility workarounds in `lib/auth.ts` (lines 36-61)
  4. Add password strength validation before production

**Large Service Files - Complexity Creep:**
- Issue: Multiple service files exceed 1000 lines, indicating single responsibility violation
- Files:
  - `lib/services/quickbooks-sync.service.ts` (1,587 lines)
  - `lib/services/quickbooks.service.ts` (1,448 lines)
  - `lib/services/docusign.service.ts` (931 lines)
  - `lib/services/notification.service.ts` (906 lines)
- Impact: Hard to test, maintain, and debug. High cognitive load for changes. Error handling spans 150+ locations in quickbooks-sync alone.
- Fix approach: Extract into smaller, focused services:
  - Split QuickBooks into: `quickbooks-api.service.ts`, `quickbooks-customer-sync.service.ts`, `quickbooks-invoice-sync.service.ts`
  - Split DocuSign into: `docusign-auth.service.ts`, `docusign-contract.service.ts`, `docusign-pdf.service.ts`
  - Extract notification templates to separate files under `lib/templates/`

**Type Safety Bypasses - Widespread "any" Usage:**
- Issue: Heavy use of `any` type and type assertions `(session.user as any).role` throughout dashboard pages
- Files:
  - `app/dashboard/customers/new/CustomerForm.tsx` (lines 25, 89)
  - `app/dashboard/customers/[id]/page.tsx` (line 26)
  - `app/dashboard/payments/page.tsx` (lines 40, 56, 115)
  - `app/dashboard/invoices/page.tsx` (lines 42, 43, 61)
  - `app/dashboard/leads/[id]/page.tsx` (line 25)
  - All service files using `metadata: any` fields
- Impact: Runtime errors not caught by TypeScript. Loss of intellisense and refactoring safety. Session role could be undefined causing crashes.
- Fix approach:
  1. Create typed session extensions: `types/next-auth.d.ts` with proper User interface
  2. Replace `any` with proper types or `unknown` (forcing validation)
  3. Add Zod schemas for external API responses
  4. Use generic types for metadata fields

**Deprecated Code Not Removed:**
- Issue: Invoice approval workflow removed in "quick-012" but queue processors and notification methods still exist
- Files:
  - `lib/utils/queue-processor.ts` (line 285)
  - `lib/utils/queue.ts` (line 411)
  - `lib/services/notification.service.ts` (lines 72-95, three @deprecated methods)
- Impact: Dead code bloat. `invoiceApproval` queue consumes resources for no-op operations. Confusion for developers.
- Fix approach:
  1. Remove `invoiceApproval` queue from `lib/utils/queue.ts`
  2. Remove `invoiceApproval` handler from `lib/utils/queue-processor.ts`
  3. Delete deprecated methods in `notification.service.ts`
  4. Update `QUEUE_CONFIG` to remove approval queue limits

**Console Logging Instead of Structured Logging:**
- Issue: 1,556+ console.log/error/warn statements scattered across codebase
- Files: Throughout all services and API routes
- Impact: Production logs are unstructured, hard to query. No correlation IDs. Can't filter by severity or service. Performance impact in hot paths.
- Fix approach:
  1. Already have `integrationLogger` utility but inconsistently used
  2. Replace console.* with logger in services (prioritize high-volume paths)
  3. Add request correlation IDs in middleware
  4. Configure log levels via env var (DEBUG, INFO, WARN, ERROR)

**Environment Variable Coupling:**
- Issue: Direct `process.env` access in 50+ locations instead of centralized config
- Files:
  - Services accessing env vars directly: `lib/services/ai.service.ts` (lines 9, 12-13, 61, 224), `lib/services/docusign.service.ts` (lines 41-45), `lib/services/quickbooks.service.ts` (lines 48-49, 59)
  - Webhook routes checking secrets inline: `app/api/webhooks/*`
- Impact: No validation of required vars at startup. Runtime crashes when vars missing. Hard to test with different configs. Vercel builds succeed even with missing critical vars.
- Fix approach:
  1. Create `lib/config.ts` with Zod schema validation
  2. Validate all required env vars at app startup (fail fast)
  3. Export typed config object: `export const config = { openai: { apiKey, model }, ... }`
  4. Services import config instead of process.env
  5. Add startup health check endpoint

## Known Bugs

**QuickBooks Token Refresh Race Condition:**
- Symptoms: Token refresh may fail if multiple serverless functions attempt simultaneously
- Files: `lib/services/quickbooks.service.ts` (token storage in SystemConfig singleton)
- Trigger: High concurrent QuickBooks API calls from different Vercel functions
- Workaround: Circuit breaker prevents cascading failures, but some requests fail
- Fix: Add distributed lock (Redis) around token refresh operation

**BullMQ Workers Don't Run on Vercel:**
- Symptoms: Jobs enqueued but never processed unless cron triggers
- Files: `lib/utils/queue-processor.ts` (documents this), `vercel.json` (cron every 5 min)
- Trigger: Any job added to queue outside cron window
- Workaround: Cron job runs every 5 minutes to process queues
- Impact: Maximum 5-minute delay for async operations (lead qualification, WhatsApp messages, syncs)
- Fix: Migrate to external worker (Railway, Fly.io) or use Vercel's native queue when available

**Password Field Backward Compatibility Try-Catch:**
- Symptoms: Auth falls back to no-password selection if password field query fails
- Files: `lib/auth.ts` (lines 36-61)
- Trigger: Schema changes or database migrations
- Current mitigation: Try-catch allows login without password check
- Risk: Breaks security if password column actually exists but query fails for other reasons

## Security Considerations

**Webhook Secret Validation Inconsistent:**
- Risk: Some webhooks skip signature verification if secret not configured
- Files:
  - `app/api/webhooks/docusign/route.ts` (line 37) - warns but allows unsigned webhooks
  - `app/api/webhooks/stripe/route.ts` (line 36) - logs error but may proceed
  - `app/api/webhooks/pipedrive/deal/route.ts` (line 37) - validation present but optional
  - `app/api/webhooks/quickbooks/route.ts` (line 58) - logs but continues
- Current mitigation: Environment checks
- Recommendations:
  1. Make webhook secrets required in production (fail startup if missing)
  2. Reject unsigned webhook requests with 401 in production
  3. Add IP allowlisting for webhook sources
  4. Rate limit webhook endpoints (currently no rate limiting detected)

**No Rate Limiting on API Routes:**
- Risk: API routes vulnerable to brute force and DoS attacks
- Files: No rate limiting middleware detected in `middleware.ts` or API routes
- Current mitigation: None - relies on Vercel's infrastructure limits
- Improvement path:
  1. Add Redis-based rate limiter middleware
  2. Implement per-IP limits for auth endpoints (5 attempts/15min)
  3. Implement per-user limits for expensive operations (QuickBooks sync, AI qualification)
  4. Add 429 responses with Retry-After headers

**OAuth Tokens in Database Without Encryption:**
- Risk: QuickBooks access/refresh tokens stored in plaintext in SystemConfig table
- Files: `prisma/schema.prisma` (SystemConfig model), `lib/services/quickbooks.service.ts` (lines 71-78)
- Impact: Database breach exposes QuickBooks access to customer financial data
- Current mitigation: Database access controlled, SSL connections
- Recommendations:
  1. Encrypt tokens at rest using encryption key from env var
  2. Use AWS KMS or similar for key management
  3. Rotate encryption keys periodically
  4. Audit token access in IntegrationLog

**Input Validation Gaps:**
- Risk: No centralized input validation detected in API routes
- Files: API routes rely on Prisma schema validation only
- Current approach: Type coercion and Prisma constraints
- Recommendations:
  1. Add Zod validation schemas for all API route inputs
  2. Validate query parameters, especially in search/filter endpoints
  3. Sanitize user-provided strings before database operations
  4. Add request size limits to prevent payload attacks

**Debug Mode Enabled in Production:**
- Risk: NextAuth debug mode always enabled
- Files: `lib/auth.ts` (line 151) - `debug: true`
- Impact: Sensitive auth flows logged to console in production
- Fix: Change to `debug: process.env.NODE_ENV !== 'production'`

**Multiple .env Files Tracked:**
- Risk: `.env` and `.env.local` may contain secrets
- Files: `.env`, `.env.local`, `.env.example` all present
- Current mitigation: `.gitignore` properly configured
- Recommendations:
  1. Remove `.env` and `.env.local` from repo if committed
  2. Audit git history for leaked secrets
  3. Rotate any secrets found in git history
  4. Use Vercel environment variables exclusively in production

## Performance Bottlenecks

**QuickBooks Sync Synchronous Processing:**
- Problem: Customer/invoice sync processes hundreds of records sequentially
- Files: `lib/services/quickbooks-sync.service.ts` (syncAllCustomers, syncAllInvoices methods)
- Cause: API calls in loops without batching or parallel processing
- Improvement path:
  1. Batch operations into chunks of 50
  2. Use `Promise.all()` with concurrency limit (e.g., 5 concurrent requests)
  3. Add incremental sync (only changed records) using `LastUpdatedTime` filter
  4. Consider pagination for large datasets (current maxResults=1000)

**Large Dashboard Queries Without Pagination:**
- Problem: Dashboard pages load all customers/invoices/payments without limits
- Files:
  - `app/dashboard/customers/page.tsx` (lines 106, 177) - `findMany()` with no take/skip
  - `app/dashboard/payments/page.tsx` (line 123) - loads all matching payments
  - `app/dashboard/invoices/page.tsx` (line 122) - loads all invoices
- Cause: UI pagination but database fetches everything
- Impact: Slow page loads as data grows. Could OOM with 10k+ records. High database CPU.
- Improvement path:
  1. Add `take: 100, skip: (page - 1) * 100` to all findMany calls
  2. Use cursor-based pagination for better performance
  3. Add database indexes on commonly filtered fields
  4. Implement virtual scrolling for large lists

**AI Service No Request Caching:**
- Problem: Repeated lead qualification calls for same data
- Files: `lib/services/ai.service.ts` - no caching detected
- Cause: Every qualification hits OpenAI API even if recent qualification exists
- Impact: Unnecessary cost ($0.01-0.03 per qualification). Slower responses.
- Improvement path:
  1. Cache qualification results by lead ID + conversation hash (Redis, 24h TTL)
  2. Skip re-qualification if score exists and conversation unchanged
  3. Add deduplication for concurrent qualification requests

**N+1 Query Pattern in Related Data:**
- Problem: Relationships not eagerly loaded, causing multiple database round trips
- Files: Dashboard pages likely triggering N+1 when rendering relationships
- Cause: Prisma `include` not consistently used
- Improvement path:
  1. Add `include: { customer: true, deal: true }` to invoice queries
  2. Use `select` to fetch only needed fields
  3. Enable Prisma query logging to detect N+1 patterns
  4. Consider GraphQL DataLoader pattern for complex UIs

**No Serverless Function Timeout Handling:**
- Problem: Long-running operations may hit Vercel 10-second timeout without graceful degradation
- Files: `lib/utils/queue-processor.ts` has 8-second exit logic, but individual service calls don't
- Cause: QuickBooks sync, AI calls, DocuSign can exceed timeout under load
- Impact: 504 Gateway Timeout errors. Partial state updates. User confusion.
- Improvement path:
  1. Add timeout wrapper around all external API calls (5s max)
  2. Return "processing" response with status check endpoint
  3. Move heavyweight operations to background queues
  4. Add timeout monitoring alerts

## Fragile Areas

**Identity Mapper - Race Conditions:**
- Files: `lib/services/identity-mapper.ts`
- Why fragile: Reconciles customers by email but no transaction isolation. Check-then-act pattern between `findUnique` (line 44) and `create` (line 103).
- Safe modification: Wrap in Prisma transaction. Use `upsert` instead of find-then-create. Add unique constraint validation.
- Test coverage: No unit tests detected. Integration tests needed for concurrent reconciliation scenarios.
- Risk: Concurrent webhook processing could create duplicate customers despite email uniqueness constraint.

**Queue Processing Timing Budget:**
- Files: `lib/utils/queue-processor.ts` (timing logic lines 133-151)
- Why fragile: Hardcoded 8-second exit assumes queue processing completes in time. No graceful degradation if jobs pile up.
- Safe modification:
  1. Monitor queue depth metrics before changing maxJobs per queue
  2. Test timing with production load (current limits: lead=2, whatsapp=5, qb=1)
  3. Add queue depth alerts (>100 jobs waiting)
  4. Keep per-job timeout at 5s to prevent cascading delays
- Test coverage: No automated timing tests. Requires load testing.
- Risk: If jobs exceed timeout budget, cron exits mid-processing leaving jobs in limbo.

**Circuit Breaker State Persistence:**
- Files: `lib/utils/circuit-breaker.ts` (database state management lines 68-87)
- Why fragile: Circuit state loaded async in constructor. Race condition if `execute()` called before state loaded. Each service creates new instance (state not shared across serverless functions).
- Safe modification:
  1. Ensure `await initialize()` before first circuit breaker use
  2. Consider Redis for shared state across functions
  3. Don't change threshold values without load testing
  4. Monitor IntegrationLog for circuit open events
- Test coverage: Integration tests needed for state transitions
- Risk: Circuit breakers may not protect correctly if state not shared across Vercel functions.

**Webhook Processing - Event Deduplication:**
- Files: Webhook routes in `app/api/webhooks/*`
- Why fragile: External services may retry webhooks if response delayed. No idempotency key tracking detected.
- Safe modification:
  1. Add idempotency table (event_id, source, processed_at)
  2. Check event ID before processing
  3. Return 200 OK for duplicate events
  4. Add retention policy (delete events older than 30 days)
- Test coverage: No duplicate detection tests
- Risk: Retry webhooks could create duplicate records (leads, deals, invoices).

**Database Views - Manual Recreation:**
- Files: `prisma/migrations/create_views.sql`, `scripts/create-views.ts`
- Why fragile: Views must be manually recreated after schema changes. No automated check.
- Safe modification:
  1. Run `npm run db:views` after every migration
  2. Add check in CI pipeline to verify views exist
  3. Consider materialized views with refresh job
- Test coverage: No view validation tests
- Risk: Schema changes break views silently. BI dashboards return stale/incorrect data.

## Scaling Limits

**Redis Connection Pooling:**
- Current capacity: Single Redis connection per queue (BullMQ default)
- Limit: ~50 concurrent queue operations before connection exhaustion
- Files: `lib/utils/queue.ts` (connection config lines 10-26)
- Scaling path:
  1. Increase Redis connection limit (Upstash default: 1000)
  2. Add connection pool with `ioredis` cluster mode
  3. Monitor Redis CPU and memory usage
  4. Consider separate Redis instance for high-volume queues

**PostgreSQL Connection Pool:**
- Current capacity: Neon pooled connection (Prisma default pool: 10 connections)
- Limit: Vercel functions can spawn 100+ concurrent instances, exhausting pool
- Files: `lib/db.ts`, `prisma/schema.prisma` (datasource config)
- Scaling path:
  1. Increase connection pool limit in Neon dashboard
  2. Use Prisma Data Proxy for connection pooling
  3. Add `connection_limit` parameter to POSTGRES_PRISMA_URL
  4. Monitor active connections in Neon dashboard
  5. Implement query result caching (Redis) for read-heavy operations

**Serverless Function Cold Starts:**
- Current capacity: ~2-3 second cold start for functions with Prisma
- Limit: User-facing requests timeout if cold start + processing > 10s
- Scaling path:
  1. Use Vercel Edge Functions for latency-critical routes
  2. Keep Prisma Client bundle size small (selective imports)
  3. Add warming cron for critical functions
  4. Move heavyweight operations to background queues

**File Upload Size:**
- Current capacity: No explicit limits detected
- Limit: Vercel serverless functions: 4.5MB request body
- Files: No upload size validation in API routes
- Scaling path:
  1. Add size validation middleware (reject >4MB)
  2. Use presigned S3 URLs for large uploads
  3. Implement chunked upload for documents >1MB
  4. Add progress indicators in UI

**QuickBooks API Rate Limits:**
- Current capacity: QuickBooks sandbox: 100 requests/minute. Production: 500 requests/minute per app
- Limit: Bulk sync of 1000 customers = 1000 API calls exceeds limit
- Files: No rate limit handling in `lib/services/quickbooks.service.ts`
- Scaling path:
  1. Add rate limiter with token bucket (500/min)
  2. Implement request queuing when limit approached
  3. Use batch endpoints where available
  4. Add incremental sync (only changed records)
  5. Monitor IntegrationLog for 429 errors

## Dependencies at Risk

**BullMQ on Vercel Serverless:**
- Risk: BullMQ designed for long-running workers, not serverless cron
- Impact: 5-minute processing delay. Complex workaround code.
- Files: `lib/utils/queue-processor.ts` (entire architecture workaround)
- Migration plan:
  1. Evaluate Vercel native queues (when available)
  2. Consider Inngest or Trigger.dev for serverless-native jobs
  3. Alternative: Deploy worker to Railway/Fly.io with persistent Redis

**Next.js 14 App Router - Rapid Changes:**
- Risk: App Router still evolving, breaking changes possible
- Impact: Currently stable but middleware and caching behavior changed in 14.1+
- Files: `middleware.ts`, all `app/` routes
- Migration plan: Pin Next.js version. Test thoroughly before upgrades. Monitor Next.js release notes.

**Prisma Client Bundle Size:**
- Risk: Large bundle (~5MB) impacts cold start times
- Impact: 1-2 second cold start penalty
- Files: `lib/db.ts`
- Migration plan: Consider Prisma Data Proxy or alternative ORMs (Drizzle, Kysely) if cold starts become critical.

**OpenAI API Dependency:**
- Risk: Single point of failure for lead qualification and chatbot
- Impact: If OpenAI down, core business logic breaks. Fallback messages exist but no alternative AI provider.
- Files: `lib/services/ai.service.ts`, `lib/services/collection-call.service.ts`
- Migration plan:
  1. Add Azure OpenAI as fallback
  2. Cache frequent qualification patterns
  3. Implement rule-based fallback qualification (score based on keywords)

## Missing Critical Features

**No Rollback Mechanism for Syncs:**
- Problem: QuickBooks/Pipedrive sync errors leave partial state
- Blocks: Recovering from failed bulk operations requires manual database edits
- Impact: Data inconsistency between systems. Customer records incomplete.
- Priority: High - affects data integrity

**No User Activity Audit Log:**
- Problem: No tracking of who changed what in dashboard
- Blocks: Compliance requirements, debugging user errors, security investigations
- Impact: Can't trace unauthorized changes or user mistakes
- Priority: Medium - required for SOC2/compliance

**No Backup/Restore Process:**
- Problem: No documented backup strategy for database or S3 documents
- Blocks: Disaster recovery, accidental data deletion recovery
- Impact: Data loss risk if database corruption or accidental deletion
- Priority: High - critical for business continuity

**No Multi-tenancy Support:**
- Problem: Single organization hardcoded (Carreira USA)
- Blocks: Cannot offer system to other organizations or franchise model
- Impact: Limits business scalability
- Priority: Low - not currently required

**No Email Bounce Handling:**
- Problem: Resend email service used but no bounce/spam webhook handling
- Blocks: Email deliverability monitoring, blacklist detection
- Impact: Emails may fail silently. No alerting on delivery issues.
- Priority: Medium - affects customer communication reliability

## Test Coverage Gaps

**No Unit Tests for Services:**
- What's not tested: All service files (QuickBooks, Stripe, DocuSign, AI, Identity Mapper)
- Files: No `*.test.ts` or `*.spec.ts` files found in project
- Risk: Refactoring breaks functionality without detection. Regression bugs in critical paths.
- Priority: High

**No Integration Tests for Webhooks:**
- What's not tested: Webhook signature verification, payload parsing, error handling
- Files: `app/api/webhooks/*` - 10+ webhook endpoints untested
- Risk: External service changes break integrations silently. Security vulnerabilities undetected.
- Priority: High - webhooks drive core automation

**No E2E Tests for Critical Flows:**
- What's not tested: Lead → Qualification → Deal → Invoice → Payment flow
- Files: Entire user journey untested
- Risk: Changes to one part of flow break downstream steps undetected
- Priority: Medium - manual testing currently covers this

**No Load Testing:**
- What's not tested: System behavior under concurrent webhook processing
- Files: Queue processor, circuit breaker, identity mapper race conditions
- Risk: Scaling issues discovered in production. Race conditions undetected.
- Priority: Medium - recommend before scaling to 100+ customers

**No Database Migration Tests:**
- What's not tested: Migrations run successfully on production-like data
- Files: `prisma/migrations/*` - 50+ migration files untested
- Risk: Schema changes break on production data. Data loss in rollback scenarios.
- Priority: High - one bad migration could corrupt production database

---

*Concerns audit: 2026-01-27*
