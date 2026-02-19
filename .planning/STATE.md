# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-14)

**Core value:** Complete Finance workflow automation — seamless integration between QuickBooks and DocuSign to handle invoicing and contracts without manual data entry or lost transactions.

**Current focus:** Sprint 1 — Finance Integration Foundation (QuickBooks, DocuSign)

## Current Position

Phase: 9 of 9 (Professional UI/UX Enhancement) - ✅ COMPLETE
Plan: 5 of 5 in current phase
Status: Phase complete - Dashboard transformation complete (functional → beautiful → accessible)
Last activity: 2026-02-19 - Completed quick task 44: Invoices area cascading effect grouping invoices by customer with expand/collapse

Progress: █████████████████████ 100% Sprint 1 COMPLETE (29/29 plans executed)

## Performance Metrics

**Velocity:**
- Total plans completed: 29
- Average duration: 16 minutes
- Total execution time: 7 hours 53 minutes

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. QuickBooks Foundation | 1/1 | 150 min | 150 min |
| 1.1. Dashboard Enhancement | 4/4 | 42 min | 11 min |
| 4.1. Deployment Ready | 3/3 | 35 min | 12 min |
| 3. Finance Workflow Automation | 2/2 | 103 min | 52 min |
| 4. Insights (BI & Analytics) | 3/3 | 60 min | 20 min |
| 2. DocuSign Integration | 4/4 | 14 min | 4 min |
| 5. DocuSign Production Setup | 2/2 | 12 min | 6 min |
| 6. Pipedrive Integration | 5/5 | 19 min | 3.8 min |
| 9. Professional UI/UX Enhancement | 5/5 | 64 min | 13 min |

**Recent Trend:**
- Phase 9: 09-05 (1 min) — Advanced UX & Accessibility with WCAG AA compliance
- Phase 9: 09-04 (6 min, partial) — Invoices List page redesign with professional data table
- Phase 9: 09-03 (5 min) — Dashboard page redesign with StatCard and icon-based actions
- Phase 9: 09-02 (5 min) — Core component library (8 components with design tokens)
- Phase 9: 09-01 (8 min) — Design system foundation (colors, typography, spacing tokens)
- Phase 6: 06-05 (4 min) — Contract signed → Pipedrive deal won + notifications
- Phase 6: 06-04 (4 min) — Notification infrastructure and Pipedrive markDealAsWon
- Phase 6: 06-03 (6 min) — Invoice creation → Pipedrive deal update
- Phase 6: 06-02 (2 min) — Customer creation sync to QB + Pipedrive
- Phase 6: 06-01 (3 min) — Fix backwards workflow and establish lead entry
- Phase 5: 05-02 (continuation) — Automated contract workflow with production verification
- Phase 5: 05-01 (12 min) — DocuSign production credentials configuration with RSA keypair
- Phase 2: 02-04 (5 min) — Contract management dashboard with status filtering
- Phase 2: 02-03 (4 min) — S3 document storage with presigned URLs
- Phase 2: 02-01 (1 min) — DocuSign webhook security with HMAC verification
- Phase 4: 04-03 (32 min) — Date range filtering and CSV export

## Sprint 1 Roadmap

**Sprint Goal:** Enable Finance department to manage complete customer financial lifecycle (invoicing → contract) without manual data entry.

**Sprint Structure:**
- Phase 1: QuickBooks Foundation ✅ Complete
- Phase 1.1: Invoice & Customer Dashboard Enhancement ✅ Complete (INSERTED)
- Phase 4.1: Deployment Ready ✅ Complete (INSERTED)
- Phase 2: DocuSign Integration ✅ Complete
- Phase 3: Finance Workflow Automation ✅ Complete
- Phase 4: Insights (BI & Analytics) ✅ Complete
- Phase 5: DocuSign Production Setup & Verification ✅ Complete (2 of 2 plans)
- Phase 6: Pipedrive Integration ✅ Complete (5 of 5 plans)
- Phase 9: Professional UI/UX Enhancement ✅ Complete (5 of 5 plans)

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

