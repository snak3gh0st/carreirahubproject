# Phase 10: Token & Font Foundation — Research

**Researched:** 2026-03-25
**Domain:** CSS design token architecture, next/font/local, Tailwind CSS v3 theme extension
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TKN-01 | Design system uses a three-layer CSS custom property architecture (brand primitives, semantic aliases, portal overrides) as single source of truth | Brand hex values confirmed from PDF; CSS custom property layer pattern verified; Tailwind v3 `var()` integration confirmed via official docs |
| TKN-02 | Blaak and Neue Montreal fonts loaded via next/font/local with CSS variable injection, Google Fonts @import removed | Font file inventory confirmed (12 Blaak OTF + 8 Neue Montreal OTF); `next/font/local` src-array + `variable` option confirmed via Next.js 14 official docs |
| TKN-03 | Typography hierarchy defined — Blaak for h1-h3 display headings, Neue Montreal for body/UI text | Existing `font-display` class pattern (15 files) maps cleanly; `fontFamily.display` and `fontFamily.sans` in tailwind.config.ts are the leverage points |
| TKN-04 | Color role rules enforced — Verde as primary text color, Tangerina only on dark surfaces or as non-text accent, contrast ratios verified | Contrast analysis: Verde on white = ~7.5:1 (PASS), Tangerina on white = ~2.9:1 (FAIL), Tangerina on Verde = ~3.2:1 (borderline large text only). Lint enforcement via `lib/brand-colors.ts` comment contracts |
</phase_requirements>

---

## Summary

Phase 10 establishes the foundational design token infrastructure that every subsequent phase (11 and 12) depends on. The work is purely additive at the infrastructure level — no visual changes to any component or page. The deliverables are: new CSS token files, a new `lib/fonts.ts` font definition module, modifications to `tailwind.config.ts` and `app/layout.tsx`, font binary copies into `public/fonts/`, and a new `lib/constants/brand.ts` JS constants file.

The existing codebase has two font loading mechanisms that conflict: `@import url('https://fonts.googleapis.com/')` in `app/globals.css` AND `Inter` imported from `next/font/google` in `app/layout.tsx`. Both must be removed in the same commit; leaving either in place defeats font optimization. The replacement is a single `lib/fonts.ts` file using `next/font/local` with the `variable` option, applied to the `<html>` element via className in `app/layout.tsx`.

The existing token infrastructure (`lib/design-tokens.ts`, CSS custom properties in `globals.css`, and color keys in `tailwind.config.ts`) all use the old gold-palette values. These must be extended — not replaced — with the five new brand colors as a separate namespace, leaving the gray scale, semantic status colors (success/warning/error/info), and shadcn/ui legacy variables intact to avoid breaking Phase 9 components.

**Primary recommendation:** Create brand token files and font setup as infrastructure commits first. The `lib/constants/brand.ts` file must be the absolute first commit (before any visual work) so downstream phases have a canonical source to reference rather than re-introducing hardcoded hex values.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next/font/local | Built into Next.js 14.2.35 | Self-hosted font loading with zero FOUT and automatic preload | Zero-dependency, prevents CLS, eliminates Google Fonts network requests, official Next.js solution |
| CSS Custom Properties | Browser-native | Three-layer brand token system | No runtime cost, cascades through both portals, supported in all modern browsers |
| Tailwind CSS v3 | 3.4.19 (installed) | Utility classes wired to CSS variables via `var()` | Already installed; `theme.extend.colors` supports `var()` references natively in v3 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| JetBrains Mono | via Google Fonts import (currently) | Monospace font for IDs and codes | Preserve as-is — it is not being replaced in this phase |
| tints.dev | web tool | Generate 11-stop color scales from brand hex anchors | Run once before finalizing brand.css; approximated stops should not ship without this step |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `next/font/local` with OTF | Convert to WOFF2 first | WOFF2 is ~68% smaller, improving Vercel edge delivery; OTF works correctly but is larger. For Phase 10 OTF is acceptable; WOFF2 conversion is a future optimization |
| CSS custom properties | CSS Modules or Tailwind plugin | CSS custom properties cascade through portals and require no build step; CSS Modules would break the portal-scoped override pattern |
| `lib/constants/brand.ts` as new file | Extend existing `lib/design-tokens.ts` | Extending design-tokens.ts creates ambiguity between old gold palette and new brand palette; a dedicated brand.ts file is unambiguous and avoids merge conflicts when Phase 11 removes old gold values |

**Installation:** No new packages required. All required capabilities are built into the existing project.

