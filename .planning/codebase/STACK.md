# Technology Stack

**Analysis Date:** 2026-01-27

## Languages

**Primary:**
- TypeScript 5.5.0 - All application code (strict mode enabled)
- JavaScript - Configuration files (Next.js, Tailwind, PostCSS)

**Secondary:**
- SQL - PostgreSQL database queries and migrations

## Runtime

**Environment:**
- Node.js v25.3.0 (ES2020 target)
- Next.js 14.2.0+ (App Router architecture)

**Package Manager:**
- npm (default)
- Lockfile: package-lock.json (present)

## Frameworks

**Core:**
- Next.js 14.2.0+ - Full-stack React framework with App Router
- React 18.3.0 - UI library
- Prisma 5.19.0 - Database ORM and migration tool

**Testing:**
- Not detected - No test framework configured

**Build/Dev:**
- TypeScript 5.5.0 - Type checking and compilation
- ESLint 8.57.1 - Code linting (eslint-config-next)
- Tailwind CSS 3.4.0 - Utility-first CSS framework
- PostCSS 8.4.0 - CSS processing
- Autoprefixer 10.4.0 - CSS vendor prefixing

## Key Dependencies

**Critical:**
- `@prisma/client` 5.19.0 - Database client (PostgreSQL via Neon)
- `next-auth` 4.24.5 - Authentication (JWT strategy, RBAC)
- `bullmq` 5.3.0 - Queue management for async jobs
- `ioredis` 5.3.2 - Redis client for BullMQ

**Infrastructure:**
- `openai` 4.52.0 - AI chatbot and lead qualification
- `stripe` 14.25.0 - Payment processing SDK
- `@stripe/stripe-js` 8.6.1 - Stripe.js for client-side
- `twilio` 4.23.0 - WhatsApp messaging via Twilio Business API
- `resend` 6.7.0 - Transactional email service
- `@aws-sdk/client-s3` 3.974.0 - AWS S3 for document storage
- `@aws-sdk/s3-request-presigner` 3.974.0 - Presigned URL generation
- `pdf-lib` 1.17.1 - PDF generation and manipulation
- `bcryptjs` 3.0.3 - Password hashing

**UI Components:**
- `@radix-ui/*` - Headless UI components (dialog, dropdown, tabs, etc.)
- `lucide-react` 0.378.0 - Icon library
- `recharts` 2.15.4 - Charts and analytics
- `@tanstack/react-query` 5.90.17 - Server state management
- `@tanstack/react-table` 8.21.3 - Data table management
- `next-themes` 0.4.6 - Dark mode support
- `sonner` 2.0.7 - Toast notifications

**Utilities:**
- `zod` 3.23.0 - Schema validation
- `date-fns` 3.6.0 - Date manipulation
- `papaparse` 5.5.3 - CSV parsing
- `p-retry` 7.1.1 - Retry logic with exponential backoff
- `clsx` 2.1.1 - Conditional class names
- `class-variance-authority` 0.7.0 - Component variants
- `tailwind-merge` 2.4.0 - Tailwind class merging

## Configuration

**Environment:**
- Environment variables stored in `.env` files (`.env`, `.env.local`, `.env.example`)
- 107 environment variables total (see `.env.example`)
- Secrets managed via environment variables + database (SystemConfig table for OAuth tokens)

**Build:**
- `tsconfig.json` - TypeScript configuration (strict mode, path aliases `@/*`)
- `next.config.js` - Next.js configuration (TypeScript/ESLint errors not ignored)
- `tailwind.config.ts` - Tailwind CSS configuration (dark mode class strategy)
- `postcss.config.js` - PostCSS configuration (Tailwind + Autoprefixer)
- `vercel.json` - Vercel deployment config (11 cron jobs defined)
- `prisma/schema.prisma` - Database schema (PostgreSQL with Neon pooling)

**Database:**
- Prisma Client generation: `npm run db:generate`
- Schema push (dev): `npm run db:push`
- Migrations (prod): `npm run db:migrate`
- Prisma Studio: `npm run db:studio`
- SQL views: `npm run db:views` (creates materialized views for BI)

## Platform Requirements

**Development:**
- Node.js v25.3.0 or compatible
- PostgreSQL database (Neon recommended for connection pooling)
- Redis server (for BullMQ queues)
- Environment variables configured (see `.env.example`)

**Production:**
- Vercel Serverless Functions (deployment target)
- Neon PostgreSQL (connection pooling via `POSTGRES_PRISMA_URL`)
- Redis (Upstash or managed Redis for production)
- External API keys: OpenAI, Stripe, Twilio, QuickBooks, Pipedrive, DocuSign, AWS S3, Resend, RetellAI

**Cron Jobs (Vercel):**
- `/api/cron/evaluate-alerts` - Every hour
- `/api/cron/refresh-quickbooks-token` - Daily at 2 AM
- `/api/cron/quickbooks-sync` - Every 6 hours
- `/api/cron/process-queue` - Every 5 minutes
- `/api/cron/monitor-queues` - Every 4 hours
- `/api/cron/contract-reminders` - Daily at 9 AM
- `/api/cron/contract-expiration` - Daily at 1 AM
- `/api/cron/payment-reminders` - Daily at 10 AM
- `/api/cron/overdue-invoices` - Daily at 2 AM
- `/api/cron/collection-calls` - Daily at 1 PM
- `/api/cron/send-scheduled-invoices` - Daily at 9 AM

---

*Stack analysis: 2026-01-27*
