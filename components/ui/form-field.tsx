"use client"

import * as React from "react"
import { cn } from "@/lib/utils/cn"

interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  required?: boolean
  error?: string
  helperText?: string
  htmlFor?: string
}

/**
 * Accessible form field wrapper
 *
 * Features:
 * - Associates label with input via htmlFor
 * - ARIA labels for error states
 * - Helper text support with aria-describedby
 * - Visual and screen reader indication of required fields
 *
 * Usage:
 * <FormField label="Email" htmlFor="email" error={errors.email}>
 *   <Input id="email" aria-invalid={!!errors.email} />
 * </FormField>
 */
export const FormField = React.forwardRef<
  HTMLDivElement,
  FormFieldProps
>(({ label, required, error, helperText, htmlFor, children, className, ...props }, ref) => {
  const errorId = error ? `${htmlFor}-error` : undefined
  const helperId = helperText ? `${htmlFor}-helper` : undefined
  const describedBy = [errorId, helperId].filter(Boolean).join(" ")

  return (
    <div ref={ref} className={cn("flex flex-col gap-1.5", className)} {...props}>
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-gray-700"
      >
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">
            *
          </span>
        )}
      </label>

      {/* Inject aria-describedby into child input */}
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<any>, {
            "aria-invalid": !!error,
            "aria-describedby": describedBy || undefined,
          })
        : children}

      {helperText && (
        <p id={helperId} className="text-xs text-gray-500">
          {helperText}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-xs font-medium text-red-600"
        >
          {error}
        </p>
      )}
    </div>
  )
})

FormField.displayName = "FormField"
