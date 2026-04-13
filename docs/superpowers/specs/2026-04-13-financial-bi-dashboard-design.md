# Financial BI Dashboard with Fractional CFO Intelligence

**Date**: 2026-04-13
**Status**: Draft
**Author**: Claude Code + Paulo Loureiro

---

## Overview

Build a dedicated Financial BI dashboard at `/dashboard/financial` that serves two audiences from a single page: CEO/founder (executive summary at top) and finance/accounting team (detailed tabbed analysis below). The dashboard includes a **Fractional CFO intelligence layer** — a hybrid of deterministic rule-based alerts and AI-generated narrative analysis — that tells users what to do, not just what happened.

### Goals

1. **Single source of truth** — replace the current mix of QuickBooks, spreadsheets, and scattered dashboard pages
2. **CEO glanceability** — executive summary readable in 10 seconds: KPIs, trends, actions needed
3. **Finance team operability** — drill-down tables, filters, sortable overdue lists for daily work
4. **CFO intelligence** — automated analysis with prioritized action items and strategic recommendations
5. **Exportability** — PDF reports (board-ready) and Excel exports (finance team working files)

### Non-Goals

- "Ask the CFO" chat interface (v2 feature, not in scope)
- Accounts Payable / vendor management (AR-focused only)
- Real-time streaming data (page-load refresh is sufficient)
- Mobile-optimized layout (desktop-first, responsive is nice-to-have)

---

## Architecture

### Page Structure

```
/dashboard/financial
├── Header Bar
│   ├── Title + QB sync status
│   ├── Date range picker (last7/30/90/thisYear/allTime/custom)
│   ├── Export PDF button
│   └── Export Excel button
├── Zone 1: Executive Summary (always visible)
│   ├── CFO Briefing Banner (AI-generated narrative)
│   ├── Action Items (rule-engine generated, max 5)
│   └── KPI Cards Row (5 cards with context labels)
│       ├── Revenue (collected)
│       ├── Collection Rate
│       ├── Outstanding AR
│       ├── MRR
│       └── Top Client Concentration %
│   └── Mini Charts Row (2 sparkline-style charts)
│       ├── Revenue Trend (12 months)
│       └── AR Aging Snapshot (5 buckets)
└── Zone 2: Detailed Analysis (tabbed)
    ├── Tab 1: Revenue & Growth
    │   ├── Invoiced vs Collected (area chart)
    │   ├── Revenue by Service (horizontal bar)
    │   ├── MRR/ARR Trend (line chart)
    │   └── Month-over-Month Growth (bar chart, green/red)
    ├── Tab 2: AR & Collections
    │   ├── AR Aging Breakdown (stacked bar + table)
    │   ├── Collection Performance (dual-axis line)
    │   └── Overdue Invoices Table (sortable, filterable)
    ├── Tab 3: Cash Flow
    │   ├── Cash Flow Forecast 90 days (area, 3 scenarios)
    │   ├── Payment Probability Donut
    │   └── At-Risk Invoices Table
    └── Tab 4: Customer Analysis
        ├── Revenue Concentration Pareto (combo chart)
        ├── Top 10 Customers (horizontal bar)
        ├── Customer Segments Donut
        └── Avg Customer LTV (KPI + sparkline)
```

### Unified API Endpoint

**`GET /api/analytics/financial-bi`**

Single endpoint returns all dashboard data. Avoids waterfall fetching from multiple existing endpoints.

**Query parameters:**
- `dateRange`: `last7` | `last30` | `last90` | `thisYear` | `allTime` | `custom`
- `from`: ISO date (when dateRange=custom)
- `to`: ISO date (when dateRange=custom)
- `tab`: `all` | `revenue` | `ar` | `cashflow` | `customers` (for lazy-loading tabs)

**Response shape:**

