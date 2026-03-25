# Architecture Research

**Domain:** Brand identity reskin — design token system for dual-portal Next.js 14 App Router application
**Researched:** 2026-03-25
**Confidence:** HIGH

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Brand Token Layer                                  │
│   public/fonts/   lib/fonts.ts   styles/tokens/   public/assets/    │
│   (Blaak.otf,     (next/font     (brand.css,       (logo.svg,        │
│   NMontreal.otf)   definitions)   portal overrides) patterns/)       │
├─────────────────────────────────────────────────────────────────────┤
│                  Token Distribution Layer                             │
│   globals.css (:root primitives)  tailwind.config.ts (utilities)    │
│   styles/dashboard.css            styles/hub.css                     │
│   ([data-portal="dashboard"] {…}) ([data-portal="hub"] {…})         │
├─────────────────────────────────────────────────────────────────────┤
│                  Component Layer                                      │
│  ┌──────────────────┐        ┌────────────────────────────────────┐  │
│  │  Shared UI        │        │  Portal-Specific Components        │  │
│  │  components/ui/   │        │  components/dashboard/*            │  │
│  │  Button, Card,    │        │  app/hub/* inline components       │  │
│  │  Badge, Input,    │        │  Logo (variant prop)               │  │
│  │  StatCard         │        │  PatternBackground                 │  │
│  └──────────────────┘        └────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                   Layout Layer                                        │
│  app/layout.tsx (root — fonts injected as CSS vars on <html>)       │
│  app/dashboard/layout.tsx   app/hub/layout.tsx                      │
│  (data-portal="dashboard")  (data-portal="hub")                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|---------------|----------------|
| `lib/fonts.ts` | Single font definition source, exports CSS variable names | `localFont` instances exported as constants |
| `app/layout.tsx` | Inject font CSS variables onto `<html>` | `className={blaak.variable + " " + neueMontreal.variable}` |
| `styles/tokens/brand.css` | Primitive color tokens (verde, tangerina, escuro, etc.) | `:root { --brand-verde: #... }` |
| `styles/tokens/portal-dashboard.css` | Dashboard-specific semantic overrides | `[data-portal="dashboard"] { --portal-accent: ... }` |
| `styles/tokens/portal-hub.css` | Hub-specific semantic overrides | `[data-portal="hub"] { --portal-accent: ... }` |
| `tailwind.config.ts` | Map CSS variables to Tailwind utility classes | `colors: { verde: 'var(--brand-verde)' }` |
| `components/brand/Logo.tsx` | Logo with variant system (dark/light/symbol) | Inline SVG component, currentColor aware |
| `components/brand/PatternBackground.tsx` | Texture/pattern overlay | SVG as CSS `background-image` data URI |
| `app/dashboard/layout.tsx` | Set `data-portal="dashboard"` on wrapper | Activates dashboard token overrides |
| `app/hub/layout.tsx` | Set `data-portal="hub"` on wrapper | Activates hub token overrides |

---

## Recommended Project Structure

```
carreirahubproject/
├── public/
│   ├── fonts/                     # Font source files
│   │   ├── Blaak-Regular.otf      # Serif display font
│   │   ├── Blaak-Bold.otf
│   │   ├── NouveauMontreal-Regular.otf   # Sans-serif body font
│   │   ├── NouveauMontreal-Medium.otf
│   │   └── NouveauMontreal-Bold.otf
│   └── assets/
│       ├── logo-full.svg          # Full logo (wordmark + icon) — static use
│       ├── logo-symbol.svg        # Icon-only — favicon, avatar fallback
│       └── logo-white.svg         # White version for dark backgrounds
│
├── lib/
│   └── fonts.ts                   # SINGLE font definition file (next/font/local)
│
├── styles/
│   └── tokens/
│       ├── brand.css              # Primitive tokens — raw color palette values
│       ├── semantic.css           # Semantic aliases — role-based names
│       ├── portal-dashboard.css   # Dashboard-specific overrides
│       └── portal-hub.css         # Hub-specific overrides
│
├── components/
│   ├── brand/
│   │   ├── Logo.tsx               # NEW: multi-variant logo component
│   │   └── PatternBackground.tsx  # NEW: texture/pattern overlay
│   └── ui/
│       ├── button.tsx             # MODIFY: swap gold-* for verde-* / brand tokens
│       ├── badge.tsx              # MODIFY: same token swap
│       ├── stat-card.tsx          # MODIFY: same token swap
│       ├── input.tsx              # MODIFY: focus ring token swap
│       └── card.tsx               # MODIFY: hover border token swap
│
├── app/
│   ├── globals.css                # MODIFY: import token files, update @font-face refs
│   ├── layout.tsx                 # MODIFY: apply font CSS variables to <html>
│   ├── dashboard/
│   │   └── layout.tsx             # MODIFY: add data-portal="dashboard" to wrapper
│   └── hub/
│       └── layout.tsx             # MODIFY: add data-portal="hub" to wrapper
│
└── tailwind.config.ts             # MODIFY: map new brand token CSS vars to utilities
```

### Structure Rationale

- **`public/fonts/`** — Co-locating `.otf` files inside `public/` makes paths simple for `localFont` (`src: '/fonts/Blaak-Regular.otf'`), serves them statically via Vercel CDN, and keeps them accessible for potential CSS `@font-face` fallbacks. Next.js resolves `localFont` paths relative to the calling file; when defined in `lib/fonts.ts`, `public/` is the cleanest cross-file target.

- **`lib/fonts.ts`** — The "one instance" rule from Next.js docs: calling `localFont()` in multiple files creates multiple hosted instances. A single exported file prevents duplication.

- **`styles/tokens/`** — Splitting tokens into separate files (brand primitives, semantic aliases, portal overrides) keeps concerns isolated. Each file is `@import`ed in `globals.css`. This is **not** Tailwind v4 — the project runs Tailwind v3.4, so `@theme` is unavailable. CSS custom properties in `:root` fed into `tailwind.config.ts` via `var()` references remains the correct v3 dual-layer approach.

- **`components/brand/`** — A dedicated folder for brand-identity components that don't belong in `components/ui/` (generic) or `components/dashboard/` (portal-specific). Logo and PatternBackground are brand concerns shared across both portals with variant props.

---

## Architectural Patterns

### Pattern 1: CSS Variable Dual-Layer Tokens (Primitives + Semantics)

**What:** Define raw palette values as primitive tokens, then alias them with role-based semantic names. Tailwind utilities reference the semantic layer, not primitives directly.

**When to use:** Always — this allows swapping the entire palette by repointing semantic tokens without touching any Tailwind class in components.

**Trade-offs:** Slight indirection to trace a color; pays off immediately when portal overrides or future brand changes land.

**Example:**
```css
/* styles/tokens/brand.css — primitives */
:root {
  --brand-verde-500: #2D6A4F;
  --brand-verde-600: #1B4332;
  --brand-tangerina-500: #F4631E;
  --brand-tangerina-600: #D44D0D;
  --brand-escuro: #1A1A1A;
  --brand-creme: #FBF8F0;
}

