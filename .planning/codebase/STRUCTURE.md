# Codebase Structure

**Analysis Date:** 2026-02-17

## Directory Layout

```
carreirahubproject/
├── app/                        # Next.js App Router (pages + API)
│   ├── api/                    # API route handlers
│   │   ├── analytics/          # BI dashboard endpoints
│   │   ├── auth/               # NextAuth endpoints
│   │   ├── chat/               # AI chatbot API
│   │   ├── contracts/          # Contract CRUD
│   │   ├── conversations/      # Conversation CRUD
│   │   ├── cron/               # Vercel cron job endpoints
│   │   ├── customers/          # Customer CRUD + QB sync
│   │   ├── dashboard/          # Dashboard metrics + alerts
│   │   ├── deals/              # Deal CRUD + workflow
│   │   ├── debug/              # Debug/diagnostic endpoints
│   │   ├── docusign/           # DocuSign template management
│   │   ├── docs/               # API documentation endpoint
│   │   ├── integration-logs/   # Integration log viewer
│   │   ├── integrations/       # Integration management + bulk import
│   │   ├── invoices/           # Invoice CRUD + creation + deletion
│   │   ├── leads/              # Lead CRUD + qualification
│   │   ├── pipedrive/          # Pipedrive API proxy
│   │   ├── quickbooks/         # QuickBooks OAuth, sync, items, payments
│   │   ├── search/             # Global search endpoint
│   │   ├── support/            # Support chat + tickets
│   │   ├── system/             # System status + secrets management
│   │   ├── users/              # User management
│   │   └── webhooks/           # Inbound webhook receivers
│   │       ├── dead-letter/    # Dead letter queue management
│   │       ├── docusign/       # DocuSign event webhooks
│   │       ├── health/         # Webhook health check
│   │       ├── pipedrive/      # Pipedrive webhooks (lead, deal, person)
│   │       ├── quickbooks/     # QuickBooks change notifications
│   │       ├── reprocess/      # Webhook reprocessing
│   │       ├── retell/         # Retell AI voice webhooks
│   │       ├── stripe/         # Stripe payment webhooks
│   │       └── whatsapp/       # Twilio WhatsApp webhooks
│   ├── auth/                   # Auth pages
│   │   └── signin/             # Login page
│   ├── dashboard/              # Protected dashboard pages
│   │   ├── analytics/          # Analytics/BI page
│   │   ├── contracts/          # Contract list, detail, creation
│   │   ├── conversations/      # Conversation list + detail
│   │   ├── customers/          # Customer list, detail, edit, new
│   │   ├── deals/              # Deal list, detail, workflow
│   │   ├── debug/              # Debug tools (admin only)
│   │   ├── insights/           # Business insights page
│   │   ├── integrations/       # Integration hub, bulk import, sync status
│   │   ├── invoices/           # Invoice list, detail, edit, new, approval
│   │   ├── leads/              # Lead list, detail, new
│   │   ├── payments/           # Payment list + detail
│   │   ├── settings/           # Settings + integration config
│   │   ├── support/            # Support ticket management
│   │   ├── webhooks/           # Webhook monitoring (admin)
│   │   └── workflows/          # Workflow monitoring (admin)
│   ├── payment/                # Public payment portal (unauthenticated)
│   │   ├── [invoiceId]/        # Stripe payment page
│   │   ├── cancel/             # Payment cancelled page
│   │   └── success/            # Payment success page
│   ├── test/                   # Test page
│   ├── globals.css             # Global Tailwind styles + custom tokens
│   ├── layout.tsx              # Root layout (providers, fonts)
│   └── page.tsx                # Root page (redirect to dashboard or signin)
├── components/                 # React components
│   ├── analytics/              # Chart components (Recharts-based)
│   ├── customers/              # Customer-specific components
│   ├── dashboard/              # Dashboard components (sidebar, filters, KPIs, skeletons)
│   │   └── charts/             # Dashboard chart components
│   ├── invoices/               # Invoice-specific components (forms, status badges)
│   ├── providers/              # Context providers (session, query)
│   ├── search/                 # Global search component
│   ├── support/                # Support chat bubble + interface
│   ├── tables/                 # Reusable table components
│   └── ui/                     # Primitive UI components (button, card, input, etc.)
├── lib/                        # Shared library code
│   ├── contexts/               # React contexts
│   │   └── toast.context.tsx   # Toast notification context
│   ├── middleware/              # Custom middleware (empty/unused)
│   ├── prompts/                # AI prompt templates
│   │   ├── customer-service.ts # Customer service chatbot prompt
│   │   ├── lead-qualification.ts # Lead qualification AI prompt
│   │   └── support-chat.ts    # Internal support chat prompt
│   ├── services/               # Business logic services (29 files)
│   └── utils/                  # Utility functions (18 files)
├── prisma/                     # Database schema and migrations
│   ├── schema.prisma           # Prisma schema (22 models, 14 enums)
│   └── migrations/             # Database migrations
├── scripts/                    # CLI scripts for operations and testing (67 files)
├── docs/                       # Documentation
├── .planning/                  # GSD planning files
├── middleware.ts                # Next.js middleware (auth + RBAC)
├── next.config.js              # Next.js configuration
├── tsconfig.json               # TypeScript configuration
├── vercel.json                 # Vercel deployment config (cron jobs)
├── package.json                # Dependencies and scripts
└── CLAUDE.md                   # AI assistant instructions
```

