# Accessibility Guide (WCAG AA)

This document outlines all accessibility improvements and best practices implemented in Carreira AI Hub.

## Overview

Carreira AI Hub aims for **WCAG 2.1 AA compliance**, ensuring the application is usable by everyone, including people with disabilities.

### Key Accessibility Principles (POUR)
- **Perceivable**: Information must be presentable to all users
- **Operable**: All functionality must be accessible via keyboard
- **Understandable**: Content and interaction must be clear
- **Robust**: Compatible with assistive technologies

---

## 1. Keyboard Navigation

### ✅ What's Implemented

**Global Navigation**
- Cmd+K / Ctrl+K opens global search
- Tab key navigates through all interactive elements
- Shift+Tab navigates backwards
- Escape closes modals and dropdowns
- Enter/Space activates buttons and links

**Focus Management**
- All interactive elements have visible focus indicators (blue ring)
- Focus order is logical (top to bottom, left to right)
- Focus doesn't trap users unintentionally
- Modal dialogs trap focus within the modal

**Components**
- Buttons: Keyboard operable (Enter, Space)
- Links: Keyboard operable (Enter), styled to be keyboard-visible
- Form inputs: Tab navigation, proper labels
- Dropdowns: Arrow keys to navigate, Enter to select
- Data tables: Row selection with keyboard

### 📋 Implementation Details

**Focus Styles** (`app/globals.css`)
```css
:focus-visible {
  outline: none;
  ring: 2px;
  ring-offset: 2px;
  ring-color: #3b82f6;
}
```

**Keyboard Utilities** (`lib/utils/accessibility.ts`)
```typescript
KeyboardUtils.isEnter(e)     // Check if Enter pressed
KeyboardUtils.isEscape(e)    // Check if Escape pressed
KeyboardUtils.isTab(e)       // Check if Tab pressed
KeyboardUtils.isArrowKey(e)  // Check if arrow key pressed
```

### 🧪 Testing
1. **Keyboard-Only Navigation**: Use Tab, Shift+Tab, Enter, Escape
2. **Focus Visibility**: Ensure blue focus ring appears on all interactive elements
3. **Focus Trap**: Modal dialogs should trap Tab/Shift+Tab within modal
4. **Logical Tab Order**: Tab through page and verify order makes sense

---

## 2. Screen Reader Support

### ✅ What's Implemented

**Semantic HTML**
- Proper heading hierarchy: `<h1>` → `<h2>` → `<h3>` (no skipping levels)
- Navigation landmarks: `<header>`, `<nav>`, `<main>`, `<aside>`
- Form labels: `<label htmlFor="id">` properly associated
- Error messages: `<p role="alert">`
- Status announcements: `<div role="status" aria-live="polite">`

**ARIA Labels**
- Icon-only buttons: `aria-label="Action description"`
- Form inputs: `aria-invalid`, `aria-required`, `aria-describedby`
- Tables: `aria-colcount`, `aria-rowcount`, header associations
- Dropdowns: `aria-expanded`, `aria-haspopup`
- Modal dialogs: `role="dialog"`, `aria-labelledby`, `aria-modal="true"`

**Live Regions**
- Toasts: Announce user actions (success, error)
- Status updates: Sync operations, loading states
- Validation errors: Form submission feedback

### 📋 Implementation Details

**FormField Component** (`components/ui/form-field.tsx`)
```typescript
<FormField
  label="Email"
  required
  error={errors.email}
  htmlFor="email"
>
  <Input
    id="email"
    aria-invalid={!!errors.email}
    aria-required="true"
    aria-describedby="email-error"
  />
</FormField>
```

**Icon Button with Label**
```typescript
<Button aria-label="Delete invoice #1234">
  <Trash2 aria-hidden="true" />
</Button>
```

**Live Region Announcement**
```typescript
import { announceToScreenReader } from "@/lib/utils/accessibility"

announceToScreenReader("Invoice saved successfully!", "polite")
```

### 🧪 Testing

1. **NVDA (Windows)**: Free screen reader for Windows
2. **JAWS**: Commercial screen reader (free trial)
3. **macOS VoiceOver**: Built-in (Cmd+F5)
4. **Chrome DevTools**: Audit → Accessibility