```typescript
interface FinancialBIResponse {
  // Always returned
  summary: {
    revenue: KPIMetric;        // collected revenue
    collectionRate: KPIMetric; // totalPaid / totalInvoiced * 100
    outstandingAR: KPIMetric;  // sum of unpaid invoices
    mrr: KPIMetric;            // monthly recurring revenue
    topClientConcentration: KPIMetric & {
      topClients: Array<{ name: string; percentage: number }>; // extends KPIMetric with detail
    };
    revenueTrendMini: Array<{ month: string; amount: number }>;
    agingSnapshotMini: Array<{ bucket: string; amount: number; count: number }>;
  };

  // CFO Intelligence
  cfoInsight: {
    briefing: string;          // AI-generated narrative
    generatedAt: string;       // when the AI analysis was last run
    actions: Array<{
      severity: 'URGENT' | 'WATCH' | 'INSIGHT';
      title: string;
      description: string;
      linkedEntity?: { type: 'invoice' | 'customer'; id: string };
    }>;
  };

  // Tab data (included based on ?tab= param)
  revenueGrowth?: {
    invoicedVsCollected: Array<{ month: string; invoiced: number; collected: number }>;
    revenueByService: Array<{ service: string; amount: number }>;
    mrrTrend: Array<{ month: string; mrr: number; arr: number }>;
    momGrowth: Array<{ month: string; growthPct: number }>;
  };

  arCollections?: {
    agingBreakdown: Array<{ bucket: string; count: number; amount: number }>;
    collectionPerformance: Array<{ month: string; avgDaysToPayment: number; collectionRate: number }>;
    overdueInvoices: Array<{
      id: string;
      customerName: string;
      invoiceNumber: string;
      amount: number;
      dueDate: string;
      daysOverdue: number;
      remindersSent: number;
      collectionCalls: number;
      autoChargeStatus: string | null;
      ownerName: string;
    }>;
  };

  cashFlow?: {
    forecast: Array<{ date: string; optimistic: number; expected: number; conservative: number }>;
    probabilityBreakdown: Array<{ segment: string; amount: number; count: number }>;
    atRiskInvoices: Array<{
      id: string;
      customerName: string;
      amount: number;
      dueDate: string;
      daysOverdue: number;
      probability: number;
      riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      lastAction: string;
    }>;
  };

  customerAnalysis?: {
    concentration: Array<{ customer: string; revenue: number; cumulativePct: number }>;
    topCustomers: Array<{ customer: string; totalPaid: number }>;
    segments: Array<{ segment: string; count: number; revenue: number }>;
    ltv: {
      average: number;
      median: number;
      trend: Array<{ month: string; value: number }>;
    };
  };

  meta: {
    lastQbSync: string;
    dateRange: { from: string; to: string };
    generatedAt: string;
  };
}

interface KPIMetric {
  value: number;
  prevValue: number;
  changePct: number;
  context: string;        // rule-engine generated: "healthy" | "needs attention" | "critical"
  contextLevel: 'good' | 'warning' | 'danger';
}
```

### Export Endpoints

**PDF Export:** `GET /api/analytics/financial-bi/export/pdf?dateRange=last30`
- Uses `@react-pdf/renderer` to generate a styled PDF
- Includes: CFO briefing narrative, KPI summary, AR aging table, overdue invoices list, revenue trend chart (as pre-rendered image)
- Returns PDF file for download

**Excel Export:** `GET /api/analytics/financial-bi/export/excel?dateRange=last30`
- Uses `ExcelJS` to generate multi-sheet workbook
- Sheets: Executive Summary, Revenue by Month, AR Aging Detail, Overdue Invoices, Cash Flow Forecast, Customer Analysis
- Formatted with headers, currency formatting, conditional coloring
- Returns `.xlsx` file for download

---

## Fractional CFO Intelligence Layer

### Rule Engine (Deterministic, Instant)

Uses `json-rules-engine` to evaluate financial health on every API call.

**Rules stored as JSON in code** (not DB — these are business logic, not user-configurable):

```typescript
// lib/services/cfo-rules.ts
const rules = [
  {
    name: 'collection-rate-drop',
    conditions: {
      all: [{
        fact: 'collectionRateChange',
        operator: 'lessThan',
        value: -3  // dropped more than 3%
      }]
    },
    event: {
      type: 'WATCH',
      params: { template: 'collection-rate-declining' }
    }
  },
  {
    name: 'invoice-severely-overdue',
    conditions: {
      all: [{
        fact: 'maxDaysOverdue',
        operator: 'greaterThan',
        value: 45
      }]
    },
    event: {
      type: 'URGENT',
      params: { template: 'invoice-severely-overdue' }
    }
  },
  {
    name: 'revenue-concentration-high',
    conditions: {
      all: [{
        fact: 'topThreeConcentration',
        operator: 'greaterThan',
        value: 40  // top 3 clients > 40% of revenue
      }]
    },
    event: {
      type: 'INSIGHT',
      params: { template: 'concentration-risk' }
    }
  },
  {
    name: 'payment-pattern-degrading',
    conditions: {
      all: [{
        fact: 'customerPaymentTrendSlowing',
        operator: 'equal',
        value: true
      }]
    },
    event: {
      type: 'WATCH',
      params: { template: 'payment-pattern-degrading' }
    }
  },
  {
    name: 'cash-position-tight',
    conditions: {
      all: [{
        fact: 'thirtyDayCashProjection',
        operator: 'lessThan',
        value: 0  // projected negative
      }]
    },
    event: {
      type: 'URGENT',
      params: { template: 'cash-position-tight' }
    }
  }
];
```

