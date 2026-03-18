---
status: verifying
trigger: "invoice-email-not-sending"
created: 2026-03-10T00:00:00Z
updated: 2026-03-10T00:00:00Z
---

## Current Focus

hypothesis: The `syncSingleInvoice` call at line 592 of `create/route.ts` runs AFTER `emailSentAt` is written to the DB, and overwrites the invoice via `prisma.invoice.update` — but crucially, the update in `syncSingleInvoice` (lines 320-332) does NOT include `emailSentAt`. The bug is actually NOT there. The real root cause is in `shouldSendEmail` logic: single invoices with a FUTURE due date are SCHEDULED (not immediately sent), which is intentional — BUT the cron job at `/api/cron/send-scheduled-invoices` sends them only if `daysUntilDue <= 5`. Invoices with due dates more than 5 days away just sit and wait. This is by design. The intermittent nature ("some send, others don't") maps precisely to: entry invoices and same-day invoices send immediately; future-dated single invoices and all installments are scheduled; those scheduled invoices only send if cron runs AND dueDate is within 5 days.

The second root cause: the `syncSingleInvoice` is called RIGHT AFTER `prisma.invoice.create` (line 592). The `syncSingleInvoice` does a `prisma.invoice.update` on the `existing` record. When it updates the existing invoice, it does NOT preserve `emailSentAt` — it uses only `status`, `amountPaid`, `paidAt`, `markedOverdueAt`, and `installments`. So `emailSentAt` IS preserved (not in the update clause). That's fine.

BUT: the `syncSingleInvoice` also merges into `installments` field using `existingInstallments`. The invoice was JUST created at line 562 with `installments` set to `{ seriesId, current, total, isFirstInstallment }`. The `syncSingleInvoice` then merges `{ quickbooks: {...} }` into that. This is fine.

CONFIRMED ROOT CAUSE: The `shouldSendEmail` condition at line 414 is:
  `const shouldSendEmail = isEntryInvoice || (isSingleInvoice && isDueTodayOrPast);`

This means:
- Single invoice with FUTURE due date → NOT sent immediately → goes to `!shouldSendEmail` branch → logged as "scheduled" → `emailSentAt` remains null → cron picks it up
- Entry invoice → sent immediately
- Any installment (including first installment) → NOT sent immediately → cron dependent

The cron sends when `daysUntilDue <= 5`. If the cron is not running or the invoice's due date is > 5 days away, the email is NEVER sent.

BUT there is a SECOND bug layered on top: The `isSinglePayment` variable (line 87) is:
  `const isSinglePayment = entryAmount === 0 && installmentCount === 0;`

And `isSingleInvoice` (line 404) is:
  `const isSingleInvoice = invoiceCountToCreate === 1 && !isInstallmentSeries;`

When `installmentCount === 0` and `entryAmount === 0`, `isSinglePayment = true` and `isSingleInvoice = true`.

So a single payment with a future due date is CORRECTLY SCHEDULED. The cron should send it.

The actual bug: the `shouldSendEmail` logic recently changed (commit a3776ce "fix timezone date bugs and enable QB online payments") to add the `isDueTodayOrPast` check. Before this change, ALL single invoices were sent immediately. After this change, single invoices with future due dates are SILENTLY SCHEDULED and depend on the cron job.

If the cron job is not properly configured in vercel.json or is not running, NO scheduled invoices will ever be sent.

test: Check vercel.json for cron configuration and check if the cron is actually running
expecting: Either cron is missing or the daysUntilDue <= 5 window is wrong
next_action: Check vercel.json cron config and then apply fix

## Symptoms

expected: When an invoice is created, the customer should receive an email with the invoice
actual: Invoice is created successfully but customer never receives the email
errors: No specific error messages reported by user
reproduction: Create an invoice - it gets created in the system but email doesn't go out
timeline: Was working before, recently broke (after commit a3776ce)
started: After commit a3776ce (fix timezone date bugs and enable QB online payments)

