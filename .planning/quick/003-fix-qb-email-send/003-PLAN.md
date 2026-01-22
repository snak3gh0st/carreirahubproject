---
phase: quick
plan: 003
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/services/quickbooks.service.ts
  - app/api/debug/test-qb-email/route.ts
autonomous: true

must_haves:
  truths:
    - "QuickBooks invoice email send succeeds in Production environment"
    - "Customer receives invoice email from QuickBooks"
    - "API call returns proper success/failure result"
  artifacts:
    - path: "lib/services/quickbooks.service.ts"
      provides: "Fixed sendInvoice method with correct API format"
      contains: "POST body with BillEmail"
  key_links:
    - from: "quickbooksService.sendInvoice"
      to: "QB API /invoice/{id}/send"
      via: "POST request with email in body"
      pattern: "BillEmail.*Address"
---

<objective>
Fix QuickBooks invoice email sending that's not working in Production environment.

Purpose: Invoices are being created in QB but emails are not being sent to customers. The current implementation passes email as a query parameter, but QuickBooks API may require email in the POST body.

Output: Working sendInvoice method that successfully sends invoice emails in QB Production.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/quick/002-send-email-to-qb-user-for-created-invoic/002-SUMMARY.md

@lib/services/quickbooks.service.ts (lines 383-419: sendInvoice method)
@app/api/debug/test-qb-email/route.ts (testing endpoint)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Research and Fix sendInvoice API format</name>
  <files>lib/services/quickbooks.service.ts</files>
  <action>
  Update the sendInvoice method to use the correct QuickBooks API format:

  **Current (broken):**
  ```typescript
  const endpoint = email
    ? `/invoice/${invoiceId}/send?sendTo=${encodeURIComponent(email)}`
    : `/invoice/${invoiceId}/send`;
  ```

  **Fix approach - Try multiple methods in order:**

  1. **Primary fix:** Pass email in POST body (QB API documented format)
  ```typescript
  async sendInvoice(invoiceId: string, email?: string): Promise<any> {
    const endpoint = `/invoice/${invoiceId}/send`;

    // QB API accepts email override in POST body
    const body = email ? {
      "SparseUpdate": false,
      "Id": invoiceId,
      "BillEmail": {
        "Address": email
      }
    } : undefined;

    const result = await this.request(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });

    return result;
  }
  ```

  2. **Alternative if body doesn't work:** Try query parameter with correct encoding
  ```typescript
  const endpoint = email
    ? `/invoice/${invoiceId}/send?sendTo=${email}` // Without encodeURIComponent
    : `/invoice/${invoiceId}/send`;
  ```

  3. **Fallback consideration:** QB may require customer to have PrimaryEmailAddr set
     - The ensureCustomerEmail from quick-002 should handle this
     - But verify the flow is: set customer email -> create invoice -> send invoice

  **Implementation steps:**
  1. Modify sendInvoice to pass email in POST body
  2. Add detailed logging to capture exactly what QB returns
  3. Log the full request and response for debugging
  4. Keep the 500 error fallback logic but enhance it with more context

  **Logging to add:**
  ```typescript
  console.log(`[QuickBooks] Sending invoice ${invoiceId}`);
  console.log(`[QuickBooks] Email: ${email || 'using customer default'}`);
  console.log(`[QuickBooks] Request body:`, JSON.stringify(body, null, 2));
  // After response:
  console.log(`[QuickBooks] Send response:`, JSON.stringify(result, null, 2));
  ```

  **Keep existing:**
  - 500 error fallback with invoiceLink
  - Success logging
  - Integration logging in callers
  </action>
  <verify>
  1. `npm run build` passes without TypeScript errors
  2. The sendInvoice method now includes POST body with BillEmail
  3. Added logging captures request/response details
  </verify>
  <done>sendInvoice method updated to use POST body format for email parameter</done>
</task>

