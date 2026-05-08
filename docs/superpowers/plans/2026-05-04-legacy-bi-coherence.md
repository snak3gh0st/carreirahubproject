# Legacy BI Coherence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/dashboard/financial`, `/dashboard/insights`, and `/dashboard/bi/legacy` visually clearer while ensuring shared executive KPI numbers stay coherent with `/dashboard/bi`.

**Architecture:** Reuse the unified executive BI layer as the canonical source for shared KPI values, then thread a small shared summary component into each legacy surface. Keep legacy pages’ deep-detail charts and tables on their existing data sources, but stop them from acting like separate executive truth layers.

**Tech Stack:** Next.js App Router, React Query, TypeScript, existing executive BI service/API, existing dashboard UI components, node:test/tsx, Next.js production build.

---

## File Structure

### New files

- `components/executive-bi/LegacyExecutiveSummary.tsx`
  - shared top-of-page executive summary strip for legacy surfaces
- `lib/executive-bi/legacy-summary.ts`
  - pure helpers for mapping executive response data into small legacy summary cards and preserving window params
- `tests/executive-bi/legacy-summary.test.ts`
  - focused tests for shared KPI mapping and window-param forwarding

### Modified files

- `app/dashboard/financial/page.tsx`
  - consume canonical executive summary for shared finance KPIs and improved fallback header
- `app/dashboard/insights/page.tsx`
  - consume canonical executive summary for shared executive context and improved fallback header
- `components/executive-bi/legacy-admin-bi-page.tsx`
  - consume canonical executive summary and improve secondary-surface framing
- `components/executive-bi/ExecutiveHero.tsx`
  - improve readability/contrast in the cockpit hero

---

### Task 1: Add shared legacy executive-summary helpers

**Files:**
- Create: `lib/executive-bi/legacy-summary.ts`
- Test: `tests/executive-bi/legacy-summary.test.ts`

- [ ] **Step 1: Write the failing helper test**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLegacyExecutiveCards,
  buildLegacyWindowParams,
} from "../../lib/executive-bi/legacy-summary";

test("buildLegacyExecutiveCards maps the canonical executive KPIs into legacy-friendly cards", () => {
  const cards = buildLegacyExecutiveCards({
    overview: {
      briefing: "AR risk is rising.",
      health: {
        cashOnHand: 120000,
        netMargin: 18.4,
        revenuePace: 94000,
        arAtRisk: 27000,
        runwayMonths: 7.2,
      },
      decisionQueue: [],
      freshness: { state: "fresh", summary: "Finance updated 12 min ago" },
    },
    areas: {
      finance: {
        label: "Finance",
        status: "risk",
        summary: "Collections pressure is rising.",
        freshness: { state: "fresh", summary: "Finance updated 12 min ago" },
        href: "/dashboard/bi?area=finance",
      },
      sales: {
        label: "Sales",
        status: "watch",
        summary: "Pipeline is softer this week.",
        freshness: { state: "partial", summary: "Sales is partially refreshed" },
        href: "/dashboard/bi?area=sales",
      },
      operations: {
        label: "Operations",
        status: "good",
        summary: "Delivery is stable.",
        freshness: { state: "partial", summary: "Operations is partially refreshed" },
        href: "/dashboard/bi?area=operations",
      },
      ai: {
        label: "AI",
        status: "watch",
        summary: "Recent AI issues need review.",
        freshness: { state: "fresh", summary: "AI updated" },
        href: "/dashboard/bi?area=ai",
      },
    },
    areaDetails: {
      finance: { area: "finance", summary: "Collections pressure is rising.", bullets: [] },
      sales: { area: "sales", summary: "Pipeline is softer this week.", bullets: [] },
      operations: { area: "operations", summary: "Delivery is stable.", bullets: [] },
      ai: { area: "ai", summary: "Recent AI issues need review.", bullets: [] },
    },
  });

  assert.equal(cards[0]?.label, "Cash On Hand");
  assert.equal(cards[0]?.value, "$120,000");
  assert.equal(cards[3]?.label, "AR At Risk");
  assert.equal(cards[3]?.value, "$27,000");
});

