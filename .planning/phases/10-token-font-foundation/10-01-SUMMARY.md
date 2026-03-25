---
phase: 10-token-font-foundation
plan: 01
subsystem: ui
tags: [css-custom-properties, design-tokens, next-font, brand-colors, typography]

# Dependency graph
requires: []
provides:
  - "public/fonts/blaak/ — 12 Blaak OTF font files (Thin through Black, normal+italic)"
  - "public/fonts/neue-montreal/ — 8 Neue Montreal OTF font files (Light through Bold, normal+italic)"
  - "lib/fonts.ts — blaak and neueMontreal localFont instances with CSS variable output"
  - "lib/constants/brand.ts — BRAND_COLORS hex constants, BrandColor type, BRAND_COLOR_SAFE_USE contrast rules"
  - "styles/tokens/brand.css — Layer 1 CSS custom properties for all 5 brand primitives + tint scales"
  - "styles/tokens/semantic.css — Layer 2 semantic role aliases referencing brand primitives"
  - "styles/tokens/portal-dashboard.css — Layer 3 dashboard portal overrides via [data-portal='dashboard']"
  - "styles/tokens/portal-hub.css — Layer 3 hub portal overrides via [data-portal='hub']"
affects:
  - "10-02 — Tailwind integration consumes these CSS vars and font variable names"
  - "Phase 11+ — all UI work depends on these token files"

# Tech tracking
tech-stack:
  added: ["next/font/local"]
  patterns:
    - "Three-layer CSS custom property system: brand primitives → semantic aliases → portal overrides"
    - "JS brand constants mirror CSS primitives for non-CSS consumers (Recharts, inline styles)"
    - "Portal scoping via [data-portal] attribute on layout wrappers"

key-files:
  created:
    - "lib/fonts.ts"
    - "lib/constants/brand.ts"
    - "styles/tokens/brand.css"
    - "styles/tokens/semantic.css"
    - "styles/tokens/portal-dashboard.css"
    - "styles/tokens/portal-hub.css"
    - "public/fonts/blaak/ (12 OTF files)"
    - "public/fonts/neue-montreal/ (8 OTF files)"
  modified: []

key-decisions:
  - "Self-hosted fonts via next/font/local — OTF files committed to repo, no external CDN dependency"
  - "Three-layer token hierarchy (primitives/semantic/portal) established as single source of truth"
  - "Brand color tint scales are approximate starting points — verify via tints.dev before Phase 11"
  - "Tangerina (#FF8142) WCAG AA failure documented in JS constants — safe use rules enforced in code"

patterns-established:
  - "Token Layer 1 (brand.css): raw hex values in :root, never consumed directly by components"
  - "Token Layer 2 (semantic.css): role-based aliases via var(--brand-*) references"
  - "Token Layer 3 (portal-*.css): portal-scoped overrides via [data-portal] attribute selector"
  - "JS constants (brand.ts): mirrors CSS Layer 1, used for Recharts/dynamic styles — never hardcode hex elsewhere"

issues-created: []

# Metrics
duration: 3min
completed: 2026-03-25
---

# Phase 10 Plan 01: Token & Font Foundation Summary

**Three-layer CSS token hierarchy (brand primitives + semantic aliases + portal overrides) with self-hosted Blaak and Neue Montreal fonts via next/font/local**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-25T14:43:38Z
- **Completed:** 2026-03-25T14:46:14Z
- **Tasks:** 2
- **Files modified:** 26 (22 font binaries + 4 source files)

## Accomplishments

- Copied all 20 brand font OTF files (12 Blaak + 8 Neue Montreal) into public/fonts/
- Created lib/fonts.ts with two localFont instances exposing --font-blaak and --font-neue-montreal CSS variables
- Created lib/constants/brand.ts with all 5 brand hex values, BrandColor type, and WCAG AA contrast safety rules
- Created 4 CSS token files forming the three-layer hierarchy: brand primitives, semantic aliases, and portal-specific overrides for both dashboard and hub portals

## Task Commits

Each task was committed atomically:

1. **Task 1: Copy font files and create font definition module + brand constants** - `fbc5f1f` (feat)
2. **Task 2: Create CSS token hierarchy (brand primitives, semantic aliases, portal overrides)** - `4f4b134` (feat)

**Plan metadata:** (final docs commit — see below)

## Files Created/Modified

- `public/fonts/blaak/` — 12 Blaak OTF files (Thin 100 through Black 900, normal + italic variants)
- `public/fonts/neue-montreal/` — 8 Neue Montreal OTF files (Light 300 through Bold 700, normal + italic variants)
- `lib/fonts.ts` — blaak and neueMontreal localFont instances; outputs --font-blaak and --font-neue-montreal CSS custom properties
- `lib/constants/brand.ts` — BRAND_COLORS const (5 hex values), BrandColor union type, BRAND_COLOR_SAFE_USE contrast guidance
- `styles/tokens/brand.css` — Layer 1: --brand-creme, --brand-verde, --brand-tangerina, --brand-cafe, --brand-caramelo; verde + tangerina tint scales 50-900/600
- `styles/tokens/semantic.css` — Layer 2: --color-primary, --color-accent, --color-surface-base, --color-text-primary, --color-text-on-dark, --color-sidebar-bg, --color-sidebar-active, etc.
- `styles/tokens/portal-dashboard.css` — Layer 3: [data-portal="dashboard"] scoped overrides (gray-50 page bg)
- `styles/tokens/portal-hub.css` — Layer 3: [data-portal="hub"] scoped overrides (Creme page bg, Verde text)

## Decisions Made

- Self-hosted fonts via next/font/local — OTF files committed to repo; avoids external font CDN dependency and serves fonts at zero latency
- Three-layer token hierarchy codifies the separation between raw brand values (Layer 1), functional roles (Layer 2), and per-portal customization (Layer 3)
- Brand color tint scales are approximated; STATE.md carries a blocker to verify via tints.dev before Phase 11 ships UI
- Tangerina's WCAG AA failure on white/Creme (#2.9:1) is enforced in BRAND_COLOR_SAFE_USE — never to be used as text on light backgrounds

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — this plan creates new foundation files only. No UI rendering is wired yet; token files will be imported in Plan 02.

## Next Phase Readiness

- All 6 source files and 20 font binaries are committed and ready for Plan 02 (Tailwind integration)
- Plan 02 must wire these files: import brand.css + semantic.css into globals.css, register font variables in tailwind.config.ts, and apply data-portal attributes to layout wrappers
- Blocker from STATE.md remains: tint scale values are approximate — verify via tints.dev before Phase 11 ships component UI

---
*Phase: 10-token-font-foundation*
*Completed: 2026-03-25*
