---
type: quick
wave: 1
depends_on: []
files_modified: 
  - app/dashboard/invoices/new/InvoiceForm.tsx
autonomous: true

must_haves:
  truths:
    - Invoice creator form has modern card-based layout
    - Form sections are visually distinct with clear hierarchy
    - Total calculation is prominently displayed
    - Mobile responsiveness matches invoice detail page
  artifacts:
    - path: "app/dashboard/invoices/new/InvoiceForm.tsx"
      provides: "Enhanced UI/UX with card sections and better spacing"
      min_lines: 650
  key_links:
    - from: "Card sections"
      to: "Form fields"
      via: "Visual grouping and spacing"
      pattern: "rounded-lg.*shadow-md.*p-6"
---

<objective>
Improve the invoice creator form UI/UX with modern card-based layout, better visual hierarchy, prominent total display, and enhanced mobile responsiveness. This is a UI/UX enhancement only - no functional changes to form logic or submission.

Purpose: Provide Finance team with professional, easy-to-use invoice creation interface matching the quality of redesigned invoice detail page (quick-009).

Output: Enhanced InvoiceForm.tsx with card-based sections, better spacing, prominent summary, and improved mobile layout.
</objective>

<execution_context>
@~/.config/Claude/get-shit-done/workflows/execute-plan.md
@~/.config/Claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@app/dashboard/invoices/new/InvoiceForm.tsx
@.planning/quick/009-redesign-invoice-detail-page-with-better/009-SUMMARY.md

## Design Reference
Quick task 009 established modern design patterns:
- Card-based layout with shadow-md and rounded-lg
- Colored left borders for key sections (border-l-4)
- Clear visual hierarchy (text-xl for headings, proper spacing)
- Prominent display of key information (large font sizes for important values)
- Professional color coding (blue, green, red, orange, gray)
- Consistent spacing: p-6 for cards, gap-6 between sections, gap-4 within sections
- Mobile responsive: single column on mobile, multi-column on desktop

## Current State
The invoice creator form (InvoiceForm.tsx) is functional but basic:
- No card-based sections (just plain divs with borders)
- Total calculation section at bottom is not prominent
- Form feels cramped with minimal spacing
- Line items section not visually distinct
- No clear visual hierarchy between sections
- Basic styling doesn't match professional invoice detail page

## Requirements
UI/UX improvements only - preserve ALL existing functionality:
- Keep all form state management (useState, useEffect)
- Keep all calculation logic (calculateTotal, generateInstallmentSchedule)
- Keep all validation and submission logic
- Keep all service item loading
- Keep all customer/deal filtering
- NO changes to API calls or data flow
</context>

<tasks>

<task type="auto">
  <name>Enhance invoice form with card-based layout and visual hierarchy</name>
  <files>app/dashboard/invoices/new/InvoiceForm.tsx</files>
  <action>
Apply modern UI/UX improvements to InvoiceForm.tsx following quick-009 design patterns:

**1. Page Header Enhancement:**
- Convert header div to card with rounded-lg shadow-md p-6 bg-white
- Improve title spacing and layout
- Keep back link with ArrowLeft icon (add import from lucide-react if needed)
- Better spacing between header and form (mb-6)

**2. Create Card-Based Section Structure:**

**Section 1: Customer Information Card** (first section)
- Wrap Customer + Deal fields in card: bg-white rounded-lg shadow-md p-6
- Add section heading: "Customer Information" (text-xl font-semibold mb-4)
- Keep existing grid-cols-1 md:grid-cols-2 layout for fields
- Improve field labels with better typography (text-sm font-medium mb-2)

**Section 2: Invoice Details Card** (description field)
- Separate card for description field
- Heading: "Invoice Details" (text-xl font-semibold mb-4)
- Better spacing around description field

**Section 3: Line Items Card** (most important section)
- Prominent card with bg-white rounded-lg shadow-md p-6
- Heading with colored left border: border-l-4 border-blue-500 pl-4
- Section title: "Line Items" (text-xl font-semibold)
- "+ Add item" button enhanced with better styling (blue, rounded-md)
- Each line item in nested card with bg-gray-50 (instead of white border)
- Better visual separation between items (mb-4)
- Item headers with better typography
- Remove button styled consistently (text-red-600 hover:text-red-700)

**Section 4: Pricing Summary Card** (PROMINENT DISPLAY)
- Move discount field into this card
- Create visually distinct summary card with bg-blue-50 border-l-4 border-blue-500
- Large heading: "Invoice Summary" (text-2xl font-bold mb-6)
- Enhanced calculation display:
  - Larger fonts for key values (text-2xl for total)
  - Better spacing between rows (space-y-3)
  - Visual separators (border-t border-blue-200)
  - Color coding: discounts in red, totals in bold
- Move existing calculation box inside this card (improve styling)

**Section 5: Payment Configuration Card**
- Separate card for entry amount, installments, due date
- Heading: "Payment Terms" (text-xl font-semibold mb-4)
- Keep existing grid layout
- Improve field styling and spacing

