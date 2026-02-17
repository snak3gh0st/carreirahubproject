# Codebase Concerns

**Analysis Date:** 2026-02-17

## Tech Debt

**Placeholder Queue Workers (Invoice & Contract Generation):**
- Issue: The `invoiceGeneration` and `contractGeneration` queue workers in `lib/utils/queue.ts` contain only `console.log` stubs instead of actual business logic. Jobs enqueued to these queues are silently dropped.
- Files: `lib/utils/queue.ts`
- Impact: Any workflow that enqueues invoice or contract generation jobs via `addInvoiceGenerationJob()` or `addContractGenerationJob()` silently does nothing. The actual workflow has been moved to `lib/services/invoice-workflow.service.ts` and `lib/services/contract-workflow.service.ts`, but the queue workers were never updated to call them.
- Fix approach: Either wire the workers to call the correct service methods, or remove the dead queue definitions and their `add*Job` functions to avoid confusion. The cron-based queue processor (`lib/utils/queue-processor.ts`) may already handle these, in which case remove the worker stubs.

**Deprecated Invoice Approval Queue Worker:**
- Issue: The `invoice-approval` worker logs a warning that the approval workflow has been removed, but the queue, `addInvoiceApprovalJob` function, and disabled service file (`lib/services/invoice-approval.service.ts.disabled`) still exist.
- Files: `lib/utils/queue.ts`, `lib/services/invoice-approval.service.ts.disabled`
- Impact: Dead code that adds confusion. Callers of `addInvoiceApprovalJob()` get silently discarded work.
- Fix approach: Remove the `invoiceApproval` queue, its `QueueEvents`, the `addInvoiceApprovalJob()` export, and the `.disabled` service file.

**SDR Lead Assignment Not Implemented:**
- Issue: When AI qualification scores a lead below threshold, the code has a `TODO: Implementar logica de atribuicao (round-robin, fila, etc.)` and only logs to console. Unqualified leads are left in limbo with no human assignment.
- Files: `lib/services/sdr.service.ts`
- Impact: Leads that fail auto-qualification are never routed to a human SDR for follow-up.
- Fix approach: Implement round-robin or queue-based assignment logic, or at minimum create a notification to alert the sales team.

**Duplicate Email Service Files:**
- Issue: Two email service files exist: `lib/services/email.service.ts` (Resend-based, with real templates) and `lib/services/email-service.ts` (backup stub with commented-out code). The backup file has no actual implementation.
- Files: `lib/services/email.service.ts`, `lib/services/email-service.ts`
- Impact: Confusion about which service to use. The stub file adds no value.
- Fix approach: Delete `lib/services/email-service.ts` and consolidate all email logic into `lib/services/email.service.ts`.

**Contract PDF Generation TODO:**
- Issue: `lib/services/invoice-workflow.service.ts` has a TODO for generating PDF contracts from templates. Currently uses hardcoded PDF generation in `lib/services/docusign.service.ts` with static layout.
- Files: `lib/services/invoice-workflow.service.ts`, `lib/services/docusign.service.ts`
- Impact: Contract PDFs have fixed layout and content. No template system for different service packages.
- Fix approach: Implement a template-based PDF system or fully rely on DocuSign templates (which are already partially supported via `createEnvelopeFromTemplate`).

## Security Considerations

**Debug Endpoints Deployed to Production:**
- Risk: Nine debug API routes exist under `app/api/debug/`, several with NO authentication. `app/api/debug/db-info/route.ts` exposes partial password hashes, database connection info, and user details. `app/api/debug/test-auth/route.ts` is an unauthenticated endpoint that accepts email+password and returns user details including password verification results. The file itself contains the comment "DELETE THIS FILE after debugging."
- Files: `app/api/debug/db-info/route.ts`, `app/api/debug/test-auth/route.ts`, `app/api/debug/invoice-data/route.ts`, `app/api/debug/dashboard-metrics/route.ts`, `app/api/debug/revenue-trend/route.ts`, `app/api/debug/bi-dashboard-test/route.ts`
- Current mitigation: Three QuickBooks debug endpoints (`test-qb-email`, `verbose-qb-send`, `check-qb-email-status`) do use `getServerSession` for auth. The remaining six have NO auth checks at all.
- Recommendations: Delete ALL debug endpoints before production deployment. If any must remain, gate them behind `ADMIN` role authentication and restrict to non-production environments.

