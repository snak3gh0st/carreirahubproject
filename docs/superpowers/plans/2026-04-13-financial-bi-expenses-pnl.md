# Financial BI — QB Expenses & P&L Enhancement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add QuickBooks P&L and Balance Sheet data to the existing Financial BI Dashboard, giving the CEO a complete picture: revenue, expenses, net income, burn rate, cash position.

**Architecture:** New methods on the existing `QuickbooksService` call QB Reports API (ProfitAndLoss, BalanceSheet). A parser service extracts structured data from QB's nested row/column format. Results are cached in a new `QbReportCache` Prisma model, refreshed daily via the existing cron. A new 5th tab renders P&L charts. The executive summary KPI row expands from 5 to 7 cards. CFO rules and AI prompt are enhanced with expense data.

**Tech Stack:** Existing — Next.js 14, TypeScript, Prisma, Recharts, QuickBooks API v3, OpenAI

**Spec:** `docs/superpowers/specs/2026-04-13-financial-bi-expenses-pnl-design.md`

---

## Task 1: Add QbReportCache Prisma Model & PnL Types

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `lib/types/financial-bi.ts`

- [ ] **Step 1: Add QbReportCache model to Prisma schema**

Add after the `CfoInsight` model in `prisma/schema.prisma`:

```prisma
model QbReportCache {
  id          String   @id @default(cuid())
  reportType  String   @unique
  data        String   @db.Text
  parameters  String
  fetchedAt   DateTime @default(now())
  createdAt   DateTime @default(now())

  @@map("qb_report_cache")
}
```

- [ ] **Step 2: Generate and push schema**

```bash
npm run db:generate && npm run db:push
```

- [ ] **Step 3: Add PnLData interface to types file**

Add before the `FinancialBIResponse` interface (before line 92) in `lib/types/financial-bi.ts`:

```typescript
export interface PnLData {
  totalRevenue: number;
  totalExpenses: number;
  totalCOGS: number;
  netIncome: number;
  marginPct: number;
  prevTotalRevenue: number;
  prevTotalExpenses: number;
  prevNetIncome: number;
  monthlyPnL: Array<{
    month: string;
    revenue: number;
    cogs: number;
    expenses: number;
    netIncome: number;
  }>;
  expensesByCategory: Array<{
    category: string;
    amount: number;
    pctOfTotal: number;
  }>;
  burnRate: number;
  prevBurnRate: number;
  cashOnHand: number;
  runwayMonths: number;
  lastFetchedAt: string;
}
```

- [ ] **Step 4: Add `pnl` to FinancialBIResponse and extend TabParam**

In `lib/types/financial-bi.ts`, add `pnl?: PnLData;` to the `FinancialBIResponse` interface (after the `customerAnalysis` line), and change the `TabParam` type:

Replace:
```typescript
export type TabParam = "all" | "revenue" | "ar" | "cashflow" | "customers";
```
With:
```typescript
export type TabParam = "all" | "revenue" | "ar" | "cashflow" | "customers" | "pnl";
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma lib/types/financial-bi.ts
git commit -m "feat: add QbReportCache model and PnLData types"
```

---

## Task 2: QB Reports API Methods

**Files:**
- Modify: `lib/services/quickbooks.service.ts`

- [ ] **Step 1: Add report methods to QuickbooksService**

Add these two methods to the `QuickbooksService` class (before the closing `}` of the class, around line 2100):

```typescript
  /**
   * Fetch Profit and Loss Report from QuickBooks
   * Returns structured P&L data with monthly breakdown
   */
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

  /**
   * Fetch Balance Sheet Report from QuickBooks
   * Returns assets, liabilities, equity as of a given date
   */
  async getBalanceSheetReport(asOfDate: string): Promise<any> {
    await this.initialize();
    const params = new URLSearchParams({
      date: asOfDate,
      minorversion: "73",
    });
    return this.request(`/reports/BalanceSheet?${params.toString()}`);
  }
```

- [ ] **Step 2: Commit**

```bash
git add lib/services/quickbooks.service.ts
git commit -m "feat: add QB Reports API methods for P&L and Balance Sheet"
```

---

## Task 3: QB Report Parser Service

**Files:**
- Create: `lib/services/qb-report-parser.ts`

- [ ] **Step 1: Create the parser service**

QB Reports return a nested Row/ColData structure. This parser extracts what we need into clean typed objects.

