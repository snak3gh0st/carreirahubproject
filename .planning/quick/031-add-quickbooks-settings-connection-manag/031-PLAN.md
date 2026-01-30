---
phase: quick-031
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/dashboard/settings/integrations/page.tsx
  - middleware.ts
autonomous: true

must_haves:
  truths:
    - "Admin can see QuickBooks connection status (connected/disconnected)"
    - "Admin can disconnect from QuickBooks when connected"
    - "Admin can reconnect to QuickBooks after disconnecting"
    - "Settings page is admin-only (ADMIN role required)"
  artifacts:
    - path: "app/dashboard/settings/integrations/page.tsx"
      provides: "QuickBooks disconnect button and improved connection status UI"
      min_lines: 300
    - path: "middleware.ts"
      provides: "Admin role check for /dashboard/settings routes"
      contains: "settings"
  key_links:
    - from: "app/dashboard/settings/integrations/page.tsx"
      to: "/api/quickbooks/auth/disconnect"
      via: "POST request on disconnect button click"
      pattern: "fetch.*api/quickbooks/auth/disconnect"
    - from: "middleware.ts"
      to: "app/dashboard/settings"
      via: "role-based access control"
      pattern: "dashboard/settings.*ADMIN"
---

<objective>
Add QuickBooks disconnect functionality and admin-only access to the settings page that was previously removed from the admin area.

Purpose: Enable administrators to manage QuickBooks connection lifecycle (connect/disconnect/reconnect) and ensure settings page is properly protected with admin-only access.

Output: Fully functional QuickBooks settings UI with connection management and proper role-based access control.
</objective>

<execution_context>
@~/.config/Claude/get-shit-done/workflows/execute-plan.md
@~/.config/Claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@app/dashboard/settings/integrations/page.tsx
@app/api/quickbooks/auth/connect/route.ts
@app/api/quickbooks/auth/disconnect/route.ts
@app/api/system/status/route.ts
@middleware.ts
@lib/services/quickbooks.service.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add QuickBooks disconnect button and improve connection status UI</name>
  <files>app/dashboard/settings/integrations/page.tsx</files>
  <action>
    Update the existing integrations page to add QuickBooks disconnect functionality:
    
    1. Add disconnect handler function `handleQuickBooksDisconnect`:
       - Call POST /api/quickbooks/auth/disconnect
       - Show loading state during disconnection
       - Reload status after successful disconnect
       - Show error alert if disconnect fails
    
    2. Update QuickBooks Card UI:
       - When connected: Show both "Reconectar" and "Desconectar" buttons side by side
       - When disconnected: Show only "Conectar" button
       - Add company name display if available in status (status?.quickbooks.companyName)
       - Improve visual hierarchy with proper button variants (primary for connect, destructive for disconnect)
    
    3. Add loading states:
       - Track `disconnecting` state separately from existing `loading`
       - Disable buttons during disconnect operation
       - Show "Desconectando..." text on button during operation
    
    4. Add success/error feedback:
       - Add `disconnectResult` state for success/error messages
       - Display Alert component below buttons showing disconnect result
       - Clear result state on next operation
    
    Keep all existing functionality (Pipedrive, webhook secrets, sync history) unchanged.
  </action>
  <verify>
    1. Check file compiles: npm run build (or at least tsx check on the file)
    2. Verify disconnect button appears when QuickBooks is connected
    3. Verify both Connect and Disconnect buttons have proper styling and states
    4. Verify handleQuickBooksDisconnect function calls correct endpoint
  </verify>
  <done>
    - Disconnect button added to QuickBooks card
    - Button shows "Desconectando..." during operation
    - Status reloads after successful disconnect
    - Error handling displays user-friendly messages
    - UI shows proper connect/disconnect/reconnect flow
  </done>
</task>

