---
phase: quick
plan: 019
type: execute
wave: 1
depends_on: []
files_modified:
  - components/dashboard/sidebar-nav.tsx
autonomous: true

must_haves:
  truths:
    - "FINANCE users can see 'Create Customer' link in sidebar navigation"
    - "FINANCE users can navigate to /dashboard/customers/new from sidebar"
  artifacts:
    - path: "components/dashboard/sidebar-nav.tsx"
      provides: "Finance section with Create Customer link"
      contains: "FINANCE.*customers/new"
  key_links:
    - from: "sidebar-nav.tsx Finance section"
      to: "/dashboard/customers/new"
      via: "Link component with FINANCE role"
      pattern: "customers/new.*FINANCE"
---

<objective>
Add "Create Customer" navigation link to Finance section in sidebar for FINANCE role users.

Purpose: FINANCE users cannot easily discover customer creation functionality because the "Criar Cliente" link only appears in the Commercial section (ADMIN, COMMERCIAL roles only). The API already allows FINANCE to create customers, but they have no direct navigation path in the sidebar.

Output: Updated sidebar-nav.tsx with "Create Customer" link in Finance section visible to FINANCE role.
</objective>

<execution_context>
@/Users/pauloloureiro/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pauloloureiro/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Problem Analysis:
- API Route (`/api/customers` POST): FINANCE IS allowed - line 91-92 has `allowedRoles = ["ADMIN", "FINANCE", "COMMERCIAL", "SALES"]`
- Sidebar Navigation (`sidebar-nav.tsx`): "Criar Cliente" link at line 149-154 only includes `["ADMIN", "COMMERCIAL"]` roles
- Customers List Page (`/dashboard/customers/page.tsx`): Has "Add Customer" button at line 244 that FINANCE CAN see
- New Customer Page (`/dashboard/customers/new/page.tsx`): Only checks session, not role - FINANCE can access if navigated directly

Root Cause: Navigation discoverability. FINANCE can create customers via API and can access the page, but the sidebar doesn't show them a direct link.

Fix: Add "Create Customer" link to Finance section in sidebar-nav.tsx.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Create Customer link to Finance section in sidebar navigation</name>
  <files>components/dashboard/sidebar-nav.tsx</files>
  <action>
In the Finance section (lines 92-143 of sidebar-nav.tsx), add a new navigation item for "Create Customer" that links to `/dashboard/customers/new`.

Add after the "Customers" link (around line 136), before "Insights":

```typescript
{
  href: "/dashboard/customers/new",
  label: "Create Customer",
  icon: PlusCircle,
  roles: ["ADMIN", "FINANCE"],
},
```

The PlusCircle icon is already imported (line 21).

The final Finance section items order should be:
1. Invoices
2. Contracts
3. Create Contract
4. Create Invoice
5. Approval Queue
6. Payments
7. Customers
8. Create Customer (NEW)
9. Insights
  </action>
  <verify>
1. Check sidebar-nav.tsx has the new entry: `grep -n "customers/new.*FINANCE" components/dashboard/sidebar-nav.tsx`
2. Verify syntax: `npm run lint -- components/dashboard/sidebar-nav.tsx`
3. Build check: `npm run build`
  </verify>
  <done>
- Finance section in sidebar-nav.tsx includes "Create Customer" link with href="/dashboard/customers/new"
- FINANCE role is included in the roles array for this link
- Application builds without errors
  </done>
</task>

</tasks>

<verification>
1. Lint passes: `npm run lint`
2. Build succeeds: `npm run build`
3. Manual verification: Login as FINANCE user, confirm "Create Customer" link appears in sidebar under Finance section
</verification>

<success_criteria>
- FINANCE users see "Create Customer" link in sidebar Finance section
- Clicking link navigates to /dashboard/customers/new
- Customer creation form works for FINANCE role (already functional, just needed navigation)
- No regression for ADMIN or COMMERCIAL roles
</success_criteria>

<output>
After completion, create `.planning/quick/019-finance-nao-est-conseguindo-gerar-client/019-SUMMARY.md`
</output>