```typescript
// lib/services/qb-report-parser.ts

interface QbReportRow {
  type?: string;
  Header?: { ColData: Array<{ value: string }> };
  Summary?: { ColData: Array<{ value: string }> };
  Rows?: { Row: QbReportRow[] };
  ColData?: Array<{ value: string }>;
  group?: string;
}

interface QbReport {
  Header?: { StartPeriod?: string; EndPeriod?: string; ReportName?: string };
  Columns?: { Column: Array<{ ColTitle: string; ColType: string }> };
  Rows?: { Row: QbReportRow[] };
}

export interface ParsedPnL {
  months: string[];
  income: { total: number; byMonth: number[] };
  cogs: { total: number; byMonth: number[] };
  expenses: { total: number; byMonth: number[]; byCategory: Array<{ category: string; amount: number }> };
  netIncome: { total: number; byMonth: number[] };
}

export interface ParsedBalanceSheet {
  bankAccounts: { total: number; accounts: Array<{ name: string; balance: number }> };
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

function parseNumber(value: string | undefined): number {
  if (!value || value === "") return 0;
  return parseFloat(value.replace(/,/g, "")) || 0;
}

function extractMonthColumns(report: QbReport): string[] {
  if (!report.Columns?.Column) return [];
  // Skip the first column (account name) and last column (total)
  return report.Columns.Column
    .filter((col) => col.ColType === "Money" && col.ColTitle !== "Total")
    .map((col) => col.ColTitle);
}

function findSectionByGroup(rows: QbReportRow[], groupName: string): QbReportRow | undefined {
  return rows.find((row) => row.group === groupName || row.Header?.ColData?.[0]?.value === groupName);
}

function extractSectionTotal(section: QbReportRow | undefined, colCount: number): { total: number; byMonth: number[] } {
  if (!section?.Summary?.ColData) {
    return { total: 0, byMonth: new Array(colCount).fill(0) };
  }
  const colData = section.Summary.ColData;
  // Last value is the total, preceding values are monthly
  const total = parseNumber(colData[colData.length - 1]?.value);
  const byMonth = colData.slice(1, colData.length - 1).map((c) => parseNumber(c.value));
  // If no monthly breakdown, fill with zeros
  if (byMonth.length === 0) return { total, byMonth: new Array(colCount).fill(0) };
  return { total, byMonth };
}

function extractCategoryBreakdown(section: QbReportRow | undefined): Array<{ category: string; amount: number }> {
  if (!section?.Rows?.Row) return [];
  const categories: Array<{ category: string; amount: number }> = [];

  for (const row of section.Rows.Row) {
    // Skip sub-sections, only get leaf rows with ColData
    if (row.ColData && row.ColData.length >= 2) {
      const name = row.ColData[0]?.value || "Other";
      const amount = parseNumber(row.ColData[row.ColData.length - 1]?.value);
      if (amount > 0) {
        categories.push({ category: name, amount });
      }
    }
    // Also check nested rows (expense sub-categories)
    if (row.Rows?.Row) {
      for (const subRow of row.Rows.Row) {
        if (subRow.ColData && subRow.ColData.length >= 2) {
          const name = subRow.ColData[0]?.value || "Other";
          const amount = parseNumber(subRow.ColData[subRow.ColData.length - 1]?.value);
          if (amount > 0) {
            categories.push({ category: name, amount });
          }
        }
      }
    }
  }

  return categories.sort((a, b) => b.amount - a.amount);
}

export function parseProfitAndLoss(raw: QbReport): ParsedPnL {
  const months = extractMonthColumns(raw);
  const rows = raw.Rows?.Row || [];
  const colCount = months.length;

  const incomeSection = findSectionByGroup(rows, "Income");
  const cogsSection = findSectionByGroup(rows, "CostOfGoodsSold");
  const expenseSection = findSectionByGroup(rows, "Expenses");
  const netIncomeSection = findSectionByGroup(rows, "NetIncome");

  const income = extractSectionTotal(incomeSection, colCount);
  const cogs = extractSectionTotal(cogsSection, colCount);
  const expenses = extractSectionTotal(expenseSection, colCount);
  const netIncome = extractSectionTotal(netIncomeSection, colCount);
  const byCategory = extractCategoryBreakdown(expenseSection);

  return {
    months,
    income,
    cogs,
    expenses: { ...expenses, byCategory },
    netIncome,
  };
}

export function parseBalanceSheet(raw: QbReport): ParsedBalanceSheet {
  const rows = raw.Rows?.Row || [];

  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;
  const bankAccounts: Array<{ name: string; balance: number }> = [];

  for (const section of rows) {
    const sectionName = section.Header?.ColData?.[0]?.value || section.group || "";

    if (sectionName === "Assets" || section.group === "Assets") {
      totalAssets = parseNumber(section.Summary?.ColData?.[1]?.value);

      // Dig into Bank Accounts sub-section
      if (section.Rows?.Row) {
        for (const subSection of section.Rows.Row) {
          const subName = subSection.Header?.ColData?.[0]?.value || "";
          if (subName.includes("Bank") || subName.includes("Cash")) {
            if (subSection.Rows?.Row) {
              for (const acctRow of subSection.Rows.Row) {
                if (acctRow.ColData && acctRow.ColData.length >= 2) {
                  bankAccounts.push({
                    name: acctRow.ColData[0]?.value || "Bank Account",
                    balance: parseNumber(acctRow.ColData[1]?.value),
                  });
                }
              }
            }
          }
        }
      }
    }

    if (sectionName === "Liabilities" || section.group === "Liabilities") {
      totalLiabilities = parseNumber(section.Summary?.ColData?.[1]?.value);
    }

    if (sectionName === "Equity" || section.group === "Equity") {
      totalEquity = parseNumber(section.Summary?.ColData?.[1]?.value);
    }
  }

  const bankTotal = bankAccounts.reduce((sum, a) => sum + a.balance, 0);

  return {
    bankAccounts: { total: bankTotal, accounts: bankAccounts },
    totalAssets,
    totalLiabilities,
    totalEquity,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/services/qb-report-parser.ts
git commit -m "feat: add QB report parser for P&L and Balance Sheet"
```

