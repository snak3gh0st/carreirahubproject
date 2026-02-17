---
status: verifying
trigger: "Collaborator reports customers not appearing in clients list after invoice generation, invoices may not sync to QuickBooks correctly, due dates may be wrong"
created: 2026-02-17T00:00:00Z
updated: 2026-02-17T00:03:00Z
---

## Current Focus

hypothesis: CONFIRMED - All three root causes identified and fixed
test: TypeScript compilation and Next.js production build pass
expecting: all fixes compile, no regressions
next_action: verify by reviewing each fix against original symptoms

## Symptoms

expected: When a user creates an invoice in CarreiraHub:
1. The customer should appear in the hub's clients list
2. The invoice should appear in the invoices section
3. The invoice should be synced/sent to QuickBooks where it gets created and sent to the customer
4. Due dates should be correctly set on invoices

actual:
1. Cristiane Freire Branquinho's record did NOT appear in the clients list after invoice generation
2. Luis's record appeared "estranho" (strange/incorrect) in the system
3. Uncertainty about whether Luis's invoice was actually generated
4. Unknown status of due date correctness

errors: No error messages checked yet - need to investigate code paths and logs

reproduction: Generate an invoice through the CarreiraHub dashboard for a customer.

started: Recent issue reported by collaborator.

## Eliminated

- hypothesis: Customer list page has role-based filtering hiding customers
  evidence: Customers page queries ALL customers with no role filter
  timestamp: 2026-02-17T00:01:00Z

- hypothesis: Invoice creation flow doesn't create customer records
  evidence: Invoice creation requires pre-existing customerId
  timestamp: 2026-02-17T00:01:00Z

## Evidence

- timestamp: 2026-02-17T00:01:00Z
  checked: Full invoice creation flow (app/api/invoices/create/route.ts)
  found: Invoice creation does NOT create customers - requires customerId upfront
  implication: Customer must be created separately

- timestamp: 2026-02-17T00:01:00Z
  checked: Date utility functions (lib/utils/date.ts)
  found: parseLocalDate creates dates in LOCAL timezone but addMonths operates in UTC
  implication: Installment due dates could be off by 1 day

- timestamp: 2026-02-17T00:01:00Z
  checked: QB invoice creation (quickbooks.service.ts createInvoiceWithBillEmail)
  found: DueDate formatted as toISOString().split('T')[0] which converts to UTC
  implication: On non-UTC servers, date could shift backward by 1 day

- timestamp: 2026-02-17T00:01:00Z
  checked: syncSingleInvoice in quickbooks-sync.service.ts
  found: CRITICAL - Update OVERWRITES installments, invoiceNumber, amount, dueDate, status
  implication: Every newly created invoice gets its installment tracking destroyed

- timestamp: 2026-02-17T00:01:00Z
  checked: Identity Mapper reconcileCustomer
  found: Only fills EMPTY fields - never updates existing name even if wrong
  implication: If Luis had bad data from previous sync, it would never be corrected

- timestamp: 2026-02-17T00:03:00Z
  checked: TypeScript compilation and production build after fixes
  found: All changes compile cleanly, build succeeds
  implication: Fixes are syntactically correct and type-safe

## Resolution

root_cause: Three interacting bugs:

1. **syncSingleInvoice destructively overwrites local invoice data (CRITICAL)**: After creating an invoice in the DB, the code immediately calls syncSingleInvoice which fetches the invoice from QB and OVERWRITES the local record -- destroying installments JSON (series tracking), potentially altering dueDate, and overwriting other fields.

2. **Date timezone mismatch**: parseLocalDate created local-timezone dates, addMonths operated in UTC, and QB DueDate was formatted via toISOString() (UTC). This could cause dates to shift by -1 day in non-UTC timezones.

3. **Identity Mapper never updates existing fields**: If a customer's name was wrong from a previous sync, reconcileCustomer would not fix it since it only filled empty fields.

fix: Four files changed:

1. **lib/services/quickbooks-sync.service.ts** - syncSingleInvoice now preserves locally-originated fields (invoiceNumber, dueDate, amount, dealId, lineItems, ownerId) when updating existing invoices. Only updates status-related fields from QB (status, amountPaid, paidAt, markedOverdueAt). Merges QB sync data into installments JSON without overwriting local data.

2. **lib/utils/date.ts** - parseLocalDate now creates dates at UTC noon (12:00:00Z) instead of local midnight. This ensures consistent behavior with addMonths (which uses UTC operations) and prevents any timezone from shifting the calendar day. Added formatDateString helper.

3. **app/api/invoices/create/route.ts** - Added todayUTCNoon() helper. All fallback dates (when no dueDate provided) now use UTC noon instead of new Date() to match the UTC noon convention.

4. **lib/services/identity-mapper.ts** - reconcileCustomer now always updates name and phone when provided (using !== comparison instead of !customer.name). PII fields still only fill empty. This allows fixing incorrect customer data.

5. **app/dashboard/invoices/new/InvoiceForm.tsx** - Schedule preview now uses UTC noon for fallback dates to match server-side behavior.

verification: TypeScript compilation passes. Next.js production build succeeds. All changes are minimal and targeted.

files_changed:
  - lib/services/quickbooks-sync.service.ts
  - lib/utils/date.ts
  - app/api/invoices/create/route.ts
  - lib/services/identity-mapper.ts
  - app/dashboard/invoices/new/InvoiceForm.tsx
