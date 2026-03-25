import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * StatCard Component with Design Tokens
 * 
 * Professional KPI card for displaying dashboard metrics with trend indicators.
 * Used for financial metrics, customer counts, and other key performance indicators.
 */

export interface StatCardProps {
  label: string;              // "Total Revenue"
  value: string;              // "$125,430.00"
  change?: string;            // "+12.5%"
  trend?: "up" | "down" | "neutral";  // Trend direction
  icon?: React.ReactNode;     // Optional icon (top right)
  description?: string;       // "vs last month"
  className?: string;
}

const trendConfig = {
  up: {
    icon: TrendingUp,
    className: "text-success-600",
  },
  down: {
    icon: TrendingDown,
    className: "text-error-600",
  },
  neutral: {
    icon: Minus,
    className: "text-gray-500",
  },
};

export function StatCard({
  label,
  value,
  change,
  trend,
  icon,
  description,
  className,
}: StatCardProps) {
  const TrendIcon = trend ? trendConfig[trend].icon : null;
  const trendClassName = trend ? trendConfig[trend].className : "";

  return (
    <div
      className={cn(
        "bg-white border border-gray-200 rounded-xl p-6 overflow-hidden",
        "hover:border-brand-caramelo hover:shadow-lg hover:scale-[1.01] transition-all duration-200",
        className
      )}
    >
      {/* Header with label and optional icon */}
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide">
          {label}
        </p>
        {icon && (
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-brand-creme">
            <div className="text-brand-verde">
              {icon}
            </div>
          </div>
        )}
      </div>

      {/* Main value */}
      <div className="min-w-0 space-y-2">
        <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 tabular-nums truncate">
          {value}
        </p>

        {/* Trend and change */}
        {(change || description) && (
          <div className="flex items-center gap-2 text-sm text-gray-700">
            {TrendIcon && (
              <TrendIcon className={cn("h-4 w-4", trendClassName)} />
            )}
            {change && (
              <span className={cn("font-medium", trendClassName)}>
                {change}
              </span>
            )}
            {description && (
              <span className="text-gray-500">
                {description}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