**Section 6: Installment Schedule Enhancement** (if applicable)
- Keep existing blue schedule box but improve styling
- Better card appearance with rounded-lg and better padding
- Enhanced typography for schedule items

**3. Form Action Buttons Enhancement:**
- Create button footer card with bg-gray-50 p-6 rounded-lg
- Better button styling:
  - Cancel: gray outline with hover effect
  - Submit: blue solid with prominent styling (px-6 py-3, text-lg)
- Proper spacing and alignment (justify-end gap-3)

**4. Loading and Error States:**
- Enhance error display: bg-red-50 border-l-4 border-red-500 p-4 rounded-lg
- Loading states with better visual indicators

**5. Mobile Responsiveness:**
- Ensure all cards stack properly on mobile
- Touch-friendly button sizes (min 44px height)
- Proper gap spacing for mobile (gap-4 on mobile, gap-6 on desktop)
- Test responsive breakpoints: sm, md, lg

**6. Typography and Spacing Consistency:**
- Section headings: text-xl font-semibold
- Field labels: text-sm font-medium text-gray-700
- Values: font-mono for currency amounts
- Consistent padding: p-6 for main cards, p-4 for nested items
- Consistent gaps: gap-6 between sections, gap-4 within sections

**7. Color Scheme (match quick-009):**
- Primary actions: blue (#3B82F6)
- Success/positive: green (#10B981)
- Error/destructive: red (#EF4444)
- Warning: orange (#F97316)
- Neutral: gray (#6B7280)

**Important:** 
- DO NOT modify any useState, useEffect, or calculation logic
- DO NOT change form submission logic
- DO NOT modify API calls or data fetching
- ONLY update JSX markup and Tailwind classes
- Preserve all existing functionality, props, and behavior
- Keep all existing imports (add only lucide-react icons if needed)
  </action>
  <verify>
Manual verification required:
1. Run `npm run dev` and visit http://localhost:3000/dashboard/invoices/new
2. Verify card-based layout is visible and professional
3. Check section hierarchy is clear (Customer → Details → Items → Summary → Payment)
4. Verify line items section is visually distinct with nested cards
5. Check invoice summary card is prominent with large total display
6. Test mobile responsiveness (resize browser to mobile width)
7. Verify all form fields still work (type, select, add/remove items)
8. Test form submission creates invoice successfully
9. Check error display if validation fails (remove customer selection)
10. Verify loading states during service item fetch

Expected behavior:
- Modern card-based layout with consistent shadows and borders
- Clear visual hierarchy between sections
- Prominent total display in blue summary card
- Professional spacing and typography
- Smooth mobile experience with stacked cards
- All functionality preserved (calculations, validation, submission)
  </verify>
  <done>
Invoice creator form UI/UX enhanced with:
- Card-based section layout (6 distinct cards)
- Prominent invoice summary with large total display
- Better visual hierarchy and spacing
- Professional typography and color scheme
- Enhanced mobile responsiveness
- All existing functionality preserved
- Design matches invoice detail page quality (quick-009)
  </done>
</task>

</tasks>

<verification>
## Manual Testing Checklist

**Visual Verification:**
- [ ] Form has modern card-based layout
- [ ] Section headings are clear and prominent
- [ ] Line items section visually distinct from other sections
- [ ] Invoice summary card stands out with blue left border
- [ ] Total amount displayed in large font (text-2xl or larger)
- [ ] Consistent spacing and padding across all cards
- [ ] Professional color scheme matching invoice detail page

**Functional Verification:**
- [ ] All form fields work (customer, deal, items, discount, payment terms)
- [ ] Service items load from QuickBooks
- [ ] Add/remove line items works
- [ ] Item quantity and price updates work
- [ ] Total calculation updates dynamically
- [ ] Installment schedule generates correctly
- [ ] Form submission creates invoice
- [ ] Error messages display properly
- [ ] Loading states show during API calls

**Mobile Verification:**
- [ ] Cards stack properly on mobile (single column)
- [ ] Buttons are touch-friendly (adequate size and spacing)
- [ ] Text is readable on small screens
- [ ] Form is usable on mobile device or narrow browser
- [ ] No horizontal scrolling required
</verification>

<success_criteria>
UI/UX enhancement complete when:
- [ ] Invoice creator form has card-based layout with 5-6 distinct sections
- [ ] Visual hierarchy is clear (headings, spacing, borders)
- [ ] Invoice summary card is prominent with large total display
- [ ] Line items section has nested cards with gray backgrounds
- [ ] Mobile layout works properly (single column, touch-friendly)
- [ ] Design quality matches invoice detail page (quick-009)
- [ ] All existing functionality preserved (no regressions)
- [ ] Form submission creates invoices successfully
- [ ] Finance team can easily understand form structure at a glance
</success_criteria>

<output>
After completion, create `.planning/quick/013-improve-invoice-creator-form-ui-ux-layou/013-SUMMARY.md` documenting:
- Visual improvements made (card structure, spacing, typography)
- Section layout (what cards were created)
- Mobile responsiveness enhancements
- Color scheme and design patterns used
- Screenshots or visual descriptions of layout
- Confirmation that all functionality preserved
</output>
