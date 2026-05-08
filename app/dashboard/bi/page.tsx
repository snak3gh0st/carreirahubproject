"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowUpRight, RefreshCw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { AreaEntryGrid } from "@/components/executive-bi/AreaEntryGrid";
import { DecisionQueue } from "@/components/executive-bi/DecisionQueue";
import { ExecutiveAreaPanel } from "@/components/executive-bi/ExecutiveAreaPanel";
import { ExecutiveHealthBand } from "@/components/executive-bi/ExecutiveHealthBand";
import { ExecutiveHero } from "@/components/executive-bi/ExecutiveHero";
import { RiskMap } from "@/components/executive-bi/RiskMap";
import type {
  ExecutiveAreaKey,
  ExecutiveBIResponse,
  ExecutiveDecisionItem,
} from "@/lib/types/executive-bi";
import type { DateRangeParam } from "@/lib/types/financial-bi";

const DATE_RANGE_OPTIONS: Array<{ value: DateRangeParam; label: string }> = [
  { value: "thisMonth", label: "MTD" },
  { value: "lastMonth", label: "Last month" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "last90", label: "Last 90 days" },
  { value: "thisYear", label: "This year" },
  { value: "allTime", label: "All time" },
  { value: "custom", label: "Custom range" },
];

function buildExecutiveParams(dateRange: DateRangeParam, from?: string, to?: string) {
  const params = new URLSearchParams();
  params.set("dateRange", dateRange);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return params;
}

function withPreservedWindow(href: string, dateRange: DateRangeParam, from?: string, to?: string) {
  const url = new URL(href, "https://carreirausa.local");
  url.searchParams.set("dateRange", dateRange);
  if (from) {
    url.searchParams.set("from", from);
  } else {
    url.searchParams.delete("from");
  }
  if (to) {
    url.searchParams.set("to", to);
  } else {
    url.searchParams.delete("to");
  }
  return `${url.pathname}${url.search}`;
}

function buildBusinessStory(health: ExecutiveBIResponse["overview"]["health"], decisions: ExecutiveDecisionItem[]) {
  const topDecision = decisions[0];
  const revenueTone = `revenue in the active window is ${Math.round(health.revenue).toLocaleString()} dollars`;
  const openArTone = `open AR is ${Math.round(health.openAr).toLocaleString()} dollars`;
  const collectionsTone = `collections rate is ${health.collectionsRate.toFixed(1)} percent`;

  if (topDecision) {
    return `${revenueTone}, ${openArTone}, and ${collectionsTone}. The immediate executive pressure is ${topDecision.title.toLowerCase()}.`;
  }

  return `${revenueTone}, ${openArTone}, and ${collectionsTone}. No urgent executive decision is active right now.`;
}

function isExecutiveAreaKey(value: string | null): value is ExecutiveAreaKey {
  return value === "finance" || value === "sales" || value === "operations" || value === "ai";
}

