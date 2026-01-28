# Codebase Structure

**Analysis Date:** 2026-01-27

## Directory Layout

```
CarreiraUSAHUB/
├── app/                          # Next.js 14 App Router (UI + API routes)
│   ├── api/                      # API endpoints (webhooks, CRUD, cron)
│   ├── auth/                     # Authentication pages
│   ├── dashboard/                # Protected dashboard pages
│   ├── payment/                  # Public payment pages
│   └── page.tsx                  # Root entry point (redirect logic)
├── components/                   # React components (reusable UI)
├── lib/                          # Core application logic
│   ├── services/                 # Business logic services
│   ├── utils/                    # Utility functions
│   ├── middleware/               # Custom middleware
│   ├── prompts/                  # AI prompt templates
│   ├── auth.ts                   # NextAuth configuration
│   └── db.ts                     # Prisma singleton client
├── prisma/                       # Database schema and migrations
│   ├── schema.prisma             # Database models and enums
│   └── migrations/               # SQL migration history
├── scripts/                      # CLI scripts (user creation, testing)
├── .planning/                    # GSD planning documents
│   └── codebase/                 # Architecture, conventions, testing docs
├── middleware.ts                 # Next.js middleware (auth + RBAC)
├── package.json                  # Dependencies and npm scripts
├── vercel.json                   # Vercel deployment config (cron jobs)
└── CLAUDE.md                     # Project context for Claude Code
```

## Directory Purposes

