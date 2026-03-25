"use client";

import * as React from "react";
import { hubChangelog as changelog, APP_VERSION, type ChangelogEntry } from "@/lib/changelog";

type Lang = "en" | "pt" | "pt-BR";

const typeLabels = {
  feature: { en: "New", pt: "Novo" },
  improvement: { en: "Improved", pt: "Melhorado" },
  fix: { en: "Fixed", pt: "Corrigido" },
} as const;

const typeColors = {
  feature: "bg-emerald-50 text-emerald-600",
  improvement: "bg-blue-50 text-blue-600",
  fix: "bg-amber-50 text-amber-600",
} as const;

export function NewsNotification({ lang }: { lang: Lang }) {
  const labelLang = lang.startsWith("pt") ? "pt" : "en" as const;
  const [open, setOpen] = React.useState(false);
  const [lastSeen, setLastSeen] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setLastSeen(localStorage.getItem("hub-news-last-seen"));
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const hasUnread = lastSeen !== APP_VERSION;

  const handleOpen = () => {
    setOpen((prev) => !prev);
    if (!open) {
      localStorage.setItem("hub-news-last-seen", APP_VERSION);
      setLastSeen(APP_VERSION);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        title={lang.startsWith("pt") ? "Novidades" : "What's New"}
        aria-label={lang.startsWith("pt") ? "Novidades" : "What's New"}
      >
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-brand-tangerina rounded-full" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 max-h-[400px] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">
              {lang.startsWith("pt") ? "Novidades" : "What's New"}
            </h3>
            <span className="text-[10px] text-gray-400">v{APP_VERSION}</span>
          </div>

          <div className="overflow-y-auto max-h-[340px] divide-y divide-gray-50">
            {changelog.map((entry) => (
              <div key={entry.version} className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-900">
                    {lang.startsWith("pt") && entry.titlePt ? entry.titlePt : entry.title}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(entry.date + "T00:00:00").toLocaleDateString(
                      lang.startsWith("pt") ? "pt-BR" : "en-US",
                      { month: "short", day: "numeric" }
                    )}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {entry.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium flex-shrink-0 mt-0.5 ${typeColors[item.type]}`}>
                        {typeLabels[item.type][labelLang]}
                      </span>
                      <span className="text-xs text-gray-600 leading-relaxed">
                        {lang.startsWith("pt") && item.textPt ? item.textPt : item.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
