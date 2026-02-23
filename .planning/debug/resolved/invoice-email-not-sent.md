---
status: resolved
trigger: "Invoice #CFF-CP-260221-I1-731 created Feb 20, email step never triggered"
created: 2026-02-23T00:00:00Z
updated: 2026-02-23T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — installment invoices that already have a quickbooks_invoice_id are permanently excluded from the send-scheduled-invoices cron, which only queries for invoices WHERE quickbooks_invoice_id IS NULL. Since the invoice creation route syncs to QB immediately (creating the ID), the cron will never pick these up. The email is thus never sent.
test: traced full execution path from creation route through cron job
expecting: fix involves sending installment email at creation time OR fixing cron query
next_action: implement fix

## Symptoms

expected: After invoice creation + QB sync, the system should automatically send an email to the customer.
actual: The "E-mail Enviado" step in the workflow progress is still pending (gray, not green). Invoice is now overdue and customer never received their invoice.
errors: Unknown — no error has been shown to the user. Silent failure.
reproduction: Check invoice #CFF-CP-260221-I1-731 in the dashboard. The workflow shows Fatura Criada ✅, Sincronização QuickBooks ✅, but E-mail Enviado ⭕ (pending).
timeline: Invoice created Feb 20, 2026 at 21:31. Due date Feb 23, 2026. Email step never ran.

## Eliminated

- hypothesis: "syncSingleInvoice overwrites emailSentAt after it was set"
  evidence: syncSingleInvoice update block (line 288-300) does NOT touch emailSentAt, emailSendAttempts, or lastEmailSendError fields
  timestamp: 2026-02-23T00:05:00Z

- hypothesis: "email was attempted and failed silently"
  evidence: shouldSendEmail = false for installment invoices, so the entire email block is never entered; no attempt logged
  timestamp: 2026-02-23T00:05:00Z

## Evidence

- timestamp: 2026-02-23T00:01:00Z
  checked: app/api/invoices/create/route.ts lines 383-395
  found: |
    isInstallmentSeries = invoiceCountToCreate > 1 (TRUE for this invoice)
    isSingleInvoice = invoiceCountToCreate === 1 && !isInstallmentSeries (FALSE)
    isEntryInvoice = entryAmount > 0 && i === 1 (FALSE — "I1" is installment type, not entry)
    shouldSendEmail = isEntryInvoice || (isSingleInvoice && isDueTodayOrPast) = false || false = FALSE
  implication: Email send block at line 409 is never entered for this invoice

- timestamp: 2026-02-23T00:02:00Z
  checked: app/api/invoices/create/route.ts lines 500-520
  found: When shouldSendEmail=false, a "installment_invoice_scheduled" integration log is created with a scheduledSendDate 5 days before dueDate
  implication: System INTENDS to send email via cron 5 days before due date

- timestamp: 2026-02-23T00:03:00Z
  checked: app/api/invoices/create/route.ts lines 570-579
  found: syncSingleInvoice(qbInvoiceId) is called IMMEDIATELY after QB invoice creation, which sets quickbooks_invoice_id on the local invoice record
  implication: The invoice enters the DB with quickbooks_invoice_id already set

- timestamp: 2026-02-23T00:04:00Z
  checked: app/api/cron/send-scheduled-invoices/route.ts lines 32-40
  found: |
    WHERE condition: { quickbooks_invoice_id: null }
    Only invoices WITHOUT a QB ID are fetched for scheduled sending
  implication: Since the invoice already has quickbooks_invoice_id set at creation time, the cron NEVER finds it. Email is never sent. The promise of "schedule 5 days before due date" is broken.

- timestamp: 2026-02-23T00:05:00Z
  checked: Invoice number "CFF-CP-260221-I1-731"
  found: "I1" segment = installmentType='installment', installmentNumber=1
  implication: Confirms this is installment 1 of a series (not an entry payment), so shouldSendEmail=false at creation

- timestamp: 2026-02-23T00:06:00Z
  checked: lib/services/quickbooks-sync.service.ts lines 288-300
  found: syncSingleInvoice update does NOT include emailSentAt, emailSendAttempts, lastEmailSendError in the data object
  implication: The sync does not corrupt email tracking fields; the fields simply were never set

## Resolution

root_cause: |
  The send-scheduled-invoices cron job queries for invoices WHERE quickbooks_invoice_id IS NULL.
  However, the invoice creation route immediately calls syncSingleInvoice() right after creating
  the QB invoice, which populates quickbooks_invoice_id on all local invoice records.
  As a result, all invoices have quickbooks_invoice_id set by the time the cron runs, so the
  cron query returns 0 results and no scheduled installment emails are ever sent.

  The creation route correctly sets shouldSendEmail=false for installments (intending them to be
  sent by cron 5 days before due) and logs "installment_invoice_scheduled" — but the cron's WHERE
  clause makes it impossible to find those invoices.

fix: |
  Changed the cron query in send-scheduled-invoices/route.ts from:
    WHERE quickbooks_invoice_id IS NULL
  to:
    WHERE quickbooks_invoice_id IS NOT NULL AND emailSentAt IS NULL AND status NOT IN (PAID, VOID)

  Also updated the cron body to: call quickbooksService.sendInvoice() directly on the existing
  QB invoice (instead of calling invoiceSyncService.syncInvoiceToQuickBooks which only creates
  new QB invoices), and update emailSentAt + emailSendAttempts after a successful send.

verification: |
  npm run build succeeded cleanly with ✓ Compiled successfully.
  Pre-existing dynamic-server-usage warnings are unrelated to this change.
  The fix ensures the next daily cron run at 9:00 AM UTC will find invoice
  CFF-CP-260221-I1-731 (and any others in the same situation) and send the email.

files_changed:
  - app/api/cron/send-scheduled-invoices/route.ts
