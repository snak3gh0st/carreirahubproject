# Stack Research

**Domain:** Brand identity reskin — Next.js 14 App Router with dual portals
**Researched:** 2026-03-25
**Confidence:** HIGH (next/font/local from official docs; Tailwind v3 patterns verified; OTF→WOFF2 from multiple sources)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `next/font/local` | Built into Next.js 14.2.35 | Self-host Blaak and Neue Montreal .otf fonts | Zero-config layout-shift prevention (CLS=0); `@font-face` injected at build time; CSS variable output integrates directly with Tailwind v3 `fontFamily` extend; no additional package needed |
| Tailwind CSS (existing) | 3.4.19 | Token-mapped utility classes | Already installed. `theme.extend.colors` with CSS variable references — no migration to v4 warranted; v3's `var(--token)` approach already in use throughout codebase |
| CSS Custom Properties | Browser-native | Design token SSOT | Already used project-wide (see `--primary-*`, `--gray-*` in globals.css). Extend to Carreira brand palette using same pattern. Tailwind consumes tokens via `var(--token)` references already in tailwind.config.ts |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fontsource` converter (web tool) | N/A (build-time only) | Convert .otf files to .woff2 before committing | Use ONCE when dropping font files into the project — run each .otf through https://fontsource.org/tools/converter to get .woff2; commit both formats side by side |
| tints.dev (web tool) | N/A (design-time only) | Generate full 11-stop color scales (50→950) from brand hex values | Use ONCE to generate Tailwind-ready OKLCH/hex scales for: Creme #FFF8E8, Verde #2F443F, Tangerina #FF8142, Cafe com Leite #E1C19B, Caramelo #BD925F; select "Tailwind v3" + "hex" output and paste into globals.css |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `fontsource.org/tools/converter` | OTF → WOFF2 conversion | Free, client-side, no upload required. Converts Blaak.otf → Blaak.woff2 and NueMontreal-*.otf → NueMontreal-*.woff2. Do this before creating `app/fonts/` |
| `tints.dev` | Generate color scale from a single brand hex | Generates 0/50/100/200/300/400/500/600/700/800/900/950/1000 stops; exports hex (compatible with Tailwind v3 config); select brand color as the 500-stop |

---

## Integration Points

### 1. Font Files: Location and Format

Place converted font files **co-located inside `app/fonts/`** (not `public/fonts/`). The path for `localFont` src is resolved relative to the calling file.

```
app/
  fonts/
    Blaak-Regular.woff2      ← primary
    Blaak-Regular.otf        ← fallback (next/font supports .otf natively)
    Blaak-Bold.woff2
    Blaak-Bold.otf
    NueMontreal-Regular.woff2
    NueMontreal-Regular.otf
    NueMontreal-Medium.woff2
    NueMontreal-Medium.otf
    NueMontreal-Bold.woff2
    NueMontreal-Bold.otf
  fonts.ts                   ← single source of truth for font instances
```

**Why co-locate in `app/fonts/` instead of `public/`:** When files are in `app/`, Next.js resolves paths at build time and auto-generates `<link rel="preload">` tags scoped to the routes that use the font. Files in `public/` are served as static assets without this preloading optimization.

### 2. Font Definitions File

Create `app/fonts.ts` as the single font-instantiation file. Import from this file everywhere — never call `localFont()` in multiple places for the same font.

```typescript
// app/fonts.ts
import localFont from 'next/font/local'

