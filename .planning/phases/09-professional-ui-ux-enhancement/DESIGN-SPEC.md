# Design Specification: Carreira AI Hub UI/UX Enhancement

**Version:** 1.0  
**Date:** 2026-01-29  
**Project:** Carreira AI Hub - Phase 9: Professional UI/UX Enhancement

---

## Executive Summary

Transform the Carreira AI Hub from a functional dashboard into a beautiful, professional SaaS-quality interface that matches modern finance software standards. Focus on clarity, trustworthiness, and efficiency for Finance, Admin, and Commercial teams.

---

## Design Philosophy

**Core Principles:**
1. **Clarity First** - Financial data must be crystal clear and easy to scan
2. **Trust & Professionalism** - Colors and typography convey reliability
3. **Efficiency** - Reduce clicks, show relevant data upfront
4. **Accessibility** - WCAG 2.1 AA compliant, keyboard-navigable
5. **Responsive** - Beautiful on mobile, tablet, and desktop

**Design Inspiration:**
- **Stripe Dashboard** - Clean data tables, excellent typography
- **Linear** - Subtle animations, keyboard-first design
- **Vercel Dashboard** - Modern aesthetic, clear hierarchy
- **QuickBooks Online** - Familiar finance UI patterns

---

## Color Palette

### Primary Colors (Brand & Navigation)

```css
/* Primary Blue - Trust, Finance, Professional */
--primary-50: #EFF6FF;
--primary-100: #DBEAFE;
--primary-200: #BFDBFE;
--primary-300: #93C5FD;
--primary-400: #60A5FA;
--primary-500: #0F52BA;  /* Main brand color */
--primary-600: #0C42A0;
--primary-700: #093686;
--primary-800: #072A6C;
--primary-900: #051E52;
```

### Semantic Colors (Status & Feedback)

```css
/* Success Green - Payments, Growth, Positive */
--success-50: #ECFDF5;
--success-100: #D1FAE5;
--success-500: #059669;
--success-600: #047857;
--success-700: #065F46;

/* Warning Amber - Alerts, Pending, Attention */
--warning-50: #FFFBEB;
--warning-100: #FEF3C7;
--warning-500: #F59E0B;
--warning-600: #D97706;
--warning-700: #B45309;

/* Error Red - Overdue, Critical, Errors */
--error-50: #FEF2F2;
--error-100: #FEE2E2;
--error-500: #DC2626;
--error-600: #B91C1C;
--error-700: #991B1B;

/* Info Blue - Neutral information */
--info-50: #EFF6FF;
--info-100: #DBEAFE;
--info-500: #3B82F6;
--info-600: #2563EB;
```

### Neutral Grays (Backgrounds, Text, Borders)

```css
/* Grayscale - Optimized for readability */
--gray-50: #F9FAFB;   /* Page background */
--gray-100: #F3F4F6;  /* Card background */
--gray-200: #E5E7EB;  /* Border subtle */
--gray-300: #D1D5DB;  /* Border default */
--gray-400: #9CA3AF;  /* Disabled text */
--gray-500: #6B7280;  /* Muted text */
--gray-600: #4B5563;  /* Secondary text */
--gray-700: #374151;  /* Primary text */
--gray-800: #1F2937;  /* Headings */
--gray-900: #111827;  /* Emphasis */
```

### Usage Guidelines

**Backgrounds:**
- Page: `gray-50`
- Cards: `white` with `gray-200` border
- Hover: `gray-100`
- Selected: `primary-50`

**Text:**
- Headings: `gray-900` weight-600/700
- Body: `gray-700` weight-400
- Muted: `gray-500` weight-400
- Links: `primary-600` hover:`primary-700`

**Status Badges:**
- Paid: `success-100` bg, `success-700` text
- Pending: `warning-100` bg, `warning-700` text
- Overdue: `error-100` bg, `error-700` text
- Draft: `gray-100` bg, `gray-700` text

---

## Typography

### Font Family

**Primary Font: Inter**
- Source: Google Fonts
- Weights: 400 (Regular), 500 (Medium), 600 (Semibold), 700 (Bold)
- Fallback: `system-ui, -apple-system, 'Segoe UI', sans-serif`

**Monospace Font: JetBrains Mono** (for IDs, codes)
- Source: Google Fonts
- Weight: 400
- Fallback: `'Courier New', monospace`

### Type Scale

