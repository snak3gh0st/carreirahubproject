---
phase: quick-032
plan: 01
type: execute
subsystem: dashboard-navigation
tags: [quickbooks, navigation, ui-fix, admin]
requires: []
provides:
  - Working QuickBooks sync link on dashboard
  - Navigation to Settings page for QuickBooks management
affects: []
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - app/dashboard/page.tsx
decisions: []
metrics:
  duration: 2 minutes
  completed: 2026-01-30
---

# Quick Task 032: Fix Broken QuickBooks Sync Link

**One-liner:** Fixed dashboard QuickBooks sync link to redirect to Settings page instead of non-existent route

## What Was Done

### Task 1: Fix QuickBooks Sync Link on Dashboard ✅

**Changed:** `app/dashboard/page.tsx` line 283
- **From:** `href="/dashboard/quickbooks/sync"` (404 error)
- **To:** `href="/dashboard/settings/integrations"` (working Settings page)

**Rationale:**
- Settings page already has full QuickBooks integration management UI
- Shows connection status, last sync time, and manual sync trigger
- Consistent with other admin configuration actions
- No need for dedicated sync page when Settings provides complete functionality

**Verification Results:**
- ✅ Dashboard link updated successfully
- ✅ Build passes without errors (npm run build)
- ✅ No other references to old path exist (git grep confirmed)
- ✅ Settings button confirmed visible in sidebar for Admin users (line 216-220 in sidebar-nav.tsx)
- ✅ Settings page exists and is accessible at `/dashboard/settings/integrations`

## Commit History

| Commit  | Type | Description                                    |
|---------|------|------------------------------------------------|
| 1c1619f | fix  | Fix broken QuickBooks sync link on dashboard   |

## User Impact

**Before:**
- Admin users clicking "Sync QuickBooks" action card got 404 error
- Broken navigation experience
- Manual navigation to Settings page required

**After:**
- ✅ Admin users can click "Sync QuickBooks" action card → redirects to Settings page
- ✅ Access QuickBooks sync via Settings button in sidebar (Admin section)
- ✅ Consistent navigation experience
- ✅ Full integration management UI available on Settings page

## Technical Details

**Navigation Architecture:**
- Dashboard action cards provide quick access to common admin tasks
- Settings page centralizes all integration management (QuickBooks, DocuSign, etc.)
- Sidebar navigation provides direct access to Settings for Admin users only
- Role-based access control enforced via NextAuth middleware

**Files Examined:**
- `app/dashboard/page.tsx` - Dashboard action cards (fixed)
- `app/dashboard/settings/integrations/page.tsx` - Settings page (verified exists)
- `components/dashboard/sidebar-nav.tsx` - Sidebar navigation (verified Settings button present)

**API Endpoints (Unchanged):**
- `/api/quickbooks/sync` - Main sync endpoint
- `/api/quickbooks/sync/customers` - Customer sync
- `/api/quickbooks/sync/invoices` - Invoice sync

These API endpoints remain unchanged and are correctly referenced in the Settings page.

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

No blockers. Quick task complete.

**Quality Checks:**
- ✅ TypeScript compilation passes
- ✅ No broken import references
- ✅ Settings page verified working
- ✅ Role-based access control verified
- ✅ No other files reference broken path

## Summary

Successfully fixed broken QuickBooks sync link on dashboard by redirecting to existing Settings page. Admin users now have seamless access to QuickBooks management via both dashboard action card and sidebar navigation. Zero code additions required - simply corrected the href to point to existing, fully-functional Settings page.