test("buildLegacyWindowParams preserves the same date window across cockpit and legacy pages", () => {
  assert.equal(
    buildLegacyWindowParams("custom", "2026-04-01", "2026-05-01"),
    "dateRange=custom&from=2026-04-01&to=2026-05-01",
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/executive-bi/legacy-summary.test.ts`
Expected: FAIL with `Cannot find module '../../lib/executive-bi/legacy-summary'`

- [ ] **Step 3: Write the minimal helper implementation**

```ts
import type { ExecutiveBIResponse } from "@/lib/types/executive-bi";
import type { DateRangeParam } from "@/lib/types/financial-bi";

export interface LegacyExecutiveCard {
  label: string;
  value: string;
  helper: string;
}

function fmtCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function buildLegacyExecutiveCards(data: ExecutiveBIResponse): LegacyExecutiveCard[] {
  return [
    {
      label: "Cash On Hand",
      value: fmtCurrency(data.overview.health.cashOnHand),
      helper: "Canonical executive liquidity",
    },
    {
      label: "Net Margin",
      value: `${data.overview.health.netMargin.toFixed(1)}%`,
      helper: "Canonical executive efficiency",
    },
    {
      label: "Revenue Pace",
      value: fmtCurrency(data.overview.health.revenuePace),
      helper: "Canonical executive revenue velocity",
    },
    {
      label: "AR At Risk",
      value: fmtCurrency(data.overview.health.arAtRisk),
      helper: "Canonical executive receivables risk",
    },
    {
      label: "Runway",
      value: `${data.overview.health.runwayMonths.toFixed(1)} mo`,
      helper: "Canonical executive runway",
    },
  ];
}

export function buildLegacyWindowParams(dateRange: DateRangeParam, from?: string, to?: string) {
  const params = new URLSearchParams();
  params.set("dateRange", dateRange);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return params.toString();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/executive-bi/legacy-summary.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/executive-bi/legacy-summary.ts tests/executive-bi/legacy-summary.test.ts
git commit -m "feat: add shared legacy executive summary helpers"
```

### Task 2: Build the shared legacy executive-summary component

**Files:**
- Create: `components/executive-bi/LegacyExecutiveSummary.tsx`
- Modify: `app/dashboard/financial/page.tsx`
- Test: `tests/executive-bi/legacy-summary.test.ts`

- [ ] **Step 1: Extend the helper test to cover the component contract shape**

```ts
import type { LegacyExecutiveCard } from "../../lib/executive-bi/legacy-summary";

test("legacy executive cards expose stable labels in cockpit order", () => {
  const cards: LegacyExecutiveCard[] = [
    { label: "Cash On Hand", value: "$120,000", helper: "Canonical executive liquidity" },
    { label: "Net Margin", value: "18.4%", helper: "Canonical executive efficiency" },
    { label: "Revenue Pace", value: "$94,000", helper: "Canonical executive revenue velocity" },
    { label: "AR At Risk", value: "$27,000", helper: "Canonical executive receivables risk" },
    { label: "Runway", value: "7.2 mo", helper: "Canonical executive runway" },
  ];

  assert.deepEqual(cards.map((card) => card.label), [
    "Cash On Hand",
    "Net Margin",
    "Revenue Pace",
    "AR At Risk",
    "Runway",
  ]);
});
```

- [ ] **Step 2: Run test to verify the current suite still passes before component wiring**

Run: `npx tsx --test tests/executive-bi/legacy-summary.test.ts`
Expected: PASS

- [ ] **Step 3: Write the shared summary component and wire it into the finance legacy page**

```tsx
// components/executive-bi/LegacyExecutiveSummary.tsx
import type { LegacyExecutiveCard } from "@/lib/executive-bi/legacy-summary";

export function LegacyExecutiveSummary({
  title,
  subtitle,
  cards,
}: {
  title: string;
  subtitle: string;
  cards: LegacyExecutiveCard[];
}) {
  return (
    <section className="rounded-[26px] border border-brand-verde/10 bg-gradient-to-br from-brand-verde via-brand-verde-600 to-brand-verde-700 px-6 py-6 text-white shadow-sm">
      <div className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
          Legacy Detail Surface
        </p>
        <h2 className="mt-3 font-display text-3xl font-bold">{title}</h2>
        <p className="mt-3 text-sm leading-7 text-white/82">{subtitle}</p>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">{card.label}</div>
            <div className="mt-3 text-2xl font-bold text-white">{card.value}</div>
            <div className="mt-2 text-xs leading-5 text-white/72">{card.helper}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// app/dashboard/financial/page.tsx
const executive = useQuery<ExecutiveBIResponse>({
  queryKey: ["financial-legacy-executive", dateRange, from, to],
  queryFn: async () => {
    const res = await fetch(`/api/analytics/executive-bi?${buildParams(dateRange, from, to)}`);
    if (!res.ok) throw new Error("Failed to fetch executive BI");
    return res.json();
  },
});

const executiveCards = executive.data ? buildLegacyExecutiveCards(executive.data) : [];
```

- [ ] **Step 4: Run focused verification**

Run: `npx tsc --noEmit --pretty false`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/executive-bi/LegacyExecutiveSummary.tsx app/dashboard/financial/page.tsx tests/executive-bi/legacy-summary.test.ts
git commit -m "feat: align finance legacy summary with executive BI"
```

### Task 3: Align the QuickBooks legacy page with canonical executive KPIs

**Files:**
- Modify: `app/dashboard/insights/page.tsx`
- Reuse: `components/executive-bi/LegacyExecutiveSummary.tsx`
- Reuse: `lib/executive-bi/legacy-summary.ts`

- [ ] **Step 1: Add the canonical executive summary query**

```tsx
const executive = useQuery<ExecutiveBIResponse>({
  queryKey: ["insights-legacy-executive", dateRange, from, to],
  queryFn: async () => {
    const res = await fetch(`/api/analytics/executive-bi?${buildExecutiveWindow(dateRange, from, to)}`);
    if (!res.ok) throw new Error("Failed to fetch executive BI");
    return res.json();
  },
  staleTime: 5 * 60 * 1000,
});
```

- [ ] **Step 2: Replace the weak fallback top block with a clearer executive-framed header**

```tsx
{executive.data ? (
  <LegacyExecutiveSummary
    title="QuickBooks Analysis"
    subtitle="Use this page for deeper QuickBooks and receivables detail while the CEO cockpit remains the main executive entry point."
    cards={buildLegacyExecutiveCards(executive.data)}
  />
) : (
  <div className="mb-6 rounded-2xl border border-brand-tangerina/20 bg-brand-tangerina/8 p-4">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-tangerina">
      Legacy QuickBooks insights
    </p>
    <p className="mt-1 text-sm text-brand-verde">
      The unified CEO cockpit is now the primary BI entry point. Keep this page for deeper QuickBooks analysis.
    </p>
  </div>
)}
```

- [ ] **Step 3: Preserve window-aware links back to the cockpit and admin legacy**

```tsx
<Link href={`/dashboard/bi?${buildExecutiveWindow(dateRange, from, to)}`}>Open cockpit</Link>
<Link href={`/dashboard/bi/legacy?${buildExecutiveWindow(dateRange, from, to)}`}>Admin BI legacy</Link>
```

- [ ] **Step 4: Run verification**

Run: `npx tsc --noEmit --pretty false`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/insights/page.tsx
git commit -m "feat: align insights legacy summary with executive BI"
```

### Task 4: Align the admin legacy page and improve cockpit readability

**Files:**
- Modify: `components/executive-bi/legacy-admin-bi-page.tsx`
- Modify: `components/executive-bi/ExecutiveHero.tsx`
- Reuse: `components/executive-bi/LegacyExecutiveSummary.tsx`
- Reuse: `lib/executive-bi/legacy-summary.ts`

- [ ] **Step 1: Add the executive summary query to the admin legacy page**

```tsx
const executive = useQuery<ExecutiveBIResponse>({
  queryKey: ["admin-legacy-executive", dateRange],
  queryFn: async () => {
    const res = await fetch(`/api/analytics/executive-bi?dateRange=${dateRange}`);
    if (!res.ok) throw new Error("Failed to fetch executive BI");
    return res.json();
  },
  staleTime: 5 * 60 * 1000,
});
```

- [ ] **Step 2: Replace the current plain page title area with a stronger secondary-surface header**

```tsx
{executive.data ? (
  <LegacyExecutiveSummary
    title="Commercial and Operations Detail"
    subtitle="Use this legacy view for deeper commercial, operational, and student detail while the CEO cockpit remains the primary BI surface."
    cards={buildLegacyExecutiveCards(executive.data)}
  />
) : null}
```

- [ ] **Step 3: Fix cockpit hero readability**

```tsx
<section className="overflow-hidden rounded-[28px] border border-brand-verde/20 bg-gradient-to-br from-brand-verde-700 via-brand-verde-800 to-[#1b2925] text-white shadow-sm">
```

```tsx
<p className="mt-4 max-w-3xl text-[15px] leading-8 text-white/88">
  {overview.briefing}
</p>
```

```tsx
<div className="rounded-3xl border border-white/12 bg-[#f5f7f5]/8 p-5 backdrop-blur-md">
```

- [ ] **Step 4: Run verification**

Run: `npx tsc --noEmit --pretty false`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/executive-bi/legacy-admin-bi-page.tsx components/executive-bi/ExecutiveHero.tsx
git commit -m "feat: align admin legacy surface with executive BI"
```

### Task 5: Final verification and rollout safety

**Files:**
- Verify: `app/dashboard/bi/page.tsx`
- Verify: `app/dashboard/financial/page.tsx`
- Verify: `app/dashboard/insights/page.tsx`
- Verify: `components/executive-bi/legacy-admin-bi-page.tsx`
- Verify: `components/executive-bi/ExecutiveHero.tsx`
- Verify: `tests/executive-bi/legacy-summary.test.ts`

- [ ] **Step 1: Run the focused test suite**

Run: `npx tsx --test tests/executive-bi/legacy-summary.test.ts tests/executive-bi/executive-bi.test.ts tests/executive-bi/executive-bi-route.test.ts`
Expected: PASS

- [ ] **Step 2: Run full typecheck**

Run: `npx tsc --noEmit --pretty false`
Expected: PASS

- [ ] **Step 3: Run production build**

Run: `npx next build`
Expected: PASS with existing non-blocking ESLint warnings only

- [ ] **Step 4: Confirm no drift in shared executive KPI labels**

Run: `rg -n "Cash On Hand|Net Margin|Revenue Pace|AR At Risk|Runway" app/dashboard components/executive-bi lib/executive-bi`
Expected: shared labels only appear in the canonical executive path and the shared legacy summary path

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/financial/page.tsx app/dashboard/insights/page.tsx components/executive-bi/legacy-admin-bi-page.tsx components/executive-bi/ExecutiveHero.tsx components/executive-bi/LegacyExecutiveSummary.tsx lib/executive-bi/legacy-summary.ts tests/executive-bi/legacy-summary.test.ts
git commit -m "feat: unify legacy BI summaries with executive cockpit"
```