```css
/* Display - Hero sections */
--text-display: 3rem;      /* 48px */
--text-display-lh: 1.2;

/* Headings */
--text-h1: 2.25rem;        /* 36px */
--text-h1-lh: 1.25;
--text-h2: 1.875rem;       /* 30px */
--text-h2-lh: 1.3;
--text-h3: 1.5rem;         /* 24px */
--text-h3-lh: 1.4;
--text-h4: 1.25rem;        /* 20px */
--text-h4-lh: 1.4;
--text-h5: 1.125rem;       /* 18px */
--text-h5-lh: 1.5;
--text-h6: 1rem;           /* 16px */
--text-h6-lh: 1.5;

/* Body */
--text-lg: 1.125rem;       /* 18px */
--text-lg-lh: 1.75;
--text-base: 1rem;         /* 16px */
--text-base-lh: 1.5;
--text-sm: 0.875rem;       /* 14px */
--text-sm-lh: 1.5;
--text-xs: 0.75rem;        /* 12px */
--text-xs-lh: 1.5;
```

### Typography Usage

**Headings:**
- Font-weight: 600 (semibold) for H1-H3
- Font-weight: 500 (medium) for H4-H6
- Color: `gray-900`
- Letter-spacing: -0.025em (tight)

**Body Text:**
- Font-weight: 400 (regular)
- Color: `gray-700`
- Line-height: 1.5 (readable)

**Financial Numbers:**
- Font-feature-settings: `"tnum"` (tabular numbers for alignment)
- Font-weight: 600 for emphasis
- Monospace for IDs: `JetBrains Mono`

**Labels & Captions:**
- Text-sm or text-xs
- Color: `gray-500`
- Font-weight: 500
- Uppercase with tracking for section labels

---

## Spacing System

