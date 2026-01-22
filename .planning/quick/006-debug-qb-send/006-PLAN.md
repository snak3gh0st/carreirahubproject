---
phase: quick
plan: 006
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/services/quickbooks.service.ts
  - app/api/debug/verbose-qb-send/route.ts
autonomous: true

must_haves:
  truths:
    - "Every QB /send API call logs full request URL, headers, body"
    - "Every QB /send API response logs HTTP status, headers, and complete body"
    - "Response parsing checks for QB-specific success indicators"
    - "Alternative approach (BillEmail on creation) can be tested"
  artifacts:
    - path: "lib/services/quickbooks.service.ts"
      provides: "Enhanced sendInvoice with verbose diagnostic logging"
      contains: "[QB_SEND_DEBUG]"
    - path: "app/api/debug/verbose-qb-send/route.ts"
      provides: "Comprehensive debug endpoint testing all approaches"
      exports: ["GET"]
  key_links:
    - from: "app/api/debug/verbose-qb-send/route.ts"
      to: "lib/services/quickbooks.service.ts"
      via: "sendInvoice, sendInvoiceWithBillEmailOnCreation"
      pattern: "quickbooksService\\.send"
---

<objective>
Diagnose why QB invoices stay in DRAFT status despite sendInvoice() appearing to succeed.

Purpose: Determine root cause of email delivery failure - whether it's the /send endpoint format, response parsing, or the need to set BillEmail during invoice creation instead of after.

Output: Verbose logging in sendInvoice() and debug endpoint that tests multiple approaches to identify working solution.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@lib/services/quickbooks.service.ts
@app/api/debug/test-qb-email/route.ts
@app/api/invoices/create/route.ts

Prior attempts (quick-003) fixed POST body format but emails still may not be sending. The issue might be:
1. QB /send endpoint returns success but doesn't actually trigger email
2. QB requires BillEmail to be set ON THE INVOICE during creation, not just in /send body
3. QB response contains error indicators we're not checking (Fault, Error, warnings)
4. Different behavior between Production and Sandbox environments
5. Invoice must be in specific state before /send works
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Verbose Diagnostic Logging to sendInvoice()</name>
  <files>lib/services/quickbooks.service.ts</files>
  <action>
  Enhance sendInvoice() method with comprehensive diagnostic logging at every step:

  1. BEFORE REQUEST - Log:
     - `[QB_SEND_DEBUG] === SEND INVOICE START ===`
     - `[QB_SEND_DEBUG] Invoice ID: ${invoiceId}`
     - `[QB_SEND_DEBUG] Email: ${email || 'not provided'}`
     - `[QB_SEND_DEBUG] Full endpoint URL: ${this.baseUrl}/v3/company/${this.companyId}/invoice/${invoiceId}/send`
     - `[QB_SEND_DEBUG] Environment: ${process.env.QUICKBOOKS_ENVIRONMENT}`
     - `[QB_SEND_DEBUG] Request body: ${JSON.stringify(body, null, 2)}`

  2. MAKE THE REQUEST - Use fetch directly (not this.request()) to capture raw response:
     - Make the fetch call with same auth headers
     - Capture raw response BEFORE parsing as JSON

  3. AFTER RESPONSE - Log:
     - `[QB_SEND_DEBUG] HTTP Status: ${response.status} ${response.statusText}`
     - `[QB_SEND_DEBUG] Response Headers: ${JSON.stringify(Object.fromEntries(response.headers))}`
     - `[QB_SEND_DEBUG] Raw Response Body: ${responseText}` (before JSON parse)
     - If parsed: `[QB_SEND_DEBUG] Parsed Response: ${JSON.stringify(result, null, 2)}`

  4. CHECK QB-SPECIFIC SUCCESS INDICATORS in response:
     - `result.Invoice` - Invoice object returned means success
     - `result.Invoice.EmailStatus` - Should be "EmailSent" after successful send
     - `result.Invoice.DeliveryInfo` - Contains delivery details
     - `result.Fault` - QuickBooks error object
     - `result.Error` - Alternative error format
     - `result.warnings` - Non-fatal warnings
     - Log each check: `[QB_SEND_DEBUG] EmailStatus: ${result?.Invoice?.EmailStatus}`

  5. DETERMINE ACTUAL SUCCESS:
     - Check if EmailStatus changed from "NotSet"/"NeedToSend" to "EmailSent"
     - Return enhanced result object with diagnostic info

  Create new method signature that returns diagnostic info:
  ```typescript
  interface SendInvoiceResult {
    success: boolean;
    httpStatus: number;
    emailStatus?: string;  // QB's EmailStatus field
    qbResponse: any;
    diagnostics: {
      endpoint: string;
      requestBody: any;
      responseHeaders: Record<string, string>;
      rawResponse: string;
      parsedResponse: any;
      hasFault: boolean;
      hasError: boolean;
      emailStatusBefore?: string;
      emailStatusAfter?: string;
    };
  }
  ```

  Keep existing sendInvoice() signature for backwards compatibility, but add sendInvoiceVerbose() that returns full diagnostics.
  </action>
  <verify>
  npm run build passes without TypeScript errors.
  Search for "[QB_SEND_DEBUG]" in the file - should find 10+ log statements.
  </verify>
  <done>sendInvoice() logs every step with [QB_SEND_DEBUG] prefix. New sendInvoiceVerbose() method returns full diagnostic object including HTTP status, response headers, raw body, and QB-specific fields like EmailStatus.</done>
