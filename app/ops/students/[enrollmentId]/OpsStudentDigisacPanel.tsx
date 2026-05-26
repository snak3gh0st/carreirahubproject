"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ExternalLink,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Send,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type DigisacMessage = {
  id: string;
  direction: "INBOUND" | "OUTBOUND" | "SYSTEM";
  content: string;
  status: string | null;
  senderName: string | null;
  externalCreatedAt: string | null;
  createdAt: string;
  sentBy: { id: string; name: string | null; email: string } | null;
};

type DigisacResponse = {
  config: { enabled: boolean; missing: string[] };
  migrationRequired?: boolean;
  thread: {
    id: string;
    phoneNumber: string;
    contactId: string | null;
    contactName: string | null;
    contactUrl: string | null;
    lastMessageAt: string | null;
    lastSyncedAt: string | null;
  } | null;
  messages: DigisacMessage[];
};

function formatDate(value: string | null | undefined) {
  if (!value) return "sem data";
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OpsStudentDigisacPanel({
  enrollmentId,
  customerName,
  customerPhone,
}: {
  enrollmentId: string;
  customerName: string;
  customerPhone: string | null;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const queryKey = ["ops-student-digisac", enrollmentId];

  const { data, isLoading, isError, refetch, isFetching } = useQuery<DigisacResponse>({
    queryKey,
    queryFn: async () => {
      const response = await fetch(`/api/ops/enrollments/${enrollmentId}/digisac`);
      if (!response.ok) throw new Error("Erro ao carregar Digisac.");
      return response.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await fetch(`/api/ops/enrollments/${enrollmentId}/digisac`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Erro ao enviar pelo Digisac.");
      return payload;
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["ops-digisac-threads"] });
      toast.success("Mensagem enviada pelo Digisac.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar pelo Digisac.");
    },
  });

  const messages = data?.messages ?? [];
  const enabled = Boolean(data?.config.enabled);
  const hasPhone = Boolean(customerPhone);

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gray-50/80 px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-brand-verde" />
              <h2 className="text-base font-semibold text-gray-950">Digisac do cliente</h2>
            </div>
            <p className="mt-1 truncate text-xs text-gray-500">
              {customerPhone ?? "Telefone não cadastrado"} · histórico direto do atendimento
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            {data?.thread?.contactUrl && (
              <a
                href={data.thread.contactUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-brand-verde hover:text-brand-verde focus:outline-none focus:ring-2 focus:ring-brand-verde/20"
                aria-label="Abrir contato no Digisac"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <button
              type="button"
              onClick={() => void refetch()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-brand-verde hover:text-brand-verde focus:outline-none focus:ring-2 focus:ring-brand-verde/20"
              aria-label="Atualizar mensagens Digisac"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {data?.migrationRequired && (
        <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800">
          Migration Digisac pendente.
        </div>
      )}

      {data?.config && !data.config.enabled && (
        <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">
          Digisac não configurado: {data.config.missing.join(", ")}
        </div>
      )}

      <div className="max-h-[420px] space-y-3 overflow-y-auto bg-gray-50/50 px-4 py-4 sm:px-5">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className={`h-14 rounded-lg bg-white shadow-sm animate-pulse ${index % 2 ? "ml-14" : "mr-14"}`} />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-red-100 bg-white p-4 text-sm text-red-600">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Erro ao carregar mensagens Digisac.
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center">
            <MessageSquareText className="mx-auto mb-3 h-8 w-8 text-gray-300" />
            <p className="text-sm font-semibold text-gray-800">Sem mensagens salvas para {customerName}.</p>
            <p className="mt-1 text-xs text-gray-500">Use este painel ou a inbox do sidebar para iniciar o contato.</p>
          </div>
        ) : (
          messages.map((message) => {
            const outbound = message.direction === "OUTBOUND";
            return (
              <div key={message.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-lg border px-3 py-2 text-sm leading-relaxed shadow-sm ${
                  outbound
                    ? "border-brand-verde bg-brand-verde text-white"
                    : "border-gray-200 bg-white text-gray-700"
                }`}>
                  <div className={`mb-1 flex items-center justify-between gap-3 text-[10px] ${
                    outbound ? "text-white/70" : "text-gray-400"
                  }`}>
                    <span className="truncate">
                      {outbound ? message.sentBy?.name ?? "Ops" : message.senderName ?? customerName}
                    </span>
                    <span className="flex-shrink-0">{formatDate(message.externalCreatedAt ?? message.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-gray-100 p-3">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, 2000))}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && enabled && hasPhone && text.trim() && !mutation.isPending) {
              event.preventDefault();
              mutation.mutate(text);
            }
          }}
          placeholder={hasPhone ? "Mensagem para o cliente via Digisac..." : "Cadastre um telefone para enviar"}
          rows={3}
          className="min-h-[76px] w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-brand-verde focus:ring-2 focus:ring-brand-verde/10 disabled:bg-gray-50 disabled:text-gray-400"
          disabled={mutation.isPending || !enabled || !hasPhone}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-[11px] text-gray-500">{text.length}/2000</span>
          <button
            type="button"
            onClick={() => mutation.mutate(text)}
            disabled={mutation.isPending || !enabled || !hasPhone || !text.trim()}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-verde px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Enviar
          </button>
        </div>
      </div>
    </section>
  );
}
