# Carreira AI Hub - Design Patterns & Component Library

**Version:** 1.0  
**Date:** 2026-01-29  
**Screens Designed:** Dashboard, Invoices List

---

## 🎨 Complete Design System

### Color Palette

```css
/* Primary - Finance Blue */
--primary-blue: #0F52BA;
--primary-blue-light: #EFF6FF;

/* Sigma Intel Branding */
--sigma-blue: #29ABE2;

/* Semantic Colors */
--success-green: #22C55E;
--success-bg: #D1FAE5;
--success-text: #065F46;

--warning-amber: #F59E0B;
--warning-bg: #FEF3C7;
--warning-text: #B45309;

--error-red: #DC2626;
--error-bg: #FEE2E2;
--error-text: #991B1B;

/* Neutral Grays */
--black: #0D0D0D;
--gray-700: #7A7A7A;
--gray-400: #B0B0B0;
--gray-border: #E8E8E8;
--gray-bg: #FAFAFA;
--page-bg: #F9FAFB;
--white: #FFFFFF;
```

### Typography

```css
/* Font Families */
--font-display: 'Space Grotesk', sans-serif;  /* Headings, UI elements */
--font-body: 'Inter', sans-serif;             /* Body text, descriptions */

/* Font Sizes */
--text-xs: 10px;   /* Footer text, tiny labels */
--text-sm: 11px;   /* Table headers, badges */
--text-base: 13px; /* Body text, table data */
--text-lg: 14px;   /* Navigation, subtitles */
--text-xl: 16px;   /* Card titles */
--text-2xl: 18px;  /* Logo */
--text-3xl: 32px;  /* Page titles */
--text-4xl: 36px;  /* KPI values */
--text-5xl: 40px;  /* Hero titles */

/* Font Weights */
--weight-normal: 400;
--weight-medium: 500;
--weight-semibold: 600;
--weight-bold: 700;
```

### Spacing Scale

```css
--space-2: 2px;
--space-4: 4px;
--space-6: 6px;
--space-8: 8px;
--space-10: 10px;
--space-12: 12px;
--space-14: 14px;
--space-16: 16px;
--space-20: 20px;
--space-24: 24px;
--space-28: 28px;
--space-32: 32px;
--space-40: 40px;
--space-48: 48px;
```

---

## 📐 Layout Patterns

### Screen Structure (1440x900)

```
┌─────────┬────────────────────────────────────┐
│ Sidebar │ Main Content                       │
│ 240px   │ fill_container                     │
│         │                                    │
│ - Logo  │ - Page Header (title + filters)   │
│ - Nav   │ - Content Area                     │
│ - User  │ - Data Tables / Cards              │
│ - Power │                                    │
└─────────┴────────────────────────────────────┘
```

### Sidebar (240px fixed width)

**Structure:**
```
┌─────────────────┐
│ Logo            │ ← 28x28 blue square + "Carreira" text
├─────────────────┤
│ Navigation      │ ← Active: blue dot, Medium weight
│  • Dashboard    │   Inactive: transparent dot, Normal weight
│  • Invoices     │
│  • Customers    │
│  • Payments     │
│  • Contracts    │
│  • Insights     │
├─────────────────┤
│ User Profile    │ ← Avatar (36x36) + Name + Role
├─────────────────┤
│ Powered by      │ ← "Powered by" gray + "SIGMA INTEL" blue
│ SIGMA INTEL     │
└─────────────────┘
```

**Spacing:**
- Padding: 40px vertical, 32px horizontal
- Gap: 48px between Logo and Nav
- Nav items gap: 8px
- Bottom section gap: 24px

### Main Content Area

**Padding:** 40px vertical, 48px horizontal  
**Background:** #F9FAFB (soft gray)  
**Gap:** 24px between sections

---

## 🧩 Component Patterns

### 1. KPI Card

**Usage:** Dashboard metrics display

**Structure:**
```jsx
<KPI Card>
  ├─ Label (12px, Inter, gray-700)
  ├─ Value (36px, Space Grotesk, bold, -1px letter-spacing)
  └─ Change Indicator
      ├─ Icon (14px, trending-up/circle-alert)
      └─ Text (12px, Inter, gray-700)
```

**Styling:**
- Background: white
- Border: 1px solid #E8E8E8
- Padding: 28px
- Gap: 20px

**Colors:**
- Positive trend: #22C55E (green)
- Alert/Warning: #DC2626 (red)

**Example:**
```
┌─────────────────┐
│ Total Revenue   │ ← Label
│ $125,430.00     │ ← Value (large, bold)
│ ↗ +12.5% ...    │ ← Trend (green icon + text)
└─────────────────┘
```

### 2. Quick Action Card

**Usage:** Dashboard action buttons

**Structure:**
```jsx
<Action Card>
  ├─ Icon Container (40x40, colored background)
  │   └─ Icon (20px, colored)
  ├─ Title (16px, Space Grotesk, semibold)
  └─ Description (14px, Inter, gray-700)
```

**Icon Background Colors:**
- Blue action: #EFF6FF
- Green action: #ECFDF5
- Amber action: #FFF7ED

