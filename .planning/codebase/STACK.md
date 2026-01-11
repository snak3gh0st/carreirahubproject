# Technology Stack

**Analysis Date:** 2026-01-09

## Languages

**Primary:**
- TypeScript 5.x - All application code (`package.json`, `tsconfig.json`)

**Secondary:**
- JavaScript - Build scripts, configuration files (`tailwind.config.ts`, `next.config.js`)

## Runtime

**Environment:**
- Node.js 20+ (via Next.js 14)
- Browser runtime (React components)

**Package Manager:**
- npm (latest)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 14+ (App Router) - Full-stack web application and API routes
- React 18+ - UI components

**Testing:**
- Not detected (no jest.config or vitest.config found)

**Build/Dev:**
- Next.js built-in build system
- TypeScript 5.x - Type checking and compilation
- Tailwind CSS - Styling (`tailwind.config.ts`)

## Key Dependencies

**Critical:**
- `@prisma/client` ^5.19.0 - ORM for PostgreSQL (`lib/db.ts`)
- `next-auth` - Authentication with JWT strategy (`lib/auth.ts`)
- `stripe` - Payment processing (`lib/services/stripe.service.ts`)
- `bullmq` ^5.3.0 - Job queue for async processing (`lib/utils/queue.ts`)
- `ioredis` ^5.3.2 - Redis client for queue backend

**Infrastructure:**
- `@vercel/postgres` ^0.5.0 - PostgreSQL pooling support
- `zod` - Schema validation (`app/api/customers/route.ts`)
- `sonner` - Toast notifications
- `lucide-react` - Icon library
- `next-themes` - Theme provider

**External Service SDKs:**
- Pipedrive SDK (custom integration) - `lib/services/pipedrive.service.ts`
- QuickBooks SDK - `lib/services/quickbooks.service.ts`
- OpenAI SDK (gpt-4) - `lib/services/ai.service.ts`
- DocuSign SDK - `lib/services/docusign.service.ts`
- Twilio SDK - WhatsApp messaging
- Resend - Email service (`lib/services/email.service.ts`)

## Configuration

**Environment:**
- `.env.local` for local development (gitignored)
- `.env` for base configuration (contains secrets - should be gitignored)
- Required vars: Database, API keys, OAuth credentials, webhook secrets
- See `.env` for complete list (87+ environment variables)

**Build:**
- `tsconfig.json` - TypeScript compiler options
- `next.config.js` - Next.js configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `prisma/schema.prisma` - Database schema

## Platform Requirements

**Development:**
- macOS/Linux/Windows
- Node.js 20+
- PostgreSQL database (Neon)
- Redis instance (for BullMQ)
- No Docker required

**Production:**
- Vercel Serverless Functions (Next.js deployment)
- Neon PostgreSQL (Serverless)
- Redis (Upstash or similar)
- Environment variables configured in Vercel dashboard

---

*Stack analysis: 2026-01-09*
*Update after major dependency changes*
