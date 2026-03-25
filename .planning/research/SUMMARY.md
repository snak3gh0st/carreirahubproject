# Project Research Summary

**Project:** Carreira USA Brand Identity Reskin
**Domain:** Visual identity migration — production Next.js 14 App Router dual-portal web application
**Researched:** 2026-03-25
**Confidence:** HIGH

## Executive Summary

This project is a brand identity reskin applied to a production two-portal application (Admin Dashboard + Client Hub) built on Next.js 14 App Router with Tailwind CSS v3. Expert reskins of this type succeed by treating design tokens as the foundation layer — all visual changes flow through a canonical token system, never through per-file hardcoded values. The recommended approach is a dependency-ordered three-phase execution: establish the token and font infrastructure first, apply it to components and portal-specific code second, then validate with accessibility checks and cross-portal visual QA third. No new npm packages are required; the entire solution uses existing project primitives (`next/font/local`, CSS custom properties, Tailwind v3 `theme.extend`).

The key risk is the codebase's current state: the Client Hub portal bypasses the design token system almost entirely, with 74 hardcoded hex literals across 16 files and per-file `const GOLD = "#C9A84C"` constants, while 129 hardcoded hex values exist inside Recharts chart components that CSS changes cannot reach. These two areas require explicit, targeted migration work — they will not be fixed by updating `tailwind.config.ts` or `globals.css` alone. The Admin Dashboard is better positioned, with most components already using Tailwind token classes that will cascade correctly once the token layer is updated.

The critical accessibility constraint is that Tangerina (`#FF8142`) fails WCAG AA (4.5:1) on white and Creme backgrounds at approximately 2.9:1 — it must be used only on dark surfaces (Verde sidebar, dark buttons) or as a non-text accent. Verde (`#2F443F`) on white is safe at approximately 7.5:1 and should be the primary interactive text color. These contrast rules must be defined before writing any component code, not discovered during QA.

---

## Key Findings

### Recommended Stack

No additional npm packages are required for this reskin. The stack uses primitives already in the project: `next/font/local` (built into Next.js 14.2.35), CSS custom properties (browser-native), and Tailwind v3 `theme.extend` (tailwindcss@3.4.19 already installed). Font files should be placed in `public/fonts/` as `.otf` files — `next/font/local` handles them natively — with optional conversion to `.woff2` (approximately 68% smaller) for improved Vercel edge delivery performance.

**Core technologies:**
- `next/font/local`: Font loading for Blaak (display/serif) + Neue Montreal (body/UI sans) — prevents CLS, generates `<link rel="preload">` automatically, zero external network dependency
- CSS Custom Properties (`:root`): Three-layer token architecture (primitives in `brand.css`, semantic aliases in `semantic.css`, portal-scoped overrides in `portal-dashboard.css` / `portal-hub.css`)
- Tailwind CSS v3 `theme.extend`: Maps CSS variable references to utility classes; `brand-verde`, `brand-tangerina`, `brand-creme`, `brand-caramelo`, `brand-cafe` as new color keys with `var()` references
- `lib/brand-colors.ts` (new): JS constant exports of brand hex values for Recharts props, which cannot consume CSS variables
- `components/brand/Logo.tsx` (new): Multi-variant inline SVG component using `currentColor`, works on both dark sidebar and light hub header without prop-drilling color values

**Critical version constraint:** Stay on Tailwind CSS v3. Do NOT migrate to Tailwind v4 `@theme` directive during this reskin — it would require rewriting all design tokens and is a separate project.

### Expected Features

**Must have (table stakes — reskin is "patchy" without these):**
- Token layer consolidation: single source of truth; collapse `globals.css`, `tailwind.config.ts`, and `lib/design-tokens.ts` into coordinated layers all referencing CSS variables
- Semantic token naming: `--brand-primary` (Verde), `--brand-accent` (Tangerina), `--brand-surface` (Creme), `--brand-warm` (Cafe com Leite), `--brand-mid` (Caramelo)
- Tailwind config rebrand: add `brand-verde`, `brand-tangerina`, `brand-creme`, `brand-caramelo` color keys; remap existing `gold-*` values
- Font replacement: Blaak + Neue Montreal via `next/font/local`; remove Google Fonts `@import` from `globals.css`
- Typography hierarchy: Blaak for h1–h3 and `font-display`; Neue Montreal for body/UI `font-sans`; JetBrains Mono unchanged for code/IDs
- Dashboard sidebar rebrand: Verde (`#2F443F`) background replacing `#1A1A1A`; Tangerina active states
- Hub hardcoded color removal: all 74 hex literals and `const GOLD` instances across 16 files replaced with token classes
- Hub layout surface rebrand: Creme token on Hub page background
- Focus ring update: reflects new brand primary color
- Logo integration: compass/arrow mark replaces "C" placeholder in both portals (requires logo asset files from brand team)
- Status badge contrast check: verified WCAG AA on Creme surface

