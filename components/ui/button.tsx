import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Enhanced Button Component with Design Tokens
 * 
 * Professional button with 5 variants, 5 sizes, and proper loading states.
 * Uses design tokens from lib/design-tokens.ts for consistent styling.
 */

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive" | "success" | "danger";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-brand-tangerina text-white hover:bg-brand-tangerina/90 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm disabled:opacity-50 focus:ring-brand-tangerina shadow-sm",
  secondary: "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm disabled:opacity-50 focus:ring-brand-verde",
  outline: "bg-transparent border border-brand-tangerina text-brand-tangerina hover:bg-brand-creme hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm disabled:opacity-50 focus:ring-brand-tangerina",
  ghost: "bg-transparent text-gray-600 hover:bg-gray-100 disabled:opacity-50 focus:ring-gray-400",
  destructive: "bg-error-600 text-white hover:bg-error-700 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm disabled:opacity-50 focus:ring-error-500 shadow-sm",
  // Legacy aliases for backward compatibility
  success: "bg-success-600 text-white hover:bg-success-700 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm disabled:opacity-50 focus:ring-success-500 shadow-sm",
  danger: "bg-error-600 text-white hover:bg-error-700 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm disabled:opacity-50 focus:ring-error-500 shadow-sm",
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: "h-7 px-2 text-xs",      // 28px height
  sm: "h-8 px-3 text-sm",      // 32px height
  md: "h-10 px-4 text-base",   // 40px height (default)
  lg: "h-12 px-6 text-lg",     // 48px height
  xl: "h-14 px-8 text-lg",     // 56px height
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        // Base styles
        "inline-flex items-center justify-center gap-2 font-medium rounded-md",
        // Transitions (lift animation on hover)
        "transition-all duration-200 ease-out",
        // Focus ring
        "focus:outline-none focus:ring-2 focus:ring-offset-2",
        // Disabled state
        "disabled:cursor-not-allowed",
        // Variant and size styles
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Carregando...</span>
        </>
      ) : (
        <>
          {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
}