/* styles/tokens/semantic.css — aliases */
:root {
  --color-accent: var(--brand-verde-500);
  --color-accent-hover: var(--brand-verde-600);
  --color-cta: var(--brand-tangerina-500);
  --color-surface-dark: var(--brand-escuro);
  --color-surface-base: var(--brand-creme);
}
```

```ts
/* tailwind.config.ts — Tailwind references semantic tokens */
theme: {
  extend: {
    colors: {
      verde: {
        500: 'var(--brand-verde-500)',
        600: 'var(--brand-verde-600)',
      },
      tangerina: {
        500: 'var(--brand-tangerina-500)',
        600: 'var(--brand-tangerina-600)',
      },
      accent: 'var(--color-accent)',
      cta: 'var(--color-cta)',
    }
  }
}
```

### Pattern 2: Portal-Scoped CSS Variable Overrides via `data-portal` Attribute

**What:** Each portal layout wraps content in a div (or the `<html>` element via `data-*`) with a portal identifier. Portal-specific CSS files override semantic tokens under that selector scope. Shared components pick up different colors automatically without any conditional logic in component code.

**When to use:** When two portals share 80%+ of components but differ in accent colors, surface treatments, or brand emphasis.

**Trade-offs:** Adds a layer of CSS specificity management; portal token files must be kept small and focused on overrides only (not re-declaring all primitives).

**Example:**
```css
/* styles/tokens/portal-dashboard.css */
[data-portal="dashboard"] {
  --color-accent: var(--brand-verde-500);       /* Admin uses verde */
  --color-accent-hover: var(--brand-verde-600);
  --color-sidebar-bg: var(--brand-escuro);
}