---

## Task 4: P&L Data Integration into Financial BI Service

**Files:**
- Modify: `lib/services/financial-bi.ts`

- [ ] **Step 1: Add queryPnL function and integrate into getFinancialBIData**

Add these imports at the top of `lib/services/financial-bi.ts`:

```typescript
import { parseProfitAndLoss, parseBalanceSheet } from "@/lib/services/qb-report-parser";
import { PnLData } from "@/lib/types/financial-bi";
```

Add this function before the `getFinancialKPIs` function:

```typescript
async function queryPnL(startDate: Date, endDate: Date): Promise<PnLData | null> {
  try {
    // Read from cache
    const [pnlCache, bsCache] = await Promise.all([
      prisma.qbReportCache.findUnique({ where: { reportType: "ProfitAndLoss" } }),
      prisma.qbReportCache.findUnique({ where: { reportType: "BalanceSheet" } }),
    ]);

    if (!pnlCache) {
      return null; // No cached data yet — will be populated by cron
    }

    const pnlData = JSON.parse(pnlCache.data);
    const bsData = bsCache ? JSON.parse(bsCache.data) : null;

    const { income, cogs, expenses, netIncome, months } = pnlData;

    // Monthly P&L
    const monthlyPnL = months.map((month: string, i: number) => ({
      month,
      revenue: income.byMonth[i] || 0,
      cogs: cogs.byMonth[i] || 0,
      expenses: expenses.byMonth[i] || 0,
      netIncome: netIncome.byMonth[i] || 0,
    }));

    // Expense categories with percentages
    const totalExp = expenses.total || 1;
    const expensesByCategory = (expenses.byCategory || []).slice(0, 15).map(
      (c: { category: string; amount: number }) => ({
        category: c.category,
        amount: c.amount,
        pctOfTotal: (c.amount / totalExp) * 100,
      })
    );

    // Burn rate: average of last 3 months of total expenses
    const recentMonths = monthlyPnL.slice(-3);
    const burnRate = recentMonths.length > 0
      ? recentMonths.reduce((sum: number, m: { expenses: number; cogs: number }) => sum + m.expenses + m.cogs, 0) / recentMonths.length
      : 0;

    // Previous burn rate: 3 months before that
    const prevMonths = monthlyPnL.slice(-6, -3);
    const prevBurnRate = prevMonths.length > 0
      ? prevMonths.reduce((sum: number, m: { expenses: number; cogs: number }) => sum + m.expenses + m.cogs, 0) / prevMonths.length
      : 0;

    // Cash on hand from balance sheet
    const cashOnHand = bsData?.bankAccounts?.total || 0;
    const runwayMonths = burnRate > 0 ? cashOnHand / burnRate : 99;

    // Previous period approximation: first half vs second half of monthly data
    const halfPoint = Math.floor(months.length / 2);
    const prevRevenue = monthlyPnL.slice(0, halfPoint).reduce((s: number, m: { revenue: number }) => s + m.revenue, 0);
    const currRevenue = monthlyPnL.slice(halfPoint).reduce((s: number, m: { revenue: number }) => s + m.revenue, 0);
    const prevExpenses = monthlyPnL.slice(0, halfPoint).reduce((s: number, m: { expenses: number; cogs: number }) => s + m.expenses + m.cogs, 0);
    const currExpenses = monthlyPnL.slice(halfPoint).reduce((s: number, m: { expenses: number; cogs: number }) => s + m.expenses + m.cogs, 0);

    const marginPct = income.total > 0 ? (netIncome.total / income.total) * 100 : 0;

    return {
      totalRevenue: income.total,
      totalExpenses: expenses.total + cogs.total,
      totalCOGS: cogs.total,
      netIncome: netIncome.total,
      marginPct,
      prevTotalRevenue: prevRevenue,
      prevTotalExpenses: prevExpenses,
      prevNetIncome: prevRevenue - prevExpenses,
      monthlyPnL,
      expensesByCategory,
      burnRate,
      prevBurnRate,
      cashOnHand,
      runwayMonths,
      lastFetchedAt: pnlCache.fetchedAt.toISOString(),
    };
  } catch (error) {
    console.error("[FINANCIAL-BI] Error reading QB report cache:", error);
    return null;
  }
}
```

Then in the `getFinancialBIData` function, add the `pnl` tab query alongside existing tabs. Find the block where tab queries are built (the `if (tab === "all" || tab === "...")` lines) and add:

```typescript
  if (tab === "all" || tab === "pnl") {
    tabQueries.push(queryPnL(startDate, endDate));
    tabKeys.push("pnl");
  }
```

- [ ] **Step 2: Commit**

