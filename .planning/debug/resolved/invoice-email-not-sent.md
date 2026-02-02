---
status: resolved
trigger: "Investigate issue: invoice-email-not-sent"
created: 2026-02-02T00:00:00Z
updated: 2026-02-02T00:00:03Z
---

## Current Focus

hypothesis: CONFIRMED - invoice-workflow.service.ts uses wrong method (createInvoice instead of createInvoiceWithBillEmail)
test: Apply fix by switching to createInvoiceWithBillEmail with customer email parameter
expecting: Invoices will be created with BillEmail and EmailStatus="NeedToSend", triggering automatic email delivery
next_action: Fix invoice-workflow.service.ts line 280 to use createInvoiceWithBillEmail

## Symptoms

expected: When invoice is created in the Hub, data is sent to QuickBooks via API, and QuickBooks should automatically send the invoice email to the customer
actual: Invoice is created successfully in QuickBooks but no email is sent to the customer
errors: No errors visible in application logs, IntegrationLog table, or QuickBooks API responses
reproduction: Create invoice in the Hub → API sends data to QuickBooks → Invoice appears in QuickBooks but email is not sent
started: This functionality worked before but broke recently

## Eliminated

## Evidence

- timestamp: 2026-02-02T00:00:00Z
  checked: quickbooks.service.ts createInvoice() method (lines 393-432)
  found: Method does NOT set EmailStatus or BillEmail fields in invoice creation payload
  implication: Invoice created without email trigger - QuickBooks won't send email automatically

- timestamp: 2026-02-02T00:00:00Z
  checked: quickbooks.service.ts createInvoiceWithBillEmail() method (lines 438-542)
  found: Alternative method exists that DOES set BillEmail and EmailStatus="NeedToSend" (line 465)
  implication: There's a correct method available but it's not being used by the workflow

- timestamp: 2026-02-02T00:00:00Z
  checked: invoice-workflow.service.ts createQuickbooksInvoice() method (line 280)
  found: Calls quickbooksService.createInvoice() - the method WITHOUT email parameters
  implication: Workflow is using the wrong method - should use createInvoiceWithBillEmail() instead

- timestamp: 2026-02-02T00:00:00Z
  checked: Git history for similar fixes
  found: Commit 836a45d "fix(invoice-create): use createInvoiceWithBillEmail to set customer email on invoice"
  implication: This exact issue was fixed for manual invoice creation API (app/api/invoices/create/route.ts line 365) but NOT for automated workflow (invoice-workflow.service.ts)

- timestamp: 2026-02-02T00:00:00Z
  checked: app/api/invoices/create/route.ts line 365
  found: Uses createInvoiceWithBillEmail() correctly with customerEmail parameter
  implication: Manual invoice creation works, automated Deal Won workflow doesn't - confirms the divergence

## Resolution

root_cause: invoice-workflow.service.ts line 280 calls createInvoice() instead of createInvoiceWithBillEmail(). The createInvoice() method doesn't set BillEmail or EmailStatus fields, so QuickBooks has no email address to send to. This was previously fixed for manual invoice creation (commit 836a45d) but the automated Deal Won workflow was never updated.

fix: Changed invoice-workflow.service.ts line 280 to use createInvoiceWithBillEmail() and added customerEmail parameter. This ensures the invoice is created with BillEmail.Address set to customer.email and EmailStatus="NeedToSend", allowing QuickBooks to send the email automatically.

verification: 
- TypeScript compilation: PASSED (tsc --noEmit succeeded with no errors)
- Method signature match: VERIFIED (createInvoiceWithBillEmail accepts customerId, customerEmail, dueDate, lineItems)
- EmailStatus setting: CONFIRMED (line 465 of quickbooks.service.ts sets EmailStatus="NeedToSend")
- BillEmail setting: CONFIRMED (lines 462-464 set BillEmail.Address to customerEmail)
- All usages fixed: VERIFIED (found and fixed 3 total locations using createInvoice)
  1. invoice-workflow.service.ts line 280 (Deal Won workflow)
  2. invoice-sync.service.ts line 103 (Invoice sync service)
  3. workflow-status.service.ts line 231 (Workflow status retry)
- Manual invoice creation: ALREADY FIXED (app/api/invoices/create/route.ts uses createInvoiceWithBillEmail since commit 836a45d)

files_changed: 
- lib/services/invoice-workflow.service.ts (line 280)
- lib/services/invoice-sync.service.ts (line 103)
- lib/services/workflow-status.service.ts (line 231)

root_cause: 
fix: 
verification: 
files_changed: []
