"use client"

/**
 * Skip to Main Content Link
 *
 * Appears only when focused via keyboard
 * Allows keyboard users to skip navigation and go directly to main content
 *
 * WCAG 2.1 Success Criterion 2.4.1 Bypass Blocks (Level A)
 */
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:p-4 focus:bg-blue-600 focus:text-white focus:rounded focus:font-medium"
    >
      Skip to main content
    </a>
  )
}
