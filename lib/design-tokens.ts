/**
 * Design System Tokens for Carreira AI Hub
 * 
 * Centralized design tokens for use in TypeScript/JavaScript.
 * Use these when you need to reference design values programmatically
 * (e.g., chart colors, dynamic styles, theme configuration).
 * 
 * For CSS styling, prefer Tailwind utility classes over these tokens.
 * 
 * @see DESIGN-SPEC.md for complete design system documentation
 */

/* ========================================
   COLOR PALETTE
   ======================================== */

export const colors = {
  // Primary Blue - Trust, Finance, Professional
  primary: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#0F52BA',  // Main brand color
    600: '#0C42A0',
    700: '#093686',
    800: '#072A6C',
    900: '#051E52',
  },
  
  // Success Green - Payments, Growth, Positive
  success: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    500: '#059669',
    600: '#047857',
    700: '#065F46',
  },
  
  // Warning Amber - Alerts, Pending, Attention
  warning: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
  },
  
  // Error Red - Overdue, Critical, Errors
  error: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    500: '#DC2626',
    600: '#B91C1C',
    700: '#991B1B',
  },
  
  // Info Blue - Neutral information
  info: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    500: '#3B82F6',
    600: '#2563EB',
  },
  
  // Neutral Grays - Optimized for readability
  gray: {
    50: '#F9FAFB',   // Page background
    100: '#F3F4F6',  // Card background
    200: '#E5E7EB',  // Border subtle
    300: '#D1D5DB',  // Border default
    400: '#9CA3AF',  // Disabled text
    500: '#6B7280',  // Muted text
    600: '#4B5563',  // Secondary text
    700: '#374151',  // Primary text
    800: '#1F2937',  // Headings
    900: '#111827',  // Emphasis
  },
} as const;

/* ========================================
   TYPOGRAPHY
   ======================================== */

export const typography = {
  fontFamily: {
    sans: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'Courier New', monospace",
  },
  
  fontSize: {
    display: '3rem',      // 48px
    h1: '2.25rem',        // 36px
    h2: '1.875rem',       // 30px
    h3: '1.5rem',         // 24px
    h4: '1.25rem',        // 20px
    h5: '1.125rem',       // 18px
    h6: '1rem',           // 16px
    lg: '1.125rem',       // 18px
    base: '1rem',         // 16px
    sm: '0.875rem',       // 14px
    xs: '0.75rem',        // 12px
  },
  
  lineHeight: {
    display: 1.2,
    h1: 1.25,
    h2: 1.3,
    h3: 1.4,
    h4: 1.4,
    h5: 1.5,
    h6: 1.5,
    lg: 1.75,
    base: 1.5,
    sm: 1.5,
    xs: 1.5,
  },
  
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

/* ========================================
   SPACING (4px base unit)
   ======================================== */

export const spacing = {
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
} as const;

/* ========================================
   ANIMATION & TRANSITIONS
   ======================================== */

export const animation = {
  duration: {
    fast: '150ms',
    base: '200ms',
    slow: '300ms',
  },
  
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',  // ease-out
  },
} as const;

/* ========================================
   SEMANTIC COLOR USAGE
   ======================================== */

/**
 * Semantic color mappings for common UI patterns.
 * Use these for consistent color application across the app.
 */
export const semanticColors = {
  // Invoice/Payment Status
  status: {
    paid: colors.success[600],
    pending: colors.warning[600],
    overdue: colors.error[600],
    draft: colors.gray[600],
    sent: colors.info[600],
    voided: colors.gray[400],
  },
  
  // Badge backgrounds (light)
  badge: {
    paid: colors.success[100],
    pending: colors.warning[100],
    overdue: colors.error[100],
    draft: colors.gray[100],
    sent: colors.info[100],
  },
  
  // Chart colors (for Recharts)
  chart: {
    primary: colors.primary[600],
    success: colors.success[600],
    warning: colors.warning[600],
    error: colors.error[600],
    info: colors.info[600],
    gray: colors.gray[600],
  },
} as const;

/* ========================================
   BREAKPOINTS (matches Tailwind defaults)
   ======================================== */

export const breakpoints = {
  sm: '640px',    // Mobile large
  md: '768px',    // Tablet
  lg: '1024px',   // Desktop
  xl: '1280px',   // Large desktop
  '2xl': '1536px', // Extra large
} as const;

/* ========================================
   HELPER FUNCTIONS
   ======================================== */

/**
 * Get color value by path (e.g., 'primary.600', 'success.100')
 */
export function getColor(path: string): string {
  const [category, shade] = path.split('.');
  if (!category || !shade) {
    throw new Error(`Invalid color path: ${path}. Use format 'category.shade' (e.g., 'primary.600')`);
  }
  
  const colorCategory = colors[category as keyof typeof colors];
  if (!colorCategory) {
    throw new Error(`Unknown color category: ${category}`);
  }
  
  const colorValue = (colorCategory as any)[shade];
  if (!colorValue) {
    throw new Error(`Unknown shade ${shade} in category ${category}`);
  }
  
  return colorValue;
}

/**
 * Get all shades of a color category as array (useful for charts)
 */
export function getColorScale(category: keyof typeof colors): string[] {
  const colorCategory = colors[category];
  return Object.values(colorCategory);
}

/* ========================================
   TYPE EXPORTS
   ======================================== */

export type ColorCategory = keyof typeof colors;
export type ColorShade = keyof typeof colors.primary;
export type SemanticColor = keyof typeof semanticColors.status;
export type ChartColor = keyof typeof semanticColors.chart;