**From Phase 1 (QuickBooks Foundation):**
- Use bcryptjs instead of bcrypt for Vercel serverless compatibility (no native modules)
- Invoice pagination implemented with maxResults default of 5000 (handles large QB accounts)
- Email as universal customer identifier across all systems (Identity Mapper pattern)
- Full page navigation for QuickBooks OAuth (eliminates CORS issues)
- Admin credentials: admin@carreirausa.com (authenticated via bcryptjs hashing)

**Strategic Decisions:**
- Focus Sprint 1 exclusively on Finance (QuickBooks, DocuSign only)
- Removed Stripe from Sprint 1 (payment tracking in QuickBooks sufficient)
- Defer Pipedrive, Twilio, OpenAI to Sprint 2
- Build integrations sequentially: QB → DocuSign → Workflow
- Each phase delivers working integration before moving to next

**From Phase 4 (Insights - BI & Analytics):**
- Filter revenue metrics by paidAt (cash flow date) and invoices by createdAt (booking date) for accurate temporal analysis
- Store date filters in URL query params for shareable/bookmarkable dashboard views
- Stagger CSV downloads with 100ms delays to prevent browser blocking
- Add UTF-8 BOM to CSV exports for Excel compatibility with special characters
- Export formatted data (currency strings, percentages) for business user convenience
- Use type assertions for conditional Prisma query results to resolve union type narrowing

**From Phase 2 (DocuSign Integration):**
- Use timing-safe comparison (crypto.timingSafeEqual) for HMAC verification to prevent timing attacks
- Composite event_id for webhook deduplication: `${envelopeId}-${event}-${timestamp}`
- Return 200 OK for duplicate events to stop DocuSign retries
- Always get raw request body before JSON parsing for HMAC signature verification
- Use Composite Templates (serverTemplates + inlineTemplates) for template-based contracts
- Lock all text tabs containing customer/invoice data to prevent tampering
- Implement graceful fallback from templates to inline PDF for reliability
- Optional DOCUSIGN_TEMPLATE_ID env var enables template-based contracts
- S3 for signed contract storage (durable, cost-effective, industry standard)
- 7-day presigned URL expiration (balance security and usability)
- Graceful degradation when S3 not configured (prevents webhook failures)
- Download combined document from DocuSign (contract + certificate in single PDF)
- Presigned URL auto-regeneration: Check expiry on download requests, regenerate if needed (balances security with UX)
- Manual reminder logging: Log all manual actions to IntegrationLog with user email for audit trail
- Place Contracts link after Invoices in sidebar for logical workflow grouping (Invoice → Contract)
- Use FileSignature icon from lucide-react for contracts navigation (clear visual distinction)

**From Phase 5 (DocuSign Production Setup):**
- RSA private key stored in Vercel environment variable (supports multi-line PEM and base64 formats)
- GUID format validation for Integration Key and User ID before deployment
- Credential verification script exits with code 0 (ready) or 1 (needs fixing) for CI/CD integration
- Manual setup required for RSA keypair generation and admin consent (cannot be automated due to DocuSign security requirements)
- Use setTimeout for 7-minute delayed contract triggering (MVP approach - production hardening documented for future)

