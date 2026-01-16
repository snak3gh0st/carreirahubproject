# Dashboard Filters & Alerts Implementation Plan

## Phase 1: Database Models (Alerts System)

### New Prisma Models Needed
1. **Alert** - Store alert instances
2. **AlertRule** - Define when/how alerts trigger
3. **AlertEvent** - Track alert trigger history

## Phase 2: Enhanced Metrics API

### Current State
- `/api/dashboard/metrics` returns raw aggregated data
- No filtering capability

### Enhanced State
- Support query parameters:
  - `dateRange`: last7, last30, last90, custom
  - `from`/`to`: Custom date range (ISO strings)
  - `customerSegment`: active, inactive, churned
  - `invoiceStatus`: paid, overdue, pending
  - `dealStatus`: open, won, lost

### Metrics to Add
- Customer activity tracking (last invoice date, payment frequency)
- Deal aging (days since last status change)
- Invoice aging (days overdue)
- Churn risk indicators

## Phase 3: Alert Generation System

### Alert Types
1. **Overdue Invoices Alert** (>30 days past due)
   - Trigger: Daily check at 8 AM
   - Action: Create alert if any invoices >30 days overdue
   - Severity: HIGH

2. **High-Value Deals at Risk** (>$10k, no activity 30 days)
   - Trigger: Daily check
   - Action: Flag deals with high value that are stalled
   - Severity: MEDIUM

3. **Low Collection Rate Alert** (<70%)
   - Trigger: Weekly on Monday
   - Action: Create alert if monthly collection rate < 70%
   - Severity: MEDIUM

4. **Customer Churn Warning** (no activity 60 days)
   - Trigger: Weekly on Monday
   - Action: Identify inactive customers
   - Severity: LOW

### Alert Processing
- Database-driven alert rules
- Periodic evaluation (via cron job or queue)
- Alert deduplication (don't create duplicate alerts for same issue)
- Alert resolution (auto-resolve when issue fixed)

## Phase 4: UI Components

### Dashboard Components
1. **AlertsPanel** - Display active alerts at top of dashboard
2. **DashboardFilters** - Filter controls (date range, segments, status)
3. **AlertModal** - Detail view and acknowledgment

### Features
- Visual alert indicators (color-coded by severity)
- Quick dismiss/acknowledge alerts
- Filter persistence in URL
- Real-time metric updates on filter change

## Implementation Timeline

### Step 1: Add Database Models
- Create Alert, AlertRule, AlertEvent models
- Run migration

### Step 2: Build Alert Service
- Alert evaluation logic
- Alert creation and resolution
- Deduplication logic

### Step 3: Enhance Metrics API
- Add filter parameters
- Implement filter logic
- Add customer segment detection
- Add deal aging calculations

### Step 4: Create UI Components
- Filter component with form
- Alerts panel component
- Wire together with dashboard

### Step 5: Add Cron Job
- Set up alert evaluation job
- Run periodically (hourly)
- Log results

## Data Requirements from QuickBooks

### Already Synced
- Customer balance (qbBalance)
- Total invoiced (qbTotalInvoiced)
- Total paid (qbTotalPaid)
- Invoice amounts, dates, statuses
- Payment amounts and dates
- Deal values

### Additional Data Needed
- Invoice created date (to calculate aging)
- Payment dates (to calculate last activity)
- Customer creation date (to identify new vs. old)
- Deal last modified date (to identify stalled deals)

## Success Criteria

✅ Filters work correctly
✅ Alerts generate for all 4 types
✅ Alerts display on dashboard
✅ Metrics update when filters change
✅ URL persists filter state
✅ Alerts have proper severity levels
✅ No duplicate alerts
✅ Alerts auto-resolve when conditions met
✅ All QuickBooks data integrated

## Files to Create/Modify

### Create
- `prisma/schema.prisma` (add Alert, AlertRule, AlertEvent models)
- `lib/services/alerts.service.ts` - Alert evaluation logic
- `lib/services/alert-rules.service.ts` - Rule management
- `components/dashboard/alerts-panel.tsx` - Alert display
- `components/dashboard/dashboard-filters.tsx` - Filter controls
- `app/api/dashboard/alerts/route.ts` - Get current alerts
- `app/api/dashboard/alert-rules/route.ts` - Manage alert rules
- `app/api/cron/evaluate-alerts/route.ts` - Cron job for alert evaluation
- `scripts/setup-alert-rules.ts` - Initialize default alert rules

### Modify
- `app/api/dashboard/metrics/route.ts` - Add filter support
- `app/dashboard/page.tsx` - Add filters and alerts panel
- `prisma/schema.prisma` - Add new models

## Alert Rules Configuration

### Overdue Invoices Rule
```
{
  name: "Overdue Invoices Alert",
  condition: "invoices.overdueAmount > 0 AND invoices.maxOverdueDays > 30",
  severity: "HIGH",
  checkInterval: "DAILY",
  description: "Alert when any invoice is more than 30 days overdue"
}
```

### High-Value Deals at Risk Rule
```
{
  name: "High-Value Deals at Risk",
  condition: "deals.value >= 10000 AND deals.daysSinceChange >= 30 AND deals.status = 'OPEN'",
  severity: "MEDIUM",
  checkInterval: "DAILY",
  description: "Alert when deals >$10k haven't been updated in 30 days"
}
```

### Low Collection Rate Rule
```
{
  name: "Low Collection Rate",
  condition: "monthly.collectionRate < 0.70",
  severity: "MEDIUM",
  checkInterval: "WEEKLY",
  description: "Alert when monthly collection rate falls below 70%"
}
```

### Customer Churn Rule
```
{
  name: "Customer Churn Warning",
  condition: "customers.daysSinceLastInvoice >= 60",
  severity: "LOW",
  checkInterval: "WEEKLY",
  description: "Alert for customers with no activity in 60+ days"
}
```
