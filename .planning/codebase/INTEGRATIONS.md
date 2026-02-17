# External Integrations

**Analysis Date:** 2026-02-17

## APIs & External Services

### CRM - Pipedrive
- **Purpose:** Lead and deal management (single source of truth for sales pipeline)
- **Service:** `lib/services/pipedrive.service.ts` (PipedriveService class, singleton export)
- **Sync Service:** `lib/services/pipedrive-sync.service.ts` (bidirectional sync, bulk import)
- **Auth:** API token via `PIPEDRIVE_API_TOKEN`
- **Base URL:** `https://{PIPEDRIVE_COMPANY_DOMAIN}.pipedrive.com/api/v1`
- **Circuit Breaker:** Yes (via `lib/utils/circuit-breaker.ts`)
- **Webhook Endpoints:**
  - `app/api/webhooks/pipedrive/lead/route.ts` - New person webhook
  - `app/api/webhooks/pipedrive/deal/route.ts` - Deal won/updated webhook
- **Queues:** `pipedriveSync` (inbound), `pipedriveReverseSync` (outbound Hub->Pipedrive)
- **Env Vars:** `PIPEDRIVE_API_TOKEN`, `PIPEDRIVE_COMPANY_DOMAIN`, `PIPEDRIVE_WEBHOOK_SECRET`

### Finance - QuickBooks Online
- **Purpose:** Accounting, invoicing, payment tracking, customer financial records
- **Service:** `lib/services/quickbooks.service.ts` (QuickbooksService class, singleton export)
- **Sync Service:** `lib/services/quickbooks-sync.service.ts` (bidirectional sync, bulk import)
- **Auth:** OAuth 2.0 with token refresh (tokens stored in `SystemConfig` table, not env vars)
- **Base URL:** sandbox: `https://sandbox-quickbooks.api.intuit.com`, production: `https://quickbooks.api.intuit.com`
- **Circuit Breaker:** Yes
- **OAuth Endpoints:**
  - `app/api/quickbooks/auth/` - OAuth callback, connect, disconnect
- **API Endpoints:**
  - `app/api/quickbooks/customers/` - Fetch QB customers
  - `app/api/quickbooks/invoices/` - Fetch QB invoices
  - `app/api/quickbooks/sync/` - Manual sync trigger
- **Webhook Endpoint:** `app/api/webhooks/quickbooks/route.ts`
- **Cron Jobs:**
  - `/api/cron/quickbooks-sync` - Every 6 hours
  - `/api/cron/refresh-quickbooks-token` - Daily at 2 AM
- **Queue:** `quickbooksSync`
- **Env Vars:** `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`, `QUICKBOOKS_REDIRECT_URI`, `QUICKBOOKS_ENVIRONMENT`
- **DB-stored tokens:** `SystemConfig.quickbooks_access_token`, `SystemConfig.quickbooks_refresh_token`, `SystemConfig.quickbooks_token_expires_at`, `SystemConfig.quickbooks_company_id`

### Payments - Stripe
- **Purpose:** Payment processing, payment links, customer billing
- **Service:** `lib/services/stripe.service.ts` (StripeService class, singleton export)
- **SDK:** `stripe` ^14.25.0 (server) + `@stripe/stripe-js` ^8.6.1 (client)
- **API Version:** `2023-10-16`
- **Circuit Breaker:** Yes
- **Webhook Endpoint:** `app/api/webhooks/stripe/route.ts`
- **Env Vars:** `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PAYMENT_SUCCESS_URL`, `STRIPE_PAYMENT_CANCEL_URL`

### Contracts - DocuSign
- **Purpose:** Contract generation, e-signature, signed document retrieval
- **Service:** `lib/services/docusign.service.ts` (DocuSignService class, singleton export)
- **Workflow Service:** `lib/services/contract-workflow.service.ts`
- **Auth:** JWT Grant with RSA private key (no SDK - uses direct HTTP with crypto module)
- **PDF Generation:** Uses `pdf-lib` to generate contract PDFs inline
- **OAuth Paths:** Demo: `account-d.docusign.com`, Production: `account.docusign.com`
- **Circuit Breaker:** Yes
- **Webhook Endpoint:** `app/api/webhooks/docusign/route.ts`
- **Cron Jobs:**
  - `/api/cron/contract-reminders` - Daily at 9 AM
  - `/api/cron/contract-expiration` - Daily at 1 AM
