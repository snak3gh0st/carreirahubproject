# Technology Stack

**Analysis Date:** 2026-02-17

## Languages

**Primary:**
- TypeScript 5.5+ (strict mode) - All application code, services, API routes, components

**Secondary:**
- JavaScript - Config files (`next.config.js`, `postcss.config.js`, seed/clear scripts)
- SQL - Database views (`prisma/migrations/create_views.sql`)

## Runtime

**Environment:**
- Node.js (development machine: v25.6.1)
- Vercel Serverless Functions (production, 10s timeout)

**Package Manager:**
- npm 11.9.0
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Next.js ^14.2.0 - Full-stack framework (App Router)
- React ^18.3.0 - UI rendering
- Prisma ^5.19.0 - Database ORM and schema management

**Authentication:**
- NextAuth.js ^4.24.5 - Credentials provider with JWT strategy (`lib/auth.ts`)

**Queue/Background Processing:**
- BullMQ ^5.3.0 - Job queue system (`lib/utils/queue.ts`)
- ioredis ^5.3.2 - Redis client for BullMQ

**UI/Styling:**
- Tailwind CSS ^3.4.0 - Utility-first CSS (`tailwind.config.ts`)
- tailwindcss-animate ^1.0.7 - Animation utilities
- Radix UI - Headless component primitives (checkbox, dialog, dropdown-menu, label, popover, scroll-area, select, slot, switch, tabs, tooltip)
- Lucide React ^0.378.0 - Icon library
- class-variance-authority ^0.7.0 - Variant-based component styling
- clsx ^2.1.1 + tailwind-merge ^2.4.0 - Class name utilities (`lib/utils/cn.ts`)
- cmdk ^1.1.1 - Command palette component
- next-themes ^0.4.6 - Dark mode support
- sonner ^2.0.7 - Toast notifications
- recharts ^2.15.4 - Charting/data visualization

**Data Management:**
- @tanstack/react-query ^5.90.17 - Server state management and caching
- @tanstack/react-table ^8.21.3 - Table/data grid component
- papaparse ^5.5.3 - CSV parsing for bulk imports

**Build/Dev:**
- ESLint ^8.57.1 + eslint-config-next ^14.2.35 - Linting
- PostCSS ^8.4.0 + Autoprefixer ^10.4.0 - CSS processing
- tsx (via npx) - TypeScript script execution for dev/test scripts

## Key Dependencies

**Critical (core business logic):**
- `openai` ^4.52.0 - AI chatbot and lead qualification (`lib/services/ai.service.ts`)
- `stripe` ^14.25.0 - Payment processing (`lib/services/stripe.service.ts`)
- `@stripe/stripe-js` ^8.6.1 - Stripe client-side SDK
- `twilio` ^4.23.0 - WhatsApp messaging via Twilio (`lib/services/whatsapp.service.ts`)
- `pdf-lib` ^1.17.1 - PDF generation for contracts (`lib/services/docusign.service.ts`)
- `resend` ^6.7.0 - Transactional email sending (`lib/services/notification.service.ts`)

**Infrastructure:**
- `@prisma/client` ^5.19.0 - Database client (singleton in `lib/db.ts`)
- `@vercel/postgres` ^0.5.0 - Vercel Postgres adapter
- `bullmq` ^5.3.0 - Async job processing with retry
- `@aws-sdk/client-s3` ^3.974.0 + `@aws-sdk/s3-request-presigner` ^3.974.0 - S3 document storage (`lib/services/document-storage.service.ts`)
- `bcryptjs` ^3.0.3 - Password hashing (`lib/services/auth.service.ts`)
- `zod` ^3.23.0 - Runtime schema validation
- `p-retry` ^7.1.1 - Retry logic for external API calls
- `date-fns` ^3.6.0 - Date manipulation utilities

**Email:**
- `@react-email/components` ^1.0.3 - React-based email templates
- `resend` ^6.7.0 - Email delivery service

## Configuration

**TypeScript:**
- Config: `tsconfig.json`
- Target: ES2020
- Strict mode: enabled
- Module resolution: bundler
- Path alias: `@/*` maps to project root
- JSX: preserve (Next.js handles compilation)

**Environment:**
- `.env.local` - Local development secrets (git-ignored)
- `.env.example` - Template with all required env vars
- Environment variables loaded via Next.js built-in dotenv

**Build:**
- `next.config.js` - Next.js configuration (TypeScript and ESLint errors not ignored)
- `postcss.config.js` - PostCSS with Tailwind CSS and Autoprefixer plugins
- `tailwind.config.ts` - Tailwind with custom design system (CSS variable-based colors, Inter/Space Grotesk/JetBrains Mono fonts, 4px spacing scale)
- Build command: `prisma generate && next build` (generates Prisma client before build)

**Database:**
- `prisma/schema.prisma` - PostgreSQL with Neon pooled + direct connections
- Connection pooling: pgbouncer=true, connection_limit=10, pool_timeout=30 (`lib/db.ts`)

**Scheduled Jobs:**
- `vercel.json` - 13 Vercel Cron Jobs for automated operations (sync, reminders, alerts, queue processing)

## Design System

**Color Tokens:**
- CSS variable-based color system (primary blue, success, warning, error, info, gray scales)
- Brand colors: Carreira USA Gold theme (#D4AF37 as primary gold)
- Sigma Intel brand: #29ABE2
- Dark theme support via `next-themes` with `class` strategy
- Design tokens defined in `lib/design-tokens.ts`

**Typography:**
- Sans: Inter, system-ui fallbacks
- Display: Space Grotesk
- Mono: JetBrains Mono

**Spacing:**
- 4px base unit system via CSS variables

## Platform Requirements

**Development:**
- Node.js 18+ (uses ES2020 features)
- PostgreSQL database (Neon recommended)
- Redis instance (optional - gracefully degrades without it)
- Environment variables per `.env.example`

**Production:**
- Vercel (serverless deployment)
- Neon PostgreSQL (pooled + direct connection strings)
- Redis (for BullMQ queue processing, optional)
- Vercel Cron Jobs (13 scheduled endpoints)

---

*Stack analysis: 2026-02-17*
