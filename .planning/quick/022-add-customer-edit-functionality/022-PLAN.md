---
quick: 022
type: execute
description: Add customer edit functionality to the hub
files_modified:
  - app/dashboard/customers/[id]/edit/page.tsx
  - app/dashboard/customers/[id]/page.tsx
  - app/api/customers/[id]/route.ts
  - lib/services/quickbooks.service.ts
autonomous: true
estimated_time: 30min
---

<objective>
Add customer edit functionality to allow Finance team to update customer information (name, email, phone, address) directly in the dashboard, with automatic sync to QuickBooks.

Purpose: Resolve QuickBooks API errors like "Duplicate Name" (error 6240) by enabling users to fix customer data conflicts without manual database intervention.

Output: Edit page at `/dashboard/customers/[id]/edit` with form, API endpoint update, and QuickBooks sync for name changes.
</objective>

<context>
@CLAUDE.md (Identity Mapper pattern, QuickBooks integration)

Existing patterns:
- CustomerForm component at `app/dashboard/customers/new/CustomerForm.tsx` (reusable pattern)
- PATCH endpoint exists at `/api/customers/[id]` but only updates local DB
- QuickBooks service has `updateCustomerEmail()` method (pattern for sparse updates)
- Customer detail page at `app/dashboard/customers/[id]/page.tsx` (needs Edit button)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create customer edit page and form component</name>
  <files>
    app/dashboard/customers/[id]/edit/page.tsx
    app/dashboard/customers/[id]/edit/CustomerEditForm.tsx
  </files>
  <action>
Create edit page and form component following existing patterns:

1. Create `app/dashboard/customers/[id]/edit/page.tsx`:
   - Server component that fetches customer by ID
   - Redirects to /auth/signin if no session
   - Returns 404 if customer not found
   - Renders CustomerEditForm with pre-populated data

2. Create `app/dashboard/customers/[id]/edit/CustomerEditForm.tsx`:
   - Client component ("use client")
   - Props: customer object with all editable fields
   - Form fields: name, email (read-only - display only since email is identity key), phone, ssn, passport, cpf, address, city, state, zipCode, country
   - Show external ID badges (QuickBooks, Pipedrive) as read-only info
   - Submit calls PATCH /api/customers/[id]
   - Show loading state during submission
   - Show success message with QuickBooks sync status
   - Redirect to customer detail page after 2 seconds on success
   - Show error message on failure

UI must match existing CustomerForm styling (blue-50 info boxes, consistent field spacing, same button styles).

IMPORTANT: Email field should be disabled/read-only with helper text explaining "Email is the unique identifier and cannot be changed. Contact support to merge customer records."
  </action>
  <verify>
Navigate to /dashboard/customers/[id]/edit - form loads with customer data pre-populated.
  </verify>
  <done>
Edit page renders with all customer fields pre-filled. Email is read-only. Form validates and submits.
  </done>
</task>

<task type="auto">
  <name>Task 2: Enhance PATCH endpoint with QuickBooks sync</name>
  <files>
    app/api/customers/[id]/route.ts
    lib/services/quickbooks.service.ts
  </files>
  <action>
1. Add `updateCustomer()` method to QuickBooks service (`lib/services/quickbooks.service.ts`):
   - Accept customerId and update fields (DisplayName, phone, address)
   - Fetch current customer with getCustomerById() to get SyncToken
   - Use sparse update (only include changed fields plus Id and SyncToken)
   - POST to /customer endpoint (same pattern as updateCustomerEmail)
   - Log operation to console

2. Update PATCH `/api/customers/[id]` endpoint:
   - After successful Prisma update, check if customer.quickbooks_id exists
   - If QB connected, call quickbooksService.updateCustomer() with changed fields
   - Return response with quickbooksSync status: { synced: boolean, message?: string }
   - Handle QB errors gracefully (don't fail the whole request, just set synced: false)

QuickBooks Customer update fields to sync:
- DisplayName (from name)
- GivenName (first name from split)
- FamilyName (last name from split)
- PrimaryPhone.FreeFormNumber (from phone)
- BillAddr.Line1 (from address)
- BillAddr.City (from city)
- BillAddr.CountrySubDivisionCode (from state)
- BillAddr.PostalCode (from zipCode)

For name parsing: Split by last space (e.g., "John Smith Jr" -> GivenName="John Smith", FamilyName="Jr").
If only one word, use it as both GivenName and FamilyName.
  </action>
  <verify>
`curl -X PATCH /api/customers/[id] -d '{"name":"Updated Name"}' -H "Content-Type: application/json"` returns 200 with quickbooksSync status.
  </verify>
  <done>
PATCH endpoint updates local DB AND syncs to QuickBooks when quickbooks_id exists. Returns sync status in response.
  </done>
</task>

<task type="auto">
  <name>Task 3: Add Edit button to customer detail page</name>
  <files>
    app/dashboard/customers/[id]/page.tsx
  </files>
  <action>
Add Edit button to customer header section in `app/dashboard/customers/[id]/page.tsx`:

1. Find the customer header div (line ~179-242, the flex container with name, email, source badges)

2. Add an Edit button next to the "Criar invoice para este cliente" button:
   ```tsx
   <Link
     href={`/dashboard/customers/${customer.id}/edit`}
     className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
   >
     <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
     </svg>
     Editar Cliente
   </Link>
   ```

3. Reorder buttons: Edit button first (secondary style), then Create Invoice button (primary style).
  </action>
  <verify>
Navigate to /dashboard/customers/[id] - Edit button visible and links to /dashboard/customers/[id]/edit.
  </verify>
  <done>
Customer detail page has Edit button that navigates to edit form.
  </done>
</task>

</tasks>

<verification>
1. Navigate to /dashboard/customers - pick any customer
2. Click customer to view detail page
3. Click "Editar Cliente" button
4. Edit form loads with all fields pre-populated
5. Change customer name
6. Submit form
7. Success message shows QuickBooks sync status
8. Redirected to customer detail page with updated name
9. If customer has quickbooks_id, check QB dashboard to verify name updated
</verification>

<success_criteria>
- Edit page accessible at /dashboard/customers/[id]/edit
- Form pre-populates with existing customer data
- Email field is read-only (cannot be changed)
- PATCH endpoint updates local DB
- PATCH endpoint syncs changes to QuickBooks when connected
- Edit button visible on customer detail page
- QuickBooks sync status shown in success message
</success_criteria>

<output>
After completion, create `.planning/quick/022-add-customer-edit-functionality/022-SUMMARY.md`
</output>