- **Env Vars:** `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_USER_ID`, `DOCUSIGN_ACCOUNT_ID`, `DOCUSIGN_BASE_URL`, `DOCUSIGN_PRIVATE_KEY`, `DOCUSIGN_WEBHOOK_SECRET`, `DOCUSIGN_TEMPLATE_ID` (optional)

### Messaging - Twilio (WhatsApp)
- **Purpose:** WhatsApp Business messaging for lead engagement and notifications
- **Service:** `lib/services/whatsapp.service.ts` (WhatsAppService class, singleton export)
- **SDK:** `twilio` ^4.23.0
- **Circuit Breaker:** Yes
- **Webhook Endpoint:** `app/api/webhooks/whatsapp/route.ts`
- **Queue:** `whatsappMessages`
- **Env Vars:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`, `TWILIO_PHONE_NUMBER`

### AI - OpenAI
- **Purpose:** Customer service chatbot, lead qualification scoring, support chat
- **Service:** `lib/services/ai.service.ts` (AIService class, singleton export)
- **Support Chat:** `lib/services/support-chat.service.ts` (SupportChatService, uses `gpt-3.5-turbo` by default for cost efficiency)
- **SDK:** `openai` ^4.52.0
- **Models Used:**
  - Lead qualification + chatbot: `gpt-4-turbo-preview` (configurable via `AI_MODEL`)
  - Support chat: `gpt-3.5-turbo` (configurable via `SUPPORT_AI_MODEL`)
- **Prompts:** `lib/prompts/customer-service.ts`, `lib/prompts/lead-qualification.ts`, `lib/prompts/support-chat.ts`
- **Circuit Breaker:** Yes
- **Graceful Degradation:** Returns fallback message and escalates to human if API key missing or API fails
- **Env Vars:** `OPENAI_API_KEY`, `AI_MODEL`, `AI_TEMPERATURE`, `SUPPORT_AI_MODEL`

### Voice AI - RetellAI
- **Purpose:** AI-powered collection calls for overdue invoices
- **Service:** `lib/services/retell.service.ts` (RetellAI service)
- **Collection Service:** `lib/services/collection-call.service.ts`
- **Circuit Breaker:** Yes
- **Webhook Endpoint:** `app/api/webhooks/retell/route.ts`
- **Cron Job:** `/api/cron/collection-calls` - Daily at 1 PM
- **Env Vars:** `RETELL_API_KEY`, `RETELL_AGENT_ID`, `RETELL_WEBHOOK_SECRET`
- **Configuration Env Vars:** `COLLECTION_CALL_AUTO_DAYS`, `COLLECTION_CALL_MAX_ATTEMPTS`, `COLLECTION_CALL_HOURS_START`, `COLLECTION_CALL_HOURS_END`

### Email - Resend
- **Purpose:** Transactional email delivery (invoice notifications, contract reminders, daily digests, payment reminders)
- **Service:** `lib/services/notification.service.ts` (uses Resend SDK)
- **Email Templates:** `lib/services/email.service.ts` (HTML template builder), `lib/services/email-service.ts`
- **React Email:** `@react-email/components` ^1.0.3 for template rendering
- **SDK:** `resend` ^6.7.0
- **Lazy Init:** Client only created when `RESEND_API_KEY` is available
- **Cron Jobs:**
  - `/api/cron/payment-reminders` - Daily at 10 AM
  - `/api/cron/overdue-invoices` - Daily at 2 AM
  - `/api/cron/send-scheduled-invoices` - Daily at 9 AM
  - `/api/cron/daily-ar-digest` - Daily at 9 AM
  - `/api/cron/overdue-invoice-alerts` - Every 6 hours
- **Env Vars:** `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_FINANCE_TEAM`, `EMAIL_SUPPORT_TEAM`

## Data Storage

**Primary Database:**
- PostgreSQL on Neon
- Connection: pooled via `POSTGRES_PRISMA_URL`, direct via `POSTGRES_URL_NON_POOLING`
- Client: Prisma ORM (singleton in `lib/db.ts`)
- Schema: `prisma/schema.prisma` (21 models, 20 enums)
- Connection pooling: pgbouncer=true, connection_limit=10, pool_timeout=30s

**File Storage:**
- AWS S3 for signed contract PDFs (`lib/services/document-storage.service.ts`)
- Bucket structure: `contracts/{year}/{envelopeId}.pdf`
- Access: Presigned URLs with time-limited access
- Env Vars: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`
- Graceful degradation: if S3 not configured, signed documents only have DocuSign URI