/* styles/tokens/portal-hub.css */
[data-portal="hub"] {
  --color-accent: var(--brand-tangerina-500);   /* Hub uses tangerina */
  --color-accent-hover: var(--brand-tangerina-600);
  --color-surface-base: var(--brand-creme);     /* Warm cream bg */
}
```

```tsx
/* app/dashboard/layout.tsx */
<div data-portal="dashboard" className="min-h-screen bg-[var(--color-surface-base)]">
  ...
</div>

/* app/hub/layout.tsx */
<div data-portal="hub" className="min-h-screen bg-[var(--color-surface-base)]">
  ...
</div>
```

### Pattern 3: Font Definitions File with CSS Variables + Tailwind Integration

**What:** All `localFont` calls live in one `lib/fonts.ts` file. Each font instance uses the `variable` option to expose a CSS custom property. The root layout applies all variable classes to `<html>`. Tailwind config maps the CSS variables to `fontFamily` utilities.

**When to use:** Always with multiple custom fonts in Next.js — prevents multiple hosted instances and centralizes loading.

**Trade-offs:** `.otf` files are supported by `next/font/local` (it converts and serves them). They are larger than `.woff2` — if performance budget is tight, convert to `.woff2` first. For initial implementation, `.otf` works.

**Example:**
```ts
/* lib/fonts.ts */
import localFont from 'next/font/local'

export const blaak = localFont({
  src: [
    { path: '../public/fonts/Blaak-Regular.otf', weight: '400', style: 'normal' },
    { path: '../public/fonts/Blaak-Bold.otf',    weight: '700', style: 'normal' },
  ],
  variable: '--font-blaak',
  display: 'swap',
})

export const neueMontreal = localFont({
  src: [
    { path: '../public/fonts/NouveauMontreal-Regular.otf', weight: '400', style: 'normal' },
    { path: '../public/fonts/NouveauMontreal-Medium.otf',  weight: '500', style: 'normal' },
    { path: '../public/fonts/NouveauMontreal-Bold.otf',    weight: '700', style: 'normal' },
  ],
  variable: '--font-neue-montreal',
  display: 'swap',
})
```

```tsx
/* app/layout.tsx */
import { blaak, neueMontreal } from '@/lib/fonts'

<html lang="pt-BR" className={`${blaak.variable} ${neueMontreal.variable}`}>
```

```ts
/* tailwind.config.ts */
fontFamily: {
  display: ['var(--font-blaak)', 'Georgia', 'serif'],
  sans:    ['var(--font-neue-montreal)', 'system-ui', 'sans-serif'],
}
```

### Pattern 4: Logo Component with Variant System

**What:** A single `Logo` React component accepts a `variant` prop and renders the appropriate inline SVG. Inline SVG allows `currentColor` to inherit text color, enabling the same component to work on dark (sidebar) and light (hub header) backgrounds without prop drilling of color values.

**When to use:** When the same logo appears in multiple color contexts across both portals. Avoids maintaining multiple logo files with hardcoded fill colors.

**Trade-offs:** SVG markup lives in JS bundle; fine for a logo (< 3KB). For large decorative SVGs, CSS `background-image` with data URI is better.

**Example:**
```tsx
/* components/brand/Logo.tsx */
type LogoVariant = 'full' | 'symbol' | 'white-full' | 'white-symbol'

