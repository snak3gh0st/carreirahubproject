# CEO Unified BI Design

Date: 2026-05-04
Repo: `carreirahubproject`
Scope: Unified executive BI cockpit for CEO-first decision making

## Goal

Replace the current fragmented BI experience with one executive cockpit that gives the CEO a fast, trustworthy read of business health, immediate decision priorities, and guided drill-down across finance, sales, operations, and AI.

The cockpit must answer, in under 60 seconds:

1. Is the business healthy right now?
2. What needs a decision this week?
3. Where should I drill down to understand the issue?

## Product Direction

The correct direction is an `Executive Flight Deck`:

- a single executive home as the primary BI entry point
- area drill-downs that stay inside the same cockpit experience
- KPI hierarchy optimized for CEO decisions, not for departmental reporting

This is not a finance dashboard with extra tabs, and not a long generic mega-dashboard. It is an executive control surface.

## Rollout Strategy

The new cockpit should launch first as the new primary BI entry point, while current pages remain alive for a short validation period:

- `/dashboard/financial`
- `/dashboard/bi`
- `/dashboard/insights`

These legacy surfaces remain available only as fallback and parity references until the new cockpit proves KPI consistency and decision usefulness. After validation, they should be retired or deeply reduced.

Reasoning:

- avoids a risky big-bang cutover
- allows KPI parity verification against legacy pages
- preserves trust while the new executive layer stabilizes

## Information Architecture

### Primary Navigation

The cockpit uses one executive home plus four area drill-downs:

- `Executive Home`
- `Finance`
- `Sales`
- `Operations`
- `AI`

This navigation must feel like one product, not five dashboards. The home remains the anchor. Each area inherits the same executive framing and shows a compact contextual summary at the top so the user never loses orientation.

### Navigation Model

Recommended model:

- one executive home with area entry cards
- each area opens as a subview in the same cockpit
- KPI cards and alerts on the home can deep-link directly into a relevant area section

Examples:

- `AR At Risk` on the home opens `Finance` focused on collections and aging
- pipeline slowdown opens `Sales` focused on conversion, source quality, and blocked deals
- delivery bottleneck opens `Operations` focused on student progression and team load
- AI alert opens `AI` focused on adoption, cost, reliability, and operational impact

Avoid:

- multiple disconnected dashboards
- nested tab overload
- parallel top-level dashboards with overlapping KPI meaning

## Executive Home Architecture

The executive home should be structured in this order:

### 1. CEO Briefing Hero

The first block on the page. It should summarize:

- overall business state
- most important shift since the prior period
- what requires a CEO decision now

This block is narrative, not chart-first.

### 2. Decision Queue

A ranked list of 3-5 urgent items by business impact. This queue translates numbers into actions.

Each item should include:

- issue title
- severity
- business impact
- suggested action or next step
- drill-down target

This block must not repeat KPI cards. It must convert them into decisions.

### 3. Health KPI Band

The top KPI band should contain only the health metrics that matter at CEO level:

- `Cash On Hand`
- `Net Margin`
- `Revenue Pace`
- `AR At Risk`
- `Runway`

Why these 5:

- liquidity
- business efficiency
- growth pace
- collections risk
- survival horizon

These five express health without flooding the CEO with departmental metrics.

### 4. Business Health Story

A concise block that explains the combined meaning of cash, margin, collections, and trend movement.

It should answer:

- are fundamentals improving or deteriorating?
- is growth healthy or costly?
- is the current pace sustainable?

### 5. Risk Map

A cross-area risk view showing the highest business threats across:

- finance
- sales
- operations
- AI

The point is not to show all issues. The point is to show what can hurt the business soon.

### 6. Area Entry Cards

Four cards that open the deeper domain views:

- Finance
- Sales
- Operations
- AI

These are not equal-weight top-level tabs competing with the hero. They come after the executive picture is already clear.

### 7. Cross-Area Performance Canvas

A comparison layer that helps the CEO relate domains instead of reading each one in isolation.

Examples:

- revenue vs pipeline health
- collections risk vs operational capacity
- client concentration vs delivery risk
- AI usage vs team productivity/cost

### 8. Momentum and Watchlist

A final summary area for:

- what is improving
- what is stalling
- what needs follow-up this week