## Directory Purposes

**`app/api/`:**
- Purpose: All backend logic as Next.js API route handlers
- Contains: `route.ts` files exporting HTTP method functions (GET, POST, PATCH, DELETE)
- Key files: `app/api/customers/route.ts`, `app/api/invoices/create/route.ts`, `app/api/webhooks/pipedrive/lead/route.ts`
- Convention: Each route directory contains a single `route.ts` file

**`app/dashboard/`:**
- Purpose: Protected internal dashboard pages
- Contains: Server and client components for each domain area
- Key files: `app/dashboard/page.tsx` (main dashboard), `app/dashboard/layout.tsx` (sidebar + auth)
- Convention: Each page is a `page.tsx`, nested routes use `[id]` dynamic segments

**`app/api/cron/`:**
- Purpose: Vercel-scheduled background jobs
- Contains: Cron endpoint handlers triggered by `vercel.json` schedule
- Key files: `app/api/cron/process-queue/route.ts` (queue processing), `app/api/cron/quickbooks-sync/route.ts` (QB sync)
- Convention: Each cron job has its own directory with `route.ts`

**`app/api/webhooks/`:**
- Purpose: Inbound webhook receivers from external systems
- Contains: POST handlers that validate, store, and enqueue webhooks
- Key files: `app/api/webhooks/pipedrive/lead/route.ts`, `app/api/webhooks/quickbooks/route.ts`
- Convention: Always return 200 OK, use `acceptWebhook()` helper

**`lib/services/`:**
- Purpose: All business logic encapsulated in stateless service classes
- Contains: 29 service files as class singletons
- Key files:
  - `lib/services/identity-mapper.ts` - Customer deduplication engine
  - `lib/services/quickbooks.service.ts` - QuickBooks API wrapper (largest: 60KB)
  - `lib/services/quickbooks-sync.service.ts` - Bidirectional QB sync (53KB)
  - `lib/services/docusign.service.ts` - DocuSign contract management (31KB)
  - `lib/services/notification.service.ts` - Multi-channel notifications (37KB)
  - `lib/services/stripe.service.ts` - Stripe payment processing (21KB)
  - `lib/services/invoice-workflow.service.ts` - Deal-won workflow orchestration
  - `lib/services/sdr.service.ts` - AI lead qualification orchestration
  - `lib/services/ai.service.ts` - OpenAI integration
  - `lib/services/pipedrive.service.ts` - Pipedrive API wrapper
  - `lib/services/pipedrive-sync.service.ts` - Bidirectional Pipedrive sync
  - `lib/services/email.service.ts` - Email sending
  - `lib/services/whatsapp.service.ts` - Twilio WhatsApp messaging
  - `lib/services/support-chat.service.ts` - AI-powered support chat
  - `lib/services/workflow-status.service.ts` - Deal workflow tracking
- Convention: `*.service.ts` naming, class with singleton export at bottom (e.g., `export const sdrService = new SDRService()`)

**`lib/utils/`:**
- Purpose: Infrastructure utilities and cross-cutting concerns
- Contains: 18 utility modules
- Key files:
  - `lib/utils/queue.ts` - BullMQ queue definitions and job helpers
  - `lib/utils/queue-processor.ts` - Cron-based queue processing for Vercel
  - `lib/utils/webhook-handler.ts` - Webhook acceptance with idempotency
  - `lib/utils/webhook-queue.ts` - Webhook-specific queue helpers
  - `lib/utils/circuit-breaker.ts` - Circuit breaker pattern implementation
  - `lib/utils/logger.ts` - IntegrationLog structured logger
  - `lib/utils/webhook-validation.ts` - HMAC signature verification
  - `lib/utils/invoice-number.ts` - Custom invoice number generation
  - `lib/utils/error-fallback.ts` - Graceful error response generation
  - `lib/utils/date.ts` - Date utilities (timezone handling)
  - `lib/utils/cn.ts` - Tailwind className merge utility
  - `lib/utils/export-csv.ts` - CSV export utility
  - `lib/utils/accessibility.ts` - Accessibility helpers