export const blaak = localFont({
  src: [
    {
      path: './fonts/Blaak-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/Blaak-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-blaak',
  display: 'swap',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
  adjustFontFallback: 'Times New Roman',  // minimizes CLS during font load
})

export const nueMontreal = localFont({
  src: [
    {
      path: './fonts/NueMontreal-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/NueMontreal-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: './fonts/NueMontreal-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-nue-montreal',
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'sans-serif'],
  adjustFontFallback: 'Arial',
})
```

### 3. Root Layout: Apply CSS Variables to `<html>`

Update `app/layout.tsx` to inject both CSS variable classNames onto `<html>`. This makes `--font-blaak` and `--font-nue-montreal` available project-wide.

```typescript
// app/layout.tsx
import { blaak, nueMontreal } from './fonts'

export default function RootLayout({ children }) {
  return (
    <html
      lang="pt-BR"
      className={`${blaak.variable} ${nueMontreal.variable}`}
      suppressHydrationWarning
    >
      <body>
        {children}
      </body>
    </html>
  )
}
```

**Important:** Remove the existing `const inter = Inter(...)` from layout.tsx and its `inter.className` on `<body>` — replace with the CSS variable approach on `<html>` instead.

### 4. Tailwind Config: Wire Font CSS Variables

Update `tailwind.config.ts` `theme.extend.fontFamily` to reference the CSS variables:

```typescript
// tailwind.config.ts (theme.extend section)
fontFamily: {
  // NEW brand fonts
  display: ['var(--font-blaak)', 'Georgia', 'Times New Roman', 'serif'],
  sans: ['var(--font-nue-montreal)', 'system-ui', '-apple-system', 'sans-serif'],
  // Keep mono for code
  mono: ['JetBrains Mono', 'Courier New', 'monospace'],
},
```

This replaces the existing `Inter`/`Space Grotesk` entries. The CSS variables are available because the layout injects them via `blaak.variable` + `nueMontreal.variable` classNames.

Usage in components becomes `font-display` (Blaak, for headings/display) and `font-sans` (Neue Montreal, for body text) — same class names, new values.

### 5. Design Token Architecture: CSS Custom Properties

The codebase **already uses this pattern correctly** — Tailwind referencing `var(--token)` in the config, with token values in `:root` inside `globals.css`. Extend this exact pattern for the Carreira brand palette.

Add to `globals.css` in the `:root` block:

```css
/* ========================================
   CARREIRA USA BRAND PALETTE
   New Identity — March 2026
   ======================================== */

/* Creme — Primary background, paper feel */
--brand-creme-50:  #FFFEFB;
--brand-creme-100: #FFFDF5;
--brand-creme-200: #FFF8E8;   /* ← brand anchor: Creme #FFF8E8 */
--brand-creme-300: #FFF1D0;
--brand-creme-400: #FFE9B3;
--brand-creme-500: #FFE099;
--brand-creme-600: #E6C470;
--brand-creme-700: #C9A84C;
--brand-creme-800: #A88933;
--brand-creme-900: #7A6326;
--brand-creme-950: #4D3C13;

/* Verde — Primary brand color, dark green */
--brand-verde-50:  #EBF0EE;
--brand-verde-100: #D4E0DB;
--brand-verde-200: #A8C1B6;
--brand-verde-300: #7A9F92;
--brand-verde-400: #507D6E;
--brand-verde-500: #2F443F;   /* ← brand anchor: Verde #2F443F */
--brand-verde-600: #283B37;
--brand-verde-700: #20302C;
--brand-verde-800: #172421;
--brand-verde-900: #0E1815;
--brand-verde-950: #070C0B;

/* Tangerina — CTA, accent, interactive */
--brand-tangerina-50:  #FFF4EE;
--brand-tangerina-100: #FFE8D5;
--brand-tangerina-200: #FFD0AA;
--brand-tangerina-300: #FFB47A;
--brand-tangerina-400: #FF9A5B;
--brand-tangerina-500: #FF8142;   /* ← brand anchor: Tangerina #FF8142 */
--brand-tangerina-600: #E05C1A;
--brand-tangerina-700: #B84714;
--brand-tangerina-800: #8F340D;
--brand-tangerina-900: #661F06;
--brand-tangerina-950: #380F01;

/* Cafe com Leite — Warm neutral, borders, subtle backgrounds */
--brand-cafe-50:  #FBF8F4;
--brand-cafe-100: #F5EDE1;
--brand-cafe-200: #ECD8C0;
--brand-cafe-300: #E1C19B;   /* ← brand anchor: Cafe com Leite #E1C19B */
--brand-cafe-400: #D5A87A;
--brand-cafe-500: #C68E5C;
--brand-cafe-600: #A87040;
--brand-cafe-700: #875531;
--brand-cafe-800: #643D22;
--brand-cafe-900: #3E2614;
--brand-cafe-950: #1E100A;

/* Caramelo — Secondary accent, warm depth */
--brand-caramelo-50:  #FAF3E8;
--brand-caramelo-100: #F3E3CC;
--brand-caramelo-200: #E6C89A;
--brand-caramelo-300: #D4A96E;
--brand-caramelo-400: #C79B5A;   /* ← midpoint */
--brand-caramelo-500: #BD925F;   /* ← brand anchor: Caramelo #BD925F */
--brand-caramelo-600: #9E6E3A;
--brand-caramelo-700: #7C512A;
--brand-caramelo-800: #5A381A;
--brand-caramelo-900: #37210D;
--brand-caramelo-950: #190E04;
```

**Note:** Run all five hex anchors through tints.dev (select "Tailwind v3" + "hex" output, set anchor as 200/500/500/300/500 respectively) to get perceptually uniform stops. The values above are starting approximations. Tints.dev output supersedes these.

### 6. Tailwind Config: Wire Brand Colors

Extend `tailwind.config.ts` `theme.extend.colors` with the new brand tokens:

```typescript
// tailwind.config.ts (inside theme.extend.colors)
'brand-creme': {
  50:  'var(--brand-creme-50)',
  100: 'var(--brand-creme-100)',
  200: 'var(--brand-creme-200)',
  300: 'var(--brand-creme-300)',
  // ... etc
  DEFAULT: 'var(--brand-creme-200)',
},
'brand-verde': {
  50:  'var(--brand-verde-50)',
  // ...
  500: 'var(--brand-verde-500)',
  DEFAULT: 'var(--brand-verde-500)',
},
'brand-tangerina': {
  // ...
  500: 'var(--brand-tangerina-500)',
  DEFAULT: 'var(--brand-tangerina-500)',
},
'brand-cafe': {
  // ...
  300: 'var(--brand-cafe-300)',
  DEFAULT: 'var(--brand-cafe-300)',
},
'brand-caramelo': {
  // ...
  500: 'var(--brand-caramelo-500)',
  DEFAULT: 'var(--brand-caramelo-500)',
},
```

The `brand-` prefix prevents collision with the existing `gold`, `primary`, `gray` tokens that power the Admin Dashboard. Both portals can adopt the new tokens selectively.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `next/font/local` with WOFF2 | Serve .otf directly from `public/fonts/` via CSS `@font-face` | Never — `next/font/local` wraps `@font-face` with CLS prevention, preloading, and build-time path resolution. Raw `@font-face` in CSS gives none of these. |
| CSS custom properties + Tailwind `var()` references | Hardcode hex values directly in tailwind.config.ts | Only if dark mode theming is never needed — CSS variables are required for runtime theme switching (next-themes already installed) |
| Convert OTF to WOFF2 before committing | Use .otf files directly with `next/font/local` | .otf files work natively with `next/font/local`, so if conversion is blocked, they can be used directly. However, WOFF2 is ~68% smaller on the wire — strongly prefer WOFF2 for Vercel edge delivery |
| `app/fonts/` directory (co-located) | `public/fonts/` directory | `public/fonts/` works but loses automatic route-scoped preloading. Use `public/fonts/` only if font files are also needed outside Next.js (e.g., email templates) |
| Tailwind CSS v3 (keep current) | Migrate to Tailwind CSS v4 | v4 uses `@theme` directive in CSS instead of `tailwind.config.ts`. DO NOT migrate during a reskin — it would require rewriting all design tokens and is a separate project |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@import url(...)` for custom fonts (Google Fonts style) | Already in globals.css for Space Grotesk/Inter — this is the pattern being replaced. External font requests break privacy, can fail on slow networks, and cause FOUT | `next/font/local` with self-hosted files |
| Inline `style={{ fontFamily: '...' }}` in components | Bypasses Tailwind token system, breaks design consistency, not purgeable | `font-display` / `font-sans` Tailwind utility classes |
| Multiple `localFont()` calls for the same font family | Creates duplicate `@font-face` declarations, wastes memory | Single `app/fonts.ts` definitions file imported everywhere |
| `.otf` files served from `public/` without conversion | OTF files are desktop-format; ~3x larger than equivalent WOFF2; no subsetting; all font data downloaded regardless of characters used | Convert to WOFF2 first; keep .otf as fallback in the `src` array |
| Tailwind v4 `@theme` directive | Project runs tailwindcss@3.4.19 — v4 syntax is incompatible and would break the entire config | Stay on Tailwind v3 patterns until a dedicated migration milestone |
| Hardcoding brand colors as bare hex in component JSX (e.g., `style={{ color: '#2F443F' }}`) | Already present in `hub/layout.tsx` (`const GOLD = "#C9A84C"`) — this is the anti-pattern the reskin should eliminate | Use Tailwind `text-brand-verde-500` or `var(--brand-verde-500)` |

---

## Version Compatibility

| Package | Version in Project | Compatibility Notes |
|---------|-------------------|---------------------|
| `next` | 14.2.35 | `next/font/local` fully supported since v13. CSS variable approach via `variable` param works in all v14 builds |
| `tailwindcss` | 3.4.19 | `theme.extend.fontFamily` with `var(--css-var)` fully supported. Do NOT use v4 `@theme` syntax |
| `next-themes` | 0.4.6 | Supports `attribute="class"` (current) or `attribute="data-theme"` — both work with CSS custom property tokens |
| `tailwind-merge` | 2.6.0 | No changes needed — merges brand classes the same as any Tailwind classes |

---

## Installation

No new npm packages are required for the core reskin. The entire solution uses:
- `next/font/local` — already in Next.js 14 (no install needed)
- CSS custom properties — browser-native
- Tailwind v3 `theme.extend` — already in project

```bash
# No new dependencies needed for core font + color token work

# Optional: if you want programmatic color scale generation (instead of tints.dev)
npm install -D culori
# culori is ESM-native, supports OKLCH, and is used by Tailwind v4 and Radix UI
# Use case: generate all 11 stops from a single brand hex in a build script
# Skip this if using tints.dev manually — it's simpler for a one-time reskin
```

---

## Stack Patterns by Portal

**Admin Dashboard (`/dashboard/*`):**
- Reskin is additive — add `brand-verde`, `brand-creme` etc. tokens alongside existing `gold`, `primary` tokens
- Neue Montreal for body text (replace Inter); Blaak for dashboard headings (replace Space Grotesk)
- Both font CSS variables available globally via root layout

**Client Hub (`/hub/*`):**
- Hub layout currently uses hardcoded `#FBF8F0` background and `#C9A84C` gold — migrate to `bg-brand-creme-100` and `text-brand-caramelo-500`
- Higher visual brand fidelity expected here (customer-facing) — apply full Blaak display treatment to headings
- Same root-level CSS variables, no portal-specific font loading needed

---

## Sources

- [Next.js Font Optimization — official docs (v16.2.1, updated 2026-03-20)](https://nextjs.org/docs/app/getting-started/fonts) — `next/font/local` integration, App Router behavior, preloading scope
- [Next.js Font Module API Reference](https://nextjs.org/docs/app/api-reference/components/font) — `variable`, `src` array, `adjustFontFallback`, `display` params (HIGH confidence — official current docs)
- [Tailwind CSS v3 Font Family docs](https://v3.tailwindcss.com/docs/font-family) — `theme.extend.fontFamily` with CSS variable values (HIGH confidence)
- [Fontsource OTF→WOFF2 converter](https://fontsource.org/tools/converter) — Free client-side conversion tool (MEDIUM confidence — web tool, not docs)
- [tints.dev](https://www.tints.dev/) — 11-stop color scale generator with Tailwind v3/v4 output (MEDIUM confidence — widely used community tool)
- [OTF vs WOFF2 performance comparison](https://font-converters.com/compare/otf-vs-woff2) — ~68% file size reduction claim (MEDIUM confidence — third-party comparison)
- [culori vs chroma-js vs tinycolor2 comparison 2026](https://www.pkgpulse.com/blog/culori-vs-chroma-js-vs-tinycolor2-color-manipulation-javascript-2026) — Library selection rationale (MEDIUM confidence — community analysis)

---
*Stack research for: Carreira USA brand identity reskin — Next.js 14 + Tailwind v3*
*Researched: 2026-03-25*