This should create continuity for weekly executive usage.

## KPI Strategy

### Executive Layer

The home must use a small set of decision-grade KPIs. Every KPI must have:

- one canonical calculation
- one canonical label
- one canonical explanation

No KPI should mean one thing in one page and another thing elsewhere.

### Domain Layers

The deeper areas can expose richer metrics, but they must explain the executive KPIs rather than compete with them.

Recommended domain mapping:

#### Finance

Purpose: determine whether the business is financially safe and well-managed.

Expected focus:

- cash and runway
- P&L
- collections
- AR aging
- at-risk invoices
- customer concentration

#### Sales

Purpose: determine whether growth is healthy and predictable.

Expected focus:

- pipeline flow
- conversion
- closer performance
- lead source quality
- deal velocity
- blocked high-value deals

#### Operations

Purpose: determine whether the company can deliver outcomes with quality and speed.

Expected focus:

- active students
- student progression by phase
- stalled enrollments
- team capacity
- operational bottlenecks
- delivery-risk cohorts

#### AI

Purpose: determine whether AI is helping the business or creating cost/noise.

Expected focus:

- adoption by area
- cost/usefulness
- failure or fallback volume
- tool usage concentration
- operational impact

## Source Unification Strategy

Today the value is split across three main surfaces:

- `/dashboard/financial`
- `/dashboard/insights`
- `/dashboard/bi`

The unified cockpit should not merge these at the view layer only. It needs a unified executive aggregation layer behind the UI.

### Recommended Aggregation Layers

#### Domain Aggregation

Four domain outputs:

- `finance`
- `sales`
- `operations`
- `ai`

Each domain layer owns:

- KPI calculations
- timestamps/freshness
- block-level narrative inputs
- risk candidates

#### Executive Aggregation

A layer above the four domains that builds:

- `executiveBriefing`
- `decisionQueue`
- `healthBand`
- `riskMap`
- `momentumWatchlist`

This layer exists to synthesize. It must not reimplement raw data logic already owned by the domain layers.

## Data Trust and Status States

The cockpit must communicate data confidence clearly without exposing technical noise.

Required states:

- `Fresh`
- `Stale`
- `Partial`
- `Unavailable`

### Display Behavior

At executive level:

- one discreet business-data health indicator near the top
- domain freshness only when relevant
- no silent stale numbers

Example copy:

- `Finance updated 12 min ago`
- `Operations partially delayed`
- `AI usage unavailable for this period`

Rules:

- never show misleading values when a domain is partial or unavailable
- if executive synthesis depends on stale or missing data, the state must be visible

## UX Rules

### Do

- prioritize narrative before charts
- make every top KPI actionable
- preserve executive context in drill-downs
- use one language system across all areas
- keep the first fold calm and decisive

### Do Not

- show a wall of charts first
- repeat the same KPI in multiple blocks without added meaning
- let area navigation compete with the executive hero
- overload the first screen with operational detail
- keep duplicate legacy KPI definitions alive after migration

## Success Criteria

The design succeeds when:

1. The CEO can understand business health and priorities in under 60 seconds.
2. Each top-level KPI or alert leads to a useful drill-down.
3. There is one trusted answer to each key executive metric.
4. Finance, sales, operations, and AI coexist without flattening the hierarchy.
5. Legacy pages can be retired after parity validation without losing decision quality.

## Delivery Phasing

### Phase 1

Build:

- unified aggregation contract
- executive home
- decision queue
- health KPI band
- risk map

Keep legacy pages as fallback.

### Phase 2

Build:

- `Finance` drill-down
- `Sales` drill-down
- `Operations` drill-down
- `AI` drill-down

Ensure each drill-down is traceable from executive entry points.

### Phase 3

Run parity and trust validation:

- KPI consistency
- stale-state behavior
- executive usefulness
- drill-down continuity

Then promote the new cockpit fully and reduce/remove legacy pages.

## Open Decisions Resolved In This Spec

- The BI will be unified into one CEO-first cockpit.
- The recommended visual direction is `Executive Flight Deck`.
- The navigation model is `executive home + area tabs/subviews`.
- The rollout model is `new cockpit first, legacy fallback temporarily`.
- The scope includes `finance + sales + operations + AI`.

