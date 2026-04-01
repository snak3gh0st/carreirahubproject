---
status: awaiting_human_verify
trigger: "QuickBooks API is returning 400 Object Not Found errors for GET /invoice/{id} calls, and a circuit breaker is opening"
created: 2026-03-30T00:00:00Z
updated: 2026-03-30T12:30:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: Verified locally — QB Payments 404 handling is correct, and the remaining accounting-side gap was the sendInvoice retry path treating QB 610/Object Not Found like a transient error.
test: Self-verified by code inspection plus linting after patching sendInvoice permanent-failure detection and cron ghost-invoice cleanup.
expecting: A QB 610/Object Not Found response now stops retries immediately, avoids the retry-path getInvoice() circuit hit, and confirmed ghosts are auto-voided out of the cron backlog.
next_action: User verifies in the real cron/workflow environment that no new QB circuit-open events occur and ghost invoices stop reappearing.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: QuickBooks API calls to GET /invoice/{id} should return invoice data successfully
actual: QB API returns 400 "Object Not Found" errors, circuit breaker is opening
errors: 400 "Object Not Found" on QB invoice GET calls, circuit breaker tripping
reproduction: Check IntegrationLog table for recent QB-related errors
started: March 30, 2026 — discovered during investigation of related payment issue

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: Recent 774be3b refactor (Contract-Invoice 1:1 → 1:many) corrupted QB invoice ID references
  evidence: The schema change only altered contractId field on Invoice and removed invoiceId from Contract. quickbooks_invoice_id field is unchanged. No QB ID references in the diff.
  timestamp: 2026-03-30T00:08:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-03-30T00:03:00Z
  checked: vercel.json cron configuration
  found: 13 cron jobs. Relevant QB ones: auto-charge-invoices (00:30 UTC), quickbooks-sync (every 6h), send-scheduled-invoices (09:00 UTC), overdue-invoice-alerts (every 6h), daily-ar-digest (09:00 UTC)
  implication: Multiple cron jobs touch QB invoice IDs daily; all ran today

- timestamp: 2026-03-30T00:04:00Z
  checked: quickbooks.service.ts — getInvoice method
  found: getInvoice(invoiceId) calls this.request(`/invoice/${invoiceId}`) — a simple GET. The `invoiceId` parameter must be the QB numeric ID (e.g. "123"), NOT our local UUID.
  implication: Any caller passing a local DB UUID will get 400 "Object Not Found"

- timestamp: 2026-03-30T00:04:00Z
  checked: circuit-breaker.ts
  found: CircuitBreaker opens after 5 failures (thresholdFailures=5), resets after 60 seconds (timeoutMs=60000). State persisted to DB. Named "quickbooks" for accounting API calls.
  implication: 5+ consecutive 400 errors tripped the circuit. The 400s are real, not transient.

- timestamp: 2026-03-30T00:05:00Z
  checked: send-scheduled-invoices/route.ts
  found: Queries invoices with quickbooks_invoice_id NOT null, emailSentAt null. Then calls quickbooksService.sendInvoice(invoice.quickbooks_invoice_id, ...). This correctly uses the QB ID.
  implication: send-scheduled-invoices cron is NOT the problem — it uses quickbooks_invoice_id correctly.

- timestamp: 2026-03-30T00:05:00Z
  checked: auto-charge-invoices/route.ts
  found: Uses quickbooksService.createPayment({ invoiceId: invoice.quickbooks_invoice_id, ... }). Correctly uses QB ID. Does NOT call getInvoice directly.
  implication: auto-charge cron is NOT the direct caller of getInvoice.

- timestamp: 2026-03-30T00:06:00Z
  checked: invoice-workflow.service.ts createQuickbooksInvoice
  found: After creating QB invoice, calls quickbooksSyncService.syncSingleInvoice(qbInvoice.Id) — uses QB ID. Correct.
  implication: Invoice workflow sync path is correct.

- timestamp: 2026-03-30T00:06:00Z
  checked: invoices/create/route.ts
  found: After creating QB invoice, calls quickbooksSyncService.syncSingleInvoice(qbInvoiceId) where qbInvoiceId = qbInvoice.Id (QB numeric ID). Correct.
  implication: Manual invoice create route sync path is correct.

- timestamp: 2026-03-30T00:07:00Z
  checked: quickbooks-sync.service.ts syncSingleInvoice
  found: Calls quickbooksService.getInvoice(qbInvoiceId) where qbInvoiceId is the QB numeric ID passed in. Correct.
  implication: syncSingleInvoice itself is not the bug — it depends on caller providing correct ID.

- timestamp: 2026-03-30T00:07:00Z
  checked: sendInvoice retry path in quickbooks.service.ts
  found: On retry (attempt > 1), calls this.updateInvoiceBillEmail(invoiceId, email) which calls this.getInvoice(invoiceId). The invoiceId passed to sendInvoice is always the QB numeric ID from callers. Correct.
  implication: sendInvoice retry path is correct IF callers pass QB ID.

