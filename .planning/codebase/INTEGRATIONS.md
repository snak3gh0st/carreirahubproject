# External Integrations

**Analysis Date:** 2026-01-09

## APIs & External Services

**Customer Relationship Management (CRM):**
- **Pipedrive** - Lead and deal management
  - SDK/Client: Custom wrapper in `lib/services/pipedrive.service.ts`
  - Auth: API token in `PIPEDRIVE_API_TOKEN` env var
  - Webhook: `/api/webhooks/pipedrive/` handles lead, deal, person events
  - Endpoints: Get person, create person, get deal, create deal
  - Webhook validation: HMAC SHA256 signature in `PIPEDRIVE_WEBHOOK_SECRET`

**Payment Processing:**
- **Stripe** - Subscription and payment processing
  - SDK/Client: `stripe` npm package in `lib/services/stripe.service.ts`
  - Auth: Secret key in `STRIPE_SECRET_KEY`, publishable key in `STRIPE_PUBLISHABLE_KEY`
  - Webhook: `/api/webhooks/stripe/` receives payment events
  - Endpoints: Create payment intent, manage subscriptions, process webhooks
  - Webhook validation: HMAC SHA256 signature in `STRIPE_WEBHOOK_SECRET`
  - Test mode: Configuration via environment variables

**Accounting & Finance:**
- **QuickBooks** - Accounting and invoicing
  - SDK/Client: Custom wrapper in `lib/services/quickbooks.service.ts`
  - Auth: OAuth2 with tokens stored in `SystemConfig` table (refreshed periodically)
  - Credentials: `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`
  - OAuth callback: `/api/quickbooks/oauth/callback`
  - Webhook: `/api/webhooks/quickbooks/` receives entity change events
  - Webhook validation: HMAC SHA256 signature
  - Bidirectional sync: Via `lib/services/quickbooks-sync.service.ts` and `/api/cron/quickbooks-sync/`

**Contract Management:**
- **DocuSign** - Digital contract signing
  - SDK/Client: Custom integration in `lib/services/docusign.service.ts`
  - Auth: JWT authentication with RSA private key
  - Credentials: `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_USER_ID`, `DOCUSIGN_ACCOUNT_ID`, `DOCUSIGN_PRIVATE_KEY`
  - Webhook: `/api/webhooks/docusign/` receives signing events
  - Base URL: `DOCUSIGN_BASE_URL` (demo vs production)

