---
phase: quick-033
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/dashboard/invoices/new/InvoiceForm.tsx
  - app/dashboard/customers/[id]/page.tsx
  - components/customers/delete-customer-button.tsx
autonomous: true

must_haves:
  truths:
    - "User can easily find and select customers when creating invoices (searchable)"
    - "User can delete customers from the system via customer detail page"
    - "Customer deletion requires QuickBooks sync and proper confirmation"
  artifacts:
    - path: "app/dashboard/invoices/new/InvoiceForm.tsx"
      provides: "Searchable customer selection with improved UX"
      min_lines: 800
    - path: "components/customers/delete-customer-button.tsx"
      provides: "Delete customer button component with confirmation"
      min_lines: 80
    - path: "app/dashboard/customers/[id]/page.tsx"
      provides: "Customer detail page with delete button"
      min_lines: 500
  key_links:
    - from: "app/dashboard/invoices/new/InvoiceForm.tsx"
      to: "customer search/filter input"
      via: "useState for search term, filtered customer list"
      pattern: "useState.*search|filter.*customer"
    - from: "components/customers/delete-customer-button.tsx"
      to: "/api/customers/delete"
      via: "fetch POST with qbCustomerId"
      pattern: "fetch.*customers/delete"
---

<objective>
Improve invoice customer selection UX and add customer deletion capability.

Purpose: Address user pain points - difficult customer selection when creating invoices and inability to delete customers from the system.

Output: 
- Searchable customer dropdown in invoice creation form
- Delete customer button on customer detail page with proper QuickBooks sync
</objective>

<execution_context>
@~/.config/Claude/get-shit-done/workflows/execute-plan.md
@~/.config/Claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@app/dashboard/invoices/new/InvoiceForm.tsx
@app/dashboard/customers/[id]/page.tsx
@app/api/customers/delete/route.ts
@components/customers/delete-invoice-button-customer.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add searchable customer selection to invoice form</name>
  <files>
    app/dashboard/invoices/new/InvoiceForm.tsx
  </files>
  <action>
Replace the basic customer `<select>` dropdown (lines 343-360) with a searchable input + filtered dropdown pattern:

1. Add state for customer search:
   ```typescript
   const [customerSearch, setCustomerSearch] = useState("");
   ```

2. Add filtered customers logic:
   ```typescript
   const filteredCustomers = customers.filter(c => 
     c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
     c.email.toLowerCase().includes(customerSearch.toLowerCase())
   );
   ```

3. Replace the select with:
   - Text input for search (with search icon)
   - Dropdown list showing filtered customers (max-height with scroll)
   - Show "No customers found" if filteredCustomers.length === 0
   - Display customer name + email in each option
   - Clear button to reset selection

4. Style improvements:
   - Search input with magnifying glass icon
   - Dropdown list with hover states
   - Selected customer shown in input field (not just ID)
   - Keyboard navigation support (Enter to select, Escape to close)

5. Keep existing functionality:
   - Still filters deals when customer changes
   - Pre-selects customer from URL param (customerId query param)

**UI pattern to follow**: Similar to autocomplete/combobox pattern with search-first UX. Show dropdown on focus, filter on type, select on click.
  </action>
  <verify>
1. Run `npm run dev` and navigate to `/dashboard/invoices/new`
2. Click customer field - dropdown appears
3. Type "test" - list filters to matching customers
4. Verify both name and email are searchable
5. Select a customer - form populates correctly
6. Verify deal dropdown still filters based on selected customer
  </verify>
  <done>
Customer selection in invoice form is searchable by name or email, shows filtered results, and allows easy selection without scrolling through entire list.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create delete customer button component</name>
  <files>
    components/customers/delete-customer-button.tsx
  </files>
  <action>
Create a new client component following the pattern of `delete-invoice-button-customer.tsx`:

1. Component signature:
   ```typescript
   interface DeleteCustomerButtonProps {
     customerId: string;
     customerName: string;
     quickbooksId: string | null;
     userRole: string;
   }
   ```

