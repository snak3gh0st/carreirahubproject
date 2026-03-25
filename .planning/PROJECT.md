# Carreira AI Hub - Finance Integration Sprint

## What This Is

Carreira AI Hub is a proprietary middleware system that replaces expensive No-Code/SaaS tools for Carreira U.S.A. This Sprint 1 focuses exclusively on building rock-solid Finance department workflows by integrating QuickBooks (accounting) and DocuSign (contracts) into one unified, reliable automation platform.

## Core Value

Complete Finance workflow automation — seamless integration between QuickBooks and DocuSign to handle invoicing and contracts without manual data entry or lost transactions.

## Current Milestone: v1.1 Brand Identity Reskin

**Goal:** Apply the new Carreira USA visual identity across both Admin Dashboard and Client Hub portals — colors, typography, logos, and visual tokens — while preserving all existing layouts and functionality.

**Target features:**
- Design system foundation with new brand tokens (colors, typography, spacing)
- Admin Dashboard reskin (sidebar, header, cards, tables, forms, charts)
- Client Hub reskin (login, dashboard, payment, settings, forms)
- Shared component updates (buttons, badges, inputs, modals)
- Logo and favicon replacement across both portals

## Requirements

### Validated

<!-- Sprint 1 capabilities — all working in production -->

- ✓ QuickBooks OAuth integration — v1.0 Phase 1
- ✓ QuickBooks invoice/customer/payment sync — v1.0 Phase 1
- ✓ Authentication system (bcryptjs) with RBAC — v1.0 Phase 1
- ✓ DocuSign integration (webhooks, templates, S3 storage) — v1.0 Phase 2
- ✓ Finance workflow automation (Deal → Invoice → Contract) — v1.0 Phase 3
- ✓ BI & Analytics dashboard with charts and exports — v1.0 Phase 4
- ✓ DocuSign production JWT auth — v1.0 Phase 5
- ✓ Pipedrive CRM integration — v1.0 Phase 6
- ✓ Professional UI/UX with WCAG AA compliance — v1.0 Phase 9
- ✓ Client Hub with custom JWT auth and bilingual i18n — post-Sprint 1
- ✓ Payment system (QuickBooks Payments card/ACH) — post-Sprint 1
- ✓ PCI compliance hardening — post-Sprint 1
- ✓ Changelog/notification system — post-Sprint 1

### Active

<!-- v1.1: Brand Identity Reskin -->

- [x] Design system with new Carreira USA brand tokens — v1.1 Phase 10
- [ ] Admin Dashboard reskin to new identity
- [ ] Client Hub reskin to new identity
- [ ] Shared components updated with brand tokens
- [ ] Logo/favicon replacement across both portals

### Out of Scope

- New features or functionality — v1.1 is purely visual
- Layout restructuring — existing page layouts are preserved
- New pages or routes — no additions
- Migration away from Vercel — constraint
- Real-time features or WebSocket implementation
- Multi-tenant architecture

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
| Customer deduplication via email across systems | Email is universal identifier for Finance workflows | ✅ Working |
| Brand reskin over full redesign (v1.1) | Preserve working layouts, minimize risk, faster delivery | — v1.1 |
| Blaak (serif display) + Neue Montreal (sans body) | Match official brand identity guidelines | — v1.1 |
| Self-host brand fonts via next/font | OTF files bundled in project, no external font CDN | — v1.1 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-25 — Phase 10 complete (Token & Font Foundation)*
