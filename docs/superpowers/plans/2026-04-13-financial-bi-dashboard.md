# Financial BI Dashboard with Fractional CFO Intelligence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/dashboard/financial` — a dual-audience financial BI dashboard with a hybrid rule-engine + AI-powered CFO intelligence layer, plus PDF and Excel export.

**Architecture:** New unified API endpoint (`/api/analytics/financial-bi`) aggregates all financial data in one call. Rule engine (`json-rules-engine`) evaluates thresholds on every request for instant alerts. AI layer (OpenAI GPT-4) generates cached narrative briefings via daily cron. Frontend is a single page with executive summary zone + 4 tabbed detail sections. Exports use `@react-pdf/renderer` (PDF) and `exceljs` (Excel).

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma, Recharts, React Query, Tailwind CSS, json-rules-engine, @react-pdf/renderer, exceljs, OpenAI GPT-4

**Spec:** `docs/superpowers/specs/2026-04-13-financial-bi-dashboard-design.md`

---

## Task 1: Install Dependencies & Add Prisma Model

**Files:**
- Modify: `package.json`
- Modify: `prisma/schema.prisma` (after line 357, before Contract model)

- [ ] **Step 1: Install new packages**

```bash
npm install json-rules-engine @react-pdf/renderer exceljs
```

- [ ] **Step 2: Add CfoInsight model to Prisma schema**

Add after the Payment model (line 357) in `prisma/schema.prisma`:

```prisma
model CfoInsight {
  id              String   @id @default(cuid())
  briefing        String   @db.Text
  recommendations String   @db.Text
  dataSnapshot    String   @db.Text
  dateRange       String
  generatedAt     DateTime @default(now())
  createdAt       DateTime @default(now())

  @@map("cfo_insights")
}
```

- [ ] **Step 3: Generate Prisma client and push schema**

```bash
npm run db:generate
npm run db:push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 4: Add route to middleware**

In `middleware.ts`, add after the `/dashboard/analytics` entry (line 32):

```typescript
{ prefix: "/dashboard/financial", roles: ["ADMIN", "OPERATIONAL", "FINANCE", "SALES"] },
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json prisma/schema.prisma middleware.ts
git commit -m "feat: add dependencies and CfoInsight model for financial BI dashboard"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `lib/types/financial-bi.ts`

- [ ] **Step 1: Create the shared types file**

```typescript
// lib/types/financial-bi.ts

export interface KPIMetric {
  value: number;
  prevValue: number;
  changePct: number;
  context: string;
  contextLevel: "good" | "warning" | "danger";
}

export interface ConcentrationMetric extends KPIMetric {
  topClients: Array<{ name: string; percentage: number }>;
}

export interface CfoAction {
  severity: "URGENT" | "WATCH" | "INSIGHT";
  title: string;
  description: string;
  linkedEntity?: { type: "invoice" | "customer"; id: string };
}

export interface CfoInsightData {
  briefing: string;
  generatedAt: string;
  actions: CfoAction[];
}

export interface FinancialBISummary {
  revenue: KPIMetric;
  collectionRate: KPIMetric;
  outstandingAR: KPIMetric;
  mrr: KPIMetric;
  topClientConcentration: ConcentrationMetric;
  revenueTrendMini: Array<{ month: string; amount: number }>;
  agingSnapshotMini: Array<{ bucket: string; amount: number; count: number }>;
}

export interface RevenueGrowthData {
  invoicedVsCollected: Array<{ month: string; invoiced: number; collected: number }>;
  revenueByService: Array<{ service: string; amount: number }>;
  mrrTrend: Array<{ month: string; mrr: number; arr: number }>;
  momGrowth: Array<{ month: string; growthPct: number }>;
}

export interface ArCollectionsData {
  agingBreakdown: Array<{ bucket: string; count: number; amount: number }>;
  collectionPerformance: Array<{ month: string; avgDaysToPayment: number; collectionRate: number }>;
  overdueInvoices: OverdueInvoiceRow[];
}

export interface OverdueInvoiceRow {
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
}

export interface CashFlowData {
  forecast: Array<{ date: string; optimistic: number; expected: number; conservative: number }>;
  probabilityBreakdown: Array<{ segment: string; amount: number; count: number }>;
  atRiskInvoices: AtRiskInvoiceRow[];
}

export interface AtRiskInvoiceRow {
  id: string;
  customerName: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
  probability: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  lastAction: string;
}

export interface CustomerAnalysisData {
  concentration: Array<{ customer: string; revenue: number; cumulativePct: number }>;
  topCustomers: Array<{ customer: string; totalPaid: number }>;
  segments: Array<{ segment: string; count: number; revenue: number }>;
  ltv: {
    average: number;
    median: number;
    trend: Array<{ month: string; value: number }>;
  };
}

export interface FinancialBIResponse {
  summary: FinancialBISummary;
  cfoInsight: CfoInsightData;
  revenueGrowth?: RevenueGrowthData;
  arCollections?: ArCollectionsData;
  cashFlow?: CashFlowData;
  customerAnalysis?: CustomerAnalysisData;
  meta: {
    lastQbSync: string;
    dateRange: { from: string; to: string };
    generatedAt: string;
  };
}

export type TabParam = "all" | "revenue" | "ar" | "cashflow" | "customers";
export type DateRangeParam = "last7" | "last30" | "last90" | "thisYear" | "allTime" | "custom";
```

- [ ] **Step 2: Commit**

```bash
git add lib/types/financial-bi.ts
git commit -m "feat: add TypeScript types for financial BI dashboard"
```

---

## Task 3: CFO Rule Engine Service

**Files:**
- Create: `lib/services/cfo-rules.ts`

- [ ] **Step 1: Create the rule engine service**

```typescript
// lib/services/cfo-rules.ts
import { Engine, RuleProperties } from "json-rules-engine";
import { CfoAction } from "@/lib/types/financial-bi";

// Facts interface — what the engine evaluates
export interface CfoFacts {
  collectionRate: number;
  prevCollectionRate: number;
  collectionRateChange: number;
  outstandingAR: number;
  topThreeConcentration: number;
  topThreeClients: Array<{ name: string; percentage: number }>;
  overdueInvoices: Array<{
    id: string;
    customerName: string;
    amount: number;
    daysOverdue: number;
    remindersSent: number;
    autoChargeStatus: string | null;
  }>;
  customerPaymentTrends: Array<{
    customerName: string;
    customerId: string;
    currentAvgDays: number;
    previousAvgDays: number;
    consecutiveSlowing: number;
  }>;
  thirtyDayCashProjection: number;
  aging90PlusAmount: number;
  prevAging90PlusAmount: number;
}

const rules: RuleProperties[] = [
  {
    name: "collection-rate-drop",
    priority: 10,
    conditions: {
      all: [
        { fact: "collectionRateChange", operator: "lessThan", value: -3 },
      ],
    },
    event: {
      type: "WATCH",
      params: { rule: "collection-rate-drop" },
    },
  },
  {
    name: "revenue-concentration-high",
    priority: 5,
    conditions: {
      all: [
        { fact: "topThreeConcentration", operator: "greaterThan", value: 40 },
      ],
    },
    event: {
      type: "INSIGHT",
      params: { rule: "revenue-concentration-high" },
    },
  },
  {
    name: "cash-position-tight",
    priority: 10,
    conditions: {
      all: [
        { fact: "thirtyDayCashProjection", operator: "lessThan", value: 0 },
      ],
    },
    event: {
      type: "URGENT",
      params: { rule: "cash-position-tight" },
    },
  },
  {
    name: "aging-90-plus-growing",
    priority: 6,
    conditions: {
      all: [
        { fact: "aging90PlusAmount", operator: "greaterThan", value: 0 },
      ],
    },
    event: {
      type: "WATCH",
      params: { rule: "aging-90-plus-growing" },
    },
  },
];

function buildInvoiceActions(facts: CfoFacts): CfoAction[] {
  const actions: CfoAction[] = [];

  for (const inv of facts.overdueInvoices) {
    if (inv.daysOverdue > 45) {
      actions.push({
        severity: "URGENT",
        title: `Escalate ${inv.customerName}`,
        description: `$${inv.amount.toLocaleString()} outstanding, ${inv.daysOverdue} days overdue. ${inv.remindersSent} reminders sent.${inv.autoChargeStatus === "FAILED" ? " Auto-charge failed — card declined." : ""}`,
        linkedEntity: { type: "invoice", id: inv.id },
      });
    }

    if (inv.amount >= 5000 && inv.daysOverdue > 30 && inv.daysOverdue <= 45) {
      actions.push({
        severity: "URGENT",
        title: `High-value invoice at risk — ${inv.customerName}`,
        description: `$${inv.amount.toLocaleString()} invoice, ${inv.daysOverdue} days overdue. Needs immediate follow-up.`,
        linkedEntity: { type: "invoice", id: inv.id },
      });
    }
  }

  for (const trend of facts.customerPaymentTrends) {
    if (trend.consecutiveSlowing >= 3) {
      actions.push({
        severity: "WATCH",
        title: `${trend.customerName} payment pattern degrading`,
        description: `Average days-to-pay increased from ${trend.previousAvgDays} to ${trend.currentAvgDays} days over 3+ consecutive months.`,
        linkedEntity: { type: "customer", id: trend.customerId },
      });
    }
  }

  return actions;
}

function buildRuleActions(events: Array<{ type: string; params: { rule: string } }>, facts: CfoFacts): CfoAction[] {
  const actions: CfoAction[] = [];

  for (const event of events) {
    switch (event.params.rule) {
      case "collection-rate-drop":
        actions.push({
          severity: "WATCH",
          title: "Collection rate declining",
          description: `Collection rate dropped ${Math.abs(facts.collectionRateChange).toFixed(1)}% to ${facts.collectionRate.toFixed(1)}% (was ${facts.prevCollectionRate.toFixed(1)}%).`,
        });
        break;
      case "revenue-concentration-high": {
        const top3 = facts.topThreeClients.map((c) => `${c.name} (${c.percentage.toFixed(0)}%)`).join(", ");
        actions.push({
          severity: "INSIGHT",
          title: "Revenue concentration risk",
          description: `Top 3 clients represent ${facts.topThreeConcentration.toFixed(0)}% of revenue: ${top3}. Consider diversification strategies.`,
        });
        break;
      }
      case "cash-position-tight":
        actions.push({
          severity: "URGENT",
          title: "Cash shortfall projected",
          description: `30-day cash projection is negative ($${facts.thirtyDayCashProjection.toLocaleString()}). Accelerate collections on outstanding invoices.`,
        });
        break;
      case "aging-90-plus-growing": {
        const growth = facts.prevAging90PlusAmount > 0
          ? ((facts.aging90PlusAmount - facts.prevAging90PlusAmount) / facts.prevAging90PlusAmount * 100)
          : 100;
        if (growth > 10) {
          actions.push({
            severity: "WATCH",
            title: "Stale receivables growing",
            description: `AR 90+ days is $${facts.aging90PlusAmount.toLocaleString()}, up ${growth.toFixed(0)}% vs prior period. Review for potential write-offs.`,
          });
        }
        break;
      }
    }
  }

  return actions;
}

export async function evaluateCfoRules(facts: CfoFacts): Promise<CfoAction[]> {
  const engine = new Engine();

  for (const rule of rules) {
    engine.addRule(rule);
  }

  const { events } = await engine.run(facts);

  const ruleActions = buildRuleActions(
    events as Array<{ type: string; params: { rule: string } }>,
    facts,
  );
  const invoiceActions = buildInvoiceActions(facts);

  // Combine and sort: URGENT first, then WATCH, then INSIGHT. Max 5.
  const allActions = [...ruleActions, ...invoiceActions];
  const severityOrder = { URGENT: 0, WATCH: 1, INSIGHT: 2 };
  allActions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return allActions.slice(0, 5);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/services/cfo-rules.ts
git commit -m "feat: add CFO rule engine service with json-rules-engine"
```

