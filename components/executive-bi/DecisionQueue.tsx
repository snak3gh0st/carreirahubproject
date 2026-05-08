import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";

import type { ExecutiveDecisionItem } from "@/lib/types/executive-bi";

import { getDecisionSeverityTone, getExecutiveAreaLabel } from "@/components/executive-bi/ui";

export function DecisionQueue({
  items,
}: {
  items: ExecutiveDecisionItem[];
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-verde/55">
            Decision Queue
          </div>
          <h2 className="mt-2 font-display text-2xl font-bold text-brand-verde">
            What needs a CEO decision now
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-gray-500">
          Ranked by business impact, not by dashboard category.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {items.length > 0 ? (
          items.map((item, index) => (
            <article
              key={item.id}
              className="rounded-2xl border border-gray-100 bg-gradient-to-r from-white to-brand-verde/5 p-4 transition-colors hover:border-brand-verde/15"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-verde/8 text-sm font-bold text-brand-verde">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getDecisionSeverityTone(item.severity)}`}
                      >
                        {item.severity}
                      </span>
                      <span className="text-xs font-medium uppercase tracking-[0.16em] text-gray-400">
                        {getExecutiveAreaLabel(item.area)}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-gray-900">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-gray-600">{item.impact}</p>
                  </div>
                </div>
                <Link
                  href={item.href}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-brand-verde transition hover:border-brand-verde/25 hover:bg-brand-verde/5"
                >
                  Open
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="mt-4 rounded-2xl bg-brand-tangerina/8 px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-tangerina">
                  <ArrowRight className="h-3.5 w-3.5" />
                  Suggested action
                </div>
                <p className="mt-2 text-sm leading-6 text-brand-verde">{item.suggestedAction}</p>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            No executive decisions are queued right now.
          </div>
        )}
      </div>
    </section>
  );
}

export default DecisionQueue;
