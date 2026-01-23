---
quick_task: 008
type: execute
description: Add delete invoice button with QuickBooks integration
wave: 1
autonomous: true
files_modified:
  - app/api/invoices/[id]/route.ts
  - app/dashboard/invoices/page.tsx
  - app/dashboard/customers/[id]/page.tsx

must_haves:
  truths:
    - "User can delete invoice from invoice list page"
    - "User can delete invoice from customer detail page"
    - "Invoice deleted from QuickBooks if quickbooks_id exists"
    - "Invoice deleted from local database"
    - "Deletion logged in IntegrationLog"
    - "Confirmation dialog prevents accidental deletion"
    - "UI updates after deletion"
  artifacts:
    - path: "app/api/invoices/[id]/route.ts"
      provides: "DELETE endpoint for invoice deletion"
      exports: ["DELETE"]
    - path: "app/dashboard/invoices/page.tsx"
      provides: "Delete button in invoice table"
      contains: "delete button"
    - path: "app/dashboard/customers/[id]/page.tsx"
      provides: "Delete button in customer invoice table"
      contains: "delete button"
  key_links:
    - from: "app/dashboard/invoices/page.tsx"
      to: "/api/invoices/[id]"
      via: "DELETE fetch on button click"
      pattern: "fetch.*DELETE.*invoices"
    - from: "DELETE /api/invoices/[id]"
      to: "quickbooksService.deleteInvoice"
      via: "QuickBooks API call if quickbooks_invoice_id exists"
      pattern: "quickbooksService\\.deleteInvoice"
---

<objective>
Add delete functionality for invoices with QuickBooks synchronization.

Purpose: Enable Finance team to remove erroneous invoices from both local database and QuickBooks, maintaining data consistency across systems.

Output: Delete buttons on invoice list and customer detail pages that trigger deletion in QuickBooks (if synced) and local database with proper logging.
</objective>

<execution_context>
@~/.config/Claude/get-shit-done/workflows/execute-plan.md
@~/.config/Claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@app/api/invoices/delete/route.ts — Existing QB delete endpoint (different pattern, takes qbInvoiceId in body)
@lib/services/quickbooks.service.ts — QuickBooks service with deleteInvoice method
@app/dashboard/invoices/page.tsx — Invoice list page
@app/dashboard/customers/[id]/page.tsx — Customer detail page with invoice table
</context>

<tasks>

<task type="auto">
  <name>Add DELETE endpoint to /api/invoices/[id]</name>
  <files>app/api/invoices/[id]/route.ts</files>
  <action>
Add DELETE handler to existing route file that:

1. **Authentication & Authorization:**
   - Require active session (401 if missing)
   - Restrict to ADMIN and FINANCE roles (403 for others)
   - Use same auth pattern as existing PATCH handler

2. **Fetch invoice:**
   - Query invoice by params.id with customer relation
   - Return 404 if not found
   - Extract quickbooks_invoice_id (may be null)

3. **Delete from QuickBooks (if synced):**
   - Only if quickbooks_invoice_id is not null
   - Initialize quickbooksService
   - Call quickbooksService.deleteInvoice(quickbooks_invoice_id)
   - Wrap in try/catch - log QB errors but continue with local delete
   - Log QB deletion success to IntegrationLog

4. **Delete from local database:**
   - Use prisma.invoice.delete({ where: { id: params.id } })
   - Always delete locally, even if QB delete fails

5. **Integration logging:**
   - Log success: service="quickbooks", action="invoice_deleted", status="SUCCESS"
   - Log QB error: service="quickbooks", action="invoice_delete_failed", status="ERROR" with error message
   - Include invoice details in payload (invoiceNumber, amount, quickbooks_invoice_id)

6. **Return response:**
   - Success: { success: true, deletedFromQuickBooks: boolean, invoice: deletedInvoice }
   - Error: { error: string } with 500 status

Pattern follows existing PATCH handler for auth/error handling.
  </action>
  <verify>
Test DELETE endpoint:
```bash
# Test unauthorized (should return 401)
curl -X DELETE http://localhost:3000/api/invoices/test-id

# Test with auth (use existing invoice ID from database)
# Should return success and delete from both QB and DB
```
  </verify>
  <done>DELETE /api/invoices/[id] endpoint exists, requires ADMIN/FINANCE role, deletes from QB if quickbooks_invoice_id exists, always deletes from local DB, logs to IntegrationLog</done>
</task>

<task type="auto">
  <name>Add delete button to invoice list page</name>
  <files>app/dashboard/invoices/page.tsx</files>
  <action>
Convert invoice list page to client component and add delete functionality:

1. **Convert to client component:**
   - Add "use client" directive at top
   - Import useState for confirmation dialog state
   - Move data fetching to useEffect or React Query
   - Keep existing filters, pagination, and table structure

