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
    bg: "bg-blue-50",
    icon: "text-blue-600",
    border: "border-blue-200",
    label: "text-gray-600",
  },
  green: {
    bg: "bg-green-50",
    icon: "text-green-600",
    border: "border-green-200",
    label: "text-gray-600",
  },
  purple: {
    bg: "bg-purple-50",
    icon: "text-purple-600",
    border: "border-purple-200",
    label: "text-gray-600",
  },
  orange: {
    bg: "bg-orange-50",
    icon: "text-orange-600",
    border: "border-orange-200",
    label: "text-gray-600",
  },
  red: {
    bg: "bg-red-50",
    icon: "text-red-600",
    border: "border-red-200",
    label: "text-gray-600",
  },
  indigo: {
    bg: "bg-indigo-50",
    icon: "text-indigo-600",
    border: "border-indigo-200",
    label: "text-gray-600",
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
        "relative overflow-hidden rounded-lg border bg-white",
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
          <p className="text-2xl sm:text-3xl font-bold text-gray-900">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs sm:text-sm text-gray-600">
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
                trend.direction === "up" ? "text-green-600" : "text-red-600"
              )}
            >
              {trend.direction === "up" ? "↑" : "↓"} {Math.abs(trend.value)}%
            </span>
            <span className="text-xs text-gray-600">{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  )
}
