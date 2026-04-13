"use client";

import { CfoInsightData } from "@/lib/types/financial-bi";

interface CfoBriefingProps {
  insight: CfoInsightData;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

function renderBriefingSection(text: string) {
  // Split by markdown-style headers (**Header**\n) into sections
  const parts = text.split(/\n\*\*([^*]+)\*\*\n/);

  if (parts.length <= 1) {
    // No sections found — render as plain text
    return <p className="text-sm leading-relaxed text-gray-200">{text}</p>;
  }

  const sections: Array<{ title?: string; content: string }> = [];
  // First part is the executive summary (no header)
  if (parts[0].trim()) {
    sections.push({ content: parts[0].trim() });
  }
  // Subsequent parts alternate: title, content, title, content
  for (let i = 1; i < parts.length; i += 2) {
    sections.push({
      title: parts[i],
      content: parts[i + 1]?.trim() || "",
    });
  }

  return (
    <div className="space-y-4">
      {sections.map((section, i) => (
        <div key={i}>
          {section.title && (
            <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-brand-tangerina">
              {section.title}
            </h4>
          )}
          <p className={`text-sm leading-relaxed ${i === 0 ? "text-white" : "text-gray-300"}`}>
            {section.content}
          </p>
        </div>
      ))}
    </div>
  );
}

function renderRecommendation(text: string, index: number) {
  // Check if it's a section header (starts with **)
  const isHeader = text.startsWith("**") && text.endsWith("**");
  if (isHeader) {
    return (
      <div key={index} className={`${index > 0 ? "mt-3 border-t border-white/10 pt-3" : ""}`}>
        <div className="text-xs font-bold uppercase tracking-wider text-brand-tangerina">
          {text.replace(/\*\*/g, "")}
        </div>
      </div>
    );
  }

  return (
    <div key={index} className="flex gap-2 text-sm leading-relaxed text-gray-200">
      <span className="shrink-0 text-brand-tangerina">•</span>
      <span>{text}</span>
    </div>
  );
}

export function CfoBriefing({ insight, onRefresh, isRefreshing }: CfoBriefingProps) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-gray-900 via-gray-850 to-gray-800 p-6 text-white shadow-lg">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-tangerina text-base">
            🧠
          </div>
          <div>
            <span className="text-sm font-bold">Fractional CFO Analysis</span>
            <span className="ml-2 rounded bg-brand-tangerina/20 px-1.5 py-0.5 text-[10px] text-brand-tangerina">
              AI-Powered
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-500">
            {new Date(insight.generatedAt).toLocaleString()}
          </span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="rounded-md bg-gray-700 px-3 py-1 text-xs text-gray-300 transition hover:bg-gray-600 disabled:opacity-50"
            >
              {isRefreshing ? "Analyzing..." : "Refresh Analysis"}
            </button>
          )}
        </div>
      </div>

      {/* Briefing Content (structured sections) */}
      {renderBriefingSection(insight.briefing)}

      {/* Recommendations */}
      {insight.recommendations.length > 0 && (
        <div className="mt-5 space-y-1.5 border-t border-white/10 pt-4">
          {insight.recommendations.map((rec, i) => renderRecommendation(rec, i))}
        </div>
      )}
    </div>
  );
}