2. **Add delete button to each row:**
   - Place X button (lucide-react X icon) in Actions column after existing links
   - Red/destructive styling (text-red-600 hover:text-red-700)
   - Only visible for ADMIN and FINANCE roles
   - Button triggers confirmation dialog

3. **Confirmation dialog:**
   - Use native confirm() or add simple modal component
   - Message: "Delete invoice {invoiceNumber}? This will remove it from QuickBooks and the database."
   - Show QB sync status if quickbooks_invoice_id exists

4. **Delete handler:**
   - onClick calls handleDelete(invoiceId, invoiceNumber, hasQuickbooksId)
   - Show confirmation dialog
   - If confirmed: DELETE /api/invoices/[id] with fetch
   - Handle loading state (disable button during delete)
   - Handle errors: toast/alert with error message
   - On success: Remove invoice from list optimistically OR refetch data
   - Toast success message

5. **Error handling:**
   - Network errors: "Failed to delete invoice. Please try again."
   - QB errors: "Deleted locally but QuickBooks deletion failed. Check Integration Logs."
   - Permission errors: "You don't have permission to delete invoices."

Use existing page structure. Don't break filters, pagination, or sorting.
  </action>
  <verify>
1. Visit http://localhost:3000/dashboard/invoices
2. Verify delete X button appears in each row for ADMIN/FINANCE
3. Click delete button
4. Verify confirmation dialog appears
5. Confirm deletion
6. Verify invoice disappears from list
7. Check QuickBooks to confirm deletion (if synced)
8. Check IntegrationLog for deletion record
  </verify>
  <done>Invoice list page has delete button, shows confirmation dialog, calls DELETE API, handles errors gracefully, updates UI after deletion</done>
</task>

<task type="auto">
  <name>Add delete button to customer detail invoice table</name>
  <files>app/dashboard/customers/[id]/page.tsx</files>
  <action>
Add delete functionality to customer detail invoice table:

1. **Convert to client component:**
   - Add "use client" directive at top
   - Use same pattern as invoice list page
   - Move customer data fetching to useEffect or React Query

2. **Add delete button to invoice table:**
   - Find the invoice table section (around line 200-300)
   - Add X button in Actions column (after "View" link)
   - Same red/destructive styling as invoice list
   - Only visible for ADMIN and FINANCE roles

3. **Reuse delete logic:**
   - Same handleDelete function as invoice list
   - Same confirmation dialog pattern
   - Same error handling

4. **Update financial summary after deletion:**
   - Refetch customer data OR
   - Update local state optimistically (subtract invoice amount from totals)
   - Recalculate: totalInvoiced, paidAmount, pendingAmount, overdueAmount

5. **Preserve existing features:**
   - Don't break financial summary cards
   - Don't break installment plan section
   - Don't break payment pie chart
   - Don't break status badges

Keep all existing customer detail features intact. Only add delete button to invoice table.
  </action>
  <verify>
1. Visit http://localhost:3000/dashboard/customers/[id] (pick customer with invoices)
2. Verify delete X button appears in invoice table for ADMIN/FINANCE
3. Click delete button
4. Verify confirmation dialog appears
5. Confirm deletion
6. Verify invoice removed from table
7. Verify financial summary cards update (totals decrease)
8. Check QuickBooks to confirm deletion
9. Check IntegrationLog for deletion record
  </verify>
  <done>Customer detail page has delete button in invoice table, shows confirmation, calls DELETE API, updates financial summary after deletion, handles errors gracefully</done>
</task>

</tasks>

<verification>
**End-to-end test:**
1. Create test invoice in QuickBooks (or use existing)
2. Sync to local database
3. Delete from invoice list page → verify removed from QB and DB
4. Create another test invoice
5. Delete from customer detail page → verify removed from QB and DB
6. Check IntegrationLog table for both deletions
7. Verify confirmation dialogs prevent accidental deletion
8. Test error handling: Try deleting non-existent invoice
</verification>

<success_criteria>
- [ ] DELETE /api/invoices/[id] endpoint exists and requires ADMIN/FINANCE role
- [ ] Endpoint deletes from QuickBooks if quickbooks_invoice_id exists
- [ ] Endpoint always deletes from local database (even if QB fails)
- [ ] All deletions logged to IntegrationLog with status and payload
- [ ] Invoice list page has delete button (X icon, red styling)
- [ ] Customer detail page has delete button in invoice table
- [ ] Confirmation dialog appears before deletion on both pages
- [ ] UI updates after deletion (invoice removed from list, totals recalculated)
- [ ] Error states handled gracefully with user-friendly messages
- [ ] Only ADMIN and FINANCE users can see delete buttons
- [ ] Existing page features unchanged (filters, pagination, charts, etc.)
</success_criteria>

<output>
After completion, create `.planning/quick/008-add-delete-invoice-button-with-quickbook/008-SUMMARY.md`
</output>