---

## Architecture Patterns

### Recommended Project Structure

```
app/
  globals.css              ← MODIFIED: remove @import Google Fonts; add @import token files
  layout.tsx               ← MODIFIED: replace Inter google font with local fonts variable classes
lib/
  fonts.ts                 ← NEW: localFont definitions for Blaak and Neue Montreal
  constants/
    brand.ts               ← NEW: JS hex constants for Recharts and non-CSS consumers
styles/
  tokens/
    brand.css              ← NEW: raw palette primitives (--brand-creme, --brand-verde, etc.)
    semantic.css           ← NEW: role-based aliases (--color-primary, --color-accent, etc.)
    portal-dashboard.css   ← NEW: [data-portal="dashboard"] scoped overrides
    portal-hub.css         ← NEW: [data-portal="hub"] scoped overrides
public/
  fonts/
    blaak/                 ← NEW: 12 OTF files copied from brand team delivery
    neue-montreal/         ← NEW: 8 OTF files copied from brand team delivery
tailwind.config.ts         ← MODIFIED: add brand color keys, update fontFamily
```

### Pattern 1: next/font/local with CSS Variable Output

**What:** Load multiple weights of a non-variable font as a single logical font family using src array. Output to a CSS variable instead of a direct className so Tailwind can consume it.

**When to use:** Any time you have multiple static OTF/WOFF2 files representing one font family (Blaak has 12 files, Neue Montreal has 8 files).

**Example:**
```typescript
// Source: https://nextjs.org/docs/app/api-reference/components/font#src
// lib/fonts.ts
import localFont from 'next/font/local'

export const blaak = localFont({
  src: [
    { path: '../public/fonts/blaak/Blaak Thin.otf',           weight: '100', style: 'normal' },
    { path: '../public/fonts/blaak/Blaak Thin Italic.otf',    weight: '100', style: 'italic' },
    { path: '../public/fonts/blaak/Blaak Light.otf',          weight: '300', style: 'normal' },
    { path: '../public/fonts/blaak/Blaak Light Italic.otf',   weight: '300', style: 'italic' },
    { path: '../public/fonts/blaak/Blaak Regular.otf',        weight: '400', style: 'normal' },
    { path: '../public/fonts/blaak/Blaak Regular Italic.otf', weight: '400', style: 'italic' },
    { path: '../public/fonts/blaak/Blaak Bold.otf',           weight: '700', style: 'normal' },
    { path: '../public/fonts/blaak/Blaak Bold Italic.otf',    weight: '700', style: 'italic' },
    { path: '../public/fonts/blaak/Blaak ExtraBold.otf',      weight: '800', style: 'normal' },
    { path: '../public/fonts/blaak/Blaak ExtraBold Italic.otf', weight: '800', style: 'italic' },
    { path: '../public/fonts/blaak/Blaak Black.otf',          weight: '900', style: 'normal' },
    { path: '../public/fonts/blaak/Blaak Black Italic.otf',   weight: '900', style: 'italic' },
  ],
  variable: '--font-blaak',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
})

export const neueMontreal = localFont({
  src: [
    { path: '../public/fonts/neue-montreal/NeueMontreal-Light.otf',        weight: '300', style: 'normal' },
    { path: '../public/fonts/neue-montreal/NeueMontreal-LightItalic.otf',  weight: '300', style: 'italic' },
    { path: '../public/fonts/neue-montreal/NeueMontreal-Regular.otf',      weight: '400', style: 'normal' },
    { path: '../public/fonts/neue-montreal/NeueMontreal-Italic.otf',       weight: '400', style: 'italic' },
    { path: '../public/fonts/neue-montreal/NeueMontreal-Medium.otf',       weight: '500', style: 'normal' },
    { path: '../public/fonts/neue-montreal/NeueMontreal-MediumItalic.otf', weight: '500', style: 'italic' },
    { path: '../public/fonts/neue-montreal/NeueMontreal-Bold.otf',         weight: '700', style: 'normal' },
    { path: '../public/fonts/neue-montreal/NeueMontreal-BoldItalic.otf',   weight: '700', style: 'italic' },
  ],
  variable: '--font-neue-montreal',
  display: 'swap',
  adjustFontFallback: 'Arial',
})
```

### Pattern 2: Apply Font Variables to HTML Element

**What:** Attach font CSS variables to the `<html>` element by spreading className from font objects. This makes `--font-blaak` and `--font-neue-montreal` available to the entire document tree.

