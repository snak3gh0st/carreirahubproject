"use client";

import { useRouter, useSearchParams } from "next/navigation";

/**
 * QuickFilters - Simple date range filters for main dashboard
 * 
 * Key differences from DashboardFilters:
 * - ONLY shows date range options (no segments, statuses, custom dates)
 * - Auto-updates immediately on click (no Apply button)
 * - Clean, minimal UI for quick overview use case
 * - DashboardFilters (advanced filters) remains for Insights page
 */

const DATE_RANGES = [
  { value: "last7", label: "Last 7 Days" },
  { value: "last30", label: "Last 30 Days" },
  { value: "thisYear", label: "This Year" },
  { value: "allTime", label: "All Time" },
];

export function QuickFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get current date range from URL (default: thisYear)
  const currentRange = searchParams.get("dateRange") || "thisYear";

  const handleDateRangeChange = (newRange: string) => {
    // Immediately update URL - this triggers dashboard useEffect to refetch
    const params = new URLSearchParams();
    params.set("dateRange", newRange);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Time Period
        </h3>
        {currentRange !== "thisYear" && (
          <button
            onClick={() => handleDateRangeChange("thisYear")}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
          >
            Reset
          </button>
        )}
      </div>
      
      <div className="flex flex-wrap gap-2">
        {DATE_RANGES.map((range) => (
          <button
            key={range.value}
            onClick={() => handleDateRangeChange(range.value)}
            className={`
              px-4 py-2 rounded-md text-sm font-medium transition-all
              ${
                currentRange === range.value
                  ? "bg-primary-600 text-white shadow-sm"
                  : "bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200"
              }
            `}
          >
            {range.label}
          </button>
        ))}
      </div>

      <p className="mt-4 text-xs text-gray-500">
        Metrics update automatically when you select a time period.
        For advanced filters, visit the{" "}
        <a href="/dashboard/insights" className="text-primary-600 hover:text-primary-700 font-medium">
          Insights page
        </a>
        .
      </p>
    </div>
  );
}
