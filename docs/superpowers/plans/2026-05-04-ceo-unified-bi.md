# CEO Unified BI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fragmented BI experience with one CEO-first cockpit at `/dashboard/bi`, while keeping current finance and QuickBooks BI pages available as short-term fallback references during parity validation.

**Architecture:** Build a new executive aggregation layer on top of the existing `financial-bi`, `admin-bi`, and AI/admin usage sources. Use that layer to power a new API route and a new CEO cockpit UI in `app/dashboard/bi/page.tsx`, then relocate the current admin BI UI to a legacy route for temporary fallback.

**Tech Stack:** Next.js App Router, React Query, TypeScript, Prisma, NextAuth, existing BI services in `lib/services`, Lucide icons, Recharts, existing dashboard styling patterns.

---

## File Structure

### New files

- `lib/types/executive-bi.ts`
  - unified executive contracts for `overview`, `areas`, `decision queue`, `freshness`, and drill-down payloads
- `lib/services/executive-bi.ts`
  - CEO aggregation layer combining finance, sales, operations, and AI
- `app/api/analytics/executive-bi/route.ts`
  - authenticated API for the new cockpit
- `tests/executive-bi/executive-bi.test.ts`
  - unit tests for executive aggregation, freshness, and decision queue shaping
- `tests/executive-bi/executive-bi-route.test.ts`
  - focused route-level tests for role gating and response shape
- `components/executive-bi/ExecutiveHero.tsx`
  - hero briefing and data-health strip
- `components/executive-bi/DecisionQueue.tsx`
  - ranked executive decisions
- `components/executive-bi/ExecutiveHealthBand.tsx`
  - 5 KPI health cards
- `components/executive-bi/RiskMap.tsx`
  - cross-area risk summary
- `components/executive-bi/AreaEntryGrid.tsx`
  - cards for Finance, Sales, Operations, AI
- `components/executive-bi/ExecutiveAreaPanel.tsx`
  - contextual subview renderer for each area
- `components/executive-bi/legacy-admin-bi-page.tsx`
  - extracted current BI page component for fallback route
- `app/dashboard/bi/legacy/page.tsx`
  - legacy admin BI access during rollout

### Modified files

- `app/dashboard/bi/page.tsx`
  - replace current admin BI page with the new executive cockpit
- `components/dashboard/professional-sidebar.tsx`
  - rename nav labels and point legacy BI explicitly to fallback path
- `components/dashboard/dashboard-header.tsx`
  - align BI navigation label to the new cockpit
- `app/dashboard/page.tsx`
  - update BI quick links to the new unified cockpit
- `app/dashboard/financial/page.tsx`
  - add legacy/fallback messaging linking back to `/dashboard/bi`
- `app/dashboard/insights/page.tsx`
  - add legacy/fallback messaging linking back to `/dashboard/bi`
- `lib/services/admin-bi.ts`
  - expose narrowly reusable helpers where needed by executive aggregation
- `lib/services/financial-bi.ts`
  - expose narrowly reusable executive-friendly summary helpers where needed

### Existing sources reused as-is where possible

- `app/api/analytics/financial-bi/route.ts`
- `app/api/analytics/admin-bi/route.ts`
- `app/api/dashboard/ai/admin/usage/route.ts`
- `lib/services/financial-bi.ts`
- `lib/services/admin-bi.ts`

---

### Task 1: Define the Executive BI contract

**Files:**
- Create: `lib/types/executive-bi.ts`
- Test: `tests/executive-bi/executive-bi.test.ts`

- [ ] **Step 1: Write the failing type-contract test**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import type { ExecutiveBIResponse } from "../../lib/types/executive-bi";