**Unauthenticated API Routes:**
- Risk: Several data-bearing API routes have no authentication checks. `app/api/leads/route.ts` (GET/POST), `app/api/deals/route.ts` (GET/POST), and `app/api/chat/route.ts` (POST) are accessible without any session validation. While the Next.js middleware protects `/dashboard/*` routes, these `/api/*` routes are NOT covered by the middleware matcher (which only matches `/dashboard/:path*` and `/api/dashboard/:path*`).
- Files: `app/api/leads/route.ts`, `app/api/deals/route.ts`, `app/api/chat/route.ts`, `middleware.ts`
- Current mitigation: The middleware matcher at `middleware.ts` only protects `/dashboard/:path*` and `/api/dashboard/:path*`. All other API routes are unprotected.
- Recommendations: Add `getServerSession` checks to all API routes that handle business data. Alternatively, expand the middleware matcher to cover `/api/:path*` with exclusions for public endpoints (webhooks, auth, chat).

**PII Stored Without Encryption:**
- Risk: Customer SSN, passport numbers, and CPF (Brazilian tax ID) are stored as plaintext `String?` fields in the database. Additionally, SSN values are written to QuickBooks Notes fields in plaintext via `quickbooksService.getOrCreateCustomer()`.
- Files: `prisma/schema.prisma` (Customer model, fields: `ssn`, `passport`, `cpf`), `lib/services/quickbooks.service.ts`
- Current mitigation: None. No encryption at rest, no field-level encryption.
- Recommendations: Implement field-level encryption for `ssn`, `passport`, and `cpf` fields using a library like `prisma-field-encryption` or manual AES encryption. Stop writing SSN to QuickBooks Notes fields in plaintext.

**Secrets Endpoint Returns Raw Secrets:**
- Risk: `app/api/system/secrets/generate/route.ts` returns generated webhook secrets and cron secrets in the JSON response body. The POST endpoint has weak auth (simple Bearer token check) and the GET endpoint has NO auth check at all.
- Files: `app/api/system/secrets/generate/route.ts`
- Current mitigation: In production, POST requires `CRON_SECRET` Bearer token. GET has no auth.
- Recommendations: Add proper admin authentication to both endpoints. Consider not returning raw secret values in responses (show only success/failure).

**Hardcoded NEXTAUTH_SECRET Fallback:**
- Risk: `lib/auth.ts` uses `process.env.NEXTAUTH_SECRET || "development-secret-change-in-production"` as the JWT signing secret. If `NEXTAUTH_SECRET` is not set in production, all sessions are signed with a known, public string.
- Files: `lib/auth.ts`
- Current mitigation: None beyond hoping the env var is set.
- Recommendations: Remove the fallback value. Throw an error at startup if `NEXTAUTH_SECRET` is not set in production.

**QuickBooks Query String Injection:**
- Risk: The QuickBooks service constructs query strings via template literals with unsanitized user input. While these are QuickBooks Query Language (not SQL) queries sent to the QB API, malicious email addresses or document numbers could potentially manipulate query logic.
- Files: `lib/services/quickbooks.service.ts`, `lib/services/quickbooks-sync.service.ts`
- Current mitigation: None. Values like `data.email`, `docNumber`, `invoiceId`, `customerId`, `startDate`, `endDate` are interpolated directly.
- Recommendations: Sanitize inputs by escaping single quotes and special characters before embedding in QB queries. Create a helper function like `escapeQbQuery(value: string)`.

