---
phase: quick-010
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/services/quickbooks.service.ts
  - app/api/invoices/[id]/route.ts
  - app/dashboard/invoices/[id]/page.tsx
autonomous: true

must_haves:
  truths:
    - "Invoice void operation uses QuickBooks POST /invoice?operation=void"
    - "Full invoice object with SyncToken is sent to QB void endpoint"
    - "After QB void, invoice is deleted from local database"
    - "UI uses 'Void' terminology instead of 'Delete'"
    - "Integration logs record 'invoice_voided' actions"
  artifacts:
    - path: "lib/services/quickbooks.service.ts"
      provides: "voidInvoice() method with correct QB API call"
      exports: ["voidInvoice"]
    - path: "app/api/invoices/[id]/route.ts"
      provides: "DELETE handler using void operation"
      min_lines: 200
    - path: "app/dashboard/invoices/[id]/page.tsx"
      provides: "Void button with correct terminology"
      min_lines: 100
  key_links:
    - from: "app/api/invoices/[id]/route.ts"
      to: "quickbooksService.voidInvoice()"
      via: "DELETE handler calls void"
      pattern: "voidInvoice\\(invoice\\.quickbooks_invoice_id\\)"
    - from: "lib/services/quickbooks.service.ts"
      to: "QuickBooks API"
      via: "POST with operation=void query param"
      pattern: "/invoice\\?operation=void"
---

<objective>
Fix invoice deletion to use QuickBooks void operation instead of hard delete, which is not supported by the QB API.

Purpose: QuickBooks API does not support hard deleting invoices. The correct operation is to VOID invoices using POST /invoice?operation=void, which sets balance to $0 and marks invoice as voided. After voiding in QB, we can safely delete from local database.

Output: Updated QuickBooks service with voidInvoice() method, API route using void operation, and UI with "Void" terminology.
</objective>

<execution_context>
@~/.config/Claude/get-shit-done/workflows/execute-plan.md
@~/.config/Claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md

## Current Implementation Issue
The current `deleteInvoice()` method in `quickbooks.service.ts` (lines 1223-1258) uses:
- Method: POST /invoice with X-QB-Operation: Delete header
- Payload: Just Id + SyncToken

This is INCORRECT. QuickBooks does not support hard delete for invoices.

## QuickBooks API Documentation
From https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/invoice#delete-an-invoice:

**Invoices cannot be deleted (hard delete not supported)**

Correct operation:
- Endpoint: POST /invoice?operation=void
- Payload: Full invoice object with SyncToken (not just Id + SyncToken)
- Effect: Sets balance to $0, marks invoice as voided
- Status: Invoice becomes "Voided" in QuickBooks

## Files to Modify
1. `lib/services/quickbooks.service.ts` — Rename deleteInvoice() to voidInvoice(), fix implementation
2. `app/api/invoices/[id]/route.ts` — Call voidInvoice() instead of deleteInvoice(), update logs
3. `app/dashboard/invoices/[id]/page.tsx` — Change "Delete" button to "Void" button, update messaging
</context>

<tasks>

<task type="auto">
  <name>Update QuickBooks service to use void operation</name>
  <files>lib/services/quickbooks.service.ts</files>
  <action>
Replace the `deleteInvoice()` method (lines 1223-1258) with `voidInvoice()`:

1. **Rename method**: `deleteInvoice()` → `voidInvoice()`

2. **Change implementation**:
   - Fetch full invoice object using `getInvoice(invoiceId)` to get SyncToken and all fields
   - Build endpoint: `/invoice?operation=void` (add query parameter)
   - Build payload: Full invoice object with SyncToken (NOT just Id + SyncToken)
   - Method: POST (same)
   - Headers: Remove X-QB-Operation header (use query param instead)

3. **Update logs**:
   - Console logs should say "voiding" instead of "deleting"
   - Success message: "Invoice {id} voided successfully"

**Important**: QuickBooks requires the FULL invoice object for void operations, not just Id + SyncToken. This is different from other operations.

**Pattern to follow**:
```typescript
// Fetch full invoice
const invoiceResponse = await this.getInvoice(invoiceId);
const invoice = invoiceResponse.Invoice;

// POST to /invoice?operation=void with full invoice object
const result = await this.request(`/invoice?operation=void`, {
  method: "POST",
  body: JSON.stringify(invoice),
});
```
  </action>
  <verify>
1. Search for `voidInvoice` method exists: `rg "async voidInvoice" lib/services/quickbooks.service.ts`
2. Verify endpoint uses query param: `rg "operation=void" lib/services/quickbooks.service.ts`
3. Verify full invoice object sent: Check that payload is `invoice` (full object), not just `{ Id, SyncToken }`
4. Method is exported: `rg "export.*voidInvoice" lib/services/quickbooks.service.ts` OR check class method is public
  </verify>
  <done>
- `deleteInvoice()` method renamed to `voidInvoice()`
- Method fetches full invoice object before voiding
- Endpoint uses `/invoice?operation=void` query parameter
- Full invoice object (not just Id + SyncToken) sent to QuickBooks
- Console logs use "void" terminology instead of "delete"
  </done>
</task>

<task type="auto">
  <name>Update API route to use void operation</name>
  <files>app/api/invoices/[id]/route.ts</files>
  <action>
Update the DELETE handler (lines 153-273) to call `voidInvoice()` instead of `deleteInvoice()`:

1. **Change method call** (line 209):
   - Old: `await quickbooksService.deleteInvoice(invoice.quickbooks_invoice_id)`
   - New: `await quickbooksService.voidInvoice(invoice.quickbooks_invoice_id)`

