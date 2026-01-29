import React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Skeleton Loader Component
 * 
 * Provides visual placeholders during loading states.
 * Uses Tailwind's animate-pulse for smooth shimmer effect.
 */

export type SkeletonVariant = "text" | "rectangle" | "circle";

export interface SkeletonProps {
  className?: string;
  variant?: SkeletonVariant;
}

const variantStyles: Record<SkeletonVariant, string> = {
  text: "h-4 rounded",           // Single line of text
  rectangle: "rounded-lg",        // Card or image
  circle: "rounded-full",         // Avatar or icon
};

export function Skeleton({ className, variant = "rectangle" }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-gray-200",
        variantStyles[variant],
        className
      )}
    />
  );
}

/**
 * Common skeleton patterns for convenience
 */

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={cn(
            "w-full",
            // Last line is shorter for natural appearance
            i === lines - 1 && "w-3/4"
          )}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("border border-gray-200 rounded-lg p-6 space-y-4", className)}>
      <Skeleton className="h-6 w-1/3" />
      <SkeletonText lines={3} />
    </div>
  );
}
