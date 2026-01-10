# Carreira AI Hub - Reliability & Stability Enhancement

## What This Is

Carreira AI Hub is a proprietary middleware system that replaces expensive No-Code/SaaS tools for Carreira U.S.A. The system centralizes lead management, sales, and operations into a single source of truth (SSOT), integrating Pipedrive (CRM), QuickBooks (Finance), Stripe (Payments), DocuSign (Contracts), Twilio (WhatsApp), and OpenAI (AI) into one reliable automation platform. This project focuses on making the existing system rock-solid through comprehensive reliability and stability improvements.

## Core Value

Zero lost webhooks — every Pipedrive, QuickBooks, Stripe, DocuSign, and Twilio event must be captured and processed reliably with proper retry, recovery, and monitoring.

## Requirements

### Validated

<!-- Existing capabilities inferred from codebase -->

- ✓ Webhook-driven automation (Pipedrive, QuickBooks, Stripe, DocuSign, Twilio) — existing
- ✓ Identity Mapper pattern for customer deduplication across all systems — existing
- ✓ Service layer architecture with 17+ domain services — existing
- ✓ BullMQ queue system for async processing (6 queues: leadQualification, whatsappMessages, pipedriveSync, invoiceGeneration, contractGeneration, quickbooksSync) — existing
- ✓ Integration logging system (IntegrationLog table) — existing
- ✓ NextAuth.js authentication with RBAC (7 roles: ADMIN, SALES, SDR, FINANCE, SUPPORT, OPERATIONAL, COMMERCIAL) — existing
- ✓ AI chatbot for customer service with automatic escalation — existing
- ✓ AI-powered lead qualification (0-100 scoring) — existing
- ✓ API-first design with REST endpoints — existing
- ✓ Webhook signature validation for security — existing

### Active

<!-- Current scope: reliability and stability improvements -->

- [ ] Webhook failure prevention and recovery
  - Implement webhook retry logic with exponential backoff
  - Add dead letter queue for failed webhooks
  - Implement webhook event deduplication
  - Add webhook health monitoring and alerting

- [ ] Integration error handling improvements
  - Implement circuit breaker pattern for external API calls
  - Add graceful degradation when external services are down
  - Improve error logging with structured context
  - Add automatic retry with backoff for transient failures

- [ ] Queue processing reliability in Vercel environment
  - Fix BullMQ worker compatibility with Vercel serverless
  - Implement robust cron-based queue processing
  - Add queue monitoring and stale job detection
  - Implement job timeout handling and cleanup

- [ ] Production-ready authentication
  - Implement password hashing with bcrypt
  - Remove development password bypass
  - Add QuickBooks OAuth token refresh UI
  - Implement session expiration handling
  - Add OAuth token refresh automation

- [ ] Monitoring and observability
  - Add health check endpoints for all critical systems
  - Implement webhook delivery status dashboard
  - Add integration error rate tracking
  - Create alerting for system failures

- [ ] Performance and UX improvements
  - Optimize database queries with indexes
  - Improve API response times
  - Enhance error messages for user-facing endpoints
  - Add loading states and graceful error handling

### Out of Scope

- New external integrations (focus on existing Pipedrive, QuickBooks, Stripe, DocuSign, Twilio) — strengthen what exists first
- Major UI/dashboard overhaul (minimal dashboard is acceptable) — API reliability is priority
- Migration away from Vercel (must work within serverless constraints) — constraint
- Real-time features or WebSocket implementation — not critical for reliability
- Multi-tenant architecture — single tenant system for Carreira U.S.A.

## Context

**Problem:** The existing middleware system has foundational reliability issues that risk data loss and operational disruptions:
- Webhooks can fail without retry, causing lost leads/deals/payments
- External API errors can cascade and break workflows
- BullMQ workers don't run properly on Vercel serverless
- Authentication has development shortcuts that aren't production-ready
- No monitoring or alerting when critical systems fail

**Business Impact:** Each lost webhook represents a lost lead, deal, payment, or customer record. Unreliable integrations mean manual data entry, duplicate customers, and "data blindness" that the system was built to eliminate. Current OPEX savings of $17.6k/month are at risk if the system isn't reliable.

**Technical Environment:**
- Next.js 14+ with App Router on Vercel serverless
- PostgreSQL (Neon) with Prisma ORM
- Redis for BullMQ queue backend
- 6 external integrations with webhooks
- Webhook-driven architecture (not polling)
- Stateless serverless functions (10s timeout)

**Known Technical Debt:**
- Password authentication bypasses validation in development (CLAUDE.md:138)
- Some queue workers have placeholder implementations (CLAUDE.md:333)
- BullMQ workers don't run on Vercel (CLAUDE.md:334)
- QuickBooks OAuth tokens need manual refresh (CLAUDE.md:335)
- No structured monitoring or alerting system
- Integration error logging exists but no analysis or alerting

**Current Reliability Mechanisms:**
- Webhook signature validation prevents unauthorized events
- Integration logging captures all external API calls
- Prisma transactions for data consistency
- Queue jobs have retry configuration (needs verification)

## Constraints

- **Platform**: Must stay on Vercel serverless — no long-running workers, 10s function timeout, stateless functions
- **Tech Stack**: Keep existing Next.js, Prisma, BullMQ, Redis stack — no major architectural rewrites
- **Backward Compatibility**: Existing webhooks and integrations must keep working during improvements — zero downtime
- **Budget**: No new paid services for monitoring (use existing or open-source) — cost-conscious
- **Timeline**: No specific deadline, but stability is blocking production confidence — ship incrementally

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Core value is "zero lost webhooks" | Every webhook represents business-critical data (leads, deals, payments) that cannot be lost | — Pending |
| Focus on reliability before performance | System must be stable before optimizing speed | — Pending |
| Work within Vercel serverless constraints | Existing hosting platform, no migration budget | — Pending |
| Implement webhook retry and dead letter queue | Critical pattern for zero data loss | — Pending |
| Add circuit breaker pattern for external APIs | Prevent cascading failures when integrations are down | — Pending |
| Fix BullMQ in Vercel via cron-based processing | Workers don't run in serverless, need polling workaround | — Pending |
| Implement password hashing before production | Security requirement, remove dev shortcuts | — Pending |

---
*Last updated: 2026-01-10 after initialization*
