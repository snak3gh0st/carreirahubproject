# Pitfalls Research

**Domain:** Brand reskin of production Next.js 14 App Router application (two-portal SaaS)
**Researched:** 2026-03-25
**Confidence:** HIGH

---

## Critical Pitfalls

### Pitfall 1: The GOLD Constant Anti-Pattern (14+ Duplicated Inline Values)

**What goes wrong:**
The hub portal has `const GOLD = "#C9A84C"` defined individually in 14+ separate files (`layout.tsx`, `page.tsx`, `settings/page.tsx`, `LanguageToggle.tsx`, `forms/[id]/page.tsx`, etc.). When the brand color changes to Tangerina `#FF8142`, every one of those files must be updated independently. Miss one and the hub portal displays a different gold in that component — a visual inconsistency that is invisible during development but obvious to end users.

**Why it happens:**
The color was added file-by-file without a central token export. Since inline `style={{ color: GOLD }}` is used instead of Tailwind classes, the color cannot be updated via Tailwind config alone — it bypasses the CSS variable layer entirely.

**How to avoid:**
Before touching a single component, create `lib/constants/brand.ts` that exports all brand hex values as typed constants:
```typescript
export const BRAND = {
  creme: "#FFF8E8",
  verde: "#2F443F",
  tangerina: "#FF8142",
  cafeComLeite: "#E1C19B",
  caramelo: "#BD925F",
} as const;
```
Then do a single global find-replace of `"#C9A84C"` with `BRAND.tangerina` (or whatever the replacement color is). Do this as the very first commit of the reskin — before any visual changes.

**Warning signs:**
- `grep -rn "const GOLD" app/hub` returns more than 1 result
- `grep -rn '"#C9A84C"' app` returns any results
- Inline `style={{ color: ... }}` with a hex literal anywhere in hub portal pages

**Phase to address:**
Phase 1 (Token Foundation) — this must be the zeroth step, before any visual work begins.

---

### Pitfall 2: Recharts Charts Not Updated (Charts Have Their Own Color System)

**What goes wrong:**
Recharts ignores Tailwind CSS entirely. All chart colors are passed as JSX props (`fill="#3b82f6"`, `stroke="#2563eb"`) or defined in JavaScript constant arrays (`const COLORS = ["#3b82f6", ...]`). The current codebase has this in at least 7 locations:
- `components/dashboard/conversion-funnel.tsx` — `fill="#2563eb"`
- `components/dashboard/revenue-chart.tsx` — `stroke="#2563eb"`
- `components/dashboard/charts/revenue-trend-chart.tsx` — `stroke="#3b82f6"`
- `components/dashboard/charts/top-customers-chart.tsx` — `fill="#10b981"`
- `components/dashboard/charts/invoice-status-chart.tsx` — hardcoded `fill="#8884d8"`
- `components/analytics/top-customers-chart.tsx` — `fill="#0F52BA"`
- `app/dashboard/analytics/page.tsx` — `COLORS` array with 6 hardcoded values

After the reskin, every page looks branded except the charts, which still show old blue bars on the dashboard. This is visually jarring and commonly missed because chart components are not in the same files as the pages being reskinned.

**Why it happens:**
Recharts renders SVG elements. SVG properties (`fill`, `stroke`) are not CSS classes — they are attribute values passed directly as strings. No Tailwind purge, no CSS variable resolution, no design token system affects them.

**How to avoid:**
1. Create a `lib/constants/chart-colors.ts` that maps semantic names to brand hex values.
2. Replace all hardcoded chart color strings with imports from that file.
3. Verify by running `grep -rn 'fill="#\|stroke="#' components/dashboard app/dashboard` after migration — expect zero results.

Recharts does support CSS variables in `fill` values (e.g., `fill="var(--color-revenue)"`), but only when those variables are defined on a parent SVG element or in global CSS, which adds complexity. The simpler and more reliable approach for this codebase is named JS constants.

**Warning signs:**
- Dashboard loads but charts still show blue/purple bars after reskin
- `grep -rn 'fill="#\|stroke="#' components app --include="*.tsx"` returns results

**Phase to address:**
Phase 2 (Component Update) — must be explicitly itemized, not assumed covered by Tailwind class replacement.

---

### Pitfall 3: Tangerina (#FF8142) Fails WCAG AA for Normal Text on White

**What goes wrong:**
`#FF8142` (Tangerina) on a white `#FFFFFF` background has a contrast ratio of approximately 2.9:1 — well below the WCAG AA requirement of 4.5:1 for normal text. If Tangerina is used as link text, button label text, or any body-sized text on a light background, the reskin will break accessibility compliance that the app currently maintains.

