"use client";

import { AlertTriangle, CheckCircle2, Clock3, MinusCircle } from "lucide-react";

interface WorkflowStep {
  title: string;
  status: "completed" | "current" | "pending" | "failed";
  date?: Date | null;
  description?: string;
  note?: string | null;
}

interface WorkflowTimelineProps {
  steps: WorkflowStep[];
}

export function WorkflowTimeline({ steps }: WorkflowTimelineProps) {
  const businessTimeZone = "America/Sao_Paulo";

  const getStatusMeta = (status: WorkflowStep["status"]) => {
    switch (status) {
      case "completed":
        return {
          icon: CheckCircle2,
          iconWrap: "bg-emerald-100 text-emerald-700",
          card: "border-emerald-100 bg-emerald-50/60 shadow-emerald-100/60",
          title: "text-emerald-900",
          badge: "bg-emerald-100 text-emerald-700",
          badgeLabel: "Concluido",
        };
      case "current":
        return {
          icon: Clock3,
          iconWrap: "bg-blue-100 text-blue-700",
          card: "border-blue-100 bg-blue-50/60 shadow-blue-100/60",
          title: "text-blue-900",
          badge: "bg-blue-100 text-blue-700",
          badgeLabel: "Em andamento",
        };
      case "failed":
        return {
          icon: AlertTriangle,
          iconWrap: "bg-red-100 text-red-700",
          card: "border-red-100 bg-red-50/60 shadow-red-100/60",
          title: "text-red-900",
          badge: "bg-red-100 text-red-700",
          badgeLabel: "Falha",
        };
      default:
        return {
          icon: MinusCircle,
          iconWrap: "bg-gray-100 text-gray-500",
          card: "border-gray-200 bg-gray-50/80 shadow-sm",
          title: "text-gray-700",
          badge: "bg-gray-100 text-gray-600",
          badgeLabel: "Pendente",
        };
    }
  };

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {steps.map((step, stepIdx) => (
          <div key={step.title}>
            {(() => {
              const styles = getStatusMeta(step.status);
              const StatusIcon = styles.icon;

              return (
                <div className={`h-full rounded-2xl border p-4 shadow-sm ${styles.card}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${styles.iconWrap}`}>
                        <StatusIcon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`text-sm font-semibold ${styles.title}`}>{step.title}</p>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles.badge}`}>
                            {styles.badgeLabel}
                          </span>
                        </div>
                        {step.description && (
                          <p className="mt-1 text-sm text-gray-600">{step.description}</p>
                        )}
                        {step.note && (
                          <p className="mt-2 text-xs leading-5 text-gray-500">{step.note}</p>
                        )}
                      </div>
                    </div>

                    {step.date && (
                      <div className="shrink-0 text-xs font-medium text-gray-500 text-right">
                        {new Date(step.date).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: businessTimeZone,
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        ))}
    </div>
  );
}
