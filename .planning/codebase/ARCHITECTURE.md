# Architecture

**Analysis Date:** 2026-02-17

## Pattern Overview

**Overall:** Service-Oriented Middleware with Event-Driven Webhook Processing

**Key Characteristics:**
- Next.js 14 App Router serves both the dashboard UI and the API/webhook layer
- Stateless service classes (`lib/services/`) encapsulate all business logic
- Identity Mapper pattern deduplicates customers across 7 external systems using email as the unique key
- Webhook-driven automation: external events (Pipedrive, QuickBooks, Stripe, DocuSign) trigger async workflows via BullMQ queues
- Circuit breaker pattern protects external API calls from cascading failures
- Vercel serverless deployment constrains queue processing to cron-based polling (no persistent workers)

## Layers

**Presentation Layer (Dashboard UI):**
- Purpose: Server-rendered and client-side React pages for internal operations team
- Location: `app/dashboard/`
- Contains: Page components (`page.tsx`), layout wrappers (`layout.tsx`)
- Depends on: API layer (via `fetch` to `/api/*`), component library (`components/`)
- Used by: Internal users (ADMIN, SALES, SDR, FINANCE, SUPPORT, OPERATIONAL, COMMERCIAL)

**API Layer (Route Handlers):**
- Purpose: RESTful endpoints for CRUD, webhooks, cron jobs, and integrations
- Location: `app/api/`
- Contains: Next.js route handlers exporting `GET`, `POST`, `PATCH`, `DELETE` functions
- Depends on: Service layer, Prisma ORM, auth utilities
- Used by: Dashboard UI, external webhook sources, Vercel cron scheduler

**Service Layer (Business Logic):**
- Purpose: Stateless singletons encapsulating domain logic and external API interactions
- Location: `lib/services/`
- Contains: Class-based services with singleton exports (e.g., `export const sdrService = new SDRService()`)
- Depends on: Prisma ORM (`lib/db.ts`), utility functions (`lib/utils/`), AI prompts (`lib/prompts/`)
- Used by: API layer, queue workers, cron job handlers

**Infrastructure Layer (Utilities & Cross-Cutting):**
- Purpose: Queue management, webhook handling, circuit breakers, logging, validation
- Location: `lib/utils/`
- Contains: Queue definitions, webhook handler, circuit breaker, logger, HMAC validation
- Depends on: BullMQ, Redis, Prisma ORM
- Used by: Service layer, API layer

**Data Layer (Database & ORM):**
- Purpose: PostgreSQL schema, Prisma client, and database views
- Location: `prisma/schema.prisma`, `lib/db.ts`
- Contains: 22 models, 14 enums, materialized views for BI
- Depends on: Neon PostgreSQL (pooled via PgBouncer)
- Used by: All server-side layers

**Component Layer (UI Library):**
- Purpose: Reusable React components for the dashboard
- Location: `components/`
- Contains: UI primitives (`components/ui/`), domain components (`components/dashboard/`, `components/invoices/`, `components/analytics/`)
- Depends on: Tailwind CSS, Lucide icons, Radix UI primitives, Recharts
- Used by: Presentation layer (`app/dashboard/`)

## Data Flow

**Webhook-to-Automation Flow (Primary):**

1. External system (Pipedrive/QuickBooks/Stripe/DocuSign) sends webhook to `app/api/webhooks/{service}/route.ts`
2. Route validates signature via `lib/utils/webhook-validation.ts`
3. `acceptWebhook()` in `lib/utils/webhook-handler.ts` checks for duplicates using `WebhookEvent` table
4. Stores event in `WebhookEvent` table with status `pending`
5. Enqueues job via `lib/utils/webhook-queue.ts` into appropriate BullMQ queue
6. Returns HTTP 200 immediately (always, even on errors - prevents external retries)
7. `app/api/cron/process-queue/route.ts` polls queues every 5 minutes
8. `lib/utils/queue-processor.ts` processes jobs with 5-second per-job timeout (8-second total)
9. Service layer performs business logic (e.g., create customer, qualify lead, generate invoice)
10. All external API calls logged to `IntegrationLog` table

**Customer Creation Flow:**

1. User submits form or webhook delivers person data
2. `identityMapper.reconcileCustomer()` in `lib/services/identity-mapper.ts` finds-or-creates Customer by email
3. Customer synced to QuickBooks via `quickbooksService.getOrCreateCustomer()`
4. Customer synced to Pipedrive via `pipedriveService.createPerson()`
5. External IDs stored on Customer record (`quickbooks_id`, `pipedrive_id`, etc.)
6. Each sync logged independently to `IntegrationLog` - failures do not block creation

