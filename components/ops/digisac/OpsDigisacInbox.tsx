"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDown,
  ExternalLink,
  Inbox,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Search,
  Send,
  UserRound,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

type DigisacDirection = "INBOUND" | "OUTBOUND" | "SYSTEM";

type DigisacMessage = {
  id: string;
  externalId?: string | null;
  direction: DigisacDirection;
  content: string;
  type?: string | null;
  status?: string | null;
  senderName?: string | null;
  externalCreatedAt?: string | null;
  createdAt: string;
  sentBy?: { id: string; name: string | null; email: string } | null;
};

type DigisacThreadSummary = {
  id: string;
  phoneNumber: string;
  contactId: string | null;
  contactName: string | null;
  contactUrl: string | null;
  status: string;
  lastMessageAt: string | null;
  lastSyncedAt: string | null;
  messageCount: number;
  needsReply: boolean;
  displayName: string;
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    qbBalance: string | null;
  } | null;
  enrollment: {
    id: string;
    programType: string;
    status: string;
    currentPhase: { label: string; key: string; slaDays: number } | null;
    assignedTo: { id: string; name: string | null };
  } | null;
  latestMessage: DigisacMessage | null;
};

type DigisacListResponse = {
  config: { enabled: boolean; missing: string[] };
  stats: { total: number; needsReply: number; unmatched: number; activeEnrollments: number };
  threads: DigisacThreadSummary[];
  migrationRequired?: boolean;
};

type DigisacDetailResponse = {
  config: { enabled: boolean; missing: string[] };
  migrationRequired?: boolean;
  thread: (DigisacThreadSummary & {
    ticketId?: string | null;
    serviceId?: string | null;
  }) | null;
  messages: DigisacMessage[];
};

type FilterMode = "all" | "needsReply" | "linked" | "unmatched";

function formatDate(value: string | null | undefined) {
  if (!value) return "sem data";
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "C";
}

function preview(value: string | null | undefined) {
  if (!value) return "Sem mensagem registrada";
  const singleLine = value.replace(/\s+/g, " ").trim();
  return singleLine.length > 110 ? `${singleLine.slice(0, 110)}...` : singleLine;
}

