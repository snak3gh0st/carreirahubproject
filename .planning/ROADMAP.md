# Roadmap: Sprint 1 - Finance Integration Foundation

## Overview

Build rock-solid Finance department workflows by integrating QuickBooks (accounting), Stripe (payments), and DocuSign (contracts) into one unified automation platform. This sprint focuses exclusively on Finance, eliminating manual data entry, ensuring customer consistency across systems, and automating the complete invoicing → payment → contract workflow.

**Sprint Goal:** Enable the Finance department to manage the entire customer financial lifecycle (invoicing, payments, contracts) without manual data entry or system-hopping.

## Domain Expertise

**Primary Domain:** Finance Operations
- Accounting workflows (QuickBooks)
- Payment processing (Stripe)
- Contract management (DocuSign)
- Customer financial lifecycle management

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Core sprint work executed in sequence
- Decimal phases (1.1, 2.1): Urgent insertions if needed (marked with INSERTED)

Sprint 1 Phases:
- [x] **Phase 1: QuickBooks Foundation** - OAuth, customer sync, invoice sync, payment tracking
- [ ] **Phase 1.1: Invoice & Customer Dashboard Enhancement (INSERTED)** - Enhanced UI, graphics, filtering, installment tracking
- [ ] **Phase 2: Stripe Integration** - Payment processing, subscriptions, QB sync
- [ ] **Phase 3: DocuSign Integration** - Contract generation, signature workflow, document storage
- [ ] **Phase 4: Finance Workflow Automation** - End-to-end Deal → Invoice → Payment → Contract
- [ ] **Phase 5: Insights (BI & Analytics)** - Comprehensive BI dashboard with KPIs, charts, and analytics for invoices and customers

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

**Status**: ⏳ In progress (2 of 4 plans complete)

**Depends on**: Phase 1 (QuickBooks Foundation)

**Research**: Unlikely (UI/UX enhancement of existing functionality)

**Plans**: 4 plans

Plans:
- [x] 1.1-01: Customer detail page with financial summary and installment tracking (completed 2026-01-14, 14 min)
- [x] 1.1-02: Invoice page enhancement with customer details (completed 2026-01-14, 16 min)
- [ ] 1.1-03: Advanced filtering for invoices and customers
- [ ] 1.1-04: Dashboard graphics and visualizations

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

### Phase 2: Stripe Integration

**Goal**: Implement complete Stripe payment processing with QuickBooks sync, handling one-time payments, subscriptions, and failed payment recovery.

**Depends on**: Phase 1 (QuickBooks must be working to sync payment data)

**Research**: Likely (Stripe API integration patterns, webhook signature verification, subscription lifecycle)

**Research topics**:
- Stripe Payment Intents vs Charges API
- Stripe webhook security (signature verification)
- Subscription lifecycle management (trial, active, canceled, past_due)
- Failed payment handling and retry strategies
- Stripe customer → QuickBooks customer mapping

**Plans**: To be determined — run `/gsd:plan-phase 2` to break down

Plans:
- [ ] TBD (run `/gsd:plan-phase 2` to break down work)

**Scope:**
- **Stripe API Setup**
  - Environment configuration (sandbox + production)
  - API key management
  - Webhook endpoint setup with signature verification

- **Customer Management**
  - Create Stripe customer from QuickBooks customer
  - Sync customer data bidirectionally
  - Handle customer updates (email, name, payment method)
  - Deduplication via Identity Mapper (email as key)

- **Payment Processing**
  - One-time payment processing (Payment Intents API)
  - Save payment methods for future use
  - Handle 3D Secure (SCA compliance)
  - Payment confirmation and receipt generation

- **Subscription Management**
  - Create subscription plans/products
  - Subscribe customers to plans
  - Handle subscription lifecycle (active, canceled, past_due)
  - Prorated upgrades/downgrades
  - Trial period handling

- **Webhook Handling**
  - `payment_intent.succeeded` → create QB payment
  - `payment_intent.failed` → log and retry
  - `customer.subscription.created` → track in system
  - `customer.subscription.deleted` → cancel in system
  - `invoice.payment_succeeded` → update QB invoice
  - Deduplication to prevent duplicate processing

- **QuickBooks Sync**
  - Payment received in Stripe → create Payment in QB
  - Link Stripe payment to QB invoice
  - Update invoice status (Paid/Partial)
  - Sync payment metadata (transaction ID, payment method)

- **Failed Payment Handling**
  - Retry logic with exponential backoff
  - Email notifications for failed payments
  - Manual retry UI for Finance team
  - Dunning management (subscription past_due)

**Success Criteria:**
- Customer can pay invoice via Stripe
- Payment automatically recorded in QuickBooks
- Subscriptions track correctly through lifecycle
- Failed payments retry automatically with notifications
- Finance team can view payment status in dashboard

---

### Phase 3: DocuSign Integration

**Goal**: Automate contract generation and signature workflow, integrating DocuSign with QuickBooks to track contract status and trigger downstream actions.

**Depends on**: Phase 2 (contracts typically generated after payment received)

**Research**: Likely (DocuSign API, template management, envelope tracking, JWT authentication)

**Research topics**:
- DocuSign authentication (JWT vs OAuth 2.0)
- Template creation and management
- Envelope sending and tracking
- Webhook events for signature completion
- Document storage and retrieval
- Embedded signing vs email signing

**Plans**: To be determined — run `/gsd:plan-phase 3` to break down

Plans:
- [ ] TBD (run `/gsd:plan-phase 3` to break down work)

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

### Phase 4: Finance Workflow Automation