```bash
git add lib/services/financial-bi.ts
git commit -m "feat: integrate P&L data from QB report cache into financial BI service"
```

---

## Task 5: Enhance Cron Job to Refresh QB Reports

**Files:**
- Modify: `app/api/cron/cfo-analysis/route.ts`

- [ ] **Step 1: Add QB report refresh to the cron**

Replace the entire content of `app/api/cron/cfo-analysis/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { generateAndCacheCfoInsight } from "@/lib/services/cfo-analysis";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { parseProfitAndLoss, parseBalanceSheet } from "@/lib/services/qb-report-parser";
import { prisma } from "@/lib/db";
import { format, startOfYear } from "date-fns";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function refreshQbReports(): Promise<void> {
  try {
    const now = new Date();
    const yearStart = format(startOfYear(now), "yyyy-MM-dd");
    const today = format(now, "yyyy-MM-dd");

    const [pnlRaw, bsRaw] = await Promise.all([
      quickbooksService.getProfitAndLossReport(yearStart, today),
      quickbooksService.getBalanceSheetReport(today),
    ]);

    const pnlParsed = parseProfitAndLoss(pnlRaw);
    const bsParsed = parseBalanceSheet(bsRaw);

    await Promise.all([
      prisma.qbReportCache.upsert({
        where: { reportType: "ProfitAndLoss" },
        update: {
          data: JSON.stringify(pnlParsed),
          parameters: JSON.stringify({ startDate: yearStart, endDate: today }),
          fetchedAt: now,
        },
        create: {
          reportType: "ProfitAndLoss",
          data: JSON.stringify(pnlParsed),
          parameters: JSON.stringify({ startDate: yearStart, endDate: today }),
        },
      }),
      prisma.qbReportCache.upsert({
        where: { reportType: "BalanceSheet" },
        update: {
          data: JSON.stringify(bsParsed),
          parameters: JSON.stringify({ asOfDate: today }),
          fetchedAt: now,
        },
        create: {
          reportType: "BalanceSheet",
          data: JSON.stringify(bsParsed),
          parameters: JSON.stringify({ asOfDate: today }),
        },
      }),
    ]);

    console.log("[CFO-CRON] QB reports cached successfully");
  } catch (error) {
    console.error("[CFO-CRON] Failed to refresh QB reports:", error);
    // Don't throw — let CFO insight generation continue even if QB fails
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Refresh QB reports first (provides data for AI analysis)
    await refreshQbReports();

    // Generate AI insights
    await Promise.all([
      generateAndCacheCfoInsight("last30"),
      generateAndCacheCfoInsight("thisYear"),
    ]);

    return NextResponse.json({ success: true, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("[CFO-ANALYSIS-CRON] Error:", error);
    return NextResponse.json({ error: "Failed to generate CFO analysis" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/cron/cfo-analysis/route.ts
git commit -m "feat: enhance cron to refresh QB P&L and Balance Sheet reports"
```

---

## Task 6: Add Expense Rules to CFO Rule Engine

**Files:**
- Modify: `lib/services/cfo-rules.ts`

- [ ] **Step 1: Extend CfoFacts with expense fields**

Add these fields to the `CfoFacts` interface (before the closing `}`):

```typescript
  // Expense fields (from QB reports, may be 0 if not loaded)
  expenseGrowthPct: number;
  revenueGrowthPct: number;
  netMarginPct: number;
  prevNetMarginPct: number;
  cashRunwayMonths: number;
  burnRate: number;
  prevBurnRate: number;
```

- [ ] **Step 2: Add expense rules to the rules array**

Add these rules to the `rules` array (after the existing `aging-90-plus-growing` rule):

```typescript
  {
    name: "expense-outpacing-revenue",
    priority: 7,
    conditions: {
      all: [
        { fact: "expenseGrowthPct", operator: "greaterThan", value: 0 },
        { fact: "revenueGrowthPct", operator: "greaterThanInclusive", value: 0 },
      ],
    },
    event: {
      type: "WATCH",
      params: { rule: "expense-outpacing-revenue" },
    },
  },
  {
    name: "margin-compression",
    priority: 8,
    conditions: {
      all: [
        { fact: "netMarginPct", operator: "lessThan", value: 100 }, // always true, we check delta in handler
      ],
    },
    event: {
      type: "WATCH",
      params: { rule: "margin-compression" },
    },
  },
  {
    name: "low-runway",
    priority: 10,
    conditions: {
      all: [
        { fact: "cashRunwayMonths", operator: "lessThan", value: 3 },
        { fact: "cashRunwayMonths", operator: "greaterThan", value: 0 },
      ],
    },
    event: {
      type: "URGENT",
      params: { rule: "low-runway" },
    },
  },
  {
    name: "burn-rate-spike",
    priority: 7,
    conditions: {
      all: [
        { fact: "burnRate", operator: "greaterThan", value: 0 },
        { fact: "prevBurnRate", operator: "greaterThan", value: 0 },
      ],
    },
    event: {
      type: "WATCH",
      params: { rule: "burn-rate-spike" },
    },
  },
```

- [ ] **Step 3: Add expense rule handlers to buildRuleActions**

