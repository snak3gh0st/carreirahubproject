# Codebase Concerns

**Analysis Date:** 2026-01-09

## Tech Debt

**Password Authentication Not Implemented:**
- Issue: Login bypasses password check in development, no password field on User model
- Files: `lib/auth.ts` (TODO comment), `prisma/schema.prisma` (User model missing password field)
- Impact: Authentication only works via hardcoded logic; not production-ready
- Fix approach: Add password field to User, implement bcrypt hashing, add password verification in `lib/auth.ts`

**Queue Job Processors Placeholder:**
- Issue: Multiple TODO comments for unimplemented queue processors
- Files: `lib/utils/queue.ts` (invoiceGeneration, contractGeneration handlers are stubs)
- Impact: Jobs enqueued but never processed; workflows incomplete
- Fix approach: Implement handlers for each job type, test with actual Vercel cron jobs

**LMS Integration Missing:**
- Issue: Comments indicate LMS unlock functionality not implemented
- Files: `lib/services/invoice-workflow.service.ts` ("TODO: Liberar LMS"), `lib/services/sdr.service.ts`
- Impact: Paid customers can't access course content
- Fix approach: Design and implement LMS API integration, add to workflow

**API Tokens in URL Parameters:**
- Issue: Pipedrive API token included in URL query string
- File: `lib/services/pipedrive.service.ts` (line 18: `?api_token=${this.apiToken}`)
- Impact: Token visible in logs, browser history, proxy servers
- Fix approach: Move to Authorization header instead

## Known Bugs

**Webhook Secret Retrieval Order:**
- Symptom: Webhooks may fail if secret not in both database and environment
- Trigger: Missing `SystemConfig` table entry or env var not set
- Files: `app/api/webhooks/pipedrive/deal/route.ts`, `app/api/webhooks/quickbooks/route.ts`
- Workaround: Ensure both database and env vars are configured
- Root cause: Fallback logic depends on specific order (database first, then env)
- Fix: Add explicit validation that at least one secret exists

## Security Considerations

**Missing CSRF Protection on Forms:**
- Risk: Form submissions vulnerable to cross-site request forgery
- Files: Dashboard API endpoints (`app/api/invoices/*/route.ts`, `app/api/leads/*/route.ts`)
- Current mitigation: NextAuth.js middleware checks auth, but no CSRF tokens
- Recommendations: Add CSRF token validation for state-changing operations (POST/PATCH/DELETE)

**Webhook Secrets Exposed in .env:**
- Risk: Webhook secrets stored in `.env` file (checked into repo by mistake or via notes)
- Files: `.env` contains raw secrets (STRIPE_WEBHOOK_SECRET, PIPEDRIVE_WEBHOOK_SECRET, etc.)
- Current mitigation: `.env` should be gitignored (check `.gitignore`)
- Recommendations: Rotate all secrets immediately, add pre-commit hook to prevent secret commits

**API Routes Without Authentication:**
- Risk: Some routes may be accessible without authentication
- Files: Webhook endpoints by design (intentionally public), but internal API routes should be protected
- Current mitigation: Middleware in `middleware.ts` protects `/dashboard` routes
- Recommendations: Add `getServerSession()` checks to all internal API routes (`app/api/customers/`, `app/api/leads/`, etc.)

**Hardcoded API Tokens in Code:**
- Risk: None detected, but pattern of storing in env vars is correct
- Files: All services use environment variables properly
- Recommendations: Never hardcode tokens; use env vars and rotate regularly

**SQL Injection via Prisma:**
- Risk: Very low - Prisma parameterizes queries
- Current mitigation: Prisma ORM prevents SQL injection by design
- Recommendations: Continue using Prisma; never construct raw SQL without parameters

## Performance Bottlenecks

