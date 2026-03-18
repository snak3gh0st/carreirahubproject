---
status: awaiting_human_verify
trigger: "QuickBooks cron sync has multiple errors: (1) pagination stops after page 1 despite hasMore=true, (2) unique constraint failures on quickbooks_id when creating customers, (3) unique constraint failures on invoiceNumber when updating invoices, (4) payments with no linked invoice warnings."
created: 2026-03-10T18:00:00Z
updated: 2026-03-10T18:10:00Z
---

## Current Focus

hypothesis: All four bugs confirmed and fixed in lib/services/quickbooks-sync.service.ts
test: TypeScript type check passed (npx tsc --noEmit) with zero errors
expecting: Human to run QB sync and confirm no more errors
next_action: await human verification

## Symptoms

expected: QB sync should fetch ALL pages of customers/invoices (not just first 1000), upsert customers without constraint errors, update invoices without constraint errors, and link payments to invoices
actual: Only 1 page fetched (hasMore=true ignored). 26 customer create errors (quickbooks_id unique constraint). 8 invoice update errors (invoiceNumber unique constraint). 2 payments with no linked invoice warnings.
errors:
- prisma:error Invalid `prisma.customer.create()` invocation: Unique constraint failed on the fields: (`quickbooks_id`)
- prisma:error Invalid `prisma.invoice.update()` invocation: Unique constraint failed on the fields: (`invoiceNumber`)
- [QB Sync] Payment 17018 has no linked invoice
- [QB Sync] Payment 11758 has no linked invoice
reproduction: Run QB sync cron job - errors appear consistently
started: 2026-03-10 18:00 production sync

## Eliminated

(none - all four hypotheses confirmed on first evidence pass)

## Evidence

- timestamp: 2026-03-10T18:05:00Z
  checked: quickbooks-sync.service.ts syncCustomers() lines 674-688
  found: while loop condition was `hasMore && allCustomers.length < maxResults`. maxResults=1000 from cron options. After first page of 1000 customers, allCustomers.length === maxResults → condition false → loop exits immediately. hasMore never consulted.
  implication: BUG 1 CONFIRMED - pagination never advanced past page 1

- timestamp: 2026-03-10T18:05:00Z
  checked: quickbooks-sync.service.ts syncCustomers() line 734, identityMapper.ts lines 44-133
  found: syncCustomers called findUnique by email, then identityMapper.reconcileCustomer also searched only by email. If email not found, create() was called with quickbooks_id. Any customer whose email changed in QB but whose quickbooks_id already existed in DB caused unique constraint violation.
  implication: BUG 2 CONFIRMED - missing quickbooks_id pre-check before create path

- timestamp: 2026-03-10T18:05:00Z
  checked: quickbooks-sync.service.ts syncInvoices() lines 896-921
  found: invoiceData object included `invoiceNumber: qbInvoice.DocNumber || undefined`. Same object passed to both create and update. Update on existing invoice would overwrite invoiceNumber to QB DocNumber, colliding with unique constraint if that DocNumber belonged to a different local invoice.
  implication: BUG 3 CONFIRMED - invoiceNumber must be excluded from update path

- timestamp: 2026-03-10T18:05:00Z
  checked: quickbooks-sync.service.ts syncPayments() line 963
  found: `const invoiceRef = qbPayment.Line?.[0]?.LinkedTxn?.[0]?.TxnId` - hardcoded indices. Payments 17018 and 11758 had their invoice link on a different line or their LinkedTxn[0] was not an Invoice type. Correct pattern (search all lines for TxnType==="Invoice") was already implemented in syncSinglePayment() but not syncPayments().
  implication: BUG 4 CONFIRMED - hardcoded indices missed invoice links

## Resolution

root_cause: |
  1. Pagination: `while (hasMore && allCustomers.length < maxResults)` - the maxResults=1000 cron default equals one full QB page, so loop exits after page 1 regardless of hasMore
  2. Customer constraint: identityMapper.reconcileCustomer() searches only by email; when email not found it creates with quickbooks_id, colliding if another row owns that QB ID
  3. Invoice invoiceNumber: invoiceData object shared between create and update paths; update sets invoiceNumber to QB DocNumber which may conflict with a different local invoice's unique number
  4. Payment lookup: hardcoded Line[0]/LinkedTxn[0] indices miss invoice links not on the first line/txn

fix: |
  1. Changed `while (hasMore && allCustomers.length < maxResults)` to `while (hasMore)` for both customers and invoices pagination loops
  2. Added pre-check in syncCustomers: if no match by email, look up by quickbooks_id; if found, update that record in-place instead of calling reconcileCustomer (which would hit create path)
  3. Added `const { invoiceNumber: _ignored, ...invoiceUpdateData } = invoiceData` before the update call; only create path uses full invoiceData with invoiceNumber
  4. Replaced hardcoded Line[0].LinkedTxn[0].TxnId with a loop over all lines searching for LinkedTxn where TxnType === "Invoice"

verification: TypeScript type check (npx tsc --noEmit) passed with zero errors
files_changed:
  - lib/services/quickbooks-sync.service.ts