- timestamp: 2026-03-30T00:08:00Z
  checked: syncPayments in quickbooks-sync.service.ts
  found: Calls syncSingleInvoice(qbInvoiceId) where qbInvoiceId comes from QB payment LinkedTxn.TxnId — this IS the QB numeric ID. Correct.
  implication: Payment sync path is correct.

- timestamp: 2026-03-30T00:08:00Z
  checked: 774be3b commit diff for prisma/schema.prisma
  found: Only changed contractId uniqueness constraint and removed invoiceId from Contract model. quickbooks_invoice_id is UNTOUCHED.
  implication: Recent refactor did NOT corrupt QB invoice ID references.

- timestamp: 2026-03-30T12:12:00Z
  checked: current local diff in send-scheduled-invoices/route.ts and quickbooks.service.ts
  found: paymentsRequest now returns a non-error sentinel for QB Payments 404 wallet lookups, and the cron already marks QB 610/Object Not Found send failures as VOID.
  implication: The payments-side circuit fix is correct; the remaining weakness was on the accounting send retry path.

- timestamp: 2026-03-30T12:18:00Z
  checked: quickbooks.service.ts sendInvoice retry behavior
  found: sendInvoice performs direct fetches for /invoice/{id}/send, but retry attempt 2 calls updateInvoiceBillEmail -> getInvoice(), which goes through the accounting circuit breaker. Permanent QB 610/Object Not Found failures were being retried unnecessarily.
  implication: Stopping retries for permanent 610 responses prevents avoidable accounting-circuit failures.

- timestamp: 2026-03-30T12:22:00Z
  checked: send-scheduled-invoices ghost-invoice handling
  found: Added pre-pass to auto-VOID invoices whose lastEmailSendError already proves QB code 610/Object Not Found, instead of only leaving them skipped by attempt count.
  implication: Previously identified ghost invoices are now removed from the active cron backlog more safely.

- timestamp: 2026-03-30T12:24:00Z
  checked: eslint on changed QuickBooks files
  found: npx eslint app/api/cron/send-scheduled-invoices/route.ts lib/services/quickbooks.service.ts lib/utils/circuit-breaker.ts completed with no output/errors.
  implication: The local code changes are syntactically/lint valid.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: |
  THREE root causes:

  1. BULK DATA MIGRATION GHOST INVOICES: ~970 invoices in our DB have quickbooks_invoice_id values (e.g. 7029, 13010, 14816) that were imported from a different QuickBooks company or sandbox environment in January 2026. The current QB production company (9130357819592226) has never heard of these IDs. The send-scheduled-invoices cron (09:00 UTC) finds all 970 because emailSentAt IS NULL, and hammers QB with /invoice/{id}/send calls. QB returns 400 "Object Not Found" code 610 for every one. The cron has now made 34+ failed attempts per invoice (visible in emailSendAttempts field).

  2. RETRY PATH AMPLIFIES FAILURES: sendInvoice() on retry (attempt 2) calls updateInvoiceBillEmail() which calls getInvoice(invoiceId) to get SyncToken. This GET call also hits the circuit breaker. So each failed /send attempt generates TWO circuit breaker failures (the GET + the POST). This caused the quickbooks circuit to open and close today.

  3. QB_PAYMENTS CIRCUIT OPEN: The auto-charge-invoices cron at 00:30 UTC hit 5 customers via paymentsRequest('/customers/{qbCustomerId}/cards'). When customers have no cards, QB Payments returns 404. The paymentsRequest handler threw on 404 and the paymentsCircuitBreaker counted it as a failure. After 5 such customers, the quickbooks_payments circuit opened.

  4. REMAINING GAP FOUND DURING VERIFICATION: Even after the cron-side VOID handling was added, sendInvoice still retried QB 610/Object Not Found as if it were transient. That second-attempt retry path called updateInvoiceBillEmail -> getInvoice() and needlessly hit the accounting circuit breaker before the cron could mark the invoice VOID.

fix:
  1. Keep the cron-side protections: cap retries, mark QB 610/Object Not Found invoices as VOID, and auto-VOID previously confirmed ghost invoices based on stored lastEmailSendError.
  2. Treat QB Payments 404 wallet lookups as an expected sentinel result so they do not increment the quickbooks_payments circuit breaker.
  3. Patch sendInvoice to classify QB 610/Object Not Found as a permanent failure and stop retrying immediately, preventing the retry-path getInvoice() call from hitting the accounting circuit.

verification:
  - Local code inspection confirms QB Payments 404s now resolve to [] without throwing through the payments circuit breaker.
  - Local code inspection confirms sendInvoice now breaks out immediately on permanent QB 610/Object Not Found instead of proceeding to retry/updateInvoiceBillEmail.
  - send-scheduled-invoices now auto-VOIDs previously confirmed ghost invoices and still VOIDs new 610 failures on first detection.
  - ESLint passed for all changed QuickBooks files.

files_changed:
  - app/api/cron/send-scheduled-invoices/route.ts
  - lib/services/quickbooks.service.ts