**No Database Indexes on Foreign Keys:**
- Problem: Queries joining on foreign keys may be slow without indexes
- File: `prisma/schema.prisma` (no explicit `@@index` directives observed)
- Measurement: Likely sub-second for current data volume, but will degrade with scale
- Cause: Prisma auto-creates indexes, but explicit configuration may be needed for complex queries
- Improvement path: Analyze slow queries with `EXPLAIN`, add `@@index` directives in schema

**N+1 Query Problem in Webhook Handlers:**
- Problem: Fetching related data in loops (e.g., for each invoice, fetch customer)
- Files: Likely in webhook processors or service methods
- Measurement: Not measured, but evident in code patterns
- Cause: Using separate queries instead of Prisma `include`
- Improvement path: Use `prisma.table.findMany({ include: { relatedData: true } })` instead of loops

**Queue Processing Every 5 Minutes:**
- Problem: Cron job polls queue every 5 minutes, may create latency
- File: `app/api/cron/process-queue/route.ts` (scheduled every 5 minutes)
- Measurement: Up to 5-minute delay for async job processing
- Cause: Vercel cron job frequency limit
- Improvement path: Reduce to 1-minute polling if job latency becomes issue, or use Redis pub/sub instead

**No Caching Layer:**
- Problem: Repeated API calls to external services (Pipedrive, QB) not cached
- Files: `lib/services/pipedrive.service.ts`, `lib/services/quickbooks.service.ts`
- Measurement: Each webhook for same entity fetches from external API
- Cause: No Redis caching implemented
- Improvement path: Add Redis caching layer for customer/deal/invoice lookups (5-15 min TTL)

## Fragile Areas

**Webhook Handler Webhook Signature Validation:**
- Why fragile: Signature validation logic duplicated across multiple endpoints
- Common failures: Signature validation failures hard to debug without good logging
- Files: `app/api/webhooks/pipedrive/deal/route.ts`, `app/api/webhooks/quickbooks/route.ts`, `app/api/webhooks/stripe/route.ts`
- Safe modification: Never change webhook signature validation logic without thorough testing; rotation can break service
- Test coverage: No test coverage for webhook validation detected

**Identity Mapper Logic:**
- Why fragile: Deduplication logic across multiple external systems is complex
- Common failures: Duplicate customer creation if external ID not matched correctly
- File: `lib/services/identity-mapper.ts` (CRITICAL BUSINESS LOGIC)
- Safe modification: Add comprehensive tests before changes; external ID mappings are source of truth
- Test coverage: No test coverage detected - HIGH PRIORITY

**Invoice Workflow State Machine:**
- Why fragile: Multiple services update invoice status (approval, payment, contract)
- Common failures: Race conditions where multiple processes update same invoice
- Files: `lib/services/invoice-workflow.service.ts`, `lib/services/invoice-approval.service.ts`, webhook handlers
- Safe modification: Add pessimistic locking or atomic transactions before changes
- Test coverage: No test coverage - HIGH PRIORITY

**BullMQ Queue Processor:**
- Why fragile: Single processor handles all job types with large switch statement
- Common failures: New job type added but handler not implemented (silent failure)
- File: `lib/utils/queue.ts`
- Safe modification: Refactor into separate handler files before adding more jobs
- Test coverage: No test coverage for queue processing

## Scaling Limits

**Vercel Function Timeout:**
- Current capacity: 10 seconds (standard Vercel limit)
- Limit: Long-running operations exceed timeout
- Symptoms at limit: 504 gateway timeouts on complex calculations or external API calls
- Scaling path: Refactor work into async jobs, increase timeout via Pro plan (60s)

**Redis Connection Pool:**
- Current capacity: Single Redis instance handling all queue operations
- Limit: ~1000 concurrent jobs before throughput degrades
- Symptoms at limit: Queue processing latency increases, jobs timeout
- Scaling path: Upgrade Redis instance (Upstash), implement connection pooling