function matchesThread(thread: DigisacThreadSummary, query: string) {
  const haystack = [
    thread.displayName,
    thread.phoneNumber,
    thread.contactName,
    thread.customer?.name,
    thread.customer?.email,
    thread.customer?.phone,
    thread.enrollment?.currentPhase?.label,
    thread.enrollment?.assignedTo?.name,
    thread.latestMessage?.content,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function statusTone(thread: DigisacThreadSummary) {
  if (thread.needsReply) return "border-amber-200 bg-amber-50 text-amber-800";
  if (!thread.customer?.id) return "border-gray-200 bg-gray-50 text-gray-600";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function statusLabel(thread: DigisacThreadSummary) {
  if (thread.needsReply) return "Responder";
  if (!thread.customer?.id) return "Sem cliente";
  return "Atendido";
}

export function OpsDigisacInbox({ initialThreadId }: { initialThreadId?: string } = {}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [selectedId, setSelectedId] = useState<string | null>(initialThreadId ?? null);
  const [messageText, setMessageText] = useState("");

  // Chat auto-scroll
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < 48;
    stickToBottomRef.current = atBottom;
    if (atBottom && showJumpToLatest) setShowJumpToLatest(false);
  }, [showJumpToLatest]);

  const listQuery = useQuery<DigisacListResponse>({
    queryKey: ["ops-digisac-threads"],
    queryFn: async () => {
      const response = await fetch("/api/ops/digisac");
      if (!response.ok) throw new Error("Erro ao carregar conversas Digisac.");
      return response.json();
    },
    refetchInterval: 30_000,
  });

  const threads = useMemo(() => listQuery.data?.threads ?? [], [listQuery.data?.threads]);
  const filteredThreads = useMemo(() => {
    const query = search.trim().toLowerCase();
    return threads.filter((thread) => {
      if (filter === "needsReply" && !thread.needsReply) return false;
      if (filter === "linked" && !thread.customer?.id) return false;
      if (filter === "unmatched" && thread.customer?.id) return false;
      return !query || matchesThread(thread, query);
    });
  }, [filter, search, threads]);

  useEffect(() => {
    if (selectedId) {
      if (filteredThreads.some((t) => t.id === selectedId)) return;
      if (filteredThreads.length === 0) return; // still loading — don't clear
    }
    setSelectedId(filteredThreads[0]?.id ?? null);
  }, [filteredThreads, selectedId]);

  const selectedThread = filteredThreads.find((thread) => thread.id === selectedId) ?? null;

  const detailQuery = useQuery<DigisacDetailResponse>({
    queryKey: ["ops-digisac-thread", selectedThread?.id],
    enabled: Boolean(selectedThread?.id),
    queryFn: async () => {
      const response = await fetch(`/api/ops/digisac/${selectedThread?.id}`);
      if (!response.ok) throw new Error("Erro ao carregar mensagens.");
      return response.json();
    },
    refetchInterval: 20_000,
  });

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!selectedThread?.id) throw new Error("Selecione uma conversa.");
      const response = await fetch(`/api/ops/digisac/${selectedThread.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Erro ao enviar pelo Digisac.");
      return payload;
    },
    onSuccess: () => {
      setMessageText("");
      // user just sent a message: force stick and scroll
      stickToBottomRef.current = true;
      setShowJumpToLatest(false);
      queryClient.invalidateQueries({ queryKey: ["ops-digisac-threads"] });
      queryClient.invalidateQueries({ queryKey: ["ops-digisac-thread", selectedThread?.id] });
      toast.success("Mensagem enviada pelo Digisac.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar pelo Digisac.");
    },
  });

  const stats = listQuery.data?.stats ?? { total: 0, needsReply: 0, unmatched: 0, activeEnrollments: 0 };
  const config = detailQuery.data?.config ?? listQuery.data?.config;
  const canSend = Boolean(config?.enabled && selectedThread?.phoneNumber && messageText.trim());
  const messages = detailQuery.data?.messages ?? [];

  // When changing thread: reset to stick-to-bottom and snap to the latest message.
  useEffect(() => {
    if (!selectedThread?.id) return;
    stickToBottomRef.current = true;
    setShowJumpToLatest(false);
    // wait one tick so the DOM has rendered the new thread's content
    const raf = requestAnimationFrame(() => scrollToBottom("auto"));
    return () => cancelAnimationFrame(raf);
  }, [selectedThread?.id, scrollToBottom]);

  // When new messages arrive: stick if user is at bottom, else surface "↓ novas" pill.
  const lastMessageId = messages[messages.length - 1]?.id ?? null;
  const messageCount = messages.length;
  useEffect(() => {
    if (!messageCount) return;
    if (stickToBottomRef.current) {
      const raf = requestAnimationFrame(() => scrollToBottom("smooth"));
      return () => cancelAnimationFrame(raf);
    }
    setShowJumpToLatest(true);
  }, [lastMessageId, messageCount, scrollToBottom]);

  const filterTabs: Array<{ key: FilterMode; label: string; count?: number }> = [
    { key: "all", label: "Todas", count: stats.total },
    { key: "needsReply", label: "A responder", count: stats.needsReply },
    { key: "linked", label: "Vinculadas", count: stats.activeEnrollments },
    { key: "unmatched", label: "Sem vínculo", count: stats.unmatched },
  ];

  return (
    <div className="space-y-4">
      {/* Inline stats — typography only, no cards */}
      <p className="text-[13px] text-gray-600">
        <span className="font-semibold text-gray-900 tabular-nums">{stats.total}</span> conversas no total
        {stats.needsReply > 0 && (
          <>
            , <span className="font-semibold text-brand-tangerina tabular-nums">{stats.needsReply}</span> aguardando resposta
          </>
        )}
        {stats.unmatched > 0 && (
          <>
            , <span className="font-medium text-gray-500 tabular-nums">{stats.unmatched}</span> sem vínculo com aluno
          </>
        )}
        .
      </p>

      <div className="flex h-[700px] flex-col overflow-hidden rounded-xl border border-gray-200/60 bg-white">
        <div className="flex shrink-0 flex-col gap-3 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" strokeWidth={1.75} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por cliente, telefone, fase, responsável"
              className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-[13px] text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-brand-verde focus:ring-2 focus:ring-brand-verde/10"
            />
          </div>
          <div role="tablist" aria-label="Filtrar conversas" className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-0.5">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={filter === tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-verde/40 ${
                  filter === tab.key
                    ? "bg-brand-verde text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`tabular-nums text-[11px] font-semibold ${
                      filter === tab.key ? "text-white/75" : "text-gray-400"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-[1fr] lg:grid-cols-[340px_minmax(0,1fr)] lg:grid-rows-none">
          <aside className="flex min-h-0 flex-col border-b border-gray-100 lg:border-b-0 lg:border-r">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {listQuery.isLoading ? (
                <div className="space-y-2 p-3">
                  {Array.from({ length: 7 }).map((_, index) => (
                    <div key={index} className="h-20 rounded-lg bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : listQuery.isError ? (
                <div className="p-6 text-center">
                  <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-500" />
                  <p className="text-sm font-semibold text-gray-800">Não deu para carregar o Digisac.</p>
                  <button
                    type="button"
                    onClick={() => listQuery.refetch()}
                    className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:border-brand-verde hover:text-brand-verde"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Tentar novamente
                  </button>
                </div>
              ) : filteredThreads.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageSquareText className="mx-auto mb-3 h-8 w-8 text-gray-300" />
                  <p className="text-sm font-semibold text-gray-700">Nenhuma conversa neste filtro.</p>
                  <p className="mt-1 text-xs text-gray-500">Ajuste a busca ou selecione outro estado.</p>
                </div>
              ) : (
                <ul>
                  {filteredThreads.map((thread, idx) => {
                    const selected = thread.id === selectedThread?.id;
                    const time = formatDate(
                      thread.latestMessage?.externalCreatedAt ??
                      thread.latestMessage?.createdAt ??
                      thread.lastMessageAt
                    );
                    return (
                      <li key={thread.id} className={idx === 0 ? "" : "border-t border-gray-100"}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(thread.id)}
                          aria-current={selected ? "true" : undefined}
                          className={`group relative flex w-full items-center gap-3 px-3 py-2.5 text-left transition focus:outline-none focus-visible:bg-gray-50 ${
                            selected ? "bg-[#F5F7F5]" : "hover:bg-gray-50"
                          }`}
                        >
                          {selected && (
                            <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-brand-verde" />
                          )}
                          <div
                            aria-hidden
                            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold tracking-wide ${
                              thread.needsReply
                                ? "bg-orange-50 text-brand-tangerina ring-1 ring-orange-100"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {initials(thread.displayName)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className={`truncate text-[13.5px] ${
                                thread.needsReply ? "font-semibold text-gray-900" : "font-medium text-gray-800"
                              }`}>
                                {thread.displayName}
                              </p>
                              <span className="flex-shrink-0 text-[11px] tabular-nums text-gray-400">
                                {time}
                              </span>
                            </div>
                            <p className={`mt-0.5 truncate text-[12px] ${
                              thread.needsReply ? "font-medium text-gray-700" : "text-gray-500"
                            }`}>
                              {preview(thread.latestMessage?.content)}
                            </p>
                            {thread.enrollment?.currentPhase?.label && (
                              <p className="mt-0.5 truncate text-[11px] text-gray-400">
                                {thread.enrollment.currentPhase.label}
                              </p>
                            )}
                          </div>
                          {thread.needsReply && (
                            <span
                              aria-label="Aguardando resposta"
                              className="h-2 w-2 flex-shrink-0 rounded-full bg-brand-tangerina"
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-col">
            {!selectedThread ? (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <Inbox className="mb-3 h-10 w-10 text-gray-300" />
                <p className="text-sm font-semibold text-gray-800">Selecione uma conversa.</p>
                <p className="mt-1 max-w-sm text-xs text-gray-500">A inbox reúne o histórico Digisac sem obrigar o time a abrir cliente por cliente.</p>
              </div>
            ) : (
              <>
                <div className="border-b border-gray-100 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-[18px] font-semibold tracking-tight text-gray-900">
                          {selectedThread.displayName}
                        </h2>
                        {selectedThread.needsReply && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-tangerina">
                            <span className="h-1.5 w-1.5 rounded-full bg-brand-tangerina" />
                            Aguardando resposta
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-gray-500">
                        <span className="tabular-nums">{selectedThread.phoneNumber}</span>
                        {selectedThread.customer?.email && (
                          <>
                            <span aria-hidden className="text-gray-300">·</span>
                            <span className="break-all">{selectedThread.customer.email}</span>
                          </>
                        )}
                        {selectedThread.enrollment?.assignedTo?.name && (
                          <>
                            <span aria-hidden className="text-gray-300">·</span>
                            <span>Resp. {selectedThread.enrollment.assignedTo.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedThread.enrollment?.id && (
                        <Link
                          href={`/ops/students/${selectedThread.enrollment.id}`}
                          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-[12.5px] font-medium text-gray-700 transition hover:border-brand-verde hover:text-brand-verde"
                        >
                          <UserRound className="h-3.5 w-3.5" strokeWidth={1.75} />
                          Abrir ficha
                        </Link>
                      )}
                      {selectedThread.contactUrl && (
                        <a
                          href={selectedThread.contactUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-[12.5px] font-medium text-gray-700 transition hover:border-brand-verde hover:text-brand-verde"
                        >
                          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
                          Digisac
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {listQuery.data?.migrationRequired || detailQuery.data?.migrationRequired ? (
                  <div className="border-b border-amber-100 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
                    Migration Digisac pendente. A inbox aparece vazia até a tabela operacional existir.
                  </div>
                ) : null}

                {config && !config.enabled && (
                  <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
                    Digisac não configurado: {config.missing.join(", ")}
                  </div>
                )}

                <div className="relative min-h-0 flex-1">
                  <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="h-full space-y-3 overflow-y-auto overscroll-contain scroll-smooth bg-gray-50/60 p-4"
                  >
                  {detailQuery.isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className={`h-16 rounded-lg bg-white shadow-sm animate-pulse ${index % 2 ? "ml-20" : "mr-20"}`} />
                      ))}
                    </div>
                  ) : detailQuery.isError ? (
                    <div className="rounded-lg border border-red-100 bg-white p-6 text-center text-sm text-red-600">
                      Erro ao carregar as mensagens desta conversa.
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
                      <MessageSquareText className="mx-auto mb-3 h-8 w-8 text-gray-300" />
                      <p className="text-sm font-semibold text-gray-800">Sem mensagens salvas ainda.</p>
                      <p className="mt-1 text-xs text-gray-500">Envie a primeira mensagem ou abra o contato no Digisac.</p>
                    </div>
                  ) : (
                    messages.map((message) => {
                      const outbound = message.direction === "OUTBOUND";
                      return (
                        <div key={message.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[86%] rounded-lg border px-3 py-2 text-sm leading-relaxed shadow-sm ${
                            outbound
                              ? "border-brand-verde bg-brand-verde text-white"
                              : "border-gray-200 bg-white text-gray-700"
                          }`}>
                            <div className={`mb-1 flex items-center justify-between gap-3 text-[10px] ${
                              outbound ? "text-white/70" : "text-gray-400"
                            }`}>
                              <span className="truncate">
                                {outbound
                                  ? message.sentBy?.name ?? "Ops"
                                  : message.senderName ?? selectedThread.contactName ?? selectedThread.displayName}
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
                  {showJumpToLatest && (
                    <button
                      type="button"
                      onClick={() => {
                        stickToBottomRef.current = true;
                        setShowJumpToLatest(false);
                        scrollToBottom("smooth");
                      }}
                      className="absolute bottom-3 left-1/2 inline-flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full bg-brand-verde px-3 text-[12px] font-semibold text-white shadow-lg transition hover:bg-brand-verde/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-tangerina/60"
                      aria-label="Ir para a mensagem mais recente"
                    >
                      <ArrowDown className="h-3.5 w-3.5" strokeWidth={2} />
                      Novas mensagens
                    </button>
                  )}
                </div>

                <div className="border-t border-gray-100 bg-white p-3">
                  <textarea
                    value={messageText}
                    onChange={(event) => setMessageText(event.target.value.slice(0, 2000))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey && canSend && !sendMutation.isPending) {
                        event.preventDefault();
                        sendMutation.mutate(messageText);
                      }
                    }}
                    rows={3}
                    placeholder={config?.enabled ? "Escreva para o cliente pelo Digisac..." : "Configure o Digisac para enviar mensagens"}
                    disabled={sendMutation.isPending || !config?.enabled}
                    className="min-h-[76px] w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-brand-verde focus:ring-2 focus:ring-brand-verde/10 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-gray-500">{messageText.length}/2000</span>
                    <button
                      type="button"
                      onClick={() => sendMutation.mutate(messageText)}
                      disabled={!canSend || sendMutation.isPending}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-verde px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {sendMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Enviar
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