**Rule output** → populates `cfoInsight.actions[]` and `KPIMetric.context` / `KPIMetric.contextLevel`.

### AI Layer (Cached, Async)

Uses existing `aiService` (OpenAI GPT-4) to generate the CFO Briefing narrative and strategic recommendations.

**Generation trigger:**
- **Daily cron** at 8:00 AM UTC via Vercel Cron Job (`/api/cron/cfo-analysis`)
- **On-demand** via "Refresh Analysis" button (rate-limited to 3x/day)

**Process:**
1. Query all financial KPIs and rule engine results
2. Build a structured prompt with the data
3. Call OpenAI with a CFO system prompt
4. Cache result in a new `CfoInsight` Prisma model
5. Dashboard reads cached insight on page load

**Prompt structure:**

```typescript
const systemPrompt = `You are a Fractional CFO analyzing financial data for Carreira U.S.A., 
an immigration services and mentorship company. Write a concise executive briefing (3-5 sentences) 
and 2-3 strategic recommendations. Be specific — reference actual customer names, dollar amounts, 
and percentages. Write for a CEO who has 30 seconds to read this.`;

const userPrompt = `Financial data for ${dateRange}:
- Revenue: $${revenue} (${revenueChange}% vs prior period)
- Collection rate: ${collectionRate}% (was ${prevCollectionRate}%)
- Outstanding AR: $${outstandingAR}
- MRR: $${mrr}
- Top 3 client concentration: ${concentration}%
- Overdue invoices: ${overdueCount} totaling $${overdueTotal}
- Worst overdue: ${worstOverdue.customer} - $${worstOverdue.amount} - ${worstOverdue.days} days
- Payment pattern alerts: ${patternAlerts}
- AR aging 90+: $${aging90plus}
- Cash flow 30-day projection: $${cashProjection}

Write: (1) Executive briefing paragraph, (2) Top 3 strategic recommendations with specific actions.`;
```

**New Prisma model:**

```prisma
model CfoInsight {
  id          String   @id @default(cuid())
  briefing    String   @db.Text
  recommendations String @db.Text  // JSON array of recommendations
  dataSnapshot String  @db.Text    // JSON of the data used to generate
  dateRange   String               // which period this covers
  generatedAt DateTime @default(now())
  createdAt   DateTime @default(now())
}
```

**Graceful degradation:** If OpenAI is unavailable or no cached insight exists, the briefing section shows "Analysis generating..." and the dashboard functions normally with rule-based data only.

**Cost estimate:** ~1 GPT-4 call/day, ~3.5k tokens in + ~500 tokens out = ~$0.15/day (~$4.50/month).

---

## New Dependencies

| Package | Version | Purpose | Install |
|---|---|---|---|
| `json-rules-engine` | ^6.x | Declarative rule engine for CFO alerts | `npm install json-rules-engine` |
| `@react-pdf/renderer` | ^4.x | PDF report generation as React components | `npm install @react-pdf/renderer` |
| `exceljs` | ^4.x | Multi-sheet Excel export with formatting | `npm install exceljs` |

---

## Component Architecture

### New Components

```
components/financial/
├── FinancialDashboard.tsx          # Main page orchestrator
├── CfoBriefing.tsx                 # AI narrative banner (dark gradient)
├── CfoActionItems.tsx              # Prioritized action list (URGENT/WATCH/INSIGHT)
├── FinancialKpiRow.tsx             # 5 KPI cards with context labels
├── MiniChartRow.tsx                # Revenue trend + AR aging sparklines
├── tabs/
│   ├── RevenueGrowthTab.tsx        # Invoiced vs Collected, Revenue by Service, MRR, MoM
│   ├── ArCollectionsTab.tsx        # Aging breakdown, Collection performance, Overdue table
│   ├── CashFlowTab.tsx             # Forecast, Probability donut, At-risk table
│   └── CustomerAnalysisTab.tsx     # Concentration, Top 10, Segments, LTV
└── export/
    ├── PdfReport.tsx               # @react-pdf/renderer template
    └── ExcelExport.ts              # ExcelJS workbook builder
```

### Reused Existing Components

These components from `components/analytics/` will be reused directly or with minor adaptation:

- `TopCustomersChart` → Customer Analysis tab (Top 10)
- `InvoiceAgingChart` → AR & Collections tab (with enhanced table)
- `CashFlowProjectionChart` → Cash Flow tab (add 3-scenario bands)
- `InvoiceStatusChart` → can inform AR breakdown
- `CollectionProbabilityGauge` → Cash Flow tab (probability donut)
- `AtRiskInvoicesTable` → Cash Flow tab
- `KpiCard` / `StatCard` → Executive Summary (with context label enhancement)

