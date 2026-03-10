"use client";

import { ReactNode } from "react";

interface QuickBooksKpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: ReactNode;
  isLoading?: boolean;
  valueColor?: string;
}

export function QuickBooksKpiCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  isLoading,
  valueColor = "text-gray-900",
}: QuickBooksKpiCardProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-4" />
        <div className="h-8 bg-gray-200 rounded w-3/4 mb-2" />
        <div className="h-3 bg-gray-200 rounded w-1/3" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <p className={`text-2xl font-bold truncate ${valueColor}`}>{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center mt-2">
              <span
                className={`text-sm font-medium ${
                  trend.isPositive ? "text-green-600" : "text-red-600"
                }`}
              >
                {trend.isPositive ? "+" : ""}
                {trend.value}%
              </span>
              <span className="text-sm text-gray-500 ml-1">vs período anterior</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="ml-4 p-2 bg-gray-50 rounded-lg">{icon}</div>
        )}
      </div>
    </div>
  );
}
