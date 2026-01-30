---
type: quick
number: "029"
description: Add contract creation button in contract area and implement visual contract preview/viewing functionality
wave: 1
autonomous: true

must_haves:
  truths:
    - "User can initiate contract creation from contracts list page"
    - "User can view signed contracts visually in browser"
    - "Contract preview works without downloading PDF"
  artifacts:
    - path: "app/dashboard/contracts/page.tsx"
      provides: "Create Contract button in header"
      min_lines: 360
    - path: "app/dashboard/contracts/[id]/page.tsx"
      provides: "Visual contract preview using presigned S3 URLs"
      min_lines: 350
  key_links:
    - from: "app/dashboard/contracts/page.tsx"
      to: "/dashboard/contracts/new"
      via: "Link component button"
      pattern: "Link.*href.*contracts/new"
    - from: "app/dashboard/contracts/[id]/page.tsx"
      to: "contract.signedS3Url"
      via: "iframe or embed for PDF preview"
      pattern: "iframe|embed.*signedS3Url"
---

<objective>
Add "Create Contract" button to contracts list page and implement visual contract preview functionality for signed contracts, allowing users to view PDFs directly in the browser without downloading.

Purpose: Improve contract workflow UX by making contract creation easily accessible from the contracts area (not just from invoices), and enable visual contract review without requiring downloads.

Output: 
- Contracts list page with prominent "Create Contract" button
- Contract detail page with visual PDF preview for signed contracts
</objective>

<execution_context>
@~/.config/Claude/get-shit-done/workflows/execute-plan.md
@~/.config/Claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md

# Current contract implementation
@app/dashboard/contracts/page.tsx
@app/dashboard/contracts/[id]/page.tsx
@app/dashboard/contracts/new/page.tsx

# Recent work context
@.planning/quick/025-add-contract-generator-page-for-commerci/025-SUMMARY.md

# Design system components
@components/ui/button.tsx
</context>

<tasks>

<task type="auto">
  <name>Add Create Contract button to contracts list header</name>
  <files>app/dashboard/contracts/page.tsx</files>
  <action>
    Add a "Create Contract" button to the page header section (lines 126-131), next to the title/description.
    
    Implementation:
    1. Update the header flex container to justify-between for button alignment
    2. Add Link component wrapping a button:
       - Use Link from 'next/link' (already imported)
       - href="/dashboard/contracts/new"
       - Button styling: bg-primary-600 text-white with hover:bg-primary-700
       - Include Plus icon from lucide-react (already imported)
       - Text: "Create Contract"
    3. Make button responsive: show icon + text on desktop, icon-only on mobile with tooltip
    
    Match the visual style of other action buttons in the application (reference invoices list page if needed).
    Use existing design system tokens (primary-600, etc.) for consistency.
  </action>
  <verify>
    1. Visit http://localhost:3000/dashboard/contracts
    2. Verify "Create Contract" button appears in header next to title
    3. Click button navigates to /dashboard/contracts/new
    4. Button styling matches dashboard design system
  </verify>
  <done>
    - "Create Contract" button visible in contracts list header
    - Button navigates to contract creation page when clicked
    - Button uses consistent styling with rest of dashboard
  </done>
</task>

<task type="auto">
  <name>Implement visual PDF preview for signed contracts</name>
  <files>app/dashboard/contracts/[id]/page.tsx</files>
  <action>
    Add visual contract preview section to the contract detail page for signed contracts using S3 presigned URLs.
    
    Implementation:
    1. Add a new section after the action buttons (after line 215) but before the grid layout
    2. Only show preview section if contract.status === 'SIGNED' AND contract.signedS3Url exists
    3. Create a preview card with:
       - Title: "Contract Preview"
       - Full-width responsive container
       - Embedded PDF viewer using iframe:
         * src={contract.signedS3Url}
         * width: 100%
         * height: 800px (desktop), 600px (mobile)
         * className: "border border-gray-200 rounded-lg"
         * Allow fullscreen for better viewing
       - Fallback message if PDF fails to load
    4. Add a "View in New Tab" link below the iframe for users who prefer separate window
    5. Show loading state while PDF loads
    
    Security note: S3 presigned URLs are time-limited (7 days per ROADMAP.md Phase 2), this is already handled by backend.
    
    DO NOT modify the download button functionality - this adds preview, not replaces download.
  </action>
  <verify>
    1. Create a test contract and mark as signed (or use existing signed contract)
    2. Visit contract detail page: http://localhost:3000/dashboard/contracts/[id]
    3. Verify PDF preview appears in iframe for signed contracts
    4. Verify PDF renders correctly and is scrollable
    5. Verify "View in New Tab" link opens PDF in new window
    6. Verify preview section NOT shown for non-signed contracts
    7. Test on mobile viewport (responsive height)
  </verify>
  <done>
    - Signed contracts display visual PDF preview in iframe
    - Preview is responsive and scrollable
    - "View in New Tab" option available
    - Download button still functional (unchanged)
    - Preview only shows for signed contracts with valid S3 URLs
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    1. "Create Contract" button in contracts list header
    2. Visual PDF preview for signed contracts in detail view
  </what-built>
  <how-to-verify>
    ## Test Contract Creation Button
    1. Navigate to http://localhost:3000/dashboard/contracts
    2. Verify "Create Contract" button visible in page header
    3. Click button → should navigate to /dashboard/contracts/new
    4. Test on mobile (< 768px) → button should adapt appropriately
    
    ## Test Contract Preview
    1. Find or create a signed contract
    2. Navigate to contract detail page
    3. Scroll down to "Contract Preview" section
    4. Verify PDF loads and displays in iframe
    5. Test scrolling through PDF document
    6. Click "View in New Tab" → PDF opens in new browser tab
    7. Verify download button still works independently
    8. Test with unsigned contract → verify preview section NOT shown
    
    ## Visual Polish Check
    - Button styling matches dashboard design system
    - Preview section has proper spacing and borders
    - Loading states appear smoothly
    - Mobile responsiveness works correctly
  </how-to-verify>
  <resume-signal>
    Type "approved" if both features work correctly, or describe any issues to fix
  </resume-signal>
</task>

</tasks>

<verification>
1. Contracts list page displays "Create Contract" button in header
2. Button navigates to /dashboard/contracts/new when clicked
3. Signed contract detail pages show visual PDF preview
4. Preview uses iframe with S3 presigned URLs
5. "View in New Tab" link opens PDF in new window
6. Download functionality remains unchanged
7. Preview only appears for signed contracts
8. UI is responsive on mobile and desktop
</verification>

<success_criteria>
**User Experience:**
- Commercial users can create contracts directly from contracts area
- Finance/admin users can visually review signed contracts without downloading
- PDF preview works seamlessly in modern browsers (Chrome, Firefox, Safari, Edge)

**Technical:**
- No breaking changes to existing contract functionality
- Uses existing S3 presigned URLs (no new API endpoints needed)
- Follows existing dashboard design patterns
- Mobile responsive
</success_criteria>

<output>
After completion, create `.planning/quick/029-add-contract-creation-button-in-contract/029-SUMMARY.md`
</output>
