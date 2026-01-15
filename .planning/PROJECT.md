# Carreira AI Hub - Finance Integration Sprint

## What This Is

Carreira AI Hub is a proprietary middleware system that replaces expensive No-Code/SaaS tools for Carreira U.S.A. This Sprint 1 focuses exclusively on building rock-solid Finance department workflows by integrating QuickBooks (accounting) and DocuSign (contracts) into one unified, reliable automation platform.

## Core Value

Complete Finance workflow automation — seamless integration between QuickBooks and DocuSign to handle invoicing and contracts without manual data entry or lost transactions.

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

- [ ] DocuSign Integration (Phase 2)
  - DocuSign API authentication (JWT/OAuth)
  - Contract template setup and management
  - Contract generation from deal data
  - Signature workflow automation
  - Document storage and retrieval
  - Webhook handling for signature events
  - Contract signed → QuickBooks update

- [ ] Finance Workflow Automation (Phase 3)
  - End-to-end Deal → Invoice → Contract flow
  - Customer data consistency across QuickBooks and DocuSign
  - Automated invoice generation when deal is won
  - Contract generation when invoice is paid
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

**Problem:** The Finance department currently handles invoicing and contracts manually across two separate systems (QuickBooks, DocuSign). This causes:
- Manual data entry leading to errors and delays
- Customer data inconsistency across systems
- Contract generation bottleneck for signed deals
- No unified view of customer financial status

**Business Impact:** Manual Finance workflows waste time and create data inconsistencies. Automating QuickBooks and DocuSign integration will:
- Eliminate manual invoice/contract creation (save ~10 hours/week)
- Ensure customer data consistency across financial systems
- Provide real-time financial visibility for decision making

**Sprint 1 Goal:** Build the foundation for automated Finance workflows by connecting QuickBooks and DocuSign into one seamless system.

**Technical Environment:**
- Next.js 14+ with App Router on Vercel serverless
- PostgreSQL (Neon) with Prisma ORM
- Redis for BullMQ queue backend
- 2 Finance integrations: QuickBooks (accounting), DocuSign (contracts)
- Webhook-driven architecture for real-time sync
- Stateless serverless functions (10s timeout)

**Current Status:**
- ✅ QuickBooks OAuth working
- ✅ QuickBooks invoice sync (up to 5000 invoices)
- ✅ Authentication system operational
- ✅ Dashboard UI polished and production-ready
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
- **Backward Compatibility**: QuickBooks integration must keep working during DocuSign additions — zero downtime
- **Budget**: No new paid services — use existing DocuSign/QuickBooks plans only
- **Timeline**: Sprint 1 completion target — 4 phases to production-ready Finance automation
- **Scope**: Finance department only — no CRM, Sales, or SDR features in Sprint 1

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Focus Sprint 1 on Finance only (QuickBooks, DocuSign) | Finance automation delivers immediate ROI, smaller scope reduces risk | ✅ Approved 2026-01-14 |
| Remove Stripe from Sprint 1 | Payment tracking already handled in QuickBooks, simplifies integration scope | ✅ Approved 2026-01-15 |
| QuickBooks as foundation (Phase 1) | Already working, provides customer/invoice base for other integrations | ✅ Complete |
| DocuSign second (Phase 2) | Contract automation is next priority after invoicing | — Pending |
| End-to-end workflow last (Phase 3) | Integrate QuickBooks and DocuSign after each works individually | — Pending |
| Use bcryptjs instead of bcrypt | Vercel serverless compatibility (no native modules) | ✅ Implemented Phase 1.1 |
| Work within Vercel serverless constraints | Existing hosting platform, no migration budget | ✅ Ongoing |
| Customer deduplication via email across systems | Email is universal identifier for Finance workflows | — Pending |

---
*Last updated: 2026-01-14 — Sprint 1 scope defined (Finance focus)*
