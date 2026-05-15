# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Carreira AI Hub is a proprietary middleware system that replaces expensive No-Code/SaaS tools for Carreira U.S.A. The system centralizes lead management, sales, and operations into a single source of truth (SSOT), eliminating "data blindness" and reducing OPEX by 66% (~$17.6k/month savings).

**Core Philosophy**: Replace fragile N8N automations with robust API routes in pure code. Eliminate duplicate customer data across CRM and financial systems through the Identity Mapper pattern.

## Two Portals — CRITICAL SEPARATION

This codebase serves **two completely independent portals**. They share the same database and services but have separate auth, routes, and users. **Never mix them.**

### Portal 1: Admin Dashboard (internal team)
- **Domain**: `carreirausa.sigmaintel.io`
- **Routes**: `/dashboard/*`, `/api/dashboard/*`
- **Auth**: NextAuth (JWT) with role-based access (ADMIN, SALES, SDR, FINANCE, etc.)
- **Users**: `User` model (internal operators)
- **Cookie**: `next-auth.session-token`
- **Purpose**: Lead management, invoicing, CRM, integrations, analytics

### Portal 2: Client Hub (external customers)
- **Domain**: `clientscarreira.sigmaintel.io`
- **Routes**: `/hub/*`, `/api/hub/*`
- **Auth**: Custom JWT (jose) with httpOnly cookie
- **Users**: `ClientUser` model (customers)
- **Cookie**: `hub-token`
- **Purpose**: View invoices, pay (Card/ACH via QB Payments), settings, i18n (EN/PT-BR)

### Rules
1. **Never import hub-auth in dashboard code or vice versa**
2. **Never query ClientUser in dashboard routes or User in hub routes**
3. **Middleware separates them**: `/dashboard/*` → NextAuth, `/hub/*` → custom JWT
4. **Shared services are OK**: QB Payments, Prisma, Resend — both portals can use them
5. **Customer model is shared**: both portals read from `Customer`, but only hub has `ClientUser`
6. **When creating new routes**: check if it belongs to `/dashboard/` or `/hub/` — never put portal-specific logic at the root level

### File Structure
```
app/
  dashboard/          ← Admin portal (internal team)
  hub/                ← Client portal (customers)
    login/            ← Public
    reset-password/   ← Public
    set-password/     ← Public
    page.tsx          ← Dashboard (authenticated)
    pay/[invoiceId]/  ← Payment (authenticated)
    settings/         ← Settings (authenticated)
  api/
    dashboard/        ← Admin APIs
    hub/              ← Client APIs
      auth/           ← login, logout, reset-password, set-password
      invoices/       ← Customer's invoices
      pay/[id]/charge ← Authenticated payment
      profile/        ← Customer profile + language
  payment/            ← Legacy public payment pages (Stripe — being phased out)
  payment-v2/         ← Draft public payment pages (QB Payments — testing)
```

## Technology Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL (Neon) with Prisma ORM
- **Queue System**: BullMQ with Redis (for async processing and retries)
- **Deployment**: Vercel Serverless Functions
- **Integrations**: Pipedrive (CRM), QuickBooks (Finance), Stripe (Payments), DocuSign (Contracts), Twilio (WhatsApp), OpenAI (AI)

## Essential Commands

```bash
# Development
npm run dev                    # Start Next.js dev server on :3000

# Database
npm run db:generate            # Generate Prisma Client after schema changes
npm run db:push                # Push schema changes to database (no migrations)
npm run db:migrate             # Create and run migrations (production)
npm run db:studio              # Open Prisma Studio GUI
npm run db:views               # Create SQL views for analytics/BI

# Testing & Data
npm run user:create            # Create test user for development
npm run db:seed                # Seed database with test data
npm run db:clear               # Clear all database data (destructive)
npm run test:quickbooks        # Test QuickBooks integration

# Production
npm run build                  # Build for production (runs db:generate first)
npm start                      # Start production server
npm run lint                   # Run ESLint
```

## Architecture Patterns

### 1. Identity Mapper (Customer Deduplication)