---

## Task 4: CFO AI Analysis Service

**Files:**
- Create: `lib/services/cfo-analysis.ts`

- [ ] **Step 1: Create the AI analysis service**

This follows the same OpenAI pattern from `lib/services/ai.service.ts` (lines 8-13 for client setup, lines 251-259 for JSON response pattern).

```typescript
// lib/services/cfo-analysis.ts
import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { integrationLogger } from "@/lib/utils/logger";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const AI_MODEL = process.env.AI_MODEL || "gpt-4-turbo-preview";

export interface CfoAnalysisInput {
  revenue: number;
  revenueChangePct: number;
  collectionRate: number;
  prevCollectionRate: number;
  outstandingAR: number;
  mrr: number;
  topThreeConcentration: number;
  topThreeClients: Array<{ name: string; percentage: number }>;
  overdueCount: number;
  overdueTotal: number;
  worstOverdue: { customer: string; amount: number; days: number } | null;
  aging90Plus: number;
  cashProjection30Day: number;
  patternAlerts: string[];
  dateRangeLabel: string;
}

interface AiCfoResponse {
  briefing: string;
  recommendations: string[];
}

const SYSTEM_PROMPT = `You are a Fractional CFO analyzing financial data for Carreira U.S.A., an immigration services and mentorship company based in the US. Write a concise executive briefing (3-5 sentences) and 2-3 strategic recommendations.

Rules:
- Be specific — reference actual customer names, dollar amounts, and percentages from the data provided
- Write for a CEO who has 30 seconds to read this
- Focus on what changed, what's at risk, and what to do about it
- Do NOT use generic advice — every recommendation must tie to the specific numbers
- Respond in valid JSON with keys "briefing" (string) and "recommendations" (array of strings)`;

export async function generateCfoAnalysis(input: CfoAnalysisInput): Promise<{ briefing: string; recommendations: string[] }> {
  const top3Text = input.topThreeClients
    .map((c) => `${c.name} (${c.percentage.toFixed(0)}%)`)
    .join(", ");

  const userPrompt = `Financial data for ${input.dateRangeLabel}:
- Revenue: $${input.revenue.toLocaleString()} (${input.revenueChangePct >= 0 ? "+" : ""}${input.revenueChangePct.toFixed(1)}% vs prior period)
- Collection rate: ${input.collectionRate.toFixed(1)}% (was ${input.prevCollectionRate.toFixed(1)}%)
- Outstanding AR: $${input.outstandingAR.toLocaleString()}
- MRR: $${input.mrr.toLocaleString()}
- Top 3 client concentration: ${input.topThreeConcentration.toFixed(0)}% (${top3Text})
- Overdue invoices: ${input.overdueCount} totaling $${input.overdueTotal.toLocaleString()}
${input.worstOverdue ? `- Worst overdue: ${input.worstOverdue.customer} — $${input.worstOverdue.amount.toLocaleString()}, ${input.worstOverdue.days} days` : "- No severely overdue invoices"}
- AR aging 90+ days: $${input.aging90Plus.toLocaleString()}
- Cash flow 30-day projection: $${input.cashProjection30Day.toLocaleString()}
${input.patternAlerts.length > 0 ? `- Payment pattern alerts: ${input.patternAlerts.join("; ")}` : "- No payment pattern alerts"}

Write the briefing and recommendations as JSON.`;

  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 800,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content || "{}";
    const parsed: AiCfoResponse = JSON.parse(content);

    return {
      briefing: parsed.briefing || "Analysis unavailable.",
      recommendations: parsed.recommendations || [],
    };
  } catch (error) {
    integrationLogger.error("CFO_ANALYSIS", "generate", error);
    return {
      briefing: "AI analysis temporarily unavailable. Rule-based insights are shown below.",
      recommendations: [],
    };
  }
}

export async function generateAndCacheCfoInsight(dateRange: string): Promise<void> {
  // This function is called by the cron job.
  // It queries financial data, generates AI analysis, and caches the result.
  // The actual data fetching is done by financial-bi.ts — import from there.
  const { getFinancialKPIs } = await import("@/lib/services/financial-bi");

  const kpis = await getFinancialKPIs(dateRange);

  const result = await generateCfoAnalysis(kpis);

  // Delete old insights for this date range, keep last 30
  await prisma.cfoInsight.deleteMany({
    where: {
      dateRange,
      createdAt: {
        lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    },
  });

  await prisma.cfoInsight.create({
    data: {
      briefing: result.briefing,
      recommendations: JSON.stringify(result.recommendations),
      dataSnapshot: JSON.stringify(kpis),
      dateRange,
    },
  });
}

export async function getCachedCfoInsight(dateRange: string): Promise<{ briefing: string; recommendations: string[]; generatedAt: string } | null> {
  const insight = await prisma.cfoInsight.findFirst({
    where: { dateRange },
    orderBy: { generatedAt: "desc" },
  });

  if (!insight) return null;

  return {
    briefing: insight.briefing,
    recommendations: JSON.parse(insight.recommendations),
    generatedAt: insight.generatedAt.toISOString(),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/services/cfo-analysis.ts
git commit -m "feat: add CFO AI analysis service with OpenAI integration and caching"
```

---

## Task 5: Financial BI Data Aggregation Service

**Files:**
- Create: `lib/services/financial-bi.ts`

- [ ] **Step 1: Create the data aggregation service**

This is the core service that queries all financial data using the same Prisma patterns from `app/api/analytics/bi-dashboard/route.ts` (parallel Promise.all, groupBy, aggregate).