**Should have (brand polish, add in v1.x):**
- Chart color rebrand: 129 hardcoded Recharts hex values replaced via `lib/constants/chart-colors.ts`
- Verde + Creme Hub login hero: full-bleed Verde bg, Creme card, Blaak headline, Tangerina CTA
- Chart tooltip skin: Neue Montreal, Creme background, Verde border
- Sidebar Tangerina left-border hover accent
- Hub card elevation system: Creme surface with Caramelo border-on-hover

**Defer to v2+:**
- Dark mode: requires full two-theme token system; `darkMode: ["class"]` is configured but zero dark tokens exist — separate milestone
- Illustrated icon system: multi-week asset production task
- Responsive fluid typography (`clamp`/`vw` scaling): invalidates all existing layout spacing
- Typographic repeat/pattern on login: blocked on finalized SVG pattern assets
- Page transition micro-animations: defer until performance budget assessed post-reskin

### Architecture Approach

The recommended architecture uses a three-layer CSS token system: primitive tokens in `styles/tokens/brand.css` define raw palette values; semantic aliases in `styles/tokens/semantic.css` assign role-based names (`--color-accent`, `--color-surface-base`); portal-scoped overrides in `styles/tokens/portal-dashboard.css` and `styles/tokens/portal-hub.css` use `[data-portal="dashboard"]` and `[data-portal="hub"]` attribute selectors to resolve the same semantic token to different primitive values per portal. Tailwind config references the semantic token layer via `var()`. This means shared components like `Button` use `bg-accent` everywhere and automatically inherit the correct brand color based on which portal they render within — no conditional logic in component code.

**Major components:**
1. `lib/fonts.ts` — single font definition file; exports Blaak and Neue Montreal `localFont` instances with CSS variable output; imported only in `app/layout.tsx`
2. `styles/tokens/` directory — four CSS files forming the token hierarchy; `@import`ed into `app/globals.css`
3. `components/brand/Logo.tsx` — multi-variant inline SVG with `currentColor` awareness; `variant` prop selects symbol vs. full wordmark; replaces all "C" placeholder instances
4. `components/brand/PatternBackground.tsx` — decorative texture wrapper using CSS `background-image` data URI SVG patterns
5. `lib/brand-colors.ts` — JS constant exports of brand hex values (for Recharts props, which cannot consume CSS variables); mirrors `brand.css` primitives
6. Portal layout wrappers (`app/dashboard/layout.tsx`, `app/hub/layout.tsx`) — add `data-portal` attributes to activate CSS variable scope overrides

### Critical Pitfalls

1. **GOLD constant per-file duplication** — `const GOLD = "#C9A84C"` exists in 14+ hub files. Create `lib/constants/brand.ts` exporting all brand hex values as the absolute first commit of the reskin, before any visual changes. Run `grep -rn '"#C9A84C"\|const GOLD' app` until it returns zero results.

2. **Recharts chart colors are invisible to CSS** — 129 hardcoded `fill="#..."` / `stroke="#..."` SVG attributes across 7+ chart components are not Tailwind classes. CSS variable updates do not affect them. Create `lib/constants/chart-colors.ts` and replace all chart color props explicitly. Verify with `grep -rn 'fill="#\|stroke="#' components app --include="*.tsx"` returning zero results.

3. **Tangerina fails WCAG AA on light backgrounds** — `#FF8142` on white is approximately 2.9:1 (requirement: 4.5:1). Define safe usage rules in the token layer before writing any component code: Tangerina is CTA-on-dark only; Verde (`#2F443F`) is the safe interactive text color on light surfaces. Cafe com Leite (`#E1C19B`) and Caramelo (`#BD925F`) are decorative only, never text.

