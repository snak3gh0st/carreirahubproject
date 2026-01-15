# Roadmap: v2.0 - QuickBooks Invoice Management

## Overview

Build a robust QuickBooks invoice management system for Carreira U.S.A., focusing exclusively on invoice fetching, creation, and financial visibility through an intuitive dashboard.

**Version:** 2.0 (QuickBooks-Only Focus)

**Goal:** Enable the Finance department to efficiently manage invoices and customers through QuickBooks integration with a polished, production-ready dashboard.

## Domain Expertise

**Primary Domain:** Finance Operations
- QuickBooks OAuth and API integration
- Invoice management (fetch, create, track)
- Customer data synchronization
- Financial dashboard and reporting

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Core sprint work executed in sequence
- Decimal phases (1.1, 2.1): Urgent insertions if needed (marked with INSERTED)

Sprint 1 Phases:
- [x] **Phase 1: QuickBooks Foundation** - OAuth, customer sync, invoice sync, payment tracking
- [x] **Phase 1.1: Invoice & Customer Dashboard Enhancement (INSERTED)** - Enhanced UI, graphics, filtering, installment tracking
- [x] **Phase 4.1: Deployment Ready (INSERTED)** - Loading states, pagination, mobile responsiveness for production deployment
- [ ] **Phase 2: DocuSign Integration** - Contract generation, signature workflow, document storage
- [x] **Phase 3: Finance Workflow Automation** - End-to-end Deal → Invoice → Contract
- [ ] **Phase 4: Insights (BI & Analytics)** - Comprehensive BI dashboard with KPIs, charts, and analytics for invoices and customers

## Phase Details

### Phase 1: QuickBooks Foundation ✅ COMPLETE

**Goal**: Establish working QuickBooks integration as the foundation for all Finance workflows.

**Status**: ✅ Complete (2026-01-14)

**Depends on**: Nothing (foundation phase)

**Research**: Complete

**Plans**: 1 plan

Plans:
- [x] 1.1-01: Authentication fix (bcrypt→bcryptjs), invoice pagination, logout button, admin credentials (completed 2026-01-14, 2h 30min)

**Accomplishments:**
- ✅ QuickBooks OAuth flow working (full page navigation, no CORS issues)
- ✅ Invoice sync with proper pagination (handles up to 5000 invoices)
- ✅ Customer sync working
- ✅ Payment tracking capability
- ✅ Authentication system with bcryptjs (Vercel-compatible)
- ✅ Admin credentials created and tested
- ✅ Logout functionality in dashboard (desktop + mobile)
- ✅ Webhook verifier token configured

**Key Technical Decisions:**
- bcryptjs instead of bcrypt (serverless compatibility)
- Invoice pagination loop for >1000 invoices
- maxResults default: 5000 (configurable)

---

### Phase 1.1: Invoice & Customer Dashboard Enhancement (INSERTED)

**Goal**: Enhance invoice and customer pages with comprehensive financial information, improved UI/UX with visual graphics, advanced filtering, and complete installment tracking.

**Status**: ✅ Complete (4 of 4 plans complete) - Completed 2026-01-14

**Depends on**: Phase 1 (QuickBooks Foundation)

**Research**: Unlikely (UI/UX enhancement of existing functionality)

**Plans**: 4 plans

Plans:
- [x] 1.1-01: Customer detail page with financial summary and installment tracking (completed 2026-01-14, 14 min)
- [x] 1.1-02: Invoice page enhancement with customer details (completed 2026-01-14, 16 min)
- [x] 1.1-03: Dashboard graphics and visual indicators with CSS-based charts (completed 2026-01-14, 8 min)
- [x] 1.1-04: Advanced filtering for invoices and customers (completed 2026-01-14, 4 min)

**Scope:**
- **Invoice Page Enhancements**
  - Display complete invoice information with customer details
  - Show all related customer data (name, email, phone, balance)
  - Link invoices to customer profile
  - Add visual status indicators and graphics
  - Improve layout for better readability

- **Customer Page Enhancements**
  - Display customer financial summary
  - Show installment invoices breakdown:
    - Total invoices
    - Paid invoices (count and amount)
    - Invoices left to pay (count and amount)
    - Overdue invoices (count and amount)
  - List all customer invoices with status
  - Add payment history timeline
  - Visual graphics for payment status

- **Dashboard Graphics & Visualizations**
  - Invoice status distribution charts
  - Payment trends over time
  - Overdue invoices alerts with visual indicators
  - Customer balance summary cards
  - Revenue metrics with graphs

