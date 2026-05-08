import { AlertTriangle, ShieldCheck } from "lucide-react";

import type { ExecutiveDecisionItem } from "@/lib/types/executive-bi";

import {
  EXECUTIVE_AREA_ORDER,
  getDecisionSeverityTone,
  getExecutiveAreaLabel,
} from "@/components/executive-bi/ui";

const SEVERITY_SCORE: Record<ExecutiveDecisionItem["severity"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function RiskMap({
  items,
}: {
  items: ExecutiveDecisionItem[];
}) {
  const byArea = EXECUTIVE_AREA_ORDER.map((area) => {
    const matches = items.filter((item) => item.area === area);
    const top = matches.reduce<ExecutiveDecisionItem | null>((current, item) => {
      if (!current) return item;
      return SEVERITY_SCORE[item.severity] > SEVERITY_SCORE[current.severity] ? item : current;
    }, null);
    return { area, top, count: matches.length };
  });

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-verde/55">
            Risk Map
          </div>
          <h2 className="mt-2 font-display text-2xl font-bold text-brand-verde">
            Cross-area threat scan
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-gray-500">
          The point is not to show every issue. It is to show what can hurt the business soon.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {byArea.map(({ area, top, count }) => (
          <article
            key={area}
            className="rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-gray-50/70 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                  {getExecutiveAreaLabel(area)}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {top ? (
                    <>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${getDecisionSeverityTone(top.severity)}`}
                      >
                        {top.severity}
                      </span>
                      <span className="text-xs text-gray-400">
                        {count} active signal{count === 1 ? "" : "s"}
                      </span>
                    </>
                  ) : (
                    <span className="inline-flex rounded-full bg-brand-verde/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-verde">
                      clear
                    </span>
                  )}
                </div>
              </div>
              <div className={`rounded-2xl p-2.5 ${top ? "bg-red-50 text-red-600" : "bg-brand-verde/10 text-brand-verde"}`}>
                {top ? <AlertTriangle className="h-4.5 w-4.5" /> : <ShieldCheck className="h-4.5 w-4.5" />}
              </div>
            </div>

            <div className="mt-4">
              {top ? (
                <>
                  <h3 className="text-sm font-semibold text-gray-900">{top.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{top.impact}</p>
                </>
              ) : (
                <p className="text-sm leading-6 text-gray-500">
                  No immediate executive risk is active in this area.
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default RiskMap;
