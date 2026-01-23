---
phase: quick-012
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - prisma/schema.prisma
  - lib/services/invoice-approval.service.ts
  - app/api/invoices/route.ts
  - app/dashboard/invoices/page.tsx
  - app/dashboard/invoices/[id]/page.tsx
  - app/dashboard/invoices/approval-queue/page.tsx
  - components/invoices/approval-status-badge.tsx
  - components/dashboard/mobile-filter-modal.tsx
autonomous: true

must_haves:
  truths:
    - "Invoice created → immediately synced to QuickBooks (no approval step)"
    - "Invoice email sent automatically after QB sync"
    - "Contract workflow triggered immediately after invoice creation"
    - "No approval queue page accessible in dashboard"
    - "Invoice detail page shows no approval UI (no approve/reject buttons)"
    - "Invoice list page shows no approval filters or pending counts"
  artifacts:
    - path: "prisma/schema.prisma"
      provides: "Invoice schema without approval fields"
      excludes: ["approvalStatus", "approvedAt", "approvedBy", "rejectedReason"]
    - path: "lib/services/invoice-approval.service.ts"
      provides: "Simplified sync service (or removed if unused)"
      min_lines: 0
    - path: "app/api/invoices/route.ts"
      provides: "Auto-sync invoice creation flow"
      contains: "quickbooksService"
    - path: "app/dashboard/invoices/page.tsx"
      provides: "Invoice list without approval filters"
      excludes: ["approvalStatus", "ApprovalStatusBadge"]
    - path: "app/dashboard/invoices/[id]/page.tsx"
      provides: "Invoice detail without approval actions"
      excludes: ["ApprovalStatusBadge", "approve", "reject"]
  key_links:
    - from: "app/api/invoices/route.ts"
      to: "lib/services/quickbooks.service.ts"
      via: "Immediate QB sync on invoice creation"
      pattern: "quickbooksService\\.(createInvoice|syncInvoice)"
    - from: "app/api/invoices/route.ts"
      to: "lib/services/contract-workflow.service.ts"
      via: "Immediate contract workflow trigger"
      pattern: "contractWorkflowService"
---

<objective>
Remove invoice approval workflow completely, simplifying the invoice flow to: Created → QuickBooks Sync → Email Sent → Contract Flow.

Purpose: Eliminate unnecessary approval bottleneck in Finance workflow. All invoice creation roles (COMMERCIAL, SALES, FINANCE, ADMIN) now have invoices auto-sync to QuickBooks immediately.

Output: Clean invoice creation flow without approval gates, deleted approval UI components, simplified database schema.
</objective>

<execution_context>
@~/.config/Claude/get-shit-done/workflows/execute-plan.md
@~/.config/Claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@prisma/schema.prisma
@lib/services/invoice-approval.service.ts
@app/api/invoices/route.ts
@app/dashboard/invoices/page.tsx
@app/dashboard/invoices/[id]/page.tsx

Current workflow (to be removed):
1. Invoice created → PENDING approval (approvalStatus field)
2. Finance approves → QB sync happens via invoice-approval.service.ts
3. Contract sent after approval

New simplified workflow:
1. Invoice created → immediately sync to QB
2. Email sent automatically
3. Contract flow continues immediately
</context>

<tasks>

<task type="auto">
  <name>Remove approval fields from Invoice schema and create migration</name>
  <files>
    prisma/schema.prisma
  </files>
  <action>
    1. Remove approval-related fields from Invoice model:
       - approvalStatus (ApprovalStatus enum field)
       - approvedBy (String? field + relation to User)
       - approvedAt (DateTime? field)
       - rejectedReason (String? @db.Text field)
    
    2. Remove approval relations from User model:
       - approvedInvoices (Invoice[] @relation("InvoiceApprovals"))
    
    3. Remove ApprovalStatus enum entirely (no longer needed):
       - enum ApprovalStatus { PENDING, APPROVED, REJECTED }
    
    4. Remove approval-related NotificationType enum values:
       - INVOICE_APPROVAL_REQUEST
       - INVOICE_APPROVED
       - INVOICE_REJECTED
    
    5. Generate Prisma migration:
       npm run db:generate
       npx prisma migrate dev --name remove_invoice_approval_workflow
    
    DO NOT remove:
    - InvoiceStatus enum (DRAFT, SENT, PAID, etc.) - still needed
    - ownerId field - still needed for ownership tracking
    - Any QuickBooks or Stripe related fields
  </action>
  <verify>
    - npm run db:generate succeeds
    - Migration file created in prisma/migrations/
    - Prisma Client regenerated without approval fields
    - Database schema updated with approval columns dropped
  </verify>
  <done>
    - Invoice model has no approval fields
    - ApprovalStatus enum removed
    - Migration applied successfully
    - No TypeScript errors from schema changes
  </done>
</task>