**Critical Rule**: Email is the unique key across all systems. Never create duplicate customers.

The `IdentityMapperService` (lib/services/identity-mapper.ts) reconciles customer data from multiple external systems:
- QuickBooks (Finance)
- Clint (CRM)
- DocuSign, CloudTalk, Google Contacts

**Usage Pattern**:
```typescript
import { identityMapper } from "@/lib/services/identity-mapper";

// Always use this when customer data comes from external systems
const customer = await identityMapper.reconcileCustomer({
  email: "user@example.com",
  name: "John Doe",
  externalIds: {
    pipedrive_id: 123,
    quickbooks_id: "QB456"
  }
});
```

### 2. Service Layer Pattern

All business logic lives in `lib/services/`:
- **ai.service.ts**: OpenAI integration for chatbot and lead qualification
- **sdr.service.ts**: Automated lead qualification orchestration
- **lead.service.ts**: Lead CRUD and state management
- **pipedrive.service.ts**: Pipedrive API wrapper
- **quickbooks.service.ts**: QuickBooks OAuth and API operations
- **quickbooks-sync.service.ts**: Bidirectional sync with QuickBooks
- **invoice-workflow.service.ts**: Financial workflow automation
- **stripe.service.ts**: Stripe payment processing
- **docusign.service.ts**: Contract generation and signing
- **whatsapp.service.ts**: Twilio WhatsApp messaging
- **identity-mapper.ts**: Customer deduplication engine

Services are stateless and should be imported as singletons (e.g., `import { aiService } from "@/lib/services/ai.service"`).

### 3. Queue-Based Processing

Use BullMQ queues (lib/utils/queue.ts) for:
- Async operations that can fail (external API calls)
- Retry logic with exponential backoff
- Background processing that shouldn't block HTTP responses

Available queues:
- `leadQualification`: Auto-qualify leads via AI
- `whatsappMessages`: Send WhatsApp messages
- `pipedriveSync`: Sync with Pipedrive
- `invoiceGeneration`: Generate invoices
- `contractGeneration`: Generate contracts
- `quickbooksSync`: Sync with QuickBooks

**Important**: In Vercel, workers don't run. Use Vercel Cron Jobs (vercel.json) or trigger queue processing via API routes.

### 4. Webhook Workflow Pattern

Webhooks drive the system's automation:

**Pipedrive Lead Created** (`/api/webhooks/pipedrive/lead`):
1. Webhook receives person data
2. Reconcile customer via Identity Mapper
3. Create Lead in database
4. Enqueue lead qualification job
5. SDR Service qualifies lead via AI
6. If qualified (score ≥70): send WhatsApp message

**Pipedrive Deal Won** (`/api/webhooks/pipedrive/deal`):
1. Webhook receives deal data
2. Reconcile customer
3. Create Deal in database
4. Enqueue invoice generation
5. Enqueue contract generation (DocuSign)
6. Create QuickBooks customer + invoice (if configured)
7. Create Stripe customer (if configured)

**QuickBooks Webhooks** (`/api/webhooks/quickbooks`):
- Handle entity change notifications
- Sync customers, invoices, payments bidirectionally

### 5. Authentication & RBAC

NextAuth.js with JWT strategy (lib/auth.ts):
- **Roles**: ADMIN, SALES, SDR, FINANCE, SUPPORT, OPERATIONAL
- Middleware (middleware.ts) protects dashboard routes by role
- Session max age: 30 days

**Development Note**: Password validation is NOT implemented yet. In development, login bypasses password check. Add password hashing (bcrypt) before production.

### 6. Database Views for BI

Run `npm run db:views` to create materialized views for analytics:
- `lead_conversion_funnel`: Lead status distribution
- `sdr_performance`: SDR metrics (qualified leads, avg score, time to qualify)
- `ai_chat_metrics`: Chatbot performance
- `lead_source_performance`: Conversion by lead source
- `customer_lifetime_value`: Customer LTV and payment status
- `cac_by_channel`: Cost per acquisition by channel
- `overdue_invoices`: Overdue invoice tracking
- `tech_cost_per_student`: OPEX per student