The existing gold `#D4AF37` (primary-500) has a similar problem: it is used as link text and icon color on white, and its contrast ratio is approximately 2.6:1 on white — also a WCAG AA failure. The app appears to have compensated by using darker shades (`gold-600` = `#B8941F`, contrast ~3.7:1 on white, which still fails for normal text) and keeping it only on dark sidebar backgrounds where it passes.

The new palette introduces additional risks: Verde `#2F443F` on white is approximately 7.5:1 — passes. Cafe com Leite `#E1C19B` on white is approximately 1.7:1 — fails badly. Caramelo `#BD925F` on white is approximately 2.8:1 — fails for text.

**Why it happens:**
Designers approve palettes visually, not by measuring contrast ratios. Warm colors (orange, tan, caramel) have inherent lightness that looks vivid to the eye but fails mathematical contrast thresholds. The mistake is using the brand colors directly as text colors without checking ratio.

**How to avoid:**
Before writing any CSS, run each new color combination through [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/). The safe rule for this palette:
- **Text on light backgrounds**: Verde `#2F443F` is the safe choice (7.5:1). Tangerina and Caramelo must never be normal-size text on white or Creme.
- **Text on dark backgrounds**: Creme `#FFF8E8` on Verde `#2F443F` — check this passes.
- **Interactive elements (links, CTAs)**: If using Tangerina, it must be on a dark background, be large text (18pt+), or be accompanied by an underline + non-color indicator.
- **Cafe com Leite and Caramelo**: Decorative and background use only — never as text color.

**Warning signs:**
- Any `text-tangerina` or `color: #FF8142` on a white or cream background
- axe DevTools "color contrast" violations after implementation
- Lighthouse accessibility score drop post-reskin

**Phase to address:**
Phase 1 (Token Foundation) — define which colors are safe for text use before any component code is written.

---

### Pitfall 4: Google Fonts CSS @import Causes FOUT and Blocks Rendering

**What goes wrong:**
`app/globals.css` currently uses:
```css
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700...');
```
This is a render-blocking external network request. The browser must fetch CSS from Google's servers before it can paint text. This causes FOUT (Flash of Unstyled Text) where users briefly see Inter (the fallback from `layout.tsx`) before Space Grotesk loads. When a custom `.otf` font is added for the reskin, a `@font-face` declaration in CSS makes this worse — no preload hint, no size-adjust fallback, visible layout shift on first paint.

**Why it happens:**
The root `layout.tsx` uses `next/font/google` for Inter correctly, but the `globals.css` `@import` bypasses Next.js's font optimization system entirely for Space Grotesk. The two approaches conflict: `layout.tsx` body has `className={inter.className}` (optimized), but Space Grotesk is loaded externally (not optimized). Adding an `.otf` file via raw `@font-face` in CSS repeats this mistake.

**How to avoid:**
Migrate all fonts to `next/font` in `layout.tsx` or in individual layouts where they are needed:
```typescript
import { Inter, Space_Grotesk } from "next/font/google";
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });

// For custom .otf:
import localFont from "next/font/local";
const brandFont = localFont({
  src: [
    { path: "../public/fonts/BrandFont-Regular.otf", weight: "400" },
    { path: "../public/fonts/BrandFont-Bold.otf", weight: "700" },
  ],
  variable: "--font-brand",
  display: "swap",
});
```
Remove the `@import` from `globals.css` entirely. Place font files in `/public/fonts/` (not in `/app/` or `/lib/`). Apply `className` on the `<html>` or `<body>` element with all font variables.

**Warning signs:**
- `@import url('https://fonts.google')` still present in `globals.css` after migration
- Font files in `/app/fonts/` directory (wrong location for `next/font/local` path references)
- Lighthouse "Eliminate render-blocking resources" flag citing fonts.googleapis.com
- CLS (Cumulative Layout Shift) score above 0.1

**Phase to address:**
Phase 1 (Token Foundation) — font loading must be resolved before any visual verification, otherwise shift artifacts make component review unreliable.

---

### Pitfall 5: Hardcoded Tailwind Color Classes Not Found by Text Search Alone

**What goes wrong:**
The codebase has 246 hardcoded `blue-*` / `indigo-*` Tailwind color class references in `app/` and 71 in `components/`. A naive find-and-replace of `blue-500` → `primary-500` can cause three categories of missed replacements:

