import React from "react";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  valueColor?: string;
  isLoading?: boolean;
}

/**
 * Reusable KPI card component for dashboard metrics
 *
 * Displays a metric with optional trend indicator and icon.
 * Responsive: full width on mobile, 1/4 width on desktop grid.
 */
export function KpiCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  valueColor = "text-gray-900",
  isLoading = false,
}: KpiCardProps) {
  if (isLoading) {
    return (
      <div className="bg-white overflow-hidden min-w-0">
        <div className="flex items-center justify-between mb-2">
          <div className="h-4 bg-gray-300"></div>
          <div className="h-5 w-5 bg-gray-300"></div>
        </div>
        <div className="h-8 bg-gray-300"></div>
        <div className="h-3 bg-gray-300"></div>
      </div>
    );
  }

  return (
    <div className="bg-white overflow-hidden min-w-0">
      {/* Header with title and icon */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600">
          {title}
        </h3>
        {icon && <div>{icon}</div>}
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-2 min-w-0">
        <p className={`text-2xl font-bold truncate ${valueColor}`}>
          {value}
        </p>

        {/* Trend indicator */}
        {trend && (
          <span
            className={`text-sm font-medium ${
              trend.isPositive ? "text-green-600" : "text-red-600"
            }`}
          >
            {trend.isPositive ? "+" : ""}
            {trend.value}%
          </span>
        )}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <p className="text-xs text-gray-500">
          {subtitle}
        </p>
      )}
    </div>
  );
}