- **Advanced Filtering**
  - Invoice filtering:
    - By status (Paid, Sent, Overdue, etc.)
    - By customer
    - By date range
    - By amount range
    - By payment method
  - Customer filtering:
    - By balance status
    - By payment history
    - By overdue invoices
    - By total invoiced amount
  - Search functionality across all fields

- **System Integration**
  - Wire up installment tracking with QuickBooks data
  - Real-time balance calculations
  - Sync payment status across all views
  - Update customer financial metrics automatically

**Success Criteria:**
- Finance team can view complete customer financial picture in one page
- Invoice page shows all relevant customer information
- Dashboard displays visual graphics for quick insights
- Advanced filtering works across invoices and customers
- Customer page tracks all installments (paid, pending, overdue)
- System automatically updates all financial metrics

---

### Phase 4.1: Deployment Ready (INSERTED) ✅ COMPLETE

**Goal**: Polish dashboard for production deployment with loading states, pagination, and full mobile responsiveness for Finance, Admin, and Commercial teams.

**Status**: ✅ Complete (3 of 3 plans complete) - Completed 2026-01-15

**Depends on**: Phase 1.1 (Dashboard Enhancement)

**Research**: None (UI/UX polish of existing functionality)

**Plans**: 3 plans

Plans:
- [x] 4.1-01: Payments dashboard with filtering and detail views (completed 2026-01-15, 13 min)
- [x] 4.1-02: Loading states and pagination for Deals and Leads pages (completed 2026-01-15, 5 min)
- [x] 4.1-03: Mobile responsiveness across all dashboard pages (completed 2026-01-15, 17 min)

**Scope:**
- **Payments Dashboard**
  - Complete payments list with filtering
  - Payment detail pages
  - Search and pagination
  - QuickBooks payment sync status

- **Loading States & Pagination**
  - Loading skeletons for all data tables
  - Error states with retry functionality
  - Pagination controls (25 items per page)
  - Applied to Deals and Leads pages

- **Mobile Responsiveness**
  - Mobile filter modals for all pages
  - Horizontally scrollable tables on mobile
  - Touch-friendly UI (44x44px minimum targets)
  - Native mobile inputs (date pickers, numeric keyboards)
  - Hidden non-critical columns on small screens
  - Responsive breakpoints: mobile (<768px), tablet (768px+), desktop (1024px+)

**Accomplishments:**
- ✅ Payments dashboard fully functional
- ✅ Loading states across all dashboard pages
- ✅ Pagination handles 5000+ records efficiently
- ✅ Mobile-responsive filters with modal UI
- ✅ Touch-friendly interactions throughout
- ✅ Tables scroll horizontally on mobile without layout breaks
- ✅ Quick filter chips with smooth horizontal scroll
- ✅ Native mobile inputs for better UX
- ✅ User verified mobile experience

**Key Technical Decisions:**
- Mobile filter modal pattern instead of inline collapse
- Horizontal scroll tables instead of card view
- 44x44px minimum touch targets (Apple HIG standard)
- Column hiding strategy for mobile prioritization
- Smooth momentum scrolling for iOS

**Success Criteria:**
- All dashboard pages work on mobile, tablet, and desktop
- Loading states prevent user confusion during data fetch
- Pagination handles large datasets smoothly
- Touch interactions feel native and responsive
- No horizontal page scroll on any viewport
- Finance team can work from any device

---

### Phase 2: DocuSign Integration

**Goal**: Automate contract generation and signature workflow, integrating DocuSign with QuickBooks to track contract status and trigger downstream actions.

**Depends on**: Phase 1 (QuickBooks customer and invoice data needed for contract generation)

**Research**: Likely (DocuSign API, template management, envelope tracking, JWT authentication)

**Research topics**:
- DocuSign authentication (JWT vs OAuth 2.0)
- Template creation and management
- Envelope sending and tracking
- Webhook events for signature completion
- Document storage and retrieval
- Embedded signing vs email signing

**Plans**: To be determined — run `/gsd:plan-phase 2` to break down

Plans:
- [ ] TBD (run `/gsd:plan-phase 2` to break down work)

**Scope:**
- **DocuSign API Setup**
  - Authentication (JWT recommended for server-to-server)
  - Environment configuration (sandbox + production)
  - Account ID and User ID configuration
  - RSA key pair generation for JWT

- **Template Management**
  - Create contract templates in DocuSign
  - Define merge fields (customer name, service, price, dates)
  - Template versioning and updates
  - Template selection logic (different contracts for different services)

