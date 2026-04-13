"use client";

import { CfoInsightData } from "@/lib/types/financial-bi";

interface CfoBriefingProps {
  insight: CfoInsightData;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function CfoBriefing({ insight, onRefresh, isRefreshing }: CfoBriefingProps) {
  return (
    <div className="rounded-xl bg-gradient-to-r from-gray-900 to-gray-800 p-5 text-white">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-tangerina text-sm">
            🧠
          </div>
          <span className="text-sm font-bold">CFO Briefing</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            Generated {new Date(insight.generatedAt).toLocaleDateString()}
          </span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="rounded-md bg-gray-700 px-3 py-1 text-xs text-gray-300 transition hover:bg-gray-600 disabled:opacity-50"
            >
              {isRefreshing ? "Generating..." : "Refresh Analysis"}
            </button>
          )}
        </div>
      </div>
      <p className="text-sm leading-relaxed text-gray-200">{insight.briefing}</p>
    </div>
  );
}
