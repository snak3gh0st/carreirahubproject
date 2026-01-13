# Phase 4.1: User Deployment - Dashboard & QB Data Validation - Discovery

**Discovery Level:** Standard Research (Level 2)
**Date:** 2026-01-12
**Status:** Complete

---

## Research Objective

Audit existing QuickBooks sync completeness and dashboard functionality to identify gaps that block user deployment for Commercial, Admin, and Finance departments.

---

## Findings

### 1. QuickBooks Data Sync - Current State

**What's Working:**
- OAuth authentication flow implemented (connect/disconnect/callback)
- Automatic token refresh via cron (daily at 2 AM UTC)
- Token status and manual refresh endpoints exist
- Basic customer sync (email, name, phone, QB ID)
- Basic invoice sync (amount, due date, QB invoice ID)
- Payment sync capability exists
- Items sync capability exists
- Bidirectional sync service implemented

**What's Captured:**
- Customer: email, name, phone, document, QB ID, QB balance, QB total invoiced, QB total paid, last sync time
- Invoice: invoice number, amount, due date, status, QB invoice ID, payment tracking, collection tracking
- Integration logging for all QB API calls

**Gaps Identified:**
1. **Customer Address Data** - Not captured (billing/shipping addresses from QB)
2. **Customer Metadata** - QB customer terms, credit limit, tax info not stored
3. **Invoice Line Items** - Not captured (service/product breakdown)
4. **Payment Details** - Payment method, check numbers, payment dates incomplete
5. **GL Account Data** - Chart of accounts not synced
6. **Company Info** - QB company information not displayed anywhere

### 2. Dashboard - Current State

**What Exists:**
- Main dashboard page (`/dashboard/page.tsx`) with basic metrics:
  - Total leads, qualified leads
  - Total deals, won deals
  - Total invoices, overdue invoices
  - Conversion rate calculation
- Department-specific pages:
  - `/dashboard/customers` - Customer list
  - `/dashboard/invoices` - Invoice list
  - `/dashboard/leads` - Lead list
  - `/dashboard/deals` - Deal list
  - `/dashboard/integrations` - Integration hub
  - `/dashboard/integrations/sync-status` - Sync monitoring
  - `/dashboard/settings/integrations` - QB/Pipedrive settings

**Gaps Identified:**
1. **No Department-Specific Views** - All users see same dashboard regardless of role (FINANCE, ADMIN, COMMERCIAL)
2. **Minimal Data Context** - Metrics shown are counts only, no trends, no insights
3. **No QB Data Visibility** - QB sync status, QB data completeness not shown
4. **No Admin Monitoring** - System health, integration logs not accessible
5. **Poor UX** - Dashboard feels empty/minimal, not production-ready
6. **No Financial Dashboards** - Finance department has no GL visibility, reconciliation tools, or payment tracking

### 3. Department Requirements (from CONTEXT.md)

**Finance Department Needs:**
- Invoice list with payment status
- Payment tracking and reconciliation
- Overdue invoice monitoring ✓ (partially - exists but minimal)
- GL account visibility ✗ (missing)
- QB sync status and data completeness ✗ (missing)

**Admin Department Needs:**
- System health monitoring ✗ (exists in logs, not accessible in UI)
- QB connection status ✓ (exists at /dashboard/settings/integrations)
- Integration log viewer ✗ (exists as API, not in UI)
- User management ✗ (missing)
- Token refresh monitoring ✓ (exists, needs UI)

**Commercial Department Needs:**
- Lead pipeline visibility ✓ (exists at /dashboard/leads)
- Deal tracking ✓ (exists at /dashboard/deals)
- Customer information ✓ (exists at /dashboard/customers)
- Revenue tracking ✗ (missing)
- Conversion metrics ✓ (basic - on main dashboard)

---

## Decision: Plan Structure

Given **quick depth** (1-3 plans, 2-3 tasks each), this phase breaks down into:

**Plan 1: QuickBooks Data Validation & Completeness**
- Audit what QB fields are critical vs nice-to-have
- Verify customer, invoice, payment sync captures all essential fields
- Add missing critical fields to Prisma schema if needed
- Test sync and validate data completeness

**Plan 2: Dashboard UX Improvements**
- Add department-specific dashboard views (Finance, Admin, Commercial)
- Enhance main dashboard with more context and insights
- Add QB sync status visibility for Admin
- Add integration log viewer for Admin
- Polish UI to feel production-ready

---

## Research Conclusions

**Critical Path:**
1. **QB sync is mostly complete** - Customer and invoice data capture the essentials. Missing fields (addresses, line items, GL accounts) are nice-to-have for v1 deployment.
2. **Dashboard needs significant UX work** - Current state is too minimal for user deployment. Department-specific views are essential.
3. **Admin needs monitoring UI** - System health, integration logs, QB token status all exist as APIs but need UI.

**Validation Strategy:**
- Quick audit of QB sync (verify essential fields captured) - don't rebuild sync
- Focus effort on dashboard UX improvements
- Prioritize department-specific views over analytics/reporting

**Deployment Blockers:**
1. Dashboard UX too minimal (users will feel it's unfinished)
2. No department-specific views (all users see same generic dashboard)
3. Admin can't monitor system health (no UI for integration logs/QB status)

---

## Next Steps

Run `/gsd:plan-phase 4.1` to create executable PLAN.md files based on this discovery.

---

*Discovery complete: 2026-01-12*