4. **Google Fonts `@import` in `globals.css` blocks rendering** — the existing `@import url('https://fonts.googleapis.com/...')` is render-blocking and causes FOUT. Remove it entirely in Phase 1. All fonts must be loaded exclusively via `next/font` — mixing the two mechanisms means the CSS `@import` wins and defeats optimization.

5. **Hub portal diverges silently** — the Admin Dashboard uses Tailwind token classes (will cascade when config updates); the Hub portal uses inline styles (will not cascade). Treat as two separate reskin checklists. After reskin, run `grep -rn 'style={{.*backgroundColor\|style={{.*color' app/hub --include="*.tsx"` to verify zero brand-color inline styles remain.

6. **Bulk Tailwind class replacement breaks semantic blues** — 246 hardcoded `blue-*`/`indigo-*` class references exist in `app/`; not all should change. `blue-*` is also used for info/status semantics that should remain blue. Audit file-by-file, never via global sed-replace.

---

## Implications for Roadmap

Based on the combined research, the dependency ordering from ARCHITECTURE.md's build order maps cleanly to three phases. Token infrastructure must precede component work because every component depends on token names being available. Hub hardcoded removal must be explicit because it does not cascade from config changes. Chart colors are independent and high-effort, making them a natural second pass after the primary reskin is validated.

### Phase 1: Token and Font Foundation

**Rationale:** Every other phase depends on canonical token names and font CSS variables existing. No parallel component work can reliably proceed without this layer. Font loading must be resolved here because FOUT artifacts make visual verification unreliable in later phases. Contrast rules must be defined here — not discovered during QA — to avoid rework.

**Delivers:** Complete design token infrastructure; Blaak and Neue Montreal serving via `next/font/local`; Google Fonts `@import` removed; all five brand colors available as CSS custom properties and Tailwind utility classes; safe contrast usage rules documented; `lib/constants/brand.ts` exporting JS hex constants for chart use.

**Addresses:** Token layer consolidation, semantic token naming, Tailwind config rebrand, font replacement, typography hierarchy, focus ring update (all P1 features)

**Avoids:** GOLD constant per-file pitfall (create `brand.ts` first commit), Google Fonts FOUT pitfall, Tangerina contrast failures (contrast rules defined before any component code)

**Files created:** `lib/fonts.ts`, `public/fonts/` (font binaries), `styles/tokens/brand.css`, `styles/tokens/semantic.css`, `styles/tokens/portal-dashboard.css`, `styles/tokens/portal-hub.css`, `lib/constants/brand.ts`

**Files modified:** `app/globals.css` (remove `@import`, add `@import` for token files), `app/layout.tsx` (apply font variables), `tailwind.config.ts` (add brand color keys, update fontFamily)

### Phase 2: Component and Portal Shell Update

**Rationale:** Depends on Phase 1 token names being available. Admin Dashboard components update by swapping token class names — low risk and largely cascading. Hub portal requires explicit targeted work to replace all 74 inline hex values and `const GOLD` instances — not a cascade. Both portals must be treated as separate sub-checklists within this phase.

**Delivers:** Visually rebranded Admin Dashboard sidebar (Verde bg, Tangerina active states); shared UI components updated (`Button`, `Badge`, `StatCard`, `Input`, `Card`); Hub portal fully migrated off inline brand colors; Logo component replacing all "C" placeholder instances; `data-portal` attributes on both layout wrappers activating portal-scoped CSS overrides.

**Addresses:** Dashboard sidebar rebrand, Hub hardcoded color removal, Hub layout surface rebrand, logo integration, status badge contrast check (all P1 features)

**Avoids:** Hub/Dashboard silent divergence pitfall, bulk Tailwind replace pitfall (file-by-file audit required), inline style bypass of token system

**Files created:** `components/brand/Logo.tsx`, `components/brand/PatternBackground.tsx`

**Files modified:** `components/ui/button.tsx`, `components/ui/badge.tsx`, `components/ui/stat-card.tsx`, `components/ui/input.tsx`, `components/ui/card.tsx`, `components/dashboard/professional-sidebar.tsx`, `app/dashboard/layout.tsx`, `app/hub/layout.tsx`, all 16 hub portal page files with inline color removal

### Phase 3: Chart Rebrand and Brand Polish

