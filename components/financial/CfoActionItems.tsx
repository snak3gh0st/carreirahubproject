"use client";

import { CfoAction } from "@/lib/types/financial-bi";
import Link from "next/link";

interface CfoActionItemsProps {
  actions: CfoAction[];
}

const severityConfig = {
  URGENT: { bg: "bg-red-50", border: "border-l-red-500", label: "URGENT", labelColor: "text-red-600" },
  WATCH: { bg: "bg-amber-50", border: "border-l-amber-500", label: "WATCH", labelColor: "text-amber-600" },
  INSIGHT: { bg: "bg-blue-50", border: "border-l-blue-500", label: "INSIGHT", labelColor: "text-blue-600" },
};

export function CfoActionItems({ actions }: CfoActionItemsProps) {
  if (actions.length === 0) return null;

  return (
    <div className="rounded-xl border-2 border-brand-tangerina bg-white p-4">
      <div className="mb-3 text-xs font-bold uppercase tracking-wider text-brand-tangerina">
        Recommended Actions ({actions.length})
      </div>
      <div className="flex flex-col gap-2">
        {actions.map((action, i) => {
          const config = severityConfig[action.severity];
          return (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-md border-l-[3px] ${config.border} ${config.bg} px-3 py-2.5`}
            >
              <span className={`shrink-0 text-[11px] font-bold ${config.labelColor}`}>
                {config.label}
              </span>
              <p className="flex-1 text-xs text-gray-700">{action.description}</p>
              {action.linkedEntity && (
                <Link
                  href={
                    action.linkedEntity.type === "invoice"
                      ? `/dashboard/invoices?id=${action.linkedEntity.id}`
                      : `/dashboard/customers?id=${action.linkedEntity.id}`
                  }
                  className="shrink-0 text-xs font-semibold text-brand-tangerina hover:underline"
                >
                  View →
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
