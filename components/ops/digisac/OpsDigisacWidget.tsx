"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MessageSquareText, X } from "lucide-react";
import { useOpsDigisacUnread, type DigisacThreadPreview } from "@/hooks/ops/useOpsDigisacUnread";

function formatTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function previewText(thread: DigisacThreadPreview) {
  const text = thread.latestMessage?.content ?? "";
  const single = text.replace(/\s+/g, " ").trim();
  return single.length > 55 ? `${single.slice(0, 55)}…` : single || "Sem mensagem";
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join("") || "?";
}

export function OpsDigisacWidget() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const { unreadCount, threads, enabled, migrationRequired } = useOpsDigisacUnread();

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current?.contains(e.target as Node) ||
        fabRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const sorted = [...threads]
    .sort((a, b) => {
      if (a.needsReply !== b.needsReply) return a.needsReply ? -1 : 1;
      return (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? "");
    })
    .slice(0, 8);

  return (
    <>
      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-20 right-4 z-50 w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl md:bottom-24 md:right-6"
        >
          <div className="flex items-center justify-between bg-brand-verde px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-white" />
              <span className="text-sm font-bold text-white">Conversas</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount} nova{unreadCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-72 divide-y divide-gray-100 overflow-y-auto">
            {migrationRequired ? (
              <div className="px-4 py-6 text-center text-xs text-amber-700">
                Migration Digisac pendente. A inbox aparece vazia até a tabela existir.
              </div>
            ) : !enabled ? (
              <div className="px-4 py-6 text-center text-xs text-gray-500">
                Digisac não configurado.
              </div>
            ) : sorted.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-gray-500">
                Nenhuma conversa ainda.
              </div>
            ) : (
              sorted.map((thread) => (
                <Link
                  key={thread.id}
                  href={`/ops/digisac?thread=${thread.id}`}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 transition hover:bg-gray-50 ${
                    thread.needsReply ? "border-l-2 border-brand-tangerina bg-orange-50/40" : ""
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      thread.needsReply
                        ? "bg-orange-100 text-brand-tangerina"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {initials(thread.displayName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {thread.displayName}
                      </p>
                      <span className="flex-shrink-0 text-[10px] text-gray-400">
                        {formatTime(
                          thread.latestMessage?.externalCreatedAt ??
                          thread.latestMessage?.createdAt ??
                          thread.lastMessageAt
                        )}
                      </span>
                    </div>
                    <p className="truncate text-xs text-gray-500">{previewText(thread)}</p>
                  </div>
                  {thread.needsReply && (
                    <span className="h-2 w-2 flex-shrink-0 rounded-full bg-brand-tangerina" />
                  )}
                </Link>
              ))
            )}
          </div>

          <div className="border-t border-gray-100 bg-gray-50 px-4 py-2.5 text-center">
            <Link
              href="/ops/digisac"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-brand-verde hover:underline"
            >
              Ver todas as conversas →
            </Link>
          </div>
        </div>
      )}

      <button
        ref={fabRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Conversas Digisac"
        className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-verde shadow-lg transition hover:bg-brand-verde/90 focus:outline-none focus:ring-2 focus:ring-brand-verde/50 md:bottom-6 md:right-6"
      >
        <MessageSquareText className="h-6 w-6 text-white" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
    </>
  );
}