interface LogoProps {
  variant?: LogoVariant
  className?: string
  size?: number
}

export function Logo({ variant = 'full', className, size = 32 }: LogoProps) {
  if (variant === 'symbol' || variant === 'white-symbol') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40"
           className={className}
           aria-label="Carreira USA" role="img">
        {/* symbol paths — fill="currentColor" */}
      </svg>
    )
  }
  // full wordmark variant
  return (
    <svg viewBox="0 0 160 40" className={className} aria-label="Carreira USA" role="img">
      {/* full logo paths */}
    </svg>
  )
}
```

### Pattern 5: Pattern/Texture as CSS Background Data URI

**What:** Background patterns (grain, dot grid, diagonal lines) are expressed as inline SVG data URIs in CSS custom properties, not as external image files. Applied via a `PatternBackground` wrapper component or utility class.

**When to use:** For decorative texture on hero sections, login pages, or the hub's cream background. Avoids extra HTTP requests; pattern SVGs are typically < 500 bytes.

**Trade-offs:** Data URIs can't be cached separately by the browser (they travel with the CSS). For patterns applied to full-page backgrounds, the performance delta is negligible.

**Example:**
```css
/* styles/tokens/brand.css */
:root {
  --pattern-grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
  --pattern-dots: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Ccircle cx='2' cy='2' r='1' fill='%23C9A84C' opacity='0.12'/%3E%3C/svg%3E");
}
```

```tsx
/* components/brand/PatternBackground.tsx */
export function PatternBackground({ pattern = 'grain', children, className }: PatternBackgroundProps) {
  const patternVar = `var(--pattern-${pattern})`
  return (
    <div
      className={cn('relative', className)}
      style={{ backgroundImage: patternVar, backgroundRepeat: 'repeat' }}
    >
      {children}
    </div>
  )
}
```

---

## Data Flow

### Token Resolution Flow

```
Brand Primitive Defined        Semantic Alias Resolves           Component Renders
in brand.css (:root)     →     to Portal Override via         →  with final computed
--brand-verde-500: #2D6A4F     data-portal="dashboard"           color value
                               --color-accent: var(--brand-verde-500)
                                                                   bg-accent → #2D6A4F
```

### Font Loading Flow

```
lib/fonts.ts              app/layout.tsx                Components
localFont({              <html className=             font-display → Blaak
  variable:               blaak.variable +  →         font-sans   → Neue Montreal
  '--font-blaak'          neueMontreal.variable        (via tailwind.config.ts)
})                       >
```

### Logo Rendering Flow

```
Dashboard Sidebar               Hub Header
<aside bg-secondary-dark>       <header bg-white>
  <Logo variant="symbol"          <Logo variant="full"
    className="text-white" />       className="text-[--brand-escuro]" />
  currentColor → white            currentColor → dark