Add these cases in the `buildRuleActions` switch statement:

```typescript
      case "expense-outpacing-revenue": {
        if (facts.expenseGrowthPct > facts.revenueGrowthPct) {
          actions.push({
            severity: "WATCH",
            title: "Expenses growing faster than revenue",
            description: `Expenses grew ${facts.expenseGrowthPct.toFixed(1)}% while revenue grew ${facts.revenueGrowthPct.toFixed(1)}%. Margin compression risk.`,
          });
        }
        break;
      }
      case "margin-compression": {
        const marginDrop = facts.prevNetMarginPct - facts.netMarginPct;
        if (marginDrop > 5) {
          actions.push({
            severity: "WATCH",
            title: "Net margin declining",
            description: `Net margin dropped from ${facts.prevNetMarginPct.toFixed(1)}% to ${facts.netMarginPct.toFixed(1)}% (${marginDrop.toFixed(1)} point decline).`,
          });
        }
        break;
      }
      case "low-runway":
        actions.push({
          severity: "URGENT",
          title: "Cash runway below 3 months",
          description: `At current burn rate ($${facts.burnRate.toLocaleString()}/mo), cash runway is ${facts.cashRunwayMonths.toFixed(1)} months. Immediate attention needed.`,
        });
        break;
      case "burn-rate-spike": {
        const burnIncrease = facts.prevBurnRate > 0 ? ((facts.burnRate - facts.prevBurnRate) / facts.prevBurnRate) * 100 : 0;
        if (burnIncrease > 20) {
          actions.push({
            severity: "WATCH",
            title: "Burn rate spike",
            description: `Monthly burn rate increased ${burnIncrease.toFixed(0)}% to $${facts.burnRate.toLocaleString()}/mo (was $${facts.prevBurnRate.toLocaleString()}/mo).`,
          });
        }
        break;
      }
```

- [ ] **Step 4: Commit**

```bash
git add lib/services/cfo-rules.ts
git commit -m "feat: add expense and margin rules to CFO rule engine"
```

---

## Task 7: Enhance AI CFO Prompt with Expense Data

**Files:**
- Modify: `lib/services/cfo-analysis.ts`

- [ ] **Step 1: Extend CfoAnalysisInput with expense fields**

Add these fields to the `CfoAnalysisInput` interface (before `dateRangeLabel`):

```typescript
  // Expense data (from QB reports, may be 0 if not loaded)
  totalExpenses: number;
  netIncome: number;
  marginPct: number;
  burnRate: number;
  cashOnHand: number;
  runwayMonths: number;
  topExpenseCategory: string;
  topExpenseAmount: number;
```

- [ ] **Step 2: Add expense data to the user prompt**

In the `generateCfoAnalysis` function, add these lines to the `userPrompt` template string (before the "Write the briefing" line):

```typescript
${input.totalExpenses > 0 ? `- Total Expenses: $${input.totalExpenses.toLocaleString()}
- Net Income: $${input.netIncome.toLocaleString()} (margin: ${input.marginPct.toFixed(1)}%)
- Burn Rate: $${input.burnRate.toLocaleString()}/month
- Cash on Hand: $${input.cashOnHand.toLocaleString()} (runway: ${input.runwayMonths.toFixed(1)} months)
- Top expense: ${input.topExpenseCategory} at $${input.topExpenseAmount.toLocaleString()}` : "- Expense data: not available from QuickBooks"}
```

- [ ] **Step 3: Commit**

```bash
git add lib/services/cfo-analysis.ts
git commit -m "feat: enhance CFO AI prompt with expense and margin data"
```

---

## Task 8: Wire P&L Facts into Financial BI Service

**Files:**
- Modify: `lib/services/financial-bi.ts`

- [ ] **Step 1: Pass PnL data to rule engine facts**

In the `getFinancialBIData` function, after the `queryPnL` result is available, update the `facts` object to include expense data. Find where `const facts: CfoFacts = {` is built and add the new fields.

After the tab queries resolve (after `const tabResults = await Promise.all(tabQueries);`), find the pnl result and enrich facts:

```typescript
  // Enrich facts with P&L data if available
  const pnlResult = tabData.pnl as PnLData | null;
  if (pnlResult) {
    facts.expenseGrowthPct = pnlResult.prevTotalExpenses > 0
      ? ((pnlResult.totalExpenses - pnlResult.prevTotalExpenses) / pnlResult.prevTotalExpenses) * 100
      : 0;
    facts.revenueGrowthPct = pnlResult.prevTotalRevenue > 0
      ? ((pnlResult.totalRevenue - pnlResult.prevTotalRevenue) / pnlResult.prevTotalRevenue) * 100
      : 0;
    facts.netMarginPct = pnlResult.marginPct;
    facts.prevNetMarginPct = pnlResult.prevTotalRevenue > 0
      ? ((pnlResult.prevNetIncome) / pnlResult.prevTotalRevenue) * 100
      : 0;
    facts.cashRunwayMonths = pnlResult.runwayMonths;
    facts.burnRate = pnlResult.burnRate;
    facts.prevBurnRate = pnlResult.prevBurnRate;
  }
```

