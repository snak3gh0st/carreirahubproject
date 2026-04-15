"use client";
import type { PersonaDefinition } from "@/lib/ai/personas";
import { resolveIcon } from "@/lib/ai/persona-icons";

export function PersonaChip({
  persona,
  onRun,
  disabled,
}: {
  persona: PersonaDefinition;
  onRun: () => void;
  disabled?: boolean;
}) {
  const Icon = resolveIcon(persona.icon);
  return (
    <button
      type="button"
      onClick={onRun}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-medium text-[#10251e] shadow-sm transition hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
      title={persona.tagline}
    >
      <Icon className="h-3.5 w-3.5 text-primary" />
      {persona.label}
    </button>
  );
}