1. **Conditional class construction**: Classes like `` `text-${color}-500` `` are invisible to Tailwind's scanner and will generate no CSS in production. If the replacement creates any dynamic class construction, those classes will be purged.
2. **Third-party component props**: Some components (e.g., Radix UI, Sonner toasts) accept color strings that are not Tailwind classes at all — replacing those values breaks the component.
3. **Over-replacement**: `blue-500` appears in semantic contexts (info badges, `--info-500` variable) that should remain blue. Replacing all blue systematically removes intentional usage.

**Why it happens:**
Text editors and CLI tools do regex replacement without semantic understanding. A developer runs `sed -i 's/blue-500/primary-500/g'` globally, unknowingly replacing both brand blues (should change) and semantic status blues (should stay).

**How to avoid:**
1. Before any replacement, run an audit: `grep -rn "blue-\|indigo-" app components --include="*.tsx" > /tmp/color-audit.txt` and categorize each usage as brand-color (change) or semantic-color (keep).
2. Replace file-by-file with review, not globally.
3. After replacement, run `npm run build` and verify the CSS bundle — missing classes show up as unstyled elements.
4. The `safelist` in `tailwind.config.ts` can be used temporarily to force-include classes during migration, but must be removed afterward.
5. Never construct Tailwind class names dynamically during the reskin (e.g., no `` `bg-${brandColor}-500` ``).

**Warning signs:**
- Elements visually styled in dev server but unstyled in production build
- `grep -rn '\${.*}-[0-9]' app components --include="*.tsx"` returns results
- Build output CSS file smaller than pre-reskin baseline

**Phase to address:**
Phase 2 (Component Update) — requires systematic file-by-file audit, not a single bulk replace.

---

### Pitfall 6: Two Portals Can Diverge Silently During Reskin

**What goes wrong:**
The Admin Dashboard uses `gold-*` Tailwind classes (from an already-completed Gold Theme migration). The Client Hub uses inline `style={{ color: GOLD }}` with `"#C9A84C"`. They share `globals.css` and `tailwind.config.ts`, but the hub portal largely bypasses the design token system. A reskin that updates only the Tailwind config and CSS variables will visually update the dashboard but leave the hub portal's inline styles unchanged — the two portals look completely different.

Additionally, the hub portal's background is set via inline style (`style={{ backgroundColor: "#FBF8F0" }}`), which is also not covered by CSS variable updates.

**Why it happens:**
The hub portal was built after the dashboard and used inline styles for speed during rapid feature development. The shared design token system was not retrofitted.

**How to avoid:**
Treat the two portals as separate reskin tasks with an explicit checklist for each. The hub portal requires:
1. Replace all inline `style={{ color: GOLD }}` with CSS class or CSS variable equivalent.
2. Replace `style={{ backgroundColor: "#FBF8F0" }}` with a Tailwind class.
3. Add hub-portal-specific visual verification to the QA checklist (separate from dashboard checklist).
4. Audit the hub portal's `globals.css` coverage — confirm `<html>` element applies the correct font variables.

**Warning signs:**
- Dashboard looks correct but hub portal shows old gold color after reskin
- `grep -rn 'style={{' app/hub --include="*.tsx"` returns many results after claiming reskin is complete
- Hub portal background color differs from design spec

