import * as React from "react"
import { cn } from "@/lib/utils/cn"

/**
 * Enhanced Input Component with Validation States
 * 
 * Professional input field with support for:
 * - Validation states (default, error, success)
 * - Helper text and error messages
 * - Label support
 */

export type InputState = "default" | "error" | "success";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  state?: InputState;
  helperText?: string;
  errorText?: string;
}

const stateStyles: Record<InputState, string> = {
  default: "border-gray-300 focus:ring-brand-verde focus:border-brand-verde",
  error: "border-error-500 focus:ring-error-500 focus:border-error-500",
  success: "border-success-500 focus:ring-success-500 focus:border-success-500",
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, state = "default", helperText, errorText, ...props }, ref) => {
    const inputId = props.id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const showError = state === "error" && errorText;
    const showHelper = helperText && !showError;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          type={type}
          className={cn(
            "flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm",
            "placeholder:text-gray-400",
            "focus:outline-none focus:ring-2 focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50",
            "transition-colors duration-200",
            stateStyles[state],
            className
          )}
          ref={ref}
          {...props}
        />
        {showError && (
          <p className="mt-1 text-sm text-error-600">
            {errorText}
          </p>
        )}
        {showHelper && (
          <p className="mt-1 text-sm text-gray-500">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