```

---

## Integration Points

### New Components (create from scratch)

| Component | File | What It Does |
|-----------|------|--------------|
| Logo | `components/brand/Logo.tsx` | Multi-variant inline SVG logo |
| PatternBackground | `components/brand/PatternBackground.tsx` | CSS data URI pattern wrapper |

### Modified Components (targeted updates)

| Component | File | Change Required |
|-----------|------|----------------|
| Root Layout | `app/layout.tsx` | Replace Inter Google Fonts import with `lib/fonts.ts`; apply `.variable` classes |
| Dashboard Layout | `app/dashboard/layout.tsx` | Add `data-portal="dashboard"` attribute |
| Hub Layout | `app/hub/layout.tsx` | Add `data-portal="hub"` attribute |
| Button | `components/ui/button.tsx` | Swap `gold-*` token names for new brand token names (`verde-*` / `tangerina-*`) |
| Badge | `components/ui/badge.tsx` | Same token swap |
| StatCard | `components/ui/stat-card.tsx` | Same token swap; update icon background |
| Input | `components/ui/input.tsx` | Focus ring token swap |
| Card | `components/ui/card.tsx` | Hover border token swap |
| ProfessionalSidebar | `components/dashboard/professional-sidebar.tsx` | Swap `gold-*` → `verde-*`; update Logo placeholder with `<Logo>` component |
| globals.css | `app/globals.css` | Remove Google Fonts @import; `@import` token files instead of inline `:root` primitives |
| tailwind.config.ts | `tailwind.config.ts` | Add `verde`, `tangerina`, `creme`, `escuro` color tokens; update `fontFamily` to reference CSS vars |

### New Files (infrastructure)

| File | Purpose |
|------|---------|
| `lib/fonts.ts` | Central font definition (Blaak + Neue Montreal via `next/font/local`) |
| `public/fonts/` | Font binary files (.otf) |
| `public/assets/` | Logo SVG files for static `<img>` fallback contexts |
| `styles/tokens/brand.css` | Primitive brand color tokens |
| `styles/tokens/semantic.css` | Semantic role-based token aliases |
| `styles/tokens/portal-dashboard.css` | Dashboard accent/surface overrides |
| `styles/tokens/portal-hub.css` | Hub accent/surface overrides |

---

## Build Order (Dependency-Ordered)

Phase ordering matters because lower layers must exist before higher layers reference them.

```
Step 1: Fonts (no deps)
  → Add font files to public/fonts/
  → Create lib/fonts.ts
  → Modify app/layout.tsx to apply variable classNames

Step 2: Token Infrastructure (no deps beyond CSS)
  → Create styles/tokens/brand.css (primitives)
  → Create styles/tokens/semantic.css (aliases)
  → Create styles/tokens/portal-dashboard.css
  → Create styles/tokens/portal-hub.css
  → Modify app/globals.css to @import token files

Step 3: Tailwind Config Update (depends on Step 2 token names)
  → Update tailwind.config.ts: new color tokens + font families
  → Remove hardcoded hex values, legacy Google font names

Step 4: Portal Scope Attributes (depends on Step 2 portal css)
  → Add data-portal="dashboard" to dashboard layout wrapper
  → Add data-portal="hub" to hub layout wrapper

Step 5: Shared UI Component Update (depends on Steps 2-3)
  → Button: gold-* → new tokens
  → Badge: same
  → StatCard: same
  → Input: same
  → Card: same

Step 6: Brand Components (depends on Step 3 Tailwind config)
  → Create components/brand/Logo.tsx (inline SVG)
  → Create components/brand/PatternBackground.tsx

Step 7: Portal-Specific Shells (depends on Steps 4-6)
  → Update ProfessionalSidebar to use Logo component + verde tokens
  → Update Hub header/footer in layout.tsx to use Logo + tangerina tokens
  → Replace inline `const GOLD = "#C9A84C"` hardcodes in hub pages

Step 8: Recharts & Data Viz (depends on Step 2 — access to hex values)
  → Update chart color arrays to reference brand primitive hex values
  → (CSS variables don't work inside Recharts color props — use hex constants
     exported from lib/brand-colors.ts that mirror brand.css primitives)