### New Service Files

```
lib/services/
├── cfo-rules.ts                    # json-rules-engine rules + evaluation
├── cfo-analysis.ts                 # AI prompt builder + OpenAI call + caching
└── financial-bi.ts                 # Unified data aggregation for the API endpoint
```

---

## Data Flow

```
Page Load
  │
  ├─ GET /api/analytics/financial-bi?dateRange=last30&tab=all
  │   │
  │   ├─ Prisma queries (Invoice, Payment, Customer, Deal)
  │   ├─ Aggregate KPIs, chart data, tables
  │   ├─ Run json-rules-engine against KPIs → actions[] + context labels
  │   ├─ Read cached CfoInsight from DB → briefing narrative
  │   └─ Return unified response
  │
  └─ React Query caches response, renders dashboard
      ├─ Zone 1: CFO Briefing + Actions + KPIs + Mini Charts (instant)
      └─ Zone 2: Active tab charts + tables

Daily Cron (8:00 AM UTC)
  │
  ├─ /api/cron/cfo-analysis
  │   ├─ Query financial KPIs
  │   ├─ Run rule engine
  │   ├─ Build prompt with data + rule results
  │   ├─ Call OpenAI GPT-4
  │   └─ Save CfoInsight to DB
  │
  └─ Ready for next page load

Export PDF
  │
  ├─ GET /api/analytics/financial-bi/export/pdf?dateRange=last30
  │   ├─ Fetch same data as dashboard
  │   ├─ Render @react-pdf/renderer template (CFO briefing + KPIs + tables)
  │   └─ Return PDF stream
  │
  └─ Browser downloads file

Export Excel
  │
  ├─ GET /api/analytics/financial-bi/export/excel?dateRange=last30
  │   ├─ Fetch same data as dashboard
  │   ├─ Build ExcelJS workbook (6 sheets)
  │   └─ Return .xlsx stream
  │
  └─ Browser downloads file
```

---

## CFO Rule Definitions

| Rule | Condition | Severity | Action |
|---|---|---|---|
| Collection rate declining | Drop > 3% vs prior period | WATCH | "Collection rate dropped X% — driven by [invoices]" |
| Invoice severely overdue | Any invoice > 45 days overdue | URGENT | "Escalate [customer] — $X outstanding, Y days overdue" |
| Revenue concentration high | Top 3 clients > 40% of revenue | INSIGHT | "Top N clients = X% of revenue — diversification needed" |
| Payment pattern degrading | Customer avg days-to-pay increasing 3+ consecutive months | WATCH | "[Customer] payment velocity degrading — was X days, now Y days" |
| Cash position tight | 30-day projected inflow < 0 or dangerously low | URGENT | "Cash shortfall projected in 30 days — accelerate [N invoices] totaling $X" |
| Auto-charge failure | Invoice auto-charge failed, no manual payment | URGENT | "Auto-charge failed for [customer] — card declined, manual follow-up needed" |
| AR aging 90+ growing | 90+ day bucket increased > 10% vs prior period | WATCH | "Stale receivables growing — $X now 90+ days, consider write-off review" |
| High-value invoice at risk | Single invoice > $5k and > 30 days overdue | URGENT | "High-value invoice at risk — [customer] $X, Y days overdue" |

---

## Access Control

- **Roles with access:** ADMIN, FINANCE, SALES (read-only for sales)
- **Follows existing NextAuth RBAC** in middleware.ts
- **Export buttons:** visible to ADMIN and FINANCE only
- **CFO Analysis refresh button:** ADMIN only

---

## File Changes Summary

### New Files
- `app/dashboard/financial/page.tsx` — main page
- `app/api/analytics/financial-bi/route.ts` — unified data endpoint
- `app/api/analytics/financial-bi/export/pdf/route.ts` — PDF export
- `app/api/analytics/financial-bi/export/excel/route.ts` — Excel export
- `app/api/cron/cfo-analysis/route.ts` — daily AI analysis cron
- `lib/services/cfo-rules.ts` — rule engine service
- `lib/services/cfo-analysis.ts` — AI analysis service
- `lib/services/financial-bi.ts` — data aggregation service
- `components/financial/*` — all new dashboard components (11 files)
- `prisma/schema.prisma` — add CfoInsight model

### Modified Files
- `vercel.json` — add cfo-analysis cron job
- `middleware.ts` — add `/dashboard/financial` to protected routes (if not already covered by `/dashboard/*` pattern)
- Existing chart components — minor props additions if needed for reuse

### New Dependencies
- `json-rules-engine`
- `@react-pdf/renderer`
- `exceljs`
