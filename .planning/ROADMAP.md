# Roadmap: Carreira AI Hub

## Milestones

- ✅ **v1.0 Finance Automation** - Phases 1-9 (shipped 2026-02-04)
- 🚧 **v1.1 Brand Identity Reskin** - Phases 10-12 (in progress)
- 🚧 **v1.2 Ops Hub — Student Journey Management** - Phases 14-17 (in progress)

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
- [x] 17-01-PLAN.md — SLA constants, sidebar nav, daily action API + page (DAILY-01/02/03)
- [x] 17-02-PLAN.md — Coordinator API + page with React Query polling (COORD-01/02/03/04)

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
- [ ] 17-01-PLAN.md — SLA constants, sidebar nav, daily action API + page (DAILY-01/02/03)
- [ ] 17-02-PLAN.md — Coordinator API + page with React Query polling (COORD-01/02/03/04)

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

### v1.1 Brand Identity Reskin (In Progress)

**Milestone Goal:** Apply the new Carreira USA visual identity across both portals — colors, typography, logos, and visual tokens — while preserving all existing layouts and functionality.

- [x] **Phase 10: Token & Font Foundation** - Design system with Carreira USA brand tokens, Blaak/Neue Montreal fonts, and CSS custom property architecture (completed 2026-03-25)
- [x] **Phase 11: Portal Shell Reskin** - Admin Dashboard sidebar/components and Client Hub layout/pages migrated to brand tokens, with logo replacement (completed 2026-03-25)
- [ ] **Phase 12: Chart Rebrand & Brand Polish** - All Recharts charts updated to brand palette, focus rings/badges updated, WCAG AA validated

---

### v1.2 Ops Hub — Student Journey Management (In Progress)

**Milestone Goal:** Give the Carreira USA support team (Fraenze, Dária, Rafael) a single operational workspace to track every student's journey phase, see what needs action today, log sessions, and manage student data — replacing ClickUp as the team's operational hub.

- [x] **Phase 14: Data Foundation** - Mentorship schema (MentorshipPhase lookup, MentorshipEnrollment, MentorshipSession, PhaseTransition), mentorship.service.ts, enrollment API and form (completed 2026-04-01)
- [x] **Phase 15: Pipeline Board** - Kanban UI with dnd-kit, phase advance, team member filter, overdue and debtor indicators (completed 2026-04-01)
- [x] **Phase 16: Student Profile** - Full student profile page, phase timeline, session log, session log form (completed 2026-04-01)
- [x] **Phase 17: Daily Action View + Coordinator Overview** - Daily checklist with SLA rules, coordinator metrics, debtors list (completed 2026-04-01)
- [ ] **Phase 18: Client Surveys - Intake and NPS Forms** - Client intake surveys and NPS feedback forms

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

Plans:
- [ ] 17-01-PLAN.md — SLA constants, sidebar nav, daily action API + page (DAILY-01/02/03)
- [ ] 17-02-PLAN.md — Coordinator API + page with React Query polling (COORD-01/02/03/04)
**UI hint**: yes

Plans:
- [x] 10-01-PLAN.md — Create foundation files: font binaries, font definitions, brand constants, CSS token hierarchy
- [x] 10-02-PLAN.md — Wire infrastructure into codebase: update globals.css, layout.tsx, tailwind.config.ts

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
**Plans**: 5 plans
**UI hint**: yes

Plans:
- [x] 11-01-PLAN.md — Logo component, favicon, data-portal wiring, dashboard sidebar rebrand, hub layout rebrand
- [x] 11-02-PLAN.md — Shared UI components (Button, Badge, StatCard, Input) gold-* to brand token migration
- [x] 11-03-PLAN.md — Hub login, reset-password, set-password pages: Verde hero treatment
- [x] 11-04-PLAN.md — Hub GOLD elimination batch 1: dashboard, settings, LanguageToggle, forms pages
- [x] 11-05-PLAN.md — Hub GOLD elimination batch 2: status, test, documents pages (completes HUB-01)

### Phase 12: Chart Rebrand & Brand Polish
**Goal**: All data visualizations use the Carreira USA palette and every interactive state (focus rings, status badges) meets WCAG AA contrast on brand surfaces
**Depends on**: Phase 11
**Requirements**: DASH-03, BRD-02
**Success Criteria** (what must be TRUE):
  1. All Recharts chart components render using Verde, Tangerina, Cafe com Leite, and Caramelo — zero hardcoded legacy hex values remain in chart files
  2. Chart tooltips use Neue Montreal typography with Creme background and Verde border
  3. Focus rings on interactive elements reflect the brand primary color and pass the 3:1 UI contrast ratio requirement on both portal backgrounds
  4. Status badges (invoice status, contract status, user roles) pass WCAG AA 4.5:1 contrast when rendered on Creme or white surfaces
