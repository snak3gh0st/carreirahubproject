# External Integrations

**Analysis Date:** 2026-01-27

## APIs & External Services

**CRM:**
- Pipedrive - Lead and deal management, sales pipeline
  - SDK/Client: Custom HTTP client (`lib/services/pipedrive.service.ts`)
  - Auth: API token via `PIPEDRIVE_API_TOKEN`
  - Webhook secret: `PIPEDRIVE_WEBHOOK_SECRET`
  - Company domain: `PIPEDRIVE_COMPANY_DOMAIN`
  - Circuit breaker: Enabled (transient failure protection)

**Finance/Accounting:**
- QuickBooks Online - Invoice and customer synchronization
  - SDK/Client: Custom OAuth2 client (`lib/services/quickbooks.service.ts`)
  - Auth: OAuth2 (tokens stored in `SystemConfig` database table)
  - Environment: `QUICKBOOKS_ENVIRONMENT` (sandbox/production)
  - Client ID: `QUICKBOOKS_CLIENT_ID`
  - Client Secret: `QUICKBOOKS_CLIENT_SECRET`
  - Redirect URI: `QUICKBOOKS_REDIRECT_URI`
  - Circuit breaker: Enabled
  - Sync frequency: Every 6 hours via cron

**Payments:**
- Stripe - Payment processing and invoice payments
  - SDK/Client: `stripe` 14.25.0 (`lib/services/stripe.service.ts`)
  - Auth: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`
  - Webhook secret: `STRIPE_WEBHOOK_SECRET`
  - Payment URLs: `STRIPE_PAYMENT_SUCCESS_URL`, `STRIPE_PAYMENT_CANCEL_URL`
  - API version: 2023-10-16
  - Circuit breaker: Enabled

**AI/ML:**
- OpenAI - Chatbot and lead qualification
  - SDK/Client: `openai` 4.52.0 (`lib/services/ai.service.ts`)
  - Auth: `OPENAI_API_KEY`
  - Model: `AI_MODEL` (default: gpt-4-turbo-preview)
  - Temperature: `AI_TEMPERATURE` (default: 0.7)
  - Circuit breaker: Enabled
  - Graceful degradation: Returns fallback message if API unavailable

**Voice AI (Collection Calls):**
- RetellAI - AI-powered phone calls for overdue invoices
  - SDK/Client: Custom HTTP client (`lib/services/retell.service.ts`)
  - Auth: `RETELL_API_KEY`
  - Agent ID: `RETELL_AGENT_ID` (Portuguese collection agent)
  - Webhook secret: `RETELL_WEBHOOK_SECRET`
  - Circuit breaker: Enabled

**Messaging:**
- Twilio WhatsApp - WhatsApp Business API messaging
  - SDK/Client: `twilio` 4.23.0 (`lib/services/whatsapp.service.ts`)
  - Auth: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
  - WhatsApp number: `TWILIO_WHATSAPP_NUMBER`
  - Phone number: `TWILIO_PHONE_NUMBER` (outbound voice)
  - Circuit breaker: Enabled

**Contract Management:**
- DocuSign - Contract generation and e-signature
  - SDK/Client: Custom JWT client (`lib/services/docusign.service.ts`)
  - Auth: JWT Grant (RSA private key)
  - Integration key: `DOCUSIGN_INTEGRATION_KEY`
  - User ID: `DOCUSIGN_USER_ID`
  - Account ID: `DOCUSIGN_ACCOUNT_ID`
  - Base URL: `DOCUSIGN_BASE_URL` (demo.docusign.net or production)
  - Private key: `DOCUSIGN_PRIVATE_KEY` (base64 encoded RSA key)
  - Webhook secret: `DOCUSIGN_WEBHOOK_SECRET`
  - Template ID: `DOCUSIGN_TEMPLATE_ID` (optional, falls back to inline PDF)
  - Circuit breaker: Enabled

**Email:**
- Resend - Transactional email service
  - SDK/Client: `resend` 6.7.0 (`lib/services/notification.service.ts`)
  - Auth: `RESEND_API_KEY`
  - From address: `EMAIL_FROM`
  - Finance team: `EMAIL_FINANCE_TEAM`
  - Support team: `EMAIL_SUPPORT_TEAM`
  - Circuit breaker: Enabled

## Data Storage

**Databases:**
- PostgreSQL (Neon)
  - Connection (pooled): `POSTGRES_PRISMA_URL`
  - Connection (direct): `POSTGRES_URL_NON_POOLING`
  - Client: Prisma ORM 5.19.0
  - Schema: `prisma/schema.prisma`

**File Storage:**
- AWS S3 - Signed contract PDF storage
  - Client: `@aws-sdk/client-s3` 3.974.0 (`lib/services/document-storage.service.ts`)
  - Region: `AWS_REGION` (default: us-east-1)
  - Access key: `AWS_ACCESS_KEY_ID`
  - Secret key: `AWS_SECRET_ACCESS_KEY`
  - Bucket: `S3_BUCKET_NAME`
  - Storage structure: `contracts/{year}/{envelopeId}.pdf`
  - Presigned URLs: 7-day expiration
  - Encryption: AES-256 server-side

**Caching:**
- Redis - Queue management and job processing
  - Client: `ioredis` 5.3.2
  - Connection: `REDIS_URL`
  - Used by: BullMQ 5.3.0 (`lib/utils/queue.ts`)

## Authentication & Identity

**Auth Provider:**
- NextAuth.js 4.24.5 - Custom credentials provider
  - Implementation: JWT strategy (`lib/auth.ts`)
  - Password hashing: bcryptjs 3.0.3
  - Session max age: 30 days
  - Secret: `NEXTAUTH_SECRET`
  - URL: `NEXTAUTH_URL`
  - Roles: ADMIN, SALES, SDR, FINANCE, SUPPORT, OPERATIONAL, COMMERCIAL

**Identity Mapping:**
- Custom Identity Mapper Service (`lib/services/identity-mapper.ts`)
  - Purpose: Deduplicate customers across external systems
  - Unique key: Email address
  - Reconciles IDs from: Pipedrive, QuickBooks, Stripe, DocuSign, Trello, CloudTalk, Google Contacts

## Monitoring & Observability

**Error Tracking:**
- Custom IntegrationLog table (database)
  - Service: All external API calls logged
  - Fields: service, action, status, payload, error, errorCode, errorCategory, errorSeverity
  - Location: `prisma/schema.prisma` (IntegrationLog model)
  - Logger: `lib/utils/logger.ts`

**Circuit Breaker:**
- Custom circuit breaker implementation (`lib/utils/circuit-breaker.ts`)
  - State tracking: Database table (CircuitBreakerState)
  - States: CLOSED, OPEN, HALF_OPEN
  - Protected services: Pipedrive, QuickBooks, Stripe, OpenAI, WhatsApp, DocuSign, RetellAI, Email
  - Thresholds: 5 failures to open, 2 successes to close
  - Timeout: 60 seconds (OPEN → HALF_OPEN)

**Logs:**
- Console logging with structured error data
  - Integration logs stored in database
  - Error categorization: transient, permanent, auth, validation, unknown
  - Severity levels: info, warning, error, critical
  - Recovery actions: retry, manual_intervention, contact_support, check_circuit

## CI/CD & Deployment

**Hosting:**
- Vercel Serverless Functions
  - Config: `vercel.json`
  - Build command: `npm run build` (includes Prisma generation)
  - Start command: `npm start`

**CI Pipeline:**
- Not detected - No dedicated CI configuration

**Cron Jobs (Vercel):**
- 11 scheduled jobs via `vercel.json`
  - QuickBooks token refresh: Daily at 2 AM
  - QuickBooks sync: Every 6 hours
  - Queue processing: Every 5 minutes
  - Queue monitoring: Every 4 hours
  - Alert evaluation: Every hour
  - Contract reminders: Daily at 9 AM
  - Contract expiration check: Daily at 1 AM
  - Payment reminders: Daily at 10 AM
  - Overdue invoice check: Daily at 2 AM
  - Collection calls: Daily at 1 PM
  - Scheduled invoice sending: Daily at 9 AM
  - Protected by: `CRON_SECRET`

## Environment Configuration

**Required env vars:**
- Database: `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`
- Redis: `REDIS_URL`
- NextAuth: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- Pipedrive: `PIPEDRIVE_API_TOKEN`, `PIPEDRIVE_COMPANY_DOMAIN`, `PIPEDRIVE_WEBHOOK_SECRET`
- QuickBooks: `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`, `QUICKBOOKS_REDIRECT_URI`, `QUICKBOOKS_ENVIRONMENT`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- OpenAI: `OPENAI_API_KEY`, `AI_MODEL`, `AI_TEMPERATURE`
- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`
- DocuSign: `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_USER_ID`, `DOCUSIGN_ACCOUNT_ID`, `DOCUSIGN_BASE_URL`, `DOCUSIGN_PRIVATE_KEY`
- AWS S3: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`
- Resend: `RESEND_API_KEY`, `EMAIL_FROM`
- RetellAI: `RETELL_API_KEY`, `RETELL_AGENT_ID`, `RETELL_WEBHOOK_SECRET`
- App: `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`
- SDR: `SDR_QUALIFICATION_THRESHOLD` (default: 70)

**Secrets location:**
- Environment variables: `.env` files (gitignored)
- OAuth tokens: Database `SystemConfig` table (QuickBooks tokens auto-refreshed)
- Webhook secrets: Database `SystemConfig` table + environment variables

## Webhooks & Callbacks

**Incoming:**
- Pipedrive webhooks:
  - Person created: `/api/webhooks/pipedrive/person`
  - Lead created: `/api/webhooks/pipedrive/lead`
  - Deal updated: `/api/webhooks/pipedrive/deal`
- QuickBooks webhooks:
  - Entity changes: `/api/webhooks/quickbooks`
- Stripe webhooks:
  - Payment events: `/api/webhooks/stripe`
- DocuSign webhooks:
  - Envelope events: `/api/webhooks/docusign`
- Twilio WhatsApp webhooks:
  - Message status: `/api/webhooks/whatsapp`
- RetellAI webhooks:
  - Call events: `/api/webhooks/retell`
- Webhook reliability:
  - Dead letter queue: `/api/webhooks/dead-letter`
  - Reprocessing: `/api/webhooks/reprocess/[id]`
  - Health check: `/api/webhooks/health`
  - Event storage: `WebhookEvent` database table (automatic retry with exponential backoff)

**Outgoing:**
- QuickBooks OAuth callback: `/api/quickbooks/auth/callback`
- Stripe payment redirect: `STRIPE_PAYMENT_SUCCESS_URL`, `STRIPE_PAYMENT_CANCEL_URL`

## Queue System (BullMQ)

**Queues:**
- `lead-qualification` - AI lead scoring and qualification
- `whatsapp-messages` - WhatsApp message sending
- `pipedrive-sync` - Sync from Pipedrive to database
- `pipedrive-reverse-sync` - Sync from database to Pipedrive
- `invoice-generation` - Invoice creation workflow
- `invoice-approval` - Invoice approval workflow (deprecated)
- `contract-generation` - DocuSign contract generation
- `quickbooks-sync` - QuickBooks bidirectional sync
- `bulk-import` - Bulk data import operations

**Queue Configuration:**
- Connection: Redis via `REDIS_URL`
- Worker execution: Vercel cron triggers queue processing (workers don't run continuously)
- Retry logic: Exponential backoff via BullMQ
- Processing endpoint: `/api/cron/process-queue` (every 5 minutes)
- Monitoring endpoint: `/api/cron/monitor-queues` (every 4 hours)

---

*Integration audit: 2026-01-27*