**Lead Qualification Flow:**

1. Lead enters system (Pipedrive webhook or manual creation)
2. `sdrService.processNewLead()` in `lib/services/sdr.service.ts` orchestrates qualification
3. Conversation history fetched from `Conversation` + `Message` tables
4. `aiService.qualifyLead()` in `lib/services/ai.service.ts` scores lead 0-100 via OpenAI
5. Score compared to `SDR_QUALIFICATION_THRESHOLD` (default: 70)
6. Qualified leads get WhatsApp notification via `whatsappService`
7. Unqualified leads remain in `QUALIFYING` status for human SDR review

**Deal Won Workflow (Invoice + Contract):**

1. Pipedrive deal-won webhook triggers `app/api/webhooks/pipedrive/deal/route.ts`
2. `invoiceWorkflowService.processDealWon()` in `lib/services/invoice-workflow.service.ts` orchestrates
3. Customer reconciled via Identity Mapper (ensures QuickBooks + DocuSign IDs exist)
4. Invoice created in QuickBooks via `quickbooksService`
5. Contract generated and sent via `docusignService`
6. Workflow status tracked on `Deal` record (`workflowStatus`, `workflowStartedAt`, `workflowCompletedAt`)
7. All steps wrapped in `workflowStatusService` for progress tracking

**State Management (Client-Side):**
- TanStack Query (`@tanstack/react-query`) manages server state with 5-minute stale time
- NextAuth session via `useSession()` hook for authentication state
- Custom `ToastContext` (`lib/contexts/toast.context.tsx`) for notifications
- URL search params for dashboard filters (date range, status, segment)
- No global client state store (Redux/Zustand) - all state is server-derived

## Key Abstractions

**Identity Mapper:**
- Purpose: Single source of truth for customer identity across 7 external systems
- Location: `lib/services/identity-mapper.ts`
- Pattern: Email is the unique key. `reconcileCustomer()` finds existing customer by email, updates external IDs and PII fields, or creates new. Never creates duplicates.
- Critical rule: Always use `identityMapper.reconcileCustomer()` when customer data arrives from external systems

**Circuit Breaker:**
- Purpose: Prevents cascading failures when external APIs (QuickBooks, Pipedrive, etc.) are down
- Location: `lib/utils/circuit-breaker.ts`
- Pattern: CLOSED -> OPEN (after N failures) -> HALF_OPEN (after timeout) -> CLOSED (after success). State persisted to `CircuitBreakerState` table.
- Factory: `getCircuitBreaker(serviceName)` returns singleton per service

**Webhook Handler:**
- Purpose: Standardized webhook acceptance with idempotency and async processing
- Location: `lib/utils/webhook-handler.ts`
- Pattern: Validate -> Deduplicate via `WebhookEvent` table -> Store -> Enqueue -> Return 200 OK immediately
- Always returns 200 to prevent external retry storms

**Integration Logger:**
- Purpose: Structured logging of all external API operations for debugging and observability
- Location: `lib/utils/logger.ts`
- Pattern: Every external API call (success or failure) creates an `IntegrationLog` record with service, action, status, payload, and error details
- Used throughout service layer for auditability

**Queue System:**
- Purpose: Async processing with retry logic and exponential backoff
- Location: `lib/utils/queue.ts` (definitions), `lib/utils/queue-processor.ts` (processing), `lib/utils/webhook-queue.ts` (webhook helpers)
- Pattern: Lazy-initialized BullMQ queues via Proxy pattern. Jobs added with configurable retry (3-5 attempts, exponential backoff). Processing via Vercel cron (not persistent workers).
- Available queues: `leadQualification`, `whatsappMessages`, `pipedriveSync`, `pipedriveReverseSync`, `invoiceGeneration`, `invoiceApproval`, `contractGeneration`, `quickbooksSync`, `bulkImport`

**SystemConfig (OAuth Token Store):**
- Purpose: Database-persisted configuration for OAuth tokens that need periodic refresh
- Location: Prisma model `SystemConfig` (singleton, id="system")
- Pattern: QuickBooks access/refresh tokens stored in DB because they expire and need API-triggered refresh. Other secrets use environment variables.

## Entry Points

**Root Page (`/`):**
- Location: `app/page.tsx`
- Triggers: Direct navigation
- Responsibilities: Checks session, redirects to `/dashboard` (authenticated) or `/auth/signin` (unauthenticated)

