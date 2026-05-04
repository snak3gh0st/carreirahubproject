"use client";

import { useState } from "react";
import { Check, Clipboard, Loader2 } from "lucide-react";

type CopyQbInvoiceLinkButtonProps = {
  invoiceId: string;
  cachedLink?: string | null;
  disabled?: boolean;
  compact?: boolean;
};

export function CopyQbInvoiceLinkButton({
  invoiceId,
  cachedLink,
  disabled = false,
  compact = false,
}: CopyQbInvoiceLinkButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "error">("idle");

  async function copyLink() {
    if (disabled || state === "loading") return;

    setState("loading");
    try {
      let link = cachedLink;

      if (!link) {
        const response = await fetch(`/api/invoices/${invoiceId}/quickbooks-link`, {
          method: "GET",
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok || !data.link) {
          throw new Error(data.error || "Nao foi possivel obter o link da invoice");
        }

        link = data.link;
      }

      if (!link) {
        throw new Error("Nao foi possivel obter o link da invoice");
      }

      await navigator.clipboard.writeText(link);
      setState("copied");
      window.setTimeout(() => setState("idle"), 1800);
    } catch (error) {
      console.error("[CopyQbInvoiceLinkButton]", error);
      setState("error");
      window.setTimeout(() => setState("idle"), 2200);
    }
  }

  const Icon = state === "loading" ? Loader2 : state === "copied" ? Check : Clipboard;
  const label =
    state === "loading"
      ? "Buscando..."
      : state === "copied"
      ? "Copiado"
      : state === "error"
      ? "Erro"
      : compact
      ? "Link QB"
      : "Copiar link QB";

  return (
    <button
      type="button"
      onClick={copyLink}
      disabled={disabled || state === "loading"}
      className={
        compact
          ? "inline-flex items-center gap-1.5 text-brand-verde hover:text-brand-verde/80 font-medium disabled:cursor-not-allowed disabled:text-gray-400"
          : "inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-xl border border-gray-200 hover:bg-gray-50 shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      }
      title="Copiar link publico da invoice no QuickBooks"
    >
      <Icon className={`h-4 w-4 ${state === "loading" ? "animate-spin" : ""}`} />
      <span>{label}</span>
    </button>
  );
}