```typescript
// lib/services/financial-bi.ts
import { prisma } from "@/lib/db";
import { InvoiceStatus } from "@prisma/client";
import { startOfMonth, subMonths, subDays, startOfYear, format, differenceInDays } from "date-fns";
import { evaluateCfoRules, CfoFacts } from "@/lib/services/cfo-rules";
import { getCachedCfoInsight, CfoAnalysisInput } from "@/lib/services/cfo-analysis";
import {
  FinancialBIResponse,
  KPIMetric,
  TabParam,
  DateRangeParam,
  RevenueGrowthData,
  ArCollectionsData,
  CashFlowData,
  CustomerAnalysisData,
} from "@/lib/types/financial-bi";

// ── Date range helpers ──────────────────────────────────────

function getDateRange(dateRange: DateRangeParam, from?: string, to?: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  const endDate = to ? new Date(to) : now;

  switch (dateRange) {
    case "last7":
      return { startDate: subDays(now, 7), endDate };
    case "last30":
      return { startDate: subDays(now, 30), endDate };
    case "last90":
      return { startDate: subDays(now, 90), endDate };
    case "thisYear":
      return { startDate: startOfYear(now), endDate };
    case "custom":
      return { startDate: from ? new Date(from) : subDays(now, 30), endDate };
    case "allTime":
    default:
      return { startDate: new Date("2020-01-01"), endDate };
  }
}

function getPreviousPeriod(startDate: Date, endDate: Date): { startDate: Date; endDate: Date } {
  const days = differenceInDays(endDate, startDate);
  return {
    startDate: subDays(startDate, days),
    endDate: subDays(startDate, 1),
  };
}

function buildKpiMetric(value: number, prevValue: number, thresholds?: { warningPct?: number; dangerPct?: number; invertDirection?: boolean }): KPIMetric {
  const changePct = prevValue > 0 ? ((value - prevValue) / prevValue) * 100 : 0;
  const opts = { warningPct: 5, dangerPct: 15, invertDirection: false, ...thresholds };

  let contextLevel: "good" | "warning" | "danger" = "good";
  let context = "healthy";

  // For metrics where a decrease is bad (revenue, collection rate)
  if (!opts.invertDirection) {
    if (changePct < -opts.dangerPct) { contextLevel = "danger"; context = "critical"; }
    else if (changePct < -opts.warningPct) { contextLevel = "warning"; context = "needs attention"; }
  } else {
    // For metrics where an increase is bad (outstanding AR, concentration)
    if (changePct > opts.dangerPct) { contextLevel = "danger"; context = "critical"; }
    else if (changePct > opts.warningPct) { contextLevel = "warning"; context = "needs attention"; }
  }

  return { value, prevValue, changePct, context, contextLevel };
}

// ── Core summary queries ────────────────────────────────────

async function querySummary(startDate: Date, endDate: Date, prevStart: Date, prevEnd: Date) {
  const dateFilter = { gte: startDate, lte: endDate };
  const prevDateFilter = { gte: prevStart, lte: prevEnd };

  const [
    // Current period
    paidAgg,
    invoicedAgg,
    outstandingAgg,
    // Previous period
    prevPaidAgg,
    prevInvoicedAgg,
    prevOutstandingAgg,
    // Revenue trend (12 months)
    revenueTrend,
    // Aging
    agingInvoices,
    // Top customers
    topCustomerPayments,
    // QB sync status
    systemConfig,
  ] = await Promise.all([
    prisma.invoice.aggregate({
      where: { status: "PAID", paidAt: dateFilter },
      _sum: { amountPaid: true },
    }),
    prisma.invoice.aggregate({
      where: { createdAt: dateFilter, status: { not: "VOID" } },
      _sum: { amount: true },
    }),
    prisma.invoice.aggregate({
      where: { status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] } },
      _sum: { amount: true },
    }),
    prisma.invoice.aggregate({
      where: { status: "PAID", paidAt: prevDateFilter },
      _sum: { amountPaid: true },
    }),
    prisma.invoice.aggregate({
      where: { createdAt: prevDateFilter, status: { not: "VOID" } },
      _sum: { amount: true },
    }),
    prisma.invoice.aggregate({
      where: {
        status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] },
        createdAt: { lte: prevEnd },
      },
      _sum: { amount: true },
    }),
    // Revenue last 12 months
    prisma.payment.findMany({
      where: { paymentDate: { gte: subMonths(new Date(), 12) } },
      select: { paymentDate: true, amount: true },
    }),
    // All outstanding invoices for aging
    prisma.invoice.findMany({
      where: { status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] } },
      select: { id: true, amount: true, dueDate: true, customerId: true },
    }),
    // Top customers by paid amount
    prisma.payment.groupBy({
      by: ["customerId"],
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 10,
    }),
    // Last QB sync
    prisma.systemConfig.findUnique({ where: { id: "system" }, select: { lastQuickbooksSyncAt: true } }),
  ]);

  const revenue = Number(paidAgg._sum.amountPaid || 0);
  const prevRevenue = Number(prevPaidAgg._sum.amountPaid || 0);
  const totalInvoiced = Number(invoicedAgg._sum.amount || 0);
  const prevTotalInvoiced = Number(prevInvoicedAgg._sum.amount || 0);
  const outstanding = Number(outstandingAgg._sum.amount || 0);
  const prevOutstanding = Number(prevOutstandingAgg._sum.amount || 0);

  const collectionRate = totalInvoiced > 0 ? (revenue / totalInvoiced) * 100 : 0;
  const prevCollectionRate = prevTotalInvoiced > 0 ? (prevRevenue / prevTotalInvoiced) * 100 : 0;

  // MRR: average monthly collected revenue over last 3 months
  const threeMonthsAgo = subMonths(new Date(), 3);
  const recentPayments = revenueTrend.filter((p) => p.paymentDate >= threeMonthsAgo);
  const recentTotal = recentPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const mrr = recentTotal / 3;
  // Prev MRR: 3 months before that
  const sixMonthsAgo = subMonths(new Date(), 6);
  const prevRecentPayments = revenueTrend.filter((p) => p.paymentDate >= sixMonthsAgo && p.paymentDate < threeMonthsAgo);
  const prevRecentTotal = prevRecentPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const prevMrr = prevRecentTotal / 3;

  // Revenue trend mini (12 months)
  const monthlyRevenue = new Map<string, number>();
  for (const p of revenueTrend) {
    const key = format(p.paymentDate, "yyyy-MM");
    monthlyRevenue.set(key, (monthlyRevenue.get(key) || 0) + Number(p.amount));
  }
  const revenueTrendMini = Array.from(monthlyRevenue.entries())
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Aging snapshot
  const now = new Date();
  const agingBuckets = [
    { bucket: "Current", min: -Infinity, max: 0 },
    { bucket: "1-30", min: 1, max: 30 },
    { bucket: "31-60", min: 31, max: 60 },
    { bucket: "61-90", min: 61, max: 90 },
    { bucket: "90+", min: 91, max: Infinity },
  ];

  const agingSnapshotMini = agingBuckets.map(({ bucket, min, max }) => {
    const matching = agingInvoices.filter((inv) => {
      const days = differenceInDays(now, inv.dueDate);
      return days >= min && days <= max;
    });
    return {
      bucket,
      amount: matching.reduce((sum, inv) => sum + Number(inv.amount), 0),
      count: matching.length,
    };
  });

  // Concentration
  const totalPaidAllTime = topCustomerPayments.reduce((sum, g) => sum + Number(g._sum.amount || 0), 0);
  const customerIds = topCustomerPayments.slice(0, 3).map((g) => g.customerId);
  const topThreeTotal = topCustomerPayments.slice(0, 3).reduce((sum, g) => sum + Number(g._sum.amount || 0), 0);
  const concentration = totalPaidAllTime > 0 ? (topThreeTotal / totalPaidAllTime) * 100 : 0;

  // Get customer names for top 3
  const topCustomerNames = customerIds.length > 0
    ? await prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameMap = new Map(topCustomerNames.map((c) => [c.id, c.name]));
  const topClients = topCustomerPayments.slice(0, 3).map((g) => ({
    name: nameMap.get(g.customerId) || "Unknown",
    percentage: totalPaidAllTime > 0 ? (Number(g._sum.amount || 0) / totalPaidAllTime) * 100 : 0,
  }));

  return {
    revenue: buildKpiMetric(revenue, prevRevenue),
    collectionRate: buildKpiMetric(collectionRate, prevCollectionRate),
    outstandingAR: buildKpiMetric(outstanding, prevOutstanding, { invertDirection: true }),
    mrr: buildKpiMetric(mrr, prevMrr),
    topClientConcentration: {
      ...buildKpiMetric(concentration, concentration, { invertDirection: true, warningPct: 40, dangerPct: 50 }),
      topClients,
    },
    revenueTrendMini,
    agingSnapshotMini,
    // Raw values for rule engine
    _raw: {
      collectionRate,
      prevCollectionRate,
      collectionRateChange: collectionRate - prevCollectionRate,
      outstandingAR: outstanding,
      topThreeConcentration: concentration,
      topThreeClients: topClients,
      aging90PlusAmount: agingSnapshotMini.find((b) => b.bucket === "90+")?.amount || 0,
      prevAging90PlusAmount: 0, // Will be compared in rule engine
      thirtyDayCashProjection: 0, // Calculated in cash flow tab
      totalInvoiced,
      revenue,
      revenueChangePct: prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0,
      mrr,
      agingInvoices,
    },
    _lastQbSync: systemConfig?.lastQuickbooksSyncAt?.toISOString() || null,
  };
}

// ── Tab-specific queries ────────────────────────────────────

async function queryRevenueGrowth(startDate: Date, endDate: Date): Promise<RevenueGrowthData> {
  const payments = await prisma.payment.findMany({
    where: { paymentDate: { gte: subMonths(new Date(), 12) } },
    select: { paymentDate: true, amount: true },
  });

  const invoices = await prisma.invoice.findMany({
    where: { createdAt: { gte: subMonths(new Date(), 12) }, status: { not: "VOID" } },
    select: { createdAt: true, amount: true, lineItems: true, status: true, amountPaid: true, paidAt: true },
  });

  // Invoiced vs Collected by month
  const invoicedByMonth = new Map<string, number>();
  const collectedByMonth = new Map<string, number>();

  for (const inv of invoices) {
    const month = format(inv.createdAt, "yyyy-MM");
    invoicedByMonth.set(month, (invoicedByMonth.get(month) || 0) + Number(inv.amount));
  }
  for (const p of payments) {
    const month = format(p.paymentDate, "yyyy-MM");
    collectedByMonth.set(month, (collectedByMonth.get(month) || 0) + Number(p.amount));
  }

  const allMonths = new Set([...invoicedByMonth.keys(), ...collectedByMonth.keys()]);
  const invoicedVsCollected = Array.from(allMonths)
    .sort()
    .map((month) => ({
      month,
      invoiced: invoicedByMonth.get(month) || 0,
      collected: collectedByMonth.get(month) || 0,
    }));

  // Revenue by service (from lineItems JSON)
  const serviceRevenue = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.lineItems && Array.isArray(inv.lineItems)) {
      for (const item of inv.lineItems as Array<{ description?: string; name?: string; amount?: number }>) {
        const name = item.description || item.name || "Other";
        serviceRevenue.set(name, (serviceRevenue.get(name) || 0) + Number(item.amount || 0));
      }
    }
  }
  const revenueByService = Array.from(serviceRevenue.entries())
    .map(([service, amount]) => ({ service, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // MRR trend
  const mrrTrend = invoicedVsCollected.map((m) => ({
    month: m.month,
    mrr: m.collected,
    arr: m.collected * 12,
  }));

  // MoM growth
  const momGrowth = invoicedVsCollected.map((m, i) => {
    const prev = i > 0 ? invoicedVsCollected[i - 1].collected : 0;
    const growthPct = prev > 0 ? ((m.collected - prev) / prev) * 100 : 0;
    return { month: m.month, growthPct };
  });

  return { invoicedVsCollected, revenueByService, mrrTrend, momGrowth };
}

async function queryArCollections(startDate: Date, endDate: Date): Promise<ArCollectionsData> {
  const now = new Date();

  const [overdueInvoicesRaw, paidInvoices] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: { in: ["OVERDUE", "SENT", "PARTIALLY_PAID"] } },
      include: {
        customer: { select: { name: true } },
        owner: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.invoice.findMany({
      where: { status: "PAID", paidAt: { gte: subMonths(now, 12) } },
      select: { createdAt: true, paidAt: true, amount: true, amountPaid: true },
    }),
  ]);

  // Aging breakdown
  const agingBuckets = [
    { bucket: "Current", min: -Infinity, max: 0 },
    { bucket: "1-30", min: 1, max: 30 },
    { bucket: "31-60", min: 31, max: 60 },
    { bucket: "61-90", min: 61, max: 90 },
    { bucket: "90+", min: 91, max: Infinity },
  ];

  const agingBreakdown = agingBuckets.map(({ bucket, min, max }) => {
    const matching = overdueInvoicesRaw.filter((inv) => {
      const days = differenceInDays(now, inv.dueDate);
      return days >= min && days <= max;
    });
    return {
      bucket,
      count: matching.length,
      amount: matching.reduce((sum, inv) => sum + Number(inv.amount), 0),
    };
  });

  // Collection performance by month
  const monthlyPerformance = new Map<string, { totalDays: number; count: number; paid: number; invoiced: number }>();
  for (const inv of paidInvoices) {
    if (!inv.paidAt) continue;
    const month = format(inv.paidAt, "yyyy-MM");
    const days = differenceInDays(inv.paidAt, inv.createdAt);
    const existing = monthlyPerformance.get(month) || { totalDays: 0, count: 0, paid: 0, invoiced: 0 };
    existing.totalDays += days;
    existing.count += 1;
    existing.paid += Number(inv.amountPaid || 0);
    existing.invoiced += Number(inv.amount);
    monthlyPerformance.set(month, existing);
  }

  const collectionPerformance = Array.from(monthlyPerformance.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      avgDaysToPayment: data.count > 0 ? Math.round(data.totalDays / data.count) : 0,
      collectionRate: data.invoiced > 0 ? (data.paid / data.invoiced) * 100 : 0,
    }));

  // Overdue invoices table
  const overdueInvoices = overdueInvoicesRaw
    .filter((inv) => differenceInDays(now, inv.dueDate) > 0)
    .map((inv) => ({
      id: inv.id,
      customerName: inv.customer.name,
      invoiceNumber: inv.invoiceNumber || "N/A",
      amount: Number(inv.amount),
      dueDate: inv.dueDate.toISOString(),
      daysOverdue: differenceInDays(now, inv.dueDate),
      remindersSent: inv.paymentReminderCount,
      collectionCalls: inv.collectionCallCount,
      autoChargeStatus: inv.autoChargeStatus,
      ownerName: inv.owner?.name || "Unassigned",
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  return { agingBreakdown, collectionPerformance, overdueInvoices };
}

async function queryCashFlow(): Promise<CashFlowData> {
  const now = new Date();
  const ninetyDaysOut = subDays(now, -90);

  const outstandingInvoices = await prisma.invoice.findMany({
    where: { status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] } },
    include: {
      customer: { select: { name: true, id: true } },
      payments: { select: { paymentDate: true, amount: true } },
    },
  });

  // Simple probability based on days overdue
  function calcProbability(daysOverdue: number): number {
    if (daysOverdue <= 0) return 95;
    if (daysOverdue <= 30) return 80;
    if (daysOverdue <= 60) return 55;
    if (daysOverdue <= 90) return 30;
    if (daysOverdue <= 180) return 15;
    return 5;
  }

  function getRiskLevel(prob: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
    if (prob >= 80) return "LOW";
    if (prob >= 60) return "MEDIUM";
    if (prob >= 40) return "HIGH";
    return "CRITICAL";
  }

  // Forecast: group by week for next 90 days
  const weeks: Array<{ date: string; optimistic: number; expected: number; conservative: number }> = [];
  for (let i = 0; i < 13; i++) {
    const weekStart = subDays(now, -(i * 7));
    const weekEnd = subDays(now, -((i + 1) * 7));
    const weekLabel = format(weekStart, "MMM dd");

    let optimistic = 0;
    let expected = 0;
    let conservative = 0;

    for (const inv of outstandingInvoices) {
      const dueInWeek = inv.dueDate >= weekStart && inv.dueDate < weekEnd;
      if (!dueInWeek && i > 0) continue;
      if (i === 0 && inv.dueDate > weekEnd) continue;

      const amount = Number(inv.amount) - Number(inv.amountPaid || 0);
      if (amount <= 0) continue;

      const daysOverdue = differenceInDays(now, inv.dueDate);
      const prob = calcProbability(daysOverdue) / 100;

      optimistic += amount;
      expected += amount * prob;
      conservative += amount * Math.max(prob - 0.2, 0);
    }

    weeks.push({ date: weekLabel, optimistic, expected, conservative });
  }

  // Probability breakdown (donut chart)
  const segments = { "High (>80%)": { amount: 0, count: 0 }, "Medium (50-80%)": { amount: 0, count: 0 }, "Low (20-50%)": { amount: 0, count: 0 }, "Bad debt (<20%)": { amount: 0, count: 0 } };
  const atRiskList: CashFlowData["atRiskInvoices"] = [];

  for (const inv of outstandingInvoices) {
    const remaining = Number(inv.amount) - Number(inv.amountPaid || 0);
    if (remaining <= 0) continue;

    const daysOverdue = differenceInDays(now, inv.dueDate);
    const prob = calcProbability(daysOverdue);
    const riskLevel = getRiskLevel(prob);

    if (prob >= 80) { segments["High (>80%)"].amount += remaining; segments["High (>80%)"].count++; }
    else if (prob >= 50) { segments["Medium (50-80%)"].amount += remaining; segments["Medium (50-80%)"].count++; }
    else if (prob >= 20) { segments["Low (20-50%)"].amount += remaining; segments["Low (20-50%)"].count++; }
    else { segments["Bad debt (<20%)"].amount += remaining; segments["Bad debt (<20%)"].count++; }

    if (prob < 80) {
      const lastPayment = inv.payments.sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime())[0];
      atRiskList.push({
        id: inv.id,
        customerName: inv.customer.name,
        amount: remaining,
        dueDate: inv.dueDate.toISOString(),
        daysOverdue: Math.max(daysOverdue, 0),
        probability: prob,
        riskLevel,
        lastAction: lastPayment ? `Payment $${Number(lastPayment.amount)} on ${format(lastPayment.paymentDate, "MMM dd")}` : "No payments",
      });
    }
  }

  const probabilityBreakdown = Object.entries(segments).map(([segment, data]) => ({
    segment,
    amount: data.amount,
    count: data.count,
  }));

  const atRiskInvoices = atRiskList.sort((a, b) => a.probability - b.probability);

  return { forecast: weeks, probabilityBreakdown, atRiskInvoices };
}

async function queryCustomerAnalysis(): Promise<CustomerAnalysisData> {
  const now = new Date();

  const [customerPayments, allCustomers] = await Promise.all([
    prisma.payment.groupBy({
      by: ["customerId"],
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
    prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        invoices: {
          select: { createdAt: true, status: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
  ]);

  const customerNames = await prisma.customer.findMany({
    where: { id: { in: customerPayments.map((c) => c.customerId) } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(customerNames.map((c) => [c.id, c.name]));

  // Concentration (Pareto)
  const totalRevenue = customerPayments.reduce((sum, c) => sum + Number(c._sum.amount || 0), 0);
  let cumulative = 0;
  const concentration = customerPayments.map((c) => {
    const rev = Number(c._sum.amount || 0);
    cumulative += rev;
    return {
      customer: nameMap.get(c.customerId) || "Unknown",
      revenue: rev,
      cumulativePct: totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 0,
    };
  });

  // Top 10
  const topCustomers = customerPayments.slice(0, 10).map((c) => ({
    customer: nameMap.get(c.customerId) || "Unknown",
    totalPaid: Number(c._sum.amount || 0),
  }));

  // Segments: active (invoice in 90d), inactive (90-180d), churned (>180d)
  const segmentCounts = { Active: { count: 0, revenue: 0 }, Inactive: { count: 0, revenue: 0 }, Churned: { count: 0, revenue: 0 } };
  const paymentMap = new Map(customerPayments.map((c) => [c.customerId, Number(c._sum.amount || 0)]));

  for (const cust of allCustomers) {
    const lastInvoice = cust.invoices[0];
    const rev = paymentMap.get(cust.id) || 0;

    if (!lastInvoice) {
      segmentCounts.Churned.count++;
      segmentCounts.Churned.revenue += rev;
    } else {
      const daysSince = differenceInDays(now, lastInvoice.createdAt);
      if (daysSince <= 90) { segmentCounts.Active.count++; segmentCounts.Active.revenue += rev; }
      else if (daysSince <= 180) { segmentCounts.Inactive.count++; segmentCounts.Inactive.revenue += rev; }
      else { segmentCounts.Churned.count++; segmentCounts.Churned.revenue += rev; }
    }
  }

  const segments = Object.entries(segmentCounts).map(([segment, data]) => ({
    segment,
    count: data.count,
    revenue: data.revenue,
  }));

  // LTV
  const amounts = customerPayments.map((c) => Number(c._sum.amount || 0)).filter((a) => a > 0);
  const average = amounts.length > 0 ? amounts.reduce((sum, a) => sum + a, 0) / amounts.length : 0;
  const sorted = [...amounts].sort((a, b) => a - b);
  const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;

  return {
    concentration,
    topCustomers,
    segments,
    ltv: { average, median, trend: [] },
  };
}

// ── Public API ──────────────────────────────────────────────

export async function getFinancialKPIs(dateRange: string): Promise<CfoAnalysisInput> {
  const { startDate, endDate } = getDateRange(dateRange as DateRangeParam);
  const prev = getPreviousPeriod(startDate, endDate);
  const summary = await querySummary(startDate, endDate, prev.startDate, prev.endDate);

  const overdueInvoices = await prisma.invoice.findMany({
    where: { status: "OVERDUE" },
    include: { customer: { select: { name: true } } },
    orderBy: { dueDate: "asc" },
    take: 5,
  });

  const worst = overdueInvoices[0];

  return {
    revenue: summary.revenue.value,
    revenueChangePct: summary._raw.revenueChangePct,
    collectionRate: summary._raw.collectionRate,
    prevCollectionRate: summary._raw.prevCollectionRate,
    outstandingAR: summary.outstandingAR.value,
    mrr: summary.mrr.value,
    topThreeConcentration: summary._raw.topThreeConcentration,
    topThreeClients: summary._raw.topThreeClients,
    overdueCount: overdueInvoices.length,
    overdueTotal: overdueInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0),
    worstOverdue: worst
      ? { customer: worst.customer.name, amount: Number(worst.amount), days: differenceInDays(new Date(), worst.dueDate) }
      : null,
    aging90Plus: summary._raw.aging90PlusAmount,
    cashProjection30Day: summary._raw.thirtyDayCashProjection,
    patternAlerts: [],
    dateRangeLabel: dateRange,
  };
}

export async function getFinancialBIData(
  dateRange: DateRangeParam,
  from?: string,
  to?: string,
  tab: TabParam = "all",
): Promise<FinancialBIResponse> {
  const { startDate, endDate } = getDateRange(dateRange, from, to);
  const prev = getPreviousPeriod(startDate, endDate);

  // Always fetch summary
  const summaryRaw = await querySummary(startDate, endDate, prev.startDate, prev.endDate);

  // Get overdue invoices for rule engine
  const overdueForRules = await prisma.invoice.findMany({
    where: { status: "OVERDUE" },
    include: { customer: { select: { name: true } } },
  });

  // Build rule engine facts
  const facts: CfoFacts = {
    collectionRate: summaryRaw._raw.collectionRate,
    prevCollectionRate: summaryRaw._raw.prevCollectionRate,
    collectionRateChange: summaryRaw._raw.collectionRateChange,
    outstandingAR: summaryRaw.outstandingAR.value,
    topThreeConcentration: summaryRaw._raw.topThreeConcentration,
    topThreeClients: summaryRaw._raw.topThreeClients,
    overdueInvoices: overdueForRules.map((inv) => ({
      id: inv.id,
      customerName: inv.customer.name,
      amount: Number(inv.amount),
      daysOverdue: differenceInDays(new Date(), inv.dueDate),
      remindersSent: inv.paymentReminderCount,
      autoChargeStatus: inv.autoChargeStatus,
    })),
    customerPaymentTrends: [], // TODO: calculate from payment history in a future enhancement
    thirtyDayCashProjection: summaryRaw._raw.thirtyDayCashProjection,
    aging90PlusAmount: summaryRaw._raw.aging90PlusAmount,
    prevAging90PlusAmount: summaryRaw._raw.prevAging90PlusAmount,
  };

  const [actions, cachedInsight] = await Promise.all([
    evaluateCfoRules(facts),
    getCachedCfoInsight(dateRange),
  ]);

  // Fetch tab data in parallel
  const tabQueries: Promise<unknown>[] = [];
  const tabKeys: string[] = [];

  if (tab === "all" || tab === "revenue") {
    tabQueries.push(queryRevenueGrowth(startDate, endDate));
    tabKeys.push("revenueGrowth");
  }
  if (tab === "all" || tab === "ar") {
    tabQueries.push(queryArCollections(startDate, endDate));
    tabKeys.push("arCollections");
  }
  if (tab === "all" || tab === "cashflow") {
    tabQueries.push(queryCashFlow());
    tabKeys.push("cashFlow");
  }
  if (tab === "all" || tab === "customers") {
    tabQueries.push(queryCustomerAnalysis());
    tabKeys.push("customerAnalysis");
  }

  const tabResults = await Promise.all(tabQueries);
  const tabData: Record<string, unknown> = {};
  tabKeys.forEach((key, i) => {
    tabData[key] = tabResults[i];
  });

  // Strip internal _raw fields from summary
  const { _raw, _lastQbSync, ...summary } = summaryRaw;

  return {
    summary,
    cfoInsight: {
      briefing: cachedInsight?.briefing || "AI analysis will be available after the next scheduled run.",
      generatedAt: cachedInsight?.generatedAt || new Date().toISOString(),
      actions,
    },
    ...tabData,
    meta: {
      lastQbSync: _lastQbSync || "Never",
      dateRange: { from: startDate.toISOString(), to: endDate.toISOString() },
      generatedAt: new Date().toISOString(),
    },
  } as FinancialBIResponse;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/services/financial-bi.ts
git commit -m "feat: add financial BI data aggregation service"
```