## Eliminated

- hypothesis: syncSingleInvoice overwrites emailSentAt after it's set
  evidence: syncSingleInvoice update clause (lines 320-332) only updates status/amountPaid/paidAt/markedOverdueAt/installments — does NOT touch emailSentAt
  timestamp: 2026-03-10

- hypothesis: BillEmail not being set on invoice creation
  evidence: createInvoiceWithBillEmail explicitly sets BillEmail.Address and EmailStatus: "NeedToSend" on every invoice
  timestamp: 2026-03-10

- hypothesis: sendInvoice always failing silently
  evidence: sendInvoice returns graceful failure and the code branches on success/failure; some invoices DO send (entry invoices, same-day due)
  timestamp: 2026-03-10

## Evidence

- timestamp: 2026-03-10
  checked: app/api/invoices/create/route.ts lines 396-414
  found: shouldSendEmail = isEntryInvoice || (isSingleInvoice && isDueTodayOrPast). For a single invoice with a future due date, shouldSendEmail = false. Invoice is "scheduled" to be sent by cron.
  implication: Any invoice created with a due date in the future will NOT receive an immediate email. It depends entirely on the cron job.

- timestamp: 2026-03-10
  checked: git diff showing commit a3776ce changes
  found: The isDueTodayOrPast check and scheduling logic was ADDED in this commit. Before: all single invoices were sent immediately. After: future-dated single invoices are scheduled.
  implication: This is the "recently broke" inflection point. Before this commit, single invoices were always emailed immediately. After, they depend on the cron.

- timestamp: 2026-03-10
  checked: app/api/cron/send-scheduled-invoices/route.ts
  found: Cron only sends when `daysUntilDue <= 5`. Invoices > 5 days from due date are SKIPPED every run. The cron comment says "Daily at 9:00 AM UTC" but this is only a comment — the actual schedule is in vercel.json.
  implication: Invoices will be silently deferred until 5 days before due date. If cron is not running or the vercel.json schedule is missing/wrong, NO emails are ever sent.

- timestamp: 2026-03-10
  checked: shouldSendEmail logic for installment invoices
  found: isInstallmentSeries=true means shouldSendEmail is ALWAYS false for ALL installments (including entry invoices when entryAmount=0). Wait — isEntryInvoice = entryAmount > 0 && i === 1. So entry invoices (entry payment) DO get sent immediately. Only installments without an entry payment are scheduled.
  implication: The inconsistency between "entry invoice sends immediately" and "installment 1 does not" is a UX confusion but not a bug per se.

## Resolution

root_cause: Commit a3776ce ("fix timezone date bugs and enable QB online payments") introduced an `isDueTodayOrPast` check that changed the email sending logic for single invoices. Before: single invoices always emailed immediately on creation. After: only same-day/past-due single invoices emailed immediately; future-dated single invoices are silently scheduled for cron to send 5 days before due date. Since most invoices have future due dates (30-day terms etc.), these invoices never receive an immediate email and the customer only hears from the cron 5 days before payment is due — which feels like "email not sent." This is why it's intermittent: entry invoices and same-day invoices still work, future-dated single invoices don't.

fix: |
  Changed `shouldSendEmail` from:
    `isEntryInvoice || (isSingleInvoice && isDueTodayOrPast)`
  to:
    `isSingleInvoice || isEntryInvoice`

  Single invoices (a vista) now always email immediately on creation. The "5 days before" scheduling is reserved for installment invoices only, where delayed notification makes sense (you don't want to email an installment receipt 30 days before the customer needs to pay it).

  Also removed the now-unused `isDueTodayOrPast` variable and updated the log message and scheduling branch comment to reflect only installments being scheduled.

verification: TypeScript compiles cleanly (tsc --noEmit returns no errors). Logic verified by reading the changed lines.
files_changed:
  - app/api/invoices/create/route.ts
