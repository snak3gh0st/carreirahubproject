---
phase: quick-011
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/services/quickbooks.service.ts
  - app/api/invoices/[id]/route.ts
  - app/dashboard/invoices/[id]/edit/page.tsx
  - app/dashboard/invoices/page.tsx
  - components/invoices/edit-invoice-form.tsx
autonomous: true

must_haves:
  truths:
    - "User can navigate to invoice edit page from list and detail pages"
    - "User can update invoice amount, due date, description, and line items"
    - "Changes sync to QuickBooks using sparse update API"
    - "Only ADMIN and FINANCE can edit all invoices; COMMERCIAL/SALES can edit their own"
  artifacts:
    - path: "lib/services/quickbooks.service.ts"
      provides: "updateInvoice() method with sparse update API compliance"
      exports: ["updateInvoice"]
    - path: "app/dashboard/invoices/[id]/edit/page.tsx"
      provides: "Edit invoice page with form and authorization"
      min_lines: 150
    - path: "components/invoices/edit-invoice-form.tsx"
      provides: "Invoice edit form with validation"
      min_lines: 200
    - path: "app/api/invoices/[id]/route.ts"
      provides: "PATCH endpoint syncs with QuickBooks"
      contains: "quickbooksService.updateInvoice"
  key_links:
    - from: "app/dashboard/invoices/page.tsx"
      to: "/dashboard/invoices/[id]/edit"
      via: "Edit button in Actions column"
      pattern: "href.*invoices.*edit"
    - from: "app/dashboard/invoices/[id]/edit/page.tsx"
      to: "/api/invoices/[id]"
      via: "Form submission PATCH request"
      pattern: "fetch.*PATCH"
    - from: "app/api/invoices/[id]/route.ts"
      to: "quickbooksService.updateInvoice"
      via: "QuickBooks sparse update sync"
      pattern: "quickbooksService\\.updateInvoice"
---

<objective>
Implement full invoice edit functionality with QuickBooks sparse update API compliance, allowing authorized users to update invoice details with automatic sync to QuickBooks.

Purpose: Enable Finance team to correct invoice errors and update terms without manual QuickBooks edits
Output: Edit page, form component, QuickBooks sparse update method, and updated API endpoint
</objective>

<execution_context>
@~/.config/Claude/get-shit-done/workflows/execute-plan.md
@~/.config/Claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@lib/services/quickbooks.service.ts
@app/api/invoices/[id]/route.ts
@app/dashboard/invoices/[id]/page.tsx
@app/dashboard/invoices/page.tsx
</context>

<tasks>

<task type="auto">
  <name>Implement QuickBooks sparse update method</name>
  <files>lib/services/quickbooks.service.ts</files>
  <action>
Add `updateInvoice()` method to QuickbooksService class following QuickBooks API sparse update pattern:

**QuickBooks Sparse Update Requirements:**
- HTTP Method: POST to `/v3/company/{realmId}/invoice` (NOT PATCH, NOT PUT)
- Query param: `?minorversion=73` (latest version)
- Request body: `{ sparse: true, ...changed_fields, SyncToken, Id }`
- Must fetch current invoice first to get SyncToken
- SyncToken increments with each update (prevents concurrent update conflicts)
- Only include fields being changed (amount, dueDate, description, Line array for line items)

**Implementation:**
```typescript
async updateInvoice(
  quickbooksInvoiceId: string,
  updates: {
    amount?: number;
    dueDate?: string; // YYYY-MM-DD format
    description?: string;
    lineItems?: Array<{
      description: string;
      amount: number;
      detailType?: string;
      accountRef?: { value: string };
    }>;
  }
): Promise<any> {
  // 1. Fetch current invoice to get SyncToken
  // 2. Build sparse update object with only changed fields
  // 3. POST to /v3/company/{realmId}/invoice?minorversion=73
  // 4. Log to IntegrationLog (success or error)
  // 5. Return updated invoice
}
```