2. Features:
   - Only visible to ADMIN and FINANCE roles
   - Shows confirmation dialog before deletion (use browser confirm or custom modal)
   - Displays warning: "This will delete the customer from both the system and QuickBooks. This action cannot be undone."
   - Calls POST /api/customers/delete with { qbCustomerId: quickbooksId }
   - Shows loading state during deletion
   - Redirects to /dashboard/customers on success
   - Shows error toast on failure

3. UI:
   - Red button with trash icon
   - "Delete Customer" text
   - Disabled if no quickbooksId (show tooltip: "Customer must have QuickBooks ID to delete")
   - Loading spinner when submitting

4. Error handling:
   - Catch fetch errors
   - Show user-friendly error messages
   - Log errors to console

**Important**: The existing DELETE endpoint expects `qbCustomerId` (QuickBooks customer ID), not the internal customer UUID. Pass `quickbooksId` prop to the component.
  </action>
  <verify>
1. Check component compiles: `npm run build`
2. Verify props match signature
3. Check role-based visibility logic
4. Verify API call uses correct endpoint and payload format
  </verify>
  <done>
Delete customer button component exists, handles confirmation, calls correct API endpoint with QuickBooks ID, and redirects on success.
  </done>
</task>

<task type="auto">
  <name>Task 3: Add delete button to customer detail page</name>
  <files>
    app/dashboard/customers/[id]/page.tsx
  </files>
  <action>
Add the delete customer button to the customer detail page:

1. Import the new component:
   ```typescript
   import { DeleteCustomerButton } from "@/components/customers/delete-customer-button";
   ```

2. Add button to the action buttons section (around line 220-241, next to "Edit Customer"):
   ```tsx
   <DeleteCustomerButton
     customerId={customer.id}
     customerName={customer.name}
     quickbooksId={customer.quickbooks_id}
     userRole={userRole}
   />
   ```

3. Position:
   - Place after "Edit Customer" button
   - Before "Create Contract" button
   - Match styling of other buttons in the flex container

4. Ensure proper spacing and responsive layout maintained

**Layout note**: The action buttons are in a flex container (line 220). Add the delete button as another flex item with consistent gap spacing.
  </action>
  <verify>
1. Run `npm run dev` and navigate to a customer detail page
2. Verify delete button appears for ADMIN/FINANCE users
3. Check button styling matches other action buttons
4. Verify button is hidden for non-ADMIN/FINANCE users
5. Test responsive layout on mobile
  </verify>
  <done>
Delete customer button appears on customer detail page, visible only to ADMIN/FINANCE roles, and maintains consistent styling with other action buttons.
  </done>
</task>

</tasks>

<verification>
After completing all tasks:

1. **Customer Selection UX**:
   - Navigate to `/dashboard/invoices/new`
   - Test searching for customers by name and email
   - Verify filtered results appear correctly
   - Confirm customer selection works and populates form
   - Check that deal filtering still works when customer selected

2. **Customer Deletion**:
   - Navigate to a customer detail page with a QuickBooks ID
   - Verify delete button appears (ADMIN/FINANCE only)
   - Click delete and confirm warning message appears
   - Test canceling deletion
   - Test completing deletion (use test data!)
   - Verify redirect to customers list after successful deletion

3. **Error Cases**:
   - Test delete button with customer without QuickBooks ID (should be disabled)
   - Test delete with invalid QuickBooks ID (should show error)
   - Verify error messages are user-friendly
</verification>

<success_criteria>
- Customer search in invoice form filters by name OR email
- Filtered customer list displays results clearly
- Customer selection populates form correctly
- Delete customer button visible only to ADMIN/FINANCE
- Delete confirmation dialog prevents accidental deletions
- Successful deletion syncs with QuickBooks and redirects to customers list
- Error states handled gracefully with user feedback
- All existing functionality preserved (deal filtering, URL params, etc.)
</success_criteria>

<output>
After completion, create `.planning/quick/033-improve-invoice-customer-selection-ui-an/033-SUMMARY.md`
</output>