<task type="auto">
  <name>Task 2: Add admin-only protection to settings routes</name>
  <files>middleware.ts</files>
  <action>
    Add role-based access control for settings routes in the existing middleware:
    
    1. Add settings route protection after existing role checks (after line 35):
       ```typescript
       if (path.startsWith("/dashboard/settings") && userRole !== "ADMIN") {
         return NextResponse.redirect(new URL("/dashboard", req.url));
       }
       ```
    
    2. Place this check in the `if (path.startsWith("/dashboard"))` block
    3. Ensure it redirects non-admin users to /dashboard
    4. Keep all existing role checks (leads, invoices, conversations) unchanged
    
    This ensures only ADMIN role can access /dashboard/settings/integrations and any future settings pages.
  </action>
  <verify>
    1. Check file compiles: npm run build
    2. Verify middleware includes settings route check
    3. Verify check is inside dashboard path block
    4. Verify redirect target is /dashboard
  </verify>
  <done>
    - Middleware blocks non-admin access to /dashboard/settings/*
    - Admin users can access settings pages
    - Non-admin users redirect to /dashboard
    - Existing role checks remain functional
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    QuickBooks disconnect functionality and admin-only settings access control:
    - Disconnect button in QuickBooks integration card
    - Admin-only middleware protection for settings routes
  </what-built>
  <how-to-verify>
    1. Start dev server: `npm run dev`
    2. Login as admin user (ADMIN role)
    3. Navigate to http://localhost:3000/dashboard/settings/integrations
    4. If QuickBooks is connected:
       - Verify "Reconectar" and "Desconectar" buttons are visible
       - Click "Desconectar" button
       - Verify loading state shows "Desconectando..."
       - Verify success message appears
       - Verify status updates to "✗ Não conectado"
       - Verify only "Conectar" button now shows
    5. If QuickBooks not connected:
       - Click "Conectar" to go through OAuth flow
       - After connecting, verify disconnect button appears
    6. Test admin protection:
       - Login as non-admin user (if test user exists)
       - Try accessing /dashboard/settings/integrations
       - Verify redirect to /dashboard occurs
    
    Expected: Full connect/disconnect/reconnect cycle works smoothly with proper admin-only access.
  </how-to-verify>
  <resume-signal>
    Type "approved" if disconnect works and admin protection active, or describe any issues found.
  </resume-signal>
</task>

</tasks>

<verification>
## Overall Phase Verification

After all tasks complete:

1. **QuickBooks Connection Management**:
   - [ ] Connect button redirects to OAuth flow
   - [ ] Disconnect button clears tokens and updates status
   - [ ] Reconnect button works after disconnect
   - [ ] Connection status displays correctly (connected/disconnected)
   - [ ] Company ID shows when connected

2. **Admin Access Control**:
   - [ ] Admin users can access /dashboard/settings/integrations
   - [ ] Non-admin users cannot access settings (redirect to /dashboard)
   - [ ] Middleware check doesn't break existing protections

3. **UI/UX**:
   - [ ] Loading states during disconnect operation
   - [ ] Success/error messages display properly
   - [ ] Button states (enabled/disabled) work correctly
   - [ ] Visual hierarchy clear (primary vs destructive buttons)

4. **Error Handling**:
   - [ ] API errors show user-friendly messages
   - [ ] Failed disconnects don't leave system in bad state
   - [ ] Network errors handled gracefully
</verification>

<success_criteria>
## Completion Criteria

This quick plan is complete when:

1. **Disconnect Functionality**: Admin can click "Desconectar" button and successfully disconnect QuickBooks, with status updating to show disconnected state
2. **Connection Cycle**: Full cycle works: Connect → Disconnect → Reconnect
3. **Admin Protection**: Non-admin users cannot access /dashboard/settings/* routes
4. **No Regressions**: Existing integrations page functionality (Pipedrive, webhook secrets, sync history) remains intact
5. **Production Ready**: Code compiles, no TypeScript errors, proper error handling in place

Measurable: Admin can disconnect QuickBooks in under 2 seconds with visual feedback, and non-admin users get immediate redirect when attempting to access settings.
</success_criteria>

<output>
After completion, create `.planning/quick/031-add-quickbooks-settings-connection-manag/031-SUMMARY.md` documenting:
- Changes made to integrations page
- Disconnect functionality implementation
- Admin middleware protection added
- Testing results from verification checkpoint
</output>