**Plans**: 2 plans

Plans:
- [ ] 17-01-PLAN.md — SLA constants, sidebar nav, daily action API + page (DAILY-01/02/03)
- [ ] 17-02-PLAN.md — Coordinator API + page with React Query polling (COORD-01/02/03/04)
**UI hint**: yes

### Phase 13: CEFR English Proficiency Test Engine
**Goal**: Scientifically validated English placement test with randomized question bank (130+ questions across A1-C2 levels), adaptive percentage-based scoring, and no-repeat guarantee per student
**Depends on**: Phase 12
**Requirements**: CEFR-01, CEFR-02, CEFR-03, CEFR-04, CEFR-05, CEFR-06
**Success Criteria** (what must be TRUE):
  1. A question bank of 130+ questions exists across 6 CEFR levels (A1-C2), stored as typed TypeScript constants with unique IDs and skill type tags
  2. Each test generates a unique 25-question subset via Fisher-Yates randomization, and students never see repeated questions across retakes until the bank is exhausted
  3. Scoring uses a percentage-based contiguous pass algorithm (60% threshold per section) that adapts to variable question counts
  4. PlacementTest schema tracks which specific questions were served (questionIds) and total count (questionCount) for auditing and no-repeat tracking
  5. All UI pages and admin displays show dynamic score/questionCount (no hardcoded /25)
  6. No correctIndex or answer key data is ever sent to the client
**Plans**: 3 plans

Plans:
- [x] 13-01-PLAN.md — Question bank types, infrastructure (randomizer + scoring), schema migration, A1/A2 questions
- [x] 13-02-PLAN.md — Question bank content: B1, B2, C1, C2 questions (88+ questions completing the 130+ bank)
- [ ] 13-03-PLAN.md — API route rewrites, test UI integration, admin display updates, i18n

### Phase 14: Data Foundation
**Goal**: The ops team can enroll any existing Customer into a mentorship program and every subsequent student journey event — phase transitions, sessions — is reliably persisted with a full audit trail
**Depends on**: Phase 13
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, ENRL-01, ENRL-02
**Success Criteria** (what must be TRUE):
  1. Ops team member can search for an existing Customer by name or email and enroll them in a mentorship program by selecting program type (Pass/Advanced) and assigned team member
  2. After enrollment, the student's current phase is set to Phase 1 (first of 11 phases) and a PhaseTransition row is written recording who created the enrollment and when
  3. Ops team member can log a session against an enrolled student with session type (from a controlled dropdown), conductor (a User), date, and optional notes — and the session persists immediately
  4. Every phase advance writes a PhaseTransition row with from-phase, to-phase, timestamp, and triggered-by user inside a single database transaction — partial writes never occur
  5. The `/api/ops/*` routes reject requests from users without ADMIN or OPERATIONAL roles with 403; all data is scoped to the authenticated user's role at the query level, not post-filter
**Plans**: 4 plans
**UI hint**: yes

### Phase 15: Pipeline Board
**Goal**: The ops team can see every active student's current phase at a glance on a Kanban board and advance a student's phase from within that view
**Depends on**: Phase 14
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05
**Success Criteria** (what must be TRUE):
  1. All active enrollments appear in a Kanban board with one column per phase — student cards show name, program type badge, phase age in days, and assignee initials
  2. Ops team member can drag a student card to the next valid phase column (or use a phase-advance button) and the transition is recorded atomically with a confirmation step
  3. Applying the "My students" filter hides all cards not assigned to the current user, and the URL reflects the active filter so the view is bookmarkable
  4. Student cards with a phase age exceeding the SLA threshold display a visible overdue indicator (amber or red) distinguishable from cards within SLA
  5. Student cards for customers with an overdue QuickBooks payment balance display a debtor flag badge alongside the student name
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [ ] 15-01-PLAN.md — Pipeline API (GET /api/ops/pipeline) + Advance API (POST /api/ops/enrollments/[id]/advance)
- [ ] 15-02-PLAN.md — Kanban board UI: columns, draggable cards, DragOverlay, overdue indicators, debtor badges, advance dialog
- [ ] 15-03-PLAN.md — "My students" URL filter verification + human-verify checkpoint

### Phase 16: Student Profile
**Goal**: An ops team member clicking on any student in the system sees a complete, chronological record of that student's journey — who they are, where they are in the program, every phase change, and every session
**Depends on**: Phase 15
**Requirements**: PROF-01, PROF-02, PROF-03
**Success Criteria** (what must be TRUE):
  1. Student profile page displays contact info, program type, CEFR English test result, assigned team member, and current phase — all sourced from the Customer and MentorshipEnrollment records
  2. A phase timeline section shows every PhaseTransition in chronological order with the date, from-phase label, to-phase label, and the name of the user who triggered each transition
  3. A session log section shows all sessions for the student in reverse-chronological order — paginated at 20 per page — with session type, conductor name, date, and notes visible per row
  4. The log session form on the profile page accepts a controlled session type, conductor selection, date, and optional notes and adds the new session to the log without a full page reload