Note: The facts object needs to be initialized with default 0 values for the new expense fields. Add these defaults to the initial `facts` declaration:

```typescript
    expenseGrowthPct: 0,
    revenueGrowthPct: 0,
    netMarginPct: 0,
    prevNetMarginPct: 0,
    cashRunwayMonths: 99,
    burnRate: 0,
    prevBurnRate: 0,
```

Also update `getFinancialKPIs` to include expense data for the AI prompt. Add after the existing return object fields:

```typescript
    totalExpenses: 0,
    netIncome: 0,
    marginPct: 0,
    burnRate: 0,
    cashOnHand: 0,
    runwayMonths: 0,
    topExpenseCategory: "",
    topExpenseAmount: 0,
```

Then try to load PnL cache and populate those fields:

```typescript
  // Try to enrich with P&L data
  try {
    const pnlCache = await prisma.qbReportCache.findUnique({ where: { reportType: "ProfitAndLoss" } });
    const bsCache = await prisma.qbReportCache.findUnique({ where: { reportType: "BalanceSheet" } });
    if (pnlCache) {
      const pnl = JSON.parse(pnlCache.data);
      const bs = bsCache ? JSON.parse(bsCache.data) : null;
      const totalExp = (pnl.expenses?.total || 0) + (pnl.cogs?.total || 0);
      const topCat = pnl.expenses?.byCategory?.[0];
      Object.assign(result, {
        totalExpenses: totalExp,
        netIncome: pnl.netIncome?.total || 0,
        marginPct: pnl.income?.total > 0 ? ((pnl.netIncome?.total || 0) / pnl.income.total) * 100 : 0,
        burnRate: totalExp / Math.max(pnl.months?.length || 1, 1),
        cashOnHand: bs?.bankAccounts?.total || 0,
        runwayMonths: totalExp > 0 ? (bs?.bankAccounts?.total || 0) / (totalExp / Math.max(pnl.months?.length || 1, 1)) : 0,
        topExpenseCategory: topCat?.category || "",
        topExpenseAmount: topCat?.amount || 0,
      });
    }
  } catch (e) {
    // Ignore — expense data is optional
  }
```

- [ ] **Step 2: Commit**

```bash
git add lib/services/financial-bi.ts
git commit -m "feat: wire P&L data into CFO rule engine facts and AI analysis input"
```

---

## Task 9: P&L Tab Component

**Files:**
- Create: `components/financial/tabs/PnlExpensesTab.tsx`

- [ ] **Step 1: Create the P&L tab component**

```typescript
// components/financial/tabs/PnlExpensesTab.tsx
"use client";

import { PnLData } from "@/lib/types/financial-bi";
import {
  BarChart, Bar, ComposedChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PnlExpensesTabProps {
  data: PnLData;
}

function formatK(value: number): string {
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

function PnlKpiCard({ title, value, prevValue, format: fmt }: {
  title: string; value: number; prevValue: number; format: "currency" | "percent" | "months";
}) {
  const changePct = prevValue !== 0 ? ((value - prevValue) / Math.abs(prevValue)) * 100 : 0;
  const display = fmt === "currency" ? formatK(value) : fmt === "percent" ? `${value.toFixed(1)}%` : `${value.toFixed(1)} mo`;
  const isPositive = fmt === "currency" ? value >= 0 : fmt === "months" ? value >= 6 : value >= 0;
  const changePrefix = changePct >= 0 ? "▲" : "▼";

  return (
    <div className={`rounded-lg border bg-white p-3 text-center ${isPositive ? "border-gray-100" : "border-red-200"}`}>
      <div className="text-[10px] uppercase text-gray-500">{title}</div>
      <div className={`mt-1 text-xl font-extrabold ${isPositive ? "text-success-600" : "text-error-600"}`}>{display}</div>
      {prevValue !== 0 && (
        <div className={`text-[11px] ${changePct >= 0 ? "text-success-600" : "text-error-600"}`}>
          {changePrefix} {Math.abs(changePct).toFixed(1)}% vs prior
        </div>
      )}
    </div>
  );
}

export function PnlExpensesTab({ data }: PnlExpensesTabProps) {
  return (
    <div className="space-y-4">
      {/* P&L KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <PnlKpiCard title="Total Revenue" value={data.totalRevenue} prevValue={data.prevTotalRevenue} format="currency" />
        <PnlKpiCard title="Total Expenses" value={data.totalExpenses} prevValue={data.prevTotalExpenses} format="currency" />
        <PnlKpiCard title="Net Income" value={data.netIncome} prevValue={data.prevNetIncome} format="currency" />
        <PnlKpiCard title="Net Margin" value={data.marginPct} prevValue={0} format="percent" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Monthly P&L Trend */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Monthly P&L Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={data.monthlyPnL}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={formatK} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatK(v)} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} stackId="stack" />
                <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} stackId="expenses" />
                <Bar dataKey="cogs" name="COGS" fill="#f97316" radius={[4, 4, 0, 0]} stackId="expenses" />
                <Line type="monotone" dataKey="netIncome" name="Net Income" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Expense Breakdown by Category */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Expense Breakdown by Category</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.expensesByCategory.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tickFormatter={formatK} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 10 }} width={130} />
                <Tooltip formatter={(v: number) => formatK(v)} />
                <Bar dataKey="amount" fill="#ef4444" radius={[0, 4, 4, 0]}>
                  {data.expensesByCategory.slice(0, 10).map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "#991b1b" : i < 3 ? "#ef4444" : "#f87171"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Burn Rate & Cash Position */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Burn Rate & Runway</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-6">
            <div className="text-3xl font-extrabold text-error-600">{formatK(data.burnRate)}<span className="text-base font-normal text-gray-500">/mo</span></div>
            <div className="text-xs text-gray-500">Monthly Burn Rate (avg last 3 months)</div>
            <div className="mt-4 text-2xl font-bold" style={{ color: data.runwayMonths < 3 ? "var(--error-600)" : data.runwayMonths < 6 ? "var(--warning-600)" : "var(--success-600)" }}>
              {data.runwayMonths >= 99 ? "∞" : `${data.runwayMonths.toFixed(1)}`}<span className="text-base font-normal text-gray-500"> months runway</span>
            </div>
            <div className="text-xs text-gray-400 mt-1">Cash on Hand / Monthly Burn</div>
            {data.prevBurnRate > 0 && (
              <div className={`mt-3 text-xs ${data.burnRate > data.prevBurnRate ? "text-error-600" : "text-success-600"}`}>
                {data.burnRate > data.prevBurnRate ? "▲" : "▼"} {Math.abs(((data.burnRate - data.prevBurnRate) / data.prevBurnRate) * 100).toFixed(1)}% vs prior period
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Cash Position</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-6">
            <div className="text-3xl font-extrabold text-brand-verde">{formatK(data.cashOnHand)}</div>
            <div className="text-xs text-gray-500">Cash on Hand (from QuickBooks)</div>
            <div className="mt-4 text-xs text-gray-400">
              Last updated: {new Date(data.lastFetchedAt).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/financial/tabs/PnlExpensesTab.tsx
git commit -m "feat: add P&L & Expenses tab component"
```