**Webhook Signature Bypass:**
- Risk: Pipedrive webhook endpoints accept requests even when signature validation fails. The code returns `200 OK` with a message "signature validation failed" but still processes the webhook. Additionally, if no webhook secret is configured, validation is skipped entirely.
- Files: `app/api/webhooks/pipedrive/lead/route.ts`
- Current mitigation: Invalid signatures are logged to IntegrationLog for investigation, and the webhook is accepted (to prevent external retries).
- Recommendations: Consider rejecting invalid signatures with 401 instead of silently accepting. Require webhook secrets to be configured in production.

## Performance Bottlenecks

**Excessive Console Logging in Production:**
- Problem: 313 `console.log` statements across 24 files in `lib/`. The QuickBooks service alone has 112 log statements, many printing full JSON responses (e.g., `JSON.stringify(result, null, 2)`).
- Files: `lib/services/quickbooks.service.ts` (112 occurrences), `lib/services/contract-workflow.service.ts` (36), `lib/services/payment-workflow.service.ts` (31), `lib/services/docusign.service.ts` (10)
- Cause: Debug logging left from development. Many log full API response payloads which can be very large.
- Improvement path: Replace `console.log` with the existing structured `integrationLogger` utility (`lib/utils/logger.ts`). Remove or guard verbose JSON stringification behind a debug flag.

**Large Service Files:**
- Problem: `lib/services/quickbooks.service.ts` (1703 lines) and `lib/services/quickbooks-sync.service.ts` (1642 lines) are very large monolithic files that are difficult to maintain and test.
- Files: `lib/services/quickbooks.service.ts`, `lib/services/quickbooks-sync.service.ts`
- Cause: All QuickBooks operations (CRUD, sync, pagination, email, void, etc.) are in a single class.
- Improvement path: Split into focused modules: `quickbooks-customer.service.ts`, `quickbooks-invoice.service.ts`, `quickbooks-payment.service.ts`, with a facade service for initialization and auth.

**No API Rate Limiting:**
- Problem: No rate limiting middleware exists for API routes. The only rate-limiting concept is circuit breakers on outbound API calls (QuickBooks, Stripe, DocuSign, WhatsApp). Inbound API calls to the Hub have no protection.
- Files: No rate limiting files exist. `lib/utils/circuit-breaker.ts` only protects outbound calls.
- Cause: Not implemented.
- Improvement path: Add rate limiting middleware using `next-rate-limit` or a custom Redis-based solution. Priority endpoints: `/api/chat`, `/api/leads`, `/api/auth`.

**QuickBooks Service Initialization on Every Request:**
- Problem: `quickbooksService` is a singleton, but its `initialize()` method must be called before every use to load tokens from the database. This results in a DB query on every QuickBooks API interaction.
- Files: `lib/services/quickbooks.service.ts`
- Cause: OAuth tokens stored in DB need to be fresh, but there is no caching layer.
- Improvement path: Cache tokens in memory with TTL (e.g., 5 minutes). Only re-fetch from DB when cache expires or when a 401 is received.

## Fragile Areas

