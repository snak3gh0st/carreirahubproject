# Codebase Structure

**Analysis Date:** 2026-01-09

## Directory Layout

```
CarreiraUSAHUB/
├── app/                           # Next.js App Router pages and API routes
│   ├── api/                       # REST API endpoints
│   │   ├── auth/                  # NextAuth.js endpoints
│   │   ├── customers/             # Customer CRUD
│   │   ├── leads/                 # Lead CRUD + qualification
│   │   ├── invoices/              # Invoice CRUD + workflows
│   │   ├── chat/                  # AI chatbot endpoint
│   │   ├── webhooks/              # External webhook handlers
│   │   │   ├── pipedrive/         # Pipedrive webhooks (lead, deal, person)
│   │   │   ├── quickbooks/        # QuickBooks webhooks
│   │   │   ├── stripe/            # Stripe webhooks
│   │   │   ├── docusign/          # DocuSign webhooks
│   │   │   ├── retell/            # Retell AI webhooks
│   │   │   └── whatsapp/          # Twilio WhatsApp webhooks
│   │   └── cron/                  # Vercel cron job handlers
│   │       ├── quickbooks-sync/   # QuickBooks bidirectional sync (every 6h)
│   │       ├── process-queue/     # BullMQ queue processor (every 5m)
│   │       ├── collection-calls/  # Automated collection calls (daily)
│   │       ├── payment-reminders/ # Payment reminder emails (daily)
│   │       └── overdue-invoices/  # Overdue invoice detection (daily)
│   ├── dashboard/                 # Dashboard UI (minimal)
│   ├── layout.tsx                 # Root layout with theme provider
│   └── globals.css                # Global Tailwind styles
│
├── lib/                           # Shared utilities and services
│   ├── services/                  # Business logic services
│   │   ├── ai.service.ts          # OpenAI integration for chatbot & qualification
│   │   ├── lead.service.ts        # Lead CRUD and state management
│   │   ├── sdr.service.ts         # SDR qualification orchestration
│   │   ├── customer.service.ts    # Customer CRUD
│   │   ├── invoice-workflow.service.ts # Invoice generation workflow
│   │   ├── invoice-approval.service.ts # Invoice approval logic
│   │   ├── pipedrive.service.ts   # Pipedrive API wrapper
│   │   ├── quickbooks.service.ts  # QuickBooks OAuth & API
│   │   ├── quickbooks-sync.service.ts # Bidirectional sync with QB
│   │   ├── stripe.service.ts      # Stripe payment processing
│   │   ├── docusign.service.ts    # DocuSign contract handling
│   │   ├── identity-mapper.ts     # Customer deduplication engine (CRITICAL)
│   │   ├── email.service.ts       # Resend email service
│   │   ├── whatsapp.service.ts    # Twilio WhatsApp messaging
│   │   ├── retell.service.ts      # RetellAI voice bot integration
│   │   ├── collection.service.ts  # Collection call orchestration
│   │   └── payment-workflow.service.ts # Payment processing workflow
│   │
│   ├── utils/                     # Utility functions
│   │   ├── queue.ts               # BullMQ queue definitions and processor
│   │   ├── logger.ts              # IntegrationLog wrapper
│   │   ├── webhook-validation.ts  # Webhook signature verification
│   │   ├── error-handler.ts       # Centralized error handling
│   │   └── helpers.ts             # Other utility functions
│   │
│   ├── auth.ts                    # NextAuth.js configuration
│   ├── db.ts                      # Prisma Client initialization
│   └── prompts/                   # System prompts for AI
│       ├── customer-service.ts    # Chatbot prompt
│       └── lead-qualification.ts  # Lead qualification prompt
│
├── components/                    # React components
│   ├── dashboard/                 # Dashboard-specific components
│   ├── ui/                        # Shadcn UI components
│   ├── theme-provider.tsx         # Theme context provider
│   └── theme-toggle.tsx           # Dark mode toggle
│
├── prisma/                        # Database schema and migrations
│   ├── schema.prisma              # Database model definitions (605 lines)
│   ├── migrations/                # Version-controlled migrations
│   └── seed/                      # Database seed scripts
│
├── scripts/                       # Utility scripts
│   ├── create-test-user.ts        # Create test user for development
│   ├── seed-test-data.ts          # Seed database with test data
│   ├── test-quickbooks.ts         # Test QuickBooks integration
│   ├── test-invoice-workflow.ts   # Test invoice generation
│   ├── clear-database.js          # Clear all data (destructive)
│   └── create-views.ts            # Create SQL materialized views for BI
│
├── public/                        # Static assets
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
├── tailwind.config.ts             # Tailwind CSS configuration
├── .env                           # Environment variables (CONTAINS SECRETS!)
├── .env.local                     # Local overrides (gitignored)
├── CLAUDE.md                      # Claude Code instructions
├── middleware.ts                  # NextAuth middleware (route protection)
├── vercel.json                    # Vercel cron job configuration
└── README.md                      # Project documentation
```

## Directory Purposes