**app/**
- Purpose: Next.js App Router root - UI pages and API routes
- Contains: Route handlers, React Server Components, Client Components
- Key files: `page.tsx` (pages), `route.ts` (API endpoints), `layout.tsx` (page layouts)

**app/api/**
- Purpose: Backend API endpoints for UI and external webhooks
- Contains: Next.js route handlers organized by resource or integration
- Key files: `app/api/webhooks/pipedrive/lead/route.ts`, `app/api/quickbooks/sync/route.ts`

**app/api/webhooks/**
- Purpose: Webhook receivers for external services
- Contains: Pipedrive, QuickBooks, Stripe, DocuSign, Twilio webhook handlers
- Key files: `pipedrive/lead/route.ts`, `pipedrive/deal/route.ts`, `quickbooks/route.ts`

**app/api/cron/**
- Purpose: Scheduled jobs triggered by Vercel Cron
- Contains: QuickBooks token refresh, invoice reminders, collection calls
- Key files: `quickbooks-sync/route.ts`, `payment-reminders/route.ts`, `overdue-invoices/route.ts`

**app/dashboard/**
- Purpose: Protected admin/staff dashboard pages
- Contains: CRUD interfaces for customers, leads, deals, invoices, contracts
- Key files: `page.tsx` (main dashboard), `customers/page.tsx`, `invoices/page.tsx`

**lib/services/**
- Purpose: Business logic and external API integrations
- Contains: Singleton service classes with typed methods
- Key files: `identity-mapper.ts`, `quickbooks.service.ts`, `sdr.service.ts`, `invoice-workflow.service.ts`

**lib/utils/**
- Purpose: Reusable utility functions and cross-cutting concerns
- Contains: Queue management, webhook handling, logging, retry logic, circuit breakers
- Key files: `queue.ts`, `webhook-handler.ts`, `logger.ts`, `circuit-breaker.ts`

**lib/middleware/**
- Purpose: Custom middleware for webhooks
- Contains: Webhook retry logic
- Key files: `webhook-retry.ts`

**lib/prompts/**
- Purpose: AI prompt templates for chatbot and lead qualification
- Contains: OpenAI system prompts
- Key files: `customer-service.ts`, `lead-qualification.ts`

**components/**
- Purpose: Reusable React components
- Contains: UI components (dashboard KPI cards, tables, forms, theme toggles)
- Key files: `dashboard/dashboard-kpi-card.tsx`, `ui/*`, `invoices/*`

**prisma/**
- Purpose: Database schema and migration management
- Contains: Prisma schema definition, SQL migrations
- Key files: `schema.prisma`, `migrations/`

**scripts/**
- Purpose: CLI scripts for database seeding, testing, user management
- Contains: TypeScript scripts run via `tsx`
- Key files: `create-test-user.ts`, `test-quickbooks.ts`, `docusign-debug.ts`

**.planning/codebase/**
- Purpose: GSD documentation for codebase understanding
- Contains: Architecture, conventions, testing, stack, integrations
- Key files: `ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `TESTING.md`

## Key File Locations

**Entry Points:**
- `app/page.tsx`: Root entry - redirects based on auth status
- `app/dashboard/page.tsx`: Main dashboard with KPIs
- `app/api/auth/[...nextauth]/route.ts`: NextAuth handler
- `middleware.ts`: Route protection middleware (RBAC)

**Configuration:**
- `lib/auth.ts`: NextAuth configuration (JWT, roles, callbacks)
- `lib/db.ts`: Prisma Client singleton
- `prisma/schema.prisma`: Database schema (24 models, 10 enums)
- `package.json`: Dependencies, npm scripts
- `vercel.json`: Vercel cron jobs, deployment settings
- `.env`: Environment variables (secrets, API keys, database URLs)

**Core Logic:**
- `lib/services/identity-mapper.ts`: Customer deduplication engine
- `lib/services/sdr.service.ts`: Lead qualification orchestrator
- `lib/services/invoice-workflow.service.ts`: Deal Won → Invoice + Contract workflow
- `lib/services/quickbooks.service.ts`: QuickBooks API client
- `lib/utils/queue.ts`: BullMQ queue definitions

**Testing:**
- `scripts/test-quickbooks.ts`: QuickBooks integration test
- `scripts/test-admin-login.ts`: Auth flow test
- Not yet present: Unit test files (no `*.test.ts` or `*.spec.ts` found)

## Naming Conventions

**Files:**
- API routes: `route.ts` (Next.js 14 App Router convention)
- Pages: `page.tsx` (Next.js 14 App Router convention)
- Services: `*.service.ts` (lowercase with dashes, e.g., `sdr.service.ts`)
- Components: `PascalCase.tsx` (e.g., `DashboardKPICard.tsx`) or `kebab-case.tsx` (e.g., `dashboard-kpi-card.tsx`)
- Utilities: `kebab-case.ts` (e.g., `webhook-handler.ts`)
- Scripts: `kebab-case.ts` (e.g., `create-test-user.ts`)

**Directories:**
- API routes: `kebab-case` (e.g., `api/quickbooks/sync/`)
- Dashboard pages: `kebab-case` (e.g., `dashboard/invoices/`)
- Dynamic routes: `[param]` (e.g., `customers/[id]/page.tsx`)
- Services: Single directory `services/`
- Components: Grouped by feature (e.g., `components/dashboard/`, `components/invoices/`)

**Code:**
- Variables: `camelCase` (e.g., `leadId`, `customerData`)
- Functions: `camelCase` (e.g., `reconcileCustomer`, `qualifyLead`)
- Classes: `PascalCase` (e.g., `SDRService`, `IdentityMapperService`)
- Constants: `SCREAMING_SNAKE_CASE` (e.g., `QUALIFICATION_THRESHOLD`)
- Enums: `PascalCase` (e.g., `LeadStatus`, `InvoiceStatus`)
- Prisma models: `PascalCase` (e.g., `Customer`, `Deal`, `Invoice`)

## Where to Add New Code

**New Feature:**
- Primary code: `lib/services/new-feature.service.ts` (business logic)
- Tests: `lib/services/new-feature.service.test.ts` (not yet established)
- API route: `app/api/new-feature/route.ts` (HTTP endpoint)
- Dashboard page: `app/dashboard/new-feature/page.tsx` (UI)

**New Component/Module:**
- Implementation: `components/{feature}/{ComponentName}.tsx`
- Reusable UI: `components/ui/{component}.tsx`
- Dashboard-specific: `components/dashboard/{component}.tsx`

**Utilities:**
- Shared helpers: `lib/utils/{utility-name}.ts`
- Middleware: `lib/middleware/{middleware-name}.ts`

**New External Integration:**
1. Create service: `lib/services/{integration}.service.ts`
2. Add external ID field to `Customer` model in `prisma/schema.prisma`
3. Update `IdentityMapperService.reconcileCustomer()` in `lib/services/identity-mapper.ts`
4. Create webhook endpoint: `app/api/webhooks/{integration}/route.ts`
5. Add queue: `lib/utils/queue.ts` (new queue definition)
6. Log operations: Use `integrationLogger` from `lib/utils/logger.ts`

**New Database Model:**
1. Add model to `prisma/schema.prisma`
2. Run `npm run db:generate` (generate Prisma Client)
3. Run `npm run db:push` (dev) or `npm run db:migrate` (production)
4. Create service if complex logic: `lib/services/{model}.service.ts`
5. Create API routes: `app/api/{model}/route.ts`

**New Webhook Handler:**
1. Create route: `app/api/webhooks/{service}/{event}/route.ts`
2. Use pattern:
   - Validate signature (`lib/utils/webhook-validation.ts`)
   - Call `acceptWebhook()` from `lib/utils/webhook-handler.ts`
   - Return `200 OK` immediately
   - Process asynchronously in queue worker
3. Add processing logic to `lib/utils/queue-processor.ts`

**New Cron Job:**
1. Create route: `app/api/cron/{job-name}/route.ts`
2. Add to `vercel.json` cron schedule
3. Protect with `CRON_SECRET` check (Vercel header)
4. Use services from `lib/services/` for business logic

## Special Directories

**node_modules/**
- Purpose: NPM dependencies
- Generated: Yes (via `npm install`)
- Committed: No (in `.gitignore`)

**.next/**
- Purpose: Next.js build output
- Generated: Yes (via `npm run build` or `npm run dev`)
- Committed: No (in `.gitignore`)

**prisma/migrations/**
- Purpose: SQL migration history
- Generated: Yes (via `npm run db:migrate`)
- Committed: Yes (version-controlled migrations)

**.planning/**
- Purpose: GSD planning and documentation
- Generated: No (manually created by GSD commands)
- Committed: Yes (project documentation)

**.vercel/**
- Purpose: Vercel deployment cache
- Generated: Yes (by Vercel CLI)
- Committed: No (in `.gitignore`)

**scripts/**
- Purpose: Development and maintenance scripts
- Generated: No (manually written)
- Committed: Yes
- Usage: Run via `tsx scripts/{script-name}.ts` or `npm run {script-name}`

## Import Path Aliases

**Path alias configured:**
- `@/` → Project root (`/Users/pauloloureiro/Desktop/Work/Sigma/Projects/CarreiraUSAHUB`)
- Configured in: `tsconfig.json` (`"paths": { "@/*": ["./*"] }`)

**Import patterns:**
- Prisma Client: `import { prisma } from "@/lib/db"`
- Services: `import { sdrService } from "@/lib/services/sdr.service"`
- Utils: `import { acceptWebhook } from "@/lib/utils/webhook-handler"`
- Components: `import { DashboardKPICard } from "@/components/dashboard/dashboard-kpi-card"`
- Auth: `import { authOptions } from "@/lib/auth"`
- Prisma types: `import { UserRole, LeadStatus } from "@prisma/client"`

## API Route Organization

**Pattern:** RESTful resources with nested actions

**Examples:**
- `app/api/customers/route.ts` → GET (list), POST (create)
- `app/api/customers/[id]/route.ts` → GET (read), PATCH (update), DELETE
- `app/api/leads/[id]/qualify/route.ts` → POST (action on resource)
- `app/api/invoices/[id]/approve/route.ts` → POST (action)
- `app/api/webhooks/pipedrive/lead/route.ts` → POST (webhook receiver)
- `app/api/cron/quickbooks-sync/route.ts` → GET (cron job)

**HTTP Methods:**
- GET: Read operations, list resources
- POST: Create resources, trigger actions
- PATCH: Update resources (partial)
- DELETE: Delete resources

## Dashboard Page Organization

**Pattern:** Resource-based with nested CRUD pages

**Examples:**
- `app/dashboard/page.tsx` → Main dashboard (KPIs)
- `app/dashboard/customers/page.tsx` → List customers
- `app/dashboard/customers/[id]/page.tsx` → View customer details
- `app/dashboard/customers/new/page.tsx` → Create customer form
- `app/dashboard/invoices/page.tsx` → List invoices
- `app/dashboard/invoices/[id]/page.tsx` → View invoice
- `app/dashboard/invoices/[id]/edit/page.tsx` → Edit invoice
- `app/dashboard/invoices/new/page.tsx` → Create invoice

**Layout hierarchy:**
- Root layout: `app/layout.tsx` (not found - likely using default)
- Dashboard layout: `app/dashboard/layout.tsx` (if exists, wraps all dashboard pages)
- Nested layouts: `app/dashboard/{resource}/layout.tsx`

---

*Structure analysis: 2026-01-27*
