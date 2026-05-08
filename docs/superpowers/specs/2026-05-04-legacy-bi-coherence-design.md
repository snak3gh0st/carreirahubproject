# Legacy BI Coherence Design

Date: 2026-05-04
Repo: `carreirahubproject`
Scope: Make legacy BI surfaces visually clearer while ensuring shared numbers stay coherent with the unified CEO cockpit.

## Goal

Keep `/dashboard/financial`, `/dashboard/insights`, and `/dashboard/bi/legacy` as supporting surfaces during the unified BI rollout, but remove KPI drift between them and the new `/dashboard/bi` cockpit.

The legacy pages should feel intentionally secondary, not abandoned, and any executive-grade number that appears in more than one surface must come from the same canonical source.

## Product Direction

Use the unified executive BI layer as the source of truth for shared KPI values.

Legacy pages remain useful for deeper analysis:

- `/dashboard/bi` = primary executive home
- `/dashboard/financial` = deeper finance detail
- `/dashboard/insights` = deeper QuickBooks and receivables detail
- `/dashboard/bi/legacy` = deeper commercial and operational detail

But they should not compete with the cockpit for the meaning of shared numbers.

## What “Coherent Numbers” Means

For this rollout, coherence means:

1. shared KPIs use the same calculation across pages
2. shared KPIs use the same period semantics across pages
3. shared KPIs use compatible labels so the same number is not interpreted differently

Examples of executive-shared KPIs:

- `Cash On Hand`
- `Net Margin`
- `Revenue Pace`
- `AR At Risk`
- `Runway`

If one of these appears in a legacy surface, it must be derived from the same executive aggregation path used by the cockpit.

## Recommended Approach

### 1. Canonical executive summary

Extend the unified BI stack so legacy pages can consume the executive summary payload for shared KPI surfaces instead of recomputing parallel summary cards.

This does not mean the full legacy pages should be rebuilt on top of the cockpit API. It only means:

- shared top-level KPI framing comes from one place
- detail tables, specialized charts, and page-specific analytics can still come from their existing domain services

### 2. Legacy pages become “detail companions”

Each legacy page should have:

- a stronger, more legible header
- a clear fallback/support role
- shared executive summary numbers from the canonical executive source where appropriate
- page-specific analytical depth below that

The page should answer:

- what this surface is for
- how it relates to the cockpit
- which detail it adds that the cockpit intentionally does not

### 3. Reduce duplicate truth surfaces

Where a legacy page currently shows a top section that acts like a parallel executive summary, prefer one of these:

- replace that section with canonical executive numbers
- or reduce it to contextual detail instead of competing summary

The legacy pages should not each invent their own top-of-page “truth layer.”

## Visual Direction

Use the approved `A` direction:

- cockpit remains visually strongest
- legacy pages get higher contrast and better readability
- fallback framing becomes clearer
- headers feel premium enough to trust, but still secondary to the cockpit

Specific changes:

- darker and more solid page headers
- stronger text contrast
- cleaner top action pills linking back to the cockpit
- more disciplined use of accent color for actual warnings and actions

## Technical Design

### Shared data source

Use `getExecutiveBIData(...)` as the canonical source for shared executive metrics.

Legacy pages should consume either:

- the executive API route directly for shared summary sections
- or a server/client helper derived from the same executive service

The key rule is that the same KPI should not be recomputed through a different service path when it is meant to represent the same business concept.

### Page responsibilities

#### `/dashboard/financial`

Keep:

- CFO briefing
- action items
- detailed finance tabs
- exports and QB refresh actions

Change:

- top framing should clearly state this is finance detail beneath the main cockpit
- any executive summary metrics duplicated here should align with the executive source

#### `/dashboard/insights`

Keep:

- QuickBooks analytical depth
- receivables forecast
- operational finance detail

Change:

- stronger fallback framing
- any executive-style summary layer should be minimized or aligned with executive source

#### `/dashboard/bi/legacy`

Keep:

- commercial
- operational
- student detail views

Change:

- stronger top framing and clearer support role
- KPI summary area should be treated as a secondary detail dashboard, not a parallel executive home

## Constraints

- Do not weaken the new cockpit as the primary BI entry point
- Do not break existing detail views, exports, or drill-down tables
- Do not introduce a second “source of truth” for executive KPIs
- Keep rollout incremental and safe

## Verification

Success means:

1. the same executive KPI shown in the cockpit and a legacy page matches exactly for the same window
2. the visual hierarchy clearly marks legacy pages as supporting surfaces
3. the legacy pages still preserve their useful deep-detail workflows
4. no existing finance/QB detail paths regress

## Implementation Scope

This work should be executed in two layers:

1. unify shared KPI sourcing and period semantics
2. apply visual polish to the legacy headers and shared summary framing

That order matters. The numbers need to become coherent before the polish is treated as done.