- **Contract Generation**
  - Generate contract from template + customer data
  - Populate merge fields from QuickBooks customer + deal data
  - Attach invoice PDF to contract envelope
  - Send contract for signature (email or embedded)

- **Signature Workflow**
  - Single signer workflow (customer only)
  - Multi-signer workflow (customer + guarantor)
  - Signing order enforcement
  - Reminder emails for pending signatures
  - Expiration handling (30 days)

- **Webhook Handling**
  - `envelope-sent` → track in system
  - `envelope-delivered` → log delivery
  - `envelope-completed` → download signed PDF, update QB
  - `envelope-declined` → notify Finance team
  - `envelope-voided` → mark as canceled
  - Deduplication to prevent duplicate processing

- **Document Storage**
  - Download signed PDF after completion
  - Store in file system or S3-compatible storage
  - Link document to customer record
  - Version tracking (if contract amended and re-signed)

- **QuickBooks Integration**
  - Contract signed → add note to QB customer
  - Update customer status to "Active" after contract
  - Link contract PDF to QB customer record (attachment or URL)

- **Finance Dashboard**
  - View pending contracts (awaiting signature)
  - Resend contract reminder
  - Void contract if needed
  - Download signed contracts

**Success Criteria:**
- Contract auto-generated from deal data
- Customer receives contract via email
- Signature tracked in system
- Signed PDF stored and accessible
- QuickBooks updated when contract completed
- Finance team can monitor contract status

---

### Phase 3: Finance Workflow Automation

**Goal**: Integrate QuickBooks and DocuSign into one seamless end-to-end workflow, ensuring customer data consistency and automating the complete financial lifecycle.

**Status**: ✅ Complete (2026-01-15)

**Depends on**: Phases 1, 2 (QuickBooks and DocuSign integrations must be working individually)

**Research**: Unlikely (orchestration of existing integrations)

**Plans**: 2 plans

Plans:
- [x] 03-01: End-to-end workflow orchestration with retry logic (completed 2026-01-15, 6 min)
- [x] 03-02: Customer data consistency and Finance dashboard (completed 2026-01-15, 97 min)

**Scope:**
- **End-to-End Workflow**
  - **Trigger**: Deal marked as "Won" (manual or via future CRM integration)
  - **Step 1**: Create customer in QuickBooks and DocuSign (if not exists)
  - **Step 2**: Generate invoice in QuickBooks
  - **Step 3**: On invoice paid → generate contract in DocuSign
  - **Step 4**: On contract signed → mark customer as "Active"
  - **Step 5**: All data synced across QuickBooks and DocuSign

- **Customer Data Consistency**
  - Identity Mapper ensures email is unique across all systems
  - Bidirectional sync: changes in one system update all others
  - External ID tracking (QB ID, DocuSign ID) in Customer table
  - Conflict resolution (e.g., customer updates email - which system wins?)
  - Audit log for all customer data changes

- **Error Handling & Recovery**
  - Workflow fails gracefully at any step
  - Manual intervention UI for Finance team
  - Retry failed steps without restarting workflow
  - Clear error messages with actionable next steps
  - Integration log tracks every API call

- **Finance Dashboard**
  - **Customer View**: See all customer data (QB, DocuSign) in one place
  - **Invoice View**: Track invoice → payment status
  - **Contract View**: Track contract → signature status
  - **Workflow View**: Monitor end-to-end progress (Deal → Invoice → Contract)
  - **Error View**: See failed workflows with retry options

- **Manual Overrides**
  - Finance team can manually trigger invoice generation
  - Finance team can manually generate contract
  - Finance team can mark workflow steps as "complete" if done outside system

- **Notifications & Alerts**
  - Email Finance team when workflow step fails
  - Alert when contract unsigned after 7 days
  - Daily summary of pending workflows

- **Reporting & Analytics**
  - Time from Deal Won → Invoice Generated (average, median)
  - Time from Invoice → Contract Signed (average, median)
  - Contract signature rate (% signed within 7 days)
  - Customer onboarding bottlenecks

**Success Criteria:**
- Complete workflow runs automatically from Deal Won → Customer Active
- Finance team can view all customer financial data in one dashboard
- Errors are caught, logged, and recoverable
- Manual intervention is possible at any step
- Customer data stays consistent across QuickBooks and DocuSign
- Finance team receives alerts for failed workflows

---

### Phase 4: Insights (BI & Analytics)

**Goal**: Create comprehensive Business Intelligence dashboard with KPIs, charts, and analytics for complete financial visibility and data-driven decision making.

**Status**: ⏳ In progress (1 of 4 plans complete)

