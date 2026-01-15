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
  valueColor = "text-gray-900 dark:text-white",
  isLoading = false,
}: KpiCardProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 animate-pulse">
        <div className="flex items-center justify-between mb-2">
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-24"></div>
          <div className="h-5 w-5 bg-gray-300 dark:bg-gray-700 rounded"></div>
        </div>
        <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-32 mb-2"></div>
        <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-20"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
      {/* Header with title and icon */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {title}
        </h3>
        {icon && <div>{icon}</div>}
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-2">
        <p className={`text-2xl font-bold ${valueColor}`}>
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
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );
}
