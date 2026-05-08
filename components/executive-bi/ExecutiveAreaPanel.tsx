import Link from "next/link";
import { ArrowRight, CircleDot, ExternalLink } from "lucide-react";

import type {
  ExecutiveAreaDrillDown,
  ExecutiveAreaKey,
  ExecutiveAreaSummary,
} from "@/lib/types/executive-bi";

import {
  getAreaStatusTone,
  getExecutiveAreaLabel,
  getFreshnessTone,
} from "@/components/executive-bi/ui";

export function ExecutiveAreaPanel({
  detail,
  summary,
}: {
  detail: ExecutiveAreaDrillDown;
  summary?: ExecutiveAreaSummary;
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-verde/55">
            {getExecutiveAreaLabel(detail.area)} Drill-down
          </div>
          <h2 className="mt-2 font-display text-2xl font-bold text-brand-verde">
            {getExecutiveAreaLabel(detail.area)} focus
          </h2>
          <p className="mt-4 text-sm leading-7 text-gray-600">{detail.summary}</p>
        </div>

        {summary ? (
          <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${getAreaStatusTone(summary.status)}`}
              >
                {summary.status}
              </span>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${getFreshnessTone(summary.freshness.state)}`}
              >
                {summary.freshness.summary}
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between gap-6">
              <div>
                <div className="text-xs font-medium text-gray-400">Signals</div>
                <div className="mt-1 text-lg font-semibold text-gray-900">{summary.signalCount ?? detail.bullets.length}</div>
              </div>
              <Link
                href={summary.href}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-brand-verde transition hover:border-brand-verde/20 hover:bg-brand-verde/5"
              >
                Open route
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
            {summary.metrics?.length ? (
              <div className="mt-4 grid gap-2">
                {summary.metrics.map((metric) => (
                  <div key={`${summary.label}-${metric.label}`} className="rounded-xl border border-gray-100 bg-white px-3 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                      {metric.label}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-gray-900">{metric.value}</div>
                    {metric.helper ? (
                      <div className="mt-1 text-xs leading-5 text-gray-500">{metric.helper}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-3">
        {detail.bullets.length > 0 ? (
          detail.bullets.map((bullet) => (
            <div
              key={bullet}
              className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-gradient-to-r from-brand-verde/5 to-white px-4 py-3"
            >
              <div className="mt-0.5 rounded-full bg-brand-tangerina/15 p-1 text-brand-tangerina">
                <CircleDot className="h-3.5 w-3.5" />
              </div>
              <p className="text-sm leading-6 text-gray-700">{bullet}</p>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            No contextual bullets are available for this area yet.
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-tangerina/8 px-4 py-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-tangerina">
            Executive continuity
          </div>
          <p className="mt-2 text-sm leading-6 text-brand-verde">
            This panel keeps the same executive context while moving into the selected area.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 text-sm font-medium text-brand-verde">
          Continue investigation
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </section>
  );
}

export default ExecutiveAreaPanel;
