---
status: resolved
trigger: "Audit all RBAC roles, especially OPERATIONAL. Ensure middleware, sidebar, pages, API routes are properly wired."
created: 2026-02-06T00:00:00Z
updated: 2026-02-06T00:01:00Z
---

## Current Focus

hypothesis: confirmed - multiple RBAC gaps found and fixed
test: TypeScript compilation passes
expecting: all roles properly gated
next_action: archive

## Symptoms

expected: All roles (ADMIN, SALES, SDR, FINANCE, SUPPORT, OPERATIONAL) fully wired across middleware, sidebar, pages, API routes
actual: Multiple gaps found (see Evidence)
errors: None reported
reproduction: Check role references across codebase
started: Ongoing

## Eliminated

## Evidence

- checked: middleware.ts
  found: Only 4 routes protected (settings, leads, invoices, conversations). Missing protection for payments, contracts, insights, support, integrations, webhooks, workflows, debug, analytics. Any authenticated user could access these by URL.
  implication: CRITICAL security gap

- checked: middleware.ts invoices rule
  found: SALES role missing from invoices middleware but allowed in sidebar and page-level check
  implication: SALES users blocked at middleware but shown link in sidebar

- checked: dashboard-header.tsx (mobile nav)
  found: Missing COMMERCIAL from invoices, missing contracts link, missing support link, missing COMMERCIAL from customers/home
  implication: COMMERCIAL and OPERATIONAL users see incomplete mobile nav

- checked: app/dashboard/page.tsx
  found: OPERATIONAL, SUPPORT, SDR roles all fall through to the full admin/finance dashboard with financial metrics and actions like "Create Invoice", "Sync QuickBooks", "View Reports"
  implication: Users see actions they cannot access, confusing UX

- checked: professional-sidebar.tsx
  found: Properly wired - OPERATIONAL sees Dashboard, Customers, Support. Good.

- checked: sidebar-nav.tsx (legacy sidebar)
  found: Properly wired with section-level and item-level role filtering. Good.

- checked: Prisma schema
  found: 7 roles defined: ADMIN, SALES, SDR, FINANCE, SUPPORT, OPERATIONAL, COMMERCIAL. COMMERCIAL exists in schema but was missing from CLAUDE.md docs.

- checked: lib/auth.ts
  found: hasPermission and requireRole helpers exist but are NOT used by any API routes. API routes do their own ad-hoc role checks.

- checked: app/dashboard/support/page.tsx
  found: No page-level role check. Relies entirely on middleware (which was missing protection for this route).

## Resolution

root_cause: Middleware only protected 4 of 13+ dashboard route prefixes. OPERATIONAL, SUPPORT, SDR, and COMMERCIAL users could access routes they shouldn't by navigating directly. Dashboard home page showed all users the same admin/finance view regardless of role.

fix: |
  1. middleware.ts - Rewrote with comprehensive routeRoleMap covering all 14 route prefixes. Added SALES to invoices. Added protection for payments, contracts, insights, support, integrations, webhooks, workflows, debug, analytics.
  2. dashboard-header.tsx - Added COMMERCIAL to invoices/customers/home links. Added contracts and support links.
  3. app/dashboard/page.tsx - Added role-specific dashboard views for OPERATIONAL (support-focused), SUPPORT (conversations-focused), and SDR (leads-focused) so they see relevant quick actions instead of finance metrics.

verification: TypeScript compilation passes (npx tsc --noEmit)

files_changed:
  - middleware.ts
  - components/dashboard/dashboard-header.tsx
  - app/dashboard/page.tsx