**Messaging & Communication:**
- **Twilio** - WhatsApp messaging
  - SDK/Client: Custom wrapper in `lib/services/whatsapp.service.ts`
  - Auth: Account SID and auth token
  - Credentials: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`
  - Webhook: `/api/webhooks/whatsapp/` receives message delivery status
  - Usage: Send lead qualification messages, payment reminders

**Voice AI (Collection Calls):**
- **RetellAI** - Automated collection calls
  - SDK/Client: Custom wrapper in `lib/services/retell.service.ts`
  - Auth: API key in `RETELL_API_KEY`
  - Credentials: `RETELL_AGENT_ID` (Portuguese collection agent)
  - Webhook: `/api/webhooks/retell/` receives call status updates
  - Configuration: `COLLECTION_CALL_AUTO_DAYS`, `COLLECTION_CALL_MAX_ATTEMPTS`, `COLLECTION_CALL_HOURS_START`, `COLLECTION_CALL_HOURS_END`
  - Alternative: ElevenLabs (`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`)

**AI & Language Models:**
- **OpenAI** - Chatbot and lead qualification
  - SDK/Client: OpenAI SDK in `lib/services/ai.service.ts`
  - Auth: API key in `OPENAI_API_KEY`
  - Model: `AI_MODEL` env var (default: `gpt-4-turbo-preview`)
  - Temperature: `AI_TEMPERATURE` (default: 0.7)
  - Prompts: `lib/prompts/customer-service.ts`, `lib/prompts/lead-qualification.ts`
  - Usage: Customer service chatbot, lead qualification scoring

**Email Service:**
- **Resend** - Transactional emails
  - SDK/Client: Custom wrapper in `lib/services/email.service.ts`
  - Auth: API key in `RESEND_API_KEY`
  - Configuration: `EMAIL_FROM`, `EMAIL_FINANCE_TEAM`, `EMAIL_SUPPORT_TEAM`
  - Usage: Invoice notifications, payment reminders, contract notifications

## Data Storage

**Database:**
- **PostgreSQL (Neon)** - Primary data store
  - Connection: Via `POSTGRES_PRISMA_URL` (pooled) and `POSTGRES_URL_NON_POOLING` (direct)
  - Client: Prisma ORM v5.19.0 (`@prisma/client`)
  - Initialization: `lib/db.ts` exports singleton `prisma` client
  - Schema: `prisma/schema.prisma` (605 lines, 20+ models)
  - Migrations: Version-controlled in `prisma/migrations/`

**Redis (for BullMQ):**
- Connection: Via `REDIS_URL` env var
- Client: `ioredis` package v5.3.2
- Usage: Queue storage for BullMQ (async job processing)
- Host: Local development (localhost:6379), cloud in production (Upstash or similar)

**External Data Stores:**
- Pipedrive: All customer, lead, deal data synced bidirectionally
- QuickBooks: All invoice, customer, payment data synced bidirectionally
- Stripe: Payment intents, subscriptions, charges (no full sync)

## Authentication & Identity

**Auth Provider:**
- **NextAuth.js** - Session and authentication
  - Implementation: `lib/auth.ts` with JWT strategy
  - Token storage: httpOnly cookies via NextAuth.js
  - Session max age: 30 days
  - Roles: ADMIN, SALES, SDR, FINANCE, SUPPORT, OPERATIONAL, COMMERCIAL
  - Route protection: Middleware in `middleware.ts` checks auth and roles

**OAuth Integrations:**
- **QuickBooks OAuth** - For API access
  - Credentials: `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`
  - Redirect: `QUICKBOOKS_REDIRECT_URI`
  - Flow: User authorizes app → tokens stored in `SystemConfig` table
  - Token refresh: Automatic in `lib/services/quickbooks.service.ts`

## Monitoring & Observability

**Error Tracking:**
- Not configured yet
- Recommended: Sentry integration (can add later)

**Logging:**
- IntegrationLog table: All external API calls logged
- Table schema: `service`, `action`, `status`, `payload`, `error`, `retryCount`
- Access: Via `lib/utils/logger.ts` (`integrationLogger`)

**Metrics & Analytics:**
- Database views in `prisma/migrations/create_views.sql` for BI queries
- Views include: lead funnel, SDR performance, AI chat metrics, customer LTV

## CI/CD & Deployment

**Hosting:**
- **Vercel** - Serverless hosting for Next.js
  - Deployment: Automatic on main branch push
  - Environment vars: Configured in Vercel dashboard
  - Cron jobs: Defined in `vercel.json` with schedule expressions
  - Function timeout: 10 seconds (standard Vercel limit)

**CI Pipeline:**
- **GitHub Actions** - Tests and builds (not fully implemented)
  - Workflows location: `.github/workflows/` (if exists)
  - Can add: Lint, type check, tests, deploy

## Environment Configuration

**Development:**
- Required env vars: Database, Redis, API keys for all integrations
- Secrets location: `.env.local` (gitignored), team shared via 1Password
- Mock/stub services: Stripe test mode (test API keys), Pipedrive sandbox API token
- Local database: PostgreSQL via Docker or direct connection

**Staging:**
- Environment-specific overrides in Vercel dashboard
- Separate Pipedrive sandbox account (if available)
- Separate Stripe test mode account
- Separate QuickBooks sandbox environment

**Production:**
- Secrets management: Vercel environment variables (encrypted)
- Database: Neon PostgreSQL production project
- Redis: Upstash or similar managed Redis
- Monitoring: IntegrationLog table for debugging

## Webhooks & Callbacks

**Incoming (Webhook Endpoints):**

- **Pipedrive** - `/api/webhooks/pipedrive/`
  - Verification: HMAC SHA256 via `PIPEDRIVE_WEBHOOK_SECRET`
  - Events: Person created/updated, Deal created/updated, Deal status changed
  - Handlers: `lib/services/identity-mapper.ts` reconciles customer, services process

- **QuickBooks** - `/api/webhooks/quickbooks/`
  - Verification: HMAC SHA256 via `QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN`
  - Events: Invoice created/updated, Customer created/updated, Payment created
  - Handlers: Sync triggers via `lib/services/quickbooks-sync.service.ts`

- **Stripe** - `/api/webhooks/stripe/`
  - Verification: HMAC SHA256 via `STRIPE_WEBHOOK_SECRET`
  - Events: Payment intent succeeded/failed, Subscription updated/deleted
  - Handlers: Update invoice status, trigger contract generation

- **DocuSign** - `/api/webhooks/docusign/`
  - Verification: Signature validation
  - Events: Envelope signed, declined, voided
  - Handlers: Update contract status, trigger next steps

- **RetellAI** - `/api/webhooks/retell/`
  - Verification: Signature validation
  - Events: Call completed, abandoned, failed
  - Handlers: Log call results, update customer follow-up status

- **Twilio WhatsApp** - `/api/webhooks/whatsapp/`
  - Verification: Twilio account validation
  - Events: Message sent/failed, delivery confirmations
  - Handlers: Update conversation status

**Outgoing:**
- No outgoing webhooks currently implemented
- Could add: Customer lifecycle events to external systems

---

*Integration audit: 2026-01-09*
*Update when adding/removing external services*