**PostgreSQL Connection Pool:**
- Current capacity: Neon pooling connection limits
- Limit: ~25 pooled connections (free tier limit)
- Symptoms at limit: "Too many connections" errors in logs
- Scaling path: Upgrade Neon plan or implement application-level connection pooling

**Webhook Processing Latency:**
- Current capacity: ~10 webhooks/second before backlog
- Limit: Exceeding rate causes queue backup
- Symptoms at limit: Delayed processing of Pipedrive/QB/Stripe events
- Scaling path: Increase cron job frequency, add dedicated webhook processing function

## Dependencies at Risk

**Next.js 14 EOL Timeline:**
- Risk: Next.js versions EOL after ~12 months
- Impact: Security updates stop, framework bugs unfixed
- Migration plan: Plan upgrade to Next.js 15+ in Q3 2026

**OpenAI GPT-4 API:**
- Risk: Model could be deprecated or pricing could increase significantly
- Impact: Chatbot and lead qualification could become expensive
- Migration plan: Monitor OpenAI announcements, have fallback to GPT-3.5-turbo or Claude API

**Stripe API Version:**
- Risk: Stripe could deprecate webhook event types or change behavior
- Impact: Payment webhooks could fail silently
- Migration plan: Subscribe to Stripe newsletter, test webhook changes in sandbox before production

## Missing Critical Features

**Lead Assignment Logic:**
- Problem: No automatic assignment of qualified leads to SDR team
- Current workaround: Leads marked as QUALIFIED but not assigned
- Blocks: Can't track SDR performance, leads sit unassigned
- Implementation complexity: Low (add `assignedToUserId` field, implement round-robin or fila logic)
- File to add: `lib/services/lead-assignment.service.ts`

**Invoice Payment Status Tracking:**
- Problem: No sync of payment status from Stripe back to invoice
- Current workaround: Manual marking of invoices as paid
- Blocks: Can't auto-send follow-ups for unpaid invoices
- Implementation complexity: Medium (add Stripe payment webhook handler, update invoice status)

**Contract Expiration Handling:**
- Problem: Contracts marked as EXPIRED but no renewal workflow
- Current workaround: Manual renewal process
- Blocks: Can't auto-trigger renewal alerts or contract regeneration
- Implementation complexity: Medium (add cron job for contract monitoring, renewal workflow)

**Two-Factor Authentication:**
- Problem: No 2FA for user accounts
- Current workaround: Relying on password (which isn't implemented!)
- Blocks: Can't achieve minimum security requirements for production
- Implementation complexity: Medium (NextAuth.js + TOTP or SMS)

## Test Coverage Gaps

**Webhook Processing End-to-End:**
- What's not tested: Complete webhook handling from signature validation through database update
- Risk: Webhooks could silently fail or partially process
- Priority: HIGH - Critical business flow
- Difficulty to test: Need to mock external services, test database state

**Identity Mapper Deduplication:**
- What's not tested: Customer reconciliation logic when external IDs conflict or missing
- Risk: Duplicate customers created or data merged incorrectly
- Priority: HIGH - Data integrity issue
- Difficulty to test: Complex multi-system scenarios

**Invoice Workflow State Transitions:**
- What's not tested: All valid and invalid state transitions (DRAFT→SENT→PAID, etc.)
- Risk: Invoices get stuck in invalid states
- Priority: MEDIUM - Revenue blocking
- Difficulty to test: Need to mock services, test error paths

**Queue Job Processing and Retries:**
- What's not tested: Jobs enqueued, processed, retried on failure
- Risk: Critical jobs never complete
- Priority: MEDIUM - Async workflow reliability
- Difficulty to test: Need to mock BullMQ, test cron job handler

**API Input Validation:**
- What's not tested: Zod schema validation on all endpoints
- Risk: Invalid data accepted or valid data rejected
- Priority: MEDIUM - API stability
- Difficulty to test: Straightforward - test invalid inputs

---

*Concerns audit: 2026-01-09*
*Update as issues are fixed or new ones discovered*
