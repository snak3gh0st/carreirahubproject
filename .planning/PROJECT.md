# Carreira AI Hub - Finance Integration Sprint

## What This Is

Carreira AI Hub is a proprietary middleware system that replaces expensive No-Code/SaaS tools for Carreira U.S.A. This Sprint 1 focuses exclusively on building rock-solid Finance department workflows by integrating QuickBooks (accounting), Stripe (payments), and DocuSign (contracts) into one unified, reliable automation platform.

## Core Value

Complete Finance workflow automation — seamless integration between QuickBooks, Stripe, and DocuSign to handle invoicing, payments, and contracts without manual data entry or lost transactions.

## Requirements

### Validated

<!-- Existing Finance capabilities -->

- ✓ QuickBooks OAuth integration — working (Phase 1.1 complete)
- ✓ QuickBooks invoice sync (up to 5000 invoices) — working
- ✓ QuickBooks customer sync — working
- ✓ Authentication system with password hashing (bcryptjs) — working
- ✓ Logout functionality in dashboard — working
- ✓ Service layer architecture with finance services — existing
- ✓ BullMQ queue system for async processing — existing
- ✓ Integration logging system (IntegrationLog table) — existing
- ✓ NextAuth.js authentication with RBAC (FINANCE role) — existing
- ✓ API-first design with REST endpoints — existing
- ✓ Webhook signature validation for security — existing

### Active

<!-- Sprint 1: Finance Integration Foundation -->

- [x] QuickBooks Integration (Phase 1 - Complete)
  - QuickBooks OAuth flow working
  - Invoice sync with pagination (5000 invoices)
  - Customer sync working
  - Payment sync capability
  - Authentication system with bcryptjs
  - Admin dashboard with logout

- [ ] Stripe Integration (Phase 2)
  - Stripe API authentication and setup
  - Customer creation and sync with QuickBooks
  - Payment processing (one-time and recurring)
  - Webhook handling for payment events
  - Payment → QuickBooks invoice sync
  - Subscription management
  - Failed payment handling and retry logic

- [ ] DocuSign Integration (Phase 3)
  - DocuSign API authentication (JWT/OAuth)
  - Contract template setup and management
  - Contract generation from deal data
  - Signature workflow automation
  - Document storage and retrieval
  - Webhook handling for signature events
  - Contract signed → QuickBooks update

- [ ] Finance Workflow Automation (Phase 4)
  - End-to-end Deal → Invoice → Payment → Contract flow
  - Customer data consistency across all 3 systems
  - Automated invoice generation when deal is won
  - Contract generation upon payment received
  - Payment tracking and QuickBooks sync
  - Finance department dashboard for monitoring
  - Error handling and manual intervention UI

### Out of Scope (Sprint 1)

- Pipedrive CRM integration — deferred to Sprint 2
- Twilio WhatsApp integration — deferred to Sprint 2
- OpenAI chatbot and lead qualification — deferred to Sprint 2
- Sales and SDR workflows — Sprint 1 is Finance-only
- Major UI/dashboard overhaul — minimal Finance dashboard is acceptable
- Migration away from Vercel (must work within serverless constraints) — constraint
- Real-time features or WebSocket implementation — not critical for Finance workflows
- Multi-tenant architecture — single tenant system for Carreira U.S.A.

## Context

**Problem:** The Finance department currently handles invoicing, payments, and contracts manually across three separate systems (QuickBooks, Stripe, DocuSign). This causes:
- Manual data entry leading to errors and delays
- Customer data inconsistency across systems
- Lost or delayed payments due to lack of automation
- Contract generation bottleneck for signed deals
- No unified view of customer financial status

**Business Impact:** Manual Finance workflows waste time, delay revenue collection, and create data inconsistencies. Automating QuickBooks, Stripe, and DocuSign integration will:
- Eliminate manual invoice/contract creation (save ~10 hours/week)
- Accelerate payment collection with automated follow-up
- Ensure customer data consistency across financial systems
- Provide real-time financial visibility for decision making

**Sprint 1 Goal:** Build the foundation for automated Finance workflows by connecting QuickBooks, Stripe, and DocuSign into one seamless system.

**Technical Environment:**
- Next.js 14+ with App Router on Vercel serverless
- PostgreSQL (Neon) with Prisma ORM
- Redis for BullMQ queue backend
- 3 Finance integrations: QuickBooks (accounting), Stripe (payments), DocuSign (contracts)
- Webhook-driven architecture for real-time sync
- Stateless serverless functions (10s timeout)

**Current Status:**
- ✅ QuickBooks OAuth working
- ✅ QuickBooks invoice sync (up to 5000 invoices)
- ✅ Authentication system operational
- ⏳ Stripe integration not started
- ⏳ DocuSign integration not started
- ⏳ End-to-end Finance workflow not automated

**Technical Foundation:**
- Webhook signature validation prevents unauthorized events
- Integration logging captures all external API calls
- Service layer architecture for business logic
- Queue system for async processing with retry logic
- Identity Mapper pattern for customer deduplication

## Constraints

- **Platform**: Must stay on Vercel serverless — no long-running workers, 10s function timeout, stateless functions
- **Tech Stack**: Keep existing Next.js, Prisma, BullMQ, Redis stack — no major architectural rewrites
- **Backward Compatibility**: QuickBooks integration must keep working during Stripe/DocuSign additions — zero downtime
- **Budget**: No new paid services — use existing Stripe/DocuSign/QuickBooks plans only
- **Timeline**: Sprint 1 completion target — 4 phases to production-ready Finance automation
- **Scope**: Finance department only — no CRM, Sales, or SDR features in Sprint 1

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Focus Sprint 1 on Finance only (QuickBooks, Stripe, DocuSign) | Finance automation delivers immediate ROI, smaller scope reduces risk | ✅ Approved 2026-01-14 |
| QuickBooks as foundation (Phase 1) | Already working, provides customer/invoice base for other integrations | ✅ Complete |
| Stripe second (Phase 2) | Payment processing is highest priority after invoicing | — Pending |
| DocuSign third (Phase 3) | Contracts follow payment, less time-critical than payment collection | — Pending |
| End-to-end workflow last (Phase 4) | Integrate all 3 systems after each works individually | — Pending |
| Use bcryptjs instead of bcrypt | Vercel serverless compatibility (no native modules) | ✅ Implemented Phase 1.1 |
| Work within Vercel serverless constraints | Existing hosting platform, no migration budget | ✅ Ongoing |
| Customer deduplication via email across all 3 systems | Email is universal identifier for Finance workflows | — Pending |

---
*Last updated: 2026-01-14 — Sprint 1 scope defined (Finance focus)*
