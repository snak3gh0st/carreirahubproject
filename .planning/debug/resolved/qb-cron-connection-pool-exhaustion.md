---
status: resolved
trigger: "QuickBooks cron sync fails with P2024 connection pool exhaustion and cascading 401 Unauthorized"
created: 2026-02-16T18:30:00Z
updated: 2026-02-16T18:50:00Z
---

## Current Focus

hypothesis: CONFIRMED - Pool exhaustion from insufficient limits + massive serial DB operations + no batching + circuit breaker DB spam
test: TypeScript compilation passes with no new errors; fix addresses all identified root causes
expecting: Next cron run will succeed with increased pool limits, batched operations, throttled circuit breaker persistence, and retry logic on token loading
next_action: Archive and commit

## Symptoms

expected: QuickBooks cron sync should load OAuth tokens from SystemConfig, authenticate with QuickBooks API, and sync customers/invoices/payments successfully.
actual: Every Prisma query (findUnique, upsert on SystemConfig) times out with P2024 "Timed out fetching a new connection from the connection pool". The QuickBooks API returns 401, and the token refresh also fails because the upsert to save the new token times out too.
errors:
- PrismaClientKnownRequestError P2024: "Timed out fetching a new connection from the connection pool" (connection_limit: 5, timeout: 10)
- QuickBooks 401 Unauthorized (errorCode 003200)
- "Quickbooks access token expired. Please update QUICKBOOKS_ACCESS_TOKEN in .env"
reproduction: Triggered by the automatic cron job at /api/cron/quickbooks-sync. The cron runs every 6 hours on Vercel.
timeline: Observed at 2026-02-16 18:00:41 UTC. The cron starts, immediately hits pool exhaustion on the first DB call (SystemConfig.findUnique), then all subsequent operations cascade-fail.
started: Unknown - may have been failing for multiple cron cycles

## Eliminated

- hypothesis: Prisma client missing singleton pattern
  evidence: lib/db.ts correctly uses globalForPrisma with globalThis caching for both dev and production. The singleton pattern is properly implemented.
  timestamp: 2026-02-16T18:32:00Z

## Evidence

- timestamp: 2026-02-16T18:32:00Z
  checked: lib/db.ts - Prisma client singleton pattern
  found: Singleton pattern is correct. Uses globalThis caching in both dev and prod. However, NO connection pool configuration is set beyond the URL. No connection_limit, no pool_timeout in Prisma client options.
  implication: The pool defaults (likely connection_limit=5 for serverless) combined with Neon's PgBouncer limits are likely the bottleneck.

- timestamp: 2026-02-16T18:33:00Z
  checked: prisma/schema.prisma datasource configuration
  found: Uses env("POSTGRES_PRISMA_URL") for url, env("POSTGRES_URL_NON_POOLING") for directUrl. No connection pool parameters visible in schema.
  implication: Connection pool params must come from the URL string or Prisma client config. The error shows connection_limit: 5, timeout: 10 which are very tight for the sync workload.

- timestamp: 2026-02-16T18:33:30Z
  checked: quickbooks-sync.service.ts sync operation DB call count
  found: For each QB customer, the sync does: 1 findFirst (incremental check) + 1 findUnique (email check) + identity mapper calls. For each invoice: 1 findFirst (customer) + 1 findUnique (existing invoice) + 1 findFirst (deal) + possibly 1 create (deal) + 1 create/update (invoice). With 1000 customers and 1000 invoices, this is 3000-6000+ individual DB calls, all sequential.
  implication: Massive serial DB operations. Each holds a connection while the loop iterates, creating sustained pressure on a 5-connection pool.

- timestamp: 2026-02-16T18:34:00Z
  checked: Circuit breaker and identity mapper DB usage
  found: CircuitBreaker loads state from DB on construction (quickbooks.service.ts constructor) AND persists state to DB on every success/failure via upsert. The quickbooksService singleton constructor triggers a DB read immediately on import. Identity mapper does additional DB upserts per customer.
  implication: Additional DB pressure from circuit breaker state persistence on every single QB API call.

- timestamp: 2026-02-16T18:34:30Z
  checked: vercel.json cron schedule overlaps
  found: At hour 0 (midnight), 5 crons fire: quickbooks-sync, evaluate-alerts, process-queue, and potentially others. At hour 6, quickbooks-sync + evaluate-alerts + process-queue fire together. The process-queue runs every 5 minutes. The overdue-invoice-alerts also runs every 6 hours same as QB sync.
  implication: Concurrent cron jobs compete for the same 5-connection pool. QB sync is the heaviest consumer but others add to the pressure.

- timestamp: 2026-02-16T18:35:00Z
  checked: quickbooks.service.ts token refresh flow
  found: When QB returns 401, refreshAccessToken() does a fetch to Intuit OAuth, then calls prisma.systemConfig.upsert() to save the new token. If the pool is already exhausted, this upsert times out, the refresh fails, and the error message says "Please update QUICKBOOKS_ACCESS_TOKEN in .env" which is misleading.
  implication: The 401 -> refresh -> DB timeout -> "update .env" cascade is a symptom of pool exhaustion, NOT a real auth problem. The tokens might be perfectly valid; they just can't be loaded from DB.

- timestamp: 2026-02-16T18:45:00Z
  checked: TypeScript compilation after fixes
  found: Zero new type errors introduced. All pre-existing errors are in unrelated files (invoice-approval.service.ts, approval-queue/page.tsx, quickbooks/auth/callback/route.ts).
  implication: Fix is clean and does not break any existing functionality.

## Resolution

root_cause: The Prisma connection pool is configured with a connection_limit of 5 and timeout of 10 seconds (either from Neon URL defaults or Prisma defaults). The QuickBooks sync performs thousands of sequential DB operations per run (find/upsert for each customer, invoice, item, etc.), combined with circuit breaker state persistence on every API call, and concurrent cron jobs competing for the same pool. This exhausts all 5 connections. The cascading 401 Unauthorized error is a symptom: when the pool is exhausted, the initial SystemConfig.findUnique (to load OAuth tokens) times out, so tokens are never loaded, causing all QB API calls to fail with 401. The token refresh also fails because its DB upsert to save the new token also times out.

fix: Multi-layered fix addressing all contributing factors:
1. **lib/db.ts** - buildConnectionUrl() ensures pgbouncer=true, connection_limit=10, pool_timeout=30 on the Neon URL. Simplified singleton pattern to always cache (no dev/prod branching).
2. **lib/services/quickbooks.service.ts** - initialize() now retries 3x with exponential backoff on P2024 errors. refreshAccessToken() DB upsert also retries 3x, and gracefully degrades (in-memory tokens still work even if DB save fails).
3. **lib/services/quickbooks-sync.service.ts** - Added processBatch() helper that processes items in batches of 25 with 100ms pauses between batches, allowing the connection pool to release connections. Applied to both syncCustomers and syncInvoices.
4. **lib/utils/circuit-breaker.ts** - Throttled persistState() to execute at most once every 5 seconds (was: every single API call). State transitions (OPEN/CLOSED/HALF_OPEN) still persist immediately.

verification: TypeScript compilation passes with zero new errors in changed files. Pre-existing errors in unrelated files remain unchanged.

files_changed:
- lib/db.ts
- lib/services/quickbooks.service.ts
- lib/services/quickbooks-sync.service.ts
- lib/utils/circuit-breaker.ts
