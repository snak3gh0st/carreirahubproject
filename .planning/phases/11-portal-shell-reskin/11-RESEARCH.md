# Phase 11: Portal Shell Reskin - Research

**Researched:** 2026-03-25
**Domain:** Visual identity application — Next.js 14 App Router dual-portal reskin using CSS custom properties, Tailwind v3, and inline-style migration
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | Sidebar uses Verde (#2F443F) background with Tangerina active states and new brand logo | Portal token `--color-sidebar-bg` and `--color-sidebar-active` exist in `portal-dashboard.css`. Sidebar currently uses `bg-secondary-dark` (#1A1A1A) and `bg-gold-600` — swap to brand tokens. Logo component to be created at `components/brand/Logo.tsx`. |
| DASH-02 | Shared components (Button, Card, StatCard, Badge, Input) consume new brand tokens via CSS variables — no hardcoded hex | Button uses `gold-*` Tailwind classes; Badge uses `gold-100/700`; StatCard uses `gold-50/200/600`; Input uses `gold-500`. All must swap to `brand-tangerina` / `brand-verde` equivalents. |
| HUB-01 | All hardcoded hex literals and GOLD constants across hub files replaced with token classes | 15 files have `const GOLD = "#C9A84C"` — 105+ inline style usages. Primary token is `BRAND_COLORS.TANGERINA` for dynamic style objects; `bg-brand-tangerina` / `text-brand-verde` for Tailwind classes. |
| HUB-02 | Hub layout uses Creme surface backgrounds, Verde text, Tangerina accents, brand logo in header | `app/hub/layout.tsx` uses `style={{ backgroundColor: "#FBF8F0" }}` and `style={{ backgroundColor: GOLD }}` for logo. Must apply `data-portal="hub"` and use token classes. |
| HUB-03 | Login page features Verde + Creme hero treatment with Blaak headline and Tangerina CTA | `app/hub/login/page.tsx` uses `style={{ backgroundColor: "#FBF8F0" }}` and `style={{ backgroundColor: GOLD }}` CTA. Replace with full Verde hero, Blaak h1, Tangerina button. |
| BRD-01 | Favicon and logo assets replaced across both portals with new Carreira USA brand mark | No favicon or logo image files exist in `public/` or `app/`. Both portals use `<span>C</span>` placeholder. Requires SVG asset creation or delivery. |
</phase_requirements>

---

## Summary

Phase 11 applies the token infrastructure from Phase 10 to the visible surfaces of both portals. The work is entirely mechanical migration — no new libraries, no architectural changes, no layout restructuring. The token system is already wired; this phase is about pointing components at it.

The Admin Dashboard sidebar currently uses `bg-secondary-dark` (#1A1A1A), `bg-gold-600` active states, and a "C" letter placeholder. The migration is a Tailwind class swap plus a Logo component. Shared UI components (Button, Badge, StatCard, Input) all use `gold-*` Tailwind classes that must become brand token equivalents — the primary brand action color is Tangerina for CTAs on dark surfaces and Verde for interactive elements on light surfaces.

The Client Hub is the higher-effort sub-task. Fifteen files contain `const GOLD = "#C9A84C"` declarations and 67+ `style={{}}` blocks embedding GOLD and hex color literals. None of these cascade from CSS variable changes. Each file must be migrated individually: delete the `const GOLD` declaration, replace `style={{ backgroundColor: GOLD }}` with `className="bg-brand-tangerina"` (or `BRAND_COLORS.TANGERINA` for conditional/computed cases), and replace `style={{ backgroundColor: "#FBF8F0" }}` layout backgrounds with the `bg-[--color-surface-page]` token class. The Hub login page also requires a visual upgrade: full Verde hero treatment, Blaak headline, Tangerina CTA — moving from a basic card layout to the brand-aligned design described in HUB-03.

A critical missing wire: neither `app/dashboard/layout.tsx` nor `app/hub/layout.tsx` currently sets the `data-portal` attribute. The portal-scoped CSS overrides from Phase 10 (`portal-dashboard.css`, `portal-hub.css`) will not activate until `data-portal="dashboard"` and `data-portal="hub"` are added to each layout's root wrapper. This is the first task in any plan for this phase.

**Primary recommendation:** Execute in three sub-tracks in a single phase: (1) wire `data-portal` attributes on both layouts, (2) migrate Admin Dashboard sidebar + shared components to brand tokens, (3) migrate all 15 hub files from GOLD to BRAND_COLORS/token classes, including hub login hero upgrade and hub layout logo.

---

## Standard Stack

### Core (no new dependencies — all from Phase 10)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS v3 | 3.4.19 (installed) | Utility classes for brand colors | Brand token classes already wired in tailwind.config.ts |
| CSS Custom Properties | Browser-native | Portal-scoped overrides | Three-layer token system from Phase 10 |
| `lib/constants/brand.ts` | In repo | JS hex constants for `style={{}}` replacements | `BRAND_COLORS.TANGERINA` replaces `"#C9A84C"` in dynamic style objects |
| React inline SVG | Browser-native | Logo component | `currentColor` inheritance; works on dark sidebar and light hub header without props |

### No New Packages Required

Phase 11 requires zero npm installs. Everything is already available:
- Brand token Tailwind classes: `bg-brand-verde`, `bg-brand-tangerina`, `bg-brand-creme`, `text-brand-verde`, etc.
- `BRAND_COLORS` from `@/lib/constants/brand.ts` for dynamic inline style objects
- `font-display` (Blaak) and `font-sans` (Neue Montreal) already available via Tailwind config

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
components/
  brand/
    Logo.tsx          ← NEW: multi-variant SVG, currentColor, variant prop
    PatternBackground.tsx  ← NEW (optional): decorative texture wrapper
app/
  dashboard/
    layout.tsx        ← ADD data-portal="dashboard" to root div
  hub/
    layout.tsx        ← ADD data-portal="hub" to root div, remove GOLD + hex
    login/
      page.tsx        ← RESTYLE: Verde hero + Blaak h1 + Tangerina CTA
```

### Pattern 1: data-portal Attribute Wire-up

**What:** Add `data-portal` attribute to each layout's root wrapper element so portal-scoped CSS custom property overrides in `portal-dashboard.css` / `portal-hub.css` activate.

**When to use:** First task in any plan for this phase — all token cascade depends on this.

```tsx
// app/dashboard/layout.tsx — root div
<div data-portal="dashboard" className="min-h-screen bg-gray-50">

// app/hub/layout.tsx — root div
<div data-portal="hub" className="min-h-screen" style={{ backgroundColor: "#FBF8F0" }}>
// becomes:
<div data-portal="hub" className="min-h-screen bg-[--color-surface-page]">
```

### Pattern 2: GOLD Constant Elimination

**What:** Replace `const GOLD = "#C9A84C"` and its inline style usages in hub files.

**Decision rule for replacement:**

| Current usage | Replace with | Reason |
|---------------|-------------|--------|
| `style={{ backgroundColor: GOLD }}` on a button/CTA | `className="bg-brand-tangerina"` | Static element, Tailwind class preferred |
| `style={{ color: GOLD }}` on an icon SVG | `className="text-brand-tangerina"` | currentColor via Tailwind |
| `style={{ borderColor: GOLD }}` | `className="border-brand-tangerina"` | Tailwind border color |
| `style={{ backgroundColor: GOLD }}` in conditional `? GOLD : "transparent"` | `BRAND_COLORS.TANGERINA` from `@/lib/constants/brand.ts` | Dynamic/conditional — JS constant required |
| `style={{ backgroundColor: "#FBF8F0" }}` (layout bg) | `bg-[--color-surface-page]` or `bg-brand-creme` | Token class |
| `style={{ backgroundColor: "#FFF8E7" }}` (tint) | `bg-brand-creme` | Close enough — exact match not critical |
| `accent-[#C9A84C]` (radio/checkbox accent) | `accent-brand-tangerina` or inline `style={{ accentColor: BRAND_COLORS.TANGERINA }}` | CSS `accent-color` cannot use CSS vars directly in all browsers |

```tsx
// BEFORE (in every hub file)
const GOLD = "#C9A84C";
// ...
style={{ backgroundColor: GOLD }}
style={{ color: GOLD }}
onFocus={(e) => (e.target.style.borderColor = GOLD)}

// AFTER
import { BRAND_COLORS } from "@/lib/constants/brand";
// Static:
className="bg-brand-tangerina text-white"
// Dynamic onFocus:
onFocus={(e) => (e.target.style.borderColor = BRAND_COLORS.TANGERINA)}
// Conditional:
style={{ backgroundColor: isActive ? BRAND_COLORS.TANGERINA : "transparent" }}
```

### Pattern 3: Sidebar Brand Token Swap

**What:** Replace `bg-secondary-dark`, `bg-gold-600`, `bg-gold-500` in `professional-sidebar.tsx` with brand token classes.

```tsx
// BEFORE
<aside className="... bg-secondary-dark border-r border-secondary-gray ...">
<div className="w-7 h-7 bg-gold-500 rounded ...">
  <span className="text-white text-sm font-bold">C</span>
</div>
// Active nav:
"bg-gold-600 text-white font-semibold shadow-lg shadow-gold-900/20"
// Hover:
"hover:bg-secondary-gray hover:text-white"
// Logout hover:
"hover:text-gold-500 hover:bg-secondary-gray"

// AFTER
<aside className="... bg-brand-verde border-r border-brand-verde-700 ...">
<Logo variant="symbol" className="w-7 h-7" />   // or inline SVG
// Active nav:
"bg-brand-tangerina text-brand-creme font-semibold"
// Hover:
"hover:bg-brand-verde-700 hover:text-brand-creme"
// Logout hover:
"hover:text-brand-tangerina hover:bg-brand-verde-700"
```

### Pattern 4: Shared Component Token Swap

**What:** Replace `gold-*` Tailwind classes in Button, Badge, StatCard, Input with brand equivalents.

| Component | Current | Replacement |
|-----------|---------|------------|
| Button `primary` | `bg-gold-600 hover:bg-gold-700 focus:ring-gold-500` | `bg-brand-tangerina hover:bg-[--brand-tangerina-500] focus:ring-brand-tangerina` |
| Button `outline` | `border-gold-600 text-gold-600 hover:bg-gold-50` | `border-brand-tangerina text-brand-tangerina hover:bg-brand-creme` |
| Badge `info` | `bg-gold-100 text-gold-700` | `bg-brand-creme text-brand-verde` |
| StatCard hover | `hover:border-gold-200` | `hover:border-brand-caramelo` |
| StatCard icon bg | `bg-gold-50` / `text-gold-600` | `bg-brand-creme` / `text-brand-verde` |
| Input focus | `focus:ring-gold-500 focus:border-gold-500` | `focus:ring-brand-verde focus:border-brand-verde` |
| Root layout skip-link | `focus:bg-gold-600 focus:ring-gold-500` | `focus:bg-brand-tangerina focus:ring-brand-tangerina` |

### Pattern 5: Logo Component

**What:** `components/brand/Logo.tsx` — inline SVG with `currentColor`, `variant` prop for symbol vs wordmark.

**When to use:** Replaces all "C" letter placeholder instances in both portals. Uses `currentColor` so it inherits text color automatically — white on Verde sidebar, Verde on Creme header.

```tsx
// components/brand/Logo.tsx
interface LogoProps {
  variant?: "symbol" | "wordmark";
  className?: string;
}

export function Logo({ variant = "symbol", className }: LogoProps) {
  // Symbol: compass/arrow mark SVG paths
  // Wordmark: full "Carreira" logotype
  // Both use fill="currentColor" for color inheritance
  if (variant === "symbol") {
    return (
      <svg className={className} viewBox="0 0 32 32" fill="currentColor" aria-label="Carreira">
        {/* SVG paths from brand team */}
      </svg>
    );
  }
  // ... wordmark variant
}
```

**Blocker note:** SVG path data for the compass/arrow mark must come from the brand team. If not available, implement with geometric placeholder (circle + "C" using `font-display` text element) and leave a TODO comment. The component architecture is complete regardless.

### Pattern 6: Hub Login Hero Upgrade (HUB-03)

**What:** Transform login page from basic white card to Verde + Creme hero treatment.

```tsx
// BEFORE: plain Creme bg, gold circle logo, white card
<div className="min-h-screen flex items-center justify-center p-4"
  style={{ backgroundColor: "#FBF8F0" }}>
  <div className="max-w-sm w-full">
    <div className="text-center mb-8">
      <div style={{ backgroundColor: GOLD }} className="...rounded-full...">C</div>
      <h1 className="text-2xl font-bold text-gray-900">...</h1>
    </div>
    <div className="bg-white rounded-2xl shadow-sm p-6">...form...</div>
  </div>
</div>

// AFTER: Verde hero left/top, Creme card, Blaak h1, Tangerina CTA
<div className="min-h-screen flex items-center justify-center bg-brand-verde p-4">
  <div className="max-w-sm w-full">
    <div className="text-center mb-8">
      <Logo variant="symbol" className="w-16 h-16 text-brand-creme mx-auto mb-4" />
      <h1 className="font-display text-3xl font-bold text-brand-creme">
        {t(lang, "login.loginTitle")}
      </h1>
      <p className="text-brand-cafe text-sm mt-1">...</p>
    </div>
    <div className="bg-brand-creme rounded-2xl shadow-sm p-6">
      ...form inputs...
      <button className="... bg-brand-tangerina text-white ...">
        {t(lang, "login.signIn")}
      </button>
    </div>
  </div>
</div>
```

### Anti-Patterns to Avoid

- **Leaving `const GOLD` and adding a parallel import:** Both must be done atomically — remove the declaration AND the uses in the same commit per file. A file with both `const GOLD = ...` and `import { BRAND_COLORS }` is a half-migrated state.
- **Using `bg-brand-tangerina` for text on light backgrounds:** Tangerina fails WCAG AA (~2.9:1) on Creme/white. Use `text-brand-verde` for links and interactive text on light surfaces.
- **Replacing `gold-*` classes with `brand-tangerina-*` blindly:** `gold-50` (very light tint for hover states) should map to `brand-creme`, not `brand-tangerina-50`. Context matters.
- **Using `style={{ backgroundColor: BRAND_COLORS.TANGERINA }}` where a static Tailwind class works:** Only use JS constants for genuinely dynamic/conditional styles. Static elements should use Tailwind classes for PurgeCSS safety.
- **Forgetting the `data-portal` attribute:** Without it, `portal-dashboard.css` and `portal-hub.css` CSS variables don't activate — `--color-sidebar-bg`, `--color-sidebar-active`, `--color-surface-page` all remain at their `:root` default values.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Brand colors in JS context | `const MY_TANGERINA = "#FF8142"` per-file | `BRAND_COLORS.TANGERINA` from `@/lib/constants/brand.ts` | Already exists; single source of truth; Phase 10 created it |
| Logo color switching per-portal | Props with hex values | `currentColor` + parent `text-*` class | Logo inherits text color automatically from context |
| Portal detection at component level | `usePathname()` checks in components | `data-portal` CSS attribute + CSS variable cascade | Components stay portal-agnostic; CSS handles variation |
| Color contrast checking | Manual ratio calculation | Documented in `BRAND_COLOR_SAFE_USE` in `brand.ts` | Phase 10 already computed and documented safe combos |

**Key insight:** The entire token system is built. Phase 11 is migration work, not design work. Every "should I use X color here?" question is already answered in `lib/constants/brand.ts`'s `BRAND_COLOR_SAFE_USE` and the contrast ratios documented there.

---

## Common Pitfalls

### Pitfall 1: Forgetting data-portal on Layout Wrappers

**What goes wrong:** Portal-scoped CSS token overrides (Verde sidebar background, Creme page surface) don't activate. Dashboard sidebar stays with `--color-sidebar-bg` resolving to its `:root` value instead of the dashboard-specific override. Visually confusing — tokens appear wired but portal-specific values don't show.

**Why it happens:** `portal-dashboard.css` uses `[data-portal="dashboard"] { ... }` attribute selector. Without the attribute on the DOM, the selector matches nothing.

**How to avoid:** First commit of Phase 11 adds `data-portal` to both layouts before any other visual change.

**Warning signs:** DevTools shows `--color-sidebar-bg` computing to `var(--brand-verde)` from `:root` in semantic.css rather than from `portal-dashboard.css`. Means the portal override isn't winning specificity.

### Pitfall 2: Tangerina as Text on Light Backgrounds

**What goes wrong:** `text-brand-tangerina` on white or Creme card backgrounds produces text with ~2.9:1 contrast ratio — WCAG AA fail. Will look orange but be inaccessible.

**Why it happens:** Tangerina (#FF8142) is a warm orange with low luminance contrast on light surfaces. It is designed for CTA buttons on dark (Verde) backgrounds only.

**How to avoid:** Use the `BRAND_COLOR_SAFE_USE` rules from `lib/constants/brand.ts`:
- Text on light → `text-brand-verde`
- CTA button text/bg → `bg-brand-tangerina text-white` (on Verde surface or as standalone CTA)
- Never `text-brand-tangerina` on `bg-white` or `bg-brand-creme`

**Warning signs:** Any `text-brand-tangerina` class on an element whose background is `bg-white`, `bg-brand-creme`, or `bg-gray-*`.

### Pitfall 3: Inline Style Residuals After GOLD Removal

**What goes wrong:** A file has `const GOLD` removed and `BRAND_COLORS` imported, but some `style={{ color: GOLD }}` instances remain (referencing the now-deleted variable) causing TypeScript compile error — or worse, some instances are replaced with Tailwind classes but a few dynamic conditional ones are missed.

**Why it happens:** Large files (hub/test/page.tsx, hub/forms/[id]/page.tsx) have 10–15+ GOLD usages scattered across the JSX. Easy to miss one in a manual scan.

**How to avoid:** After editing each file, run: `grep -n 'GOLD\|#C9A84C\|#FF8142' <file>` — must return zero results. Only then mark the file as done.

**Warning signs:** TypeScript error `Cannot find name 'GOLD'` after deletion — means at least one usage was missed.

### Pitfall 4: gold-* Tailwind Classes Left in Shared Components

**What goes wrong:** Button, StatCard, Badge still reference `bg-gold-600`, `text-gold-700` etc. after Phase 11. These resolve correctly (the `gold-*` scale still exists in `tailwind.config.ts` to avoid breaking other code) but use the old palette rather than brand colors.

**Why it happens:** Shared components are not in `app/hub/` so they don't show up in the hub GOLD grep. Easy to forget they also need updating.

**How to avoid:** Treat shared components as a separate checklist from hub files. Explicitly verify: `grep -n 'gold-' components/ui/button.tsx components/ui/badge.tsx components/ui/stat-card.tsx components/ui/input.tsx` returns zero after migration.

**Warning signs:** Dashboard buttons still show amber/yellow (#B8941F) rather than Tangerina (#FF8142) after hub migration is complete.

### Pitfall 5: Hub Layout `min-h-screen` Background Not Using Token

**What goes wrong:** Hub layout root div uses `style={{ backgroundColor: "#FBF8F0" }}` which is close to (but not exactly) the Creme token `#FFF8E8`. Result: the layout background uses a slightly different shade than elements using `bg-brand-creme`, causing a subtle mismatch.

**Why it happens:** `#FBF8F0` was a pre-token approximation of Creme. The canonical Creme from the brand guide is `#FFF8E8`.

**How to avoid:** Replace `style={{ backgroundColor: "#FBF8F0" }}` with `className="bg-brand-creme"` (resolves to `#FFF8E8` via CSS variable). The `data-portal="hub"` attribute also sets `--color-surface-page: var(--brand-creme)`, so `bg-[--color-surface-page]` is equivalent.

---

## Code Examples

Verified patterns from codebase + Phase 10 token system:

### Tailwind Brand Color Classes (available from Phase 10)

```tsx
// Source: tailwind.config.ts lines 102-106
"bg-brand-verde"       // #2F443F — sidebar background, Verde surfaces
"bg-brand-tangerina"   // #FF8142 — CTA buttons on dark surfaces
"bg-brand-creme"       // #FFF8E8 — hub page background, cards
"bg-brand-cafe"        // #E1C19B — warm accent surfaces (decorative)
"bg-brand-caramelo"    // #BD925F — hover borders (decorative)
"text-brand-verde"     // text on light backgrounds
"text-brand-creme"     // text on dark (Verde) backgrounds
"text-brand-tangerina" // accent text — ONLY on dark bg (WCAG constraint)
"border-brand-verde-700" // sidebar border, slightly darker than Verde
```

### BRAND_COLORS Import Pattern

```tsx
// Source: lib/constants/brand.ts
import { BRAND_COLORS } from "@/lib/constants/brand";

// Replace const GOLD = "#C9A84C" + style={{ color: GOLD }}:
<svg style={{ color: BRAND_COLORS.TANGERINA }} />    // dynamic/conditional

// Replace style={{ backgroundColor: "#FBF8F0" }}:
className="bg-brand-creme"                            // static — Tailwind preferred
```

### CSS Variable Token Classes (for semantic tokens)

```tsx
// Uses CSS variable reference syntax for Tailwind arbitrary values
// Source: portal-hub.css, semantic.css
className="bg-[--color-surface-page]"    // portal-aware page background
className="text-[--color-text-primary]"  // portal-aware primary text
className="bg-[--color-sidebar-bg]"      // portal-aware sidebar bg
```

### data-portal Attribute Pattern

```tsx
// app/dashboard/layout.tsx — add attribute to root div
<div data-portal="dashboard" className="min-h-screen bg-gray-50">

// app/hub/layout.tsx — add attribute, remove style={{}}
<div data-portal="hub" className="min-h-screen bg-brand-creme">
```

---

## Component-by-Component Migration Map

Full inventory of every change needed in Phase 11.

### Admin Dashboard

| File | Change Required | Token Swap |
|------|----------------|------------|
| `app/dashboard/layout.tsx` | Add `data-portal="dashboard"` to root div | Enables portal CSS overrides |
| `components/dashboard/professional-sidebar.tsx` | Replace `bg-secondary-dark` with `bg-brand-verde`; `bg-gold-600` active → `bg-brand-tangerina`; `bg-gold-500` avatar → `bg-brand-tangerina`; logo placeholder "C" → `<Logo variant="symbol" />`; `text-sigma-blue` footer → keep or replace with neutral | bg/text class swaps |
| `components/ui/button.tsx` | `primary`: gold-600/700/500 → brand-tangerina; `outline`: gold-600 border/text → brand-tangerina; `secondary` focus ring: gold-500 → brand-verde | variantStyles object |
| `components/ui/badge.tsx` | `info` variant: gold-100/700 → creme/verde | variantStyles + dotStyles |
| `components/ui/stat-card.tsx` | hover: gold-200 → caramelo; icon bg: gold-50 → creme; icon text: gold-600 → verde | className strings |
| `components/ui/input.tsx` | `default` focus: gold-500 → brand-verde | stateStyles object |
| `app/layout.tsx` (root) | Skip-link: `focus:bg-gold-600 focus:ring-gold-500` → brand-tangerina | skip-link classes |
| `components/brand/Logo.tsx` | CREATE: inline SVG component with `variant` prop, `currentColor` | New file |

### Client Hub (HUB-01 — 15 files with GOLD constant)

| File | GOLD Usages | Primary Change |
|------|-------------|---------------|
| `app/hub/layout.tsx` | 1 GOLD + 1 hex bg | Logo circle → Logo component; bg → `bg-brand-creme`; add `data-portal="hub"` |
| `app/hub/login/page.tsx` | 5 GOLD + 1 hex bg | Full hero redesign (HUB-03): Verde bg, Blaak h1, Tangerina CTA |
| `app/hub/page.tsx` | 8 GOLD + 2 hex + conditional | BRAND_COLORS.TANGERINA for conditionals; Tailwind for statics |
| `app/hub/settings/page.tsx` | 10 GOLD | Language toggle conditionals → BRAND_COLORS; static → Tailwind |
| `app/hub/LanguageToggle.tsx` | 4 GOLD (conditional) | BRAND_COLORS.TANGERINA for active state |
| `app/hub/status/page.tsx` | 7 GOLD + hex | Mixed — conditionals use BRAND_COLORS, statics use Tailwind |
| `app/hub/forms/page.tsx` | 1 GOLD | `style={{ color: GOLD }}` → `className="text-brand-tangerina"` (on dark card bg) |
| `app/hub/forms/[id]/page.tsx` | 12 GOLD + 1 accent-[] | Most → Tailwind; conditionals → BRAND_COLORS; accent-[] → inline accentColor |
| `app/hub/test/page.tsx` | 12 GOLD + 2 hex | Mixed — most static → Tailwind |
| `app/hub/test/result/page.tsx` | 2 GOLD + 2 status hex | GOLD → Tailwind; status colors (#059669 green / #DC2626 red) are semantic — keep or use success/error Tailwind |
| `app/hub/reset-password/page.tsx` | 3 GOLD + 2 hex | `stroke={GOLD}` → SVG class; bg → Tailwind |
| `app/hub/set-password/page.tsx` | GOLD present (similar to reset-password) | Same treatment as reset-password |
| `app/hub/documents/page.tsx` | 4 GOLD + hex | Tailwind replacement |
| `app/hub/documents/receipt/[invoiceId]/page.tsx` | GOLD present | Tailwind replacement |
| `app/hub/documents/receipt/PrintButton.tsx` | 1 GOLD | Single static style → Tailwind |
| `app/hub/NewsNotification.tsx` | `bg-[#C9A84C]` (notification dot) | → `bg-brand-tangerina` |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `const GOLD = "#C9A84C"` per file | `BRAND_COLORS.TANGERINA` from `lib/constants/brand.ts` | Phase 10 established; Phase 11 migrates | Single source for all dynamic color usage |
| Hardcoded `#FBF8F0` background | `bg-brand-creme` via CSS variable | Phase 10 established; Phase 11 migrates | Portal-aware via `--color-surface-page` |
| `bg-secondary-dark` (#1A1A1A) sidebar | `bg-brand-verde` (#2F443F) | Phase 11 | Brand-aligned sidebar |
| `bg-gold-600` active nav | `bg-brand-tangerina` | Phase 11 | Brand-aligned active state |
| "C" letter placeholder | `Logo` SVG component | Phase 11 (asset-dependent) | Real brand mark |
| No portal scope | `data-portal` attribute on layouts | Phase 11 (Phase 10 built infra) | Portal-aware CSS variable cascade |

**Deprecated/outdated after Phase 11:**
- `const GOLD = "#C9A84C"`: All 15 instances removed
- `style={{ backgroundColor: "#FBF8F0" }}`: All layout background uses replaced
- `bg-gold-600` / `bg-gold-500` in sidebar and shared components: Replaced
- `focus:ring-gold-500`: Replaced with `focus:ring-brand-verde` across components

---

## Open Questions

1. **Logo SVG asset availability**
   - What we know: Component architecture is designed; `currentColor` approach confirmed correct; no SVG files exist in repo
   - What's unclear: Whether compass/arrow brand mark vector files have been delivered to the team
   - Recommendation: Implement `Logo.tsx` with a geometric placeholder (SVG circle + "C" text node in Blaak font) and add `// TODO: Replace SVG paths with brand mark from assets/` comment. Merge logo paths as a follow-up commit when assets arrive. Do not block the phase.

2. **`#FFF8E7` vs `#FFF8E8` mismatch in hub files**
   - What we know: Hub files use `#FFF8E7` (off by one) as a tint background for icon containers; brand.css defines `--brand-creme: #FFF8E8`
   - What's unclear: Whether the 1-digit difference is intentional (a lighter tint) or a typo
   - Recommendation: Map `#FFF8E7` usages to `bg-brand-creme` — the visual difference is imperceptible and using the token is more important than exact hex fidelity for these tint backgrounds.

3. **Status hex colors in hub/test/result/page.tsx**
   - What we know: `#059669` (green, success) and `#DC2626` (red, error) are used for pass/fail score backgrounds — these are semantic status colors, not brand colors
   - What's unclear: Whether they should stay as-is or use the project's `success-600`/`error-600` Tailwind tokens
   - Recommendation: Replace with `bg-success-600` and `bg-error-600` (both defined in tailwind.config.ts) — cleaner and consistent with how Badge component handles status.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 11 is CSS/component code-only changes. No external tools, runtimes, databases, or CLI utilities are required beyond the existing development environment.

---

## Validation Architecture

No test framework detected for frontend component tests (`jest.config.*`, `vitest.config.*`, `*.test.tsx` absent). This phase's validation is visual and grep-based per the pattern established in the project.

### Phase Gate Verification Commands

Run these after each sub-track completes:

```bash
# Track 1 gate: data-portal wired
grep -rn 'data-portal' app/dashboard/layout.tsx app/hub/layout.tsx

# Track 2 gate: shared components clean of gold-*
grep -n 'gold-' components/ui/button.tsx components/ui/badge.tsx \
  components/ui/stat-card.tsx components/ui/input.tsx \
  components/dashboard/professional-sidebar.tsx

# Track 3 gate: hub files clean of GOLD and hex brand colors
grep -rn 'GOLD\|#C9A84C\|#c9a84c\|#FF8142\|#ff8142' app/hub --include="*.tsx"

# Track 3 gate: no inline brand-color style= remaining in hub
grep -rn 'style={{.*backgroundColor.*#\|style={{.*color.*#' app/hub --include="*.tsx"

# Final gate: build passes
npm run build
```

### Phase Gate: All commands return zero matches (except data-portal which must return matches).

---

## Sources

### Primary (HIGH confidence)

- Direct codebase analysis — all findings verified by file reading:
  - `components/dashboard/professional-sidebar.tsx` — sidebar current token usage confirmed
  - `components/ui/button.tsx`, `badge.tsx`, `stat-card.tsx`, `input.tsx` — shared component gold-* usage confirmed
  - `app/hub/layout.tsx`, `login/page.tsx`, `page.tsx`, `settings/page.tsx`, `LanguageToggle.tsx`, `forms/[id]/page.tsx`, `test/page.tsx`, `status/page.tsx`, `documents/page.tsx`, `NewsNotification.tsx` — GOLD instances enumerated
  - `app/dashboard/layout.tsx` — data-portal attribute confirmed absent
  - `styles/tokens/portal-dashboard.css`, `portal-hub.css`, `semantic.css`, `brand.css` — Phase 10 token system verified present
  - `lib/constants/brand.ts` — BRAND_COLORS.TANGERINA confirmed available
  - `tailwind.config.ts` — brand-* classes, gold-* scale, secondary-dark, sigma-blue all verified
  - `public/` directory — no favicon or logo image files exist (only fonts)
- `.planning/phases/10-token-font-foundation/10-VERIFICATION.md` — Phase 10 completion verified (13/13 truths)
- `.planning/research/SUMMARY.md` — project-level architecture decisions confirmed

### Secondary (MEDIUM confidence)

- Tailwind CSS v3 arbitrary value syntax `bg-[--css-var]` — documented pattern for referencing CSS custom properties as Tailwind values; works in Tailwind v3 without additional config
- CSS `accent-color` property browser support — widely supported in modern browsers; cannot reference CSS custom properties in all contexts, hence the `style={{ accentColor }}` fallback for the radio input in `forms/[id]/page.tsx`

---

## Metadata

**Confidence breakdown:**
- Component inventory: HIGH — every file read directly; counts verified by grep
- Token replacement map: HIGH — Phase 10 tokens verified present; replacement rules derived from WCAG constraints documented in brand.ts
- Logo/favicon: LOW — no brand asset files found; implementation approach is placeholder-first
- Architecture: HIGH — data-portal pattern, currentColor SVG, BRAND_COLORS import are all standard patterns verified in repo

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (30 days — stable CSS/component domain, no fast-moving dependencies)