<task type="auto">
  <name>Task 2: Add enhanced debug endpoint with multiple send attempts</name>
  <files>app/api/debug/test-qb-email/route.ts</files>
  <action>
  Enhance the test-qb-email debug endpoint to:

  1. **Show QB customer email status before send:**
  ```typescript
  // Fetch QB customer to see their email
  const qbCustomer = await quickbooksService.getCustomerById(qbCustomerId);
  console.log('[DEBUG] QB Customer PrimaryEmailAddr:', qbCustomer.Customer?.PrimaryEmailAddr);
  ```

  2. **Show invoice BillEmail before send:**
  ```typescript
  // Fetch invoice to check BillEmail
  const qbInvoice = await quickbooksService.getInvoice(invoice.quickbooks_invoice_id);
  console.log('[DEBUG] Invoice BillEmail:', qbInvoice.Invoice?.BillEmail);
  ```

  3. **Return comprehensive debug info:**
  ```typescript
  return NextResponse.json({
    success: true,
    debug: {
      qbCustomerId: qbCustomer.Customer?.Id,
      qbCustomerEmail: qbCustomer.Customer?.PrimaryEmailAddr?.Address,
      invoiceBillEmail: qbInvoice.Invoice?.BillEmail?.Address,
      emailSentTo: invoice.customer.email,
      qbEnvironment: process.env.QUICKBOOKS_ENVIRONMENT,
    },
    result,
  });
  ```

  4. **Add query param to test without email override:**
  ```typescript
  const skipEmailOverride = searchParams.get('skipOverride') === 'true';
  const result = await quickbooksService.sendInvoice(
    invoice.quickbooks_invoice_id,
    skipEmailOverride ? undefined : invoice.customer.email
  );
  ```

  This allows testing:
  - `?invoiceId=xxx` - send with email override
  - `?invoiceId=xxx&skipOverride=true` - send using QB customer's default email
  </action>
  <verify>
  1. `npm run build` passes
  2. Debug endpoint returns qbCustomerEmail and invoiceBillEmail fields
  3. skipOverride query param is supported
  </verify>
  <done>Debug endpoint enhanced with comprehensive QB status info and multiple send modes</done>
</task>

<task type="auto">
  <name>Task 3: Test in Production and document findings</name>
  <files>lib/services/quickbooks.service.ts</files>
  <action>
  If user is available for testing, guide them through:

  1. **Deploy to Production** (or use current deployment)

  2. **Test email send:**
  ```bash
  # Test with email override
  curl -H "Cookie: <auth_cookie>" \
    "https://carreirausa.sigmaintel.io/api/debug/test-qb-email?invoiceId=<recent_invoice_id>"

  # Test without email override (uses QB customer default)
  curl -H "Cookie: <auth_cookie>" \
    "https://carreirausa.sigmaintel.io/api/debug/test-qb-email?invoiceId=<recent_invoice_id>&skipOverride=true"
  ```

  3. **Check IntegrationLog for results:**
  ```bash
  curl -H "Cookie: <auth_cookie>" \
    "https://carreirausa.sigmaintel.io/api/debug/check-qb-email-status"
  ```

  4. **Based on results, may need to adjust:**
  - If POST body format doesn't work, try alternative approaches
  - If customer email is the issue, enhance ensureCustomerEmail
  - Document what worked in SUMMARY.md

  **If no immediate testing available:**
  - Document the changes made
  - Provide clear testing instructions in SUMMARY
  - Note that this is a Production-only testable fix (Sandbox doesn't send emails)
  </action>
  <verify>
  1. Code deployed (or ready to deploy)
  2. Testing instructions documented
  3. Changes are production-safe (no breaking changes to existing flow)
  </verify>
  <done>Changes tested or testing instructions documented for Production validation</done>
</task>

</tasks>

<verification>
Overall verification:
1. `npm run build` passes with no errors
2. sendInvoice method uses POST body format for email
3. Debug endpoint provides comprehensive QB status
4. Existing invoice creation flow continues to work
5. 500 error fallback still functions (for resilience)
</verification>

<success_criteria>
- sendInvoice method updated to pass email in POST body (BillEmail format)
- Debug endpoint shows QB customer and invoice email status
- Build passes without TypeScript errors
- Testing instructions provided for Production validation
- No breaking changes to existing invoice creation flow
</success_criteria>

<output>
After completion, create `.planning/quick/003-fix-qb-email-send/003-SUMMARY.md`
</output>
