"use client";
import { RefreshCw } from "lucide-react";
import type { PersonaDefinition } from "@/lib/ai/personas";

export function PersonaMessageMeta({
  persona,
  fromCache,
  onRefresh,
  disabled,
}: {
  persona: PersonaDefinition;
  fromCache: boolean;
  onRefresh: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
        {persona.label}
      </span>
      <span>{fromCache ? "Cache" : "Live"}</span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={disabled}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 hover:bg-black/5 disabled:opacity-50"
        title="Rodar nova análise agora"
      >
        <RefreshCw className="h-3 w-3" /> Atualizar
      </button>
    </div>
  );
}