</task>

<task type="auto">
  <name>Task 2: Create Comprehensive Debug Endpoint with Multiple Approaches</name>
  <files>app/api/debug/verbose-qb-send/route.ts</files>
  <action>
  Create debug endpoint that tests multiple approaches to sending QB invoices:

  ```typescript
  // GET /api/debug/verbose-qb-send?invoiceId=xxx&approach=1
  // Approaches:
  // 1 = Standard /send with email in body (current approach)
  // 2 = /send without email (use invoice's BillEmail)
  // 3 = First fetch invoice, check BillEmail, then send
  // 4 = Update invoice to add BillEmail, then send
  // all = Try all approaches and compare results
  ```

  Implementation:

  1. Auth check (ADMIN/FINANCE only)

  2. Get invoice from database, verify it has quickbooks_invoice_id

  3. Initialize QB service

  4. APPROACH 1: Standard send with email override
     - Call sendInvoiceVerbose(qbInvoiceId, customerEmail)
     - Capture full diagnostic output

  5. APPROACH 2: Send without email (rely on invoice's BillEmail)
     - Call sendInvoiceVerbose(qbInvoiceId) // no email param
     - Capture full diagnostic output

  6. APPROACH 3: Fetch invoice first, check state
     - GET invoice from QB: getInvoice(qbInvoiceId)
     - Log current BillEmail status
     - Log current EmailStatus
     - Then call sendInvoiceVerbose()
     - Compare EmailStatus before/after

  7. APPROACH 4: Update invoice with BillEmail BEFORE sending
     - Update invoice to set BillEmail: `{ Id, SyncToken, BillEmail: { Address: email } }`
     - Then call sendInvoiceVerbose()
     - This tests if email must be on invoice before /send works

  8. Return comprehensive response:
  ```json
  {
    "invoiceId": "xxx",
    "qbInvoiceId": "yyy",
    "approach": 1,
    "customerEmail": "email@example.com",
    "qbEnvironment": "production",
    "result": {
      "success": boolean,
      "httpStatus": number,
      "emailStatus": "EmailSent" | "NotSet" | "NeedToSend",
      "diagnostics": { ... full diagnostic object ... }
    },
    "conclusions": [
      "QB returned 200 OK",
      "EmailStatus changed from NotSet to EmailSent", // or didn't change
      "No Fault/Error in response",
      "Invoice BillEmail was: email@example.com"
    ],
    "recommendation": "Try approach 4 if approach 1 shows EmailStatus didn't change"
  }
  ```

  9. Log to IntegrationLog with action="verbose_qb_send_test"
  </action>
  <verify>
  npm run build passes.
  File exists at app/api/debug/verbose-qb-send/route.ts.
  Endpoint exports GET function.
  </verify>
  <done>Debug endpoint created that tests 4 different approaches to QB invoice sending and returns comprehensive diagnostics including EmailStatus before/after, raw response, and recommendations for next steps.</done>
</task>

<task type="auto">
  <name>Task 3: Add createInvoiceWithBillEmail Method</name>
  <files>lib/services/quickbooks.service.ts</files>
  <action>
  Add alternative invoice creation method that sets BillEmail during creation (not after):

  ```typescript
  /**
   * Create Invoice with BillEmail set during creation
   * Some QB configurations require email on invoice before /send works
   */
  async createInvoiceWithBillEmail(data: {
    customerId: string;
    customerEmail: string;  // REQUIRED - will be set as BillEmail
    dueDate?: Date;
    docNumber?: string;
    lineItems: Array<{
      description: string;
      amount: number;
      itemRef?: string;
    }>;
  }): Promise<any> {
    const invoiceData = {
      CustomerRef: {
        value: data.customerId,
      },
      DocNumber: data.docNumber,
      BillEmail: {
        Address: data.customerEmail,  // SET EMAIL ON CREATION
      },
      EmailStatus: "NeedToSend",  // Tell QB this needs to be sent
      TxnDate: new Date().toISOString().split("T")[0],
      DueDate: data.dueDate
        ? data.dueDate.toISOString().split("T")[0]
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
      Line: data.lineItems.map((item) => ({
        Amount: item.amount,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: {
            value: item.itemRef || "1",
          },
        },
        Description: item.description,
      })),
    };

    console.log(`[QuickBooks] Creating invoice WITH BillEmail: ${data.customerEmail}`);
    console.log(`[QuickBooks] Invoice payload:`, JSON.stringify(invoiceData, null, 2));

    const result = await this.request("/invoice", {
      method: "POST",
      body: JSON.stringify(invoiceData),
    });

    console.log(`[QuickBooks] Created invoice ${result.Invoice?.Id} with BillEmail: ${result.Invoice?.BillEmail?.Address}`);
    console.log(`[QuickBooks] Invoice EmailStatus: ${result.Invoice?.EmailStatus}`);

    return result.Invoice;
  }
  ```

  Also add updateInvoiceBillEmail method for setting email on existing invoices:

  ```typescript
  /**
   * Update invoice to set/change BillEmail
   * Requires fetching invoice first to get SyncToken
   */
  async updateInvoiceBillEmail(invoiceId: string, email: string): Promise<any> {
    console.log(`[QuickBooks] Updating invoice ${invoiceId} BillEmail to ${email}...`);

    // First fetch the invoice to get SyncToken
    const invoiceResponse = await this.getInvoice(invoiceId);
    const invoice = invoiceResponse.Invoice;

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found in QuickBooks`);
    }

    console.log(`[QuickBooks] Current invoice EmailStatus: ${invoice.EmailStatus}`);
    console.log(`[QuickBooks] Current invoice BillEmail: ${invoice.BillEmail?.Address}`);

    // Sparse update to set BillEmail
    const updateData = {
      Id: invoice.Id,
      SyncToken: invoice.SyncToken,
      sparse: true,
      BillEmail: {
        Address: email,
      },
    };

    const result = await this.request("/invoice", {
      method: "POST",
      body: JSON.stringify(updateData),
    });

    console.log(`[QuickBooks] Updated invoice ${invoiceId}`);
    console.log(`[QuickBooks] New BillEmail: ${result.Invoice?.BillEmail?.Address}`);
    console.log(`[QuickBooks] New EmailStatus: ${result.Invoice?.EmailStatus}`);

    return result.Invoice;
  }
  ```
  </action>
  <verify>
  npm run build passes.
  Grep for "createInvoiceWithBillEmail" finds the new method.
  Grep for "updateInvoiceBillEmail" finds the new method.
  </verify>
  <done>Two new methods added: createInvoiceWithBillEmail() sets email during creation, updateInvoiceBillEmail() adds email to existing invoices. Both log current EmailStatus to help diagnose the issue.</done>
</task>

</tasks>

<verification>
1. Build passes: `npm run build` exits 0
2. Verbose logging: `grep -c "QB_SEND_DEBUG" lib/services/quickbooks.service.ts` returns 10+
3. Debug endpoint exists: `ls app/api/debug/verbose-qb-send/route.ts`
4. New methods exist: `grep "createInvoiceWithBillEmail\|updateInvoiceBillEmail" lib/services/quickbooks.service.ts`
</verification>

<success_criteria>
- sendInvoice() logs every step with [QB_SEND_DEBUG] prefix including raw HTTP response
- Debug endpoint tests 4 different approaches and returns EmailStatus before/after
- createInvoiceWithBillEmail() method available for testing email-on-creation approach
- updateInvoiceBillEmail() method available for pre-setting email before /send
- All code compiles without TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/006-debug-qb-send/006-SUMMARY.md` using the summary template.

Include in summary:
1. Which diagnostic approaches were added
2. Key log prefixes to search for ([QB_SEND_DEBUG])
3. Debug endpoint URL and parameters
4. Recommended testing sequence:
   - First run approach 1, check if EmailStatus changes
   - If not, try approach 4 (update BillEmail first)
   - If still failing, try createInvoiceWithBillEmail for new invoices
5. Next steps based on what diagnostics reveal
</output>