**Cron Job Authentication Inconsistency:**
- Files: `app/api/cron/quickbooks-sync/route.ts`, `app/api/cron/process-queue/route.ts`, `app/api/cron/overdue-invoices/route.ts`, `app/api/cron/monitor-queues/route.ts`, `app/api/cron/daily-ar-digest/route.ts`
- Why fragile: Cron endpoints use inconsistent auth patterns. Some check `CRON_SECRET`, others check `VERCEL_CRON_SECRET`, and the logic differs (some check `authHeader === Bearer ${secret}`, others use `isVercelCron` patterns). Some skip auth entirely when the secret env var is not set.
- Safe modification: Standardize all cron endpoints to use a single auth helper function that checks `VERCEL_CRON_SECRET` (Vercel's built-in) with fallback to `CRON_SECRET`.
- Test coverage: None (see below).

**Webhook Processing Pipeline:**
- Files: `lib/utils/webhook-handler.ts`, `lib/utils/webhook-queue.ts`, `lib/utils/queue-processor.ts`, `app/api/cron/process-queue/route.ts`
- Why fragile: Webhooks are accepted and stored, then processed asynchronously via cron job every 5 minutes. If the cron job fails, webhooks queue up. The processing is constrained by Vercel's 10-second timeout, so complex webhooks may be partially processed.
- Safe modification: Always test webhook changes end-to-end through the full accept -> store -> cron-process cycle.
- Test coverage: None.

**StripeService Singleton Throws on Missing API Key:**
- Files: `lib/services/stripe.service.ts`
- Why fragile: The `StripeService` constructor throws if `STRIPE_SECRET_KEY` is not set. Since it is exported as a singleton (`export const stripeService = new StripeService()`), importing this module in ANY code path will crash the application if the env var is missing, even if Stripe is not needed for that request.
- Safe modification: Convert to lazy initialization pattern (like QuickBooks service) or catch the error and return null.
- Test coverage: None.

## Test Coverage Gaps

**No Automated Tests Exist:**
- What's not tested: The entire codebase. There are no test files (`*.test.*`, `*.spec.*`), no test framework configured (no jest/vitest in dependencies), and no test runner in package.json scripts.
- Files: All files under `lib/services/`, `app/api/`, `lib/utils/`
- Risk: Any code change can introduce regressions with zero safety net. The only "tests" are manual scripts in `scripts/` that test integrations by making live API calls.
- Priority: High. At minimum, add unit tests for critical business logic: `lib/services/identity-mapper.ts` (customer deduplication), `lib/services/sdr.service.ts` (lead qualification), `lib/services/invoice-workflow.service.ts` (deal-won workflow), and `lib/auth.ts` (authentication).

## Scaling Limits

**Prisma Connection Pool on Vercel:**
- Current capacity: Connection limit set to 10 (via `lib/db.ts`), pool timeout 30 seconds.
- Limit: Under concurrent requests (multiple cron jobs + user requests), connection pool exhaustion (P2024) has been observed and patched with retry logic in `lib/services/quickbooks.service.ts`.
- Scaling path: The retry logic is a band-aid. Consider using Prisma Data Proxy or Neon's connection pooler with higher limits. Monitor P2024 errors in production logs.

**BullMQ Workers Incompatible with Vercel:**
- Current capacity: Queue processing happens via cron endpoint every 5 minutes within a 10-second timeout window.
- Limit: If queue depth exceeds what can be processed in 10 seconds, jobs accumulate. The cron-based approach adds 0-5 minutes of latency to all queued operations.
- Scaling path: For real-time processing needs, consider migrating queue processing to a persistent worker (Railway, Fly.io, or a dedicated Vercel Edge Function with streaming).

## Dependencies at Risk

**Stripe SDK Pinned to Old API Version:**
- Risk: `lib/services/stripe.service.ts` uses `apiVersion: "2023-10-16"` which is over 2 years old. Stripe may deprecate this version.
- Impact: Breaking changes if Stripe sunsets the 2023-10-16 API version.
- Migration plan: Update to the latest Stripe API version and test all payment flows. Review the Stripe changelog for breaking changes.

**@types/bcryptjs in Dependencies (not devDependencies):**
- Risk: `@types/bcryptjs` is listed under `dependencies` instead of `devDependencies` in `package.json`. This is not a runtime dependency and inflates the production bundle.
- Impact: Minor - increases install size but no runtime impact.
- Migration plan: Move `@types/bcryptjs` and `@types/papaparse` to `devDependencies`.

## Missing Critical Features

**No Input Sanitization on Customer PII:**
- Problem: Customer SSN, passport, and CPF fields accept any string value with no format validation. The Zod schema in `app/api/customers/route.ts` uses `z.string().optional()` for these sensitive fields.
- Blocks: Data quality assurance, compliance readiness.

**No Audit Trail for Sensitive Operations:**
- Problem: While `IntegrationLog` tracks external API calls, there is no audit logging for sensitive internal operations like user creation, role changes, customer PII access, or bulk data exports.
- Blocks: SOC 2 compliance, incident investigation for data access.

---

*Concerns audit: 2026-02-17*
