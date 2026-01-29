"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface InvoiceFiltersProps {
  statsMap: Record<string, { count: number; amount: number }>;
  currentStatus?: string;
  currentSearch?: string;
  currentSource?: string;
}

export function InvoiceFilters({
  statsMap,
  currentStatus,
  currentSearch,
  currentSource,
}: InvoiceFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleStatusChange = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (status) {
      params.set("status", status);
    } else {
      params.delete("status");
    }
    router.push(`/dashboard/invoices?${params.toString()}`);
  };

  const handleDateRangeChange = (range: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    // Remove existing date filters
    params.delete("dueDateFrom");
    params.delete("dueDateTo");
    
    if (range === "week") {
      const today = new Date();
      const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      params.set("dueDateFrom", today.toISOString().split("T")[0]);
      params.set("dueDateTo", weekFromNow.toISOString().split("T")[0]);
    } else if (range === "month") {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      params.set("dueDateFrom", monthStart.toISOString().split("T")[0]);
      params.set("dueDateTo", monthEnd.toISOString().split("T")[0]);
    }
    
    router.push(`/dashboard/invoices?${params.toString()}`);
  };

  const getCurrentDateRange = () => {
    const dueDateFrom = searchParams.get("dueDateFrom");
    const dueDateTo = searchParams.get("dueDateTo");
    
    if (!dueDateFrom || !dueDateTo) return "";
    
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split("T")[0];
    
    if (dueDateFrom === todayStr && dueDateTo === weekFromNow) return "week";
    if (dueDateFrom === monthStart && dueDateTo === monthEnd) return "month";
    return "";
  };

  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
      {/* Left side - Filter dropdowns */}
      <div className="flex flex-wrap items-center gap-3 flex-1">
        {/* Status Filter Dropdown */}
        <div className="min-w-[160px]">
          <select
            value={currentStatus || ""}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-gray-200 text-sm font-display font-medium text-gray-700 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
          >
            <option value="">All Status</option>
            {Object.entries(statsMap).map(([status, data]) => (
              <option key={status} value={status}>
                {status} ({data.count})
              </option>
            ))}
          </select>
        </div>

        {/* Date Range Quick Filter */}
        <div className="min-w-[160px]">
          <select
            value={getCurrentDateRange()}
            onChange={(e) => handleDateRangeChange(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-gray-200 text-sm font-display font-medium text-gray-700 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
          >
            <option value="">All Time</option>
            <option value="week">Due This Week</option>
            <option value="month">Due This Month</option>
          </select>
        </div>

        {/* Search */}
        <form method="GET" className="flex-1 min-w-[200px]">
          {currentStatus && <input type="hidden" name="status" value={currentStatus} />}
          {currentSource && <input type="hidden" name="source" value={currentSource} />}
          {searchParams.get("dueDateFrom") && (
            <input type="hidden" name="dueDateFrom" value={searchParams.get("dueDateFrom")!} />
          )}
          {searchParams.get("dueDateTo") && (
            <input type="hidden" name="dueDateTo" value={searchParams.get("dueDateTo")!} />
          )}
          <div className="relative">
            <input
              type="text"
              name="search"
              defaultValue={currentSearch}
              placeholder="Search invoices..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 text-sm rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <svg
              className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </form>
      </div>
    </div>
  );
}
