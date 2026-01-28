# Architecture

**Analysis Date:** 2026-01-27

## Pattern Overview

**Overall:** Event-Driven Middleware with Service Layer Pattern

**Key Characteristics:**
- Webhook-driven automation replacing No-Code/SaaS tools
- Identity Mapper pattern for customer deduplication across systems
- Queue-based async processing with BullMQ (Redis-backed)
- Serverless-first design (Vercel Functions)
- Single Source of Truth (SSOT) via PostgreSQL with Prisma ORM

## Layers

**Presentation Layer:**
- Purpose: Next.js Server Components and Client Components for dashboard UI
- Location: `app/dashboard/**/*.tsx`, `components/**/*.tsx`
- Contains: React pages, forms, tables, KPI cards
- Depends on: API Routes (internal fetch calls)
- Used by: Authenticated users via NextAuth session

**API Layer:**
- Purpose: HTTP endpoints for UI and external webhook receivers
- Location: `app/api/**/route.ts`
- Contains: Next.js 14 App Router route handlers (GET/POST/PATCH/DELETE)
- Depends on: Service Layer, Prisma Client
- Used by: Dashboard UI, External services (Pipedrive, QuickBooks, Stripe, DocuSign, Twilio)

**Service Layer:**
- Purpose: Business logic orchestration and external API integrations
- Location: `lib/services/*.service.ts`
- Contains: Stateless service classes with singleton exports
- Depends on: Prisma Client, External SDKs, Utility functions
- Used by: API Routes, Queue Processors, Other Services

**Data Access Layer:**
- Purpose: Database operations and ORM abstraction
- Location: `lib/db.ts`, Prisma Client (`@prisma/client`)
- Contains: Singleton Prisma Client with connection pooling
- Depends on: PostgreSQL (Neon)
- Used by: Services, API Routes, Queue Processors

**Queue Processing Layer:**
- Purpose: Asynchronous job processing with retry logic
- Location: `lib/utils/queue.ts`, `lib/utils/queue-processor.ts`
- Contains: BullMQ queues, workers, event handlers
- Depends on: Redis, Service Layer
- Used by: Webhook handlers, Cron jobs (Vercel)

**Utility Layer:**
- Purpose: Cross-cutting concerns and reusable functions
- Location: `lib/utils/*.ts`, `lib/middleware/*.ts`
- Contains: Webhook validation, circuit breakers, retry logic, logging, HMAC signatures
- Depends on: None (or minimal)
- Used by: All layers

## Data Flow

**Webhook Ingestion Flow (Pipedrive Lead Created):**

1. `POST /api/webhooks/pipedrive/lead` receives webhook
2. Validate HMAC signature via `lib/utils/webhook-validation.ts`
3. `acceptWebhook()` from `lib/utils/webhook-handler.ts`:
   - Extract event ID for deduplication
   - Check `WebhookEvent` table for duplicates
   - Store webhook in database (status: pending)
   - Enqueue to `webhook-queue` (BullMQ)
4. Return `200 OK` immediately (sub-100ms response)
5. Queue processor (`lib/utils/queue-processor.ts`) picks up job
6. Call `identityMapper.reconcileCustomer()` to deduplicate by email
7. Create `Lead` in database
8. Enqueue to `leadQualification` queue
9. SDR Service qualifies lead via AI (`aiService.qualifyLead()`)
10. If score ≥ 70: send WhatsApp message via `whatsappService`
11. Log all operations to `IntegrationLog` table

**Deal Won to Invoice Flow:**

1. `POST /api/webhooks/pipedrive/deal` receives Deal Won event
2. Validate signature and accept webhook
3. Find `Deal` in database by `pipedrive_deal_id`
4. Trigger `invoiceWorkflowService.processDealWon(dealId)` asynchronously
5. Workflow orchestration:
   - Reconcile customer (Identity Mapper)
   - Create QuickBooks customer (if not exists)
   - Create QuickBooks invoice via `quickbooksService`
   - Store invoice in `Invoice` table
   - Generate DocuSign contract via `docusignService`
   - Store contract in `Contract` table
   - Update `WorkflowStatus` table
6. Send invoice email + contract link to customer
7. Log each step to `IntegrationLog`

**State Management:**
- Server-side state: Prisma Client queries (no caching)
- Client-side state: React `useState` for form inputs, `useEffect` for API fetches
- Session state: NextAuth JWT tokens (30-day expiry)

## Key Abstractions

**Identity Mapper (Customer Deduplication):**
- Purpose: Enforce email as unique key across all external systems
- Examples: `lib/services/identity-mapper.ts`
- Pattern: Reconcile or Create - never duplicate customers
- Used by: All webhook handlers, workflow services

**Service Classes:**
- Purpose: Encapsulate business logic and external API operations
- Examples: `lib/services/quickbooks.service.ts`, `lib/services/sdr.service.ts`, `lib/services/invoice-workflow.service.ts`
- Pattern: Singleton class exports (`export const sdrService = new SDRService()`)
- Used by: API routes, queue processors, other services

