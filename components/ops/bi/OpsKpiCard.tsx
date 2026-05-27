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
  const accent =
    tone === "danger" || tone === "warning"
      ? "text-brand-tangerina"
      : tone === "ai"
        ? "text-brand-verde"
        : "text-gray-900";

  return (
    <div className="min-w-0 rounded-xl border border-gray-200/60 bg-white px-4 py-4">
      <div className="flex items-start gap-3">
        <Icon className="h-4 w-4 flex-shrink-0 text-gray-400" strokeWidth={1.75} />
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
          {label}
        </p>
      </div>
      <p
        className={`mt-2 break-words text-[24px] font-semibold leading-none tabular-nums ${accent}`}
      >
        {value}
      </p>
      {detail && (
        <p className="mt-1.5 break-words text-[12px] text-gray-500 tabular-nums">{detail}</p>
      )}
    </div>
  );
}