**Line Items Mapping:**
- If lineItems provided, map to QuickBooks Line format:
  ```json
  {
    "DetailType": "SalesItemLineDetail",
    "Amount": amount,
    "Description": description,
    "SalesItemLineDetail": {
      "ItemRef": { "value": "1" }  // Use default service item
    }
  }
  ```

**Error Handling:**
- Catch QuickBooks API errors (stale SyncToken, validation errors)
- Log all operations to IntegrationLog
- Return descriptive error messages

**Reference existing methods:**
- `voidInvoice()` for SyncToken fetch pattern
- `sendInvoiceEmail()` for API request structure
- `createInvoice()` for line items formatting
  </action>
  <verify>
Method compiles without errors and follows QuickBooks sparse update API pattern (POST with sparse:true + SyncToken)
  </verify>
  <done>
`updateInvoice()` method exists in quickbooks.service.ts, accepts updates object, fetches SyncToken, sends POST request with sparse:true
  </done>
</task>

<task type="auto">
  <name>Update PATCH endpoint to sync with QuickBooks</name>
  <files>app/api/invoices/[id]/route.ts</files>
  <action>
Update existing PATCH /api/invoices/[id] endpoint to sync updates with QuickBooks:

**Expand validation schema:**
```typescript
const updateInvoiceSchema = z.object({
  amount: z.number().positive().optional(),
  dueDate: z.string().datetime().optional(), // ISO 8601 format
  description: z.string().optional(),
  lineItems: z.array(z.object({
    description: z.string(),
    amount: z.number().positive(),
  })).optional(),
  status: z.nativeEnum(InvoiceStatus).optional(),
  pdfUrl: z.string().url().optional(),
});
```

**Update logic:**
1. Validate input with expanded schema
2. Check authorization (existing logic)
3. If invoice has `quickbooks_invoice_id` AND financial fields changed:
   - Initialize quickbooksService
   - Call `updateInvoice()` with changed fields
   - Convert dueDate to YYYY-MM-DD format for QuickBooks
   - Log sync attempt
4. Update local database with all changes
5. Return updated invoice

**Financial fields that trigger QB sync:**
- amount, dueDate, description, lineItems

**Non-financial fields (local only):**
- status, pdfUrl

**Error handling:**
- If QuickBooks sync fails, log error but still update local database
- Return success with warning: `{ invoice, qbSyncError: string }`
- Allows manual reconciliation later
  </action>
  <verify>
PATCH endpoint accepts expanded schema, calls quickbooksService.updateInvoice() when financial fields change, updates local database
  </verify>
  <done>
PATCH /api/invoices/[id] syncs financial field changes to QuickBooks using sparse update, handles errors gracefully
  </done>
</task>

<task type="auto">
  <name>Create edit invoice page and form component</name>
  <files>
app/dashboard/invoices/[id]/edit/page.tsx
components/invoices/edit-invoice-form.tsx
  </files>
  <action>
**Create edit page:** `app/dashboard/invoices/[id]/edit/page.tsx`

Server component that:
1. Checks authentication (redirect if not logged in)
2. Fetches invoice with customer relation
3. Checks authorization:
   - ADMIN, FINANCE: can edit all invoices
   - COMMERCIAL, SALES: can only edit their own invoices (ownerId match)
   - Others: redirect to /dashboard
4. Prevents editing PAID or VOIDED invoices (business rule)
5. Renders EditInvoiceForm client component with invoice data

**Create form component:** `components/invoices/edit-invoice-form.tsx`

Client component ("use client") that:
1. Pre-populates form with current invoice data
2. Form fields:
   - Amount (number input, min=0.01, required)
   - Due Date (date input, required, min=today)
   - Description (textarea, optional)
   - Line Items (dynamic array with Add/Remove buttons)
     - Each item: description (text), amount (number)
3. Validation:
   - Amount must be positive
   - Due date cannot be in the past
   - Line items must sum to total amount (within $0.01 tolerance)
   - At least one line item required
4. Submit handler:
   - PATCH to /api/invoices/[id]
   - Show loading state during request
   - On success: redirect to /dashboard/invoices/[id] with success toast
   - On error: display error message above form