**Depends on**: Phases 1-3 (needs data from QuickBooks, DocuSign, and automated workflows)

**Research**: Complete (DISCOVERY.md created 2026-01-15)

**Plans**: 4 plans

Plans:
- [x] 04-01: BI dashboard infrastructure with Recharts and React Query (completed 2026-01-15, 10 min)

**Scope:**

- **Financial KPIs Dashboard**
  - Revenue metrics (MRR, ARR, growth rate)
  - Payment analytics (collection rate, average payment time)
  - Invoice metrics (outstanding balance, overdue rate, average invoice value)
  - Customer lifetime value (LTV)
  - Payment method distribution
  - Revenue by customer segment
  - Cash flow projections

- **Invoice Analytics**
  - Invoice status distribution charts
  - Payment timeline analysis (days to payment)
  - Overdue invoice trends over time
  - Invoice volume trends (daily, weekly, monthly)
  - Seasonal patterns in invoicing
  - Top customers by invoice volume/value
  - Invoice aging report with buckets (0-30, 31-60, 61-90, 90+ days)

- **Customer Analytics**
  - Customer acquisition trends
  - Customer churn analysis
  - Customer payment behavior segments
  - Top paying customers
  - Customer geographic distribution
  - Customer by source (QuickBooks, Pipedrive)
  - New vs returning customer revenue

- **Payment Analytics**
  - Payment tracking in QuickBooks
  - Average days to payment by customer
  - Late payment patterns
  - Payment reconciliation reports

- **Workflow Performance**
  - Deal → Invoice → Contract funnel
  - Time metrics for each workflow stage
  - Bottleneck identification
  - Automation success rates
  - Error rates by integration
  - Webhook processing performance

- **Interactive Charts & Visualizations**
  - Line charts (revenue trends, invoice volume)
  - Bar charts (payment methods, customer segments)
  - Pie charts (invoice status distribution)
  - Heatmaps (payment patterns by day/time)
  - Funnel charts (conversion workflows)
  - Gauge charts (KPI targets vs actuals)
  - Area charts (cumulative revenue)

- **Filters & Date Ranges**
  - Date range selector (last 7/30/90 days, custom range)
  - Customer filters
  - Invoice status filters
  - Payment method filters
  - Source system filters (QB, Stripe, PD)
  - Export to CSV/PDF

- **Real-time Updates**
  - Live KPI counters
  - Auto-refresh dashboards
  - Webhook-triggered chart updates
  - Real-time alerts for anomalies

- **Reports**
  - Executive summary report
  - Financial period reports (monthly, quarterly)
  - Customer account statements
  - Overdue invoice reports
  - Payment collection reports
  - Revenue forecasting reports

**Success Criteria:**
- Finance team has complete visibility into financial metrics
- Charts load in <2 seconds
- All KPIs update automatically when data changes
- Ability to drill down from high-level metrics to individual transactions
- Export functionality works for all reports
- Mobile-responsive dashboard
- Real-time updates without page refresh

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 1.1 → 4.1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. QuickBooks Foundation | 1/1 | ✅ Complete | 2026-01-14 |
| 1.1. Invoice & Customer Dashboard (INSERTED) | 4/4 | ✅ Complete | 2026-01-14 |
| 4.1. Deployment Ready (INSERTED) | 3/3 | ✅ Complete | 2026-01-15 |
| 2. DocuSign Integration | 0/? | Not planned | — |
| 3. Finance Workflow Automation | 2/2 | ✅ Complete | 2026-01-15 |
| 4. Insights (BI & Analytics) | 1/4 | ⏳ In progress | — |

**Status:** 4 of 6 phases complete, 11 plans executed, Phase 4 in progress (1/4 plans complete)

**Next Action:** Continue Phase 4 with Plan 04-02 (Financial KPIs and Data Fetching) or run /gsd:progress

---

## Sprint 1 Success Metrics

**Business Outcomes:**
- Finance team saves 10+ hours/week on manual data entry
- Payment tracking and reconciliation in QuickBooks
- Customer data consistency: 100% (zero duplicate customers)
- Contract turnaround time: <2 days (from invoice to signed)

**Technical Outcomes:**
- Zero lost contracts (all DocuSign webhooks processed)
- Customer data synced across QuickBooks and DocuSign within 1 minute
- Workflow error recovery: Finance team can retry any failed step

**Quality Metrics:**
- Integration test coverage: >80% for all Finance workflows
- API error rate: <1% (excluding expected errors)
- Webhook processing: <5 seconds (95th percentile)
- System uptime: >99.5% (Vercel + integrations)