**Styling:**
- Background: white
- Border: 1px solid #E8E8E8
- Padding: 24px
- Gap: 16px

### 3. Data Table

**Usage:** List views (Invoices, Customers, etc.)

**Structure:**
```jsx
<Table Container>
  ├─ Table Header (gray background #FAFAFA)
  │   └─ Column Headers (11px, Inter, uppercase, tracking)
  └─ Table Rows (white background)
      ├─ Cell Data (13px, Space Grotesk)
      ├─ Status Badge (colored pill)
      └─ Border bottom: 1px #E8E8E8
```

**Column Widths:**
- Number/ID: 120px
- Customer/Name: fill_container
- Amount: 120px
- Status: 100px
- Date: 100px
- Gap: 20px

**Header Styling:**
- Background: #FAFAFA
- Text: 11px, Inter, medium, uppercase, gray-700
- Letter-spacing: 0.5px
- Padding: 14px vertical, 20px horizontal

**Row Styling:**
- Background: white
- Padding: 16px vertical, 20px horizontal
- Border-bottom: 1px solid #E8E8E8
- Hover: background #F9FAFB (optional)

### 4. Status Badge

**Usage:** Invoice status, payment status, etc.

**Types:**

**Paid (Success):**
- Background: #D1FAE5
- Text: #065F46
- Font: 11px, Inter, semibold

**Pending (Warning):**
- Background: #FEF3C7
- Text: #B45309
- Font: 11px, Inter, semibold

**Overdue (Error):**
- Background: #FEE2E2
- Text: #991B1B
- Font: 11px, Inter, semibold

**Styling:**
- Padding: 4px vertical, 12px horizontal
- Border-radius: pill shape (optional)
- Font-weight: 600

### 5. Page Header

**Usage:** Top of every page

**Structure:**
```jsx
<Page Header>
  ├─ Title (32px, Space Grotesk, semibold)
  └─ Filter Bar (horizontal layout)
      ├─ Filter Buttons (left)
      │   ├─ Status Filter
      │   └─ Date Filter
      └─ Primary Action Button (right)
```

**Filter Button:**
- Background: white
- Border: 1px solid #E8E8E8
- Padding: 10px vertical, 16px horizontal
- Text: 13px, Space Grotesk, medium
- Icon: chevron-down, 14px, gray-700
- Gap: 8px

**Primary Action Button:**
- Background: #0F52BA (primary blue)
- Text: white, 13px, Space Grotesk, semibold
- Padding: 10px vertical, 20px horizontal
- Icon: plus, 16px, white
- Gap: 8px

### 6. Navigation Item

**Active State:**
- Dot: 6x6px, #0F52BA (blue)
- Label: 14px, Space Grotesk, medium (500), #0D0D0D

**Inactive State:**
- Dot: 6x6px, transparent
- Label: 14px, Space Grotesk, normal (400), #7A7A7A

**Hover State:**
- Label: #0F52BA (blue)

**Spacing:**
- Gap: 12px between dot and label
- Padding: 12px vertical, 0 horizontal

### 7. User Profile (Sidebar Footer)

**Structure:**
```jsx
<User Profile>
  ├─ Avatar (36x36, black background)
  │   └─ Initials (11px, white, Space Grotesk, medium)
  └─ User Info
      ├─ Name (13px, Space Grotesk, medium)
      └─ Role (11px, Inter, normal, gray-700)
```

**Spacing:**
- Gap: 12px between avatar and info
- Info gap: 2px between name and role

### 8. Powered By Footer

**Structure:**
```jsx
<Powered By>
  ├─ "Powered by" (10px, Inter, gray-700)
  └─ "SIGMA INTEL" (11px, Space Grotesk, bold, #29ABE2)
```

**Styling:**
- Gap: 8px
- Padding: 16px top, 0 horizontal
- Border-top: 1px solid #E8E8E8
- Alignment: centered

---

## 🎯 Design Principles

### 1. Clarity First
- Financial data must be crystal clear
- Use tabular numbers for alignment
- High contrast for readability

### 2. Consistent Spacing
- Use the spacing scale consistently
- Maintain 24px rhythm for vertical spacing
- Use 12px/16px/20px for horizontal gaps

