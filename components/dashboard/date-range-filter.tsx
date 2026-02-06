"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { subDays, startOfYear, startOfMonth, format } from "date-fns";

interface DateRangeFilterProps {
  onFilterChange?: () => void;
}

type QuickFilter = "last7" | "last30" | "last90" | "mtd" | "ytd" | "thisYear" | "allTime" | "custom";

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
    { label: "Últimos 7 Dias", value: "last7" },
    { label: "Últimos 30 Dias", value: "last30" },
    { label: "Últimos 90 Dias", value: "last90" },
    { label: "Mês Atual", value: "mtd" },
    { label: "Ano Atual", value: "ytd" },
    { label: "Este Ano", value: "thisYear" },
    { label: "Todo Período", value: "allTime" },
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
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300">
        <span className="text-sm font-medium text-gray-700">
          Período:
        </span>
        {quickFilters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => handleQuickFilter(filter.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              isActiveFilter(filter.value)
                ? "bg-blue-600 text-white"
                : "bg-white"
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
              : "bg-white"
          }`}
        >
          Personalizado
        </button>
      </div>

      {/* Custom Date Range Picker */}
      {showCustomRange && (
        <div className="bg-white">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">
                Data Inicial
              </label>
              <input
                type="date"
                value={customFrom || currentFrom || ""}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">
                Data Final
              </label>
              <input
                type="date"
                value={customTo || currentTo || ""}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300"
              />
            </div>
            <button
              onClick={handleCustomRangeApply}
              disabled={!customFrom || !customTo}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}

      {/* Active Filter Display */}
      {(currentFilter || isCustomRangeActive) && (
        <div className="text-sm text-gray-600">
          {isCustomRangeActive ? (
            <span>
              Exibindo dados de{" "}
              <span className="font-semibold text-gray-900">
                {format(new Date(currentFrom!), "dd/MM/yyyy")}
              </span>{" "}
              até{" "}
              <span className="font-semibold text-gray-900">
                {format(new Date(currentTo!), "dd/MM/yyyy")}
              </span>
            </span>
          ) : currentFilter === "last7" ? (
            <span>
              Exibindo dados dos{" "}
              <span className="font-semibold text-gray-900">
                últimos 7 dias
              </span>
            </span>
          ) : currentFilter === "last30" ? (
            <span>
              Exibindo dados dos{" "}
              <span className="font-semibold text-gray-900">
                últimos 30 dias
              </span>
            </span>
           ) : currentFilter === "last90" ? (
            <span>
              Exibindo dados dos{" "}
              <span className="font-semibold text-gray-900">
                últimos 90 dias
              </span>
            </span>
          ) : currentFilter === "mtd" ? (
            <span>
              Exibindo dados do{" "}
              <span className="font-semibold text-gray-900">
                mês atual
              </span>{" "}
              (Mês até Hoje)
            </span>
          ) : currentFilter === "ytd" ? (
            <span>
              Exibindo dados do{" "}
              <span className="font-semibold text-gray-900">
                ano atual
              </span>{" "}
              (Ano até Hoje)
            </span>
          ) : currentFilter === "thisYear" ? (
            <span>
              Exibindo dados do{" "}
              <span className="font-semibold text-gray-900">
                ano atual
              </span>
            </span>
          ) : currentFilter === "allTime" ? (
            <span>
              Exibindo{" "}
              <span className="font-semibold text-gray-900">
                todo o período
              </span>
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
    case "mtd":
      // Month to Date - from 1st of current month to now
      return {
        startDate: startOfMonth(now),
        endDate: now,
      };
    case "ytd":
      // Year to Date - from 1st of January to now
      return {
        startDate: startOfYear(now),
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