**What to Check**
- All page elements are announced
- Form labels associated with inputs
- Error messages announced with role="alert"
- Links have descriptive text (avoid "click here")
- Images have alt text (if decorative, alt="")

---

## 3. Color & Contrast

### ✅ What's Implemented

**WCAG AA Contrast Ratios**
- Normal text: 4.5:1 (minimum)
- Large text (18pt+): 3:1 (minimum)
- UI components: 3:1 (minimum)

**Color Scheme**
- Light mode: Dark text on light background
- Dark mode: Light text on dark background
- Status indicators don't rely on color alone:
  - Green + "Paid" label
  - Red + "Overdue" label
  - Blue + "Sent" label

**Implementation**
- Tailwind color palette meets contrast requirements
- Dark mode variables ensure sufficient contrast
- Icons paired with text labels

### 🧪 Testing

1. **WebAIM Contrast Checker**: [webaim.org/resources/contrastchecker](https://webaim.org/resources/contrastchecker/)
2. **WAVE Tool**: Chrome extension for contrast analysis
3. **Chrome DevTools**: Issues tab → Contrast problems

---

## 4. Forms & Validation

### ✅ What's Implemented

**Form Accessibility**
- All inputs have associated labels
- Required fields marked with `aria-required="true"` and visual `*`
- Error messages linked with `aria-describedby`
- Input type hints: `type="email"`, `type="number"`, etc.
- Success messages announced to screen readers

**Error Handling**
```typescript
<Input
  id="email"
  type="email"
  aria-required="true"
  aria-invalid={!!errors.email}
  aria-describedby={errors.email ? "email-error" : undefined}
/>
{errors.email && (
  <p id="email-error" role="alert" className="text-red-600">
    {errors.email}
  </p>
)}
```

### 🧪 Testing
- Fill form with invalid data → errors announced
- Screen reader announces "invalid" on error inputs
- Tab to error message → message is readable
- After correction, aria-invalid removed

---

## 5. Mobile Accessibility

### ✅ What's Implemented

**Responsive Design**
- Touch targets minimum 44px × 44px (WCAG 2.1 Level AAA)
- Typography scales appropriately
- No horizontal scrolling on mobile
- Mobile menu accessible via hamburger icon + keyboard

**Mobile Navigation**
- Hamburger menu (visible on tablets and below)
- Swipe-friendly (Sheet component)
- Proper label: `aria-label="Open menu"`
- Close button always accessible

**Touch Gestures**
- No swipe-only interactions
- All gestures have keyboard alternatives
- Double-tap zoom supported

### 🧪 Testing
- Test on 375px (mobile), 768px (tablet), 1024px (desktop)
- Touch targets at least 44×44px
- No horizontal scrolling
- Pinch zoom works (not disabled)
- All functionality works on touch devices

---

## 6. Modal & Dialog Accessibility

### ✅ What's Implemented

**Dialog Properties**
- `role="dialog"` or semantic `<dialog>`
- `aria-labelledby` points to heading
- `aria-modal="true"`
- Focus trapped within modal
- Escape key closes modal
- Focus returns to trigger button on close

**Implementation**
```typescript
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle id="dialog-title">Confirm Delete</DialogTitle>
    </DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>
```

### 🧪 Testing
- Open modal with Tab key → focus inside modal
- Tab within modal → focus loops within modal
- Press Escape → modal closes
- Tab after close → focus returns to button

---

## 7. Data Tables Accessibility

### ✅ What's Implemented

**Table Structure**
- `<thead>` with proper headers
- `<tbody>` with data rows
- `<tfoot>` for summaries
- Column headers (`<th>`) not rows
- Headers linked to cells with `scope="col"`

**Sortable Tables**
- Column headers are buttons with `aria-sort`
- Values: "none", "ascending", "descending"
- Screen readers announce sort direction

**Selectable Tables**
- Checkbox in header for "select all"
- Checkboxes in rows for individual selection
- Announce count: "3 rows selected"

**Implementation**
```typescript
<Table>
  <TableHeader>
    <TableRow>
      <TableHead scope="col">
        <Checkbox aria-label="Select all" />
      </TableHead>
      <TableHead scope="col">Invoice</TableHead>
      <TableHead scope="col">Amount</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {/* Rows */}
  </TableBody>
</Table>
```

### 🧪 Testing
- Screen reader announces table structure
- Sort buttons announce current sort direction
- Checkboxes announce selection state
- Column headers are announced

---

## 8. Charts & Data Visualization

### ✅ What's Implemented

**Recharts Accessibility**
- Charts have descriptive titles
- Data provided in alternative format (table below chart)
- Color not only way to distinguish data
- Legend identifies all colors/patterns
- Tooltip support for keyboard users

**Implementation**
```typescript
<div>
  <h3 id="revenue-chart-title">Revenue Over 30 Days</h3>
  <RevenueChart aria-labelledby="revenue-chart-title" />
  {/* Accessible data table alternative */}
  <Table>
    {/* Same data in table format */}
  </Table>
</div>
```

### 🧪 Testing
- Screen reader announces chart title
- Data table provides alternative to chart
- All data accessible without chart interaction

---

## 9. Notifications & Toasts

### ✅ What's Implemented

**Toast Announcements**
- Uses `role="status"` or `role="alert"`
- Appropriate `aria-live` region
- Auto-announces success/error messages
- Keyboard dismissable

**Implementation**
```typescript
import { toast } from "sonner"

toast.success("Invoice saved!", {
  description: "Payment link sent to customer"
})

toast.error("Sync failed", {
  description: "QuickBooks connection error"
})
```

**Live Regions**
- "polite" for non-critical updates (default)
- "assertive" for errors/alerts
- "atomic" ensures full message announced

### 🧪 Testing
- Screen reader announces toast messages
- Toast appears after action
- Can dismiss with keyboard
- Appropriate urgency level

---

## 10. Link & Button Clarity

### ✅ What's Implemented

**Descriptive Link Text**
- ❌ Avoid: "Click here", "Read more"
- ✅ Use: "View invoice details", "Download contract"
- Separate visually: underline or color change
- Context in title attribute for abbreviated links

**Button Labels**
- Clear action: "Send Invoice", "Delete User"
- Icon buttons have aria-label
- Loading state communicated: aria-busy="true"

**Implementation**
```typescript
// ❌ Bad
<a href="/invoice/123">Click here</a>

// ✅ Good
<a href="/invoice/123">View invoice #INV-001</a>
<button aria-label="Download contract">
  <Download />
</button>
```

### 🧪 Testing
- Screen reader reads link text
- Link purpose is clear without context
- Icon buttons have labels

---

## Tools & Resources

### Browser Extensions
- **WAVE**: Web accessibility evaluation tool
- **axe DevTools**: Automated accessibility testing
- **Lighthouse**: Chrome DevTools built-in audit

### Online Tools
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)
- [axe DevTools](https://www.deque.com/axe/devtools/)

### Screen Readers
- **Windows**: NVDA (free), JAWS (commercial)
- **macOS**: VoiceOver (built-in)
- **iOS**: VoiceOver (built-in)
- **Android**: TalkBack (built-in)

### Testing Checklist
- [ ] Navigate entire app with keyboard only
- [ ] Tab through page → focus order logical
- [ ] Escape closes modals
- [ ] Test with NVDA / VoiceOver
- [ ] Run axe DevTools → no critical issues
- [ ] Check color contrast with WAVE
- [ ] Test mobile (375px) touch targets
- [ ] Forms have labels for all inputs
- [ ] Error messages announced
- [ ] Charts have text alternatives

---

## Standards & References

- **WCAG 2.1**: [W3C Web Content Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- **ARIA Authoring Practices**: [APG Design Patterns](https://www.w3.org/WAI/ARIA/apg/)
- **Tailwind Accessibility**: [Tailwind A11y](https://tailwindcss.com/docs/responsive-design#adding-custom-breakpoints)

---

## Continuous Improvement

Accessibility is an ongoing process. Regular audits are recommended:
1. Monthly automated testing (axe DevTools)
2. Quarterly manual testing with screen readers
3. Annual WCAG AA audit by accessibility specialist
4. Collect feedback from users with disabilities

For questions or to report accessibility issues, contact the development team.