2. **Update console logs** (lines 202, 228, 232):
   - Change "delete/deleted/deleting" → "void/voided/voiding"
   - Example: "Attempting to void invoice..." instead of "Attempting to delete invoice..."

3. **Update IntegrationLog actions**:
   - Line 216: `invoice_deleted` → `invoice_voided`
   - Line 237: `invoice_delete_failed` → `invoice_void_failed`

4. **Update response message** (line 257):
   - Add note explaining void operation: "Invoice voided in QuickBooks and deleted locally"

5. **Update comment** (line 151):
   - Old: "Delete invoice from QuickBooks and local database"
   - New: "Void invoice in QuickBooks and delete from local database"

**Keep behavior**: Still delete from local database after voiding in QB (lines 252-255). Voiding in QB is permanent, so local delete is safe.
  </action>
  <verify>
1. Method call updated: `rg "voidInvoice" app/api/invoices/[id]/route.ts`
2. Integration log actions updated: `rg "invoice_voided|invoice_void_failed" app/api/invoices/[id]/route.ts`
3. Console logs updated: `rg "void" app/api/invoices/[id]/route.ts | grep -i "attempting\|success\|failed"`
4. Comment updated: `rg "Void invoice" app/api/invoices/[id]/route.ts`
  </verify>
  <done>
- DELETE handler calls `voidInvoice()` instead of `deleteInvoice()`
- All console logs use "void" terminology
- IntegrationLog actions updated: `invoice_voided`, `invoice_void_failed`
- API comments updated to reflect void operation
- Response still deletes from local database after QB void
  </done>
</task>

<task type="auto">
  <name>Update UI to use void terminology</name>
  <files>app/dashboard/invoices/[id]/page.tsx</files>
  <action>
Update the invoice detail page to use "Void" terminology instead of "Delete":

1. **Find the delete button** (search for button that calls DELETE API):
   - Change button label: "Delete Invoice" → "Void Invoice"
   - Icon can stay as Trash (common for void operations)

2. **Update confirmation dialog** (if exists):
   - Old: "Are you sure you want to delete this invoice?"
   - New: "Void invoice? This will mark it as voided in QuickBooks and remove it from the system."
   - Add explanation: "Voiding sets the balance to $0 and marks the invoice as voided. This operation cannot be undone."

3. **Update success message** (toast/notification after delete):
   - Old: "Invoice deleted successfully"
   - New: "Invoice voided successfully"

4. **Update error messages** (if any reference "delete"):
   - Change to "void" terminology

**Search pattern**: Look for strings containing "delete" (case-insensitive) in the file and update to "void" where appropriate.
  </action>
  <verify>
1. Button label uses "Void": `rg -i "void.{0,20}invoice" app/dashboard/invoices/[id]/page.tsx`
2. Confirmation dialog updated: `rg -i "void.{0,50}quickbooks" app/dashboard/invoices/[id]/page.tsx`
3. Success message updated: `rg -i "voided successfully" app/dashboard/invoices/[id]/page.tsx`
4. No remaining "delete invoice" references: `rg -i "delete.{0,10}invoice" app/dashboard/invoices/[id]/page.tsx` should return minimal/no results
  </verify>
  <done>
- Button labeled "Void Invoice" instead of "Delete Invoice"
- Confirmation dialog explains void operation and QuickBooks behavior
- Success/error messages use "void" terminology
- User understands void operation cannot be undone
  </done>
</task>

</tasks>

<verification>
**Manual Testing:**
1. Login as ADMIN or FINANCE user
2. Navigate to invoice detail page
3. Click "Void Invoice" button
4. Confirm dialog shows correct messaging about voiding
5. Check IntegrationLog for "invoice_voided" entry with SUCCESS status
6. Verify invoice is voided in QuickBooks (status = "Voided", balance = $0)
7. Verify invoice deleted from local database

**API Verification:**
```bash
# Check QuickBooks service has voidInvoice method
rg "voidInvoice" lib/services/quickbooks.service.ts

# Check API route calls voidInvoice
rg "voidInvoice" app/api/invoices/[id]/route.ts

# Check IntegrationLog actions updated
rg "invoice_voided" app/api/invoices/[id]/route.ts

# Check UI uses void terminology
rg -i "void" app/dashboard/invoices/[id]/page.tsx
```
</verification>

<success_criteria>
**Implementation Complete:**
- [ ] `quickbooks.service.ts` has `voidInvoice()` method (not `deleteInvoice()`)
- [ ] `voidInvoice()` uses POST /invoice?operation=void endpoint
- [ ] Full invoice object with SyncToken sent to QuickBooks
- [ ] API route DELETE handler calls `voidInvoice()`
- [ ] IntegrationLog uses `invoice_voided` and `invoice_void_failed` actions
- [ ] UI button labeled "Void Invoice" with appropriate confirmation
- [ ] All console logs and messages use "void" terminology

**QuickBooks API Compliance:**
- [ ] No hard delete attempted (no DELETE method or X-QB-Operation: Delete)
- [ ] Void operation follows QB API documentation
- [ ] SyncToken properly included in void request

**User Experience:**
- [ ] User understands void operation vs delete
- [ ] Confirmation dialog explains consequences
- [ ] Success message confirms voiding completed
</success_criteria>

<output>
After completion, create `.planning/quick/010-fix-invoice-deletion-to-use-quickbooks-v/010-SUMMARY.md`
</output>
