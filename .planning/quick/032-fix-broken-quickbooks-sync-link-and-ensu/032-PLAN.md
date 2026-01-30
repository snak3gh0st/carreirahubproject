---
phase: quick-032
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/dashboard/page.tsx
autonomous: true

must_haves:
  truths:
    - "Admin users can click QuickBooks sync action on dashboard without 404 error"
    - "Settings button is visible in sidebar for Admin users"
  artifacts:
    - path: "app/dashboard/page.tsx"
      provides: "Fixed QuickBooks sync link"
      contains: "/dashboard/settings/integrations"
  key_links:
    - from: "app/dashboard/page.tsx"
      to: "/dashboard/settings/integrations"
      via: "Link href"
      pattern: 'href="/dashboard/settings/integrations"'
---

<objective>
Fix broken QuickBooks sync link on dashboard and confirm Settings button visibility.

**Purpose:** Eliminate 404 error when Admin users click "Sync QuickBooks" action card, and ensure they can access Settings page through sidebar navigation.

**Output:** Working navigation to Settings page where QuickBooks sync can be triggered.
</objective>

<execution_context>
@~/.config/Claude/get-shit-done/workflows/execute-plan.md
@~/.config/Claude/get-shit-done/templates/summary.md
</execution_context>

<context>
**Current State:**
- Dashboard has broken link: `/dashboard/quickbooks/sync` (line 283 in app/dashboard/page.tsx)
- Settings page exists at `/dashboard/settings/integrations` with Admin role requirement
- Settings button already exists in sidebar-nav.tsx (line 216-220) for ADMIN role only
- QuickBooks sync API endpoint exists at `/api/quickbooks/sync`

**Design Decision:**
Redirect to Settings page (not inline sync) because:
- Settings page provides full integration management UI
- Shows connection status, last sync time, and manual sync option
- Consistent with other admin actions requiring a dedicated page
- API endpoint exists but no direct UI trigger on dashboard is appropriate

@app/dashboard/page.tsx
@app/dashboard/settings/integrations/page.tsx
@components/dashboard/sidebar-nav.tsx
</context>

<tasks>

<task type="auto">
  <name>Fix QuickBooks sync link on dashboard</name>
  <files>app/dashboard/page.tsx</files>
  <action>
    Update the "Sync QuickBooks" Link component (line 282-299) to point to `/dashboard/settings/integrations` instead of `/dashboard/quickbooks/sync`.
    
    Change:
    ```tsx
    href="/dashboard/quickbooks/sync"
    ```
    
    To:
    ```tsx
    href="/dashboard/settings/integrations"
    ```
    
    **Why this approach:**
    - Settings page already has QuickBooks management UI
    - Consistent with other admin configuration actions
    - No need for dedicated sync page
    
    **Note:** Settings button is ALREADY visible in sidebar for Admin users (components/dashboard/sidebar-nav.tsx line 216-220), so no nav changes needed.
  </action>
  <verify>
    1. Read app/dashboard/page.tsx and confirm href is `/dashboard/settings/integrations`
    2. Run `npm run build` to check for TypeScript errors
    3. Verify no other references to `/dashboard/quickbooks/sync` exist: `git grep -n "quickbooks/sync" app/`
  </verify>
  <done>
    - Dashboard "Sync QuickBooks" button links to `/dashboard/settings/integrations`
    - No 404 errors when clicking the button
    - Build passes without errors
    - Settings button visible in sidebar for Admin users (already confirmed)
  </done>
</task>

</tasks>

<verification>
**Manual Verification Steps:**
1. Start dev server: `npm run dev`
2. Login as Admin user
3. Navigate to `/dashboard`
4. Confirm "Settings" button visible in left sidebar (Admin section)
5. Click "Sync QuickBooks" quick action card
6. Should navigate to `/dashboard/settings/integrations` (no 404)
7. Settings page should show QuickBooks integration status and controls

**Build Verification:**
- TypeScript compilation passes
- No broken import references
- No other files reference the old `/dashboard/quickbooks/sync` path
</verification>

<success_criteria>
- [ ] Dashboard page link updated to `/dashboard/settings/integrations`
- [ ] No 404 errors when clicking QuickBooks sync action
- [ ] Settings button confirmed visible for Admin users in sidebar
- [ ] Build passes without errors
- [ ] No other references to old sync path exist in codebase
</success_criteria>

<output>
After completion, create `.planning/quick/032-fix-broken-quickbooks-sync-link-and-ensu/032-01-SUMMARY.md` with:
- Link fix details
- Verification results
- User impact (Admin users can now access Settings via both sidebar and dashboard action)
</output>
