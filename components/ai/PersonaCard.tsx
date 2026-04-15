"use client";
import * as icons from "lucide-react";
import type { PersonaDefinition } from "@/lib/ai/personas";

function resolveIcon(name: string): React.ComponentType<{ className?: string }> {
  const Icon = (icons as any)[name] ?? icons.Sparkles;
  return Icon as any;
}

function formatFreshness(lastGeneratedAt?: Date | null): string {
  if (!lastGeneratedAt) return "nunca executado";
  const mins = Math.round((Date.now() - lastGeneratedAt.getTime()) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.round(hours / 24);
  return `há ${days}d`;
}

export function PersonaCard({
  persona,
  lastGeneratedAt,
  onRun,
  disabled,
}: {
  persona: PersonaDefinition;
  lastGeneratedAt?: Date | null;
  onRun: () => void;
  disabled?: boolean;
}) {
  const Icon = resolveIcon(persona.icon);
  return (
    <div className="mx-auto w-full max-w-[520px] rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_20px_60px_rgba(23,53,44,0.08)]">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          <Icon className="h-7 w-7" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-[#10251e]">{persona.label}</h3>
          <p className="mt-1 text-sm text-[#24342d]/80">{persona.tagline}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            Última leitura: {formatFreshness(lastGeneratedAt ?? null)}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRun}
        disabled={disabled}
        className="mt-5 w-full rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-sm transition hover:brightness-105 disabled:opacity-50"
      >
        Rodar {persona.label.toLowerCase()}
      </button>
    </div>
  );
}
