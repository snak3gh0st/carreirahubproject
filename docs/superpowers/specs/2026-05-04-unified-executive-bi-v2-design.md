# Unified Executive BI V2 Design

## Goal

Replace the current fragmented BI entry points with one executive BI that combines:

- financial truth from QuickBooks
- commercial and client context from Clint
- operational delivery context from the admin/ops data layer

The CEO should no longer need to choose between `Cockpit CEO`, `Financial`, `Insights`, and `BI Legado` in the main navigation. The primary dashboard becomes a single business-health surface with layered interpretation: money first, commercial/client explanation second, operational execution third.

## Product Decisions

- Main navigation will expose only one intelligence entry: `BI Executivo`.
- Labels containing `legado` should be removed from the primary user-facing navigation.
- Existing financial and QuickBooks pages remain available only as internal drill-downs, not top-level menu items.
- The hero copy in the executive BI must be short and executive:
  - 2 to 4 sentences maximum
  - state the main financial risk or opportunity
  - state the next recommended action
  - avoid long AI-generated essay blocks

## Information Hierarchy

### Layer 1: QuickBooks truth

The top KPI band must be redefined around CEO-grade QuickBooks measures:

- `Revenue`
- `Cash on Hand`
- `Open AR`
- `Overdue AR`
- `Collections Rate`

These replace the current top-band emphasis on:

- `Net Margin`
- `Revenue Pace`
- `AR At Risk`
- `Runway`

Those derived metrics can still exist deeper in the BI, but they should not define the first executive read. The first layer should show the clearest monetary state directly tied to the QuickBooks-backed financial model.

### Layer 2: Clint commercial and client context

Immediately below the financial truth layer, the BI should explain the commercial/client picture using Clint-backed information. This layer should answer:

- which commercial activity is producing revenue
- whether pipeline and conversion are supporting future collections
- whether client concentration is creating risk

Target KPI set:

- `Deals Won`
- `Pipeline Value`
- `Lead Conversion`
- `New Customers`
- `Top Client Concentration`

This section should be framed as the explanation of the money layer, not as a separate BI.

### Layer 3: Operational delivery context

The third layer should show operational execution pressure and delivery health. This layer explains whether the business can sustain the commercial and financial outcomes already shown above.

Target KPI set:

- `Matrículas`
- `Alunos Ativos`
- `Itens em Risco`
- `Atrasos de Entrega`
- `Throughput / Capacity`

This layer must feel operational, not financial. It should sit below the QuickBooks and Clint layers so the reading order remains:

1. what the money says
2. what the client/commercial engine says
3. what execution capacity says

## Navigation Changes

### Main navigation

Primary menu changes:

- rename `Cockpit CEO` to `BI Executivo`
- remove `BI Legado` from the main menu
- remove `Financeiro Legado` from the main menu
- remove `Insights QB` from the main menu

The user should see only one intelligence destination in the sidebar.

### Internal drill-downs

The old surfaces remain as support pages, linked from within the BI:

- `Finance Deep Dive`
- `QuickBooks Diagnostics`
- `Clint / CRM Detail`
- `Ops Detail`

These pages are not removed yet; they are repositioned as internal analysis views.

## Executive BI Content Structure

### Hero

The hero should be rewritten to use a compact executive narrative:

- lead with the main state of the business
- mention the most important pressure point
- mention the next action

Example shape:

`Revenue is down in the active window, open AR remains elevated, and overdue collections need immediate attention. Clint pipeline is active but not yet offsetting receivables pressure. Today’s priority is collections execution on overdue accounts and review of the highest-concentration clients.`

The hero should not dump raw AI text, markdown remnants, or repeated section prose.

### KPI Band

The health band should be rebuilt around the QuickBooks-first KPI set and formatted as the canonical executive summary. Each KPI card should include:

- direct number
- short plain-language helper
- if needed, subtle context label for the selected reporting window

### Area blocks

The lower BI should become three clear business blocks:

- `Finance`
- `Commercial & Clients`
- `Operations`

`AI` remains a supporting block, but it should not compete with finance/commercial/operations in the first read. It can stay lower on the page or be framed as enablement/infrastructure.

## Data Model Changes

The current executive health contract is too oriented toward derived finance metrics. It should be expanded or reshaped to support the new first-layer KPI band.

Current contract emphasis:

- `cashOnHand`
- `netMargin`
- `revenuePace`
- `arAtRisk`
- `runwayMonths`

Target contract emphasis:

- `revenue`
- `cashOnHand`
- `openAr`
- `overdueAr`
- `collectionsRate`

Recommended implementation direction:

- preserve current derived fields if needed for deeper panels
- introduce a new executive top-band contract for the first-layer KPI strip
- source these values from the same canonical financial BI / QuickBooks pipeline already used after the audit fixes

For the Clint layer, the executive BI service should also surface a canonical commercial summary contract instead of forcing the page to derive this directly from legacy admin strings.

## Copy and Formatting Rules

- no `legacy` wording in the primary executive journey
- no long paragraph walls in the hero
- no duplicated financial explanation across hero and side panels
- no markdown-like artifacts in visible UI text
- all executive copy should be plain-language, short, and decision-oriented

## Legacy Surface Positioning

The old pages are not deleted in this phase. They are repositioned.

- `Financial` becomes deep analysis
- `Insights QB` becomes QuickBooks diagnostics
- old `BI legacy` becomes admin/commercial/ops detail support

They remain useful for operators and finance users, but they should not compete with the single executive BI in navigation or visual hierarchy.

## Error Handling and Freshness

The BI should continue to expose data freshness, but in a compact format.

- show one executive freshness status near the hero
- allow each block to expose delayed/partial data when necessary
- if Clint or ops data is delayed but QuickBooks is fresh, the BI should still render with clear block-level freshness language

## Testing and Verification Expectations

Implementation should verify:

- sidebar shows only `BI Executivo` as the intelligence entry
- old intelligence pages are removed from primary menu exposure
- executive page uses the new KPI band definitions
- top KPI values are sourced from the canonical QuickBooks-backed executive path
- Clint layer renders with canonical commercial/client inputs
- operations layer remains functional
- old drill-down pages remain reachable via internal links
- TypeScript, focused tests, and production build pass

## Rollout Scope

This phase covers:

- executive BI information architecture update
- executive copy restructuring
- sidebar/menu cleanup
- KPI band contract and UI update
- Clint integration into the executive BI structure
- repositioning old BI surfaces as drill-downs

This phase does not require deleting old pages or removing their routes yet.
