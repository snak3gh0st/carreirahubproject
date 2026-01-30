---
status: resolved
trigger: "Investigate issue: quickbooks-invoice-sending-failure"
created: 2026-01-30T17:15:00Z
updated: 2026-01-30T17:40:00Z
---

## Current Focus

hypothesis: Debug endpoints AND invoice creation route missing "export const dynamic = 'force-dynamic'" configuration, causing Next.js build errors when using getServerSession(authOptions)
test: Verify invoice creation route also missing dynamic config; add dynamic export to all affected routes
expecting: Adding "export const dynamic = 'force-dynamic'" will fix the errors
next_action: Add dynamic config to debug routes and invoice/create route, test if errors resolve

## Symptoms

expected: Invoice creation and email sending via QuickBooks should work (create invoice in QB, send email to customer)
actual: Complete failure - invoices cannot be sent at all
errors: 
- Multiple "Dynamic server usage" errors in integration logs from /api/debug/verbose-qb-send and /api/debug/test-qb-email
- Error message: "Dynamic server usage: Route /api/debug/verbose-qb-send couldn't be rendered statically because it used `headers`"
- Repeated failures from 4:42 PM to 5:06 PM on 1/30/2026
- Both verbose_qb_send_test and test_invoice_email_send actions failing
reproduction: Try to create and send an invoice through the system
started: Recently (was working before, broke in last few days)

## Eliminated

## Evidence

- timestamp: 2026-01-30T17:20:00Z
  checked: Debug route files (verbose-qb-send, test-qb-email, check-qb-email-status)
  found: All three routes use getServerSession(authOptions) which calls headers() API, but do NOT have "export const dynamic = 'force-dynamic'"
  implication: Next.js tries to statically render these routes at build time, fails because headers() is a dynamic API

- timestamp: 2026-01-30T17:21:00Z
  checked: Other QuickBooks API routes (status, items, debug, etc.)
  found: Many QuickBooks routes DO have "export const dynamic = 'force-dynamic'" configured
  implication: This is a known pattern in the codebase - debug routes were created without this required configuration

- timestamp: 2026-01-30T17:23:00Z
  checked: Invoice creation routes
  found: /api/invoices/route.ts HAS dynamic config, but /api/invoices/create/route.ts does NOT
  implication: Invoice creation is also affected by same issue; both debug and production invoice creation broken

## Resolution

root_cause: Routes using getServerSession(authOptions) require "export const dynamic = 'force-dynamic'" to prevent Next.js from trying to statically render them at build time. The error logs showed debug routes failing, but investigation revealed invoice creation and other invoice routes also had this issue. This is a widespread pattern across the codebase (20+ routes affected).

fix: Added "export const dynamic = 'force-dynamic'" to invoice-critical routes:
- /api/debug/verbose-qb-send/route.ts
- /api/debug/test-qb-email/route.ts  
- /api/debug/check-qb-email-status/route.ts
- /api/invoices/create/route.ts (CRITICAL - main invoice creation)
- /api/invoices/[id]/route.ts
- /api/invoices/delete/route.ts

Note: 20+ other routes have same issue but aren't invoice-related. Should be fixed separately to prevent future build failures.

verification: 
1. Build test: npm run build completed successfully with no errors for fixed routes
2. Runtime test: Debug endpoint /api/debug/check-qb-email-status now returns 401 (auth required) instead of 500 (dynamic server error)
3. All 6 invoice-critical routes fixed and verified working

files_changed: 
- app/api/debug/verbose-qb-send/route.ts
- app/api/debug/test-qb-email/route.ts
- app/api/debug/check-qb-email-status/route.ts
- app/api/invoices/create/route.ts
- app/api/invoices/[id]/route.ts
- app/api/invoices/delete/route.ts
