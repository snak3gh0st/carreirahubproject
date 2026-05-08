"use client";

import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

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
  { value: "thisMonth", label: "MTD" },
  { value: "last7", label: "Últimos 7 Dias" },
  { value: "last30", label: "Últimos 30 Dias" },
  { value: "lastMonth", label: "Mês Passado" },
  { value: "thisYear", label: "Este Ano" },
  { value: "allTime", label: "Todo o Período" },
];

interface QuickFiltersProps {
  isLoading?: boolean;
}

export function QuickFilters({ isLoading = false }: QuickFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [pendingRange, setPendingRange] = useState<string | null>(null);
  
  // Get current date range from URL (default: thisYear)
  const currentRange = searchParams.get("dateRange") || "thisYear";
  const isUpdating = isPending || isLoading;

  useEffect(() => {
    setPendingRange(null);
  }, [currentRange]);

  const handleDateRangeChange = (newRange: string) => {
    if (newRange === currentRange && !isLoading) return;

    setPendingRange(newRange);

    // Immediately update URL - this triggers dashboard useEffect to refetch
    const params = new URLSearchParams();
    params.set("dateRange", newRange);
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Período
        </h3>
        <div className="flex items-center gap-3">
          {isUpdating && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Atualizando
            </span>
          )}
          {currentRange !== "thisYear" && (
          <button
            onClick={() => handleDateRangeChange("thisYear")}
            disabled={isUpdating}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
          >
            Limpar
          </button>
          )}
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {DATE_RANGES.map((range) => (
          <button
            key={range.value}
            onClick={() => handleDateRangeChange(range.value)}
            disabled={isUpdating}
            className={`
              inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all disabled:cursor-wait disabled:opacity-70
              ${
                currentRange === range.value || pendingRange === range.value
                  ? "bg-primary-600 text-white shadow-sm"
                  : "bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200"
              }
            `}
          >
            {pendingRange === range.value && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {range.label}
          </button>
        ))}
      </div>

      <p className="mt-4 text-xs text-gray-500">
        As métricas atualizam automaticamente ao selecionar um período.
        Para BI executivo, acesse o{" "}
        <a href="/dashboard/bi" className="text-primary-600 hover:text-primary-700 font-medium">
          BI Executivo
        </a>
        .
      </p>
    </div>
  );
}