**Plans**: 2 plans

Plans:
- [ ] 17-01-PLAN.md — SLA constants, sidebar nav, daily action API + page (DAILY-01/02/03)
- [ ] 17-02-PLAN.md — Coordinator API + page with React Query polling (COORD-01/02/03/04)
**UI hint**: yes

### Phase 17: Daily Action View + Coordinator Overview
**Goal**: Each ops team member starts the day knowing exactly which students need attention, and the coordinator can see the state of the entire program in one view
**Depends on**: Phase 16
**Requirements**: DAILY-01, DAILY-02, DAILY-03, COORD-01, COORD-02, COORD-03, COORD-04
**Success Criteria** (what must be TRUE):
  1. Daily action view shows only students assigned to the current user and automatically flags students whose phase SLA expires within 2 days or who have had no session in the past 7 days
  2. Each flagged student entry in the daily view shows the reason for the flag (SLA expiring or no recent session), the number of days remaining or overdue, and a direct link to the student profile
  3. Coordinator role sees the daily action view without the per-user scope filter — all flagged students across all team members appear in a single list
  4. Coordinator metrics screen shows a count of active students per phase (phase distribution), and two lists: students with no session in the past 7 days and students with overdue QB payment balances
  5. Phase distribution count updates without a manual page refresh — React Query polling keeps the coordinator view current within 60 seconds
**Plans**: 2 plans

Plans:
- [ ] 17-01-PLAN.md — SLA constants, sidebar nav, daily action API + page (DAILY-01/02/03)
- [ ] 17-02-PLAN.md — Coordinator API + page with React Query polling (COORD-01/02/03/04)
**UI hint**: yes

### Phase 18: Client Surveys - Intake and NPS Forms

**Goal:** Extend the existing form system so intake surveys are auto-assigned at enrollment, ops can manage intake/NPS forms from the student profile, and NPS entry/exit feedback is visible in the Ops Hub without cross-portal navigation
**Requirements**: SURV-01, SURV-02, SURV-03, SURV-04
**Depends on:** Phase 17
**Success Criteria** (what must be TRUE):
  1. `FORM_TEMPLATES` includes `nps-entry` and `nps-exit` using the existing `scale` field type and a shared `npsScore` field contract
  2. `mentorshipService.createEnrollment()` auto-assigns the correct onboarding form (`onboarding-pass` or `onboarding-career`) and prevents duplicate non-completed intake assignments
  3. `/ops/students/[enrollmentId]` shows a Forms section with current assignments, statuses, and an inline assign action that stays inside the Ops portal
  4. Completed NPS entry/exit submissions surface on the student profile so coordinators can see scores without opening the Dashboard portal
**Plans:** 1/3 plans executed

Plans:
- [x] 18-01-PLAN.md — Add NPS templates, shared score constants, and Hub PT/EN rendering support
- [ ] 18-02-PLAN.md — Auto-assign intake on enrollment and add ops form assignment/data APIs
- [ ] 18-03-PLAN.md — Extend the student profile with Forms section and NPS visibility
**UI hint**: yes

---

## Progress

**Execution Order:**
v1.0 phases execute in numeric order: 1 → 1.1 → 4.1 → 2 → 3 → 4 → 5 → 6 → 9
v1.1 phases execute in numeric order: 10 → 11 → 12
v1.2 phases execute in numeric order: 14 → 15 → 16 → 17 → 18

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
| 10. Token & Font Foundation | v1.1 | 2/2 | Complete | 2026-03-25 |
| 11. Portal Shell Reskin | v1.1 | 5/5 | Complete | 2026-03-25 |
| 12. Chart Rebrand & Brand Polish | v1.1 | 0/TBD | Not started | - |
| 13. CEFR English Proficiency Test Engine | - | 2/3 | In progress | - |
| 14. Data Foundation | v1.2 | 4/4 | Complete    | 2026-04-01 |
| 15. Pipeline Board | v1.2 | 3/3 | Complete    | 2026-04-01 |
| 16. Student Profile | v1.2 | 2/3 | Complete    | 2026-04-02 |
| 17. Daily Action View + Coordinator Overview | v1.2 | 2/2 | Complete    | 2026-04-01 |
| 18. Client Surveys - Intake and NPS Forms | v1.2 | 1/3 | In Progress|  |