---

## Task 10: Update Dashboard Page — Add 5th Tab & Expand KPIs

**Files:**
- Modify: `app/dashboard/financial/page.tsx`
- Modify: `components/financial/FinancialKpiRow.tsx`

- [ ] **Step 1: Update the main page**

In `app/dashboard/financial/page.tsx`:

1. Add import for PnlExpensesTab:
```typescript
import { PnlExpensesTab } from "@/components/financial/tabs/PnlExpensesTab";
```

2. Add the 5th tab to the `tabs` array:
```typescript
const tabs = [
  { key: "revenue", label: "Revenue & Growth" },
  { key: "ar", label: "AR & Collections" },
  { key: "cashflow", label: "Cash Flow" },
  { key: "customers", label: "Customer Analysis" },
  { key: "pnl", label: "P&L & Expenses" },
] as const;
```

3. Add the tab render condition (alongside existing tab conditions):
```typescript
{activeTab === "pnl" && data.pnl && <PnlExpensesTab data={data.pnl} />}
```

4. Update the `FinancialKpiRow` to pass P&L data. Add these props after the existing ones:
```typescript
totalExpenses={data.pnl?.totalExpenses}
netIncome={data.pnl?.netIncome}
cashOnHand={data.pnl?.cashOnHand}
```

- [ ] **Step 2: Update FinancialKpiRow to support 7 KPIs**

In `components/financial/FinancialKpiRow.tsx`, add optional P&L props:

```typescript
interface FinancialKpiRowProps {
  revenue: KPIMetric;
  collectionRate: KPIMetric;
  outstandingAR: KPIMetric;
  mrr: KPIMetric;
  topClientConcentration: ConcentrationMetric;
  totalExpenses?: number;
  netIncome?: number;
  cashOnHand?: number;
}
```

Update the grid to show 7 cards when expense data is available. Add after the existing 5 KpiCards:

```typescript
{props.totalExpenses !== undefined && (
  <div className="rounded-lg border border-gray-100 bg-white p-3 text-center">
    <div className="text-[10px] uppercase text-gray-500">Expenses</div>
    <div className="mt-1 text-xl font-extrabold text-error-600">{formatCurrency(props.totalExpenses)}</div>
  </div>
)}
{props.netIncome !== undefined && (
  <div className={`rounded-lg border bg-white p-3 text-center ${props.netIncome >= 0 ? "border-gray-100" : "border-red-200"}`}>
    <div className="text-[10px] uppercase text-gray-500">Net Income</div>
    <div className={`mt-1 text-xl font-extrabold ${props.netIncome >= 0 ? "text-success-600" : "text-error-600"}`}>{formatCurrency(props.netIncome)}</div>
  </div>
)}
```