<task type="auto">
  <name>Delete approval queue page and remove approval badge component</name>
  <files>
    app/dashboard/invoices/approval-queue/page.tsx
    components/invoices/approval-status-badge.tsx
  </files>
  <action>
    1. Delete entire approval queue page:
       rm app/dashboard/invoices/approval-queue/page.tsx
    
    2. Delete ApprovalStatusBadge component:
       rm components/invoices/approval-status-badge.tsx
    
    These files are no longer needed as approval workflow is removed.
    
    DO NOT delete:
    - app/dashboard/invoices/page.tsx (invoice list - will be cleaned in next task)
    - app/dashboard/invoices/[id]/page.tsx (invoice detail - will be cleaned in next task)
  </action>
  <verify>
    - File app/dashboard/invoices/approval-queue/page.tsx does not exist
    - File components/invoices/approval-status-badge.tsx does not exist
    - No 404 errors when navigating to /dashboard/invoices (approval queue link removed)
  </verify>
  <done>
    - Approval queue page deleted
    - ApprovalStatusBadge component deleted
    - No import errors in remaining files (will be fixed in Task 3)
  </done>
</task>

<task type="auto">
  <name>Remove approval UI from invoice list and detail pages</name>
  <files>
    app/dashboard/invoices/page.tsx
    app/dashboard/invoices/[id]/page.tsx
    components/dashboard/mobile-filter-modal.tsx
  </files>
  <action>
    **File: app/dashboard/invoices/page.tsx**
    
    1. Remove import:
       - import { ApprovalStatusBadge } from "@/components/invoices/approval-status-badge";
    
    2. Remove approvalStatus from searchParams type (line 23)
    
    3. Remove approvalStatus filter logic:
       - Lines 70-71: if (searchParams.approvalStatus) whereClause
       - Line 171: by: ["approvalStatus"] from groupBy
       - Lines 208-209: approvalStatus pagination param
       - Line 226: approvalStatus to buildPaginationUrl
       - Line 234: approvalStatus URL param
       - Lines 415-419: approvalStatus active filter badge
       - Line 489: approvalStatus from filterChips
       - Lines 598-599: approvalStatus select dropdown
       - Lines 687-742: Pending Approval chip and button (entire section)
    
    4. Remove ApprovalStatusBadge usage (line 881):
       - Replace with status-based badge or remove approval badge column
    
    5. Remove "Pending Approval" count from stats aggregation (groupBy by approvalStatus)
    
    **File: app/dashboard/invoices/[id]/page.tsx**
    
    1. Remove import:
       - import { ApprovalStatusBadge } from "@/components/invoices/approval-status-badge";
    
    2. Remove approval-related timeline steps:
       - Lines 114-141: "Awaiting Approval", "Approval Decision" timeline logic
       - Simplify to: Created → QuickBooks Sync → Email Sent
    
    3. Remove ApprovalStatusBadge from invoice header (line 218)
    
    4. Remove approval action section (lines 331-368):
       - "Pending approval" approve/reject buttons
       - "Approved by" display
       - "Rejected" reason display
    
    **File: components/dashboard/mobile-filter-modal.tsx**
    
    1. Remove approvalStatus from CurrentFilters type (line 13)
    
    2. Remove approvalStatus select field (lines 225-226)
    
    WHY: Approval is no longer part of the workflow. Invoice status (DRAFT, SENT, PAID) is sufficient.
  </action>
  <verify>
    - npm run build succeeds (no TypeScript import errors)
    - Invoice list page renders without approval filters
    - Invoice detail page shows simplified timeline (no approval steps)
    - No ApprovalStatusBadge import errors
    - Mobile filter modal builds without approvalStatus field
  </verify>
  <done>
    - All imports of ApprovalStatusBadge removed
    - Approval filter UI removed from invoice list
    - Approval actions removed from invoice detail
    - Timeline simplified (Created → QB Sync → Email)
    - No TypeScript or runtime errors
  </done>
</task>

<task type="auto">
  <name>Simplify invoice-approval.service.ts to direct sync service</name>
  <files>
    lib/services/invoice-approval.service.ts
  </files>
  <action>
    OPTION A (Recommended): Keep service but rename and simplify:
    
    1. Rename file to invoice-sync.service.ts
    
    2. Remove approval methods entirely:
       - submitForApproval()
       - approveInvoice()
       - rejectInvoice()
       - notifyFinanceTeam()
       - notifySubmitter()
    
    3. Keep and expose as public export:
       - syncApprovedInvoice() → rename to syncInvoiceToQuickBooks()
       - Remove approval status checks
       - Remove approval notifications
       - Keep QB sync logic (lines 256-488)
       - Keep contract workflow trigger (lines 134-156 moved to sync method)
    
    4. Update IntegrationLog service names:
       - "INVOICE_APPROVAL" → "INVOICE_SYNC"
       - "INVOICE_APPROVED" → "INVOICE_CREATED"
       - Remove "SUBMITTED_FOR_APPROVAL", "INVOICE_REJECTED" actions
    
    5. Update class name: InvoiceApprovalService → InvoiceSyncService
    
    6. Export singleton: export const invoiceSyncService = new InvoiceSyncService();
    
    OPTION B (Alternative): Delete entire file if sync logic is moved to invoice creation API route.
    
    Choose OPTION A to maintain service layer pattern used throughout codebase.
    
    WHY: Invoices no longer need approval flow, but still need QB sync and contract workflow trigger. Keep sync orchestration in service layer.
  </action>
  <verify>
    - File renamed to invoice-sync.service.ts (if OPTION A)
    - No approval methods remain in service
    - syncInvoiceToQuickBooks() method exists and works
    - Contract workflow trigger remains functional
    - No imports of invoiceApprovalService in codebase (use grep)
  </verify>
  <done>
    - Service simplified to sync-only operations
    - All approval logic removed
    - QB sync and contract trigger preserved
    - Service follows existing codebase patterns
  </done>
