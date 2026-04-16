import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      /* ========================================
         DESIGN SYSTEM COLORS
         ======================================== */
      colors: {
        // Primary Blue - Finance Brand
        primary: {
          50: 'var(--primary-50)',
          100: 'var(--primary-100)',
          200: 'var(--primary-200)',
          300: 'var(--primary-300)',
          400: 'var(--primary-400)',
          500: 'var(--primary-500)',  // Main brand
          600: 'var(--primary-600)',
          700: 'var(--primary-700)',
          800: 'var(--primary-800)',
          900: 'var(--primary-900)',
          DEFAULT: 'var(--primary-500)',
          foreground: "hsl(var(--primary-foreground))",  // Legacy
        },
        
        // Success Green
        success: {
          50: 'var(--success-50)',
          100: 'var(--success-100)',
          500: 'var(--success-500)',
          600: 'var(--success-600)',
          700: 'var(--success-700)',
          DEFAULT: 'var(--success-600)',
        },
        
        // Warning Amber
        warning: {
          50: 'var(--warning-50)',
          100: 'var(--warning-100)',
          500: 'var(--warning-500)',
          600: 'var(--warning-600)',
          700: 'var(--warning-700)',
          DEFAULT: 'var(--warning-600)',
        },
        
        // Error Red
        error: {
          50: 'var(--error-50)',
          100: 'var(--error-100)',
          500: 'var(--error-500)',
          600: 'var(--error-600)',
          700: 'var(--error-700)',
          DEFAULT: 'var(--error-600)',
        },
        
        // Info Blue
        info: {
          50: 'var(--info-50)',
          100: 'var(--info-100)',
          500: 'var(--info-500)',
          600: 'var(--info-600)',
          DEFAULT: 'var(--info-600)',
        },
        
        // Sigma Intel Brand Color
        'sigma-blue': '#29ABE2',
        
        // Gold Theme Aliases (NEW - Carreira USA Gold Theme)
        gold: {
          50: '#FFFBEB',    // Lightest cream
          100: '#FEF3C7',   // Light gold cream
          200: '#FDE68A',   // Soft gold
          300: '#FCD34D',   // Medium gold
          400: '#FBBF24',   // Vibrant gold
          500: '#D4AF37',   // Classic gold - Main brand
          600: '#B8941F',   // Deep gold
          700: '#9C7A19',   // Rich gold
          800: '#806114',   // Dark gold
          900: '#64470F',   // Darkest gold
        },
        
        // Secondary Dark Colors (NEW - For sidebar & dark sections)
        'secondary-dark': '#1A1A1A',   // Rich black
        'secondary-gray': '#2D2D2D',   // Dark gray

        // Carreira USA v1.1 Brand Palette (references styles/tokens/brand.css)
        'brand-creme':     'var(--brand-creme)',
        'brand-verde':     'var(--brand-verde)',
        'brand-tangerina': 'var(--brand-tangerina)',
        'brand-cafe':      'var(--brand-cafe)',
        'brand-caramelo':  'var(--brand-caramelo)',

        // Neutral Grays
        gray: {
          50: 'var(--gray-50)',
          100: 'var(--gray-100)',
          200: 'var(--gray-200)',
          300: 'var(--gray-300)',
          400: 'var(--gray-400)',
          500: 'var(--gray-500)',
          600: 'var(--gray-600)',
          700: 'var(--gray-700)',
          800: 'var(--gray-800)',
          900: 'var(--gray-900)',
        },
        
        // Legacy shadcn/ui colors (preserved for backward compatibility)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      
      /* ========================================
         TYPOGRAPHY
         ======================================== */
      fontFamily: {
        sans: ['var(--font-neue-montreal)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['var(--font-blaak)', 'Georgia', 'Times New Roman', 'serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      
      fontSize: {
        'display': ['var(--text-display)', { lineHeight: 'var(--text-display-lh)' }],
        'h1': ['var(--text-h1)', { lineHeight: 'var(--text-h1-lh)' }],
        'h2': ['var(--text-h2)', { lineHeight: 'var(--text-h2-lh)' }],
        'h3': ['var(--text-h3)', { lineHeight: 'var(--text-h3-lh)' }],
        'h4': ['var(--text-h4)', { lineHeight: 'var(--text-h4-lh)' }],
        'h5': ['var(--text-h5)', { lineHeight: 'var(--text-h5-lh)' }],
        'h6': ['var(--text-h6)', { lineHeight: 'var(--text-h6-lh)' }],
      },
      
      /* ========================================
         SPACING (4px base unit)
         ======================================== */
      spacing: {
        '0': 'var(--space-0)',
        '1': 'var(--space-1)',
        '2': 'var(--space-2)',
        '3': 'var(--space-3)',
        '4': 'var(--space-4)',
        '5': 'var(--space-5)',
        '6': 'var(--space-6)',
        '8': 'var(--space-8)',
        '10': 'var(--space-10)',
        '12': 'var(--space-12)',
        '16': 'var(--space-16)',
        '20': 'var(--space-20)',
      },
      
      /* ========================================
         BORDER RADIUS
         ======================================== */
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      
      /* ========================================
         TRANSITIONS & ANIMATIONS
         ======================================== */
      transitionDuration: {
        'fast': 'var(--transition-fast)',
        'base': 'var(--transition-base)',
        'slow': 'var(--transition-slow)',
      },
      
      transitionTimingFunction: {
        'default': 'var(--easing-default)',
      },
      
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-bar": {
          "0%, 100%": { transform: "scaleY(0.5)", opacity: "0.4" },
          "50%": { transform: "scaleY(1.4)", opacity: "1" },
        },
      },
      
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-bar": "pulse-bar 1s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config

export default config