### 3. Color Usage
- Primary blue (#0F52BA) for brand and actions
- Semantic colors for status (green=success, amber=warning, red=error)
- Gray backgrounds (#F9FAFB) reduce eye strain
- White cards on gray background for depth

### 4. Typography Hierarchy
- Space Grotesk for headings, UI elements (geometric, modern)
- Inter for body text (readable, neutral)
- Tabular numbers for financial data (perfect alignment)
- Bold weights for emphasis

### 5. Visual Feedback
- Hover states on interactive elements
- Active states for navigation
- Loading states prevent confusion
- Success/error messages are clear

---

## 📱 Responsive Patterns

### Mobile (<768px)
- Sidebar collapses to hamburger menu
- Tables scroll horizontally
- Filters move to slide-over modal
- Touch targets minimum 44x44px

### Tablet (768px - 1023px)
- Sidebar persists (or collapsible)
- 2-column KPI grid
- Tables visible with horizontal scroll

### Desktop (1024px+)
- Full sidebar visible
- 4-column KPI grid
- Full data tables
- Hover interactions

---

## 🚀 Implementation Notes

### Tailwind CSS Classes

**Colors:**
```jsx
bg-primary-600     // #0F52BA
bg-success-100     // #D1FAE5
text-success-700   // #065F46
border-gray-200    // #E8E8E8
bg-gray-50         // #F9FAFB
```

**Typography:**
```jsx
font-display       // Space Grotesk
font-body          // Inter
text-xs            // 10px
text-sm            // 11px
text-base          // 13px
font-medium        // 500
font-semibold      // 600
```

**Spacing:**
```jsx
p-7                // 28px (KPI card padding)
p-6                // 24px (action card padding)
gap-6              // 24px (main content sections)
gap-3              // 12px (nav item gap)
```

### Icons (Lucide React)
- `trending-up` - Growth indicators
- `circle-alert` - Alerts/warnings
- `file-text` - Invoices
- `refresh-cw` - Sync actions
- `chart-bar` - Reports
- `plus` - Create actions
- `chevron-down` - Dropdowns

---

## 📋 Screen Templates

### Dashboard Template
- Page Header: "Good [morning/afternoon], [Name]"
- KPI Grid: 4 cards (Revenue, Invoices, Customers, Alerts)
- Quick Actions: 3 cards (Create, Sync, Reports)
- Recent Activity: Table or timeline

### List Page Template (Invoices, Customers, etc.)
- Page Header: Title + Filters + Create Button
- Filter Pills: Active filters with remove option
- Data Table: Header + Rows with status badges
- Pagination: Bottom of table

### Detail Page Template (Invoice Detail, Customer Detail)
- Breadcrumb: Home > Invoices > INV-001
- Page Header: Title + Status + Actions
- 2-Column Layout: Main content (2/3) + Sidebar (1/3)
- Cards: Information grouped logically
- Timeline: Activity history

---

## ✅ Completed Screens

### 1. Dashboard (Main Overview)
- ✅ Sidebar with navigation
- ✅ Time-based greeting
- ✅ 4 KPI cards with trends
- ✅ 3 Quick action cards
- ✅ User profile + Sigma Intel footer

### 2. Invoices List
- ✅ Sidebar with "Invoices" active
- ✅ Page title "Invoices"
- ✅ Filter buttons (Status, Date)
- ✅ Create Invoice button (primary blue)
- ✅ Data table with 3 sample rows
- ✅ Status badges (Paid, Pending, Overdue)
- ✅ User profile + Sigma Intel footer

---

## 🔜 Remaining Screens (To Design)

### 3. Invoice Detail Page
- Breadcrumb navigation
- Invoice number + status badge
- Action buttons (Edit, Send, Download PDF)
- 2-column layout:
  - Left: Invoice details (customer, items, totals)
  - Right: Payment info, contract link, activity timeline

### 4. Customers List Page
- Same structure as Invoices List
- Columns: Name, Email, Total Invoiced, Balance, Status
- Filter by: Status, Balance (positive/negative)

### 5. Customer Detail Page
- Breadcrumb navigation
- Customer name + status
- 2-column layout:
  - Left: Contact info, installment summary, invoices list
  - Right: Financial summary cards, payment history

### 6. Payments Page
- Similar to Invoices List
- Columns: Payment ID, Customer, Invoice, Amount, Method, Date
- Filter by: Date range, Payment method

### 7. Contracts Page
- Similar to Invoices List
- Columns: Contract ID, Customer, Status, Sent Date, Signed Date
- Status badges: Draft, Sent, Signed, Expired
- Download signed PDF button

### 8. Insights (BI) Dashboard
- Page Header: "Business Insights"
- Date range filter
- KPI row: MRR, ARR, Cash Flow
- Charts section:
  - Revenue trends (line chart)
  - Invoice status distribution (pie chart)
  - Payment timeline (bar chart)
- Export to CSV button

---

## 🎨 Design Files Location

**Pencil Design File:** `pencil-welcome-desktop.pen`

**Frames:**
1. `uJOls` - Carreira AI Hub - Dashboard (Main screen)
2. `6kK4T` - Invoices List (positioned at x:1500, y:0)

**Screenshots Available:**
- Dashboard overview
- Invoices list page

---

## 💡 Design Tips for Implementation

1. **Start with Design System Foundation**
   - Set up Tailwind config with custom colors
   - Add Google Fonts (Space Grotesk + Inter)
   - Create base components (Button, Card, Badge)

2. **Build Component Library**
   - StatCard for KPIs
   - DataTable for lists
   - StatusBadge with variants
   - FilterButton component

3. **Page by Page Implementation**
   - Start with Dashboard (establishes patterns)
   - Then List pages (reusable table component)
   - Finally Detail pages (more complex layouts)

4. **Maintain Consistency**
   - Use spacing scale religiously
   - Stick to color palette
   - Follow typography hierarchy
   - Test responsive breakpoints

---

**Version:** 1.0  
**Last Updated:** 2026-01-29  
**Author:** Claude Code + Paulo Loureiro  
**Status:** Ready for Implementation
