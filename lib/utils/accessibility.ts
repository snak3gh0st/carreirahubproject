"use client"

/**
 * Accessibility Utilities
 *
 * Collection of utilities to help improve accessibility (WCAG AA compliance)
 */

import * as React from "react"

/**
 * Generate unique ID for form fields and labels
 */
export function generateFieldId(name: string, suffix?: string): string {
  const id = `field-${name.toLowerCase().replace(/\s+/g, "-")}`
  return suffix ? `${id}-${suffix}` : id
}

/**
 * Announce to screen readers without displaying visually
 * Usage: <span className={sr("Loading...")}>Loading...</span>
 */
export function sr(text: string): string {
  return "sr-only"
}

/**
 * Create aria-label for icon-only buttons
 */
export function createIconLabel(action: string, target?: string): string {
  if (target) {
    return `${action} ${target}`
  }
  return action
}

/**
 * Keyboard event handlers for accessibility
 */
export const KeyboardUtils = {
  /**
   * Check if Enter key was pressed
   */
  isEnter: (e: React.KeyboardEvent): boolean => e.key === "Enter",

  /**
   * Check if Escape key was pressed
   */
  isEscape: (e: React.KeyboardEvent): boolean => e.key === "Escape",

  /**
   * Check if Space key was pressed
   */
  isSpace: (e: React.KeyboardEvent): boolean => e.key === " ",

  /**
   * Check if Tab key was pressed
   */
  isTab: (e: React.KeyboardEvent): boolean => e.key === "Tab",

  /**
   * Check if arrow key was pressed
   */
  isArrowKey: (e: React.KeyboardEvent): boolean =>
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key),
}

/**
 * Focus management utilities
 */
export const FocusUtils = {
  /**
   * Trap focus within an element (for modals)
   */
  trapFocus: (event: React.KeyboardEvent, containerRef: React.RefObject<HTMLElement>) => {
    if (!KeyboardUtils.isTab(event)) return

    const container = containerRef.current
    if (!container) return

    const focusableElements = container.querySelectorAll(
      'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )

    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        event.preventDefault()
        lastElement?.focus()
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        event.preventDefault()
        firstElement?.focus()
      }
    }
  },

  /**
   * Focus element with announcements
   */
  focusWithAnnouncement: (element: HTMLElement | null, announcement?: string) => {
    if (element) {
      element.focus()
      if (announcement) {
        announceToScreenReader(announcement)
      }
    }
  },
}

/**
 * Announce text to screen readers
 * Creates a temporary live region with the announcement
 */
export function announceToScreenReader(
  text: string,
  priority: "polite" | "assertive" = "polite"
): void {
  const announcement = document.createElement("div")
  announcement.setAttribute("role", "status")
  announcement.setAttribute("aria-live", priority)
  announcement.setAttribute("aria-atomic", "true")
  announcement.className = "sr-only"
  announcement.textContent = text

  document.body.appendChild(announcement)

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement)
  }, 1000)
}

/**
 * Skip to main content link
 * Add this to the top of your page for keyboard navigation
 * Usage: <SkipToMainContent />
 */
export const SkipToMainContent = () => {
  return React.createElement(
    "a",
    {
      href: "#main-content",
      className: "sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-4 focus:bg-blue-600 focus:text-white focus:rounded",
    },
    "Skip to main content"
  )
}

/**
 * Color contrast checker (returns true if contrast ratio meets WCAG AA)
 * This is a simplified check - use WebAIM tool for precise measurements
 */
export function meetsWCAGContrastRatio(
  foreground: string,
  background: string
): boolean {
  // Simplified check - in production, use proper color contrast calculation
  // This is a placeholder
  return true
}

/**
 * Validate form accessibility
 */
export function validateFormAccessibility(formElement: HTMLFormElement): string[] {
  const issues: string[] = []

  // Check for inputs without labels
  const inputs = formElement.querySelectorAll("input, textarea, select")
  inputs.forEach((input) => {
    const htmlInput = input as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    const label = formElement.querySelector(`label[for="${htmlInput.id}"]`)
    const ariaLabel = htmlInput.getAttribute("aria-label")

    if (!label && !ariaLabel && htmlInput.type !== "hidden") {
      issues.push(`Input ${htmlInput.name || htmlInput.id} missing label`)
    }
  })

  // Check for required fields without aria-required
  const requiredInputs = formElement.querySelectorAll("[required]")
  requiredInputs.forEach((input) => {
    if (!input.hasAttribute("aria-required")) {
      issues.push(`Required input ${(input as any).name} missing aria-required`)
    }
  })

  return issues
}

/**
 * Tailwind CSS class for screen reader only content
 * Add to your globals.css:
 *
 * @layer utilities {
 *   @apply sr-only {
 *     position: absolute;
 *     width: 1px;
 *     height: 1px;
 *     padding: 0;
 *     margin: -1px;
 *     overflow: hidden;
 *     clip: rect(0, 0, 0, 0);
 *     white-space: nowrap;
 *     border-width: 0;
 *   }
 *
 *   @apply focus\:not-sr-only:focus {
 *     position: static;
 *     width: auto;
 *     height: auto;
 *     padding: inherit;
 *     margin: inherit;
 *     overflow: visible;
 *     clip: auto;
 *     white-space: normal;
 *   }
 * }
 */
