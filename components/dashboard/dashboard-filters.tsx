"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { format } from "date-fns";

interface DashboardFiltersProps {
  onFiltersChange?: (filters: FilterState) => void;
}

export interface FilterState {
  dateRange: string;
  from?: string;
  to?: string;
  segment: string;
  invoiceStatus: string[];
  dealStatus: string[];
}

const INVOICE_STATUSES = [
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "VIEWED", label: "Viewed" },
  { value: "PAID", label: "Paid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "PARTIALLY_PAID", label: "Partially Paid" },
  { value: "VOIDED", label: "Voided" },
];

const DEAL_STATUSES = [
  { value: "OPEN", label: "Open" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
];

const CUSTOMER_SEGMENTS = [
  { value: "all", label: "All Customers" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "churned", label: "Churned" },
];

const DATE_RANGES = [
  { value: "last7", label: "Last 7 Days" },
  { value: "last30", label: "Last 30 Days" },
  { value: "last90", label: "Last 90 Days" },
  { value: "thisYear", label: "This Year" },
  { value: "allTime", label: "All Time" },
  { value: "custom", label: "Custom" },
];

export function DashboardFilters({ onFiltersChange }: DashboardFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse current filter state from URL
  const [dateRange, setDateRange] = useState(
    searchParams.get("dateRange") || "allTime"
  );
  const [fromDate, setFromDate] = useState(searchParams.get("from") || "");
  const [toDate, setToDate] = useState(searchParams.get("to") || "");
  const [segment, setSegment] = useState(
    searchParams.get("segment") || "all"
  );
  const [invoiceStatuses, setInvoiceStatuses] = useState<string[]>(
    searchParams.get("invoiceStatus")?.split(",").filter(Boolean) || []
  );
  const [dealStatuses, setDealStatuses] = useState<string[]>(
    searchParams.get("dealStatus")?.split(",").filter(Boolean) || []
  );

  const [showCustomDateRange, setShowCustomDateRange] = useState(
    dateRange === "custom"
  );

  const handleDateRangeChange = (newRange: string) => {
    setDateRange(newRange);
    if (newRange === "custom") {
      setShowCustomDateRange(true);
    } else {
      setShowCustomDateRange(false);
      setFromDate("");
      setToDate("");
    }
  };

  const handleInvoiceStatusToggle = (status: string) => {
    setInvoiceStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  const handleDealStatusToggle = (status: string) => {
    setDealStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  const applyFilters = () => {
    const params = new URLSearchParams();

    params.set("dateRange", dateRange);
    if (showCustomDateRange && fromDate && toDate) {
      params.set("from", fromDate);
      params.set("to", toDate);
    }
    params.set("segment", segment);
    if (invoiceStatuses.length > 0) {
      params.set("invoiceStatus", invoiceStatuses.join(","));
    }
    if (dealStatuses.length > 0) {
      params.set("dealStatus", dealStatuses.join(","));
    }

    router.push(`?${params.toString()}`);

    onFiltersChange?.({
      dateRange,
      from: fromDate,
      to: toDate,
      segment,
      invoiceStatus: invoiceStatuses,
      dealStatus: dealStatuses,
    });
  };

  const resetFilters = () => {
    setDateRange("allTime");
    setFromDate("");
    setToDate("");
    setSegment("all");
    setInvoiceStatuses([]);
    setDealStatuses([]);
    setShowCustomDateRange(false);

    router.push("?");

    onFiltersChange?.({
      dateRange: "allTime",
      segment: "all",
      invoiceStatus: [],
      dealStatus: [],
    });
  };

  const hasActiveFilters =
    dateRange !== "allTime" ||
    segment !== "all" ||
    invoiceStatuses.length > 0 ||
    dealStatuses.length > 0;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 mb-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Filters
        </h2>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
          >
            Reset Filters
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Date Range Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Date Range
          </label>
          <div className="flex flex-wrap gap-2">
            {DATE_RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => handleDateRangeChange(range.value)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  dateRange === range.value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range */}
          {showCustomDateRange && (
            <div className="mt-4 flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  From
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  To
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Customer Segment Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Customer Segment
          </label>
          <div className="flex flex-wrap gap-2">
            {CUSTOMER_SEGMENTS.map((seg) => (
              <button
                key={seg.value}
                onClick={() => setSegment(seg.value)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  segment === seg.value
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {seg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Invoice Status Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Invoice Status
          </label>
          <div className="flex flex-wrap gap-2">
            {INVOICE_STATUSES.map((status) => (
              <button
                key={status.value}
                onClick={() => handleInvoiceStatusToggle(status.value)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  invoiceStatuses.includes(status.value)
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>

        {/* Deal Status Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Deal Status
          </label>
          <div className="flex flex-wrap gap-2">
            {DEAL_STATUSES.map((status) => (
              <button
                key={status.value}
                onClick={() => handleDealStatusToggle(status.value)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  dealStatuses.includes(status.value)
                    ? "bg-orange-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={applyFilters}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}