export default function ExecutiveCockpitPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const dateRange = (searchParams.get("dateRange") || "last30") as DateRangeParam;
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const areaParam = searchParams.get("area");
  const activeArea = isExecutiveAreaKey(areaParam) ? areaParam : null;

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<ExecutiveBIResponse>({
    queryKey: ["executive-bi", dateRange, from, to],
    queryFn: async () => {
      const params = buildExecutiveParams(dateRange, from, to);
      const response = await fetch(`/api/analytics/executive-bi?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch executive BI");
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const handleDateRangeChange = (nextDateRange: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("dateRange", nextDateRange);
    if (nextDateRange !== "custom") {
      params.delete("from");
      params.delete("to");
    }
    router.push(`/dashboard/bi?${params.toString()}`);
  };

  const windowAwareData = data
    ? {
        ...data,
        overview: {
          ...data.overview,
          decisionQueue: data.overview.decisionQueue.map((item) => ({
            ...item,
            href: withPreservedWindow(item.href, dateRange, from, to),
          })),
        },
        areas: {
          finance: {
            ...data.areas.finance,
            href: withPreservedWindow(data.areas.finance.href, dateRange, from, to),
          },
          sales: {
            ...data.areas.sales,
            href: withPreservedWindow(data.areas.sales.href, dateRange, from, to),
          },
          operations: {
            ...data.areas.operations,
            href: withPreservedWindow(data.areas.operations.href, dateRange, from, to),
          },
          ai: {
            ...data.areas.ai,
            href: withPreservedWindow(data.areas.ai.href, dateRange, from, to),
          },
        },
      }
    : null;

  const activeSummary = activeArea && windowAwareData ? windowAwareData.areas[activeArea] : undefined;
  const activeDetail = activeArea && data ? data.areaDetails[activeArea] : undefined;
  const businessStory = windowAwareData
    ? buildBusinessStory(windowAwareData.overview.health, windowAwareData.overview.decisionQueue)
    : "";
  const fallbackWindow = buildExecutiveParams(dateRange, from, to).toString();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-verde/55">
              Unified Executive BI
            </div>
            <h1 className="mt-2 font-display text-3xl font-bold text-brand-verde">
              BI Executivo
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
              One executive home for QuickBooks finance, Clint commercial/client context, and operational delivery visibility.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <select
              value={dateRange}
              onChange={(event) => handleDateRangeChange(event.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-brand-verde focus:border-brand-verde focus:outline-none focus:ring-1 focus:ring-brand-verde"
            >
              {DATE_RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-brand-verde transition hover:bg-brand-verde/5 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/dashboard/financial?${fallbackWindow}`}
            className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-brand-verde ring-1 ring-gray-200 transition hover:bg-brand-verde/5"
          >
            Finance deep dive
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href={`/dashboard/insights?${fallbackWindow}`}
            className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-brand-verde ring-1 ring-gray-200 transition hover:bg-brand-verde/5"
          >
            QuickBooks diagnostics
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href={`/dashboard/deals`}
            className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-brand-verde ring-1 ring-gray-200 transition hover:bg-brand-verde/5"
          >
            Clint / CRM detail
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/ops/pipeline"
            className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-brand-verde ring-1 ring-gray-200 transition hover:bg-brand-verde/5"
          >
            Ops detail
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          {dateRange === "custom" && (from || to) ? (
            <span className="rounded-full bg-brand-tangerina/10 px-3 py-1.5 text-sm font-medium text-brand-tangerina">
              Custom window {from ?? "start"} to {to ?? "now"}
            </span>
          ) : null}
        </div>

        {isError ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-red-700 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Failed to load executive BI</p>
                <p className="mt-1 text-sm text-red-600">
                  {error instanceof Error ? error.message : "Please try again."}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {isLoading || !windowAwareData ? (
          <div className="space-y-4">
            <div className="h-64 animate-pulse rounded-[28px] bg-gray-200" />
            <div className="h-64 animate-pulse rounded-2xl bg-gray-200" />
            <div className="grid gap-4 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-2xl bg-gray-200" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <ExecutiveHero overview={windowAwareData.overview} />
            <DecisionQueue items={windowAwareData.overview.decisionQueue} />
            <ExecutiveHealthBand health={windowAwareData.overview.health} />

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
              <RiskMap items={windowAwareData.overview.decisionQueue} />
              <aside className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-verde/55">
                  Business Health Story
                </div>
                <h2 className="mt-2 font-display text-2xl font-bold text-brand-verde">
                  What the numbers mean together
                </h2>
                <p className="mt-4 text-sm leading-7 text-gray-600">{businessStory}</p>
                <div className="mt-6 rounded-2xl bg-brand-tangerina/8 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-tangerina">
                    Data health
                  </div>
                  <p className="mt-2 text-sm leading-6 text-brand-verde">
                    {windowAwareData.overview.freshness.summary}
                  </p>
                </div>
              </aside>
            </section>

            <AreaEntryGrid areas={windowAwareData.areas} activeArea={activeArea} />

            {activeArea && activeDetail ? (
              <ExecutiveAreaPanel detail={activeDetail} summary={activeSummary} />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