**Rationale:** Charts are independent of the typography and token work (Recharts uses JSX props, not CSS). Deferring to Phase 3 allows the core reskin to ship and be validated while chart work proceeds in parallel or sequentially. This phase also covers differentiator features (Hub login hero, card elevation) that require the Phase 1 + 2 foundation to be in place.

**Delivers:** All 17 Recharts chart components updated to brand color palette; chart tooltips branded with Neue Montreal and Creme/Verde treatment; Hub login/set-password pages with Verde hero + Creme card layout; Hub card elevation system; sidebar Tangerina hover accent.

**Addresses:** Chart color rebrand, Verde + Creme Hub login hero, chart tooltip skin, sidebar hover accent, Hub card elevation (P2 features)

**Avoids:** Charts-not-updated pitfall (explicit `grep -rn 'fill="#\|stroke="#'` verification gate)

**Files created:** `lib/constants/chart-colors.ts`

**Files modified:** `components/dashboard/conversion-funnel.tsx`, `components/dashboard/revenue-chart.tsx`, `components/dashboard/charts/revenue-trend-chart.tsx`, `components/dashboard/charts/top-customers-chart.tsx`, `components/dashboard/charts/invoice-status-chart.tsx`, `components/analytics/top-customers-chart.tsx`, `app/dashboard/analytics/page.tsx`, `app/hub/login/page.tsx`, `app/hub/set-password/page.tsx`, `app/hub/reset-password/page.tsx`

### Phase 4: QA, Accessibility Audit, and Production Validation

**Rationale:** Deferred until both portals are visually complete. Accessibility validation requires the final color combinations to be in place — running contrast checks against in-progress work creates false signal. Production URL testing (not localhost) catches portal-specific config issues that local dev masks.

**Delivers:** Lighthouse accessibility score baseline comparison (pre vs post reskin); axe DevTools zero critical violations; WebAIM contrast verification for all color pairs; cross-browser font rendering check; incognito favicon/OG image verification; production build smoke test (`npm run build && npm start`).

**Addresses:** "Looks done but isn't" checklist from PITFALLS.md; WCAG AA compliance for both portals independently verified

### Phase Ordering Rationale

- Token infrastructure is a hard dependency for all component work — no phase can skip Phase 1
- Hub inline style removal is independent of dashboard component work but must be in the same phase as component updates (Phase 2) to catch both portal visual states simultaneously
- Chart work (Phase 3) is fully independent from typography and token work — Recharts SVG props are unaffected by CSS changes — but logically belongs after the portal chrome is validated
- Logo integration (Phase 2) is asset-dependent; if logo files arrive late, Phase 2 can ship without logo and logo can be merged as a follow-up without blocking the reskin

### Research Flags

Phases that can use established patterns and do not need additional research:
- **Phase 1:** `next/font/local` is well-documented with official Next.js docs; CSS custom property architecture is a standard pattern; Tailwind v3 `theme.extend` is stable and well-understood
- **Phase 2:** Shared component token swaps are mechanical; `data-portal` attribute scoping is a standard CSS specificity pattern
- **Phase 4:** Lighthouse, axe DevTools, WebAIM Contrast Checker are standard tooling with established workflows

Phases that may need targeted investigation during implementation:
- **Phase 3 (Charts):** Recharts v3 CSS variable support behavior needs verification — the research recommends JS constants as the reliable fallback, but if CSS variable support is confirmed for SVG `fill`, it would simplify the architecture. Validate on one chart before applying to all 17.
- **Phase 2 (Logo):** SVG path data for the compass/arrow logo mark must come from the brand team. The component architecture is defined, but implementation blocks on asset delivery. If vector files arrive in a format other than SVG (e.g., AI, PDF), conversion will be needed.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core technologies (`next/font/local`, Tailwind v3, CSS custom properties) verified against official Next.js 14 docs and Tailwind v3 docs. No experimental or edge-case APIs. |
| Features | HIGH | Codebase snapshot analysis is based on direct file analysis (grep counts, file paths) rather than inference. Feature prioritization reflects actual state of two portals. |
| Architecture | HIGH | Three-layer token pattern and `data-portal` CSS scoping are well-established industry patterns verified against multiple authoritative sources. Build order is dependency-driven, not opinion-driven. |
| Pitfalls | HIGH | Six of the pitfalls are derived from direct codebase analysis (GOLD constant count, Recharts hex counts, blue class counts, specific file paths). Contrast ratio claims are mathematically verifiable via WebAIM. |