**Workflow Orchestrators:**
- Purpose: Multi-step business processes with error handling and retry
- Examples: `lib/services/invoice-workflow.service.ts`, `lib/services/contract-workflow.service.ts`, `lib/services/payment-workflow.service.ts`
- Pattern: Async methods with try-catch, integration logging, queue enqueuing

**Queue Jobs:**
- Purpose: Async processing with exponential backoff retry
- Examples: `leadQualification`, `whatsappMessages`, `invoiceGeneration`, `quickbooksSync`
- Pattern: BullMQ queues with 3-5 retry attempts, logged to `IntegrationLog`

**Webhook Event Store:**
- Purpose: Idempotency and audit trail for all incoming webhooks
- Examples: `WebhookEvent` model in `prisma/schema.prisma`
- Pattern: Event sourcing - store raw payload + metadata, process once, mark as success/failure

## Entry Points

**Root Application Entry:**
- Location: `app/page.tsx`
- Triggers: Browser navigation to `/`
- Responsibilities: Redirect authenticated users to `/dashboard`, unauthenticated to `/auth/signin`

**Authentication Entry:**
- Location: `app/api/auth/[...nextauth]/route.ts`
- Triggers: NextAuth.js OAuth flow
- Responsibilities: Handle login, JWT token generation, session management

**Dashboard Entry:**
- Location: `app/dashboard/page.tsx`
- Triggers: Authenticated user navigates to `/dashboard`
- Responsibilities: Fetch and display KPIs (sales, finance, customers), render quick actions

**Webhook Receivers:**
- Location: `app/api/webhooks/{service}/{event}/route.ts`
- Triggers: External HTTP POST from Pipedrive, QuickBooks, Stripe, DocuSign, Twilio
- Responsibilities: Validate signature, accept webhook, enqueue for processing, return 200 OK

**Cron Jobs:**
- Location: `app/api/cron/{job}/route.ts`
- Triggers: Vercel Cron (configured in `vercel.json`)
- Responsibilities: Periodic tasks (QuickBooks token refresh, overdue invoice reminders, collection calls)

**Queue Workers:**
- Location: `lib/utils/queue-processor.ts`
- Triggers: Jobs added to BullMQ queues
- Responsibilities: Process async jobs (lead qualification, invoice generation, sync operations)

## Error Handling

**Strategy:** Graceful degradation with comprehensive logging

**Patterns:**
- All external API calls wrapped in `try-catch` with fallback responses
- Integration failures logged to `IntegrationLog` table (service, action, status, error, payload)
- Webhook signature validation failures still return `200 OK` to prevent external retries (logged as errors)
- Queue jobs retry 3-5 times with exponential backoff before moving to dead letter queue
- AI service failures return fallback messages and escalate to human
- Database errors logged and re-thrown (no silent failures)

**Dead Letter Queue:**
- Location: `app/api/webhooks/dead-letter/route.ts`
- Purpose: Manual reprocessing of failed webhooks via UI (`app/dashboard/webhooks/page.tsx`)

## Cross-Cutting Concerns

**Logging:** 
- Approach: Dual logging - `console.log` for runtime + `IntegrationLog` table for audit trail
- Service: `lib/utils/logger.ts` with `integrationLogger.logSuccess()` and `integrationLogger.logError()`
- Pattern: All external API calls, webhook events, workflow steps logged

**Validation:** 
- Approach: Multi-layered - HMAC signatures for webhooks, Prisma schema constraints, TypeScript types
- Service: `lib/utils/webhook-validation.ts` for signature verification
- Pattern: Validate at entry points (API routes), rely on TypeScript + Prisma for internal safety

**Authentication:** 
- Approach: NextAuth.js with JWT strategy
- Configuration: `lib/auth.ts` with `authOptions`
- Pattern: Middleware (`middleware.ts`) protects `/dashboard` routes by role (RBAC)
- Roles: ADMIN, SALES, SDR, FINANCE, SUPPORT, OPERATIONAL, COMMERCIAL

**Authorization (RBAC):**
- Approach: Role-based access control via middleware and session checks
- Pattern: `middleware.ts` checks user role and redirects unauthorized access
- Example: `/dashboard/invoices` requires ADMIN, FINANCE, or COMMERCIAL role

**Circuit Breaker:**
- Approach: Prevent cascading failures from external API downtime
- Service: `lib/utils/circuit-breaker.ts`
- Pattern: Track failure rate per service, open circuit after threshold, auto-recover after cooldown

**Retry Logic:**
- Approach: Exponential backoff for transient failures
- Service: `lib/utils/retry-logic.ts`, BullMQ queue retry configs
- Pattern: 3-5 attempts with 2s → 4s → 8s delays

**Rate Limiting:**
- Approach: Respect external API rate limits (QuickBooks, Stripe)
- Pattern: Batch operations, queue throttling, circuit breaker triggers

---

*Architecture analysis: 2026-01-27*