**`components/ui/`:**
- Purpose: Primitive, reusable UI components (design system)
- Contains: 25 component files
- Key files: `button.tsx`, `card.tsx`, `input.tsx`, `select.tsx`, `dialog.tsx`, `table.tsx`, `toast.tsx`, `stat-card.tsx`, `badge.tsx`, `pagination.tsx`
- Convention: Single component per file, Tailwind-styled, some using Radix UI primitives

**`components/dashboard/`:**
- Purpose: Dashboard-specific components (sidebar, filters, KPIs, skeletons)
- Contains: 22 component files + `charts/` subdirectory
- Key files: `professional-sidebar.tsx`, `sidebar-nav.tsx`, `dashboard-filters.tsx`, `alerts-widget.tsx`, `quick-filters.tsx`

**`components/analytics/`:**
- Purpose: Recharts-based chart components for insights/BI pages
- Contains: 13 chart components
- Key files: `revenue-trend-chart.tsx`, `invoice-status-chart.tsx`, `cash-flow-chart.tsx`, `receivables-forecast-chart.tsx`

**`components/invoices/`:**
- Purpose: Invoice-specific UI components
- Contains: 11 components (forms, status badges, workflow timeline)
- Key files: `edit-invoice-form.tsx`, `invoice-filters.tsx`, `payment-status-card.tsx`, `contract-status-card.tsx`

**`prisma/`:**
- Purpose: Database schema, migrations, and views
- Key files: `prisma/schema.prisma` (the schema definition)
- Contains: 22 models (User, Customer, Lead, Deal, Invoice, Payment, Contract, etc.), 14 enums

**`scripts/`:**
- Purpose: CLI scripts for database operations, testing, debugging, and user management
- Contains: 67 files (`.ts`, `.js`, `.sh`, `.mjs`)
- Key files: `create-test-user.ts`, `seed-test-data.ts`, `clear-database.js`, `test-quickbooks.ts`, `manage-users-with-password.ts`
- Convention: Run via `npx tsx scripts/[name].ts` or npm scripts defined in `package.json`

**`lib/prompts/`:**
- Purpose: AI system prompts for OpenAI-powered features
- Contains: 3 prompt template files
- Key files: `customer-service.ts` (chatbot), `lead-qualification.ts` (scoring), `support-chat.ts` (internal support)

## Key File Locations

**Entry Points:**
- `app/page.tsx`: Root redirect (authenticated -> dashboard, unauthenticated -> signin)
- `app/layout.tsx`: Root layout (providers: SessionProvider, QueryProvider, ToastProvider)
- `app/dashboard/layout.tsx`: Dashboard layout (sidebar, auth check)
- `middleware.ts`: Auth middleware (RBAC route protection)

**Configuration:**
- `next.config.js`: Next.js config (strict TypeScript and ESLint)
- `tsconfig.json`: TypeScript config (strict mode, `@/*` path alias)
- `vercel.json`: Vercel deployment + 13 cron job schedules
- `package.json`: Dependencies and npm scripts
- `prisma/schema.prisma`: Database schema definition

**Core Logic:**
- `lib/services/identity-mapper.ts`: Customer deduplication (the SSOT pattern)
- `lib/services/invoice-workflow.service.ts`: Deal-won workflow orchestration
- `lib/services/quickbooks.service.ts`: QuickBooks API operations
- `lib/services/sdr.service.ts`: AI lead qualification
- `lib/utils/queue-processor.ts`: Cron-based queue processing
- `lib/utils/webhook-handler.ts`: Webhook acceptance pipeline

**Auth & Security:**
- `lib/auth.ts`: NextAuth configuration (JWT strategy, credentials provider)
- `lib/services/auth.service.ts`: Password hashing (bcrypt)
- `middleware.ts`: Route-level RBAC enforcement
- `lib/utils/hmac.ts`: HMAC signature utilities

**Database:**
- `lib/db.ts`: Prisma client singleton (connection pooling configured for Neon)
- `prisma/schema.prisma`: Full schema definition

**Design System:**
- `lib/design-tokens.ts`: Programmatic color/spacing tokens
- `app/globals.css`: Tailwind base styles + custom CSS variables
- `components/ui/`: UI component library

## Naming Conventions

