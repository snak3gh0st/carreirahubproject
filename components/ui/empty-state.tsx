import React from "react";
import { Button } from "./button";
import { cn } from "@/lib/utils/cn";

/**
 * EmptyState Component
 * 
 * Friendly empty state component for when there's no data to display.
 * Guides users with helpful messaging and clear call-to-action.
 */

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("text-center py-12", className)}>
      {/* Icon */}
      {icon && (
        <div className="mx-auto w-16 h-16 text-gray-400 flex items-center justify-center">
          {icon}
        </div>
      )}

      {/* Title */}
      <h3 className="mt-4 text-lg font-semibold text-gray-900">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
          {description}
        </p>
      )}

      {/* Action button */}
      {action && (
        <div className="mt-6">
          <Button
            variant="primary"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