---

## Task 6: API Endpoint — Financial BI Data

**Files:**
- Create: `app/api/analytics/financial-bi/route.ts`

- [ ] **Step 1: Create the unified API endpoint**

Follows the auth pattern from `app/api/analytics/bi-dashboard/route.ts` (lines 1-32).

```typescript
// app/api/analytics/financial-bi/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFinancialBIData } from "@/lib/services/financial-bi";
import { DateRangeParam, TabParam } from "@/lib/types/financial-bi";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateRange = (searchParams.get("dateRange") || "last30") as DateRangeParam;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const tab = (searchParams.get("tab") || "all") as TabParam;

    const data = await getFinancialBIData(dateRange, from, to, tab);

    return NextResponse.json(data);
  } catch (error) {
    console.error("[FINANCIAL-BI] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch financial BI data" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/analytics/financial-bi/route.ts
git commit -m "feat: add unified financial BI API endpoint"
```

---

## Task 7: CFO Analysis Cron Job

**Files:**
- Create: `app/api/cron/cfo-analysis/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create cron route**

```typescript
// app/api/cron/cfo-analysis/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generateAndCacheCfoInsight } from "@/lib/services/cfo-analysis";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret in production
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Generate insights for common date ranges
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

- [ ] **Step 2: Add cron to vercel.json**