```

---

## Anti-Patterns

### Anti-Pattern 1: Hardcoded Hex Values in Component Files

**What people do:** `const GOLD = "#C9A84C"` inline in page components (currently present in `app/hub/page.tsx`, `app/hub/layout.tsx`).

**Why it's wrong:** The value lives outside the token system. When the brand color changes, grep-and-replace is error-prone and misses dynamic strings. The pattern is already present in 3+ hub files.

**Do this instead:** Export a `brandColors` constant from `lib/brand-colors.ts` that mirrors the CSS primitives. For Recharts specifically, import hex values from this file — CSS vars don't work in JS prop strings.

```ts
/* lib/brand-colors.ts */
export const brandColors = {
  verde500: '#2D6A4F',
  tangerina500: '#F4631E',
  escuro: '#1A1A1A',
  creme: '#FBF8F0',
} as const
```

### Anti-Pattern 2: Portal-Specific Logic Inside Shared Components

**What people do:** `const color = isHub ? tangerina : verde` inside `Button.tsx`.

**Why it's wrong:** Couples shared primitives to portal context. Components should be context-agnostic and inherit color from the token scope they're rendered within.

**Do this instead:** Use the `data-portal` scoped CSS variable override pattern. The Button renders `bg-accent` everywhere; the portal's CSS scope resolves `--color-accent` to the right hue.

### Anti-Pattern 3: Multiple `localFont()` Calls for the Same Font

**What people do:** Import and call `localFont({ src: './Blaak.otf' })` in both `dashboard/layout.tsx` and `hub/layout.tsx`.

**Why it's wrong:** Next.js hosts a separate font instance per call — the same binary gets served twice as different hashed static files. Doubles the font payload.

**Do this instead:** Define once in `lib/fonts.ts`, export the instances, import in `app/layout.tsx` only.

### Anti-Pattern 4: Storing Font Files Inside `app/`

**What people do:** Place `.otf` files in `app/fonts/` because the Next.js docs show relative paths.

**Why it's wrong:** Files inside `app/` are not served as static assets — they're part of the server bundle context. Only `public/` files are served directly via URL.

**Do this instead:** Store font files in `public/fonts/`. The `localFont` `src` path in `lib/fonts.ts` uses `../public/fonts/` (relative to the file) or an absolute path from project root.

### Anti-Pattern 5: Using `next/image` for SVG Logos

**What people do:** `<Image src="/assets/logo.svg" width={160} height={40} alt="Logo" />`.

**Why it's wrong:** `next/image` optimization pipeline doesn't benefit SVGs (they're already vector and don't need format conversion). More importantly, it prevents `currentColor` theming since SVG fills are baked in as attributes rather than inheriting from CSS.

**Do this instead:** Inline SVG React component for logos that need color variants. `<img src="/assets/logo.svg" />` is acceptable for email templates or static contexts where JS theming isn't needed.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (2 portals, 1 brand) | Token files as described — no additional tooling needed |
| Future (white-label or new brand) | Add `styles/tokens/portal-[name].css` + new `data-portal` value; zero component changes |
| Design tool sync (Figma tokens) | Add Style Dictionary pipeline to generate `brand.css` from `tokens.json`; structure already compatible |

---

## Sources

- [Next.js Font Optimization (v14)](https://nextjs.org/docs/14/app/building-your-application/optimizing/fonts) — HIGH confidence, official docs
- [Next.js Font Optimization (current)](https://nextjs.org/docs/app/getting-started/fonts) — HIGH confidence, official docs (v16.2.1, same API)
- [Tailwind CSS Theme Variables](https://tailwindcss.com/docs/theme) — HIGH confidence, official docs
- [CSS Custom Properties Strategy Guide — Smashing Magazine](https://www.smashingmagazine.com/2018/05/css-custom-properties-strategy-guide/) — MEDIUM confidence, authoritative reference
- [Tailwind Design Tokens: Complete Guide 2025](https://nicolalazzari.ai/articles/integrating-design-tokens-with-tailwind-css) — MEDIUM confidence (single source, verified pattern against official docs)
- [Using SVG in Next.js/React — SVG Verse](https://svgverseai.com/blog/using-svg-in-nextjs-react-inline-img-components) — MEDIUM confidence, consistent with broader community consensus
- [Multiple Themes with Next.js, Tailwind CSS, and CSS Custom Properties](https://dev.to/dlw/multiple-themes-for-next-js-with-next-themes-tailwind-css-and-css-custom-properties-2knp) — MEDIUM confidence, consistent with MDN and official docs on CSS variable scoping

---

*Architecture research for: Brand identity reskin — Carreira USA, dual-portal Next.js 14 App Router*
*Researched: 2026-03-25*