**app/api/**
- Purpose: REST API endpoints
- Contains: Route handlers (GET/POST/PATCH/DELETE functions)
- Key files: `webhooks/*/route.ts`, `cron/*/route.ts`, customer/lead/invoice CRUD
- Subdirectories: Organized by resource (customers, leads, invoices, etc.)

**lib/services/**
- Purpose: Business logic encapsulation
- Contains: Service classes with static singleton exports
- Key files: `identity-mapper.ts` (CRITICAL - customer deduplication), `ai.service.ts`, `lead.service.ts`
- Pattern: Each service handles one domain (leads, customers, integrations)

**lib/utils/**
- Purpose: Shared utilities and infrastructure
- Contains: Queue management, logging, webhook validation, error handling
- Key files: `queue.ts` (BullMQ setup), `logger.ts` (IntegrationLog), `webhook-validation.ts`

**prisma/**
- Purpose: Database schema and migrations
- Contains: Prisma schema with 20+ models, migrations, type definitions
- Key files: `schema.prisma` (605 lines) - defines all database tables
- Pattern: Push-based in dev, migration-based in production

**scripts/**
- Purpose: Development and testing utilities
- Contains: Database seeding, testing scripts, view creation
- Usage: Run via npm scripts (`npm run create-test-user`, `npm run seed`, etc.)

**components/**
- Purpose: React UI components
- Contains: Dashboard components, Shadcn UI library, theme provider
- Note: Minimal - system is API-first, mostly server-side rendering

## Key File Locations

**Entry Points:**
- `app/layout.tsx` - Root layout with theme provider, Toaster (Sonner)
- `middleware.ts` - NextAuth middleware protecting dashboard routes
- `vercel.json` - Cron job scheduling configuration

**Configuration:**
- `tsconfig.json` - TypeScript strict mode enabled
- `tailwind.config.ts` - Tailwind CSS with dark mode support
- `prisma/schema.prisma` - Complete database schema
- `.env` - All environment variables (87+ required)

**Core Logic:**
- `lib/services/identity-mapper.ts` - Customer deduplication (CRITICAL)
- `lib/services/invoice-workflow.service.ts` - Invoice generation flow
- `lib/utils/queue.ts` - BullMQ queue definitions and processor
- `app/api/webhooks/pipedrive/deal/route.ts` - Deal won workflow trigger

**Integration:**
- `app/api/webhooks/*/route.ts` - 8 webhook endpoints (Pipedrive, QB, Stripe, etc.)
- `app/api/cron/*/route.ts` - 7 cron jobs for background processing
- `lib/services/*.service.ts` - 17 service files for external APIs

**Database:**
- `lib/db.ts` - Prisma Client initialization
- `prisma/schema.prisma` - Schema with enums, models, relations

## Naming Conventions

**Files:**
- kebab-case for all files: `lead.service.ts`, `identity-mapper.ts`, `webhook-validation.ts`
- `route.ts` for API endpoints (Next.js convention)
- Component files: PascalCase when exporting default (`ThemeToggle.tsx`)
- `.test.ts` or `.spec.ts` for tests (not detected - no tests found yet)

**Directories:**
- kebab-case for all directories: `lib/utils/`, `app/api/`, `lib/services/`
- Plural for collections: `services/`, `webhooks/`, `cron/`, `migrations/`
- Singular for feature: `app/dashboard/`, `app/chat/`

**TypeScript:**
- PascalCase for classes and types: `LeadService`, `IdentityMapper`, `CreateLeadData`
- camelCase for variables and functions: `leadService`, `createLead()`, `reconcileCustomer()`
- UPPER_SNAKE_CASE for constants

**Database:**
- snake_case for field names: `created_at`, `updated_at`, `pipedrive_id`, `quickbooks_id`
- PascalCase for enum values: `DRAFT`, `SENT`, `QUALIFIED`, `WON`

## Where to Add New Code

**New API Endpoint:**
- Implementation: `app/api/[resource]/route.ts`
- Pattern: Validate input (Zod), call service, return JSON
- Protection: Check auth via `getServerSession()` in middleware or route

**New Service:**
- Implementation: `lib/services/[domain].service.ts`
- Pattern: Class with methods, static singleton export (`export const myService = new MyService()`)
- Database: Import `prisma` from `@/lib/db`
- Logging: Use `integrationLogger` from `@/lib/utils/logger`

**New Webhook:**
- Implementation: `app/api/webhooks/[service]/route.ts`
- Pattern: Validate signature, process payload, enqueue jobs, log
- Security: MUST validate webhook signature from external service

**New Cron Job:**
- Implementation: `app/api/cron/[job-name]/route.ts`
- Configuration: Add to `vercel.json` under `crons` array
- Schedule: Use cron expression (e.g., `0 9 * * *` = 9 AM daily)

**New Queue Job:**
- Definition: Add queue name to `lib/utils/queue.ts`
- Processor: Add handler in `lib/utils/queue.ts` switch statement
- Usage: Call `queue.add()` from services/routes

**New Database Model:**
- Schema: Edit `prisma/schema.prisma`
- Generation: Run `npm run db:generate`
- Migration: Run `npm run db:migrate` (production) or `npm run db:push` (development)

## Special Directories

**prisma/migrations/**
- Purpose: Version-controlled database changes
- Source: Auto-generated by Prisma when running `prisma migrate dev`
- Committed: Yes (source of truth for production)

**.planning/**
- Purpose: This directory - project planning and architecture docs
- Created: By `/gsd:map-codebase` command
- Committed: Yes (helps with onboarding and planning)

**.env and .env.local**
- Purpose: Environment variables (secrets, API keys, URLs)
- Committed: No - .gitignore blocks them
- Structure: `.env` for base config, `.env.local` for local overrides

---

*Structure analysis: 2026-01-09*
*Update when directory structure changes*