Add to the `crons` array in `vercel.json`:

```json
{
  "path": "/api/cron/cfo-analysis",
  "schedule": "0 8 * * *"
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/cfo-analysis/route.ts vercel.json
git commit -m "feat: add daily CFO analysis cron job"
```

---

## Task 8: Dashboard Page — Executive Summary Components

**Files:**
- Create: `components/financial/CfoBriefing.tsx`
- Create: `components/financial/CfoActionItems.tsx`
- Create: `components/financial/FinancialKpiRow.tsx`
- Create: `components/financial/MiniChartRow.tsx`

- [ ] **Step 1: Create CfoBriefing component**

```typescript
// components/financial/CfoBriefing.tsx
"use client";

import { CfoInsightData } from "@/lib/types/financial-bi";

interface CfoBriefingProps {
  insight: CfoInsightData;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function CfoBriefing({ insight, onRefresh, isRefreshing }: CfoBriefingProps) {
  return (
    <div className="rounded-xl bg-gradient-to-r from-gray-900 to-gray-800 p-5 text-white">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-tangerina text-sm">
            🧠
          </div>
          <span className="text-sm font-bold">CFO Briefing</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            Generated {new Date(insight.generatedAt).toLocaleDateString()}
          </span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="rounded-md bg-gray-700 px-3 py-1 text-xs text-gray-300 transition hover:bg-gray-600 disabled:opacity-50"
            >
              {isRefreshing ? "Generating..." : "Refresh Analysis"}
            </button>
          )}
        </div>
      </div>
      <p className="text-sm leading-relaxed text-gray-200">{insight.briefing}</p>
    </div>
  );
}
```

- [ ] **Step 2: Create CfoActionItems component**

```typescript
// components/financial/CfoActionItems.tsx
"use client";

import { CfoAction } from "@/lib/types/financial-bi";
import Link from "next/link";

interface CfoActionItemsProps {
  actions: CfoAction[];
}

const severityConfig = {
  URGENT: { bg: "bg-red-50", border: "border-l-red-500", label: "URGENT", labelColor: "text-red-600" },
  WATCH: { bg: "bg-amber-50", border: "border-l-amber-500", label: "WATCH", labelColor: "text-amber-600" },
  INSIGHT: { bg: "bg-blue-50", border: "border-l-blue-500", label: "INSIGHT", labelColor: "text-blue-600" },
};

export function CfoActionItems({ actions }: CfoActionItemsProps) {
  if (actions.length === 0) return null;

  return (
    <div className="rounded-xl border-2 border-brand-tangerina bg-white p-4">
      <div className="mb-3 text-xs font-bold uppercase tracking-wider text-brand-tangerina">
        Recommended Actions ({actions.length})
      </div>
      <div className="flex flex-col gap-2">
        {actions.map((action, i) => {
          const config = severityConfig[action.severity];
          return (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-md border-l-[3px] ${config.border} ${config.bg} px-3 py-2.5`}
            >
              <span className={`shrink-0 text-[11px] font-bold ${config.labelColor}`}>
                {config.label}
              </span>
              <p className="flex-1 text-xs text-gray-700">{action.description}</p>
              {action.linkedEntity && (
                <Link
                  href={
                    action.linkedEntity.type === "invoice"
                      ? `/dashboard/invoices?id=${action.linkedEntity.id}`
                      : `/dashboard/customers?id=${action.linkedEntity.id}`
                  }
                  className="shrink-0 text-xs font-semibold text-brand-tangerina hover:underline"
                >
                  View →
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create FinancialKpiRow component**

```typescript
// components/financial/FinancialKpiRow.tsx
"use client";

import { KPIMetric, ConcentrationMetric } from "@/lib/types/financial-bi";

interface FinancialKpiRowProps {
  revenue: KPIMetric;
  collectionRate: KPIMetric;
  outstandingAR: KPIMetric;
  mrr: KPIMetric;
  topClientConcentration: ConcentrationMetric;
}

function formatCurrency(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

const levelBorder = {
  good: "border-gray-100",
  warning: "border-amber-200",
  danger: "border-red-200",
};

const levelChangeColor = {
  good: "text-success-600",
  warning: "text-amber-600",
  danger: "text-error-600",
};

function KpiCard({ title, metric, format: fmt }: { title: string; metric: KPIMetric; format: "currency" | "percent" | "percent-concentration" }) {
  const displayValue = fmt === "currency" ? formatCurrency(metric.value) : `${metric.value.toFixed(1)}%`;
  const changePrefix = metric.changePct >= 0 ? "▲" : "▼";

  return (
    <div className={`rounded-lg border bg-white p-3 text-center ${levelBorder[metric.contextLevel]}`}>
      <div className="text-[10px] uppercase text-gray-500">{title}</div>
      <div className="mt-1 text-xl font-extrabold" style={{ color: metric.contextLevel === "danger" ? "var(--error-600)" : metric.contextLevel === "warning" ? "var(--warning-600)" : "var(--success-600)" }}>
        {displayValue}
      </div>
      <div className={`text-[11px] ${levelChangeColor[metric.contextLevel]}`}>
        {changePrefix} {Math.abs(metric.changePct).toFixed(1)}% — {metric.context}
      </div>
    </div>
  );
}

export function FinancialKpiRow(props: FinancialKpiRowProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      <KpiCard title="Revenue (Collected)" metric={props.revenue} format="currency" />
      <KpiCard title="Collection Rate" metric={props.collectionRate} format="percent" />
      <KpiCard title="Outstanding AR" metric={props.outstandingAR} format="currency" />
      <KpiCard title="MRR" metric={props.mrr} format="currency" />
      <KpiCard title="Top 3 Concentration" metric={props.topClientConcentration} format="percent-concentration" />
    </div>
  );
}
```

- [ ] **Step 4: Create MiniChartRow component**

```typescript
// components/financial/MiniChartRow.tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

interface MiniChartRowProps {
  revenueTrend: Array<{ month: string; amount: number }>;
  agingSnapshot: Array<{ bucket: string; amount: number; count: number }>;
}

const agingColors: Record<string, string> = {
  Current: "#22c55e",
  "1-30": "#f59e0b",
  "31-60": "#f97316",
  "61-90": "#ef4444",
  "90+": "#991b1b",
};

function formatK(value: number): string {
  return value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value.toFixed(0)}`;
}

export function MiniChartRow({ revenueTrend, agingSnapshot }: MiniChartRowProps) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {/* Revenue Trend */}
      <div className="rounded-lg bg-gray-50 p-3">
        <div className="mb-2 text-xs font-semibold text-gray-700">Revenue Trend (12 months)</div>
        <ResponsiveContainer width="100%" height={70}>
          <AreaChart data={revenueTrend}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="amount" stroke="#22c55e" fill="url(#revenueGrad)" strokeWidth={2} />
            <Tooltip formatter={(v: number) => formatK(v)} labelFormatter={(l) => l} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* AR Aging Snapshot */}
      <div className="rounded-lg bg-gray-50 p-3">
        <div className="mb-2 text-xs font-semibold text-gray-700">AR Aging Snapshot</div>
        <ResponsiveContainer width="100%" height={70}>
          <BarChart data={agingSnapshot}>
            <XAxis dataKey="bucket" tick={{ fontSize: 9 }} />
            <Bar dataKey="amount" radius={[2, 2, 0, 0]}>
              {agingSnapshot.map((entry, i) => (
                <rect key={i} fill={agingColors[entry.bucket] || "#94a3b8"} />
              ))}
            </Bar>
            <Tooltip formatter={(v: number) => formatK(v)} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add components/financial/CfoBriefing.tsx components/financial/CfoActionItems.tsx components/financial/FinancialKpiRow.tsx components/financial/MiniChartRow.tsx