**Caching/Queue Backend:**
- Redis for BullMQ job queues
- Connection: `REDIS_URL`
- Graceful degradation: validates hostname, falls back to localhost if placeholder/invalid

## Authentication & Identity

**Auth Provider:**
- NextAuth.js with Credentials provider (`lib/auth.ts`)
- JWT strategy (no database sessions)
- Session max age: 30 days
- Token refresh: every 24 hours
- Password hashing: bcryptjs (`lib/services/auth.service.ts`)
- Sign-in page: `/auth/signin`

**RBAC (Role-Based Access Control):**
- 7 roles: ADMIN, SALES, SDR, FINANCE, SUPPORT, OPERATIONAL, COMMERCIAL
- Middleware enforces route-level access (`middleware.ts`)
- Route-to-role mapping with first-match-wins logic
- Matcher: `/dashboard/:path*`, `/api/dashboard/:path*`

**Customer Identity:**
- Identity Mapper pattern (`lib/services/identity-mapper.ts`)
- Email is the unique key across all external systems
- Reconciles IDs from: Pipedrive, QuickBooks, Stripe, DocuSign, Trello, CloudTalk, Google Contacts
- Prevents duplicate customers across CRM and financial systems

## Monitoring & Observability

**Error Tracking:**
- Custom IntegrationLogger (`lib/utils/logger.ts`) writes to `IntegrationLog` database table
- Structured error data: errorCode, category (transient/permanent/auth/validation), severity, recovery action
- All external API calls logged with service name, action, status, payload, error, duration

**Circuit Breaker:**
- Custom implementation (`lib/utils/circuit-breaker.ts`)
- Database-persisted state (`CircuitBreakerState` model in Prisma)
- States: CLOSED -> OPEN (after 5 failures) -> HALF_OPEN (after 60s timeout) -> CLOSED (after 2 successes)
- Applied to: Pipedrive, QuickBooks, Stripe, DocuSign, WhatsApp/Twilio, OpenAI, Resend

**Webhook Reliability:**
- Webhook event deduplication (`WebhookEvent` model, `lib/utils/webhook-event-id.ts`)
- Dead letter queue: `app/api/webhooks/dead-letter/route.ts`
- Reprocessing: `app/api/webhooks/reprocess/route.ts`
- Health check: `app/api/webhooks/health/route.ts`
- Webhook validation: `lib/utils/webhook-validation.ts`
- HMAC verification: `lib/utils/hmac.ts`

**Queue Monitoring:**
- Queue monitor: `lib/utils/queue-monitor.ts`
- Cron: `/api/cron/monitor-queues` - Every 4 hours

**Alerts:**
- Alert rules engine with `AlertRule` and `Alert` models
- Cron: `/api/cron/evaluate-alerts` - Hourly
- Severity levels: LOW, MEDIUM, HIGH, CRITICAL
- Alert events tracking (`AlertEvent` model)

**Logs:**
- Console logging with `[SERVICE]` prefix pattern (e.g., `[AUTH]`, `[AI]`, `[QUEUE]`)
- IntegrationLog table for all external API interactions
- Prisma client logging: errors + warnings in dev, errors only in prod

## CI/CD & Deployment

**Hosting:**
- Vercel (serverless)
- Auto-deploys from Git (main branch)

**CI Pipeline:**
- Build command: `prisma generate && next build`
- TypeScript errors: NOT ignored (`ignoreBuildErrors: false`)
- ESLint errors: NOT ignored (`ignoreDuringBuilds: false`)