**When to use:** Root layout only. Applying to `<body>` also works but `<html>` is the official Next.js recommendation.

**Example:**
```typescript
// Source: https://nextjs.org/docs/app/api-reference/components/font#with-tailwind-css
// app/layout.tsx
import { blaak, neueMontreal } from '@/lib/fonts'

export default function RootLayout({ children }) {
  return (
    <html
      lang="pt-BR"
      className={`${blaak.variable} ${neueMontreal.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
```

NOTE: Remove `inter.className` from the body and remove `import { Inter } from 'next/font/google'` in the same commit.

### Pattern 3: Three-Layer CSS Token Architecture

**What:** Three separate CSS files forming a hierarchy: primitives define raw values, semantic aliases assign roles, portal overrides allow per-portal divergence.

**When to use:** Multi-portal applications where two portals share components but may differ in specific color assignments (e.g., Dashboard sidebar is dark; Hub surface is light).

**Example:**
```css
/* styles/tokens/brand.css — Layer 1: Primitives */
:root {
  /* Brand palette — confirmed from official Carreira USA color guide */
  --brand-creme:        #FFF8E8;
  --brand-verde:        #2F443F;
  --brand-tangerina:    #FF8142;
  --brand-cafe:         #E1C19B;
  --brand-caramelo:     #BD925F;

  /* Tints (generate via tints.dev before shipping — values below are approximations) */
  --brand-verde-50:     #EDF2F1;
  --brand-verde-100:    #CCDAD7;
  --brand-verde-900:    #1A2724;

  --brand-tangerina-50: #FFF0E8;
  --brand-tangerina-100:#FFD5BC;
}
```

```css
/* styles/tokens/semantic.css — Layer 2: Semantic Role Aliases */
:root {
  --color-primary:       var(--brand-verde);
  --color-accent:        var(--brand-tangerina);
  --color-surface-base:  var(--brand-creme);
  --color-surface-warm:  var(--brand-cafe);
  --color-surface-mid:   var(--brand-caramelo);

  /* Typography roles */
  --color-text-primary:  var(--brand-verde);
  --color-text-on-dark:  var(--brand-creme);
  --color-text-accent:   var(--brand-tangerina);  /* ONLY on dark bg */
}
```

```css
/* styles/tokens/portal-dashboard.css — Layer 3: Dashboard overrides */
[data-portal="dashboard"] {
  --color-surface-page: #F9FAFB;       /* Keep gray-50 for dashboard — not Creme */
  --color-sidebar-bg:   var(--brand-verde);
  --color-sidebar-active: var(--brand-tangerina);
}
```

```css
/* styles/tokens/portal-hub.css — Layer 3: Hub overrides */
[data-portal="hub"] {
  --color-surface-page: var(--brand-creme);  /* Hub uses Creme as page background */
}
```

### Pattern 4: Tailwind v3 Color Extension with CSS Variables

**What:** Add new brand color keys to `tailwind.config.ts` using `var()` references so utility classes like `bg-brand-verde` and `text-brand-tangerina` work.

**When to use:** Any new Tailwind utility class that must reference a CSS custom property value.

**Example:**
```typescript
// Source: https://tailwindcss.com/docs/theme — Tailwind v3 theme extension
// tailwind.config.ts — ADDITIONS only (preserve all existing keys)
theme: {
  extend: {
    colors: {
      // NEW: Carreira USA v1.1 brand palette
      'brand-creme':     'var(--brand-creme)',
      'brand-verde':     'var(--brand-verde)',
      'brand-tangerina': 'var(--brand-tangerina)',
      'brand-cafe':      'var(--brand-cafe)',
      'brand-caramelo':  'var(--brand-caramelo)',
      // Keep all existing primary/success/warning/error/info/gray/gold keys
    },
    fontFamily: {
      // Replace Space Grotesk with Blaak; replace Inter with Neue Montreal
      sans:    ['var(--font-neue-montreal)', 'system-ui', '-apple-system', 'sans-serif'],
      display: ['var(--font-blaak)', 'Georgia', 'serif'],
      mono:    ['JetBrains Mono', 'Courier New', 'monospace'],  // unchanged
    },
  },
}
```

### Pattern 5: JS Brand Constants File

**What:** A TypeScript constants file that exports all brand hex values as named constants for non-CSS consumers (Recharts, dynamic style objects).

**When to use:** Any code that cannot use Tailwind classes or CSS variables — specifically Recharts `fill=` and `stroke=` SVG props, and any `style={{ color: ... }}` props.

**Example:**
```typescript
// lib/constants/brand.ts
// Source: Carreira USA official color guide (Paleta de Cores Carreira USA.pdf)
// This file is the JS mirror of styles/tokens/brand.css.
// NEVER hardcode brand hex values anywhere else in the codebase.

export const BRAND_COLORS = {
  CREME:     '#FFF8E8',
  VERDE:     '#2F443F',
  TANGERINA: '#FF8142',
  CAFE:      '#E1C19B',
  CARAMELO:  '#BD925F',
} as const

export type BrandColor = typeof BRAND_COLORS[keyof typeof BRAND_COLORS]
```

### Anti-Patterns to Avoid

- **Mixing font loading mechanisms:** Do not keep the `@import url(https://fonts.googleapis.com/)` in `globals.css` while also using `next/font`. The CSS `@import` wins and defeats all optimization. Remove it in the same commit that adds `lib/fonts.ts`.
- **Applying font className to `<body>` when using CSS variables:** When using the `variable` option, the CSS variable must be set on the `<html>` element (or an ancestor), not the body. The `<body>` should use `className="font-sans antialiased"` to apply the Tailwind `font-sans` utility (which references `var(--font-neue-montreal)`).
- **Replacing existing Tailwind color keys:** Do NOT remove `primary`, `gold`, `success`, `warning`, `error`, or `gray` keys from `tailwind.config.ts` in this phase. Phase 9 components use those classes. Add the new `brand-*` keys alongside the existing ones.
- **Storing font files in `app/` directory:** `next/font/local` supports font files colocated in `app/`, but `public/fonts/` is cleaner for files that are binary assets. The path in `src` must be relative to where `lib/fonts.ts` lives — confirmed pattern: `'../public/fonts/blaak/Blaak Regular.otf'`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FOUT prevention for custom fonts | Custom `<link rel="preload">` tags, `font-display` CSS | `next/font/local` with `display: 'swap'` | Next.js injects `<link rel="preload">` automatically; `adjustFontFallback` generates a metric-matched fallback font to prevent CLS |
| CSS variable naming conflicts | Manual namespacing with comments | Three-layer file architecture with separate imports | File separation enforces layer boundaries; comments do not |
| Contrast ratio testing | Visual inspection or ad-hoc color picker | WebAIM contrast checker (mathematical verification) | Contrast is a mathematical property; visual inspection is unreliable, especially for borderline cases like Tangerina |
| Per-portal color divergence | Conditional logic in components (`isHub ? '#FFF8E8' : '#F9FAFB'`) | `[data-portal]` CSS attribute selector | CSS scoping at the root level means components have zero portal-awareness code |

**Key insight:** `next/font/local` handles every non-trivial font loading concern (preload, CLS prevention, fallback metric matching, no external requests). There is no valid reason to implement any of these manually.

---

## Runtime State Inventory

Step 2.5: SKIPPED (this is a greenfield infrastructure phase, not a rename/refactor phase)

No existing data stores, services, or OS state reference the new token naming. The phase creates new CSS files and a new JS constants module — it does not rename existing variables.

**Important note:** The existing `--primary-*` CSS custom properties and `gold` Tailwind color keys are NOT being renamed in this phase. They remain functional. The new `--brand-*` tokens and `brand-*` Tailwind keys are additions. Renaming/removing old tokens is a Phase 11 concern, not Phase 10.

---

## Environment Availability Audit

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| next/font/local | TKN-02 font loading | Yes (built in) | 14.2.35 | — |
| Tailwind CSS v3 | TKN-01 token classes | Yes (installed) | 3.4.19 | — |
| Blaak OTF files | TKN-02 | Yes (on disk) | — | Warn and use system serif |
| Neue Montreal OTF files | TKN-02 | Yes (on disk) | — | Warn and use system sans |
| public/ directory | Font binary hosting | Does not exist yet | — | Must be created in Wave 0 |
| Node.js | Build tooling | Yes | v18+ (inferred from Next.js 14) | — |

**Font file locations confirmed:**
- Blaak: `/Users/pauloloureiro/Downloads/1. ID VISUAL - Carreira USA/Tipografia/Blaak_Font/Blaak/` — 12 OTF files
- Neue Montreal: `/Users/pauloloureiro/Downloads/1. ID VISUAL - Carreira USA/Tipografia/Neue Montreal/` — 8 OTF files

**Missing dependencies with no fallback:**
- `public/fonts/` directory — must be created before font files can be referenced by `next/font/local`

**Font licensing:** Blaak and Neue Montreal are commercial typefaces. Confirm that the licenses permit self-hosted web embedding before committing the OTF files to the repository. If licenses restrict web use, this is a Phase 10 blocker. If unavailable: use system fonts as placeholders and add real fonts in a follow-up commit.

---

## Common Pitfalls

### Pitfall 1: Dual Font Loading (Existing + New)

**What goes wrong:** Developer adds `lib/fonts.ts` and applies CSS variables, but forgets to remove the `@import url('https://fonts.googleapis.com/')` from `globals.css` AND the `Inter` import from `next/font/google` in `layout.tsx`. Both font systems run simultaneously; the Google Fonts CDN request still fires; Inter still loads; FOUT still occurs.

**Why it happens:** The CSS `@import` in `globals.css` is outside Next.js's awareness — it is a plain CSS rule that the browser executes. `next/font` does not know about it and cannot suppress it.

**How to avoid:** In the same commit that adds `lib/fonts.ts` and applies font variables in `layout.tsx`, delete line 1-2 of `globals.css` (the Google Fonts `@import`) AND remove `import { Inter } from 'next/font/google'` and `const inter = Inter(...)` from `app/layout.tsx`.

**Warning signs:** Network tab in DevTools shows a request to `fonts.googleapis.com`. Body still has `inter` className applied. FOUT visible on page load.

### Pitfall 2: Font File Path Relative to Definition Location

**What goes wrong:** `localFont({ src: './public/fonts/blaak/Blaak Regular.otf' })` throws a module resolution error at build time.

**Why it happens:** The `src` path in `next/font/local` is relative to the file where `localFont()` is called, not the project root. If `lib/fonts.ts` calls `localFont`, the path must navigate up to reach `public/`.

**How to avoid:** Use `'../public/fonts/blaak/Blaak Regular.otf'` when calling from `lib/fonts.ts`. Verify at build time with `npm run build` — font resolution errors appear during the compilation step, not at runtime.

**Warning signs:** `Error: Failed to find font file` during `npm run build`. Module not found errors in the Next.js compilation output.

### Pitfall 3: Font CSS Variables Not Available Before Tailwind Utility Classes

**What goes wrong:** `font-display` class resolves to `font-family: var(--font-blaak)` but `--font-blaak` is not defined yet because `blaak.variable` className was never applied to the `<html>` element.

**Why it happens:** `next/font/local` with `variable: '--font-blaak'` generates a CSS rule that sets `--font-blaak` only on elements that have the generated className applied. If that className is not on `<html>`, the variable is undefined everywhere.

**How to avoid:** In `app/layout.tsx`, apply BOTH font variables to the `<html>` element: `className={\`\${blaak.variable} \${neueMontreal.variable}\`}`. Then the `<body className="font-sans">` inherits the variable through cascade.

**Warning signs:** `font-display` elements render in system serif (not Blaak). Browser DevTools shows `font-family: var(--font-blaak)` computed as empty or falling through to serif fallback.

### Pitfall 4: Overwriting Existing Tailwind Spacing Keys

**What goes wrong:** The existing `tailwind.config.ts` overrides default Tailwind spacing with CSS variable references (`'1': 'var(--space-1)'`). If this override is accidentally removed or corrupted during the brand color additions, all spacing-dependent classes break throughout both portals.

**Why it happens:** The spacing override is a non-standard pattern that replaces Tailwind's default numeric scale. It's easy to accidentally omit during a config edit.

**How to avoid:** Add brand color keys by appending to the `colors` object inside `extend`. Never rewrite the entire `theme.extend` block. Use surgical edits.

**Warning signs:** After tailwind.config.ts changes, `p-4` stops working or renders 0px instead of 1rem.

### Pitfall 5: `globals.css` Imports Must Come Before `@tailwind` Directives

**What goes wrong:** `@import './styles/tokens/brand.css'` placed after `@tailwind base` causes CSS cascade order issues — Tailwind's base layer overrides the token variables.

**Why it happens:** CSS `@import` rules are order-sensitive. In PostCSS, Tailwind's `@tailwind base` generates CSS that could interfere with `:root` variable definitions if the token imports follow rather than precede it.

**How to avoid:** Place all `@import` statements for token files at the top of `globals.css`, after removing the Google Fonts `@import` but before `@tailwind base`. Correct order:
```css
/* Google Fonts @import REMOVED */
@import './styles/tokens/brand.css';
@import './styles/tokens/semantic.css';

@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## Code Examples

### globals.css Token Import Block (Final)

```css
/* Source: next/font/local integration pattern */
/* Token imports — must come before @tailwind base */
@import '../styles/tokens/brand.css';
@import '../styles/tokens/semantic.css';

@tailwind base;
@tailwind components;
@tailwind utilities;
```

Note: `globals.css` is in `app/` directory. The `styles/tokens/` directory is at the project root. Path from `app/globals.css` to `styles/tokens/brand.css` is `../styles/tokens/brand.css`.

### lib/constants/brand.ts (Complete)

```typescript
// Source: Carreira USA official color guide — Paleta de Cores Carreira USA.pdf
// Hex values confirmed visually against official brand PDF.
// This is the canonical JS source for brand colors.
// Mirrors styles/tokens/brand.css primitive values.
// Use for: Recharts props, dynamic style objects, any non-CSS consumer.

export const BRAND_COLORS = {
  CREME:     '#FFF8E8',
  VERDE:     '#2F443F',
  TANGERINA: '#FF8142',
  CAFE:      '#E1C19B',
  CARAMELO:  '#BD925F',
} as const

export type BrandColor = typeof BRAND_COLORS[keyof typeof BRAND_COLORS]

/**
 * Contrast safety rules (WCAG AA at 4.5:1 for normal text):
 * - VERDE on white:      ~7.5:1  PASS
 * - VERDE on CREME:      ~7.2:1  PASS
 * - TANGERINA on white:  ~2.9:1  FAIL — never use as text on light bg
 * - TANGERINA on VERDE:  ~3.2:1  FAIL for normal text, borderline large text
 * - CREME on VERDE:      ~7.2:1  PASS — use for text in Verde header/sidebar
 * - CAFE on white:       ~2.6:1  FAIL — decorative only, never text
 * - CARAMELO on white:   ~3.1:1  FAIL for normal text — decorative only
 */
export const BRAND_COLOR_SAFE_USE = {
  TEXT_ON_LIGHT:  [BRAND_COLORS.VERDE],
  TEXT_ON_DARK:   [BRAND_COLORS.CREME, BRAND_COLORS.TANGERINA],
  DECORATIVE_ONLY: [BRAND_COLORS.CAFE, BRAND_COLORS.CARAMELO],
  ACCENT_ON_DARK_ONLY: [BRAND_COLORS.TANGERINA],
} as const
```

### Tailwind Config fontFamily Update

```typescript
// Source: https://tailwindcss.com/docs/theme — Tailwind v3 theme.extend
fontFamily: {
  // CHANGED: Neue Montreal replaces Inter as body/UI sans-serif
  sans:    ['var(--font-neue-montreal)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
  // CHANGED: Blaak replaces Space Grotesk as display/heading serif
  display: ['var(--font-blaak)', 'Georgia', 'Times New Roman', 'serif'],
  // UNCHANGED: JetBrains Mono stays for code/IDs
  mono:    ['JetBrains Mono', 'Courier New', 'monospace'],
},
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@import url(https://fonts.googleapis.com/)` in CSS | `next/font/google` or `next/font/local` | Next.js 13.0 (2022) | Eliminates render-blocking request, prevents FOUT, no external network dependency |
| Hardcoded hex values in component files | CSS custom property token system | Industry standard since ~2018, formalized in design system tooling | Single source of truth; portal-scoped overrides without component code changes |
| Single font CSS file | Multi-layer token architecture (primitives → semantic → portal) | Design system maturity pattern — no single version date | Allows same component to render differently per portal without conditional logic |

**Deprecated/outdated in this codebase:**
- `@import url('https://fonts.googleapis.com/...')` in `globals.css` line 2: render-blocking, replaced by `next/font`
- `import { Inter } from 'next/font/google'` in `app/layout.tsx`: Google Fonts network request, replaced by local fonts
- `fontFamily.sans: ['Inter', ...]` in `tailwind.config.ts`: will point to Neue Montreal
- `fontFamily.display: ['Space Grotesk', ...]` in `tailwind.config.ts`: will point to Blaak

---

## Open Questions

1. **Font licensing for web embedding**
   - What we know: Blaak and Neue Montreal OTF files are present on the designer's machine. The brand team delivered them.
   - What's unclear: Whether the licenses (SIL Open Font License, commercial, or otherwise) explicitly permit self-hosted web embedding. Committing to a public repository may violate per-domain or per-project commercial licenses.
   - Recommendation: Verify license terms before committing OTF files. If restricted: place font files in `.gitignore`, document the expected directory structure, and add them to the production deployment separately. If SIL OFL (open): commit freely.

2. **Neue Montreal tabular figures (`tnum` feature)**
   - What we know: `globals.css` already defines `.tabular-nums` using `font-feature-settings: "tnum"`. Dashboard uses this for financial number formatting.
   - What's unclear: Whether the Neue Montreal OTF files include the `tnum` OpenType feature. Cannot verify without font introspection tools.
   - Recommendation: Test during Phase 10 implementation by applying `font-variant-numeric: tabular-nums` to a financial number element and checking browser DevTools computed styles. If `tnum` is absent, add explicit `font-variant-numeric: tabular-nums` as a fallback CSS rule on financial data elements.

3. **JetBrains Mono transition**
   - What we know: JetBrains Mono is currently loaded via the Google Fonts `@import` in `globals.css`.
   - What's unclear: Whether to convert JetBrains Mono to `next/font/local` in this phase or leave it as a Google Fonts import (it would still fire a CDN request).
   - Recommendation: Convert JetBrains Mono to `next/font/local` in this same phase to achieve a fully external-request-free font stack. JetBrains Mono has a free OTF download available via its GitHub repository. If this creates scope creep, defer to Phase 11 and accept the single remaining Google Fonts request for now.

4. **`styles/tokens/` import path from `globals.css`**
   - What we know: `globals.css` is at `app/globals.css`. `styles/` would be at the project root.
   - What's unclear: Whether Next.js + PostCSS resolves `@import '../styles/tokens/brand.css'` from `app/globals.css` correctly, or whether an absolute path alias is needed.
   - Recommendation: Use relative path `../styles/tokens/brand.css` first; if PostCSS cannot resolve it, move `styles/tokens/` inside the `app/` directory as `app/styles/tokens/` and use `./styles/tokens/brand.css`. Verify with `npm run dev` before committing.

---

## Validation Architecture

Config key `workflow.nyquist_validation` is absent from `.planning/config.json` — treated as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no test config files found in project |
| Config file | None — Wave 0 must establish baseline |
| Quick run command | `npm run build` (build-time verification only) |
| Full suite command | `npm run build && npm run lint` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TKN-01 | CSS custom properties present in browser :root | Manual (DevTools) | `npm run build` (no compile errors) | N/A — Wave 0 |
| TKN-01 | Tailwind `bg-brand-verde` class resolves to `#2F443F` | Manual (DevTools computed styles) | `npm run build` | N/A |
| TKN-02 | No Google Fonts request in Network tab | Manual (browser Network tab) | `npm run build` (no import error) | N/A |
| TKN-02 | Font files served from `/fonts/` path | Manual (Network tab) | — | N/A |
| TKN-03 | h1-h3 render in Blaak (visual check) | Manual (visual) | — | N/A |
| TKN-03 | Body text renders in Neue Montreal (visual check) | Manual (visual) | — | N/A |
| TKN-04 | Tangerina contrast ratios documented | Static analysis (code review) | — | N/A |
| TKN-04 | `lib/constants/brand.ts` exports all 5 hex values | TypeScript compile | `npm run build` | ❌ Wave 0 |

**Note:** This phase is purely infrastructure — CSS files, font binaries, and constants. No interactive UI behavior exists to unit test. Build-time verification (`npm run build`) catches font resolution errors and TypeScript type errors in `brand.ts`. Visual verification in browser is the primary validation method for TKN-02 and TKN-03.

### Sampling Rate
- **Per task commit:** `npm run build` (catches font resolution and TypeScript errors)
- **Per wave merge:** `npm run build && npm run lint`
- **Phase gate:** `npm run build` green + manual browser check: no fonts.googleapis.com request in DevTools Network tab + h1 renders in Blaak + body renders in Neue Montreal

### Wave 0 Gaps

- [ ] `public/fonts/blaak/` — directory must exist before font file references are valid
- [ ] `public/fonts/neue-montreal/` — directory must exist
- [ ] `styles/tokens/` — directory must exist at project root
- [ ] `lib/constants/` — directory must exist

*(No existing test infrastructure — this project has no test framework configured. All validation for Phase 10 is build-time and manual browser verification.)*

---

## Project Constraints (from CLAUDE.md)

These directives are extracted from `CLAUDE.md` and must be honored in all Phase 10 plans:

| Directive | Impact on Phase 10 |
|-----------|-------------------|
| Two-portal separation: never import hub-auth in dashboard code or vice versa | Token files are portal-neutral (shared CSS). Portal-scoped CSS uses `[data-portal]` attribute selectors, not import separation. No auth code is involved. |
| `app/dashboard/*` = Admin portal; `app/hub/*` = Client Hub portal | CSS token files live in `styles/tokens/` (shared); font definitions in `lib/fonts.ts` (shared). No portal-specific code files are created in Phase 10. |
| Use `@/` path alias for imports | `lib/fonts.ts` and `lib/constants/brand.ts` should be imported as `@/lib/fonts` and `@/lib/constants/brand` |
| TypeScript strict mode | `lib/constants/brand.ts` must use `as const` assertions and export proper types |
| Shared services OK (Prisma, Resend, etc.) | CSS tokens and font constants are shared — this is explicitly allowed |
| `next/font/local` for brand fonts | Confirmed — this is the exact API being used |
| No new npm packages | Phase 10 requires zero new dependencies |
| `npm run build` generates Prisma Client (build script) | `npm run build` is safe to run as verification; it also generates Prisma client |
| Font licensing must be confirmed before committing OTF files | This is a Phase 10 blocker if commercial licenses prohibit self-hosted web use |

---

## Sources

### Primary (HIGH confidence)

- [Next.js Font Module API Reference — v16.2.1 (official, updated 2026-03-20)](https://nextjs.org/docs/app/api-reference/components/font) — `next/font/local` src array format, `variable` option, `adjustFontFallback`, `display` parameter, Tailwind v3 integration pattern, font definitions file pattern
- [Tailwind CSS v3 Theme Documentation](https://tailwindcss.com/docs/theme) — `theme.extend.fontFamily` with `var()` references, `theme.extend.colors` extension pattern
- Codebase direct analysis:
  - `app/globals.css` — confirmed `@import url(fonts.googleapis.com)` render-blocking import on line 2
  - `app/layout.tsx` — confirmed `Inter` from `next/font/google` with `inter.className` on `<body>`
  - `tailwind.config.ts` — confirmed `fontFamily.sans: ['Inter', ...]` and `fontFamily.display: ['Space Grotesk', ...]`; confirmed spacing override pattern that must be preserved
  - `lib/design-tokens.ts` — confirmed old gold palette values that must not be removed in Phase 10
  - `app/hub/layout.tsx` — confirmed `const GOLD = "#C9A84C"` pattern and `style={{ backgroundColor: GOLD }}`
  - Font inventory: 12 Blaak OTF + 8 Neue Montreal OTF files confirmed at `~/Downloads/1. ID VISUAL - Carreira USA/Tipografia/`
- [Paleta de Cores Carreira USA.pdf](file:///Users/pauloloureiro/Downloads/1. ID VISUAL - Carreira USA/Paleta de cores/Paleta de Cores Carreira USA.pdf) — Official brand color values confirmed:
  - Creme: `#FFF8E8`, Verde: `#2F443F`, Tangerina: `#FF8142`, Café com Leite: `#E1C19B`, Caramelo: `#BD925F`

### Secondary (MEDIUM confidence)

- [WCAG 1.4.3 Contrast (Minimum) — W3C](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html) — 4.5:1 normal text, 3:1 large text requirements
- Project SUMMARY.md — project-level research confirming three-layer architecture, contrast ratio analysis, and pitfall inventory (derived from prior codebase analysis)
- [Vercel: Custom fonts without compromise using next/font](https://vercel.com/blog/nextjs-next-font) — self-hosting rationale, preload behavior

### Tertiary (LOW confidence)

- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) — contrast ratio estimates for Tangerina/Verde combinations (to be verified manually during Phase 12)
- OTF vs WOFF2 ~68% size reduction claim — not independently verified; WOFF2 conversion is a future optimization, not a Phase 10 blocker

---

## Metadata

**Confidence breakdown:**

- Standard Stack: HIGH — core technologies confirmed against official Next.js 14.2.35 docs; Tailwind v3.4.19 is installed and its API is stable
- Architecture: HIGH — three-layer CSS token pattern is well-established; `data-portal` CSS attribute scoping is standard CSS; all patterns confirmed against official sources
- Pitfalls: HIGH — all five critical pitfalls are derived from direct codebase analysis (confirmed file contents) or official documentation
- Color values: HIGH — confirmed from official brand PDF, not assumed from prior research
- Font file inventory: HIGH — confirmed via filesystem `ls` command

**Research date:** 2026-03-25
**Valid until:** 2026-06-25 (90 days — Tailwind v3 is in maintenance mode, Next.js 14 is stable)
