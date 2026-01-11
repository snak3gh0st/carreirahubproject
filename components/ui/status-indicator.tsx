import React from "react";

export type StatusType = "healthy" | "warning" | "error" | "unknown";

interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  showDot?: boolean;
  className?: string;
}

const statusConfig: Record<
  StatusType,
  { color: string; bg: string; text: string; dotColor: string }
> = {
  healthy: {
    color: "text-green-700",
    bg: "bg-green-50",
    text: "Healthy",
    dotColor: "bg-green-500",
  },
  warning: {
    color: "text-yellow-700",
    bg: "bg-yellow-50",
    text: "Warning",
    dotColor: "bg-yellow-500",
  },
  error: {
    color: "text-red-700",
    bg: "bg-red-50",
    text: "Error",
    dotColor: "bg-red-500",
  },
  unknown: {
    color: "text-gray-700",
    bg: "bg-gray-50",
    text: "Unknown",
    dotColor: "bg-gray-400",
  },
};

export function StatusIndicator({
  status,
  label,
  showDot = true,
  className = "",
}: StatusIndicatorProps) {
  const config = statusConfig[status];
  const displayLabel = label || config.text;

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${config.bg} ${config.color} ${className}`}
    >
      {showDot && (
        <span
          className={`h-2 w-2 rounded-full ${config.dotColor} animate-pulse`}
        ></span>
      )}
      <span className="text-sm font-medium">{displayLabel}</span>
    </div>
  );
}
