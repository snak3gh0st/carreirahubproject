---
quick_task: 001-remove-finance-approval
type: execute
wave: 1
depends_on: []
files_modified:
  - app/api/invoices/create/route.ts
  - components/dashboard/sidebar-nav.tsx
  - app/dashboard/invoices/approval-queue/page.tsx
autonomous: true

must_haves:
  truths:
    - "COMMERCIAL role creates invoice and it syncs directly to QuickBooks"
    - "COMMERCIAL invoices skip approval queue entirely"
    - "COMMERCIAL users do not see Approval Queue link in sidebar"
    - "Finance team still sees their Approval Queue for other roles (if any)"
  artifacts:
    - path: "app/api/invoices/create/route.ts"
      provides: "Auto-approve and QB sync for COMMERCIAL role"
      min_lines: 280
    - path: "components/dashboard/sidebar-nav.tsx"
      provides: "Hide Approval Queue link from COMMERCIAL users"
      min_lines: 300
  key_links:
    - from: "app/api/invoices/create/route.ts"
      to: "quickbooksService.createInvoice"
      via: "Direct QB sync on creation"
      pattern: "quickbooksService\\.createInvoice"
    - from: "components/dashboard/sidebar-nav.tsx"
      to: "Finance section visibility"
      via: "Role-based navigation filtering"
      pattern: "roles.*COMMERCIAL"
---

<objective>
Remove Finance approval requirement for COMMERCIAL role invoices. When COMMERCIAL users create invoices, they should auto-sync directly to QuickBooks without needing Finance team approval.

Purpose: Streamline invoice workflow for COMMERCIAL role by removing unnecessary approval bottleneck. COMMERCIAL users have full authority to send invoices to customers.

Output: COMMERCIAL invoices bypass approval queue and sync to QB immediately, while Finance team approval workflow remains for SALES role (if needed).
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/pauloloureiro/Desktop/Work/Sigma/Projects/CarreiraUSAHUB/CLAUDE.md
@/Users/pauloloureiro/Desktop/Work/Sigma/Projects/CarreiraUSAHUB/app/api/invoices/create/route.ts
@/Users/pauloloureiro/Desktop/Work/Sigma/Projects/CarreiraUSAHUB/lib/services/invoice-approval.service.ts
@/Users/pauloloureiro/Desktop/Work/Sigma/Projects/CarreiraUSAHUB/components/dashboard/sidebar-nav.tsx
@/Users/pauloloureiro/Desktop/Work/Sigma/Projects/CarreiraUSAHUB/prisma/schema.prisma
</context>

<tasks>

<task type="auto">
  <name>Update invoice creation logic for COMMERCIAL auto-approval</name>
  <files>app/api/invoices/create/route.ts</files>
  <action>
Modify role-based approval workflow in invoice creation API:

**Current logic (lines 69-70):**
```typescript
const needsApproval = role === "SALES" || role === "COMMERCIAL";
const isFinanceOrAdmin = role === "FINANCE" || role === "ADMIN";
```

**Change to:**
```typescript
const needsApproval = role === "SALES"; // Only SALES needs approval
const isFinanceOrAdmin = role === "FINANCE" || role === "ADMIN" || role === "COMMERCIAL"; // COMMERCIAL auto-approves
```

**Why:** This change ensures COMMERCIAL role bypasses the approval queue (needsApproval = false) and triggers immediate QuickBooks sync (isFinanceOrAdmin = true). The existing code at lines 133-201 already handles QB sync for "isFinanceOrAdmin" roles, so COMMERCIAL will follow the same path as FINANCE/ADMIN.

**What happens:**
- SALES role: Creates invoice with `status: DRAFT`, `approvalStatus: PENDING` (needs Finance approval)
- COMMERCIAL role: Creates invoice with `status: SENT`, `approvalStatus: APPROVED`, syncs to QB immediately, sends email
- FINANCE/ADMIN: Unchanged (still auto-approve and sync)

**Important:** Do NOT modify the QB sync logic (lines 133-201) - it already works correctly. Only change the role classification at lines 69-70.
  </action>
  <verify>
1. Read modified file: `cat app/api/invoices/create/route.ts | grep -A2 "needsApproval ="`
2. Confirm logic shows: `needsApproval = role === "SALES"` (not including COMMERCIAL)
3. Confirm logic shows: `isFinanceOrAdmin` includes COMMERCIAL
  </verify>
  <done>
- Line 69: `needsApproval` only true for SALES role
- Line 70: `isFinanceOrAdmin` includes COMMERCIAL role
- COMMERCIAL role invoices will follow same path as FINANCE/ADMIN (immediate QB sync)
  </done>
</task>

<task type="auto">
  <name>Hide Approval Queue link from COMMERCIAL users in sidebar</name>
  <files>components/dashboard/sidebar-nav.tsx</files>
  <action>
Update sidebar navigation to hide Approval Queue link from COMMERCIAL role.

**Current structure (lines 89-130):** Finance section includes Approval Queue with roles `["ADMIN", "FINANCE"]`

**Change line 109:**
From:
```typescript
roles: ["ADMIN", "FINANCE"],
```

To:
```typescript
roles: ["ADMIN", "FINANCE"], // COMMERCIAL excluded - they don't need approval queue
```

**Why:** COMMERCIAL users create invoices that auto-sync to QB. They don't need to see the Approval Queue page since their invoices never enter the queue. This is purely a visibility change - the Approval Queue page itself will still function for FINANCE/ADMIN roles.

**Verify change:** COMMERCIAL users will see "Create Invoice" and "My Invoices" links in their Commercial section (lines 132-154), but NOT "Approval Queue" which remains Finance-only.

**Important:** Do NOT modify the Commercial section (lines 132-154) - COMMERCIAL already has their own navigation items. Only confirm Approval Queue remains Finance-only.
  </action>
  <verify>
