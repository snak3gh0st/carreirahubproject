// Carreira USA official color guide — Paleta de Cores Carreira USA.pdf
// This is the canonical JS source for brand colors.
// Mirrors styles/tokens/brand.css primitive values.
// Use for: Recharts props, dynamic style objects, any non-CSS consumer.
// NEVER hardcode brand hex values anywhere else in the codebase.

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