**Phase to address:**
Phase 2 (Component Update) — hub portal inline styles need explicit migration, not just config changes.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Bulk sed-replace `blue-*` to `primary-*` globally | Fast, one command | Breaks semantic status blues (info badges), may break third-party component props | Never — always audit first |
| Keeping `@import url(fonts.googleapis.com)` in globals.css | Zero migration effort | FOUT on every page, Google dependency, render-blocking | Never for production |
| Defining brand constants per-file instead of in a shared module | Copy-paste speed during feature development | 14+ files to update per brand change | MVP only, must be refactored before any reskin |
| Using inline `style={{}}` instead of Tailwind classes for brand colors | Avoids Tailwind config setup | Bypasses all design tokens, makes theming impossible | Never for primary brand colors |
| Skipping chart color update (charts "look fine-ish") | Saves ~2 hours | Visual inconsistency visible on every dashboard page | Never for a brand launch |
| Not running contrast check until QA | Saves setup time | Accessibility failures discovered late, require component rework | Never — check before writing any code |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Recharts | Assuming Tailwind class changes affect chart colors | Update `fill`, `stroke`, `color` props directly — they are SVG attributes, not CSS classes |
| Recharts | Using CSS variables in `fill="var(--color)"` without defining them on a parent SVG context | Either use JS constants from `lib/constants/chart-colors.ts` or define CSS vars on the `<ResponsiveContainer>` wrapper |
| `next/font` + `.otf` | Placing font file in `app/fonts/` and using path `"./fonts/BrandFont.otf"` | Font files for `next/font/local` must be in `public/fonts/` (or relative to the importing file) — use absolute path from project root |
| `next/font` + Google | Keeping `@import url(fonts.googleapis.com)` in globals.css alongside `next/font/google` usage | Remove `@import` entirely — the two mechanisms conflict and the CSS import wins, defeating optimization |
| Sonner toasts | Updating brand colors globally but toasts still show old blue | Sonner uses its own `richColors` theme — customize via CSS overrides targeting `.sonner-toast` or pass `toastOptions` to `<Toaster>` |
| Favicon/apple-icon | Updating `app/favicon.ico` but `metadata.icons` in layout overrides it | Remove duplicate — either use file-based convention OR `metadata.icons`, not both |
| Favicon caching | Browser continues showing old favicon after reskin | Favicons are aggressively cached; test in incognito + force-rebuild with `.next` deletion |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| CSS `@import` for Google Fonts in globals.css | FOUT on every page, Lighthouse "render-blocking resources" warning, CLS > 0.1 | Migrate to `next/font/google` with `variable` option, remove `@import` | Every page load, especially on slow connections |
| Multiple `@font-face` declarations for the same font family | Duplicate font downloads, larger CSS bundle, potential FOUC in Safari | Use a single `localFont()` call with `src` array for weight variants | At build — bundle size increases; at runtime — Safari loads fonts in unexpected order |
| Loading OTF font without `display: 'swap'` | FOIT: text invisible until font loads (up to 3s in Chrome, indefinitely in Firefox) | Always include `display: 'swap'` in `next/font/local` config | On slow 3G connections; on first visit before font is cached |
| Tailwind CSS bundle grows significantly after reskin | Longer build times, slightly larger initial CSS | Use `@layer` properly, avoid duplicating utility definitions in `globals.css`, run `npm run build` to check bundle size | Not a user-facing issue at this app's scale, but worth monitoring |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Adding font files to git without checking license | Legal exposure if brand fonts are proprietary/licensed-per-seat | Verify font license allows web embedding before committing; use `.gitignore` for licensed fonts if needed |
| Exposing brand font files in `/public/fonts/` without considering download | Proprietary fonts are downloadable by anyone at `yourdomain.com/fonts/BrandFont.otf` | Accept this trade-off or use WOFF2 subsetting to limit utility; `next/font` self-hosting has the same exposure |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Tangerina (#FF8142) as normal body text on white | Low-vision users cannot read it; fails WCAG AA 4.5:1 | Use Tangerina only on dark backgrounds (Verde, dark sidebar) or as a decorative accent; use Verde for interactive text elements |
| Cafe com Leite (#E1C19B) as text on white background | Extremely low contrast (~1.7:1); unreadable for any user on bright screens | Use only as background fill; never as text or icon color |
| Replacing focus ring from gold to brand accent without checking contrast | Keyboard users lose visible focus indication | Ensure focus ring color has 3:1 contrast against both the element background and the adjacent background (WCAG 2.1 SC 1.4.11) |
| Reskinning charts without updating tooltip colors | Tooltip background may clash with new palette, making data labels illegible | Update `<Tooltip contentStyle>` and `<Legend>` along with bar/line colors |
| Hub portal and dashboard looking visually inconsistent post-reskin | Customers switching between portals notice brand inconsistency | Treat both portals as a single reskin deliverable with joint sign-off |

---

## "Looks Done But Isn't" Checklist

- [ ] **Brand constants:** `grep -rn '"#C9A84C"\|const GOLD' app components` returns zero results — verify all inline hex values have been replaced with imported constants or CSS classes.
- [ ] **Recharts colors:** `grep -rn 'fill="#\|stroke="#' components/dashboard app/dashboard --include="*.tsx"` returns zero results — chart SVG attributes use brand constants, not hex literals.
- [ ] **Font loading:** `globals.css` contains no `@import url('https://fonts.googleapis.com')` — Google Fonts are loaded exclusively via `next/font/google` in `layout.tsx`.
- [ ] **Hub portal inline styles:** `grep -rn 'style={{.*backgroundColor\|style={{.*color' app/hub --include="*.tsx"` is reviewed — all brand-color inline styles converted to CSS classes or CSS variables.
- [ ] **Contrast ratios verified:** WebAIM Contrast Checker confirms every text/background color pair used in production passes 4.5:1 (normal text) or 3:1 (large text / UI components).
- [ ] **Favicon updated and verified:** New favicon visible in incognito mode (bypasses cache); `app/favicon.ico` exists and there is no conflicting `metadata.icons` in layout.
- [ ] **OG image updated:** `app/opengraph-image.{jpg,png}` or `generateMetadata` updated to use new brand colors — old screenshots shared on social media will eventually expire from cache.
- [ ] **Both portals verified independently:** Hub portal checked at `clientscarreira.sigmaintel.io` and admin dashboard checked at `carreirausa.sigmaintel.io` — not just localhost.
- [ ] **Production build tested:** `npm run build && npm start` succeeded locally; no TypeScript errors introduced by new font type signatures or brand constant imports.
- [ ] **Accessibility score baseline captured:** Lighthouse accessibility score recorded pre-reskin and compared post-reskin — must not decrease.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Missed inline hex colors in hub portal | LOW | `grep -rn '"#[0-9a-fA-F]"' app/hub` finds them; update 14 files with `BRAND` imports |
| Charts not updated (blue bars remain) | LOW | Find all chart components with `grep -rn 'fill="#\|stroke="#'`; update color props; no rebuild side effects |
| WCAG contrast failure discovered post-launch | MEDIUM | Identify failing pairs with axe DevTools; darken text colors or swap background — typically 1-2 component changes; re-audit |
| Font FOUT causing layout shift | MEDIUM | Remove `@import` from globals.css; add `next/font/google` in layout.tsx; clear `.next` and rebuild; one Vercel deployment |
| Wrong favicon cached in browsers | LOW | Cache clears within 24h; accelerate with cache-busting query string on favicon URL via metadata API |
| Tangerina used as text color failing contrast | LOW–MEDIUM | Swap `text-tangerina` → `text-verde` or darken the tangerina usage; 1 commit per affected file |
| Both portals diverged visually after reskin | MEDIUM | Complete the hub portal inline style migration (missed Phase 2 task); ~4–6 hours of targeted work |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| GOLD constant per-file duplication | Phase 1: Token Foundation | `grep -rn '"#C9A84C"\|const GOLD' app` returns 0 results |
| Recharts chart colors not updated | Phase 2: Component Update | `grep -rn 'fill="#\|stroke="#' components/dashboard app` returns 0 results |
| Tangerina fails WCAG AA on light backgrounds | Phase 1: Token Foundation | WebAIM contrast check run on all palette pairs before any component code |
| Google Fonts CSS import causes FOUT | Phase 1: Token Foundation | `globals.css` has no `@import url(fonts.google)`; Lighthouse CLS < 0.1 |
| Tailwind bulk-replace misses semantic blues | Phase 2: Component Update | File-by-file audit completed; `npm run build` passes; no purged classes |
| Hub portal inline styles not updated | Phase 2: Component Update | Both portals match design spec; `grep -rn 'style={{' app/hub` reviewed |
| Favicon/OG image not updated | Phase 3: Polish & QA | Favicon visible in incognito; OG image verified via social card debugger |
| Accessibility regression not caught | Phase 3: Polish & QA | Lighthouse a11y score equal or higher than pre-reskin baseline; axe DevTools zero critical violations |

---

## Sources

- [Next.js Font Optimization — Official Docs](https://nextjs.org/docs/app/getting-started/fonts)
- [next/font/local — Official API Reference](https://nextjs.org/docs/pages/api-reference/components/font)
- [Vercel: Custom fonts without compromise using next/font](https://vercel.com/blog/nextjs-next-font)
- [WebAIM: Contrast and Color Accessibility](https://webaim.org/articles/contrast/)
- [Orange You Accessible? — Case study on orange color contrast failures](https://www.bounteous.com/insights/2019/03/22/orange-you-accessible-mini-case-study-color-ratio/)
- [Tailwind CSS: Dynamic class name pitfalls](https://daisyui.com/blog/most-common-mistake-when-using-tailwind-css/)
- [Recharts Customize Guide](https://recharts.github.io/en-US/guide/customize/)
- [Next.js Favicon — App Router conventions](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons)
- [Next.js Metadata and OG Images](https://nextjs.org/docs/app/getting-started/metadata-and-og-images)
- [Google Fonts CSS @import issue — Next.js GitHub Discussion #30567](https://github.com/vercel/next.js/issues/30567)
- [Codebase analysis: GOLD constant pattern in app/hub (14 files), chart hex colors in components/dashboard, 246 hardcoded blue Tailwind classes in app/]

---
*Pitfalls research for: Brand reskin — Carreira USA visual identity applied to Next.js 14 two-portal app*
*Researched: 2026-03-25*
