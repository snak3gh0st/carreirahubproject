import React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Enhanced Badge Component with Design Tokens
 * 
 * Status badges with semantic colors for common UI patterns like
 * invoice status, payment status, etc. Uses design token colors.
 */

export type BadgeVariant =
  | "default"
  | "success"
  | "error"
  | "warning"
  | "info"
  | "pending"; // Alias for warning

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  dot?: boolean; // Optional colored dot indicator
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-gray-100 text-gray-700",
  success: "bg-success-100 text-success-700",      // Paid status
  error: "bg-error-100 text-error-700",            // Overdue status
  warning: "bg-warning-100 text-warning-700",      // Pending status
  info: "bg-info-100 text-info-700",               // Info status
  pending: "bg-warning-100 text-warning-700",      // Alias for warning
};

const dotStyles: Record<BadgeVariant, string> = {
  default: "bg-gray-700",
  success: "bg-success-700",
  error: "bg-error-700",
  warning: "bg-warning-700",
  info: "bg-info-700",
  pending: "bg-warning-700",
};

export function Badge({ children, variant = "default", className = "", dot = false }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold",
        variantStyles[variant],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full mr-1.5",
            dotStyles[variant]
          )}
        />
      )}
      {children}
    </span>
  );
}