**Goal**: Integrate all three systems (QuickBooks, Stripe, DocuSign) into one seamless end-to-end workflow, ensuring customer data consistency and automating the complete financial lifecycle.

**Depends on**: Phases 1, 2, 3 (all integrations must be working individually)

**Research**: Unlikely (orchestration of existing integrations)

**Plans**: To be determined — run `/gsd:plan-phase 4` to break down

Plans:
- [ ] TBD (run `/gsd:plan-phase 4` to break down work)

**Scope:**
- **End-to-End Workflow**
  - **Trigger**: Deal marked as "Won" (manual or via future CRM integration)
  - **Step 1**: Create customer in all 3 systems (if not exists)
  - **Step 2**: Generate invoice in QuickBooks
  - **Step 3**: Send payment link via Stripe
  - **Step 4**: On payment received → generate contract in DocuSign
  - **Step 5**: On contract signed → mark customer as "Active"
  - **Step 6**: All data synced across QuickBooks, Stripe, DocuSign

- **Customer Data Consistency**
  - Identity Mapper ensures email is unique across all systems
  - Bidirectional sync: changes in one system update all others
  - External ID tracking (QB ID, Stripe ID, DocuSign ID) in Customer table
  - Conflict resolution (e.g., customer updates email - which system wins?)
  - Audit log for all customer data changes

- **Error Handling & Recovery**
  - Workflow fails gracefully at any step
  - Manual intervention UI for Finance team
  - Retry failed steps without restarting workflow
  - Clear error messages with actionable next steps
  - Integration log tracks every API call

- **Finance Dashboard**
  - **Customer View**: See all customer data (QB, Stripe, DocuSign) in one place
  - **Invoice View**: Track invoice → payment status
  - **Contract View**: Track contract → signature status
  - **Workflow View**: Monitor end-to-end progress (Deal → Invoice → Payment → Contract)
  - **Error View**: See failed workflows with retry options

- **Manual Overrides**
  - Finance team can manually trigger invoice generation
  - Finance team can manually send payment link
  - Finance team can manually generate contract
  - Finance team can mark workflow steps as "complete" if done outside system

- **Notifications & Alerts**
  - Email Finance team when workflow step fails
  - Alert when payment fails after 3 retry attempts
  - Alert when contract unsigned after 7 days
  - Daily summary of pending workflows

- **Reporting & Analytics**
  - Time from Deal Won → Payment Received (average, median)
  - Time from Payment → Contract Signed (average, median)
  - Payment failure rate by payment method
  - Contract signature rate (% signed within 7 days)
  - Customer onboarding bottlenecks

**Success Criteria:**
- Complete workflow runs automatically from Deal Won → Customer Active
- Finance team can view all customer financial data in one dashboard
- Errors are caught, logged, and recoverable
- Manual intervention is possible at any step
- Customer data stays consistent across all 3 systems
- Finance team receives alerts for failed workflows

---

### Phase 5: Insights (BI & Analytics)

**Goal**: Create comprehensive Business Intelligence dashboard with KPIs, charts, and analytics for complete financial visibility and data-driven decision making.

**Depends on**: Phases 1-4 (needs data from QuickBooks, Stripe, DocuSign, and automated workflows)

**Research**: Likely (charting libraries, BI best practices, data visualization patterns)

**Research topics**:
- Chart libraries (Chart.js, Recharts, D3.js, Apache ECharts)
- Data aggregation and caching strategies
- Real-time vs batch analytics
- Dashboard performance optimization
- KPI calculation methodologies
- Financial reporting standards

**Plans**: To be determined — run `/gsd:plan-phase 5` to break down

Plans:
- [ ] TBD (run `/gsd:plan-phase 5` to break down work)

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
  - Payment success/failure rates
  - Payment method preferences
  - Average days to payment by customer
  - Late payment patterns
  - Refund and dispute tracking
  - Stripe vs QuickBooks payment reconciliation

- **Workflow Performance**
  - Deal → Invoice → Payment → Contract funnel
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
Phases execute in numeric order: 1 → 1.1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. QuickBooks Foundation | 1/1 | ✅ Complete | 2026-01-14 |
| 1.1. Invoice & Customer Dashboard (INSERTED) | 1/4 | ⏳ In progress | — |
| 2. Stripe Integration | 0/? | Not planned | — |
| 3. DocuSign Integration | 0/? | Not planned | — |
| 4. Finance Workflow Automation | 0/? | Not planned | — |
| 5. Insights (BI & Analytics) | 0/? | Not planned | — |

**Status:** 1 of 6 phases complete, 2 of 6+ plans executed (~17% done)

**Next Action:** Execute Phase 1.1 Plan 2 - run `/gsd:execute-plan .planning/phases/1.1-enhance-invoice-and-customer-dashboard/1.1-02-PLAN.md`

---

## Sprint 1 Success Metrics

**Business Outcomes:**
- Finance team saves 10+ hours/week on manual data entry
- Payment collection time reduced by 50% (automation + reminders)
- Customer data consistency: 100% (zero duplicate customers)
- Contract turnaround time: <2 days (from payment to signed)

**Technical Outcomes:**
- Zero lost payments (all Stripe webhooks processed)
- Zero lost contracts (all DocuSign webhooks processed)
- Customer data synced across all 3 systems within 1 minute
- Workflow error recovery: Finance team can retry any failed step

**Quality Metrics:**
- Integration test coverage: >80% for all Finance workflows
- API error rate: <1% (excluding expected errors like failed payments)
- Webhook processing: <5 seconds (95th percentile)
- System uptime: >99.5% (Vercel + integrations)
