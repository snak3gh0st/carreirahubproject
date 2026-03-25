"use client";

import * as React from "react";
import { Bell, X, Sparkles, Wrench, Bug } from "lucide-react";
import { changelog, APP_VERSION, type ChangelogEntry } from "@/lib/changelog";

const typeConfig = {
  feature: { icon: Sparkles, color: "text-emerald-500", bg: "bg-emerald-50", label: "New" },
  improvement: { icon: Wrench, color: "text-blue-500", bg: "bg-blue-50", label: "Improved" },
  fix: { icon: Bug, color: "text-amber-500", bg: "bg-amber-50", label: "Fixed" },
} as const;

export function NewsNotification() {
  const [open, setOpen] = React.useState(false);
  const [lastSeen, setLastSeen] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setLastSeen(localStorage.getItem("news-last-seen"));
  }, []);

  // Close on outside click
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
      localStorage.setItem("news-last-seen", APP_VERSION);
      setLastSeen(APP_VERSION);
    }
  };

  return (
    <div ref={ref} className="relative">
      {/* Bell Button */}
      <button
        onClick={handleOpen}
        className="relative p-2 text-gray-300 hover:text-white hover:bg-secondary-gray rounded-lg transition-colors"
        title="What's New"
        aria-label="What's New"
      >
        <Bell className="h-5 w-5" />
        {hasUnread && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-brand-tangerina rounded-full border-2 border-brand-verde" />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-full bottom-0 ml-3 w-80 max-h-[480px] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">What&apos;s New</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">v{APP_VERSION}</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Entries */}
          <div className="overflow-y-auto max-h-[400px] divide-y divide-gray-50">
            {changelog.map((entry) => (
              <ChangelogSection key={entry.version} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChangelogSection({ entry }: { entry: ChangelogEntry }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-900">{entry.title}</span>
        <span className="text-[10px] text-gray-400">{formatDate(entry.date)}</span>
      </div>
      <div className="space-y-1.5">
        {entry.items.map((item, i) => {
          const config = typeConfig[item.type];
          const Icon = config.icon;
          return (
            <div key={i} className="flex items-start gap-2">
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${config.color} ${config.bg} flex-shrink-0 mt-0.5`}>
                <Icon className="h-2.5 w-2.5" />
                {config.label}
              </span>
              <span className="text-xs text-gray-600 leading-relaxed">{item.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
