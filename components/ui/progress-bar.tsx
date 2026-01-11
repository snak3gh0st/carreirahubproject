import React from "react";

interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  variant?: "default" | "success" | "error" | "warning";
  className?: string;
  size?: "sm" | "md" | "lg";
}

const variantColors: Record<string, string> = {
  default: "bg-blue-600",
  success: "bg-green-600",
  error: "bg-red-600",
  warning: "bg-yellow-600",
};

const sizeClasses: Record<string, string> = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
};

export function ProgressBar({
  progress,
  label,
  showPercentage = true,
  variant = "default",
  className = "",
  size = "md",
}: ProgressBarProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  const colorClass = variantColors[variant];

  return (
    <div className={`w-full ${className}`}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-2">
          {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
          {showPercentage && (
            <span className="text-sm font-medium text-gray-700">
              {clampedProgress.toFixed(0)}%
            </span>
          )}
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <div
          className={`${colorClass} ${sizeClasses[size]} rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${clampedProgress}%` }}
        ></div>
      </div>
    </div>
  );
}
