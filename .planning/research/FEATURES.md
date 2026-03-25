# Feature Research

**Domain:** Brand reskin / visual identity migration — production web application (Next.js 14, two portals)
**Researched:** 2026-03-25
**Confidence:** HIGH (token architecture, font loading, contrast requirements) / MEDIUM (pattern/texture usage, animation conventions)

---

## Codebase Snapshot

Before feature mapping, key facts about what already exists:

| Area | Current State | Implication for Reskin |
|------|--------------|------------------------|
| Color tokens | CSS custom properties in `globals.css` + mirrored in `tailwind.config.ts` + mirrored in `lib/design-tokens.ts` (three sources) | Must update all three in sync; opportunity to collapse to one source |
| Hub pages | 74 hardcoded hex literals across 16 files, plus `const GOLD = "#C9A84C"` scattered per-file | Critical cleanup required; no token coverage yet |
| Analytics charts | 129 hardcoded hex literals across 17 Recharts chart components | Chart colors must be re-tokenised separately; cannot be replaced via CSS alone |
| Typography | `@import` Google Fonts (Space Grotesk + Inter + JetBrains Mono) in `globals.css` | Must replace with `next/font/local` for Blaak + Neue Montreal; Google import must be removed |
| Sidebar | `bg-secondary-dark` / `bg-gold-600` active state via Tailwind tokens | Updates via token layer only — no per-file edits needed |
| Shared `components/ui/` | Custom implementations (not shadcn originals); already use Tailwind tokens from `tailwind.config.ts` | Token layer update cascades here automatically |
| Dark mode | `darkMode: ["class"]` configured in Tailwind but no `.dark` tokens defined; effectively unused | No dark mode rework required this milestone |

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features a reskin milestone must deliver for the result to feel complete and coherent. Missing any of these produces a "patchy" result.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Token layer consolidation** — single source of truth for all 5 brand colors | Patchy reskins happen when colors are defined in multiple places; updating one but missing another is the #1 cause of visual inconsistency | MEDIUM | Collapse `globals.css` custom props, `tailwind.config.ts` theme values, and `lib/design-tokens.ts` into one canonical file. CSS custom props remain the runtime layer; Tailwind config and TS tokens reference them via `var()`. New palette: Creme #FFF8E8, Verde #2F443F, Tangerina #FF8142, Cafe com Leite #E1C19B, Caramelo #BD925F |
| **Semantic token naming** — role-based tokens on top of primitive palette | Without semantic tokens (`--color-brand-primary`, `--color-surface-default`, `--color-accent`) components are coupled to literal palette names (e.g. `gold-600`). Rebrand later = change hundreds of classnames | MEDIUM | Define at minimum: `--brand-primary` (Verde), `--brand-accent` (Tangerina), `--brand-surface` (Creme), `--brand-warm` (Cafe com Leite), `--brand-mid` (Caramelo), `--brand-on-dark` (white/Creme for text on Verde bg) |
| **Hub page hardcoded color removal** — replace 74 hex literals | All 16 hub files use inline `style={{ backgroundColor: GOLD }}` or per-file `const GOLD` constants. These are invisible to the token layer and will not update | HIGH | Audit each file; replace with Tailwind token classes or CSS variables. Most critical: `layout.tsx` (brand surface bg), `login/page.tsx`, `page.tsx` (status badges), all form pages |
| **Tailwind config rebrand** — swap palette keys from `gold-*` / `secondary-dark` to new brand names | Component classes like `bg-gold-600` and `bg-secondary-dark` are scattered throughout dashboard sidebar, stat cards, and buttons. Either remap the token values (keeping class names) or introduce new semantic classes | MEDIUM | Recommend remapping values, not names, for this milestone (less diff). `gold-500` → Verde value, `gold-600` → Tangerina accent as needed. Introduce `brand-verde`, `brand-tangerina`, `brand-creme`, `brand-caramelo` as new Tailwind color keys |
| **Font replacement** — Blaak (display/headings) + Neue Montreal (body/UI), remove Google Fonts import | Typography is the strongest signal of brand identity; keeping Inter/Space Grotesk while changing colors produces a "wrapped but not rebranded" feel | HIGH | Use `next/font/local` in `app/layout.tsx` (root layout). Serve from `/public/fonts/`. Define CSS variables `--font-display` (Blaak) and `--font-sans` (Neue Montreal). Both must be WOFF2 for performance. Remove Google Fonts `@import` from `globals.css` |
| **Typography hierarchy reassignment** — Blaak for display+h1-h3, Neue Montreal for h4-h6+body+UI | Blaak is a premium serif. Using it at body sizes is illegible. Using sans-serif for display headings negates the brand identity signal | LOW | Update `globals.css` h1-h3 + `font-display` Tailwind class to map to Blaak. Update `font-sans` to Neue Montreal. `font-mono` keeps JetBrains Mono (unchanged; used for codes/IDs) |
| **Dashboard sidebar rebrand** — Verde (#2F443F) background replacing `#1A1A1A`, Tangerina active states | Sidebar is the highest-frequency visible element for admin users; it is the "face" of the admin portal | LOW | Change `bg-secondary-dark` CSS value to Verde. Change `bg-gold-600` active nav item to Tangerina. Update `bg-gold-500` avatar/logo dot to Tangerina or Caramelo |
| **Hub layout surface rebrand** — Creme (#FFF8E8) as page background, replace `#FBF8F0` inline style | Hub layout already uses a warm cream-ish hardcoded hex (#FBF8F0 ≈ Creme). Replacing with the official token unifies with the brand system | LOW | Replace inline `style={{ backgroundColor: "#FBF8F0" }}` in `app/hub/layout.tsx` with `className="bg-brand-creme"` |
| **Focus ring color update** — `--primary-500` focus outline must map to new brand color | Accessibility is already implemented; focus rings currently reference `--primary-500` (Classic Gold). This must update to reflect new primary brand color (Tangerina or Verde) | LOW | Update `*:focus-visible` outline and `button:focus-visible` box-shadow color references in `globals.css` |
| **Chart color palette rebrand** — 129 hardcoded Recharts hex values replaced with brand-derived palette | Charts are data communication tools; using the old gold/blue palette while all UI chrome is rebranded looks like a different product embedded in the page | HIGH | Extract a `chartColors` constant in `lib/design-tokens.ts` using new brand palette. Replace hardcoded `stroke=`, `fill=`, `CartesianGrid stroke=` values in all 17 analytics/dashboard chart components. Minimum: Verde for primary series, Tangerina for accents, Caramelo for tertiary, success/warning/error semantics preserved |
| **Status badge color review** — verify Hub status badge colors work on Creme surface | Hub dashboard page uses inline background/text hex pairs for PAID/SENT/OVERDUE/PARTIAL/DRAFT status badges. These were designed for a white surface. The Creme background may reduce apparent contrast | LOW | Re-check badge backgrounds against Creme (#FFF8E8) surface; PAID green, OVERDUE red, PARTIAL orange are likely fine. DRAFT gray-on-cream needs verification. Use WebAIM contrast checker (minimum 4.5:1 for AA normal text) |
| **Logo integration** — compass/arrow speech-bubble logo replacing "C" letter placeholder | All logo placements currently use a colored square with "C" as a placeholder. The new mark must replace this everywhere: Hub header, Dashboard sidebar, email templates if any | MEDIUM | Replace in `app/hub/layout.tsx` (header logo) and `components/dashboard/professional-sidebar.tsx` (sidebar logo). Use `next/image` with the logo SVG. Maintain at least 3 variants: horizontal (sidebar), icon-only (hub header), seal (footer or login page) |

### Differentiators (Competitive Advantage)

Features that elevate the reskin from "color swap" to "brand moment." Not required to ship, but separate a professional result from a minimal one.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Verde + Creme hero backgrounds on Hub login/onboarding** — full-bleed verde section with Creme card overlay | Login and set-password are the first impressions for clients. Currently they use plain white with a gold dot. A full-bleed Verde background with Creme card and Tangerina CTA creates the "premium, warm, authoritative" feel described in the brief | MEDIUM | Apply to `app/hub/login/page.tsx`, `set-password/page.tsx`, `reset-password/page.tsx`. Verde bg, Creme card, Blaak headline, Neue Montreal body, Tangerina submit button |
| **Typographic repeat / pattern in login panel** — subtle brand pattern on verde hero section | The brand identity includes typographic repeat and geometric arrow patterns. A low-opacity SVG background pattern (e.g. compass arrows or brand wordmark tile) on the verde hero section adds depth and brand texture without busy-ness | MEDIUM | Implement as an SVG data URI or `/public/patterns/` file applied via `background-image` CSS on the hero column. Opacity 4-8% to keep it subtle. Must not fail on mobile or impact CLS |
| **Page transition micro-animations** — subtle fade-in for main content on route change | Next.js App Router does not animate route transitions by default. A subtle 150ms opacity fade on the `<main>` element adds perceived polish and makes the brand feel intentional | MEDIUM | Use CSS `@keyframes` on the main content wrapper with `animation: fadeIn 150ms ease-out`. No JS required. Must not delay TTI |
| **Sidebar hover states with Tangerina left-border accent** | Currently sidebar hover = `bg-secondary-gray`. A 3px left-border in Tangerina on hover gives a premium "indicator" feel common in high-end SaaS tools (Linear, Notion, Stripe Dashboard) | LOW | Add `border-l-2 border-transparent hover:border-tangerina` to each nav item. Works within existing transition duration tokens |
| **Hub card elevation system** — Creme surface with Caramelo border-on-hover | Hub invoice cards and stat sections currently use white/gray. Applying `bg-brand-creme border border-brand-caramelo/20 hover:border-brand-caramelo/60` creates a warm, distinct card identity consistent with the premium palette | LOW | Update `app/hub/page.tsx` invoice list items and any Hub-specific card wrappers. Does not require changes to shared `Card` component (use `className` prop override) |
| **Receipt / document page brand treatment** — Creme paper background, Verde accents, Blaak invoice number | Receipts are printed/shared artifacts. Carreira USA receipts with the new brand feel like premium documents vs. generic software output | MEDIUM | Update `app/hub/documents/receipt/[invoiceId]/page.tsx`. Apply brand typography, Verde header bar with Creme text, Tangerina total amount highlight |
| **Tabular number font review** — ensure `font-feature-settings: "tnum"` applies correctly to Neue Montreal | Financial data displays (invoice amounts, stat cards) use the existing `.tabular-nums` utility. Some fonts handle tabular figures differently. Neue Montreal needs to be verified that its `tnum` OpenType feature is available in the licensed weight files | LOW | Check during font integration. If Neue Montreal lacks tnum, use explicit `font-variant-numeric: tabular-nums` as fallback. JetBrains Mono is still available for IDs/codes where true monospace is required |
| **Chart legend and tooltip skin** — Recharts Legend + Tooltip styled with Neue Montreal, Creme background, Verde border | Out-of-box Recharts tooltips use system fonts and a generic white popup. After chart color rebrand, the tooltips will still feel unbranded | LOW | Create a shared `ChartTooltip` wrapper component with `contentStyle={{ backgroundColor: '#FFF8E8', border: '1px solid #2F443F', fontFamily: 'var(--font-sans)' }}`. Apply to all 17 chart components |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem like obvious inclusions but create scope creep, visual inconsistency, or technical debt in a reskin milestone.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Dark mode implementation** | Brand has strong dark surface potential (Verde sidebar already uses dark pattern) | Tailwind dark mode is configured but zero dark tokens are defined. Adding a full dark/light theme doubles the token surface area and requires every new component to handle both states. This is a separate design system milestone, not a reskin task | Defer to a dedicated dark mode milestone after reskin stabilises. The sidebar uses dark surfaces intentionally (dark bg + light text) — this is a deliberate design choice, not dark mode |
| **Full component-by-component rewrite** — touching every file's JSX structure alongside the reskin | Tempting to "improve" components while in their files during the reskin | Structural rewrites mixed with visual updates create large, hard-to-review PRs. Regressions in data logic are impossible to separate from CSS bugs. Reskins that accidentally change behaviour are the #1 source of production incidents | Change only visual attributes (color classes, font classes, background values). Separate structural improvements to a different PR |
| **New icon system** — replacing Lucide React icons with brand-illustrated icons during the reskin | Brand identity includes illustrated icons | SVG icon illustration is a multi-week asset production task. Using illustrated icons in nav/UI contexts (vs. marketing contexts) also reduces legibility. Lucide is well-tested and accessible | Introduce illustrated icons only in brand-forward surfaces (login page hero, empty states, onboarding). Keep Lucide in data-dense admin UI |
| **Animation library introduction** (Framer Motion, Motion) | Brand "feels premium" so adding rich animations seems appropriate | Adding an animation library to a Next.js 14 App Router application increases bundle size and introduces RSC/client boundary complexity. The existing `transition-all duration-200` CSS pattern already covers 95% of reskin animation needs | Stick to CSS transitions and `@keyframes` for this milestone. Reserve Framer Motion evaluation for a future interactive component milestone |
| **Global font smoothing changes** | Neue Montreal at certain weights may look better with `-webkit-font-smoothing: antialiased` vs `subpixel-antialiased` | Already enabled in `globals.css` body styles. Changing this globally can affect all existing text rendering unexpectedly. Per-element overrides add noise | Verify current `antialiased` setting works for Neue Montreal before any changes. It is already set; no action needed unless visual QA reveals issues |
| **Responsive typography fluid scaling** (clamp, vw-based font sizes) | Fluid typography is a 2025 best practice | The existing scale uses CSS custom properties (`--text-h1: 2.25rem`) that are static. Converting to fluid values changes every heading size across both portals, invalidating all existing layout spacing. This is a typography system overhaul, not a reskin | Keep static rem scale. Fluid typography is a future enhancement once layout is stable under the new brand |
| **Print stylesheet rebrand** | Receipts can be printed; print styles should match brand | The existing `PrintButton.tsx` and receipt page already function for print. Comprehensive print stylesheet work is a non-trivial CSS task with device-specific quirks. A minimal update (Blaak heading, brand colors on receipt header) is achievable; a full print design is not reskin scope | Scope to minimum: font-family update for print + Verde header bar on receipt. No full print stylesheet rewrite |

---

## Feature Dependencies

```
Token Layer Consolidation
    └──required by──> Tailwind Config Rebrand
                          └──required by──> Sidebar Rebrand
                          └──required by──> Button / StatCard / Card auto-update (cascades)
                          └──required by──> Focus Ring Update

Font Replacement (next/font/local, Blaak + Neue Montreal)
    └──required by──> Typography Hierarchy Reassignment
                          └──enables──> Hub Login/Onboarding hero treatment
                          └──enables──> Receipt/document brand treatment
                          └──enables──> Chart tooltip skin (Neue Montreal in tooltips)

Hub Hardcoded Color Removal
    └──required by──> Hub Layout Surface Rebrand (Creme bg token)
    └──required by──> Status Badge Color Review (must be on Creme, not inline bg)

Logo Integration
    └──depends on──> Logo asset files in /public/
    └──independent of──> Token layer

Chart Color Rebrand
    └──depends on──> Token Layer (chartColors from design-tokens.ts)
    └──independent of──> Typography replacement

Verde + Creme Hub Login Hero (differentiator)
    └──requires──> Font Replacement (Blaak headline)
    └──requires──> Token Layer (verde / creme / tangerina classes)

Sidebar Tangerina left-border accent (differentiator)
    └──requires──> Tailwind Config Rebrand (tangerina token available)
```

### Dependency Notes

- **Token layer must be Phase 1**: Every other feature depends on the canonical palette and Tailwind token names being available. No parallel work can reliably proceed without this.
- **Font replacement blocks typography-dependent differentiators**: Hub login hero and receipt branding are blocked until Blaak and Neue Montreal are served via `next/font`.
- **Hub hardcoded color removal is independent**: Can proceed in parallel with chart rebrand but must not be combined into the same PR (unrelated files).
- **Logo integration is fully independent**: Only needs asset files. Can be done in any phase once assets are available from the brand team.

---

## MVP Definition

### Launch With (v1) — "Complete Reskin"

Minimum set that produces a visually cohesive result across both portals.

- [ ] **Token layer consolidation** — canonical palette in CSS custom props, Tailwind config + TS tokens reference via `var()`. New 5-color brand palette defined.
- [ ] **Semantic token naming** — `--brand-primary`, `--brand-accent`, `--brand-surface`, `--brand-warm`, `--brand-mid` defined and used.
- [ ] **Tailwind config rebrand** — `brand-verde`, `brand-tangerina`, `brand-creme`, `brand-caramelo` added as color keys; old `gold-*` values remapped to new palette values.
- [ ] **Font replacement** — Blaak + Neue Montreal loaded via `next/font/local`. Google Fonts `@import` removed. WOFF2 files in `/public/fonts/`.
- [ ] **Typography hierarchy reassignment** — h1-h3 use Blaak. Body + UI use Neue Montreal.
- [ ] **Dashboard sidebar rebrand** — Verde bg, Tangerina active states.
- [ ] **Hub hardcoded color removal** — all 74 hex literals and `const GOLD` instances replaced with token classes.
- [ ] **Hub layout surface rebrand** — Creme token applied to Hub page background.
- [ ] **Focus ring color update** — reflects new primary brand color.
- [ ] **Logo integration** — compass/arrow mark replaces "C" placeholder in both portals (requires logo assets).
- [ ] **Status badge contrast check** — verified WCAG AA on Creme surface.

### Add After Validation (v1.x) — "Brand Polish"

- [ ] **Chart color rebrand** — triggered when visual QA confirms portal chrome is cohesive and analytics charts visually break the pattern.
- [ ] **Verde + Creme Hub login hero** — triggered when product team confirms it matches brand direction.
- [ ] **Chart tooltip skin** — follows chart color rebrand.
- [ ] **Sidebar Tangerina left-border accent** — triggered if visual QA finds hover states feel flat.
- [ ] **Hub card elevation system** — triggered if Hub dashboard feels visually disconnected from login page.

### Future Consideration (v2+) — "Brand Moments"

- [ ] **Typographic repeat / pattern on login** — requires finalized SVG pattern assets from brand team.
- [ ] **Receipt document brand treatment** — requires alignment on "brand document" standards for client-facing PDF/print.
- [ ] **Page transition micro-animations** — defer until performance budget is assessed post-reskin.
- [ ] **Dark mode** — separate milestone; requires full two-theme token system design.
- [ ] **Illustrated icon system** — requires asset production from design team.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Token layer consolidation | HIGH | MEDIUM | P1 |
| Semantic token naming | HIGH | LOW | P1 |
| Tailwind config rebrand | HIGH | MEDIUM | P1 |
| Font replacement (Blaak + Neue Montreal) | HIGH | HIGH | P1 |
| Typography hierarchy reassignment | HIGH | LOW | P1 |
| Dashboard sidebar rebrand | HIGH | LOW | P1 |
| Hub hardcoded color removal | HIGH | HIGH | P1 |
| Hub layout surface rebrand | MEDIUM | LOW | P1 |
| Focus ring color update | LOW | LOW | P1 |
| Logo integration | HIGH | MEDIUM | P1 (asset-dependent) |
| Status badge contrast check | MEDIUM | LOW | P1 |
| Chart color rebrand | MEDIUM | HIGH | P2 |
| Verde + Creme hub login hero | HIGH | MEDIUM | P2 |
| Chart tooltip skin | LOW | LOW | P2 |
| Sidebar Tangerina left-border accent | LOW | LOW | P2 |
| Hub card elevation system | MEDIUM | LOW | P2 |
| Typographic pattern in login | MEDIUM | MEDIUM | P3 |
| Receipt brand treatment | MEDIUM | MEDIUM | P3 |
| Page transition micro-animations | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch — reskin is not "complete" without these
- P2: Should have — add in v1.x pass once P1 is merged and QA'd
- P3: Nice to have — future consideration; blocked on design assets or performance validation

---

## Competitor Feature Analysis

This is an internal tool rebrand, not a competitive product. The relevant comparison is against industry standards for premium fintech/edtech client portals.

| Standard | Premium Fintech Reference (Stripe, Mercury, Brex) | This Reskin Target | Gap |
|----------|---------------------------------------------------|-------------------|-----|
| Color token architecture | 3-layer (primitives → semantic → component tokens) | Currently 1 layer (primitives only) | Add semantic layer |
| Typography | Custom/licensed typefaces, clear display/body split | Google Fonts currently; moving to Blaak + Neue Montreal | Requires font asset acquisition |
| Chart theming | Charts match overall portal color palette | 129 hardcoded hex values, mismatched | Chart rebrand in P2 |
| Dark surfaces | Dark sidebar + light content (intentional, not dark-mode) | Already has dark sidebar | Matches standard |
| Focus management | Branded focus rings (not default browser blue) | Already custom; needs color update | Minor update |
| Logo marks | Multi-variant SVGs (icon-only + full wordmark) | Currently "C" placeholder | Logo assets needed |

---

## Critical Contrast Checks Required

The new palette introduces combinations that must be verified against WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text) before shipping:

| Combination | Context | Risk Level |
|-------------|---------|------------|
| White/Creme text on Verde (#2F443F) bg | Sidebar nav labels, Hub login hero text | LOW — Verde is dark, expect pass |
| Tangerina (#FF8142) on Verde (#2F443F) bg | Active sidebar nav item, CTA buttons on dark bg | MEDIUM — orange on dark green, check luminance |
| Dark text on Creme (#FFF8E8) surface | Hub page body text, card labels | LOW — Creme is very light |
| Caramelo (#BD925F) on Creme (#FFF8E8) | Decorative borders, secondary labels | HIGH — brown on cream is low-contrast; use for decorative only, not text |
| Tangerina (#FF8142) on white (#FFFFFF) | Primary CTA button labels | MEDIUM — needs check; orange buttons with white text are a known contrast risk |

Use [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) before finalising token values.

---

## Sources

- [Tailwind CSS Best Practices 2025: Design Token Patterns](https://www.frontendtools.tech/blog/tailwind-css-best-practices-design-system-patterns)
- [CSS Variables Guide: Design Tokens & Theming (2025)](https://www.frontendtools.tech/blog/css-variables-guide-design-tokens-theming-2025)
- [Building a Multi-Brand Design System with Tailwind](https://www.thinkmill.com.au/blog/building-a-multi-brand-design-system-with-tailwind-tips-tricks-and-tradeoffs)
- [Dark Mode with Design Tokens in Tailwind CSS](https://www.richinfante.com/2024/10/21/tailwind-dark-mode-design-tokens-themes-css)
- [Next.js Font Optimization: Getting Started](https://nextjs.org/docs/app/getting-started/fonts)
- [Custom fonts without compromise using next/font — Vercel](https://vercel.com/blog/nextjs-next-font)
- [Customizing shadcn/ui Themes Without Breaking Updates](https://medium.com/@sureshdotariya/customizing-shadcn-ui-themes-without-breaking-updates-a3140726ca1e)
- [Design Tokens in Practice: Figma Variables to Production Code](https://www.designsystemscollective.com/design-tokens-in-practice-from-figma-variables-to-production-code-fd40aeccd6f5)
- [shadcn/ui Chart component (Recharts v3 + CSS variables)](https://ui.shadcn.com/docs/components/radix/chart)
- [WCAG 1.4.3 Contrast (Minimum) — W3C](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Pangram Pangram: Best Font Pairings 2025](https://pangrampangram.com/blogs/journal/best-font-pairings-2025)

---

*Feature research for: Carreira USA brand reskin — Next.js 14 two-portal web application*
*Researched: 2026-03-25*
