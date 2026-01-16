"use client"

import React from "react"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils/cn"

interface DashboardKPICardProps {
  title: string
  value: string | number
  icon: LucideIcon
  color: "blue" | "green" | "purple" | "orange" | "red" | "indigo"
  trend?: {
    value: number
    direction: "up" | "down"
    label: string
  }
  subtitle?: string
  onClick?: () => void
}

const colorConfig = {
  blue: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    icon: "text-blue-600 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
    label: "text-gray-600 dark:text-gray-400",
  },
  green: {
    bg: "bg-green-50 dark:bg-green-900/20",
    icon: "text-green-600 dark:text-green-400",
    border: "border-green-200 dark:border-green-800",
    label: "text-gray-600 dark:text-gray-400",
  },
  purple: {
    bg: "bg-purple-50 dark:bg-purple-900/20",
    icon: "text-purple-600 dark:text-purple-400",
    border: "border-purple-200 dark:border-purple-800",
    label: "text-gray-600 dark:text-gray-400",
  },
  orange: {
    bg: "bg-orange-50 dark:bg-orange-900/20",
    icon: "text-orange-600 dark:text-orange-400",
    border: "border-orange-200 dark:border-orange-800",
    label: "text-gray-600 dark:text-gray-400",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-900/20",
    icon: "text-red-600 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
    label: "text-gray-600 dark:text-gray-400",
  },
  indigo: {
    bg: "bg-indigo-50 dark:bg-indigo-900/20",
    icon: "text-indigo-600 dark:text-indigo-400",
    border: "border-indigo-200 dark:border-indigo-800",
    label: "text-gray-600 dark:text-gray-400",
  },
}

export function DashboardKPICard({
  title,
  value,
  icon: Icon,
  color,
  trend,
  subtitle,
  onClick,
}: DashboardKPICardProps) {
  const colors = colorConfig[color]

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-lg border bg-white dark:bg-slate-800 shadow-sm transition-all hover:shadow-md",
        colors.border,
        onClick && "cursor-pointer hover:scale-105",
        "p-6"
      )}
    >
      {/* Gradient background element */}
      <div className={cn("absolute top-0 right-0 w-20 h-20 rounded-full opacity-10", colors.bg)} />

      <div className="relative">
        {/* Header with icon */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <p className={cn("text-sm font-medium", colors.label)}>{title}</p>
          </div>
          <div className={cn("p-2 rounded-lg", colors.bg)}>
            <Icon className={cn("h-5 w-5", colors.icon)} />
          </div>
        </div>

        {/* Value */}
        <div className="mb-2">
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
              {subtitle}
            </p>
          )}
        </div>

        {/* Trend indicator */}
        {trend && (
          <div className="flex items-center gap-1 mt-3">
            <span
              className={cn(
                "text-xs font-semibold",
                trend.direction === "up" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              )}
            >
              {trend.direction === "up" ? "↑" : "↓"} {Math.abs(trend.value)}%
            </span>
            <span className="text-xs text-gray-600 dark:text-gray-400">{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  )
}