**Overall confidence: HIGH**

### Gaps to Address

- **Logo asset files:** Logo integration (Phase 2) is architecturally designed but cannot be implemented without the compass/arrow SVG files from the brand team. If assets are not available before Phase 2 begins, implement the `Logo.tsx` component with a placeholder and merge logo SVG paths in a follow-up commit.

- **Exact color scale values:** The color stops in `brand.css` (Creme scale, Verde scale, etc.) were approximated in STACK.md research and noted as starting points pending tints.dev generation. Run all five brand hex anchors through tints.dev before finalizing `brand.css` — the approximated values should not be shipped without this step.

- **Neue Montreal tabular figures:** Whether the licensed Neue Montreal weight files include the `tnum` OpenType feature is unknown without inspecting the actual font binary. Verify during Phase 1 font integration — if `tnum` is absent, add `font-variant-numeric: tabular-nums` as explicit CSS on financial data displays.

- **Recharts CSS variable support:** Research recommends JS constants as the reliable approach for Recharts colors, but documents that CSS variables in SVG `fill` are technically possible with parent-element definition. Validate this on one chart component in Phase 3 before committing to either approach for all 17 charts.

- **Font licensing:** Blaak and Neue Montreal are commercial typefaces. Confirm that the licenses permit self-hosted web embedding before committing the `.otf` files to the repository. If licenses restrict web use or have per-domain requirements, this is a Phase 1 blocker.

---

## Sources

### Primary (HIGH confidence)
- [Next.js Font Optimization — Official Docs (v16.2.1)](https://nextjs.org/docs/app/getting-started/fonts) — `next/font/local` integration, App Router behavior, preloading scope, CSS variable output
- [Next.js Font Module API Reference](https://nextjs.org/docs/app/api-reference/components/font) — `variable`, `src` array, `adjustFontFallback`, `display` parameters
- [Tailwind CSS v3 Theme Documentation](https://tailwindcss.com/docs/theme) — `theme.extend.fontFamily`, `theme.extend.colors` with `var()` CSS variable references
- [WCAG 1.4.3 Contrast (Minimum) — W3C](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html) — 4.5:1 normal text, 3:1 large text requirements
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) — contrast ratio calculations for new palette combinations
- Codebase direct analysis — GOLD constant count (14+ files), Recharts hex count (129 literals across 17 files), hardcoded Tailwind blue/indigo count (246 in app/, 71 in components/), hub inline style pattern in `app/hub/layout.tsx`

### Secondary (MEDIUM confidence)
- [Vercel: Custom fonts without compromise using next/font](https://vercel.com/blog/nextjs-next-font) — self-hosting rationale, preload behavior
- [tints.dev](https://www.tints.dev/) — 11-stop color scale generation from brand hex values (widely used community tool)
- [Fontsource OTF→WOFF2 converter](https://fontsource.org/tools/converter) — format conversion for performance (~68% size reduction)
- [CSS Custom Properties Strategy Guide — Smashing Magazine](https://www.smashingmagazine.com/2018/05/css-custom-properties-strategy-guide/) — dual-layer token architecture pattern
- [Multiple Themes with Next.js, Tailwind CSS, and CSS Custom Properties](https://dev.to/dlw/multiple-themes-for-next-js-with-next-themes-tailwind-css-and-css-custom-properties-2knp) — `data-portal` CSS variable scoping approach
- [Recharts Customize Guide](https://recharts.github.io/en-US/guide/customize/) — SVG prop system, CSS variable limitations in SVG context
- [Orange You Accessible? — color contrast case study](https://www.bounteous.com/insights/2019/03/22/orange-you-accessible-mini-case-study-color-ratio/) — orange/warm color contrast failure patterns

### Tertiary (LOW confidence)
- [culori vs chroma-js vs tinycolor2 comparison 2026](https://www.pkgpulse.com/blog/culori-vs-chroma-js-vs-tinycolor2-color-manipulation-javascript-2026) — library selection rationale for optional programmatic color scale generation
- [OTF vs WOFF2 performance comparison](https://font-converters.com/compare/otf-vs-woff2) — ~68% file size reduction claim (third-party comparison, not independently verified)

---

*Research completed: 2026-03-25*
*Ready for roadmap: yes*