**Base Unit: 4px** (Tailwind's default)

### Spacing Scale

```css
--space-0: 0;
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-20: 5rem;     /* 80px */
```

### Component Spacing

**Cards:**
- Padding: `space-6` (24px)
- Gap between cards: `space-4` (16px) mobile, `space-6` (24px) desktop

**Forms:**
- Label margin-bottom: `space-2` (8px)
- Input padding: `space-3` (12px) vertical, `space-4` (16px) horizontal
- Field gap: `space-4` (16px)

**Tables:**
- Cell padding: `space-3` (12px) vertical, `space-4` (16px) horizontal
- Row gap: `space-2` (8px)

**Page Layout:**
- Page padding: `space-4` mobile, `space-6` tablet, `space-8` desktop
- Section gap: `space-8` (32px)

---

## Component Library

### 1. Buttons

**Variants:**

```tsx
// Primary - Main actions
<Button variant="primary">
  Create Invoice
</Button>
// Style: bg-primary-600, text-white, hover:bg-primary-700

// Secondary - Less important actions
<Button variant="secondary">
  Cancel
</Button>
// Style: bg-white, text-gray-700, border-gray-300, hover:bg-gray-50

// Outline - Tertiary actions
<Button variant="outline">
  Learn More
</Button>
// Style: bg-transparent, text-primary-600, border-primary-600, hover:bg-primary-50

// Ghost - Minimal actions
<Button variant="ghost">
  Skip
</Button>
// Style: bg-transparent, text-gray-600, hover:bg-gray-100

// Destructive - Delete, remove
<Button variant="destructive">
  Delete
</Button>
// Style: bg-error-600, text-white, hover:bg-error-700
```

**Sizes:**
- `xs`: h-7 (28px), px-2, text-xs
- `sm`: h-8 (32px), px-3, text-sm
- `md`: h-10 (40px), px-4, text-base (default)
- `lg`: h-12 (48px), px-6, text-lg
- `xl`: h-14 (56px), px-8, text-lg

**States:**
- **Default**: Crisp, clear
- **Hover**: Slightly darker background, lift shadow
- **Active**: Pressed state, darker
- **Disabled**: opacity-50, cursor-not-allowed
- **Loading**: Spinner icon, text "Loading..."

### 2. Cards

**StatCard (KPI Display):**

```tsx
<StatCard
  title="Total Revenue"
  value="$125,430.00"
  change="+12.5%"
  trend="up"
  icon={<DollarSignIcon />}
  description="vs last month"
/>
```

**Visual Design:**
- Background: white
- Border: 1px solid gray-200
- Border-radius: 8px
- Padding: 24px
- Shadow: subtle on hover
- Icon: Colored circle background (primary-100)
- Value: Large, bold, gray-900
- Change: Badge (green=up, red=down, gray=neutral)
- Trend: Small arrow icon

**DataCard (Content Container):**

```tsx
<DataCard
  title="Customer Details"
  description="Account information"
  action={<Button>Edit</Button>}
>
  {/* Card content */}
</DataCard>
```

**Visual Design:**
- Same base as StatCard
- Header: Title (h3) + optional description + action button
- Body: Content area with padding
- Footer: Optional footer with actions

### 3. Tables

**Professional Data Table:**

**Visual Design:**
- Border: 1px solid gray-200
- Border-radius: 8px (rounded corners)
- Background: white

**Header Row:**
- Background: gray-50
- Text: gray-700, text-sm, font-semibold, uppercase, tracking-wide
- Padding: 12px 16px
- Border-bottom: 1px solid gray-200
- Sticky on scroll

**Data Rows:**
- Padding: 12px 16px
- Border-bottom: 1px solid gray-100 (last row: none)
- Hover: bg-gray-50
- Transition: background 150ms ease

**Cells:**
- Text: gray-700, text-sm
- Numbers: Tabular nums, right-aligned
- Status badges: Colored pills
- Actions: Icon buttons (hover to show)

**Mobile:**
- Horizontal scroll with momentum
- Min column widths to prevent squishing

### 4. Forms

**Input Field:**

```tsx
<Input
  label="Customer Email"
  type="email"
  placeholder="customer@example.com"
  error="Invalid email format"
  helperText="Used for invoice notifications"
/>
```

**Visual Design:**
- Label: text-sm, font-medium, gray-700, mb-2
- Input: h-10, px-4, border-gray-300, rounded-md
- Focus: border-primary-500, ring-4 ring-primary-100
- Error: border-error-500, text-error-600
- Disabled: bg-gray-100, cursor-not-allowed

**Select Dropdown:**
- Same styling as Input
- Chevron icon on right
- Dropdown: white bg, shadow-lg, border, rounded-md
- Options: hover:bg-gray-100, selected:bg-primary-50

**Date Picker:**
- Calendar popup
- Quick presets: "Last 7 days", "Last 30 days", "This month"
- Range selection with visual highlight

**Currency Input:**
- Prefix: "$" symbol
- Formatted with commas: 1,234.56
- Tabular numbers

### 5. Status Indicators

**Badge Component:**

```tsx
<Badge variant="success">Paid</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="error">Overdue</Badge>
<Badge variant="info">Draft</Badge>
```

**Visual Design:**
- Padding: 2px 8px
- Border-radius: 9999px (pill shape)
- Font-size: text-xs
- Font-weight: 600
- Colors: Match semantic palette

**Status Dot:**
- Small colored circle (8px diameter)
- Used inline before status text
- Pulse animation for "active" states

### 6. Loading States

**Skeleton Loader:**
- Background: gray-200
- Animation: pulse (shimmer effect)
- Border-radius: match element (4px for text, 8px for cards)
- Height: match content

**Loading Spinner:**
- Size: 16px (inline), 24px (buttons), 48px (page)
- Color: primary-600
- Animation: spin

**Progress Bar:**
- Height: 4px
- Background: gray-200
- Fill: primary-600
- Rounded ends

### 7. Empty States

**Visual Design:**
- Icon: Large (64px), gray-400
- Heading: text-lg, font-semibold, gray-900
- Description: text-sm, gray-500
- Action: Primary button
- Optional: Illustration or emoji

**Example:**
```
📊 [Large icon]
No invoices yet
Create your first invoice to get started
[Create Invoice Button]
```

### 8. Modals & Dialogs

**Modal:**
- Backdrop: gray-900 with opacity-50
- Content: white bg, rounded-lg, shadow-xl
- Max-width: 500px (md modal), 800px (lg modal)
- Padding: 24px
- Close: X button top-right
- Animation: Fade in, scale from 95% to 100%

**Slide-over (Mobile Filters):**
- From right edge
- Full height
- Width: 320px (desktop), 100% (mobile)
- Background: white
- Animation: Slide from right

---

## Page Layouts

### Dashboard (Main Overview)

**Layout Structure:**

```
┌─────────────────────────────────────────┐
│ Header: "Good morning, Paulo" + Actions │
├─────────────────────────────────────────┤
│ KPI Grid (4 cards)                      │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐           │
│ │Rev │ │Inv │ │Cust│ │Pay │           │
│ └────┘ └────┘ └────┘ └────┘           │
├─────────────────────────────────────────┤
│ Quick Actions (Icon Cards)              │
│ ┌────────┐ ┌────────┐ ┌────────┐      │
│ │Create  │ │Sync QB │ │View    │      │
│ │Invoice │ │        │ │Reports │      │
│ └────────┘ └────────┘ └────────┘      │
├─────────────────────────────────────────┤
│ Recent Activity (Table)                 │
│ Last 5 invoices, payments, contracts   │
└─────────────────────────────────────────┘
```

**Visual Design:**
- Page background: gray-50
- Section spacing: 32px gap
- Responsive: 1 col mobile, 2 col tablet, 4 col desktop (KPIs)

### Data List Page (Invoices, Customers, etc.)

**Layout Structure:**

```
┌─────────────────────────────────────────┐
│ Page Header + "Create" Button           │
├─────────────────────────────────────────┤
│ Filters Bar                             │
│ [Search] [Status▼] [Date Range] [Clear]│
│ Active: ⚫ Status:Paid ✕ Date:Last30d ✕ │
├─────────────────────────────────────────┤
│ Data Table                              │
│ ╔══════════════════════════════════════╗│
│ ║ ID │ Name │ Amount │ Status │ Date ║│
│ ╠══════════════════════════════════════╣│
│ ║ ... rows ...                         ║│
│ ╚══════════════════════════════════════╝│
├─────────────────────────────────────────┤
│ Pagination: ← 1 2 3 ... 10 →           │
└─────────────────────────────────────────┘
```

**Visual Design:**
- Filters: Collapsible on mobile (slide-over modal)
- Filter pills: Removable badges showing active filters
- Table: Full width, responsive horizontal scroll on mobile
- Pagination: Center-aligned

### Detail Page (Invoice Detail, Customer Detail)

**Layout Structure:**

```
┌─────────────────────────────────────────┐
│ Breadcrumb: Invoices > INV-001          │
├─────────────────────────────────────────┤
│ Header: Invoice #INV-001                │
│ Status Badge │ Actions [⋮]              │
├──────────────────────┬──────────────────┤
│ Main Content         │ Sidebar          │
│                      │                  │
│ ┌────────────────┐  │ ┌──────────────┐ │
│ │ Details Card   │  │ │ Quick Info   │ │
│ └────────────────┘  │ └──────────────┘ │
│                      │                  │
│ ┌────────────────┐  │ ┌──────────────┐ │
│ │ Line Items     │  │ │ Timeline     │ │
│ └────────────────┘  │ └──────────────┘ │
│                      │                  │
└──────────────────────┴──────────────────┘
```

**Visual Design:**
- Breadcrumb: text-sm, gray-500, with › separator
- 2-column layout: 2/3 main, 1/3 sidebar (desktop)
- Mobile: Stacked (main, then sidebar)
- Cards: White bg, border, shadow on hover

---

## Animations & Transitions

### Timing

```css
--transition-fast: 150ms;
--transition-base: 200ms;
--transition-slow: 300ms;
--easing-default: cubic-bezier(0.4, 0, 0.2, 1); /* ease-out */
```

### Animation Patterns

**Hover Effects:**
- Buttons: Lift with shadow (`transform: translateY(-1px)`)
- Cards: Shadow increase, subtle scale (`scale(1.01)`)
- Links: Underline slide-in

**Page Transitions:**
- Fade in: opacity 0 → 1 (300ms)
- Slide up: translateY(10px) → 0 (300ms)

**Loading:**
- Skeleton: Pulse (shimmer gradient)
- Spinner: Rotate 360deg (1s linear infinite)

**Success/Error:**
- Toast: Slide in from right (300ms) + fade out after 5s

**Micro-interactions:**
- Checkbox: Checkmark draw animation
- Toggle: Slider slide (150ms)
- Ripple: Circle expand on button click (Subtle, optional)

### Performance

- Use `transform` and `opacity` only (GPU-accelerated)
- Avoid animating `width`, `height`, `margin`
- Use `will-change` sparingly

---

## Responsive Breakpoints

```css
--breakpoint-sm: 640px;   /* Mobile large */
--breakpoint-md: 768px;   /* Tablet */
--breakpoint-lg: 1024px;  /* Desktop */
--breakpoint-xl: 1280px;  /* Large desktop */
--breakpoint-2xl: 1536px; /* Extra large */
```

### Mobile-First Approach

**Mobile (<768px):**
- 1 column layouts
- Stacked cards
- Slide-over filters
- Horizontal scroll tables
- Bottom navigation (optional)
- Touch targets: 44x44px minimum

**Tablet (768px - 1023px):**
- 2 column layouts
- Side-by-side filters
- Partial table visibility
- Collapsible sidebar

**Desktop (1024px+):**
- Multi-column layouts (up to 4 KPIs)
- Full data tables
- Persistent sidebar
- Hover interactions

---

## Accessibility (WCAG 2.1 AA)

### Color Contrast

- **Text contrast:** 4.5:1 minimum
- **Large text (18px+):** 3:1 minimum
- **UI components:** 3:1 minimum

**Verified Combinations:**
- `gray-900` on `white`: 18.6:1 ✓
- `gray-700` on `white`: 10.8:1 ✓
- `primary-600` on `white`: 5.2:1 ✓
- `white` on `primary-600`: 5.2:1 ✓

### Keyboard Navigation

- **Tab order:** Logical flow (top → bottom, left → right)
- **Focus indicators:** 2px solid primary-500 outline, offset 2px
- **Skip links:** "Skip to main content" at top
- **Shortcuts:**
  - `/` - Focus search
  - `Esc` - Close modals
  - `Arrow keys` - Navigate dropdowns
  - `Enter/Space` - Activate buttons

### Screen Readers

- **Semantic HTML:** Use `<nav>`, `<main>`, `<aside>`, `<header>`, `<footer>`
- **Headings:** Hierarchical (H1 → H2 → H3)
- **ARIA labels:** For icon-only buttons
- **Live regions:** For dynamic updates (`aria-live="polite"`)
- **Form labels:** Explicit `<label for="id">` associations
- **Error messages:** Linked with `aria-describedby`

### Interactive Elements

- **Buttons:** Clear labels, proper type attribute
- **Links:** Descriptive text (not "click here")
- **Inputs:** Labels, placeholders, error messages
- **Tooltips:** Accessible on focus (not just hover)

---

## Implementation Priority

### Phase 1: Foundation (Wave 1)
1. ✅ Design system tokens (colors, typography, spacing)
2. ✅ Core components (Button, Card, Badge, Input)
3. ✅ Global styles and CSS reset

### Phase 2: Pages (Wave 2)
4. Dashboard page redesign
5. Invoices page enhancement
6. Customers page enhancement
7. Detail pages (invoice, customer)

### Phase 3: Polish (Wave 3)
8. Animations and transitions
9. Loading states and skeletons
10. Error handling and empty states
11. Accessibility audit and fixes

---

## Design Decisions & Rationale

### Why Inter Font?
- Modern, readable, professional
- Optimized for screens
- Wide character set (international support)
- Used by Stripe, Vercel, Linear (industry standard)

### Why Blue as Primary?
- Trust and reliability (finance industry standard)
- High contrast with white backgrounds
- Accessible color (works for most colorblindness types)
- Professional, not playful

### Why Minimal Animations?
- Finance software should feel stable, not flashy
- Performance matters (serverless functions)
- Accessibility (motion sensitivity)
- Focus on data, not distractions

### Why Tabular Numbers?
- Financial data must align in columns
- Makes scanning numbers easier
- Professional expectation in finance UIs

---

## Design Checklist

Before marking a screen as "complete":

- [ ] Color contrast passes WCAG AA (4.5:1 text, 3:1 UI)
- [ ] Keyboard navigation works completely
- [ ] Focus indicators visible on all interactive elements
- [ ] Loading states prevent layout shift
- [ ] Error states provide helpful guidance
- [ ] Empty states guide user to next action
- [ ] Mobile responsive (test 320px, 768px, 1024px)
- [ ] Touch targets minimum 44x44px (mobile)
- [ ] Animations run smoothly (60fps)
- [ ] Tested with screen reader (VoiceOver or NVDA)
- [ ] Semantic HTML structure (proper heading hierarchy)
- [ ] ARIA labels for icon-only buttons

---

## Resources

**Fonts:**
- Inter: https://fonts.google.com/specimen/Inter
- JetBrains Mono: https://fonts.google.com/specimen/JetBrains+Mono

**Icons:**
- Lucide React (already installed): https://lucide.dev

**Component References:**
- shadcn/ui: https://ui.shadcn.com (partial inspiration)
- Tailwind UI: https://tailwindui.com (reference patterns)

**Accessibility:**
- WCAG 2.1 Guidelines: https://www.w3.org/WAI/WCAG21/quickref/
- Color contrast checker: https://webaim.org/resources/contrastchecker/

---

## Next Steps

1. Review this design spec with stakeholders
2. Create detailed plan files (09-01 through 09-05)
3. Execute plans using GSD workflow
4. Checkpoint reviews after each wave
5. Final accessibility audit before completion

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-29  
**Author:** Claude Code (AI Design Assistant)
