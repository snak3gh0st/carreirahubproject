---
phase: quick
plan: "020"
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/services/quickbooks.service.ts
  - app/api/invoices/create/route.ts
autonomous: true

must_haves:
  truths:
    - "QuickBooks API error details are captured and logged"
    - "400 Bad Request root cause is identified and fixed"
    - "Single payment invoices can be created successfully"
  artifacts:
    - path: "lib/services/quickbooks.service.ts"
      provides: "Enhanced error logging for createInvoiceWithBillEmail"
    - path: "app/api/invoices/create/route.ts"
      provides: "Fixed invoice creation payload"
  key_links:
    - from: "app/api/invoices/create/route.ts"
      to: "quickbooksService.createInvoiceWithBillEmail"
      via: "Method call with invoice data"
      pattern: "createInvoiceWithBillEmail"
---

<objective>
Fix QuickBooks API 400 Bad Request error when creating single payment ("a vista") invoices

Purpose: Restore invoice creation functionality that was broken after quick-018 changes
Output: Working single payment invoice creation with proper error logging
</objective>

<execution_context>
@/Users/pauloloureiro/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pauloloureiro/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@lib/services/quickbooks.service.ts (lines 436-487 - createInvoiceWithBillEmail method)
@app/api/invoices/create/route.ts (lines 310-325 - QB invoice creation)

**Problem Context:**
- Quick-018 added single payment invoice detection (`isSinglePayment` flag)
- QuickBooks API now returns 400 Bad Request when creating single payment invoices
- The error occurs in `createInvoiceWithBillEmail` method
- This is BLOCKING invoice creation for "a vista" (single payment) scenarios

**QuickBooks API 400 Error Common Causes:**
1. Invalid ItemRef - service item ID doesn't exist in QB
2. Invalid amount format (negative, null, or non-numeric)
3. Invalid date format for TxnDate or DueDate
4. Missing BillAddr on customer
5. Invalid DocNumber (too long, special characters)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Diagnostic Error Logging to createInvoiceWithBillEmail</name>
  <files>lib/services/quickbooks.service.ts</files>
  <action>
    Enhance the `createInvoiceWithBillEmail` method (around line 437) to capture the full error response from QuickBooks:

    1. Wrap the API call in try/catch that captures the raw response text
    2. Parse the QuickBooks error response which typically includes:
       - `Fault.Error[].Message` - Human readable error
       - `Fault.Error[].Detail` - Detailed error info
       - `Fault.Error[].code` - QB error code
    3. Log the complete error payload to console and IntegrationLog
    4. Include the request payload that caused the error for debugging

    The enhanced error should look like:
    ```typescript
    } catch (error: any) {
      console.error(`[QuickBooks] Invoice creation failed:`);
      console.error(`[QuickBooks] Request payload:`, JSON.stringify(invoiceData, null, 2));

      // Parse QB error response if available
      if (error.responseText) {
        try {
          const errorBody = JSON.parse(error.responseText);
          console.error(`[QuickBooks] QB Error Response:`, JSON.stringify(errorBody, null, 2));
          if (errorBody.Fault?.Error) {
            for (const err of errorBody.Fault.Error) {
              console.error(`[QuickBooks] Error ${err.code}: ${err.Message} - ${err.Detail}`);
            }
          }
        } catch {
          console.error(`[QuickBooks] Raw error text:`, error.responseText);
        }
      }
      throw error;
    }
    ```
  </action>
  <verify>
    grep -n "QB Error Response" lib/services/quickbooks.service.ts
    # Should show the new error logging code
  </verify>
  <done>Error details are logged including request payload and QB error response</done>
</task>

<task type="auto">
  <name>Task 2: Fix Invoice Creation Payload Validation</name>
  <files>app/api/invoices/create/route.ts</files>
  <action>
    Based on the diagnostic logging or known issues, fix the invoice creation payload.

    **Most likely fixes needed:**

    1. **Validate serviceItemId before use** - Ensure the item exists in QB:
       - Check if serviceItemId is a demo/placeholder ID like "demo-service-1"
       - Log warning if item ID might not exist in QB

    2. **Ensure amount is always positive number**:
       ```typescript
       const invoiceAmount = Math.max(0.01, Number(amount.toFixed(2)));
       ```

    3. **Validate line items have valid itemRef**:
       - The `lineItems[].serviceItemId` must be a valid QB Item ID
       - For single payments, the item from `data.items[0].serviceItemId` is used
       - This ID must exist in QuickBooks

    4. **Add defensive checks before QB API call** (around line 323):
       ```typescript
       // Validate QB invoice data before API call
       if (!qbInvoiceData.lineItems || qbInvoiceData.lineItems.length === 0) {
         throw new Error('Invoice must have at least one line item');
       }
       for (const item of qbInvoiceData.lineItems) {
         if (!item.itemRef || item.itemRef === 'demo-service-1' || item.itemRef === 'demo-service-2') {
           console.error('[INVOICE_CREATE] Invalid itemRef:', item.itemRef);
           throw new Error(`Invalid service item ID: ${item.itemRef}. Please select a valid QuickBooks service item.`);
         }
         if (!item.amount || item.amount <= 0) {
           throw new Error(`Invalid amount for line item: ${item.amount}`);
         }
       }
       ```

    5. **Log the payload before sending** for debugging:
       ```typescript
       console.log('[INVOICE_CREATE] QB Invoice payload:', JSON.stringify(qbInvoiceData, null, 2));
       ```

    **NOTE:** If the error is due to a specific field, update the payload structure accordingly. The diagnostic logging from Task 1 will reveal the exact issue.
  </action>
  <verify>
    grep -n "Invalid service item ID" app/api/invoices/create/route.ts
    # Should show the validation code

    npx tsc --noEmit --skipLibCheck 2>&1 | head -20
    # Should pass with no errors
  </verify>
  <done>Invoice payload validation added, defensive checks prevent invalid API calls</done>
</task>

<task type="auto">
  <name>Task 3: Test and Commit Fix</name>
  <files>lib/services/quickbooks.service.ts, app/api/invoices/create/route.ts</files>
  <action>
    1. Run TypeScript compilation to ensure no errors:
       ```bash
       npx tsc --noEmit
       ```

    2. Create atomic commit with the fix:
       ```bash
       git add lib/services/quickbooks.service.ts app/api/invoices/create/route.ts
       git commit -m "fix(quick-020): add QB error diagnostics and validate invoice payload

       - Add detailed error logging in createInvoiceWithBillEmail
       - Log QB Fault.Error details (code, message, detail)
       - Validate line items before QB API call
       - Prevent invalid itemRef from reaching QB API
       - Ensure amounts are positive numbers

       Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
       ```

    3. Document the fix in summary
  </action>
  <verify>
    git log -1 --oneline
    # Should show the commit

    git diff HEAD~1 --stat
    # Should show changes to both files
  </verify>
  <done>Fix committed with proper error diagnostics and payload validation</done>
</task>

</tasks>

<verification>
After completing all tasks:
1. TypeScript compiles without errors
2. Error logging captures QB API response details
3. Invoice payload validation prevents invalid data
4. Changes committed to git
</verification>

<success_criteria>
- [x] QuickBooks error response details are logged (including Fault.Error)
- [x] Invoice creation validates payload before QB API call
- [x] Invalid itemRef (demo IDs) are caught before API call
- [x] TypeScript compilation passes
- [x] Atomic commit created with descriptive message
</success_criteria>

<output>
After completion, create `.planning/quick/020-quickbooks-api-error-400-bad-request-alg/020-SUMMARY.md`
</output>