Views are defined in `prisma/migrations/create_views.sql`.

## Integration Secrets Management

QuickBooks OAuth tokens are stored in the database (SystemConfig table) because they need to be refreshed periodically via API routes. This is different from other secrets which live in environment variables.

**SystemConfig Pattern**:
```typescript
const config = await prisma.systemConfig.findUnique({ where: { id: "system" } });
const accessToken = config?.quickbooks_access_token;
```

Tokens are refreshed automatically by `quickbooks.service.ts` when expired.

## API Route Structure

```
app/api/
├── auth/                  # NextAuth endpoints
├── chat/                  # Chatbot API
├── conversations/         # Conversation CRUD
├── customers/             # Customer CRUD
├── deals/                 # Deal CRUD
├── leads/                 # Lead CRUD + qualification
├── invoices/              # Invoice CRUD
├── integration-logs/      # Integration log viewer
├── webhooks/
│   ├── pipedrive/
│   │   ├── lead/         # New person webhook
│   │   └── deal/         # Deal won webhook
│   ├── quickbooks/        # QuickBooks webhooks
│   └── whatsapp/          # Twilio WhatsApp webhook
├── quickbooks/
│   ├── auth/             # OAuth flow (callback, connect, disconnect)
│   ├── customers/        # Fetch QuickBooks customers
│   ├── invoices/         # Fetch QuickBooks invoices
│   └── sync/             # Manual sync endpoint
└── cron/
    └── quickbooks-sync/   # Scheduled sync (every 6 hours)
```

## Lead Qualification Flow

The system auto-qualifies leads using AI:

1. **Lead Creation**: Lead enters system (webhook or manual)
2. **Conversation History**: System gathers chat messages if available
3. **AI Qualification**: `aiService.qualifyLead()` scores lead (0-100) based on:
   - Interest level
   - Budget
   - Timeline
   - Motivation
   - Profile fit
4. **Threshold Check**: If score ≥ 70 (configurable via `SDR_QUALIFICATION_THRESHOLD`), lead is QUALIFIED
5. **Automation**: Qualified leads trigger WhatsApp message
6. **Human Handoff**: Unqualified leads can be assigned to human SDR

Qualification logic is in `lib/services/sdr.service.ts` and `lib/services/ai.service.ts`.

## AI Chatbot Architecture

Customer Service AI chatbot (app/api/chat):
- System prompts in `lib/prompts/customer-service.ts`
- Qualification prompts in `lib/prompts/lead-qualification.ts`
- Conversation history stored in Conversations + Messages tables
- Automatic escalation detection (keywords: "falar com", "comprar", "preço", etc.)
- Long conversations (>10 messages) auto-escalate to human

**Graceful Degradation**: If `OPENAI_API_KEY` is missing/invalid, chatbot returns fallback message and escalates to human.

## Environment Variables

Required for development:
```bash
# Database
POSTGRES_PRISMA_URL=           # Neon pooled connection
POSTGRES_URL_NON_POOLING=      # Neon direct connection (migrations)

# Redis (for BullMQ)
REDIS_URL=                     # Redis connection string

# NextAuth
NEXTAUTH_SECRET=               # JWT signing secret
NEXTAUTH_URL=                  # App URL (http://localhost:3000 in dev)

# OpenAI
OPENAI_API_KEY=                # GPT-4 for chatbot + qualification
AI_MODEL=                      # Model (default: gpt-4-turbo-preview)
AI_TEMPERATURE=                # Temperature (default: 0.7)

# Pipedrive
PIPEDRIVE_API_TOKEN=           # Pipedrive API key
PIPEDRIVE_WEBHOOK_SECRET=      # Webhook signature verification

# QuickBooks
QUICKBOOKS_CLIENT_ID=          # OAuth app client ID
QUICKBOOKS_CLIENT_SECRET=      # OAuth app client secret
QUICKBOOKS_REDIRECT_URI=       # OAuth callback URL
QUICKBOOKS_ENVIRONMENT=        # "sandbox" or "production"

# Stripe
STRIPE_SECRET_KEY=             # Stripe API key

# Twilio (WhatsApp)
TWILIO_ACCOUNT_SID=            # Twilio account SID
TWILIO_AUTH_TOKEN=             # Twilio auth token
TWILIO_WHATSAPP_FROM=          # Twilio WhatsApp number

# DocuSign
DOCUSIGN_INTEGRATION_KEY=      # DocuSign app integration key
DOCUSIGN_USER_ID=              # DocuSign user GUID
DOCUSIGN_ACCOUNT_ID=           # DocuSign account ID
DOCUSIGN_RSA_PRIVATE_KEY=      # RSA private key for JWT

# SDR Config
SDR_QUALIFICATION_THRESHOLD=   # Min score for qualified (default: 70)
```