**From Phase 6 (Pipedrive Integration):**
- Deal won webhook no longer creates invoices (backwards workflow removed)
- Invoice creation drives deal updates, not vice versa
- Email-based customer matching checks QB first before creating entities
- Persons without QB customers become Leads (not Customers)
- Customer creation syncs to both QB and Pipedrive with graceful degradation
- Pipedrive sync failures logged but don't block operations
- Fire-and-forget pattern for Pipedrive syncs (doesn't block API responses)
- Only first invoice in series creates Pipedrive deal (prevents duplicates from installments)
- 1-minute notification deduplication window prevents webhook retry noise
- Upsert pattern for deal creation prevents race conditions
- First invoice detection based on invoice number ending with -001
- Series prefix extraction using customer initials for duplicate prevention
- Fire-and-forget contract scheduling - failures don't block invoice send
- Different invoice series (customer initials) allows new contracts for different programs

**From Phase 6 (Pipedrive Integration):**
- Removed invoice creation from deal won webhook (backwards workflow fixed)
- Deal webhook only updates Hub deal status to match Pipedrive (no financial operations)
- QuickBooks customer matching by email happens FIRST before creating entities
- Persons without QB customers become Leads, not Customers
- PIPEDRIVE added to LeadSource enum for lead tracking
- Webhook loop prevention via 5-second debounce on lastPipedriveSyncAt
- QB-first workflow: Check QB customer exists → link Pipedrive → else create Lead
- Dual-sync pattern: Commercial creates customer → syncs to QB THEN Pipedrive
- Graceful degradation: Pipedrive sync failure doesn't block customer creation
- Response enrichment: syncedSystems object indicates which integrations succeeded
- Pipedrive API format: email as array, phone as array with primary flag (fixed in createPerson)

**From Phase 9 (Professional UI/UX Enhancement):**
- Design system foundation with Inter typography, finance-focused colors, and spacing tokens
- Enhanced component library (Button, Card, StatCard, Badge, Input)
- Dashboard page redesign with StatCard pattern and icon-based actions
- Professional data tables with filters and status badges
- WCAG 2.1 AA compliant accessibility (keyboard navigation, focus indicators, semantic HTML)
- Smooth animations and micro-interactions (hover lift, shadow transitions)
- Use focus-visible pseudo-class for keyboard-only focus indicators
- Skip-to-content link in Portuguese ("Pular para o conteúdo principal")
- Animate only transform, opacity, box-shadow for GPU acceleration (60fps)
- 200ms transition base time for perceived responsiveness
- Dashboard transformation complete: functional → beautiful → accessible

### Roadmap Evolution

**2026-01-27 — Phase 6 Added (Pipedrive Integration):**
- Phase 6 added to end of current milestone: Pipedrive Integration Respecting the Whole Workflow of the Hub
- Reason: Need to integrate Pipedrive CRM with complete workflow automation
- Scope: [To be planned during planning phase]
- Depends on: Phase 5 (DocuSign Production Setup)
- Will complete the hub's workflow by connecting CRM to existing QuickBooks and DocuSign integrations

**2026-01-27 — Phase 5 Added (DocuSign Production Setup):**
- Phase 5 added to end of current milestone: DocuSign Production Setup & Verification
- Reason: DocuSign integration code complete (Phase 2) but production environment needs proper JWT authentication configuration
- Scope: RSA keypair generation, credentials configuration, consent grant, production testing
- Depends on: Phase 2 (DocuSign Integration code)
- Will ensure DocuSign works correctly in production with proper authentication

**2026-01-14 — Phase 4 Added (Business Intelligence):**
- Phase 4 added to end of current milestone: Insights (BI & Analytics)
- Reason: Need comprehensive BI dashboard with KPIs, charts, and analytics for complete financial visibility
- Scope: Financial KPIs, invoice analytics, customer analytics, payment analytics, workflow performance metrics, interactive charts
- Depends on: All previous phases (1-3) to have complete data from QuickBooks and DocuSign
- Will provide data-driven decision making capabilities for Finance team

**2026-01-14 — Phase 1.1 Inserted (URGENT):**
- Phase 1.1 inserted after Phase 1: Invoice & Customer Dashboard Enhancement
- Reason: Finance team needs better visibility into customer financial data and invoice details
- Scope: Enhanced UI with graphics, advanced filtering, installment tracking
- This is urgent work discovered after Phase 1 completion
- Completed successfully before Phase 4.1 (Deployment Ready)

**2026-01-14 — Sprint 1 Scope Defined:**
- Pivoted from multi-department, multi-integration roadmap to Finance-only focus
- New sprint structure: 4 phases covering QuickBooks, DocuSign, Workflow, BI
- Phase 1 (QuickBooks) already complete and working in production
- Deferred: Pipedrive CRM, Twilio WhatsApp, OpenAI chatbot, Stripe (Sprint 2)

**Phase 1 Complete (2026-01-14):**
- QuickBooks OAuth flow working (CORS fix via full page navigation)
- Invoice sync with pagination (up to 5000 invoices)
- Customer sync working
- Authentication system converted from bcrypt → bcryptjs
- Admin credentials created and tested
- Logout functionality added to dashboard (desktop + mobile)
- Webhook verifier token configured

**Key Technical Accomplishments:**
- Fixed critical bcrypt native module failure in Vercel serverless environment
- Implemented proper invoice pagination for QB accounts with >1000 invoices
- Created debug endpoints for production troubleshooting
- Reset admin password in production database (Neon)

### Phase 1 Technical Details

**Files Modified:**
- `lib/services/auth.service.ts` — bcrypt → bcryptjs migration
- `app/api/quickbooks/sync/invoices/route.ts` — pagination fix
- `components/dashboard/dashboard-header.tsx` — logout button added
- `package.json` — dependency swap (bcrypt → bcryptjs)

### Phase 1.1 Technical Details

**Files Created (1.1-01):**
- `app/dashboard/customers/[id]/page.tsx` — Customer detail page (387 lines)

**Files Modified (1.1-01):**
- `lib/services/quickbooks-sync.service.ts` — Fixed TypeScript error (undefined variable)

**Files Modified (1.1-02):**
- `app/dashboard/invoices/[id]/page.tsx` — Enhanced invoice detail page with customer information card and two-column responsive layout

**Files Modified (1.1-03):**
- `app/dashboard/invoices/page.tsx` — Status distribution bar chart and progress bars
- `app/dashboard/customers/[id]/page.tsx` — Payment pie chart and enhanced status badges

**Files Modified (1.1-04):**
- `app/dashboard/invoices/page.tsx` — Advanced filters and quick chips
- `app/dashboard/customers/page.tsx` — Advanced filters and quick chips

**Key Features Delivered:**
- **1.1-01:** Financial summary cards (Total Invoiced, Paid, Pending, Overdue)
- **1.1-01:** Installment plan summary section
- **1.1-01:** Complete invoice table with status badges
- **1.1-01:** Overdue detection and indicators
- **1.1-01:** Navigation to invoice details
- **1.1-02:** Customer information card on invoice detail page
- **1.1-02:** Customer financial summary (QB balance, total invoiced, total paid)
- **1.1-02:** Data source badges (QuickBooks, Pipedrive, Manual)
- **1.1-02:** Responsive two-column layout (desktop) / stacked (mobile)
- **1.1-02:** Navigation links between invoice and customer pages
- **1.1-03:** Status distribution bar chart (Draft/Sent/Paid/Overdue) on invoice list
- **1.1-03:** Progress bars in summary cards showing value proportions
- **1.1-03:** CSS-based pie chart showing paid vs unpaid ratio
- **1.1-03:** Installment progress bar with paid/remaining/overdue segments
- **1.1-03:** Enhanced status badges with colored dots and days overdue display
- **1.1-04:** Advanced filtering (date range, amount range, payment method, approval status, balance, invoice count)
- **1.1-04:** Quick filter chips for common Finance workflows (11 chips total)
- **1.1-04:** URL-persisted filter state (shareable, bookmarkable)
- **1.1-04:** Active filter count badge

### Phase 2 Technical Details (DocuSign Integration)

**Files Created (02-04):**
- `app/api/contracts/route.ts` — Contract list API with filtering and pagination
- `app/api/contracts/[id]/route.ts` — Contract detail API with full relations
- `app/api/contracts/[id]/download/route.ts` — Presigned URL generation with auto-regeneration
- `app/api/contracts/[id]/resend/route.ts` — Manual reminder sending with logging
- `app/dashboard/contracts/page.tsx` — Contract list page with status filters
- `app/dashboard/contracts/[id]/page.tsx` — Contract detail page with actions

**Files Modified (02-04):**
- `components/dashboard/sidebar-nav.tsx` — Added Contracts link to Finance section

**Key Features Delivered:**
- **02-01:** HMAC webhook verification with timing-safe comparison
- **02-01:** Event deduplication using composite envelope-event-timestamp IDs
- **02-02:** Template-based contracts with Composite Templates (serverTemplates + inlineTemplates)
- **02-02:** Locked text tabs for customer/invoice data to prevent tampering
- **02-02:** Graceful fallback from templates to inline PDF
- **02-03:** S3 document storage with server-side AES256 encryption
- **02-03:** 7-day presigned URL generation for secure downloads
- **02-03:** Graceful degradation when S3 not configured
- **02-04:** Contract list with status filtering (Draft, Pending, Viewed, Signed, Declined, Voided, Expired)
- **02-04:** Contract detail with customer, invoice, and deal relations
- **02-04:** Download button with presigned URL auto-regeneration on expiry
- **02-04:** Manual reminder button for pending contracts
- **02-04:** Integration logging for manual actions with user email

### Phase 4 Technical Details (Insights - BI & Analytics)

**Files Created (04-01):**
- `components/dashboard/kpi-card.tsx` — Reusable KPI card component with loading states

**Files Created (04-02):**
- `app/api/analytics/financial/route.ts` — Financial analytics aggregation endpoint
- `components/dashboard/charts/invoice-status-chart.tsx` — Recharts pie chart for invoice status
- `components/dashboard/charts/revenue-trend-chart.tsx` — Recharts line chart for revenue trend
- `components/dashboard/charts/top-customers-chart.tsx` — Recharts bar chart for top customers

**Files Modified (04-02):**
- `app/dashboard/insights/page.tsx` — Integrated React Query and chart components

**Files Created (04-03):**
- `components/dashboard/date-range-filter.tsx` — Date range filter with chips and custom picker
- `lib/utils/export-csv.ts` — CSV export utility with UTF-8 BOM

**Files Modified (04-03):**
- `app/api/analytics/financial/route.ts` — Added date range query params and filtering
- `app/dashboard/insights/page.tsx` — Integrated date filter and export functionality

**Key Features Delivered:**
- **04-01:** BI dashboard page with React Query setup and placeholder structure
- **04-02:** 4 financial KPIs (total revenue, overdue amount, collection rate, active customers)
- **04-02:** Invoice status pie chart with color coding
- **04-02:** Revenue trend line chart showing 12-month history
- **04-02:** Top 10 customers bar chart by revenue
- **04-02:** Single API endpoint aggregating all metrics via parallel Prisma queries
- **04-03:** Date range filter with 5 quick chips (Last 7/30/90 Days, This Year, All Time)
- **04-03:** Custom date range picker with start/end date inputs
- **04-03:** URL-persisted filter state (shareable URLs)
- **04-03:** API date filtering across all metrics
- **04-03:** CSV export button generating 4 files (KPIs, invoice status, revenue trend, top customers)
- **04-03:** Exports respect date filters and format data for business users

**Key Issues Resolved:**
1. bcrypt native module failure (Error: No native build for platform=linux)
   - Solution: Replaced with bcryptjs (pure JavaScript implementation)
2. Invoice sync limited to 1000 invoices
   - Solution: Pagination loop using `getAllInvoicesPaginated()`
3. Local vs production database confusion
   - Solution: Created production-specific reset script
4. JSON escaping in curl commands
   - Solution: Used JSON files instead of inline strings

**Production Status:**
- Deployment: carreirausa-c7o4e0dqv
- URL: https://carreirausa.sigmaintel.io
- Status: ✅ Working (login, QB OAuth, invoice sync all operational)

### Deferred Issues

None. Phase 1 is complete with no blocking issues.

**Optional Cleanup (low priority):**
- Remove debug endpoints after stability confirmed
- Document password policy for users
- Implement password reset flow for end users

### Blockers/Concerns

None. Phase 1 (QuickBooks Foundation) complete and working in production.

**Phase 1.1 Inserted - Dashboard Enhancement Urgently Needed:**
- Finance team has QB data synced but dashboard UX is basic
- Need better visualization of customer financial status
- Advanced filtering required for large invoice datasets (5000+ invoices)
- Installment tracking critical for understanding payment schedules

**Phase 2 Progress (DocuSign Integration):**
- ✅ 02-01: Webhook security with HMAC verification
- ✅ 02-02: Template-based contracts with Composite Templates
- ✅ 02-03: S3 document storage with presigned URLs
- ✅ 02-04: Contract management dashboard COMPLETE

**Phase 2 Complete - All DocuSign integration features delivered:**
- Webhook security with HMAC verification and deduplication
- Template-based contracts with Composite Templates
- S3 document storage with presigned URL generation
- Contract list and detail pages with filtering
- Download signed contracts via presigned URLs
- Manual reminder sending for pending contracts
- Sidebar navigation integration

**Phase 5 Complete - DocuSign Production Setup & Verification:**
- ✅ Plan 05-01: DocuSign production credentials configured with RSA keypair
- ✅ Plan 05-02: Automated contract workflow and production verification
- ✅ JWT authentication verified working in production
- ✅ Automated contract workflow triggered 7 minutes after invoice send
- ✅ First invoice detection and duplicate prevention working
- ✅ Real-time contract status display on invoice detail page
- ✅ Production workflow verified end-to-end by user

**Phase 6 Complete - Pipedrive Integration Delivered:**
- ✅ Fixed backwards workflow (deal won no longer creates invoices)
- ✅ Customer creation syncs to both QB + Pipedrive
- ✅ Invoice creation triggers Pipedrive deal sync
- ✅ Contract signed marks deal as WON and notifies commercial user
- ✅ Complete end-to-end workflow: Lead → Customer → Invoice → Deal → Contract → Won → Notification
- ✅ Phase verified with 17/17 must-haves passing

**Sprint 1 Milestone Complete - All 8 Phases Delivered:**
All phase goals achieved. Hub workflow complete from lead entry to deal won notification.

**Next Steps:**
1. `/gsd-audit-milestone` - Optional comprehensive audit across phases
2. `/gsd-complete-milestone` - Archive Sprint 1 and prepare for Sprint 2

## Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 001 | Remove Finance approval for COMMERCIAL invoices | 2026-01-22 | dde9d87 | [001-remove-finance-approval](.planning/quick/001-remove-finance-approval/) |
| 002 | Fix QB invoice email delivery with email verification | 2026-01-22 | 0ac47c9 | [002-send-email-to-qb-user-for-created-invoic](.planning/quick/002-send-email-to-qb-user-for-created-invoic/) |
| 003 | Fix QB invoice email sending with POST body format | 2026-01-22 | c358469 | [003-fix-qb-email-send](.planning/quick/003-fix-qb-email-send/) |
| 004 | Implement professional invoice numbering (CUST-YYYY-MM-001) | 2026-01-22 | 2e2fa77 | [004-custom-invoice-numbers](.planning/quick/004-custom-invoice-numbers/) |
| 005 | Change invoice numbering to initials and enable auto-send for all roles | 2026-01-22 | 721030f | [005-initials-and-auto-send](.planning/quick/005-initials-and-auto-send/) |
| 006 | Add comprehensive QB /send endpoint debugging | 2026-01-22 | d0f488a | [006-debug-qb-send](.planning/quick/006-debug-qb-send/) |
| 007 | Implement installment invoice email scheduling with 5-day pre-send | 2026-01-23 | 8953539 | [007-implement-installment-invoice-email-sche](.planning/quick/007-implement-installment-invoice-email-sche/) |
| 008 | Add delete invoice button with QuickBooks integration | 2026-01-23 | 5863d7b | [008-add-delete-invoice-button-with-quickbook](.planning/quick/008-add-delete-invoice-button-with-quickbook/) |
| 009 | Redesign invoice detail page with better layout and delete button | 2026-01-23 | 99b0271 | [009-redesign-invoice-detail-page-with-better](.planning/quick/009-redesign-invoice-detail-page-with-better/) |
| 010 | Fix invoice deletion to use QuickBooks void operation | 2026-01-23 | 7b9e2f2 | [010-fix-invoice-deletion-to-use-quickbooks-v](.planning/quick/010-fix-invoice-deletion-to-use-quickbooks-v/) |
| 011 | Implement invoice edit functionality with QuickBooks sparse update | 2026-01-23 | a4b43cc | [011-implement-invoice-edit-functionality-wit](.planning/quick/011-implement-invoice-edit-functionality-wit/) |
| 012 | Remove invoice approval workflow completely | 2026-01-23 | d64c73d | [012-remove-invoice-approval-workflow-complet](.planning/quick/012-remove-invoice-approval-workflow-complet/) |
| 013 | Improve invoice creator form UI/UX layout | 2026-01-23 | 51183ed | [013-improve-invoice-creator-form-ui-ux-layou](.planning/quick/013-improve-invoice-creator-form-ui-ux-layou/) |
| 014 | Fix installment invoice due date calculation | 2026-01-28 | 4c2000d | [014-fix-installment-invoice-due-date-calcula](.planning/quick/014-fix-installment-invoice-due-date-calcula/) |
| 017 | Fix installment date calculation with month-aware logic | 2026-01-28 | d47892e | [017-fix-installment-date-calculation-to-use-](.planning/quick/017-fix-installment-date-calculation-to-use-/) |
| 018 | Fix single payment invoice email timing based on due date | 2026-01-28 | 4284c4c | [018-quando-a-invoice-criada-sem-installments](.planning/quick/018-quando-a-invoice-criada-sem-installments/) |
| 019 | Add Create Customer link to Finance sidebar | 2026-01-28 | c3ec0c0 | [019-finance-nao-est-conseguindo-gerar-client](.planning/quick/019-finance-nao-est-conseguindo-gerar-client/) |
| 020 | QuickBooks API error diagnostics and validation | 2026-01-28 | c32003f | [020-quickbooks-api-error-400-bad-request-alg](.planning/quick/020-quickbooks-api-error-400-bad-request-alg/) |
| 021 | Fix Redis placeholder DNS errors | 2026-01-28 | 2883772 | [021-fix-redis-placeholder-dns-errors](.planning/quick/021-fix-redis-placeholder-dns-errors/) |
| 022 | Add customer edit functionality with QuickBooks sync | 2026-01-28 | f709931 | [022-add-customer-edit-functionality](.planning/quick/022-add-customer-edit-functionality/) |
| 023 | Fix invoice creation: discount not applied, billing address incorrect, email not sent | 2026-01-28 | 6b5c931 | [023-fix-invoice-creation-discount-not-applie](.planning/quick/023-fix-invoice-creation-discount-not-applie/) |
| 024 | Fix QuickBooks webhook event ID extraction | 2026-01-28 | 57c919c | [024-fix-quickbooks-webhook-event-id-extracti](.planning/quick/024-fix-quickbooks-webhook-event-id-extracti/) |
| 025 | Add contract generator with DocuSign template selection | 2026-01-29 | fa0f362 | [025-add-contract-generator-page-for-commerci](.planning/quick/025-add-contract-generator-page-for-commerci/) |
| 026 | Review and redo insights page with proper filters | 2026-01-29 | 757c61c | [026-review-and-redo-insights-page-with-prope](.planning/quick/026-review-and-redo-insights-page-with-prope/) |
| 027 | Add logout button to dashboard and update login page layout | 2026-01-30 | 513bfec | [027-add-logout-button-to-dashboard-and-updat](.planning/quick/027-add-logout-button-to-dashboard-and-updat/) |
| 028 | Update login page to match dashboard layout | 2026-01-30 | fd48bc7 | [028-update-login-page-to-match-dashboard-lay](.planning/quick/028-update-login-page-to-match-dashboard-lay/) |
| 030 | Debug QuickBooks invoice creation 400 Bad Request error | 2026-01-30 | ed9ad65 | [030-debug-quickbooks-invoice-creation-400-ba](.planning/quick/030-debug-quickbooks-invoice-creation-400-ba/) |
| 032 | Fix broken QuickBooks sync link and ensure Settings button visible | 2026-01-30 | 1c1619f | [032-fix-broken-quickbooks-sync-link-and-ensu](.planning/quick/032-fix-broken-quickbooks-sync-link-and-ensu/) |
| 033 | Improve invoice customer selection UX and add customer deletion | 2026-01-30 | f4f32d3 | [033-improve-invoice-customer-selection-ui-an](.planning/quick/033-improve-invoice-customer-selection-ui-an/) |
| 034 | Fix invoice date timezone bug and first installment calculation | 2026-01-30 | c6ccaa0 | [034-fix-invoice-date-timezone-bug-and-first-](.planning/quick/034-fix-invoice-date-timezone-bug-and-first-/) |
| 035 | Fix workflow progress tracker - add email tracking fields | 2026-01-31 | pending | [035-fix-workflow-progress-tracker-add-emai](.planning/quick/035-fix-workflow-progress-tracker-add-emai/) |
| 036 | Add discount percentage, DOB field, and PT-BR translations | 2026-02-02 | ab9c21c | [036-add-discount-and-dob-translate-to-pt-br](.planning/quick/036-add-discount-and-dob-translate-to-pt-br/) |
| 037 | Add searchable service/product dropdown to invoice form | 2026-02-02 | 3ad337f | [037-add-searchable-service-product-dropdown](.planning/quick/037-add-searchable-service-product-dropdown/) |
| 038 | Redo Insights BI - QuickBooks Only | 2026-02-04 | 26b1dfc | [038-redo-insights-bi-quickbooks](.planning/quick/038-redo-insights-bi-quickbooks/) |
| 038-D1 | Fix date filtering bugs in QuickBooks API | 2026-02-04 | c74fd7b | [038-date-filtering-bugs](.planning/debug/038-date-filtering-bugs/) |
| 038-D2 | Fix chart date distribution | 2026-02-04 | 26b1dfc | [038-chart-date-distribution](.planning/debug/038-chart-date-distribution/) |
| 038-D3 | Fix allTime showing only 12 months | 2026-02-04 | 8771b17 | [038-alltime-historical](.planning/debug/038-alltime-historical/) |
| 038-D4 | Fix timezone parsing - charts piling in one month | 2026-02-05 | 86f32c7 | [038-chart-piling-month](.planning/debug/038-chart-piling-month/) |
| 038-D5 | Add YTD and MTD date filters | 2026-02-05 | fe86728 | [038-ytd-mtd-filters](.planning/debug/038-ytd-mtd-filters/) |
| 038-D6 | Enable QuickBooks payments sync | 2026-02-05 | d66ea4c | [038-payments-sync](.planning/debug/038-payments-sync/) |
| 039 | Translate entire webapp UI to PT-BR | 2026-02-06 | 67bdd62 | [039-translate-webapp-to-pt-br](.planning/quick/039-translate-webapp-to-pt-br/) |
| 039b | Translate remaining pages to PT-BR (round 2) | 2026-02-06 | b1a38ad | [039-translate-webapp-to-pt-br](.planning/quick/039-translate-webapp-to-pt-br/) |
| 039c | Translate sidebar, quick filters, insights, analytics charts (round 3) | 2026-02-06 | 9ce193b | [039-translate-webapp-to-pt-br](.planning/quick/039-translate-webapp-to-pt-br/) |
| 041 | User support chat with AI escalation | 2026-02-06 | 91dd325 | [041-user-support-chat-with-ai-escalation](.planning/quick/041-user-support-chat-with-ai-escalation/) |
| 042 | View open tickets and delete from chat widget | 2026-02-06 | e58870e | [042-ver-tickets-abertos-e-deletar](.planning/quick/042-ver-tickets-abertos-e-deletar/) |
| 043-D1 | Fix QB cron connection pool exhaustion (P2024) | 2026-02-16 | aedbea7 | [qb-cron-connection-pool-exhaustion](.planning/debug/resolved/qb-cron-connection-pool-exhaustion.md) |
| 043-D2 | Fix pre-existing build errors blocking deployment | 2026-02-16 | 698e4a4 | - |
| INFRA | Migrate repo from GitHub to GitLab | 2026-02-16 | cb7adae | gitlab.com/sigma-group192807/carreirausahub |
| 43 | Fix invoice creator showing wrong date (UTC off-by-one) | 2026-02-19 | bc4ba4f | [43-fix-invoice-creator-showing-wrong-date-y](.planning/quick/43-fix-invoice-creator-showing-wrong-date-y/) |
| 44 | Invoices list accordion view grouped by customer | 2026-02-19 | 2b8fa9d | [44-invoices-area-cascading-effect-grouping-](.planning/quick/44-invoices-area-cascading-effect-grouping-/) |
| 46 | Mark overdue customer groups with red header and Vencido badge | 2026-02-19 | 114f845 | [46-mark-overdue-installments-in-red-with-du](.planning/quick/46-mark-overdue-installments-in-red-with-du/) |

## Session Continuity

Last session: 2026-02-19
Stopped at: Fixed Server Components render error (buildSortUrl function prop crossing server/client boundary)
Resume file: .planning/quick/46-mark-overdue-installments-in-red-with-du/46-SUMMARY.md
Next action: Deploy to production and verify invoice area loads correctly with overdue indicators

## Sprint 1 Success Criteria

**Business Outcomes (Sprint 1 Complete):**
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
