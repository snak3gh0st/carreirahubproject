# Architecture

**Analysis Date:** 2026-01-09

## Pattern Overview

**Overall:** Next.js Full-Stack API + Webhook-Driven Automation

**Key Characteristics:**
- API-first design with REST endpoints (minimal UI)
- Webhook-driven integrations (Pipedrive, QuickBooks, Stripe, DocuSign)
- Event-driven async processing via BullMQ queues
- Identity Mapper pattern for customer deduplication
- Service layer encapsulation of business logic

## Layers

**API Routes Layer:**
- Purpose: Handle HTTP requests, validate input, orchestrate business logic
- Contains: Route handlers in `app/api/` with GET/POST/PATCH/DELETE functions
- Location: `app/api/` (customers, leads, invoices, chat, webhooks, cron jobs)
- Depends on: Service layer only
- Used by: External integrations, frontend, cron jobs

**Service Layer:**
- Purpose: Encapsulate business logic and external integrations
- Contains: Domain-specific services for leads, customers, invoices, SDR, AI, external APIs
- Location: `lib/services/` (17+ service files)
- Key services: `lead.service.ts`, `ai.service.ts`, `identity-mapper.ts`, `invoice-workflow.service.ts`
- Depends on: Database (Prisma), external APIs, utilities
- Used by: API routes, webhooks, cron jobs, queue processors

**Database & ORM Layer:**
- Purpose: Data persistence and queries
- Contains: Prisma ORM models, database schema, type definitions
- Location: `prisma/schema.prisma`, `lib/db.ts` (Prisma Client initialization)
- Depends on: PostgreSQL (Neon)
- Used by: All services

**Utility Layer:**
- Purpose: Shared helpers and abstractions
- Contains: Webhook validation, queue management, logging, error handling
- Location: `lib/utils/` (logger, queue, webhook-validation, etc.)
- Depends on: Database, external libraries
- Used by: Service and API layers

## Data Flow

**Webhook Event Processing (Primary Automation):**

1. External system (Pipedrive/QuickBooks/Stripe) sends webhook → API endpoint
2. Webhook signature validation (`lib/utils/webhook-validation.ts`)
3. Parse event payload and extract entity IDs
4. Identity Mapper reconciles customer across systems (`lib/services/identity-mapper.ts`)
5. Service layer processes business logic (create/update records, enqueue async jobs)
6. Async jobs queued via BullMQ for background processing
7. Integration logged to `IntegrationLog` table (`lib/utils/logger.ts`)
8. Return 200 OK to webhook sender

**Example: Pipedrive Deal Won Webhook** (`app/api/webhooks/pipedrive/deal/route.ts`):
1. Webhook received at `/api/webhooks/pipedrive/deal`
2. Validate signature using `PIPEDRIVE_WEBHOOK_SECRET`
3. Extract deal ID and person ID from payload
4. Fetch complete deal data from Pipedrive API
5. Reconcile customer via Identity Mapper (deduplicate)
6. Create/update Deal record in database
7. Enqueue invoice generation and contract generation jobs
8. Return 200 OK

**API Request Flow:**

1. Client calls REST endpoint (e.g., `GET /api/customers?email=...`)
2. Next.js route handler parses request
3. Validate input (with Zod schemas)
4. Call service method to fetch/process data
5. Service queries database via Prisma
6. Return JSON response with status code

**Queue-Based Async Processing:**

- Jobs enqueued by webhooks or API routes
- Vercel cron jobs (`app/api/cron/process-queue/route.ts`) poll and process queues every 5 minutes
- Available queues: `leadQualification`, `whatsappMessages`, `pipedriveSync`, `invoiceGeneration`, `contractGeneration`, `quickbooksSync`
- Failed jobs retry with exponential backoff

**State Management:**
- No in-memory state (stateless functions)
- All state persists in PostgreSQL
- Queue state in Redis (BullMQ)
- OAuth tokens stored in `SystemConfig` table (refreshed periodically)

## Key Abstractions

**Service Pattern:**
- Purpose: Encapsulate domain logic and external API interactions
- Examples: `leadService`, `aiService`, `identityMapper`, `pipedriveService`, `quickbooksService`, `stripeService`
- Pattern: Class-based with static singleton export (e.g., `export const leadService = new LeadService()`)
- Location: `lib/services/*.ts`

**Identity Mapper:**
- Purpose: Deduplicate customers across Pipedrive, QuickBooks, Stripe, DocuSign
- Implementation: `lib/services/identity-mapper.ts`
- Pattern: Email is unique key, external IDs stored as fields
- Usage: Called on every webhook that involves customer data

**Integration Logger:**
- Purpose: Audit trail for all external API calls
- Implementation: `lib/utils/logger.ts`, `IntegrationLog` table
- Usage: Log success/error for every Pipedrive, QuickBooks, Stripe, DocuSign operation
- Critical for debugging webhook failures

**Webhook Validation:**
- Purpose: Verify webhook authenticity (signature checking)
- Implementation: `lib/utils/webhook-validation.ts`
- Supports: Pipedrive (HMAC SHA256), QuickBooks (HMAC SHA256), Stripe (HMAC SHA256)
- Pattern: Compare header signature with computed HMAC

## Entry Points

**HTTP API Entry:**
- Location: `app/layout.tsx` (root layout), `app/api/` (route handlers)
- Triggers: HTTP requests from clients, webhooks from external systems
- Responsibilities: Parse requests, validate, call services, return responses

**Webhooks:**
- Location: `app/api/webhooks/*/route.ts` (Pipedrive, QuickBooks, Stripe, DocuSign, Retell, WhatsApp)
- Triggers: Events from external systems
- Responsibilities: Validate signature, process event, enqueue async jobs, log

**Cron Jobs:**
- Location: `app/api/cron/*/route.ts`
- Triggers: Vercel cron scheduler (defined in `vercel.json`)
- Responsibilities: Poll queues, run periodic sync, send reminders
- Schedule: Every 5-30 minutes depending on job type

## Error Handling

**Strategy:** Services throw errors, API routes catch and return HTTP responses

**Patterns:**
- Services throw `Error` with descriptive messages
- API routes wrap in try/catch, log to `IntegrationLog`, return 4xx/5xx responses
- Validation errors (Zod) caught and returned as 400 Bad Request
- Database errors caught and returned as 500 Internal Server Error
- Webhook signature failures return 401 Unauthorized

## Cross-Cutting Concerns

**Logging:**
- Integration logger via `lib/utils/logger.ts` (logs to `IntegrationLog` table)
- Console.log for debug output (visible in Vercel logs)
- No centralized logging service (could add Sentry/Datadog)

**Authentication:**
- NextAuth.js with JWT strategy (`lib/auth.ts`)
- Roles: ADMIN, SALES, SDR, FINANCE, SUPPORT, OPERATIONAL, COMMERCIAL
- Session storage: JWT in cookies (httpOnly)
- Protected routes: Middleware in `middleware.ts` (checks auth, roles)

**Validation:**
- Zod schemas for API input validation (`app/api/customers/route.ts`, etc.)
- Business rule validation in services (e.g., lead must be QUALIFIED before conversion)
- Webhook signature validation mandatory

**External API Calls:**
- All external calls wrapped in try/catch
- Errors logged to `IntegrationLog` with service/action/payload
- Retries handled by BullMQ for async jobs
- Timeout handling (Next.js function timeout is 10s)

---

*Architecture analysis: 2026-01-09*
*Update when major patterns change*