git commit -m "feat: add executive summary components for financial dashboard"
```

---

## Task 9: Dashboard Page — Tab Components

**Files:**
- Create: `components/financial/tabs/RevenueGrowthTab.tsx`
- Create: `components/financial/tabs/ArCollectionsTab.tsx`
- Create: `components/financial/tabs/CashFlowTab.tsx`
- Create: `components/financial/tabs/CustomerAnalysisTab.tsx`

- [ ] **Step 1: Create RevenueGrowthTab**

```typescript
// components/financial/tabs/RevenueGrowthTab.tsx
"use client";

import { RevenueGrowthData } from "@/lib/types/financial-bi";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, Cell, ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RevenueGrowthTabProps {
  data: RevenueGrowthData;
}

function formatK(value: number): string {
  return value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value.toFixed(0)}`;
}

export function RevenueGrowthTab({ data }: RevenueGrowthTabProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Invoiced vs Collected */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Invoiced vs Collected</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data.invoicedVsCollected}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={formatK} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatK(v)} />
              <Legend />
              <Area type="monotone" dataKey="invoiced" name="Invoiced" stroke="#94a3b8" fill="#f1f5f9" strokeWidth={2} />
              <Area type="monotone" dataKey="collected" name="Collected" stroke="#22c55e" fill="#dcfce7" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Revenue by Service */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Revenue by Service</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.revenueByService} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tickFormatter={formatK} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="service" tick={{ fontSize: 11 }} width={120} />
              <Tooltip formatter={(v: number) => formatK(v)} />
              <Bar dataKey="amount" fill="var(--brand-tangerina)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* MRR/ARR Trend */}
      <Card>
        <CardHeader><CardTitle className="text-sm">MRR / ARR Trend</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.mrrTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={formatK} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatK(v)} />
              <Legend />
              <Line type="monotone" dataKey="mrr" name="MRR" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Month-over-Month Growth */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Month-over-Month Growth</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.momGrowth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
              <ReferenceLine y={0} stroke="#94a3b8" />
              <Bar dataKey="growthPct" name="Growth %">
                {data.momGrowth.map((entry, i) => (
                  <Cell key={i} fill={entry.growthPct >= 0 ? "#22c55e" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Create ArCollectionsTab**

```typescript
// components/financial/tabs/ArCollectionsTab.tsx
"use client";

import { ArCollectionsData } from "@/lib/types/financial-bi";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

interface ArCollectionsTabProps {
  data: ArCollectionsData;
}

const agingColors = ["#22c55e", "#f59e0b", "#f97316", "#ef4444", "#991b1b"];

