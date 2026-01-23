---
type: quick
number: 009
description: Redesign invoice detail page with better layout and delete button
autonomous: true
---

<objective>
Redesign the invoice detail page (`/dashboard/invoices/[id]`) with a modern, clean layout that improves visual hierarchy and adds a prominent delete button in the header area.

Purpose: Improve UX for Finance team by making key financial information (amount, status, due date) stand out and making actions (Edit, Delete, Download) easy to find and use.

Output: Modernized invoice detail page with card-based design, better spacing, improved mobile responsiveness, and action buttons grouped in header.
</objective>

<execution_context>
@~/.config/Claude/get-shit-done/workflows/execute-quick.md
</execution_context>

<context>
@.planning/STATE.md
@app/dashboard/invoices/[id]/page.tsx
@app/api/invoices/[id]/route.ts
</context>

<tasks>

<task type="auto">
  <name>Redesign invoice detail page with modern layout and delete button</name>
  <files>
    app/dashboard/invoices/[id]/page.tsx
  </files>
  <action>
Redesign the invoice detail page with modern, clean layout following these requirements:

**Header Section:**
- Move invoice number and approval badge to top
- Add action button group in header: [Edit] [Delete] [Download PDF]
- Delete button: Red/destructive styling, confirm dialog before deletion
- Delete button calls DELETE /api/invoices/[id] (existing endpoint)
- On successful delete: redirect to /dashboard/invoices
- Download PDF button: Only show if invoice.pdfUrl exists

**Key Financial Information (Prominent):**
- Large amount display (bigger font, bold)
- Status badge with color coding (paid=green, overdue=red, sent=blue, draft=gray)
- Due date prominently displayed with overdue indicator if applicable
- Use larger text sizes and bold weights for these 3 key metrics

**Improved Visual Hierarchy:**
- Card-based sections with consistent spacing
- Clear section headings (font-semibold, text-lg or text-xl)
- Better use of whitespace between sections
- Status colors consistent throughout (green for paid/success, red for overdue/errors, blue for active, orange for pending)

**Section Organization (Less Cluttered):**
- Invoice Details card: Amount, Status, Due Date, Created Date, Payment Info
- Customer Information card: Name, Email, Phone, Financial Summary, Links
- Workflow Timeline: Keep existing WorkflowTimeline component
- Approval Section: Keep existing approval/rejection cards
- Contract Status: Keep ContractStatusCard component
- Payment Status: Keep PaymentStatusCard component
- Collection Calls: Keep existing section
- Related Deal: Keep existing section (if deal exists)

**Mobile Responsive:**
- Action buttons stack vertically on mobile
- Two-column layout on desktop, single column on mobile
- Touch-friendly button sizes
- Adequate spacing for mobile taps

**Keep All Existing Functionality:**
- All approval workflow features
- All timeline visualization
- All contract status features
- All payment status features
- All collection call features
- All customer information
- All deal information
- All external ID displays

**Styling Guidelines:**
- Use Tailwind utility classes
- Card shadows: shadow or shadow-md
- Rounded corners: rounded-lg
- Padding: p-6 for cards
- Gaps: gap-4 or gap-6 between elements
- Status badge sizing: px-3 py-1 text-sm
- Button sizing: px-4 py-2 text-sm for actions

**Delete Confirmation:**
```typescript
const handleDelete = async () => {
  if (!confirm(`Are you sure you want to delete invoice ${invoice.invoiceNumber || invoice.id.slice(0, 8)}? This action cannot be undone.`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/invoices/${invoice.id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const error = await response.json();
      alert(`Failed to delete invoice: ${error.error}`);
      return;
    }
    
    // Redirect to invoice list
    window.location.href = '/dashboard/invoices';
  } catch (error) {
    alert('An error occurred while deleting the invoice');
    console.error(error);
  }
};
```

Make this a client component ('use client') for interactive delete functionality, or create a separate DeleteInvoiceButton client component that the server component can import.
  </action>
  <verify>
1. Visual inspection: Visit /dashboard/invoices/[id] page
2. Verify header shows invoice number, approval badge, and 3 action buttons
3. Verify key financial info (amount, status, due date) is prominently displayed
4. Verify card-based layout with good spacing
5. Test delete button: Click → Confirm dialog → DELETE API call → Redirect to list
6. Test responsive: Resize browser to mobile width, verify layout adjusts
7. Verify all existing functionality still works (approval actions, timeline, contract status, etc.)
  </verify>
  <done>
✅ Invoice detail page has modern card-based layout with better visual hierarchy
✅ Delete button prominent in header with confirmation dialog
✅ Action buttons (Edit, Delete, Download) grouped in header area
✅ Key financial information (amount, status, due date) stands out with larger/bolder styling
✅ Mobile responsive with single-column layout and stacked buttons
✅ All existing functionality preserved (approval, workflow, contract, payment, collection)
✅ Delete button successfully calls API and redirects on success
  </done>
</task>

</tasks>

<verification>
**Visual Verification:**
- Navigate to any invoice detail page
- Header shows invoice number + approval badge + action buttons
- Key metrics (amount, status, due date) are visually prominent
- Layout is clean with good spacing between sections
- Cards have consistent shadows and rounded corners

**Functional Verification:**
- Click delete button → confirmation dialog appears
- Confirm delete → invoice deleted → redirected to /dashboard/invoices
- Cancel delete → stays on page, no deletion
- Download PDF button only visible when invoice.pdfUrl exists
- All existing features work (approval, timeline, contract actions, etc.)

**Responsive Verification:**
- Desktop (>1024px): Two-column layout, horizontal button group
- Mobile (<768px): Single column, stacked buttons
- All content readable and accessible on mobile
</verification>

<success_criteria>
**User Experience:**
- Finance team can quickly scan key invoice information (amount, status, due date)
- Delete action is easy to find and use (header area, prominent styling)
- Layout is clean and not cluttered
- Mobile experience is improved with better touch targets

**Technical:**
- Page remains server component (or properly structured with client components)
- Delete button properly calls DELETE API endpoint
- Confirmation dialog prevents accidental deletions
- Successful delete redirects to invoice list
- All existing functionality preserved (no regressions)
- Mobile responsive with proper Tailwind breakpoints
</success_criteria>

<output>
After completion, create `.planning/quick/009-redesign-invoice-detail-page-with-better/009-SUMMARY.md` with:
- Before/after description of layout changes
- Screenshot or detailed description of new header with action buttons
- Confirmation that all existing functionality works
- Any visual design decisions made (colors, spacing, sizing)
</output>