## Database Schema Principles

- **Lead vs Customer**: Leads are prospects. Customers are paying/signed clients. Leads can convert to Deals, which link to Customers.
- **Deal.convertedFromLead**: One-to-one relationship tracks lead → deal conversion
- **IntegrationLog**: Log ALL external API calls (service, action, status, payload, error). Essential for debugging webhook failures.
- **SystemConfig**: Singleton table (id="system") stores OAuth tokens and webhook secrets that need database persistence.

## Common Development Tasks

### Add New External Integration
1. Create service in `lib/services/[integration].service.ts`
2. Add external ID field to Customer model in `prisma/schema.prisma`
3. Update `IdentityMapperService.reconcileCustomer()` to handle new ID
4. Create webhook endpoint in `app/api/webhooks/[integration]/`
5. Add queue in `lib/utils/queue.ts` if async processing needed
6. Log all operations in IntegrationLog table

### Run Database Migration
```bash
npm run db:migrate             # Creates migration file + applies
# Edit migration in prisma/migrations/[timestamp]_[name]/migration.sql if needed
npm run db:views               # Recreate views after schema changes
```

### Debug Webhook
1. Check IntegrationLog table: `npx prisma studio`
2. Look for status="ERROR" entries
3. Check payload and error fields
4. Verify webhook secret in SystemConfig or env vars

### Test QuickBooks Integration
```bash
npm run test:quickbooks        # Runs scripts/test-quickbooks.ts
```
This script tests OAuth, customer sync, and invoice creation.

## Important Notes

- **Path Alias**: Use `@/` for imports (maps to project root in tsconfig.json)
- **Prisma Client**: Always generate after schema changes: `npm run db:generate`
- **Vercel Deployment**: `npm run build` generates Prisma Client automatically via build script
- **Database Push vs Migrate**: Use `db:push` in development for quick schema iteration. Use `db:migrate` in production for version-controlled migrations.
- **Queue Workers**: Don't run in Vercel. Use cron jobs or trigger processing via API routes.
- **Error Handling**: Catch all errors and log to IntegrationLog for external API calls. Return graceful error responses to users.

## File Naming Conventions

- Services: `*.service.ts` (lowercase with dashes)
- API Routes: `route.ts` (Next.js App Router convention)
- Scripts: Located in `scripts/` directory
- Components: Located in `components/` (currently minimal, mostly API-driven)

## Development Workflow

1. **Schema Changes**: Edit `prisma/schema.prisma` → `npm run db:generate` → `npm run db:push` (dev) or `npm run db:migrate` (prod)
2. **New API Route**: Create `app/api/[route]/route.ts` with exported GET/POST/PATCH/DELETE functions
3. **New Service**: Create `lib/services/[name].service.ts` as a class with singleton export
4. **Testing Webhooks Locally**: Use ngrok or similar to expose localhost, configure webhook URLs in external services
5. **Integration Logs**: Always create IntegrationLog entries for external API calls (success or failure)

## Known Limitations / TODOs

- Password authentication not fully implemented (auth bypasses password check in dev)
- Some queue workers have placeholder implementations (search for "TODO" in queue.ts)
- BullMQ workers don't run on Vercel (use cron jobs instead)
- QuickBooks OAuth tokens stored in DB need manual refresh UI for users
- Dashboard UI is minimal (primarily API-focused system)
