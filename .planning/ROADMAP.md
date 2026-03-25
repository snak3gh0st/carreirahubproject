# Roadmap: Carreira AI Hub

## Milestones

- ✅ **v1.0 Finance Automation** - Phases 1-9 (shipped 2026-02-04)
- 🚧 **v1.1 Brand Identity Reskin** - Phases 10-12 (in progress)

## Phases

<details>
<summary>✅ v1.0 Finance Automation (Phases 1-9) - SHIPPED 2026-02-04</summary>

- [x] **Phase 1: QuickBooks Foundation** - OAuth, customer sync, invoice sync, payment tracking
- [x] **Phase 1.1: Invoice & Customer Dashboard Enhancement (INSERTED)** - Enhanced UI, graphics, filtering, installment tracking
- [x] **Phase 4.1: Deployment Ready (INSERTED)** - Loading states, pagination, mobile responsiveness for production deployment
- [x] **Phase 2: DocuSign Integration** - Contract generation, signature workflow, document storage
- [x] **Phase 3: Finance Workflow Automation** - End-to-end Deal → Invoice → Contract
- [x] **Phase 4: Insights (BI & Analytics)** - Comprehensive BI dashboard with KPIs, charts, analytics, date filtering, and CSV export
- [x] **Phase 5: DocuSign Production Setup** - Production environment configuration and verification
- [x] **Phase 6: Pipedrive Integration** - Complete CRM integration respecting the whole workflow of the hub
- [x] **Phase 9: Professional UI/UX Enhancement** - Modern design system, enhanced components, polished user experience (completed 2026-02-04, 64 min)

### Phase 1: QuickBooks Foundation ✅ COMPLETE

**Goal**: Establish working QuickBooks integration as the foundation for all Finance workflows.
**Status**: ✅ Complete (2026-01-14)
**Depends on**: Nothing (foundation phase)
**Plans**: 1 plan

Plans:
- [x] 1.1-01: Authentication fix (bcrypt→bcryptjs), invoice pagination, logout button, admin credentials (completed 2026-01-14, 2h 30min)

---

### Phase 1.1: Invoice & Customer Dashboard Enhancement (INSERTED) ✅ COMPLETE

**Goal**: Enhance invoice and customer pages with comprehensive financial information, improved UI/UX with visual graphics, advanced filtering, and complete installment tracking.
**Status**: ✅ Complete (2026-01-14)
**Depends on**: Phase 1
**Plans**: 4 plans

Plans:
- [x] 1.1-01: Customer detail page with financial summary and installment tracking (completed 2026-01-14, 14 min)
- [x] 1.1-02: Invoice page enhancement with customer details (completed 2026-01-14, 16 min)
- [x] 1.1-03: Dashboard graphics and visual indicators with CSS-based charts (completed 2026-01-14, 8 min)
- [x] 1.1-04: Advanced filtering for invoices and customers (completed 2026-01-14, 4 min)

---

### Phase 4.1: Deployment Ready (INSERTED) ✅ COMPLETE

**Goal**: Polish dashboard for production deployment with loading states, pagination, and full mobile responsiveness.
**Status**: ✅ Complete (2026-01-15)
**Depends on**: Phase 1.1
**Plans**: 3 plans

Plans:
- [x] 4.1-01: Payments dashboard with filtering and detail views (completed 2026-01-15, 13 min)
- [x] 4.1-02: Loading states and pagination for Deals and Leads pages (completed 2026-01-15, 5 min)
- [x] 4.1-03: Mobile responsiveness across all dashboard pages (completed 2026-01-15, 17 min)

---

### Phase 2: DocuSign Integration ✅ COMPLETE

**Goal**: Automate contract generation and signature workflow, integrating DocuSign with QuickBooks.
**Status**: ✅ Complete (2026-01-23)
**Depends on**: Phase 1
**Plans**: 4 plans

Plans:
- [x] 02-01: Webhook security (HMAC verification + deduplication) — completed 2026-01-23
- [x] 02-02: Template-based envelope creation (composite templates) — completed 2026-01-23
- [x] 02-03: S3 document storage for signed contracts — completed 2026-01-23
- [x] 02-04: Finance dashboard for contract management — completed 2026-01-23

---

### Phase 3: Finance Workflow Automation ✅ COMPLETE

