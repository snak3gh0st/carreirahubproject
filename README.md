# Carreira AI Hub

> Proprietary middleware system that replaces expensive No-Code/SaaS tools, centralizing lead management, sales, and operations into a single source of truth (SSOT).

[![Next.js](https://img.shields.io/badge/Next.js-14+-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-336791?style=flat-square&logo=postgresql)](https://neon.tech/)

## 🎯 Project Overview

Carreira AI Hub eliminates "data blindness" and reduces operational expenses by 66% (~$17.6k/month savings) for Carreira U.S.A. by replacing fragile N8N automations with robust API-driven workflows in pure code.

**Core Philosophy**: 
- Replace No-Code/SaaS sprawl with centralized API routes
- Eliminate duplicate customer data through the Identity Mapper pattern
- Single source of truth across CRM, finance, and operations

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL database (Neon recommended)
- Redis instance (for BullMQ)
- QuickBooks developer account
- OpenAI API key (optional, for AI features)

### Installation

```bash
# Clone the repository
git clone https://github.com/snak3gh0st/carreirahubproject.git
cd carreirahubproject

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Generate Prisma Client
npm run db:generate

# Push database schema (development)
npm run db:push

# Create database views for analytics
npm run db:views

# Create a test user
npm run user:create

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to access the application.

## 🏗️ Technology Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 14+ (App Router) |
| **Language** | TypeScript (strict mode) |
| **Database** | PostgreSQL (Neon) |
| **ORM** | Prisma |
| **Queue** | BullMQ + Redis |
| **Auth** | NextAuth.js (JWT) |
| **Deployment** | Vercel Serverless |
| **AI** | OpenAI GPT-4 |

### Integrations

- **Pipedrive** - CRM and lead management
- **QuickBooks** - Financial operations and invoicing
- **Stripe** - Payment processing
- **DocuSign** - Contract generation and signing
- **Twilio** - WhatsApp messaging
- **OpenAI** - AI-powered chatbot and lead qualification

## 📁 Project Structure

```
carreirahubproject/
├── app/
│   ├── api/              # API routes (Next.js App Router)
│   │   ├── auth/         # NextAuth endpoints
│   │   ├── chat/         # AI chatbot
│   │   ├── invoices/     # Invoice CRUD
│   │   ├── webhooks/     # External service webhooks
│   │   │   ├── pipedrive/
│   │   │   ├── quickbooks/
│   │   │   └── whatsapp/
│   │   └── cron/         # Scheduled jobs
│   └── dashboard/        # Dashboard UI
├── lib/
│   ├── services/         # Business logic layer
│   │   ├── ai.service.ts
│   │   ├── quickbooks.service.ts
│   │   ├── pipedrive.service.ts
│   │   ├── invoice-workflow.service.ts
│   │   ├── identity-mapper.ts
│   │   └── ...
│   ├── utils/            # Utilities and helpers
│   └── auth.ts           # NextAuth configuration
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── migrations/       # Database migrations
├── scripts/              # Utility scripts
└── components/           # React components
```

## 🔑 Key Features

### 1. Identity Mapper (Customer Deduplication)

**Critical Rule**: Email is the unique key across all systems.

```typescript
import { identityMapper } from "@/lib/services/identity-mapper";

const customer = await identityMapper.reconcileCustomer({
  email: "user@example.com",
  name: "John Doe",
  externalIds: {
    pipedrive_id: 123,
    quickbooks_id: "QB456"
  }
});
```

Reconciles customer data from:
- Pipedrive (CRM)
- QuickBooks (Finance)
- Stripe (Payments)
- Trello, CloudTalk, Google Contacts

### 2. Automated Lead Qualification

AI-powered lead scoring using GPT-4:

```typescript
const qualification = await aiService.qualifyLead(leadId);
// Returns score 0-100 based on: interest, budget, timeline, motivation, profile fit
```

- Threshold: ≥70 = QUALIFIED
- Triggers: WhatsApp message automation
- Escalation: Auto-escalates complex conversations to human SDR

### 3. Invoice Workflow Automation

**Pipedrive Deal Won** → Automatic invoice creation:

1. Webhook receives deal data
2. Reconcile customer via Identity Mapper
3. Create Deal in database
4. Generate invoice in QuickBooks with email delivery
5. Create DocuSign contract (7-minute delay)
6. Create Stripe customer (if configured)

**Email Delivery**: Two-step QuickBooks process
1. Create invoice with `BillEmail.Address`
2. Call `/send` endpoint to deliver email

### 4. Role-Based Access Control

NextAuth.js roles:
- `ADMIN` - Full system access
- `SALES` - Deal and invoice management
- `SDR` - Lead qualification
- `FINANCE` - Invoice and payment oversight
- `SUPPORT` - Customer support
- `OPERATIONAL` - Operations management

## 🛠️ Available Scripts

### Development

```bash
npm run dev                    # Start Next.js dev server on :3000
npm run lint                   # Run ESLint
```

### Database

```bash
npm run db:generate            # Generate Prisma Client after schema changes
npm run db:push                # Push schema changes to database (development)
npm run db:migrate             # Create and run migrations (production)
npm run db:studio              # Open Prisma Studio GUI
npm run db:views               # Create SQL views for analytics/BI
npm run db:seed                # Seed database with test data
npm run db:clear               # Clear all database data (destructive)
```

### Testing

```bash
npm run test:quickbooks        # Test QuickBooks integration
npm run test:workflow          # Test invoice workflow services
npm run test:docusign          # Test DocuSign integration
npm run test:system            # Comprehensive system test
```

### User Management

```bash
npm run user:create            # Create test user
npm run user:list              # List all users
npm run user:delete            # Delete user
npm run user:password          # Change user password
```

### Production

```bash
npm run build                  # Build for production (runs db:generate first)
npm start                      # Start production server
```

## 🔐 Environment Variables

Create a `.env` file with the following variables:

### Required

```bash
# Database
POSTGRES_PRISMA_URL=           # Neon pooled connection
POSTGRES_URL_NON_POOLING=      # Neon direct connection (migrations)

# Redis (for BullMQ)
REDIS_URL=                     # Redis connection string

# NextAuth
NEXTAUTH_SECRET=               # JWT signing secret
NEXTAUTH_URL=                  # App URL (http://localhost:3000 in dev)
```

### Optional (for full functionality)

```bash
# OpenAI (for chatbot and lead qualification)
OPENAI_API_KEY=                # GPT-4 API key
AI_MODEL=gpt-4-turbo-preview   # Model to use
AI_TEMPERATURE=0.7             # Temperature setting

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

# SDR Configuration
SDR_QUALIFICATION_THRESHOLD=70 # Min score for qualified leads
```

## 📊 Database Views for Analytics

Run `npm run db:views` to create materialized views:

- `lead_conversion_funnel` - Lead status distribution
- `sdr_performance` - SDR metrics (qualified leads, avg score)
- `ai_chat_metrics` - Chatbot performance
- `lead_source_performance` - Conversion by lead source
- `customer_lifetime_value` - Customer LTV and payment status
- `cac_by_channel` - Cost per acquisition by channel
- `overdue_invoices` - Overdue invoice tracking
- `tech_cost_per_student` - OPEX per student

## 🔄 Key Workflows

### Lead Qualification Flow

1. **Lead Creation** - Lead enters system (webhook or manual)
2. **Conversation Gathering** - System retrieves chat messages
3. **AI Qualification** - `aiService.qualifyLead()` scores 0-100
4. **Threshold Check** - If score ≥70, lead is QUALIFIED
5. **Automation** - Qualified leads trigger WhatsApp message
6. **Human Handoff** - Unqualified leads assigned to human SDR

### Invoice Creation Flow

1. **Deal Won Webhook** - Pipedrive notifies of closed deal
2. **Customer Reconciliation** - Identity Mapper deduplicates
3. **Invoice Generation** - Creates invoice in QuickBooks
4. **Email Delivery** - Calls QuickBooks `/send` endpoint
5. **Contract Generation** - DocuSign contract (7-min delay)
6. **Payment Setup** - Stripe customer creation

## 🚨 Important Notes

- **Path Alias**: Use `@/` for imports (maps to project root)
- **Prisma Client**: Always run `npm run db:generate` after schema changes
- **Queue Workers**: Don't run in Vercel - use cron jobs or API-triggered processing
- **Error Handling**: All external API calls logged to `IntegrationLog` table
- **QuickBooks Tokens**: Stored in database (`SystemConfig` table), auto-refreshed

## 🧪 Testing Integrations

### QuickBooks

```bash
npm run test:quickbooks
```

Tests OAuth, customer sync, and invoice creation.

### Invoice Email Sending

```bash
npx tsx scripts/test-invoice-email.ts
```

Verifies:
- Customer email sync to QuickBooks
- Invoice creation with `BillEmail.Address`
- Email delivery via `/send` endpoint
- DeliveryInfo confirmation

## 📝 Development Workflow

1. **Schema Changes**: 
   ```bash
   # Edit prisma/schema.prisma
   npm run db:generate
   npm run db:push  # dev
   # OR
   npm run db:migrate  # production
   ```

2. **New API Route**: 
   - Create `app/api/[route]/route.ts`
   - Export GET/POST/PATCH/DELETE functions

3. **New Service**: 
   - Create `lib/services/[name].service.ts`
   - Export as singleton class instance

4. **Integration Logs**: 
   - Always create `IntegrationLog` entries for external API calls

## 🤝 Contributing

This is a proprietary project for Carreira U.S.A. Please contact the development team for contribution guidelines.

## 📄 License

Proprietary - All rights reserved by Carreira U.S.A.

## 🔗 Links

- **GitHub**: [https://github.com/snak3gh0st/carreirahubproject](https://github.com/snak3gh0st/carreirahubproject)
- **Company**: Carreira U.S.A.

---

**Built with ❤️ for Carreira U.S.A. - Empowering careers in America**