5. Cancel button: navigate back to invoice detail page

**UI/UX:**
- Use Tailwind for styling (match existing dashboard aesthetic)
- Form layout: 2-column on desktop, stacked on mobile
- Line items: table format with Add/Remove buttons
- Submit button: disabled when validation fails or loading
- Show warning if editing QuickBooks-synced invoice
- Display SyncToken if available (for debugging)

**Accessibility:**
- Proper label/input associations
- Error messages linked to fields (aria-describedby)
- Focus management on validation errors
  </action>
  <verify>
Page and form compile without errors, form pre-populates with invoice data, validation prevents invalid submissions
  </verify>
  <done>
Edit page at /dashboard/invoices/[id]/edit renders form with authorization checks, form validates inputs and submits PATCH request
  </done>
</task>

<task type="auto">
  <name>Add Edit buttons to invoice list and detail pages</name>
  <files>
app/dashboard/invoices/page.tsx
app/dashboard/invoices/[id]/page.tsx
  </files>
  <action>
**Update invoice list page:** `app/dashboard/invoices/page.tsx`

In the Actions column (next to Delete button):
- Add Edit button linking to `/dashboard/invoices/${invoice.id}/edit`
- Use Edit icon from lucide-react
- Show only for authorized users (ADMIN, FINANCE, or owner)
- Disable for PAID/VOIDED invoices (visual indication with opacity)
- Button styling: secondary variant, small size

**Update invoice detail page:** `app/dashboard/invoices/[id]/page.tsx`

Currently has Edit button at line ~15 that links to non-existent page:
- Update existing Edit button href to `/dashboard/invoices/${invoice.id}/edit`
- Add authorization check (same as list page)
- Disable for PAID/VOIDED invoices with tooltip: "Cannot edit paid or voided invoices"
- Button location: Header actions area (next to Delete button)

**Authorization logic (both pages):**
```typescript
const canEdit = (
  userRole === "ADMIN" || 
  userRole === "FINANCE" || 
  (["COMMERCIAL", "SALES"].includes(userRole) && invoice.ownerId === userId)
) && !["PAID", "VOIDED"].includes(invoice.status);
```

**Visual treatment:**
- Enabled: primary or secondary button with Edit icon
- Disabled: muted appearance with cursor-not-allowed
- Tooltip on hover explaining why disabled (if applicable)
  </action>
  <verify>
Edit buttons appear in Actions column on list page and in header on detail page, linking to /dashboard/invoices/[id]/edit
  </verify>
  <done>
Edit buttons visible and functional on both invoice list and detail pages, with proper authorization and disabled states
  </done>
</task>

</tasks>

<verification>
1. Edit button appears on invoice list page (Actions column)
2. Edit button appears on invoice detail page (header)
3. Clicking Edit navigates to /dashboard/invoices/[id]/edit
4. Edit page pre-populates form with current invoice data
5. Form validation prevents invalid submissions
6. Submitting valid changes sends PATCH request
7. PATCH endpoint calls quickbooksService.updateInvoice()
8. QuickBooks sparse update uses POST with sparse:true + SyncToken
9. Local database updates with new values
10. Success redirects to invoice detail page
11. Authorization prevents unauthorized edits
12. PAID/VOIDED invoices cannot be edited
</verification>

<success_criteria>
- updateInvoice() method implemented in quickbooks.service.ts following sparse update API pattern
- PATCH /api/invoices/[id] syncs financial field changes to QuickBooks
- Edit page at /dashboard/invoices/[id]/edit with authorization checks
- Form validates inputs and handles submission
- Edit buttons on list and detail pages link to edit page
- Role-based access enforced (ADMIN/FINANCE can edit all; COMMERCIAL/SALES only own)
- Business rules enforced (no editing PAID/VOIDED invoices)
- Error handling and user feedback implemented
</success_criteria>

<output>
After completion, create `.planning/quick/011-implement-invoice-edit-functionality-wit/011-SUMMARY.md`
</output>