**Goal**: Integrate QuickBooks and DocuSign into one seamless end-to-end workflow.
**Status**: ✅ Complete (2026-01-15)
**Depends on**: Phases 1, 2
**Plans**: 2 plans

Plans:
- [x] 03-01: End-to-end workflow orchestration with retry logic (completed 2026-01-15)
- [x] 03-02: Customer data consistency and Finance dashboard (completed 2026-01-15)

---

### Phase 4: Insights (BI & Analytics) ✅ COMPLETE

**Goal**: Create comprehensive Business Intelligence dashboard with KPIs, charts, and analytics.
**Status**: ✅ Complete (2026-01-15)
**Depends on**: Phases 1-3
**Plans**: 3 plans

Plans:
- [x] 04-01: BI dashboard infrastructure with Recharts and React Query (completed 2026-01-15)
- [x] 04-02: Financial KPIs and data fetching with interactive charts (completed 2026-01-15)
- [x] 04-03: Date range filtering and CSV export (completed 2026-01-15)

---

### Phase 5: DocuSign Production Setup ✅ COMPLETE

**Goal**: Configure DocuSign production environment with JWT authentication.
**Status**: ✅ Complete (2026-01-29)
**Depends on**: Phase 2
**Plans**: 2 plans

Plans:
- [x] 05-01: Production credentials setup and configuration (completed 2026-01-28)
- [x] 05-02: Automated contract workflow and production verification (completed 2026-01-29)

---

### Phase 6: Pipedrive Integration ✅ COMPLETE

**Goal**: Integrate Pipedrive CRM with the Hub's complete workflow.
**Status**: ✅ Complete (2026-01-29)
**Depends on**: Phase 5
**Plans**: 5 plans

Plans:
- [x] 06-01: Fix backwards webhook workflow and establish lead entry (completed 2026-01-29)
- [x] 06-02: Customer creation sync to QB + Pipedrive (completed 2026-01-29)
- [x] 06-03: Invoice creation → Pipedrive deal update (completed 2026-01-29)
- [x] 06-04: Notification infrastructure and Pipedrive markDealAsWon (completed 2026-01-29)
- [x] 06-05: Contract signed → Deal won integration (completed 2026-01-29)

---

### Phase 9: Professional UI/UX Enhancement ✅ COMPLETE

**Goal**: Transform functional dashboard into a beautiful, professional SaaS-quality interface.
**Status**: ✅ Complete (2026-02-04)
**Depends on**: Phases 1-6
**Plans**: 5 plans

Plans:
- [x] 09-01: Design System Foundation — Colors, typography, spacing tokens (completed 2026-01-29)
- [x] 09-02: Core Component Library — Enhanced buttons, cards, forms, tables (completed 2026-01-29)
- [x] 09-03: Dashboard Page Redesign — Modern layout, KPIs, quick actions (completed 2026-01-29)
- [x] 09-04: Data Pages Enhancement — Professional tables, filters, detail views (completed 2026-01-29)
- [x] 09-05: Advanced UX & Accessibility — Animations, loading states, WCAG AA (completed 2026-02-04)

</details>

---

### 🚧 v1.1 Brand Identity Reskin (In Progress)

**Milestone Goal:** Apply the new Carreira USA visual identity across both portals — colors, typography, logos, and visual tokens — while preserving all existing layouts and functionality.

- [ ] **Phase 10: Token & Font Foundation** - Design system with Carreira USA brand tokens, Blaak/Neue Montreal fonts, and CSS custom property architecture
- [ ] **Phase 11: Portal Shell Reskin** - Admin Dashboard sidebar/components and Client Hub layout/pages migrated to brand tokens, with logo replacement
- [ ] **Phase 12: Chart Rebrand & Brand Polish** - All Recharts charts updated to brand palette, focus rings/badges updated, WCAG AA validated

## Phase Details

### Phase 10: Token & Font Foundation
**Goal**: Every brand color, font, and semantic role is defined in a single source of truth that both portals can consume via CSS custom properties and Tailwind utility classes
**Depends on**: Phase 9
**Requirements**: TKN-01, TKN-02, TKN-03, TKN-04
**Success Criteria** (what must be TRUE):
  1. The five brand colors (Verde, Tangerina, Creme, Caramelo, Cafe com Leite) are available as Tailwind utility classes and CSS custom properties on both portals
  2. Blaak and Neue Montreal fonts load via next/font/local with no Google Fonts network request and no FOUT
  3. Display headings (h1-h3) render in Blaak; body and UI text renders in Neue Montreal across both portals
  4. Tangerina used on a white or Creme background anywhere in the app produces a lint/audit warning — contrast rules are codified before any component work begins
  5. A JS constant file exports all brand hex values so Recharts and other non-CSS consumers can use them without hardcoding
