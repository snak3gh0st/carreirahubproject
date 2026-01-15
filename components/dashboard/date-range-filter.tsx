"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { subDays, startOfYear, format } from "date-fns";

interface DateRangeFilterProps {
  onFilterChange?: () => void;
}

type QuickFilter = "last7" | "last30" | "last90" | "thisYear" | "allTime" | "custom";

export function DateRangeFilter({ onFilterChange }: DateRangeFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const currentFilter = searchParams.get("dateRange") as QuickFilter | null;
  const currentFrom = searchParams.get("from");
  const currentTo = searchParams.get("to");

  // Quick filter buttons
  const quickFilters: Array<{ label: string; value: QuickFilter }> = [
    { label: "Last 7 Days", value: "last7" },
    { label: "Last 30 Days", value: "last30" },
    { label: "Last 90 Days", value: "last90" },
    { label: "This Year", value: "thisYear" },
    { label: "All Time", value: "allTime" },
  ];

  const handleQuickFilter = (filter: QuickFilter) => {
    const params = new URLSearchParams();
    params.set("dateRange", filter);
    router.push(`?${params.toString()}`);
    setShowCustomRange(false);
    onFilterChange?.();
  };

  const handleCustomRangeApply = () => {
    if (!customFrom || !customTo) {
      return;
    }

    const params = new URLSearchParams();
    params.set("dateRange", "custom");
    params.set("from", customFrom);
    params.set("to", customTo);
    router.push(`?${params.toString()}`);
    onFilterChange?.();
  };

  const isActiveFilter = (filter: QuickFilter) => {
    return currentFilter === filter;
  };

  const isCustomRangeActive = currentFilter === "custom" && currentFrom && currentTo;

  return (
    <div className="mb-6">
      {/* Quick Filter Chips */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
          Date Range:
        </span>
        {quickFilters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => handleQuickFilter(filter.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              isActiveFilter(filter.value)
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-slate-700"
            }`}
          >
            {filter.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustomRange(!showCustomRange)}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            isCustomRangeActive
              ? "bg-blue-600 text-white"
              : "bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-slate-700"
          }`}
        >
          Custom Range
        </button>
      </div>

      {/* Custom Date Range Picker */}
      {showCustomRange && (
        <div className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-gray-600 rounded-lg p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={customFrom || currentFrom || ""}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={customTo || currentTo || ""}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleCustomRangeApply}
              disabled={!customFrom || !customTo}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Active Filter Display */}
      {(currentFilter || isCustomRangeActive) && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {isCustomRangeActive ? (
            <span>
              Showing data from{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                {format(new Date(currentFrom!), "MMM d, yyyy")}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                {format(new Date(currentTo!), "MMM d, yyyy")}
              </span>
            </span>
          ) : currentFilter === "last7" ? (
            <span>
              Showing data for the{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                last 7 days
              </span>
            </span>
          ) : currentFilter === "last30" ? (
            <span>
              Showing data for the{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                last 30 days
              </span>
            </span>
          ) : currentFilter === "last90" ? (
            <span>
              Showing data for the{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                last 90 days
              </span>
            </span>
          ) : currentFilter === "thisYear" ? (
            <span>
              Showing data for{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                this year
              </span>
            </span>
          ) : currentFilter === "allTime" ? (
            <span>
              Showing{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                all time
              </span>{" "}
              data
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}

// Helper function to calculate date range based on filter
export function getDateRangeFromFilter(
  dateRange: QuickFilter | null,
  from: string | null,
  to: string | null
): { startDate: Date | null; endDate: Date | null } {
  const now = new Date();

  if (dateRange === "custom" && from && to) {
    return {
      startDate: new Date(from),
      endDate: new Date(to),
    };
  }

  switch (dateRange) {
    case "last7":
      return {
        startDate: subDays(now, 7),
        endDate: now,
      };
    case "last30":
      return {
        startDate: subDays(now, 30),
        endDate: now,
      };
    case "last90":
      return {
        startDate: subDays(now, 90),
        endDate: now,
      };
    case "thisYear":
      return {
        startDate: startOfYear(now),
        endDate: now,
      };
    case "allTime":
    default:
      return {
        startDate: null,
        endDate: null,
      };
  }
}
