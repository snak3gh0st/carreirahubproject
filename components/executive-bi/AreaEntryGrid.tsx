import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";

import type { ExecutiveAreaKey, ExecutiveAreaSummary } from "@/lib/types/executive-bi";

import {
  EXECUTIVE_AREA_ORDER,
  getAreaStatusTone,
  getExecutiveAreaLabel,
  getFreshnessTone,
} from "@/components/executive-bi/ui";

export function AreaEntryGrid({
  areas,
  activeArea,
}: {
  areas: Record<ExecutiveAreaKey, ExecutiveAreaSummary>;
  activeArea?: ExecutiveAreaKey | null;
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-verde/55">
            Business Layers
          </div>
          <h2 className="mt-2 font-display text-2xl font-bold text-brand-verde">
            Commercial, client, operations, and AI context
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-gray-500">
          Finance stays in the KPI band above. These cards explain the commercial and operational layers that sit under the QuickBooks truth.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {EXECUTIVE_AREA_ORDER.map((areaKey) => {
          const area = areas[areaKey];
          const isActive = activeArea === areaKey;

          return (
            <Link
              key={areaKey}
              href={area.href}
              className={`group rounded-2xl border p-5 shadow-sm transition-all ${
                isActive
                  ? "border-brand-tangerina bg-brand-tangerina/5"
                  : "border-gray-100 bg-white hover:border-brand-verde/15 hover:shadow-md"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                    {getExecutiveAreaLabel(areaKey)}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${getAreaStatusTone(area.status)}`}
                    >
                      {area.status}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${getFreshnessTone(area.freshness.state)}`}
                    >
                      {area.freshness.state}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4.5 w-4.5 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-verde" />
              </div>

              <p className="mt-4 text-sm leading-6 text-gray-600">{area.summary}</p>

              {area.metrics?.length ? (
                <div className="mt-4 grid gap-2">
                  {area.metrics.slice(0, 4).map((metric) => (
                    <div key={`${areaKey}-${metric.label}`} className="rounded-xl bg-gray-50 px-3 py-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                        {metric.label}
                      </div>
                      <div className="mt-1 text-base font-semibold text-gray-900">{metric.value}</div>
                      {metric.helper ? (
                        <div className="mt-1 text-xs leading-5 text-gray-500">{metric.helper}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-5 flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
                <div>
                  <p className="text-xs font-medium text-gray-400">Signal count</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{area.signalCount ?? 0}</p>
                </div>
                <div className="inline-flex items-center gap-2 text-sm font-medium text-brand-verde">
                  Explore area
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default AreaEntryGrid;
