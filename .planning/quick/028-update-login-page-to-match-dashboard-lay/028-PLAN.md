---
phase: quick-028
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: 
  - app/auth/signin/page.tsx
autonomous: true

must_haves:
  truths:
    - "Login page uses same bg-gray-50 container structure as dashboard"
    - "Login card maintains proper spacing and professional styling"
    - "Form remains centered and functional"
  artifacts:
    - path: "app/auth/signin/page.tsx"
      provides: "Login page with dashboard-consistent layout"
      min_lines: 120
  key_links:
    - from: "app/auth/signin/page.tsx"
      to: "Phase 9 design tokens"
      via: "bg-gray-50, container mx-auto, px-4 sm:px-6, py-8"
---

<objective>
Update login page layout to match the consistent container structure and spacing patterns used across all dashboard pages, while maintaining the centered login form UX.

Purpose: Create visual consistency between the login page and authenticated dashboard pages, making the app feel like a cohesive professional system.
Output: Login page with dashboard-consistent layout wrapper, preserving centered card design and all functionality.
</objective>

<execution_context>
@~/.config/Claude/get-shit-done/workflows/execute-plan.md
@~/.config/Claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@app/auth/signin/page.tsx
@app/dashboard/page.tsx
@app/dashboard/customers/page.tsx

Phase 9 design tokens already applied to login (Quick Task 027):
- bg-gray-50, border-gray-200, shadow-sm, rounded-xl
- primary-* colors, error-* colors
- Professional spacing and typography

Dashboard layout pattern:
- Outer wrapper: `bg-gray-50` full page
- Container: `container mx-auto px-4 sm:px-6 py-8`
- Content sections with proper spacing
</context>

<tasks>

<task type="auto">
  <name>Update login page container structure</name>
  <files>app/auth/signin/page.tsx</files>
  <action>
Update the SignInForm component to use the dashboard-consistent layout structure:

1. Replace the current structure:
   ```tsx
   <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
   ```
   With dashboard-style structure:
   ```tsx
   <div className="bg-gray-50 min-h-screen">
     <div className="container mx-auto px-4 sm:px-6 py-8">
       <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
   ```

2. Keep the login card exactly as is (all existing classes, structure, and content):
   - `max-w-md w-full bg-white rounded-xl border border-gray-200 shadow-sm p-8`
   - All form fields, labels, buttons, error handling
   - Development notes and test user info

3. Close the three wrapper divs properly at the end

4. Update the Suspense fallback to match:
   ```tsx
   <div className="bg-gray-50 min-h-screen flex items-center justify-center">
   ```

This creates the same container structure as dashboard pages (`bg-gray-50` → `container mx-auto px-4 sm:px-6 py-8`) while maintaining the centered card layout for optimal login UX.

DO NOT change any form logic, validation, error handling, or content.
  </action>
  <verify>
Visual check:
1. `npm run dev` and visit http://localhost:3000/auth/signin
2. Verify page background is gray-50 with consistent padding
3. Verify login card is still centered both horizontally and vertically
4. Verify responsive behavior on mobile (padding adjusts from px-4 to px-6)
5. Test login still works (admin@carreirausa.com)
  </verify>
  <done>
- Login page uses `bg-gray-50` → `container mx-auto px-4 sm:px-6 py-8` structure matching dashboard
- Login card remains centered with all existing styling
- Form functionality unchanged (authentication, validation, error handling)
- Responsive padding matches dashboard pages
- No visual glitches or layout breaks
  </done>
</task>

</tasks>

<verification>
1. Compare login page layout to dashboard page side-by-side
2. Verify consistent spacing and container structure
3. Confirm login card still properly centered
4. Test responsive behavior (desktop, tablet, mobile)
5. Verify login flow works end-to-end
</verification>

<success_criteria>
- Login page outer structure matches dashboard pages (bg-gray-50, container, padding)
- Login card remains centered and visually unchanged
- Responsive padding consistent (px-4 sm:px-6)
- No functionality regressions
- Professional, cohesive appearance across auth and dashboard
</success_criteria>

<output>
After completion, create `.planning/quick/028-update-login-page-to-match-dashboard-lay/028-SUMMARY.md`
</output>
