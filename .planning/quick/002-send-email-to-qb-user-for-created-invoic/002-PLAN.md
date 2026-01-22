---
phase: quick
plan: 002
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/services/quickbooks.service.ts
  - app/api/invoices/create/route.ts
autonomous: true

must_haves:
  truths:
    - "QB invoice emails are sent to customers when invoices are created"
    - "QB customer email is verified/updated before sending invoice"
    - "Email send failures are logged with actionable error details"
  artifacts:
    - path: "lib/services/quickbooks.service.ts"
      provides: "Customer email verification before invoice send"
    - path: "app/api/invoices/create/route.ts"
      provides: "Invoice creation with email send verification"
  key_links:
    - from: "quickbooksService.sendInvoice"
      to: "QuickBooks Invoice API"
      via: "POST /invoice/{id}/send"
---

<objective>
Fix QB invoice email not being received by customers.

Purpose: Currently invoices are created in QuickBooks but customers are not receiving emails. After investigation, the issue is that:
1. QuickBooks Sandbox does NOT actually send emails (only simulates the API call)
2. The customer's email in QuickBooks may not match our database (QB customer was created without email or with different email)

This plan ensures that before sending an invoice email, we verify the QB customer has the correct email address set, and provides better diagnostics when email sending fails.

Output: Customers will receive invoice emails when invoices are created in QuickBooks Production environment.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@lib/services/quickbooks.service.ts
@lib/services/invoice-approval.service.ts
@app/api/invoices/create/route.ts
@app/api/debug/check-qb-email-status/route.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add QB customer email verification and update method</name>
  <files>lib/services/quickbooks.service.ts</files>
  <action>
Add a new method `updateCustomerEmail(customerId: string, email: string)` to QuickbooksService that:
1. Reads the current QB customer to get the SyncToken (required for updates)
2. Updates the customer's PrimaryEmailAddr if it differs from the target email
3. Returns the updated customer object

Also add a method `ensureCustomerEmail(customerId: string, email: string)` that:
1. Gets the QB customer by ID
2. Checks if PrimaryEmailAddr.Address matches the provided email
3. If not, calls updateCustomerEmail to fix it
4. Returns true if email was already correct, or was successfully updated

The QB API endpoint for updating customer is:
POST /v3/company/{companyId}/customer
Body: { "Id": "xxx", "SyncToken": "x", "PrimaryEmailAddr": { "Address": "email@example.com" } }

Add logging for email verification/update operations.
  </action>
  <verify>
Run TypeScript compilation: `npx tsc --noEmit lib/services/quickbooks.service.ts`
Check methods exist in the service class.
  </verify>
  <done>
QuickbooksService has `updateCustomerEmail` and `ensureCustomerEmail` methods that can verify and fix customer email in QuickBooks.
  </done>
</task>

<task type="auto">
  <name>Task 2: Ensure customer email before sending invoice</name>
  <files>app/api/invoices/create/route.ts</files>
  <action>
Modify the invoice creation flow (lines 133-201) to ensure customer email is set in QuickBooks before sending:

1. After `getOrCreateCustomer` returns, call `quickbooksService.ensureCustomerEmail(qbCustomer.Id, customer.email)`
2. Log the result (whether email was already set or needed updating)
3. Keep the existing sendInvoice call, but now it will have the correct email in QB

Also add a check: if customer.email is empty/null, skip the email sending step but still create the invoice (log a warning instead of throwing).

Update the IntegrationLog entries to include whether the customer email was verified/updated.

This ensures that even if a QB customer was created earlier without email (or with different email), the invoice email will still be delivered.
  </action>
  <verify>
Run `npm run build` to verify no TypeScript errors.
Test by creating an invoice - check IntegrationLog for email verification entries.
  </verify>
  <done>
Invoice creation flow verifies QB customer email before sending invoice. Email send step has proper null checks and logging.
  </done>
</task>

<task type="auto">
  <name>Task 3: Add same email verification to approval flow</name>
  <files>lib/services/invoice-approval.service.ts</files>
  <action>
Update `syncApprovedInvoice` method (around line 277-289) to also verify customer email before sending:

1. After getting/creating the QB customer, call `quickbooksService.ensureCustomerEmail(qbCustomer.Id, invoice.customer.email)`
2. Log the verification result
3. The existing sendInvoice call at line 337 will now have the correct email

This ensures invoices going through the approval workflow also have proper email delivery.
  </action>
  <verify>
Run `npm run build` to verify no TypeScript errors.
Review the updated syncApprovedInvoice method logic.
  </verify>
  <done>
Approval workflow verifies QB customer email before sending invoice email.
  </done>
</task>

</tasks>

<verification>
1. `npm run build` completes without errors
2. Create a test invoice via the dashboard - check IntegrationLog for:
   - `customer_email_verified` or `customer_email_updated` entries
   - `invoice_email_sent` with SUCCESS status
3. If using QuickBooks Production: Customer should receive email
4. If using QuickBooks Sandbox: API call succeeds but no actual email (expected behavior)
</verification>

<success_criteria>
- QuickbooksService has methods to verify and update customer email
- Invoice creation flow verifies customer email in QB before sending
- Approval workflow verifies customer email in QB before sending
- All paths log email verification results for debugging
- Build passes with no TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/002-send-email-to-qb-user-for-created-invoic/002-SUMMARY.md`
</output>