1. Read sidebar nav: `cat components/dashboard/sidebar-nav.tsx | grep -B2 -A2 "Approval Queue"`
2. Confirm "Approval Queue" item has roles: `["ADMIN", "FINANCE"]` (no COMMERCIAL)
3. Read Commercial section: `grep -A20 '"Commercial"' components/dashboard/sidebar-nav.tsx`
4. Confirm Commercial section does NOT include Approval Queue link
  </verify>
  <done>
- Approval Queue link visible only to ADMIN and FINANCE roles
- COMMERCIAL role cannot see Approval Queue link in sidebar
- Commercial section navigation remains unchanged
  </done>
</task>

<task type="auto">
  <name>Add explanatory comments to approval queue page</name>
  <files>app/dashboard/invoices/approval-queue/page.tsx</files>
  <action>
Add clarifying comment to approval queue page explaining workflow after changes.

**Location:** Add comment block at line 11 (after `export const dynamic = 'force-dynamic';`)

**Add:**
```typescript
/**
 * WORKFLOW NOTES (as of 2026-01-22):
 * - SALES role: Creates invoices with approvalStatus=PENDING, requires Finance approval
 * - COMMERCIAL role: Auto-approves and syncs to QB directly (bypasses this queue)
 * - FINANCE/ADMIN: Auto-approves and syncs to QB directly (bypasses this queue)
 *
 * This page is primarily for Finance team to review SALES-created invoices.
 */
```

**Why:** Document the current workflow so future developers understand which roles use the approval queue. This is documentation-only - no functional changes to the page.

**Important:** Do NOT modify any other logic in this file. The page already correctly filters by `approvalStatus: PENDING` (line 54), which will now only capture SALES-created invoices.
  </action>
  <verify>
1. Read file header: `head -20 app/dashboard/invoices/approval-queue/page.tsx`
2. Confirm comment block exists after line 11
3. Confirm comment explains SALES needs approval, COMMERCIAL bypasses queue
  </verify>
  <done>
- Comment block added explaining role-based approval workflow
- Documentation clarifies COMMERCIAL invoices bypass this page
- No functional changes to approval queue logic
  </done>
</task>

</tasks>

<verification>

## Integration Testing

After all tasks complete, verify end-to-end workflow:

### 1. COMMERCIAL Invoice Creation Flow
```bash
# Test API endpoint logic (manual test required)
# 1. Login as COMMERCIAL user
# 2. Navigate to /dashboard/invoices/new
# 3. Create test invoice
# 4. Verify invoice goes directly to QB (check IntegrationLog table)
# 5. Verify invoice has status=SENT, approvalStatus=APPROVED
```

### 2. SALES Invoice Flow (should be unchanged)
```bash
# Verify SALES still requires approval
# 1. Login as SALES user
# 2. Create test invoice
# 3. Verify invoice has status=DRAFT, approvalStatus=PENDING
# 4. Check approval queue shows the invoice
```

### 3. Sidebar Navigation
```bash
# Check role-based navigation
# COMMERCIAL user: Should NOT see "Approval Queue" link
# FINANCE user: SHOULD see "Approval Queue" link
# ADMIN user: SHOULD see "Approval Queue" link
```

### 4. Database Check
```bash
# Verify invoice approval workflow
npx prisma studio

# Check Invoices table:
# - COMMERCIAL-created invoices: approvalStatus = "APPROVED", quickbooks_invoice_id populated
# - SALES-created invoices: approvalStatus = "PENDING", quickbooks_invoice_id null until approved
```

### 5. Integration Logs
```bash
# Check QB sync happened for COMMERCIAL invoices
# Query IntegrationLog table for:
# - service = "quickbooks"
# - action = "invoice_created_and_sent"
# - Verify logs exist for COMMERCIAL-created invoices
```

</verification>

<success_criteria>

## Functional Success

- [ ] COMMERCIAL role creates invoice → status=SENT, approvalStatus=APPROVED immediately
- [ ] COMMERCIAL invoices sync to QuickBooks on creation (quickbooks_invoice_id populated)
- [ ] COMMERCIAL invoices send email via QuickBooks on creation
- [ ] SALES role still creates drafts requiring Finance approval (unchanged behavior)
- [ ] FINANCE/ADMIN still auto-approve and sync (unchanged behavior)
- [ ] Approval Queue page shows only PENDING invoices (primarily from SALES)
- [ ] COMMERCIAL users cannot see "Approval Queue" link in sidebar
- [ ] FINANCE/ADMIN users still see "Approval Queue" link in sidebar

## Code Quality

- [ ] Only 3 files modified (create/route.ts, sidebar-nav.tsx, approval-queue/page.tsx)
- [ ] No database schema changes
- [ ] No new dependencies
- [ ] Existing QB sync logic reused (no duplication)
- [ ] Comments added explaining workflow decisions

## Verification Evidence

- [ ] `git diff app/api/invoices/create/route.ts` shows only lines 69-70 changed
- [ ] `git diff components/dashboard/sidebar-nav.tsx` shows Approval Queue roles unchanged (already excludes COMMERCIAL)
- [ ] `git diff app/dashboard/invoices/approval-queue/page.tsx` shows comment added
- [ ] IntegrationLog contains successful QB sync entries for COMMERCIAL-created invoices
- [ ] Test invoice created by COMMERCIAL user has quickbooks_invoice_id populated

</success_criteria>

<output>
After completion, create `.planning/quick/001-remove-finance-approval/001-SUMMARY.md` with:
- Changes made (3 files)
- Workflow diagram (SALES vs COMMERCIAL vs FINANCE/ADMIN paths)
- Testing evidence (IntegrationLog entries, database state)
- Any edge cases discovered during implementation
</output>