function formatK(value: number): string {
  return value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value.toFixed(0)}`;
}

export function ArCollectionsTab({ data }: ArCollectionsTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* AR Aging Breakdown */}
        <Card>
          <CardHeader><CardTitle className="text-sm">AR Aging Breakdown</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.agingBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={formatK} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatK(v)} />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {data.agingBreakdown.map((_, i) => (
                    <Cell key={i} fill={agingColors[i] || "#94a3b8"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {/* Summary table */}
            <div className="mt-3 grid grid-cols-5 gap-2 text-center text-[10px]">
              {data.agingBreakdown.map((b, i) => (
                <div key={b.bucket}>
                  <div className="font-bold" style={{ color: agingColors[i] }}>{b.bucket}</div>
                  <div className="text-gray-600">{b.count} inv</div>
                  <div className="font-semibold">{formatK(b.amount)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Collection Performance */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Collection Performance</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data.collectionPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="days" tick={{ fontSize: 11 }} label={{ value: "Days", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
                <YAxis yAxisId="rate" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(0)}%`} label={{ value: "Rate", angle: 90, position: "insideRight", style: { fontSize: 10 } }} />
                <Tooltip />
                <Legend />
                <Line yAxisId="days" type="monotone" dataKey="avgDaysToPayment" name="Avg Days to Pay" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line yAxisId="rate" type="monotone" dataKey="collectionRate" name="Collection Rate %" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Invoices Table */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Overdue Invoices ({data.overdueInvoices.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-3">Customer</th>
                  <th className="pb-2 pr-3">Invoice #</th>
                  <th className="pb-2 pr-3 text-right">Amount</th>
                  <th className="pb-2 pr-3">Due Date</th>
                  <th className="pb-2 pr-3 text-right">Days Overdue</th>
                  <th className="pb-2 pr-3 text-right">Reminders</th>
                  <th className="pb-2 pr-3 text-right">Calls</th>
                  <th className="pb-2 pr-3">Auto-Charge</th>
                  <th className="pb-2">Owner</th>
                </tr>
              </thead>
              <tbody>
                {data.overdueInvoices.slice(0, 20).map((inv) => (
                  <tr key={inv.id} className={`border-b hover:bg-gray-50 ${inv.daysOverdue > 45 ? "bg-red-50" : ""}`}>
                    <td className="py-2 pr-3 font-medium">{inv.customerName}</td>
                    <td className="py-2 pr-3">
                      <Link href={`/dashboard/invoices?id=${inv.id}`} className="text-brand-tangerina hover:underline">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold">${inv.amount.toLocaleString()}</td>
                    <td className="py-2 pr-3">{new Date(inv.dueDate).toLocaleDateString()}</td>
                    <td className="py-2 pr-3 text-right">
                      <span className={inv.daysOverdue > 45 ? "font-bold text-red-600" : inv.daysOverdue > 30 ? "text-amber-600" : "text-gray-600"}>
                        {inv.daysOverdue}d
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right">{inv.remindersSent}</td>
                    <td className="py-2 pr-3 text-right">{inv.collectionCalls}</td>
                    <td className="py-2 pr-3">
                      {inv.autoChargeStatus === "FAILED" && <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700">Failed</span>}
                      {inv.autoChargeStatus === "SUCCESS" && <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700">OK</span>}
                      {!inv.autoChargeStatus && <span className="text-gray-400">—</span>}
                    </td>
                    <td className="py-2">{inv.ownerName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Create CashFlowTab**

```typescript
// components/financial/tabs/CashFlowTab.tsx
"use client";

import { CashFlowData } from "@/lib/types/financial-bi";
import {
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CashFlowTabProps {
  data: CashFlowData;
}

const probColors = ["#22c55e", "#f59e0b", "#f97316", "#ef4444"];

function formatK(value: number): string {
  return value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value.toFixed(0)}`;
}

const riskBadge = {
  LOW: "bg-green-100 text-green-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

export function CashFlowTab({ data }: CashFlowTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Cash Flow Forecast */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Cash Flow Forecast (90 days)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={data.forecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={formatK} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatK(v)} />
                <Legend />
                <Area type="monotone" dataKey="optimistic" name="Optimistic" stroke="#86efac" fill="#dcfce7" strokeWidth={1} />
                <Area type="monotone" dataKey="expected" name="Expected" stroke="#22c55e" fill="#bbf7d0" strokeWidth={2} />
                <Area type="monotone" dataKey="conservative" name="Conservative" stroke="#166534" fill="#f0fdf4" strokeWidth={1} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Payment Probability */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Payment Probability Breakdown</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data.probabilityBreakdown.filter((s) => s.amount > 0)}
                  dataKey="amount"
                  nameKey="segment"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  label={({ segment, amount }) => `${segment}: ${formatK(amount)}`}
                  labelLine={false}
                >
                  {data.probabilityBreakdown.map((_, i) => (
                    <Cell key={i} fill={probColors[i] || "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatK(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* At-Risk Invoices */}
      <Card>
        <CardHeader><CardTitle className="text-sm">At-Risk Invoices ({data.atRiskInvoices.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-3">Customer</th>
                  <th className="pb-2 pr-3 text-right">Amount</th>
                  <th className="pb-2 pr-3">Due Date</th>
                  <th className="pb-2 pr-3 text-right">Days Overdue</th>
                  <th className="pb-2 pr-3 text-right">Probability</th>
                  <th className="pb-2 pr-3">Risk</th>
                  <th className="pb-2">Last Action</th>
                </tr>
              </thead>
              <tbody>
                {data.atRiskInvoices.slice(0, 15).map((inv) => (
                  <tr key={inv.id} className={`border-b hover:bg-gray-50 ${inv.riskLevel === "CRITICAL" ? "bg-red-50" : ""}`}>
                    <td className="py-2 pr-3 font-medium">{inv.customerName}</td>
                    <td className="py-2 pr-3 text-right font-semibold">${inv.amount.toLocaleString()}</td>
                    <td className="py-2 pr-3">{new Date(inv.dueDate).toLocaleDateString()}</td>
                    <td className="py-2 pr-3 text-right">{inv.daysOverdue}d</td>
                    <td className="py-2 pr-3 text-right">{inv.probability}%</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${riskBadge[inv.riskLevel]}`}>
                        {inv.riskLevel}
                      </span>
                    </td>
                    <td className="py-2 text-gray-500">{inv.lastAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Create CustomerAnalysisTab**

```typescript
// components/financial/tabs/CustomerAnalysisTab.tsx
"use client";

import { CustomerAnalysisData } from "@/lib/types/financial-bi";
import {
  BarChart, Bar, PieChart, Pie, Cell, ComposedChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CustomerAnalysisTabProps {
  data: CustomerAnalysisData;
}

const segmentColors = ["#22c55e", "#f59e0b", "#ef4444"];

function formatK(value: number): string {
  return value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value.toFixed(0)}`;
}

export function CustomerAnalysisTab({ data }: CustomerAnalysisTabProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Revenue Concentration (Pareto) */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Revenue Concentration</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={data.concentration.slice(0, 15)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="customer" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
              <YAxis yAxisId="rev" tickFormatter={formatK} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="pct" orientation="right" tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="rev" dataKey="revenue" name="Revenue" fill="var(--brand-tangerina)" radius={[4, 4, 0, 0]} />
              <Line yAxisId="pct" type="monotone" dataKey="cumulativePct" name="Cumulative %" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top 10 Customers */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Top 10 Customers by Revenue</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.topCustomers} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tickFormatter={formatK} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="customer" tick={{ fontSize: 10 }} width={100} />
              <Tooltip formatter={(v: number) => formatK(v)} />
              <Bar dataKey="totalPaid" fill="var(--brand-verde)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Customer Segments */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Customer Segments</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data.segments}
                dataKey="count"
                nameKey="segment"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                label={({ segment, count }) => `${segment}: ${count}`}
              >
                {data.segments.map((_, i) => (
                  <Cell key={i} fill={segmentColors[i] || "#94a3b8"} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* LTV KPI */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Customer Lifetime Value</CardTitle></CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-6">
          <div className="text-3xl font-extrabold text-brand-verde">{formatK(data.ltv.average)}</div>
          <div className="text-xs text-gray-500">Average LTV</div>
          <div className="mt-3 text-lg font-bold text-gray-600">{formatK(data.ltv.median)}</div>
          <div className="text-xs text-gray-500">Median LTV</div>
          <div className="mt-2 text-[10px] text-gray-400">
            Median is more reliable — not skewed by large accounts
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add components/financial/tabs/
git commit -m "feat: add tab components for financial BI dashboard"
```

---

## Task 10: Dashboard Page — Main Page Assembly

**Files:**
- Create: `app/dashboard/financial/page.tsx`

- [ ] **Step 1: Create the main dashboard page**

Follows the data-fetching pattern from `app/dashboard/insights/page.tsx` (React Query + useSearchParams).

```typescript
// app/dashboard/financial/page.tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FinancialBIResponse, DateRangeParam } from "@/lib/types/financial-bi";
import { CfoBriefing } from "@/components/financial/CfoBriefing";
import { CfoActionItems } from "@/components/financial/CfoActionItems";
import { FinancialKpiRow } from "@/components/financial/FinancialKpiRow";
import { MiniChartRow } from "@/components/financial/MiniChartRow";
import { RevenueGrowthTab } from "@/components/financial/tabs/RevenueGrowthTab";
import { ArCollectionsTab } from "@/components/financial/tabs/ArCollectionsTab";
import { CashFlowTab } from "@/components/financial/tabs/CashFlowTab";
import { CustomerAnalysisTab } from "@/components/financial/tabs/CustomerAnalysisTab";
import { useState } from "react";

const tabs = [
  { key: "revenue", label: "Revenue & Growth" },
  { key: "ar", label: "AR & Collections" },
  { key: "cashflow", label: "Cash Flow" },
  { key: "customers", label: "Customer Analysis" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export default function FinancialDashboardPage() {
  const searchParams = useSearchParams();
  const dateRange = (searchParams.get("dateRange") || "last30") as DateRangeParam;
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;

  const [activeTab, setActiveTab] = useState<TabKey>("revenue");

  const { data, isLoading, isError, refetch } = useQuery<FinancialBIResponse>({
    queryKey: ["financial-bi", dateRange, from, to],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("dateRange", dateRange);
      params.set("tab", "all");
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/analytics/financial-bi?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const handleExport = async (format: "pdf" | "excel") => {
    const params = new URLSearchParams();
    params.set("dateRange", dateRange);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    const endpoint = format === "pdf"
      ? `/api/analytics/financial-bi/export/pdf?${params}`
      : `/api/analytics/financial-bi/export/excel?${params}`;

    const res = await fetch(endpoint);
    if (!res.ok) return;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = format === "pdf" ? "financial-report.pdf" : "financial-report.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-gray-500">Failed to load financial data.</p>
        <button onClick={() => refetch()} className="mt-3 rounded-md bg-brand-tangerina px-4 py-2 text-sm text-white">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Financial Overview</h1>
          {data?.meta && (
            <p className="text-xs text-gray-500">
              Last synced with QuickBooks: {data.meta.lastQbSync === "Never" ? "Never" : new Date(data.meta.lastQbSync).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {/* Date range - reuse existing pattern from QuickFilters if available */}
          <select
            defaultValue={dateRange}
            onChange={(e) => {
              const url = new URL(window.location.href);
              url.searchParams.set("dateRange", e.target.value);
              window.history.pushState({}, "", url.toString());
              window.location.reload();
            }}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs"
          >
            <option value="last7">Last 7 days</option>
            <option value="last30">Last 30 days</option>
            <option value="last90">Last 90 days</option>
            <option value="thisYear">This Year</option>
            <option value="allTime">All Time</option>
          </select>
          <button
            onClick={() => handleExport("pdf")}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs hover:bg-gray-50"
          >
            Export PDF
          </button>
          <button
            onClick={() => handleExport("excel")}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs hover:bg-gray-50"
          >
            Export Excel
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded-xl bg-gray-200" />
          <div className="h-16 animate-pulse rounded-xl bg-gray-200" />
          <div className="grid grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-200" />)}
          </div>
        </div>
      )}

      {/* Zone 1: Executive Summary */}
      {data && (
        <>
          <CfoBriefing insight={data.cfoInsight} />
          <CfoActionItems actions={data.cfoInsight.actions} />
          <FinancialKpiRow
            revenue={data.summary.revenue}
            collectionRate={data.summary.collectionRate}
            outstandingAR={data.summary.outstandingAR}
            mrr={data.summary.mrr}
            topClientConcentration={data.summary.topClientConcentration}
          />
          <MiniChartRow
            revenueTrend={data.summary.revenueTrendMini}
            agingSnapshot={data.summary.agingSnapshotMini}
          />

          {/* Zone 2: Tabbed Detail */}
          <div className="rounded-xl border bg-white p-4">
            <div className="mb-4 flex gap-0 border-b-2 border-gray-100">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-sm font-medium transition ${
                    activeTab === tab.key
                      ? "border-b-2 border-brand-tangerina -mb-[2px] text-brand-tangerina"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "revenue" && data.revenueGrowth && <RevenueGrowthTab data={data.revenueGrowth} />}
            {activeTab === "ar" && data.arCollections && <ArCollectionsTab data={data.arCollections} />}
            {activeTab === "cashflow" && data.cashFlow && <CashFlowTab data={data.cashFlow} />}
            {activeTab === "customers" && data.customerAnalysis && <CustomerAnalysisTab data={data.customerAnalysis} />}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/financial/page.tsx
git commit -m "feat: add financial BI dashboard page with executive summary and tabs"
```

---

## Task 11: Excel Export Endpoint

**Files:**
- Create: `app/api/analytics/financial-bi/export/excel/route.ts`

- [ ] **Step 1: Create Excel export route**

```typescript
// app/api/analytics/financial-bi/export/excel/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFinancialBIData } from "@/lib/services/financial-bi";
import { DateRangeParam } from "@/lib/types/financial-bi";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as { role?: string }).role;
    if (!["ADMIN", "FINANCE"].includes(role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dateRange = (searchParams.get("dateRange") || "last30") as DateRangeParam;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const data = await getFinancialBIData(dateRange, from, to, "all");

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Carreira AI Hub";
    workbook.created = new Date();

    // Sheet 1: Executive Summary
    const summarySheet = workbook.addWorksheet("Executive Summary");
    summarySheet.columns = [
      { header: "Metric", key: "metric", width: 25 },
      { header: "Value", key: "value", width: 20 },
      { header: "vs Previous", key: "change", width: 15 },
      { header: "Status", key: "status", width: 15 },
    ];
    const summaryRows = [
      { metric: "Revenue (Collected)", value: data.summary.revenue.value, change: `${data.summary.revenue.changePct.toFixed(1)}%`, status: data.summary.revenue.context },
      { metric: "Collection Rate", value: `${data.summary.collectionRate.value.toFixed(1)}%`, change: `${data.summary.collectionRate.changePct.toFixed(1)}%`, status: data.summary.collectionRate.context },
      { metric: "Outstanding AR", value: data.summary.outstandingAR.value, change: `${data.summary.outstandingAR.changePct.toFixed(1)}%`, status: data.summary.outstandingAR.context },
      { metric: "MRR", value: data.summary.mrr.value, change: `${data.summary.mrr.changePct.toFixed(1)}%`, status: data.summary.mrr.context },
      { metric: "Top 3 Concentration", value: `${data.summary.topClientConcentration.value.toFixed(1)}%`, change: "", status: data.summary.topClientConcentration.context },
    ];
    summaryRows.forEach((row) => summarySheet.addRow(row));

    // CFO Briefing row
    summarySheet.addRow({});
    summarySheet.addRow({ metric: "CFO Briefing", value: data.cfoInsight.briefing });

    // Sheet 2: Overdue Invoices
    if (data.arCollections) {
      const overdueSheet = workbook.addWorksheet("Overdue Invoices");
      overdueSheet.columns = [
        { header: "Customer", key: "customerName", width: 25 },
        { header: "Invoice #", key: "invoiceNumber", width: 15 },
        { header: "Amount", key: "amount", width: 15 },
        { header: "Due Date", key: "dueDate", width: 15 },
        { header: "Days Overdue", key: "daysOverdue", width: 15 },
        { header: "Reminders", key: "remindersSent", width: 12 },
        { header: "Calls", key: "collectionCalls", width: 10 },
        { header: "Auto-Charge", key: "autoChargeStatus", width: 15 },
        { header: "Owner", key: "ownerName", width: 20 },
      ];
      data.arCollections.overdueInvoices.forEach((inv) => {
        overdueSheet.addRow({
          ...inv,
          dueDate: new Date(inv.dueDate).toLocaleDateString(),
          autoChargeStatus: inv.autoChargeStatus || "N/A",
        });
      });
      // Format amount column as currency
      overdueSheet.getColumn("amount").numFmt = "$#,##0.00";
    }

    // Sheet 3: Revenue by Month
    if (data.revenueGrowth) {
      const revenueSheet = workbook.addWorksheet("Revenue by Month");
      revenueSheet.columns = [
        { header: "Month", key: "month", width: 15 },
        { header: "Invoiced", key: "invoiced", width: 15 },
        { header: "Collected", key: "collected", width: 15 },
        { header: "Gap", key: "gap", width: 15 },
      ];
      data.revenueGrowth.invoicedVsCollected.forEach((m) => {
        revenueSheet.addRow({ ...m, gap: m.invoiced - m.collected });
      });
      ["invoiced", "collected", "gap"].forEach((col) => {
        revenueSheet.getColumn(col).numFmt = "$#,##0.00";
      });
    }

    // Sheet 4: AR Aging
    if (data.arCollections) {
      const agingSheet = workbook.addWorksheet("AR Aging");
      agingSheet.columns = [
        { header: "Bucket", key: "bucket", width: 15 },
        { header: "Count", key: "count", width: 10 },
        { header: "Amount", key: "amount", width: 15 },
      ];
      data.arCollections.agingBreakdown.forEach((b) => agingSheet.addRow(b));
      agingSheet.getColumn("amount").numFmt = "$#,##0.00";
    }

    // Sheet 5: Customer Analysis
    if (data.customerAnalysis) {
      const custSheet = workbook.addWorksheet("Customer Analysis");
      custSheet.columns = [
        { header: "Customer", key: "customer", width: 25 },
        { header: "Total Paid", key: "totalPaid", width: 15 },
      ];
      data.customerAnalysis.topCustomers.forEach((c) => custSheet.addRow(c));
      custSheet.getColumn("totalPaid").numFmt = "$#,##0.00";
    }

    // Style headers on all sheets
    workbook.eachSheet((sheet) => {
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE67E22" } };
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="financial-report-${dateRange}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("[FINANCIAL-BI-EXCEL] Error:", error);
    return NextResponse.json({ error: "Failed to generate Excel report" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/analytics/financial-bi/export/excel/route.ts
git commit -m "feat: add Excel export for financial BI dashboard"
```

---

## Task 12: PDF Export Endpoint

**Files:**
- Create: `app/api/analytics/financial-bi/export/pdf/route.ts`

- [ ] **Step 1: Create PDF export route**

```typescript
// app/api/analytics/financial-bi/export/pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFinancialBIData } from "@/lib/services/financial-bi";
import { DateRangeParam } from "@/lib/types/financial-bi";
import ReactPDF from "@react-pdf/renderer";
import { PdfReport } from "@/components/financial/export/PdfReport";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as { role?: string }).role;
    if (!["ADMIN", "FINANCE"].includes(role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dateRange = (searchParams.get("dateRange") || "last30") as DateRangeParam;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const data = await getFinancialBIData(dateRange, from, to, "all");

    const pdfStream = await ReactPDF.renderToStream(
      PdfReport({ data, dateRange })
    );

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of pdfStream) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const buffer = Buffer.concat(chunks);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="financial-report-${dateRange}.pdf"`,
      },
    });
  } catch (error) {
    console.error("[FINANCIAL-BI-PDF] Error:", error);
    return NextResponse.json({ error: "Failed to generate PDF report" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create PdfReport component**

```typescript
// components/financial/export/PdfReport.tsx
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { FinancialBIResponse } from "@/lib/types/financial-bi";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 5 },
  subtitle: { fontSize: 10, color: "#888", marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: "bold", marginTop: 20, marginBottom: 10, color: "#e67e22" },
  briefing: { backgroundColor: "#1a1a2e", color: "#ddd", padding: 15, borderRadius: 6, marginBottom: 15, fontSize: 10, lineHeight: 1.6 },
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 15 },
  kpiCard: { flex: 1, backgroundColor: "#f9f9f9", borderRadius: 6, padding: 10, alignItems: "center" },
  kpiLabel: { fontSize: 8, color: "#888", textTransform: "uppercase" },
  kpiValue: { fontSize: 18, fontWeight: "bold", marginVertical: 3 },
  kpiContext: { fontSize: 8 },
  table: { marginTop: 5 },
  tableHeader: { flexDirection: "row", backgroundColor: "#e67e22", padding: 6, borderRadius: 3 },
  tableHeaderCell: { flex: 1, fontSize: 8, fontWeight: "bold", color: "#fff" },
  tableRow: { flexDirection: "row", padding: 5, borderBottomWidth: 0.5, borderBottomColor: "#eee" },
  tableCell: { flex: 1, fontSize: 8 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, textAlign: "center", fontSize: 8, color: "#aaa" },
});

function formatCurrency(value: number): string {
  return value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value.toFixed(0)}`;
}

interface PdfReportProps {
  data: FinancialBIResponse;
  dateRange: string;
}

export function PdfReport({ data, dateRange }: PdfReportProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <Text style={styles.title}>Carreira U.S.A. — Financial Report</Text>
        <Text style={styles.subtitle}>
          Period: {dateRange} | Generated: {new Date().toLocaleDateString()}
        </Text>

        {/* CFO Briefing */}
        <View style={styles.briefing}>
          <Text style={{ fontSize: 9, fontWeight: "bold", color: "#e67e22", marginBottom: 5 }}>
            CFO BRIEFING
          </Text>
          <Text style={{ color: "#ddd", lineHeight: 1.6 }}>{data.cfoInsight.briefing}</Text>
        </View>

        {/* KPI Summary */}
        <View style={styles.kpiRow}>
          {[
            { label: "Revenue", metric: data.summary.revenue, fmt: "currency" as const },
            { label: "Collection Rate", metric: data.summary.collectionRate, fmt: "percent" as const },
            { label: "Outstanding AR", metric: data.summary.outstandingAR, fmt: "currency" as const },
            { label: "MRR", metric: data.summary.mrr, fmt: "currency" as const },
            { label: "Concentration", metric: data.summary.topClientConcentration, fmt: "percent" as const },
          ].map((kpi) => (
            <View key={kpi.label} style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>{kpi.label}</Text>
              <Text style={styles.kpiValue}>
                {kpi.fmt === "currency" ? formatCurrency(kpi.metric.value) : `${kpi.metric.value.toFixed(1)}%`}
              </Text>
              <Text style={styles.kpiContext}>
                {kpi.metric.changePct >= 0 ? "+" : ""}{kpi.metric.changePct.toFixed(1)}% — {kpi.metric.context}
              </Text>
            </View>
          ))}
        </View>

        {/* Action Items */}
        {data.cfoInsight.actions.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recommended Actions</Text>
            {data.cfoInsight.actions.map((action, i) => (
              <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 5, padding: 6, backgroundColor: action.severity === "URGENT" ? "#fff5f5" : action.severity === "WATCH" ? "#fffbf0" : "#f0f7ff", borderRadius: 3 }}>
                <Text style={{ fontSize: 8, fontWeight: "bold", color: action.severity === "URGENT" ? "#e74c3c" : action.severity === "WATCH" ? "#f39c12" : "#3498db" }}>
                  {action.severity}
                </Text>
                <Text style={{ fontSize: 8, flex: 1 }}>{action.description}</Text>
              </View>
            ))}
          </>
        )}

        {/* AR Aging Table */}
        {data.arCollections && (
          <>
            <Text style={styles.sectionTitle}>AR Aging Breakdown</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableHeaderCell}>Bucket</Text>
                <Text style={styles.tableHeaderCell}>Count</Text>
                <Text style={styles.tableHeaderCell}>Amount</Text>
              </View>
              {data.arCollections.agingBreakdown.map((b) => (
                <View key={b.bucket} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{b.bucket}</Text>
                  <Text style={styles.tableCell}>{b.count}</Text>
                  <Text style={styles.tableCell}>{formatCurrency(b.amount)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Top Overdue */}
        {data.arCollections && data.arCollections.overdueInvoices.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Top Overdue Invoices</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={{ ...styles.tableHeaderCell, flex: 2 }}>Customer</Text>
                <Text style={styles.tableHeaderCell}>Amount</Text>
                <Text style={styles.tableHeaderCell}>Days Overdue</Text>
                <Text style={styles.tableHeaderCell}>Reminders</Text>
              </View>
              {data.arCollections.overdueInvoices.slice(0, 10).map((inv) => (
                <View key={inv.id} style={styles.tableRow}>
                  <Text style={{ ...styles.tableCell, flex: 2 }}>{inv.customerName}</Text>
                  <Text style={styles.tableCell}>${inv.amount.toLocaleString()}</Text>
                  <Text style={styles.tableCell}>{inv.daysOverdue}d</Text>
                  <Text style={styles.tableCell}>{inv.remindersSent}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Carreira AI Hub — Confidential Financial Report — {new Date().toLocaleDateString()}
        </Text>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/analytics/financial-bi/export/pdf/route.ts components/financial/export/PdfReport.tsx
git commit -m "feat: add PDF export for financial BI dashboard"
```

---

## Task 13: Add Navigation Link & Build Verification

**Files:**
- Modify: `components/dashboard/sidebar.tsx` (or equivalent navigation component)

- [ ] **Step 1: Find and update the sidebar/navigation**

Search for the sidebar or navigation component that lists dashboard pages. Add a "Financial" link:

```typescript
// In the navigation items array, add:
{
  label: "Financial",
  href: "/dashboard/financial",
  icon: /* use same icon pattern as other items — likely from lucide-react */,
}
```

Place it near "Analytics" and "Insights" in the navigation order.

- [ ] **Step 2: Run build to verify no TypeScript errors**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/
git commit -m "feat: add Financial dashboard to sidebar navigation"
```

---

## Task 14: Manual Testing & Fixes

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Navigate to `/dashboard/financial`**

Verify:
1. Page loads without errors
2. KPI cards show real data from database
3. CFO briefing shows placeholder text (AI analysis not yet generated)
4. Action items appear if any invoices are overdue
5. All 4 tabs render charts correctly
6. Date range picker changes data
7. Loading skeleton shows during fetch

- [ ] **Step 3: Test exports**

1. Click "Export Excel" — verify `.xlsx` downloads with formatted sheets
2. Click "Export PDF" — verify PDF downloads with briefing, KPIs, and tables

- [ ] **Step 4: Test CFO analysis generation**

Hit the cron endpoint manually:

```bash
curl http://localhost:3000/api/cron/cfo-analysis
```

Expected: `{"success": true, "generatedAt": "..."}`. Refresh page — CFO briefing should now show AI-generated narrative.

- [ ] **Step 5: Fix any issues found during testing**

Address any rendering bugs, data formatting issues, or TypeScript errors.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "fix: address issues found during financial BI dashboard testing"
```
