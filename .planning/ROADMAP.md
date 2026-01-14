# Roadmap: Carreira AI Hub - Reliability & Stability Enhancement

## Overview

Transform the existing middleware system from fragile to rock-solid through four focused reliability phases. Starting with webhook reliability (zero lost events), moving through integration resilience (circuit breakers and graceful degradation), fixing queue processing for Vercel serverless constraints, and concluding with production-ready authentication. Each phase delivers immediate reliability improvements while maintaining backward compatibility with all existing integrations (Pipedrive, QuickBooks, Stripe, DocuSign, Twilio).

## Domain Expertise

None

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Webhook Reliability** - Zero lost webhooks with retry and recovery
- [ ] **Phase 1.1: Make QuickBooks Work (INSERTED)** - Fix OAuth and sync validation
- [x] **Phase 2: Integration Resilience** - Circuit breakers and graceful degradation
- [x] **Phase 3: Queue Processing** - Fix BullMQ in Vercel with robust cron processing
- [x] **Phase 4: Production Auth** - Password hashing and OAuth token management

## Phase Details

### Phase 1: Webhook Reliability
**Goal**: Implement comprehensive webhook failure prevention and recovery mechanisms to ensure zero lost events from Pipedrive, QuickBooks, Stripe, DocuSign, and Twilio.

**Depends on**: Nothing (first phase)

**Research**: Likely (implementing webhook retry patterns in Vercel serverless)

**Research topics**: Dead letter queue patterns for serverless, webhook deduplication strategies, retry with exponential backoff in Next.js

**Plans**: 3 plans

Plans:
- [x] 01-01: Webhook retry logic with exponential backoff and dead letter queue (completed 2026-01-10, 45min)
- [x] 01-02: Webhook event deduplication to prevent duplicate processing (completed 2026-01-10, 35min)
- [x] 01-03: Webhook health monitoring dashboard and alerting system (completed 2026-01-11, 42min)

### Phase 1.1: Make QuickBooks Work (INSERTED)

**Goal**: Fix QuickBooks OAuth flow and ensure complete data synchronization works end-to-end.

**Depends on**: Phase 1

**Research**: Unlikely (OAuth CORS fix and validation)

**Plans**: 1 plan

Plans:
- [x] 1.1-01: Authentication fix (bcrypt→bcryptjs), invoice pagination, logout button, admin credentials (completed 2026-01-14, 2h 30min)

**Details:**
- ✅ Fixed authentication - replaced bcrypt with bcryptjs for Vercel compatibility
- ✅ Fixed invoice pagination - now syncs up to 5000 invoices
- ✅ Added logout button to dashboard (desktop & mobile)
- ✅ Created admin credentials and validated login flow
- ✅ OAuth CORS fix already working (from Phase 4.1)
- ✅ Webhook verifier token configured

### Phase 2: Integration Resilience
**Goal**: Implement circuit breaker pattern and graceful degradation for all external API calls to prevent cascading failures when integrations are temporarily down.

**Depends on**: Phase 1.1

**Research**: Likely (circuit breaker implementation for external APIs)

**Research topics**: Circuit breaker pattern for Node.js, graceful degradation patterns, structured error logging best practices

**Plans**: 2 plans

Plans:
- [x] 02-01: Circuit breaker pattern for external API calls (Pipedrive, QuickBooks, Stripe, DocuSign, Twilio, RetellAI, OpenAI, Resend) — completed 2026-01-11, 37min
- [x] 02-02: Graceful degradation and improved error logging with structured context — completed 2026-01-11, 43min

### Phase 3: Queue Processing
**Goal**: Fix BullMQ worker compatibility with Vercel serverless through robust cron-based queue processing with monitoring and stale job cleanup.

**Depends on**: Phase 2

**Research**: Likely (BullMQ compatibility with Vercel serverless)

**Research topics**: BullMQ in serverless environments, cron-based queue processing patterns, job timeout handling in Vercel

**Plans**: 2 plans

Plans:
- [x] 03-01: Implement robust cron-based queue processing for all 9 queues (completed 2026-01-11, 45min)
- [x] 03-02: Queue monitoring, stale job detection, and timeout handling (completed 2026-01-11, 42min)

### Phase 4: Production Auth
**Goal**: Remove development shortcuts and implement production-ready authentication with password hashing, QuickBooks OAuth token refresh UI, and session expiration handling.

**Depends on**: Phase 3

**Research**: Unlikely (standard bcrypt implementation and OAuth patterns)

**Plans**: 2 plans

Plans:
- [x] 04-01: Implement password hashing with bcrypt and remove development bypass (completed 2026-01-11, 38min)
- [x] 04-02: QuickBooks OAuth token refresh UI and automated token refresh (completed 2026-01-11, 28min)

### Phase 4.1: User Deployment - Dashboard & QuickBooks Data Validation (INSERTED)

**Goal**: Prepare system for user deployment by improving dashboard layout/UX and validating all required QuickBooks data fields are captured and displayed for Commercial, Admin, and Finance departments.

**Depends on**: Phase 4

**Research**: Likely (audit QuickBooks sync completeness, review dashboard data requirements by department)

**Research topics**: QuickBooks field completeness, multi-department dashboard requirements, layout and UX improvements, data validation for critical fields

**Plans**: To be determined — run `/gsd:plan-phase 4.1` to break down

Plans:
- [ ] TBD (run `/gsd:plan-phase 4.1` to break down work)

**Details:**
- Review current dashboard layout and UX
- Audit QuickBooks data sync: verify all required fields are captured (customers, invoices, payments, accounts, etc.)
- Validate data completeness for Finance department workflows
- Ensure Admin department has access to configuration and monitoring
- Ensure Commercial department has proper sales/deal visibility
- Design improved layout for multi-department access
- Deploy-ready validation checklist

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 1.1 → 2 → 3 → 4 → 4.1

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Webhook Reliability | 3/3 | Complete | 2026-01-11 |
| 1.1. Make QuickBooks Work (INSERTED) | 1/1 | Complete | 2026-01-14 |
| 2. Integration Resilience | 2/2 | Complete | 2026-01-11 |
| 3. Queue Processing | 2/2 | Complete | 2026-01-11 |
| 4. Production Auth | 2/2 | Complete | 2026-01-11 |
| 4.1. User Deployment (INSERTED) | 0/? | Not planned | — |

**Status:** 5 phases complete, 1 urgent insertion remaining (User deployment readiness)