Update the grid class to support more columns:
```typescript
<div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
```

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/financial/page.tsx components/financial/FinancialKpiRow.tsx
git commit -m "feat: add P&L tab and expand KPI row with expense data"
```

---

## Task 11: Update Exports with P&L Data

**Files:**
- Modify: `app/api/analytics/financial-bi/export/excel/route.ts`
- Modify: `components/financial/export/PdfReport.tsx`

- [ ] **Step 1: Add P&L sheet to Excel export**

In the Excel export route, add this after the "Customer Analysis" sheet block:

```typescript
    // Sheet 6: Profit & Loss
    if (data.pnl) {
      const pnlSheet = workbook.addWorksheet("Profit & Loss");
      pnlSheet.columns = [
        { header: "Month", key: "month", width: 15 },
        { header: "Revenue", key: "revenue", width: 15 },
        { header: "COGS", key: "cogs", width: 15 },
        { header: "Expenses", key: "expenses", width: 15 },
        { header: "Net Income", key: "netIncome", width: 15 },
      ];
      data.pnl.monthlyPnL.forEach((m) => pnlSheet.addRow(m));
      ["revenue", "cogs", "expenses", "netIncome"].forEach((col) => {
        pnlSheet.getColumn(col).numFmt = "$#,##0.00";
      });

      // Add expense breakdown below
      pnlSheet.addRow({});
      pnlSheet.addRow({ month: "EXPENSE CATEGORIES", revenue: "", cogs: "", expenses: "", netIncome: "" });
      if (data.pnl.expensesByCategory) {
        data.pnl.expensesByCategory.forEach((c) => {
          pnlSheet.addRow({ month: c.category, revenue: c.amount });
        });
      }

      // Add summary
      pnlSheet.addRow({});
      pnlSheet.addRow({ month: "Burn Rate (monthly)", revenue: data.pnl.burnRate });
      pnlSheet.addRow({ month: "Cash on Hand", revenue: data.pnl.cashOnHand });
      pnlSheet.addRow({ month: "Runway (months)", revenue: data.pnl.runwayMonths });
    }
```

- [ ] **Step 2: Add P&L section to PDF report**

In `components/financial/export/PdfReport.tsx`, add this section after the overdue invoices section (before the footer):

```typescript
        {data.pnl && (
          <>
            <Text style={styles.sectionTitle}>Profit & Loss Summary</Text>
            <View style={styles.kpiRow}>
              {[
                { label: "Revenue", value: formatCurrency(data.pnl.totalRevenue) },
                { label: "Expenses", value: formatCurrency(data.pnl.totalExpenses) },
                { label: "Net Income", value: formatCurrency(data.pnl.netIncome) },
                { label: "Margin", value: `${data.pnl.marginPct.toFixed(1)}%` },
                { label: "Burn Rate", value: `${formatCurrency(data.pnl.burnRate)}/mo` },
                { label: "Cash", value: formatCurrency(data.pnl.cashOnHand) },
              ].map((item) => (
                <View key={item.label} style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>{item.label}</Text>
                  <Text style={{ fontSize: 14, fontWeight: "bold" }}>{item.value}</Text>
                </View>
              ))}
            </View>

            <Text style={{ fontSize: 10, fontWeight: "bold", marginTop: 10, marginBottom: 5 }}>Top Expense Categories</Text>
            <View>
              <View style={styles.tableHeader}>
                <Text style={{ ...styles.tableHeaderCell, flex: 2 }}>Category</Text>
                <Text style={styles.tableHeaderCell}>Amount</Text>
                <Text style={styles.tableHeaderCell}>% of Total</Text>
              </View>
              {data.pnl.expensesByCategory.slice(0, 8).map((c) => (
                <View key={c.category} style={styles.tableRow}>
                  <Text style={{ ...styles.tableCell, flex: 2 }}>{c.category}</Text>
                  <Text style={styles.tableCell}>{formatCurrency(c.amount)}</Text>
                  <Text style={styles.tableCell}>{c.pctOfTotal.toFixed(1)}%</Text>
                </View>
              ))}
            </View>
          </>
        )}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/analytics/financial-bi/export/excel/route.ts components/financial/export/PdfReport.tsx
git commit -m "feat: add P&L data to PDF and Excel exports"
```

---

## Task 12: Build Verification & Testing

**Files:** None new — verification only

- [ ] **Step 1: Run build**

```bash
npm run build
```

Fix any TypeScript errors found.

- [ ] **Step 2: Test the cron endpoint manually**

```bash
curl "http://localhost:3001/api/cron/cfo-analysis"
```

This should fetch QB reports and cache them. Check for errors in terminal.

- [ ] **Step 3: Test the dashboard page**

Navigate to `http://localhost:3001/dashboard/financial` (logged in). Verify:
1. KPI row shows 7 cards (or 5 if QB data not loaded yet)
2. 5th tab "P&L & Expenses" is visible
3. P&L tab shows monthly trend, expense breakdown, burn rate, cash position
4. If QB data is not cached yet, the tab shows gracefully (null state)

- [ ] **Step 4: Test exports**

1. Click "Export Excel" — verify new "Profit & Loss" sheet exists with monthly data
2. Click "Export PDF" — verify P&L summary section appears

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues from P&L enhancement testing"
```