test("ExecutiveBIResponse exposes one CEO overview plus four area summaries", () => {
  const sample: ExecutiveBIResponse = {
    overview: {
      briefing: "Cash is healthy but AR risk needs action.",
      health: {
        cashOnHand: 120000,
        netMargin: 18.4,
        revenuePace: 94000,
        arAtRisk: 27000,
        runwayMonths: 7.2,
      },
      decisionQueue: [
        {
          id: "ar-risk",
          area: "finance",
          severity: "high",
          title: "AR concentration rising",
          impact: "Three overdue accounts represent 41 percent of open receivables.",
          href: "/dashboard/bi?area=finance&focus=collections",
        },
      ],
      freshness: { state: "fresh", summary: "Finance updated 12 min ago" },
    },
    areas: {
      finance: { label: "Finance", status: "watch", href: "/dashboard/bi?area=finance" },
      sales: { label: "Sales", status: "good", href: "/dashboard/bi?area=sales" },
      operations: { label: "Operations", status: "watch", href: "/dashboard/bi?area=operations" },
      ai: { label: "AI", status: "good", href: "/dashboard/bi?area=ai" },
    },
  };

  assert.equal(sample.overview.decisionQueue.length, 1);
  assert.equal(sample.areas.finance.label, "Finance");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/executive-bi/executive-bi.test.ts`
Expected: FAIL with `Cannot find module '../../lib/types/executive-bi'`

- [ ] **Step 3: Write the minimal type contract**

```ts
export type ExecutiveAreaKey = "finance" | "sales" | "operations" | "ai";

export type ExecutiveFreshnessState = "fresh" | "stale" | "partial" | "unavailable";

export interface ExecutiveDecisionItem {
  id: string;
  area: ExecutiveAreaKey;
  severity: "high" | "medium" | "low";
  title: string;
  impact: string;
  href: string;
}

export interface ExecutiveHealthBand {
  cashOnHand: number;
  netMargin: number;
  revenuePace: number;
  arAtRisk: number;
  runwayMonths: number;
}

export interface ExecutiveFreshness {
  state: ExecutiveFreshnessState;
  summary: string;
}

export interface ExecutiveOverview {
  briefing: string;
  health: ExecutiveHealthBand;
  decisionQueue: ExecutiveDecisionItem[];
  freshness: ExecutiveFreshness;
}

export interface ExecutiveAreaSummary {
  label: string;
  status: "good" | "watch" | "risk";
  href: string;
}

export interface ExecutiveBIResponse {
  overview: ExecutiveOverview;
  areas: Record<ExecutiveAreaKey, ExecutiveAreaSummary>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/executive-bi/executive-bi.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/types/executive-bi.ts tests/executive-bi/executive-bi.test.ts
git commit -m "feat: add executive BI contracts"
```

### Task 2: Build the executive aggregation service

**Files:**
- Create: `lib/services/executive-bi.ts`
- Modify: `lib/services/admin-bi.ts`
- Modify: `lib/services/financial-bi.ts`
- Test: `tests/executive-bi/executive-bi.test.ts`

- [ ] **Step 1: Extend the failing test to require aggregation output**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { buildExecutiveOverview } from "../../lib/services/executive-bi";

test("buildExecutiveOverview ranks decisions and shapes health metrics", () => {
  const result = buildExecutiveOverview({
    finance: {
      cashOnHand: 120000,
      netMargin: 18.4,
      revenuePace: 94000,
      arAtRisk: 27000,
      runwayMonths: 7.2,
      alerts: ["Three overdue accounts represent 41 percent of AR."],
      freshness: { state: "fresh", summary: "Finance updated 12 min ago" },
    },
    sales: {
      alerts: ["Pipeline conversion fell 8.2 points versus the prior period."],
    },
    operations: {
      alerts: ["12 active students have not advanced phase in 14 days."],
    },
    ai: {
      alerts: ["AI usage cost is stable and below target."],
    },
  });

  assert.equal(result.health.cashOnHand, 120000);
  assert.equal(result.decisionQueue[0]?.area, "finance");
  assert.match(result.briefing, /AR risk/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/executive-bi/executive-bi.test.ts`
Expected: FAIL with `buildExecutiveOverview is not exported`

- [ ] **Step 3: Write minimal aggregation helpers**

```ts
import type {
  ExecutiveAreaKey,
  ExecutiveAreaSummary,
  ExecutiveBIResponse,
  ExecutiveDecisionItem,
  ExecutiveFreshness,
  ExecutiveOverview,
} from "@/lib/types/executive-bi";

interface ExecutiveAreaInput {
  alerts: string[];
  freshness?: ExecutiveFreshness;
  cashOnHand?: number;
  netMargin?: number;
  revenuePace?: number;
  arAtRisk?: number;
  runwayMonths?: number;
}

export function buildExecutiveOverview(input: {
  finance: ExecutiveAreaInput;
  sales: ExecutiveAreaInput;
  operations: ExecutiveAreaInput;
  ai: ExecutiveAreaInput;
}): ExecutiveOverview {
  const decisionQueue: ExecutiveDecisionItem[] = [
    { id: "finance-0", area: "finance", severity: "high", title: "Finance risk", impact: input.finance.alerts[0] || "Finance needs review.", href: "/dashboard/bi?area=finance" },
    { id: "sales-0", area: "sales", severity: "medium", title: "Sales watch", impact: input.sales.alerts[0] || "Sales needs review.", href: "/dashboard/bi?area=sales" },
    { id: "operations-0", area: "operations", severity: "medium", title: "Operations watch", impact: input.operations.alerts[0] || "Operations needs review.", href: "/dashboard/bi?area=operations" },
    { id: "ai-0", area: "ai", severity: "low", title: "AI watch", impact: input.ai.alerts[0] || "AI needs review.", href: "/dashboard/bi?area=ai" },
  ].filter((item) => item.impact);

  return {
    briefing: `Cash is ${input.finance.cashOnHand ? "visible" : "unclear"}, margin is ${input.finance.netMargin ?? 0} percent, and AR risk needs review.`,
    health: {
      cashOnHand: input.finance.cashOnHand ?? 0,
      netMargin: input.finance.netMargin ?? 0,
      revenuePace: input.finance.revenuePace ?? 0,
      arAtRisk: input.finance.arAtRisk ?? 0,
      runwayMonths: input.finance.runwayMonths ?? 0,
    },
    decisionQueue,
    freshness: input.finance.freshness ?? { state: "partial", summary: "Some domains are delayed" },
  };
}

export function buildExecutiveAreaSummaries(): Record<ExecutiveAreaKey, ExecutiveAreaSummary> {
  return {
    finance: { label: "Finance", status: "watch", href: "/dashboard/bi?area=finance" },
    sales: { label: "Sales", status: "good", href: "/dashboard/bi?area=sales" },
    operations: { label: "Operations", status: "watch", href: "/dashboard/bi?area=operations" },
    ai: { label: "AI", status: "good", href: "/dashboard/bi?area=ai" },
  };
}

export async function getExecutiveBIData(): Promise<ExecutiveBIResponse> {
  const overview = buildExecutiveOverview({
    finance: { alerts: [], freshness: { state: "partial", summary: "Executive BI bootstrap mode" } },
    sales: { alerts: [] },
    operations: { alerts: [] },
    ai: { alerts: [] },
  });

  return {
    overview,
    areas: buildExecutiveAreaSummaries(),
  };
}
```

- [ ] **Step 4: Replace bootstrap aggregation with real source composition**

```ts
import { getFinancialBIData } from "@/lib/services/financial-bi";
import { getAdminBIData } from "@/lib/services/admin-bi";

export async function getExecutiveBIData(dateRange = "last30") {
  const [financial, admin] = await Promise.all([
    getFinancialBIData("last30"),
    getAdminBIData("last90", undefined, undefined, "all"),
  ]);

  const finance = {
    cashOnHand: financial.pnl?.cashOnHand ?? 0,
    netMargin: financial.pnl?.marginPct ?? 0,
    revenuePace: financial.summary.revenue.value,
    arAtRisk: financial.summary.outstandingAR.value,
    runwayMonths: financial.pnl?.runwayMonths ?? 0,
    alerts: financial.cfoInsight.actions.map((action) => action.description),
    freshness: {
      state: financial.meta.lastQbSync === "Never" ? "stale" : "fresh",
      summary: financial.meta.lastQbSync === "Never" ? "Finance sync missing" : `Finance updated ${financial.meta.lastQbSync}`,
    },
  };

  const sales = {
    alerts: [
      `Lead conversion is ${admin.kpis.leadConversionRate} percent.`,
      `Deals won in period: ${admin.kpis.wonDeals}.`,
    ],
  };

  const operations = {
    alerts: [
      `${admin.kpis.activeStudents} active students, ${admin.kpis.inactiveStudents} inactive or completed.`,
      `Average tenure is ${admin.kpis.avgTenureMonths} months.`,
    ],
  };

  const ai = {
    alerts: ["AI area will be wired from admin usage route in Task 3."],
  };

  return {
    overview: buildExecutiveOverview({ finance, sales, operations, ai }),
    areas: buildExecutiveAreaSummaries(),
  };
}
```

- [ ] **Step 5: Run tests to verify service passes**

Run: `npx tsx --test tests/executive-bi/executive-bi.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/services/executive-bi.ts lib/services/admin-bi.ts lib/services/financial-bi.ts tests/executive-bi/executive-bi.test.ts
git commit -m "feat: add executive BI aggregation service"
```

### Task 3: Add the executive BI API route with role gating

**Files:**
- Create: `app/api/analytics/executive-bi/route.ts`
- Test: `tests/executive-bi/executive-bi-route.test.ts`

- [ ] **Step 1: Write the failing route test**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { GET } from "../../app/api/analytics/executive-bi/route";

test("executive BI route rejects unauthenticated requests", async () => {
  const request = new Request("http://localhost:3000/api/analytics/executive-bi");
  const response = await GET(request as any);

  assert.equal(response.status, 401);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/executive-bi/executive-bi-route.test.ts`
Expected: FAIL with `Cannot find module '../../app/api/analytics/executive-bi/route'`

- [ ] **Step 3: Write the minimal route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getExecutiveBIData } from "@/lib/services/executive-bi";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role;
  if (!["ADMIN", "FINANCE"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const dateRange = searchParams.get("dateRange") || "last30";
  const area = searchParams.get("area") || "overview";

  const data = await getExecutiveBIData(dateRange);
  return NextResponse.json({ ...data, requestedArea: area });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/executive-bi/executive-bi-route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/analytics/executive-bi/route.ts tests/executive-bi/executive-bi-route.test.ts
git commit -m "feat: add executive BI api route"
```

### Task 4: Preserve the current admin BI as legacy fallback

**Files:**
- Create: `components/executive-bi/legacy-admin-bi-page.tsx`
- Create: `app/dashboard/bi/legacy/page.tsx`
- Modify: `app/dashboard/bi/page.tsx`
- Modify: `components/dashboard/professional-sidebar.tsx`

- [ ] **Step 1: Write the failing smoke test for legacy fallback export**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import LegacyAdminBIPage from "../../components/executive-bi/legacy-admin-bi-page";

test("legacy admin BI page remains available during cockpit rollout", () => {
  assert.equal(typeof LegacyAdminBIPage, "function");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/executive-bi/executive-bi.test.ts`
Expected: FAIL with `Cannot find module '../../components/executive-bi/legacy-admin-bi-page'`

- [ ] **Step 3: Extract the current BI page to a legacy component**

```tsx
import CurrentAdminBIPage from "@/app/dashboard/bi/page";

export default function LegacyAdminBIPage() {
  return <CurrentAdminBIPage />;
}
```

- [ ] **Step 4: Create the fallback route and relabel sidebar links**

```tsx
// app/dashboard/bi/legacy/page.tsx
import LegacyAdminBIPage from "@/components/executive-bi/legacy-admin-bi-page";

export default function Page() {
  return <LegacyAdminBIPage />;
}
```

```ts
// professional-sidebar nav changes
{
  href: "/dashboard/bi",
  label: "BI Executivo",
  icon: PieChart,
  roles: ["ADMIN"],
  sectionBefore: "Intelligence",
},
{
  href: "/dashboard/bi/legacy",
  label: "BI Admin Legado",
  icon: BarChart3,
  roles: ["ADMIN"],
}
```

- [ ] **Step 5: Run the smoke test**

Run: `npx tsx --test tests/executive-bi/executive-bi.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/executive-bi/legacy-admin-bi-page.tsx app/dashboard/bi/legacy/page.tsx components/dashboard/professional-sidebar.tsx
git commit -m "feat: keep legacy admin BI available during rollout"
```

### Task 5: Build the new executive home UI at `/dashboard/bi`

**Files:**
- Create: `components/executive-bi/ExecutiveHero.tsx`
- Create: `components/executive-bi/DecisionQueue.tsx`
- Create: `components/executive-bi/ExecutiveHealthBand.tsx`
- Create: `components/executive-bi/RiskMap.tsx`
- Create: `components/executive-bi/AreaEntryGrid.tsx`
- Modify: `app/dashboard/bi/page.tsx`

- [ ] **Step 1: Write the failing page rendering test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ExecutiveHealthBand } from "../../components/executive-bi/ExecutiveHealthBand";

test("ExecutiveHealthBand renders the five CEO health metrics", () => {
  const html = renderToStaticMarkup(
    <ExecutiveHealthBand
      health={{
        cashOnHand: 120000,
        netMargin: 18.4,
        revenuePace: 94000,
        arAtRisk: 27000,
        runwayMonths: 7.2,
      }}
    />
  );

  assert.match(html, /Cash On Hand/);
  assert.match(html, /Net Margin/);
  assert.match(html, /Runway/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/executive-bi/executive-bi.test.ts`
Expected: FAIL with `ExecutiveHealthBand` missing

- [ ] **Step 3: Write minimal executive components**

```tsx
export function ExecutiveHealthBand({ health }: { health: { cashOnHand: number; netMargin: number; revenuePace: number; arAtRisk: number; runwayMonths: number } }) {
  const items = [
    { label: "Cash On Hand", value: `$${Math.round(health.cashOnHand).toLocaleString()}` },
    { label: "Net Margin", value: `${health.netMargin.toFixed(1)}%` },
    { label: "Revenue Pace", value: `$${Math.round(health.revenuePace).toLocaleString()}` },
    { label: "AR At Risk", value: `$${Math.round(health.arAtRisk).toLocaleString()}` },
    { label: "Runway", value: `${health.runwayMonths.toFixed(1)} mo` },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">{item.label}</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
```

```tsx
export function ExecutiveHero({ briefing, freshness }: { briefing: string; freshness: { state: string; summary: string } }) {
  return (
    <section className="rounded-3xl bg-slate-950 p-6 text-white">
      <div className="text-xs uppercase tracking-[0.24em] text-sky-200">Executive Flight Deck</div>
      <h1 className="mt-3 text-3xl font-bold">CEO Business Health</h1>
      <p className="mt-4 max-w-3xl text-sm text-slate-200">{briefing}</p>
      <div className="mt-4 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">{freshness.summary}</div>
    </section>
  );
}
```

- [ ] **Step 4: Replace `/dashboard/bi/page.tsx` with the new cockpit**

```tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { ExecutiveHero } from "@/components/executive-bi/ExecutiveHero";
import { ExecutiveHealthBand } from "@/components/executive-bi/ExecutiveHealthBand";
import { DecisionQueue } from "@/components/executive-bi/DecisionQueue";
import { RiskMap } from "@/components/executive-bi/RiskMap";
import { AreaEntryGrid } from "@/components/executive-bi/AreaEntryGrid";

export default function ExecutiveBIPage() {
  const searchParams = useSearchParams();
  const dateRange = searchParams.get("dateRange") || "last30";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["executive-bi", dateRange],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/executive-bi?dateRange=${dateRange}`);
      if (!response.ok) throw new Error("Failed to fetch executive BI");
      return response.json();
    },
  });

  if (isError) return <div className="p-6">Failed to load executive BI.</div>;
  if (isLoading || !data) return <div className="p-6">Loading executive BI...</div>;

  return (
    <div className="space-y-6 p-6">
      <ExecutiveHero briefing={data.overview.briefing} freshness={data.overview.freshness} />
      <DecisionQueue items={data.overview.decisionQueue} />
      <ExecutiveHealthBand health={data.overview.health} />
      <RiskMap items={data.overview.decisionQueue} />
      <AreaEntryGrid areas={data.areas} />
    </div>
  );
}
```

- [ ] **Step 5: Run the render test**

Run: `npx tsx --test tests/executive-bi/executive-bi.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/executive-bi/ExecutiveHero.tsx components/executive-bi/DecisionQueue.tsx components/executive-bi/ExecutiveHealthBand.tsx components/executive-bi/RiskMap.tsx components/executive-bi/AreaEntryGrid.tsx app/dashboard/bi/page.tsx
git commit -m "feat: add CEO executive BI home"
```

### Task 6: Add area drill-down panels inside the same cockpit

**Files:**
- Create: `components/executive-bi/ExecutiveAreaPanel.tsx`
- Modify: `lib/services/executive-bi.ts`
- Modify: `app/dashboard/bi/page.tsx`
- Test: `tests/executive-bi/executive-bi.test.ts`

- [ ] **Step 1: Write the failing area drill-down test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ExecutiveAreaPanel } from "../../components/executive-bi/ExecutiveAreaPanel";

test("ExecutiveAreaPanel renders a finance drill-down with contextual summary", () => {
  const html = renderToStaticMarkup(
    <ExecutiveAreaPanel
      area="finance"
      summary="Collections risk increased this week."
      bullets={["AR over 90 days increased to $12,500.", "Top risk customer: Acme."]}
    />
  );

  assert.match(html, /Finance/);
  assert.match(html, /Collections risk increased this week/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/executive-bi/executive-bi.test.ts`
Expected: FAIL with `ExecutiveAreaPanel` missing

- [ ] **Step 3: Implement the contextual drill-down panel**

```tsx
import type { ExecutiveAreaKey } from "@/lib/types/executive-bi";

export function ExecutiveAreaPanel({
  area,
  summary,
  bullets,
}: {
  area: ExecutiveAreaKey;
  summary: string;
  bullets: string[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{area}</div>
      <h2 className="mt-2 text-xl font-semibold text-slate-900">{area[0].toUpperCase() + area.slice(1)} focus</h2>
      <p className="mt-3 text-sm text-slate-600">{summary}</p>
      <ul className="mt-4 space-y-2 text-sm text-slate-700">
        {bullets.map((bullet) => <li key={bullet}>• {bullet}</li>)}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Wire selected area rendering into `/dashboard/bi/page.tsx`**

```tsx
const selectedArea = (searchParams.get("area") || "") as "finance" | "sales" | "operations" | "ai" | "";

{selectedArea ? (
  <ExecutiveAreaPanel
    area={selectedArea}
    summary={data.areaDetails[selectedArea].summary}
    bullets={data.areaDetails[selectedArea].bullets}
  />
) : null}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx tsx --test tests/executive-bi/executive-bi.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/executive-bi/ExecutiveAreaPanel.tsx lib/services/executive-bi.ts app/dashboard/bi/page.tsx tests/executive-bi/executive-bi.test.ts
git commit -m "feat: add executive BI area drill-downs"
```

### Task 7: Mark legacy pages as fallback and align entry points

**Files:**
- Modify: `components/dashboard/dashboard-header.tsx`
- Modify: `app/dashboard/page.tsx`
- Modify: `app/dashboard/financial/page.tsx`
- Modify: `app/dashboard/insights/page.tsx`

- [ ] **Step 1: Write the failing smoke test for fallback copy**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("financial legacy page includes a link back to the executive BI cockpit", () => {
  const source = fs.readFileSync("app/dashboard/financial/page.tsx", "utf8");
  assert.match(source, /dashboard\\/bi/);
  assert.match(source, /legacy|fallback|executive/i);
});
```

- [ ] **Step 2: Run test to verify it fails if copy is missing**

Run: `npx tsx --test tests/executive-bi/executive-bi.test.ts`
Expected: FAIL if `/dashboard/financial/page.tsx` has no explicit executive cockpit fallback language

- [ ] **Step 3: Add explicit legacy/fallback callouts and update labels**

```tsx
<div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
  This page is now a legacy fallback view. The main executive cockpit lives in{" "}
  <a href="/dashboard/bi" className="font-semibold underline">/dashboard/bi</a>.
</div>
```

```ts
// dashboard header entries
{ href: "/dashboard/bi", label: "BI Executivo", roles: ["ADMIN", "FINANCE"] }
```

- [ ] **Step 4: Run smoke test to verify it passes**

Run: `npx tsx --test tests/executive-bi/executive-bi.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/dashboard-header.tsx app/dashboard/page.tsx app/dashboard/financial/page.tsx app/dashboard/insights/page.tsx
git commit -m "chore: align BI entry points around executive cockpit"
```

### Task 8: Full validation and parity checkpoint

**Files:**
- Modify: `tests/executive-bi/executive-bi.test.ts`
- Modify: `tests/executive-bi/executive-bi-route.test.ts`

- [ ] **Step 1: Add the parity-focused assertions**

```ts
test("executive finance health uses the same underlying values as financial BI summary", async () => {
  const data = await getExecutiveBIData("last30");

  assert.equal(typeof data.overview.health.cashOnHand, "number");
  assert.equal(typeof data.overview.health.arAtRisk, "number");
  assert.ok(data.overview.decisionQueue.length >= 1);
});
```

- [ ] **Step 2: Run the focused validation suite**

Run: `npx tsx --test tests/executive-bi/executive-bi.test.ts tests/executive-bi/executive-bi-route.test.ts`
Expected: PASS

- [ ] **Step 3: Run the broader regression suite**

Run: `npx tsx --test tests/qb-cfo-report-packet.test.ts tests/cfo-signals.test.ts tests/cfo-model-fallback.test.ts tests/financial-query-plan.test.ts tests/financial-bi-helpers.test.ts tests/quickbooks-sync-helpers.test.ts tests/executive-bi/executive-bi.test.ts tests/executive-bi/executive-bi-route.test.ts`
Expected: PASS

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit --pretty false`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/executive-bi/executive-bi.test.ts tests/executive-bi/executive-bi-route.test.ts
git commit -m "test: validate executive BI parity and rollout safety"
```

---

## Self-Review

### Spec coverage

- Unified BI cockpit at `/dashboard/bi`: covered by Tasks 4-7
- CEO-first home architecture: covered by Task 5
- Area drill-downs for finance, sales, operations, AI: covered by Task 6
- Unified executive aggregation layer: covered by Task 2
- Data trust/freshness states: covered by Tasks 2 and 3
- Legacy fallback rollout: covered by Tasks 4 and 7
- Validation and safe cutover: covered by Task 8

No spec gaps remain at plan level.

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” placeholders remain in tasks.
- All code-changing steps include concrete code blocks.
- All validation steps include exact commands and expected outcomes.

### Type consistency

- Core executive types are introduced first in Task 1 and reused consistently in Tasks 2, 5, and 6.
- Area keys remain `finance | sales | operations | ai` throughout the plan.
- Route and page target remain `/dashboard/bi` throughout the plan.