**Dashboard Layout:**
- Location: `app/dashboard/layout.tsx`
- Triggers: Any `/dashboard/*` route
- Responsibilities: Server-side session check, renders `ProfessionalSidebar` and `SupportChatBubble`, provides layout structure

**API Webhooks:**
- Location: `app/api/webhooks/{pipedrive,quickbooks,stripe,docusign,whatsapp}/route.ts`
- Triggers: External system HTTP POST callbacks
- Responsibilities: Signature validation, webhook acceptance, async enqueuing

**Cron Jobs:**
- Location: `app/api/cron/*/route.ts`
- Triggers: Vercel Cron scheduler (configured in `vercel.json`)
- Responsibilities: Queue processing (every 5 min), QuickBooks sync (every 6 hours), token refresh (daily), alerts evaluation (hourly), payment/contract reminders (daily)
- Key cron endpoints:
  - `process-queue` - every 5 minutes, processes BullMQ jobs
  - `quickbooks-sync` - every 6 hours, bidirectional sync
  - `refresh-quickbooks-token` - daily at 2 AM
  - `evaluate-alerts` - hourly
  - `send-scheduled-invoices` - daily at 9 AM
  - `payment-reminders` - daily at 10 AM
  - `overdue-invoices` - daily at 2 AM
  - `collection-calls` - daily at 1 PM
  - `contract-reminders` - daily at 9 AM
  - `daily-ar-digest` - daily at 9 AM

**Auth Entry:**
- Location: `app/auth/signin/page.tsx`, `app/api/auth/[...nextauth]/route.ts`
- Triggers: Unauthenticated access, login form submission
- Responsibilities: Credential authentication, JWT token creation, session management

**Payment Portal (Public):**
- Location: `app/payment/[invoiceId]/page.tsx`
- Triggers: Payment links sent to customers
- Responsibilities: Public-facing Stripe payment form for invoice payment

## Error Handling

**Strategy:** Graceful degradation with comprehensive logging. External API failures never block core operations.

**Patterns:**
- **Webhook routes** always return HTTP 200, even on errors, to prevent external retry storms. Errors logged to `IntegrationLog`.
- **Service layer** catches all external API errors, logs them, and continues with degraded functionality (e.g., customer created locally even if QuickBooks sync fails).
- **Circuit breaker** wraps external API calls. When circuit is OPEN, operations fail fast with `CircuitOpenError` without hitting the external API.
- **Queue retry** with exponential backoff (3-5 attempts, 2-60 second base delays) handles transient failures.
- **API routes** use Zod validation for request bodies, return structured error responses with appropriate HTTP status codes.
- **Error fallback utility** (`lib/utils/error-fallback.ts`) categorizes errors and generates user-friendly fallback responses.

## Cross-Cutting Concerns

**Logging:**
- `IntegrationLogger` (`lib/utils/logger.ts`) writes structured logs to `IntegrationLog` database table
- Console logging with `[SERVICE_NAME]` prefix convention (e.g., `[AUTH]`, `[SDR]`, `[CUSTOMER_CREATE]`)
- All external API calls must create IntegrationLog entries (success and failure)

**Validation:**
- Zod schemas for API request body validation (e.g., `createCustomerSchema` in `app/api/customers/route.ts`)
- HMAC signature verification for webhooks (`lib/utils/webhook-validation.ts`, `lib/utils/hmac.ts`)
- Prisma schema-level constraints (unique, required, defaults)

**Authentication:**
- NextAuth.js with Credentials provider and JWT strategy (`lib/auth.ts`)
- Password hashing via bcrypt (`lib/services/auth.service.ts`)
- JWT maxAge: 30 days, session refresh: every 24 hours

**Authorization (RBAC):**
- Middleware-level route protection (`middleware.ts`) checks JWT token role against `routeRoleMap`
- 7 roles: ADMIN, SALES, SDR, FINANCE, SUPPORT, OPERATIONAL, COMMERCIAL
- Route prefix matching: first match wins in ordered list
- API routes perform role checks inline using `getServerSession()` + role comparison
- Dashboard pages render role-specific views (e.g., `app/dashboard/page.tsx` shows different UIs per role)

**Internationalization:**
- UI language: Portuguese (Brazilian) - hardcoded, no i18n framework
- HTML lang attribute: `pt-BR`
- Customer `preferredLanguage` field defaults to `pt-BR`

---

*Architecture analysis: 2026-02-17*
