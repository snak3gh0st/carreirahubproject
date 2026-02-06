"use client";

interface CollectionProbabilityGaugeProps {
  probability: number; // 0-100
  label?: string;
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export function CollectionProbabilityGauge({
  probability,
  label = "Probabilidade de Recebimento",
  size = "md",
  isLoading,
}: CollectionProbabilityGaugeProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center">
        <div className="animate-pulse bg-gray-200 rounded-full w-32 h-32" />
      </div>
    );
  }

  const sizeClasses = {
    sm: { container: "w-24 h-24", text: "text-2xl", label: "text-xs" },
    md: { container: "w-32 h-32", text: "text-3xl", label: "text-sm" },
    lg: { container: "w-40 h-40", text: "text-4xl", label: "text-base" },
  };

  const classes = sizeClasses[size];

  // Determine color based on probability
  let color = "text-gray-500";
  let bgColor = "bg-gray-100";
  let ringColor = "ring-gray-300";

  if (probability >= 80) {
    color = "text-green-600";
    bgColor = "bg-green-50";
    ringColor = "ring-green-500";
  } else if (probability >= 60) {
    color = "text-blue-600";
    bgColor = "bg-blue-50";
    ringColor = "ring-blue-500";
  } else if (probability >= 40) {
    color = "text-yellow-600";
    bgColor = "bg-yellow-50";
    ringColor = "ring-yellow-500";
  } else {
    color = "text-red-600";
    bgColor = "bg-red-50";
    ringColor = "ring-red-500";
  }

  // Calculate circumference for the ring
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (probability / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg
          className={classes.container}
          viewBox="0 0 120 120"
        >
          {/* Background circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="10"
          />
          {/* Progress circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={
              probability >= 80
                ? "#10b981"
                : probability >= 60
                ? "#3b82f6"
                : probability >= 40
                ? "#f59e0b"
                : "#ef4444"
            }
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`${classes.text} font-bold ${color}`}>
            {probability}%
          </span>
        </div>
      </div>
      <div className="text-center">
        <div className={`${classes.label} font-medium text-gray-700`}>
          {label}
        </div>
      </div>
    </div>
  );
}