**Plans**: 2 plans
**UI hint**: yes

Plans:
- [x] 10-01-PLAN.md — Create foundation files: font binaries, font definitions, brand constants, CSS token hierarchy
- [ ] 10-02-PLAN.md — Wire infrastructure into codebase: update globals.css, layout.tsx, tailwind.config.ts

### Phase 11: Portal Shell Reskin
**Goal**: Both portals look and feel like Carreira USA — Admin Dashboard sidebar, shared components, Hub layout, Hub login, and logos are all on-brand
**Depends on**: Phase 10
**Requirements**: DASH-01, DASH-02, HUB-01, HUB-02, HUB-03, BRD-01
**Success Criteria** (what must be TRUE):
  1. Admin Dashboard sidebar displays Verde (#2F443F) background with Tangerina active state indicators and the new Carreira USA brand logo
  2. Shared components (Button, Card, StatCard, Badge, Input) produce brand token colors from CSS variables — no hardcoded hex values remain in component files
  3. Every hardcoded hex literal and GOLD constant across all Client Hub files is replaced with token classes — zero inline brand-color styles remain
  4. The Hub layout uses Creme surface backgrounds, Verde text, Tangerina accents, and shows the brand logo in the header
  5. The Hub login page shows a Verde + Creme hero treatment with a Blaak headline and a Tangerina call-to-action button
  6. Favicon and logo assets are replaced with the new Carreira USA brand mark in both portals
**Plans**: TBD
**UI hint**: yes

### Phase 12: Chart Rebrand & Brand Polish
**Goal**: All data visualizations use the Carreira USA palette and every interactive state (focus rings, status badges) meets WCAG AA contrast on brand surfaces
**Depends on**: Phase 11
**Requirements**: DASH-03, BRD-02
**Success Criteria** (what must be TRUE):
  1. All Recharts chart components render using Verde, Tangerina, Cafe com Leite, and Caramelo — zero hardcoded legacy hex values remain in chart files
  2. Chart tooltips use Neue Montreal typography with Creme background and Verde border
  3. Focus rings on interactive elements reflect the brand primary color and pass the 3:1 UI contrast ratio requirement on both portal backgrounds
  4. Status badges (invoice status, contract status, user roles) pass WCAG AA 4.5:1 contrast when rendered on Creme or white surfaces
**Plans**: TBD
**UI hint**: yes

---

## Progress

**Execution Order:**
v1.0 phases execute in numeric order: 1 → 1.1 → 4.1 → 2 → 3 → 4 → 5 → 6 → 9
v1.1 phases execute in numeric order: 10 → 11 → 12

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. QuickBooks Foundation | v1.0 | 1/1 | Complete | 2026-01-14 |
| 1.1. Dashboard Enhancement (INSERTED) | v1.0 | 4/4 | Complete | 2026-01-14 |
| 4.1. Deployment Ready (INSERTED) | v1.0 | 3/3 | Complete | 2026-01-15 |
| 2. DocuSign Integration | v1.0 | 4/4 | Complete | 2026-01-23 |
| 3. Finance Workflow Automation | v1.0 | 2/2 | Complete | 2026-01-15 |
| 4. Insights (BI & Analytics) | v1.0 | 3/3 | Complete | 2026-01-15 |
| 5. DocuSign Production Setup | v1.0 | 2/2 | Complete | 2026-01-29 |
| 6. Pipedrive Integration | v1.0 | 5/5 | Complete | 2026-01-29 |
| 9. Professional UI/UX Enhancement | v1.0 | 5/5 | Complete | 2026-02-04 |
| 10. Token & Font Foundation | v1.1 | 1/2 | In Progress|  |
| 11. Portal Shell Reskin | v1.1 | 0/TBD | Not started | - |
| 12. Chart Rebrand & Brand Polish | v1.1 | 0/TBD | Not started | - |