**Cron Jobs (via `vercel.json`):**
| Endpoint | Schedule | Purpose |
|---|---|---|
| `/api/cron/evaluate-alerts` | Hourly | Evaluate alert rules |
| `/api/cron/refresh-quickbooks-token` | Daily 2 AM | Refresh QB OAuth tokens |
| `/api/cron/quickbooks-sync` | Every 6 hours | Sync with QuickBooks |
| `/api/cron/process-queue` | Every 5 minutes | Process BullMQ jobs |
| `/api/cron/monitor-queues` | Every 4 hours | Monitor queue health |
| `/api/cron/contract-reminders` | Daily 9 AM | Send contract signing reminders |
| `/api/cron/contract-expiration` | Daily 1 AM | Handle expired contracts |
| `/api/cron/payment-reminders` | Daily 10 AM | Send payment reminders |
| `/api/cron/overdue-invoices` | Daily 2 AM | Mark invoices as overdue |
| `/api/cron/collection-calls` | Daily 1 PM | Initiate AI collection calls |
| `/api/cron/send-scheduled-invoices` | Daily 9 AM | Send scheduled invoices |
| `/api/cron/daily-ar-digest` | Daily 9 AM | Send AR digest email |
| `/api/cron/overdue-invoice-alerts` | Every 6 hours | Alert on overdue invoices |

## Environment Configuration

**Required env vars (see `.env.example` for full list):**

| Category | Variables |
|---|---|
| Database | `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING` |
| Auth | `NEXTAUTH_SECRET`, `NEXTAUTH_URL` |
| OpenAI | `OPENAI_API_KEY` |
| Pipedrive | `PIPEDRIVE_API_TOKEN`, `PIPEDRIVE_COMPANY_DOMAIN` |
| QuickBooks | `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`, `QUICKBOOKS_REDIRECT_URI` |
| Stripe | `STRIPE_SECRET_KEY` |
| Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` |
| DocuSign | `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_USER_ID`, `DOCUSIGN_ACCOUNT_ID`, `DOCUSIGN_PRIVATE_KEY` |
| AWS S3 | `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME` |
| Redis | `REDIS_URL` |
| Resend | `RESEND_API_KEY`, `EMAIL_FROM` |
| RetellAI | `RETELL_API_KEY`, `RETELL_AGENT_ID` |
| App | `NEXT_PUBLIC_APP_URL`, `CRON_SECRET` |

**Secrets location:**
- Environment variables via Vercel dashboard (production)
- `.env.local` file (development, git-ignored)
- QuickBooks OAuth tokens: `SystemConfig` table in database (refreshed via cron)
- Webhook secrets: `SystemConfig` table or env vars

## Webhooks & Callbacks

**Incoming Webhooks:**
| Endpoint | Source | Purpose |
|---|---|---|
| `/api/webhooks/pipedrive/lead` | Pipedrive | New person created |
| `/api/webhooks/pipedrive/deal` | Pipedrive | Deal won/updated |
| `/api/webhooks/quickbooks` | QuickBooks | Entity change notifications |
| `/api/webhooks/stripe` | Stripe | Payment events |
| `/api/webhooks/docusign` | DocuSign | Contract signing events |
| `/api/webhooks/whatsapp` | Twilio | Inbound WhatsApp messages |
| `/api/webhooks/retell` | RetellAI | Voice call events |
| `/api/webhooks/health` | Internal | Webhook health check |
| `/api/webhooks/dead-letter` | Internal | Failed webhook viewer |
| `/api/webhooks/reprocess` | Internal | Retry failed webhooks |

**Outgoing Callbacks:**
- Stripe payment success/cancel URLs: configurable via `STRIPE_PAYMENT_SUCCESS_URL`, `STRIPE_PAYMENT_CANCEL_URL`
- DocuSign OAuth redirect: `QUICKBOOKS_REDIRECT_URI` (via `/api/quickbooks/auth/`)

## Integration Patterns

**All external integrations follow this pattern:**
1. Service class in `lib/services/` with singleton export
2. Circuit breaker wrapping all external API calls
3. IntegrationLog entry for every call (success or failure)
4. Graceful degradation when credentials are missing (lazy initialization, null client checks)
5. Queue-based async processing for non-blocking operations
6. Structured error categorization (transient, permanent, auth, validation)

**Key files for adding new integrations:**
- Service: `lib/services/{name}.service.ts`
- Circuit breaker: `lib/utils/circuit-breaker.ts`
- Logger: `lib/utils/logger.ts`
- Queue: `lib/utils/queue.ts`
- Identity mapper: `lib/services/identity-mapper.ts` (if customer-facing)
- Webhook: `app/api/webhooks/{name}/route.ts`

---

*Integration audit: 2026-02-17*
