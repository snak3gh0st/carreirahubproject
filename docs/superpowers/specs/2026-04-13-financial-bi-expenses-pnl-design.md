# Financial BI Dashboard — QB Expenses & P&L Enhancement

**Date**: 2026-04-13
**Status**: Draft
**Author**: Claude Code + Paulo Loureiro
**Parent Spec**: `docs/superpowers/specs/2026-04-13-financial-bi-dashboard-design.md`

---

## Overview

Enhance the existing Financial BI Dashboard at `/dashboard/financial` with expense data from QuickBooks Reports API. This adds the "other side of the ledger" — expenses, P&L, burn rate, and cash position — giving the CEO a complete CFO-grade financial picture.

### Goals

1. **Full P&L visibility** — revenue, expenses, net income, and margin in one view
2. **Expense breakdown** — where the money goes, by QB category
3. **Burn rate & runway** — monthly expenses trend and how long cash lasts
4. **Cash position** — actual bank balance from QB Balance Sheet
5. **Smarter CFO intelligence** — AI briefing and rules now factor in expense data

### Non-Goals

- Syncing individual bills/expenses to local DB (use QB's aggregated reports)
- Vendor management or AP workflows
- Budget vs actual tracking (v2 feature)
- Tax reporting or compliance

---

## Architecture

### QuickBooks Reports API

QB provides pre-built financial reports. We call two:

**Profit and Loss Report**
```
GET /v3/company/{companyId}/reports/ProfitAndLoss
  ?start_date=2026-01-01
  &end_date=2026-04-13
  &summarize_column_by=Month
  &minorversion=73
```

Returns structured rows: Income (by account), Cost of Goods Sold, Expenses (by category), Net Income. When `summarize_column_by=Month`, each row has per-month columns — perfect for trend charts.

**Balance Sheet Report**
```
GET /v3/company/{companyId}/reports/BalanceSheet
  ?date=2026-04-13
  &minorversion=73
```

Returns: Assets (Bank accounts = cash on hand, AR, other), Liabilities, Equity. We extract the Bank Accounts total as "cash on hand."

### Data Flow

```
Page Load → GET /api/analytics/financial-bi?dateRange=last30&tab=all
  │
  ├─ Existing queries (invoices, payments, customers, rules, AI cache)
  │
  └─ NEW: Read QbReportCache from DB
       ├─ If fresh (< 6 hours old) → use cached data
       └─ If stale → return stale data (cron refreshes async)

Daily Cron (8:00 AM UTC) — /api/cron/cfo-analysis (ENHANCED)
  │
  ├─ Existing: generate AI CFO insight
  │
  └─ NEW: Refresh QB Reports cache
       ├─ Call QB ProfitAndLoss API (current year, by month)
       ├─ Call QB BalanceSheet API (current date)
       ├─ Parse and structure the response
       └─ Save to QbReportCache model
```

### New Prisma Model

```prisma
model QbReportCache {
  id          String   @id @default(cuid())
  reportType  String               // "ProfitAndLoss" | "BalanceSheet"
  data        String   @db.Text    // JSON of parsed report
  parameters  String               // JSON of query params used
  fetchedAt   DateTime @default(now())
  createdAt   DateTime @default(now())

  @@unique([reportType])
  @@map("qb_report_cache")
}
```

Single row per report type — upserted on each refresh. The `data` field holds the parsed/structured JSON, not the raw QB response.

---

## New Types

Added to `lib/types/financial-bi.ts`:

```typescript
export interface PnLData {
  // Summary KPIs
  totalRevenue: number;
  totalExpenses: number;
  totalCOGS: number;
  netIncome: number;
  marginPct: number;          // (netIncome / totalRevenue) * 100

  // Previous period comparison
  prevTotalRevenue: number;
  prevTotalExpenses: number;
  prevNetIncome: number;

  // Monthly trend (for chart)
  monthlyPnL: Array<{
    month: string;
    revenue: number;
    cogs: number;
    expenses: number;
    netIncome: number;
  }>;

  // Expense breakdown by QB category
  expensesByCategory: Array<{
    category: string;
    amount: number;
    pctOfTotal: number;
  }>;

  // Burn rate
  burnRate: number;           // avg monthly total expenses (last 3 months)
  prevBurnRate: number;       // avg monthly total expenses (3 months before that)

  // Cash position (from Balance Sheet)
  cashOnHand: number;
  runwayMonths: number;       // cashOnHand / burnRate
}
```

### Enhanced API Response

The existing `FinancialBIResponse` gains a new optional field:

```typescript
export interface FinancialBIResponse {
  // ... existing fields ...
  pnl?: PnLData;             // NEW — included when tab=all or tab=pnl
}
```

`TabParam` extended: `"all" | "revenue" | "ar" | "cashflow" | "customers" | "pnl"`

---

## QB Service Enhancement

### New Methods in `quickbooks.service.ts`

```typescript
async getProfitAndLossReport(startDate: string, endDate: string): Promise<any> {
  await this.initialize();
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    summarize_column_by: "Month",
    minorversion: "73",
  });
  return this.request(`/reports/ProfitAndLoss?${params.toString()}`);
}

async getBalanceSheetReport(asOfDate: string): Promise<any> {
  await this.initialize();
  const params = new URLSearchParams({
    date: asOfDate,
    minorversion: "73",
  });
  return this.request(`/reports/BalanceSheet?${params.toString()}`);
}
```

### QB Report Parser Service

New file: `lib/services/qb-report-parser.ts`

QB Reports return a complex nested row/column structure. This parser extracts what we need:

```typescript
export function parseProfitAndLoss(raw: any): {
  months: string[];
  income: { total: number; byMonth: number[] };
  cogs: { total: number; byMonth: number[] };
  expenses: { total: number; byMonth: number[]; byCategory: Array<{ category: string; amount: number }> };
  netIncome: { total: number; byMonth: number[] };
}

export function parseBalanceSheet(raw: any): {
  bankAccounts: { total: number; accounts: Array<{ name: string; balance: number }> };
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}
```

The parser handles the QB Row/ColData structure:
- `Rows.Row[].type` = "Section" for groups (Income, COGS, Expenses)
- `Rows.Row[].Summary.ColData[]` = totals per column
- `Rows.Row[].Rows.Row[]` = individual line items (expense categories)
- `Columns.Column[]` = column headers (month names or "Total")

---

## Dashboard Changes

### Executive Summary Enhancement

The KPI row changes from 5 to 7 cards (responsive — wraps on smaller screens):

| KPI | Source | Existing? |
|---|---|---|
| Revenue (Collected) | Invoice/Payment data | Yes |
| Total Expenses | QB P&L Report | **NEW** |
| Net Income | QB P&L Report | **NEW** |
| Collection Rate | Invoice data | Yes |
| Outstanding AR | Invoice data | Yes |
| MRR | Payment data | Yes |
| Cash on Hand | QB Balance Sheet | **NEW** |

The Top 3 Concentration card moves to the Customer Analysis tab to make room.

### New Tab: "P&L & Expenses" (5th tab)

```
Tab 5: P&L & Expenses
├── P&L Summary Cards (4 KPIs)
│   ├── Total Revenue (with trend)
│   ├── Total Expenses (with trend)
│   ├── Net Income (with trend + margin %)
│   └── Burn Rate (monthly avg + runway)
├── Monthly P&L Trend (combo chart)
│   ├── Stacked bars: Revenue (green) + Expenses (red)
│   └── Line overlay: Net Income
├── Expense Breakdown by Category (horizontal bar chart)
│   └── Top 10 categories ranked by amount
└── Cash Position Card
    ├── Cash on Hand (large number)
    ├── Runway: X months at current burn
    └── "Last updated from QB: [timestamp]"
```

### CFO Intelligence Enhancement

**New rules added to `cfo-rules.ts`:**

| Rule | Condition | Severity |
|---|---|---|
| Expense growth exceeding revenue | Expense growth % > revenue growth % for 2+ months | WATCH |
| Margin compression | Net margin dropped > 5 points vs prior period | WATCH |
| Low runway | Cash runway < 3 months | URGENT |
| Burn rate spike | Monthly burn > 120% of 3-month average | WATCH |

**AI prompt enhancement** — CFO briefing prompt gets expense data:
```
- Total Expenses: $X (Y% vs prior period)
- Net Income: $X (margin: Y%)
- Burn Rate: $X/month
- Cash on Hand: $X (runway: Y months)
- Top expense category: [category] at $X
```

### Export Enhancement

**PDF**: New "P&L Summary" section after KPIs — shows monthly P&L table and top expense categories.

**Excel**: New sheet "Profit & Loss" with:
- Monthly columns (revenue, COGS, expenses, net income per month)
- Expense category breakdown rows
- Burn rate and runway at bottom

---

## Caching Strategy

QB Reports API is slower than entity queries (~2-3 seconds). We cache aggressively:

1. **Daily refresh** via existing `/api/cron/cfo-analysis` cron (enhanced to also refresh QB reports)
2. **Manual refresh** via "Refresh" button on the dashboard (rate-limited with existing mechanism)
3. **Stale-while-revalidate** — dashboard always shows cached data, never blocks on QB API call
4. **Cache TTL** — 6 hours. If cache is older, show it with "Last updated X hours ago" warning
5. **Graceful degradation** — if QB is disconnected or reports fail, the P&L tab shows "QuickBooks data unavailable" and all other tabs work normally

---

## File Changes Summary

### New Files
- `lib/services/qb-report-parser.ts` — QB report response parser
- `components/financial/tabs/PnlExpensesTab.tsx` — new 5th tab component

### Modified Files
- `prisma/schema.prisma` — add QbReportCache model
- `lib/types/financial-bi.ts` — add PnLData interface, extend TabParam
- `lib/services/quickbooks.service.ts` — add getProfitAndLossReport(), getBalanceSheetReport()
- `lib/services/financial-bi.ts` — add queryPnL() function, include in getFinancialBIData()
- `lib/services/cfo-rules.ts` — add 4 expense-related rules, extend CfoFacts
- `lib/services/cfo-analysis.ts` — enhance AI prompt with expense data
- `app/api/cron/cfo-analysis/route.ts` — add QB report cache refresh
- `app/dashboard/financial/page.tsx` — add 5th tab, update KPI row to 7 cards
- `components/financial/FinancialKpiRow.tsx` — support 7 KPIs
- `components/financial/export/PdfReport.tsx` — add P&L section
- `app/api/analytics/financial-bi/export/excel/route.ts` — add P&L sheet

### No New Dependencies
Uses existing `quickbooks.service.ts` request infrastructure.
