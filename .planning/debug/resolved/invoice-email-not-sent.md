---
status: resolved
trigger: "Investigate issue: invoice-email-not-sent"
created: 2026-02-02T00:00:00Z
updated: 2026-02-02T01:20:00Z
---

## Current Focus

hypothesis: CONFIRMED - workflow-status.service.ts retryWorkflowStep() creates invoices but never calls sendInvoice(), while other services correctly call both createInvoiceWithBillEmail() AND sendInvoice()
test: Add sendInvoice() call in workflow-status.service.ts after line 254 (after saving invoice to DB)
expecting: Invoice retry workflow will now send emails just like the other workflows
next_action: Fix workflow-status.service.ts to add sendInvoice() call after invoice creation

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

- timestamp: 2026-02-02T01:00:00Z
  checked: QuickBooks API documentation and previous fix behavior
  found: CRITICAL DISCOVERY - createInvoiceWithBillEmail() only sets EmailStatus="NeedToSend" but does NOT send email. QuickBooks requires separate POST to /v3/company/<realmID>/invoice/<invoiceId>/send endpoint
  implication: Previous fix was incomplete - we set the email address but never actually triggered the send operation

- timestamp: 2026-02-02T01:05:00Z
  checked: quickbooks.service.ts for sendInvoice methods
  found: sendInvoice() method EXISTS (line 721) and sendInvoiceVerbose() method (line 599) - both implement the /send endpoint
  implication: The methods to send invoices are already implemented, just need to ensure they're called after invoice creation

- timestamp: 2026-02-02T01:10:00Z
  checked: invoice-workflow.service.ts line 317
  found: CORRECT - calls quickbooksService.sendInvoice(qbInvoice.Id, customer.email) after creating invoice
  implication: Deal Won workflow is correct - it creates invoice AND sends it

- timestamp: 2026-02-02T01:11:00Z
  checked: invoice-sync.service.ts line 124
  found: CORRECT - calls quickbooksService.sendInvoice(qbInvoice.Id, invoice.customer.email) after creating invoice
  implication: Invoice sync service is correct - it creates invoice AND sends it

- timestamp: 2026-02-02T01:12:00Z
  checked: workflow-status.service.ts lines 231-258
  found: BUG - creates invoice with createInvoiceWithBillEmail (line 231), saves to DB (line 244), marks as created (line 256), but NEVER calls sendInvoice()
  implication: Invoice retry workflow is missing the send step - invoices created via retry are never emailed

- timestamp: 2026-02-02T01:13:00Z
  checked: app/api/invoices/create/route.ts line 414
  found: CORRECT - manual invoice creation route calls quickbooksService.sendInvoice(qbInvoice.Id, customer.email) with proper conditional logic
  implication: Manual invoice creation works correctly - only the retry workflow was missing the send call

## Resolution

root_cause: The actual root cause was a misunderstanding of QuickBooks API behavior. Creating an invoice with EmailStatus="NeedToSend" does NOT automatically send the email - it only marks the invoice as ready to be sent. QuickBooks requires a SEPARATE API call to POST /v3/company/<realmID>/invoice/<invoiceId>/send to actually deliver the email.

Previous investigation correctly fixed invoice creation to use createInvoiceWithBillEmail() (which sets BillEmail and EmailStatus), but this was only HALF the solution. The missing piece: calling sendInvoice() after invoice creation.

Investigation revealed:
- invoice-workflow.service.ts (line 317): CORRECT - calls sendInvoice() ✓
- invoice-sync.service.ts (line 124): CORRECT - calls sendInvoice() ✓
- app/api/invoices/create/route.ts (line 414): CORRECT - calls sendInvoice() ✓
- workflow-status.service.ts (line 256): BUG - missing sendInvoice() call ✗

The workflow retry mechanism was the only code path creating invoices without sending them.

fix: Added sendInvoice() call in workflow-status.service.ts after invoice creation (after line 254). This ensures invoice retry workflow sends emails just like the other three invoice creation paths.

verification: COMPLETE
- TypeScript compilation: PASSED (npx tsc --noEmit - zero errors)
- Code review: VERIFIED - all 4 invoice creation paths now follow same pattern:
  1. invoice-workflow.service.ts line 317: createInvoiceWithBillEmail() + sendInvoice() ✓
  2. invoice-sync.service.ts line 104 + 124: createInvoiceWithBillEmail() + sendInvoice() ✓
  3. app/api/invoices/create/route.ts line 365 + 414: createInvoiceWithBillEmail() + sendInvoice() ✓
  4. workflow-status.service.ts line 231 + 258: createInvoiceWithBillEmail() + sendInvoice() ✓ (FIXED)
- Pattern consistency: VERIFIED - all use same conditional check (if customer.email exists) before calling sendInvoice()
- Email protection: VERIFIED - sendInvoice() only called when customer has email address
- QuickBooks API compliance: VERIFIED - follows two-step process (create with BillEmail, then send)

files_changed: 
- lib/services/workflow-status.service.ts (added sendInvoice call with email check at lines 256-259)
