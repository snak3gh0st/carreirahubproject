import { Sparkles, ShieldCheck, TriangleAlert } from "lucide-react";

import type { ExecutiveOverview } from "@/lib/types/executive-bi";

import { getFreshnessTone } from "@/components/executive-bi/ui";

export function ExecutiveHero({
  overview,
}: {
  overview: Pick<ExecutiveOverview, "briefing" | "freshness" | "decisionQueue">;
}) {
  const topDecision = overview.decisionQueue[0];
  const topSeverityIcon = topDecision?.severity === "high" ? TriangleAlert : ShieldCheck;
  const TopSeverityIcon = topSeverityIcon;

  return (
    <section className="overflow-hidden rounded-[28px] border border-emerald-950/35 bg-[radial-gradient(circle_at_top_left,_rgba(110,231,183,0.16),_transparent_34%),linear-gradient(135deg,_#0f172a_0%,_#134e4a_52%,_#052e2b_100%)] text-white shadow-[0_18px_40px_rgba(15,23,42,0.24)]">
      <div className="grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.95fr)] lg:px-8 lg:py-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Executive Flight Deck
          </div>
          <h1 className="mt-4 max-w-3xl font-display text-3xl font-bold leading-tight text-white lg:text-[2.55rem]">
            CEO Business Health
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-50 lg:text-[15px]">
            {overview.briefing}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full border border-white/14 px-3 py-1 text-xs font-semibold shadow-sm ${getFreshnessTone(overview.freshness.state)}`}
            >
              {overview.freshness.summary}
            </span>
            {topDecision ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/6 px-3 py-1 text-xs font-medium text-slate-50">
                <TopSeverityIcon className="h-3.5 w-3.5" />
                Next decision: {topDecision.title}
              </span>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-white/14 bg-slate-950/62 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
            Executive Signal
          </div>
          {topDecision ? (
            <>
              <div className="mt-3 flex items-start gap-3">
                <div className="mt-0.5 rounded-2xl border border-white/12 bg-white/8 p-2.5">
                  <TopSeverityIcon className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{topDecision.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">{topDecision.impact}</p>
                </div>
              </div>
              <div className="mt-5 rounded-2xl border border-white/12 bg-black/22 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                  Suggested next step
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-100">{topDecision.suggestedAction}</p>
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-2xl border border-white/12 bg-black/22 p-4 text-sm leading-6 text-slate-200">
              No urgent executive decisions are active right now. Use the KPI band and area cards below to inspect movement by domain.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default ExecutiveHero;