</task>

<task type="auto">
  <name>Update invoice creation to auto-sync without approval</name>
  <files>
    app/api/invoices/route.ts
  </files>
  <action>
    This file currently only handles GET (list invoices). The POST endpoint for invoice creation likely exists elsewhere or needs to be created.
    
    1. Search for invoice creation endpoint:
       grep -r "prisma.invoice.create" app/api/
    
    2. Locate the invoice creation handler (likely in app/api/invoices/create/ or similar)
    
    3. Update invoice creation flow to:
       - Remove approvalStatus: "PENDING" from invoice creation
       - Set status: "DRAFT" initially
       - Immediately call invoiceSyncService.syncInvoiceToQuickBooks(invoiceId) after creation
       - Handle sync errors gracefully (log but don't fail invoice creation)
       - Remove any approval notification calls
    
    4. If no POST endpoint exists in app/api/invoices/route.ts, add it:
       ```typescript
       export async function POST(request: NextRequest) {
         // Auth check
         // Parse and validate request body
         // Create invoice in database
         // Immediately sync to QuickBooks
         // Trigger contract workflow
         // Return created invoice
       }
       ```
    
    5. Remove any references to invoice-approval.service.ts, replace with invoice-sync.service.ts
    
    WHY: Invoices should sync immediately after creation, not wait for approval.
  </action>
  <verify>
    - Invoice creation endpoint identified and updated
    - POST to /api/invoices creates invoice and syncs to QB immediately
    - No approvalStatus field set during creation
    - Contract workflow triggers after QB sync
    - IntegrationLog shows "INVOICE_CREATED" and "INVOICE_SYNC" events
  </verify>
  <done>
    - Invoice creation auto-syncs to QuickBooks
    - No approval step in creation flow
    - Contract workflow triggered immediately
    - Errors logged but don't block invoice creation
  </done>
</task>

</tasks>

<verification>
## Functional Tests

1. **Invoice Creation Flow:**
   - Create new invoice via dashboard or API
   - Verify invoice appears in QuickBooks immediately
   - Verify QB invoice email sent to customer automatically
   - Verify contract workflow triggered without approval

2. **UI Navigation:**
   - Visit /dashboard/invoices → no approval filters, no pending count
   - Visit /dashboard/invoices/[id] → no approval badges, no approve/reject buttons
   - Visit /dashboard/invoices/approval-queue → 404 (page deleted)

3. **Database:**
   - Query Invoice table → no approvalStatus, approvedBy, approvedAt, rejectedReason columns
   - Check ApprovalStatus enum does not exist in Prisma schema

4. **Role-Based Access:**
   - COMMERCIAL role can create invoice → auto-syncs to QB
   - SALES role can create invoice → auto-syncs to QB
   - FINANCE role can create invoice → auto-syncs to QB
   - No role sees approval UI

## Integration Checks

- QuickBooks sync works immediately after invoice creation
- Contract workflow triggers without approval gate
- Email notifications sent after QB sync (not after approval)
- IntegrationLog shows "INVOICE_SYNC" events (not "INVOICE_APPROVAL")
</verification>

<success_criteria>
## Workflow Simplified

- [x] Invoice created → immediately synced to QuickBooks (no approval)
- [x] Email sent automatically after QB sync
- [x] Contract workflow triggered immediately
- [x] Approval queue page deleted and inaccessible
- [x] Invoice list page has no approval filters or counts
- [x] Invoice detail page has no approval UI

## Code Cleanup

- [x] Invoice schema has no approval fields (approvalStatus, approvedBy, approvedAt, rejectedReason)
- [x] ApprovalStatus enum removed from Prisma schema
- [x] ApprovalStatusBadge component deleted
- [x] Approval queue page deleted
- [x] invoice-approval.service.ts simplified or renamed to invoice-sync.service.ts
- [x] All imports of deleted components removed
- [x] No TypeScript or build errors

## Database Migration

- [x] Migration created and applied successfully
- [x] Approval columns dropped from Invoice table
- [x] No data loss (invoice status fields preserved)
</success_criteria>

<output>
After completion, create `.planning/quick/012-remove-invoice-approval-workflow-complet/012-SUMMARY.md`

Document:
- Database migration details (columns removed)
- Files deleted (approval-queue page, badge component)
- Service layer changes (approval → sync)
- Updated invoice creation flow (auto-sync)
- Any issues encountered during approval removal
</output>
