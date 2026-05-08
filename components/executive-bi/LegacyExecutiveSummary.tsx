import type { ReactNode } from "react";

import type { LegacyExecutiveCard } from "@/lib/executive-bi/legacy-summary";

interface LegacyExecutiveSummaryProps {
  eyebrow?: string;
  title: string;
  subtitle: string;
  status?: string;
  cards: LegacyExecutiveCard[];
  actions?: ReactNode;
  loading?: boolean;
}

export function LegacyExecutiveSummary({
  eyebrow = "Legacy Detail Surface",
  title,
  subtitle,
  status,
  cards,
  actions,
  loading = false,
}: LegacyExecutiveSummaryProps) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-emerald-950/35 bg-[radial-gradient(circle_at_top_left,_rgba(110,231,183,0.14),_transparent_34%),linear-gradient(135deg,_#0f172a_0%,_#134e4a_52%,_#052e2b_100%)] text-white shadow-[0_18px_40px_rgba(15,23,42,0.2)]">
      <div className="grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.85fr)] lg:px-8 lg:py-8">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-200">
            {eyebrow}
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-white lg:text-[2.4rem]">
            {title}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-50 lg:text-[15px]">
            {subtitle}
          </p>
          {status ? (
            <div className="mt-5 inline-flex rounded-full border border-white/14 bg-white/6 px-3 py-1.5 text-xs font-medium text-slate-100">
              {status}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col justify-between gap-4 rounded-3xl border border-white/14 bg-slate-950/62 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
              Shared KPI Layer
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-200">
              These cards stay pinned to the canonical executive BI response so this legacy surface does not drift from the cockpit.
            </p>
          </div>

          {actions ? (
            <div className="flex flex-wrap items-center gap-2">
              {actions}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 border-t border-white/12 bg-black/16 px-6 py-5 md:grid-cols-2 xl:grid-cols-5 lg:px-8">
        {loading
          ? Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-white/12 bg-slate-950/44 px-4 py-4"
              >
                <div className="h-3 w-24 animate-pulse rounded bg-white/18" />
                <div className="mt-4 h-8 w-28 animate-pulse rounded bg-white/18" />
                <div className="mt-4 h-3 w-32 animate-pulse rounded bg-white/18" />
              </div>
            ))
          : cards.length > 0
            ? cards.map((card) => (
              <article
                key={card.label}
                className="rounded-2xl border border-white/12 bg-slate-950/44 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                  {card.label}
                </div>
                <p className="mt-3 font-display text-[1.85rem] font-bold leading-none text-white">
                  {card.value}
                </p>
                <p className="mt-4 text-sm leading-6 text-slate-200">{card.helper}</p>
              </article>
              ))
            : (
              <div className="rounded-2xl border border-white/12 bg-slate-950/44 px-4 py-4 text-sm leading-6 text-slate-200 md:col-span-2 xl:col-span-5">
                Canonical executive KPI cards are temporarily unavailable. Use the cockpit links above to retry or continue in the deeper financial tabs below.
              </div>
            )}
      </div>
    </section>
  );
}

export default LegacyExecutiveSummary;
