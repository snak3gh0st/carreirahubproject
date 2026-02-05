# QuickBooks BI Dashboard - Full Rebuild

## Overview
Redo the Insights BI dashboard to focus exclusively on QuickBooks data with comprehensive financial, invoice, customer, and payment analytics.

## Remove (QuickBooks Only Focus)
- Sales pipeline metrics (Deals, Won Deals, Win Rate)
- Lead metrics (Total Leads, Qualified Leads, Lead Funnel)
- Service diversity metrics
- `/api/analytics/bi-dashboard` endpoint

## Add (Comprehensive QuickBooks Data)

### Financial KPIs
- Total Revenue (all-time, period-filtered)
- MRR (Monthly Recurring Revenue)
- ARR (Annual Recurring Revenue)
- Cash Flow (payments received vs invoiced)
- Collection Rate (paid / total invoiced)
- Overdue Rate
- Average Invoice Value
- Revenue Growth Rate (MoM, YoY)

### Invoice Analytics
- Status Distribution (count + amount by status)
- Aging Buckets (0-30, 31-60, 61-90, 90+ days)
- Average Days to Payment
- Invoice Volume Trends (daily, weekly, monthly)
- Invoice by Service/Product (from lineItems)

### Customer Analytics
- Active Customers (with activity in period)
- New Customers (acquired in period)
- Average LTV (Lifetime Value)
- Customer Segments (by revenue tier)
- Geographic Distribution (by state/country)
- Retention Rate
- Churn Rate

### Payment Analytics
- Total Payments (count + amount)
- Payments by Method (Card, Bank, Cash, Other)
- Average Payment Amount
- Reconciliation Status
- Refund Tracking (count + amount)
- Failed Payment Tracking

### Charts
- Revenue Trend (Line chart - 12 months)
- Invoice Status Distribution (Pie chart)
- Invoice Aging (Bar chart - buckets)
- Top Customers by Revenue (Bar chart)
- Payment Methods (Bar/Pie chart)
- Customer Acquisition Trend (Line chart)
- Cash Flow Trend (Area chart)
- Customer Segments (Pie/Bar chart)

## Implementation Steps

### Step 1: Create New Analytics API
**File:** `app/api/analytics/quickbooks/route.ts`

Create comprehensive endpoint with all KPIs and chart data.

### Step 2: Create Chart Components
**Files:**
- `components/analytics/revenue-trend-chart.tsx`
- `components/analytics/invoice-aging-chart.tsx`
- `components/analytics/customer-segments-chart.tsx`
- `components/analytics/payment-methods-chart.tsx`
- `components/analytics/cash-flow-chart.tsx`
- `components/analytics/quickbooks-kpi-card.tsx`

### Step 3: Rebuild Insights Page
**File:** `app/dashboard/insights/page.tsx`

Complete rebuild with QuickBooks focus.

### Step 4: Cleanup
- Remove or deprecate `/api/analytics/bi-dashboard/route.ts`

## Effort Estimate
7-8 hours