**Files:**
- Services: `kebab-case.service.ts` (e.g., `quickbooks-sync.service.ts`)
- API routes: `route.ts` inside descriptive directories (Next.js convention)
- Components: `kebab-case.tsx` (e.g., `professional-sidebar.tsx`, `stat-card.tsx`)
- Utilities: `kebab-case.ts` (e.g., `circuit-breaker.ts`, `webhook-handler.ts`)
- Prompts: `kebab-case.ts` (e.g., `lead-qualification.ts`)

**Directories:**
- API routes: `kebab-case/` (e.g., `integration-logs/`, `dead-letter/`)
- Dynamic segments: `[paramName]/` (e.g., `[id]/`, `[invoiceId]/`, `[conversationId]/`)
- Component groups: `kebab-case/` (e.g., `components/analytics/`, `components/invoices/`)

**Exports:**
- Service singletons: `export const serviceName = new ServiceClass()` (e.g., `export const sdrService = new SDRService()`)
- Components: Named exports (e.g., `export function ProfessionalSidebar()`)
- Utilities: Named function exports (e.g., `export function getCircuitBreaker()`)

## Where to Add New Code

**New API Endpoint:**
- Create directory: `app/api/{resource}/route.ts`
- With dynamic param: `app/api/{resource}/[id]/route.ts`
- Export GET/POST/PATCH/DELETE functions
- Add `export const dynamic = "force-dynamic"` for non-cacheable endpoints
- Use Zod for request validation
- Use `getServerSession(authOptions)` for authentication
- Check user role for authorization

**New Service:**
- Create file: `lib/services/{name}.service.ts`
- Follow class pattern with singleton export:
  ```typescript
  export class MyService {
    async myMethod(): Promise<Result> { ... }
  }
  export const myService = new MyService();
  ```
- Import Prisma via `import { prisma } from "@/lib/db"`
- Log all external operations to IntegrationLog

**New Dashboard Page:**
- Create directory: `app/dashboard/{section}/page.tsx`
- For detail pages: `app/dashboard/{section}/[id]/page.tsx`
- Page layout inherited from `app/dashboard/layout.tsx` (sidebar included)
- Role restrictions defined in `middleware.ts` `routeRoleMap`

**New UI Component:**
- Primitive/reusable: `components/ui/{name}.tsx`
- Domain-specific: `components/{domain}/{name}.tsx`
- Use Tailwind classes for styling
- Reference `lib/design-tokens.ts` for programmatic color values

**New Cron Job:**
- Create endpoint: `app/api/cron/{job-name}/route.ts`
- Add schedule to `vercel.json` crons array
- Verify CRON_SECRET header for production security

**New Queue:**
- Add queue definition in `lib/utils/queue.ts` (in `initQueues()` function)
- Add corresponding QueueEvents in `initQueueEvents()`
- Add helper function (e.g., `addMyJob()`)
- Add worker in `initializeWorkers()` (for local dev)
- Add processing logic in `lib/utils/queue-processor.ts`

**New Webhook Receiver:**
- Create endpoint: `app/api/webhooks/{service}/route.ts`
- Validate signature in route handler
- Use `acceptWebhook()` + `webhookResponse()` from `lib/utils/webhook-handler.ts`
- Add enqueue function in `lib/utils/webhook-queue.ts`
- Always return 200 OK

**New External Integration:**
- Service: `lib/services/{integration}.service.ts`
- Add external ID field to Customer model in `prisma/schema.prisma`
- Update `IdentityMapperService.reconcileCustomer()` in `lib/services/identity-mapper.ts`
- Create webhook endpoint: `app/api/webhooks/{integration}/route.ts`
- Add queue if async processing needed: `lib/utils/queue.ts`
- Log all operations to IntegrationLog

## Special Directories

**`.planning/`:**
- Purpose: GSD project planning, phase plans, debug logs, and codebase analysis
- Generated: By Claude Code GSD workflow
- Committed: Yes

**`.next/`:**
- Purpose: Next.js build output and cache
- Generated: Yes (by `npm run build` or `npm run dev`)
- Committed: No (in `.gitignore`)

**`prisma/generated/`:**
- Purpose: Generated Prisma Client
- Generated: Yes (by `npm run db:generate`)
- Committed: No

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes (by `npm install`)
- Committed: No

**`scripts/`:**
- Purpose: Operational CLI scripts - NOT application code
- Generated: No (manually written)
- Committed: Yes
- Note: Excluded from TypeScript compilation via `tsconfig.json` excludes. Run via `npx tsx scripts/{name}.ts`

**`docs/`:**
- Purpose: Integration setup documentation
- Contains: `INVOICE_WORKFLOW_SETUP.md`, `QUICKBOOKS_CUSTOMER_SYNC.md`
- Committed: Yes

---

*Structure analysis: 2026-02-17*
