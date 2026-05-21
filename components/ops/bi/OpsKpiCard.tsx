import type { LucideIcon } from "lucide-react";

export function OpsKpiCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon: LucideIcon;
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "ai";
}) {
  const tones = {
    neutral: "bg-gray-50 text-gray-700",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-700",
    info: "bg-blue-50 text-blue-700",
    ai: "bg-purple-50 text-purple-700",
  } as const;

  return (
    <div className="min-w-0 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</p>
          <p className="mt-2 break-words text-2xl font-display font-bold text-gray-900">{value}</p>
          {detail && <p className="mt-1 break-words text-xs text-gray-500">{detail}</p>}
        </div>
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
