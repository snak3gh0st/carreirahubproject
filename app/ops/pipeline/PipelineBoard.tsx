"use client";

import { useChat } from "@ai-sdk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport } from "ai";
import { differenceInDays } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessagesSquare,
  ListFilter,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  Send,
  UserRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { getPhaseChecklist } from "@/lib/ops/phase-checklists";
import { useAdvancePhase, usePipelineData } from "./usePipelineData";
import type { EnrollmentCard, PhaseWithEnrollments } from "./usePipelineData";

interface PipelineBoardProps {
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
}

type FilterMode = "all" | "mine" | "risk" | "debt";

type OpsComment = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string | null; email: string } | null;
};

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

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function currency(value: string | null) {
  const amount = Number(value ?? 0);
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "USD" });
}

function cleanOpsAiText(value: string) {
  return value
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*---+\s*$/gm, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\uFE0F/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function getPhaseAgeDays(enrollment: EnrollmentCard) {
  const marker = enrollment.transitions[0]?.createdAt ?? enrollment.startDate;
  return Math.max(0, differenceInDays(new Date(), new Date(marker)));
}

function getDaysSinceLastSession(enrollment: EnrollmentCard) {
  const last = enrollment.sessions[0]?.sessionDate;
  if (!last) return null;
  return Math.max(0, differenceInDays(new Date(), new Date(last)));
}

function getChecklistProgress(phase: PhaseWithEnrollments, enrollment: EnrollmentCard) {
  const template = getPhaseChecklist(phase.key);
  if (template.length === 0) return { completed: 0, total: 0, percent: 0 };
  const completed = new Set(
    enrollment.checklistProgress
      .filter((item) => item.phaseKey === phase.key && item.completedAt)
      .map((item) => item.itemKey)
  );
  const count = template.filter((item) => completed.has(item.key)).length;
  return {
    completed: count,
    total: template.length,
    percent: Math.round((count / template.length) * 100),
  };
}

function getRiskLabel(phase: PhaseWithEnrollments, enrollment: EnrollmentCard) {
  const phaseAgeDays = getPhaseAgeDays(enrollment);
  const daysSinceLastSession = getDaysSinceLastSession(enrollment);
  const overdueSla = phaseAgeDays > phase.slaDays;
  const staleSession = daysSinceLastSession === null || daysSinceLastSession >= 14;
  if (overdueSla && staleSession) return "SLA e sessao";
  if (overdueSla) return "SLA";
  if (staleSession) return "Sem sessao";
  return null;
}

function getPaymentAlert(enrollment: EnrollmentCard) {
  const invoices = enrollment.customer.invoices ?? [];
  const paidInvoices = invoices.filter((invoice) => invoice.status === "PAID");
  const openInvoices = invoices.filter((invoice) =>
    ["SENT", "OVERDUE", "PARTIALLY_PAID"].includes(invoice.status)
  );
  const qbBalance = Number(enrollment.customer.qbBalance ?? 0);
  const latestOpen = openInvoices[0];

  if (openInvoices.length > 0 || qbBalance > 0) {
    return {
      level: "red" as const,
      label: latestOpen?.status === "OVERDUE" ? "Invoice vencida" : "Invoice em aberto",
      detail: qbBalance > 0 ? currency(String(qbBalance)) : latestOpen ? currency(latestOpen.amount) : null,
    };
  }

  if (paidInvoices.length === 0) {
    return {
      level: "red" as const,
      label: "Pagamento nao confirmado",
      detail: invoices[0]?.invoiceNumber ?? null,
    };
  }

  return {
    level: "green" as const,
    label: "Invoice paga",
    detail: paidInvoices[0]?.invoiceNumber ?? null,
  };
}

function PipelineSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-24 rounded-xl border border-gray-200 bg-white animate-pulse" />
      ))}
    </div>
  );
}

function StudentRow({
  phase,
  enrollment,
  selected,
  onSelect,
}: {
  phase: PhaseWithEnrollments;
  enrollment: EnrollmentCard;
  selected: boolean;
  onSelect: () => void;
}) {
  const phaseAgeDays = getPhaseAgeDays(enrollment);
  const daysSinceLastSession = getDaysSinceLastSession(enrollment);
  const progress = getChecklistProgress(phase, enrollment);
  const risk = getRiskLabel(phase, enrollment);
  const paymentAlert = getPaymentAlert(enrollment);
  const slaPercent = phase.slaDays > 0 ? Math.min(Math.round((phaseAgeDays / phase.slaDays) * 100), 100) : 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border bg-white p-4 text-left transition-all ${
        selected
          ? "border-brand-verde shadow-md"
          : "border-gray-100 hover:border-brand-verde/40 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-creme text-xs font-bold text-brand-verde">
          {initials(enrollment.customer.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-gray-900">{enrollment.customer.name}</p>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-600">
              {enrollment.programType}
            </span>
            {risk && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                <AlertTriangle className="h-3 w-3" />
                {risk}
              </span>
            )}
            {paymentAlert.level === "red" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                <WalletCards className="h-3 w-3" />
                {paymentAlert.label}
              </span>
            )}
            {paymentAlert.level === "green" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                Pago
              </span>
            )}
          </div>
          <div className="mt-2 grid gap-2 text-xs text-gray-500 sm:grid-cols-3">
            <span className="truncate">Responsavel: {enrollment.assignedTo.name ?? "Sem nome"}</span>
            <span>{enrollment._count.sessions} sessao{enrollment._count.sessions !== 1 ? "es" : ""}</span>
            <span>
              Ultima sessao: {daysSinceLastSession === null ? "sem registro" : `${daysSinceLastSession}d atras`}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <div className="mb-1 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                <span>SLA da fase</span>
                <span>{phaseAgeDays}/{phase.slaDays}d</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div className={`h-full ${phaseAgeDays > phase.slaDays ? "bg-red-500" : "bg-brand-verde"}`} style={{ width: `${slaPercent}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                <span>Checklist</span>
                <span>{progress.total ? `${progress.completed}/${progress.total}` : "sem checklist"}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full bg-brand-tangerina" style={{ width: `${progress.percent}%` }} />
              </div>
            </div>
          </div>
        </div>
        <ArrowRight className={`mt-1 h-4 w-4 flex-shrink-0 ${selected ? "text-brand-verde" : "text-gray-300"}`} />
      </div>
    </button>
  );
}

function InternalCommentsCard({ enrollment }: { enrollment: EnrollmentCard }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const queryKey = ["ops-student-comments", enrollment.id];

  const { data, isLoading, isError } = useQuery<{ comments: OpsComment[] }>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/ops/enrollments/${enrollment.id}/comments`);
      if (!res.ok) throw new Error("Failed to fetch comments");
      return res.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch(`/api/ops/enrollments/${enrollment.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar comentario");
      return data;
    },
    onSuccess: () => {
      setBody("");
      queryClient.invalidateQueries({ queryKey });
      toast.success("Comentario salvo");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar comentario"),
  });

  const comments = data?.comments ?? [];

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessagesSquare className="h-4 w-4 text-brand-verde" />
          <h3 className="text-sm font-display font-semibold text-gray-900">Comentarios internos</h3>
        </div>
        <p className="mt-1 text-xs text-gray-400">
          Handoff do time para quem assumir este aluno depois.
        </p>
      </div>

      <div className="max-h-64 space-y-3 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Carregando comentarios...
          </div>
        ) : isError ? (
          <p className="text-xs text-red-500">Erro ao carregar comentarios.</p>
        ) : comments.length === 0 ? (
          <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-xs text-gray-400">
            Nenhum comentario interno ainda.
          </p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-xs font-semibold text-gray-800">
                  {comment.author?.name ?? comment.author?.email ?? "Usuario removido"}
                </span>
                <span className="flex-shrink-0 text-[10px] text-gray-400">
                  {new Date(comment.createdAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-gray-600">{comment.body}</p>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-gray-50 p-3">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value.slice(0, 2000))}
          placeholder="Ex: aluno pediu reagendamento; cobrar formulario antes da proxima sessao..."
          rows={3}
          className="min-h-[72px] w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 outline-none focus:border-brand-verde focus:ring-2 focus:ring-brand-verde/10"
          disabled={mutation.isPending}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[10px] text-gray-400">{body.length}/2000</span>
          <button
            type="button"
            onClick={() => mutation.mutate(body)}
            disabled={mutation.isPending || !body.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-verde px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Comentar
          </button>
        </div>
      </div>
    </div>
  );
}

function DigisacWhatsappCard({ enrollment }: { enrollment: EnrollmentCard }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const queryKey = ["ops-digisac", enrollment.id];

  const { data, isLoading, isError, refetch, isFetching } = useQuery<DigisacResponse>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/ops/enrollments/${enrollment.id}/digisac`);
      if (!res.ok) throw new Error("Failed to fetch Digisac messages");
      return res.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch(`/api/ops/enrollments/${enrollment.id}/digisac`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Erro ao enviar pelo Digisac");
      return body;
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey });
      toast.success("Mensagem enviada pelo Digisac");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao enviar pelo Digisac"),
  });

  const messages = data?.messages ?? [];
  const enabled = Boolean(data?.config.enabled);
  const hasPhone = Boolean(enrollment.customer.phone);

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-50 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-brand-verde" />
              <h3 className="text-sm font-display font-semibold text-gray-900">WhatsApp Digisac</h3>
            </div>
            <p className="mt-1 truncate text-xs text-gray-400">
              {enrollment.customer.phone ?? "Telefone nao cadastrado"}
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            {data?.thread?.contactUrl && (
              <a
                href={data.thread.contactUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:border-brand-verde hover:text-brand-verde"
                aria-label="Abrir no Digisac"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <button
              type="button"
              onClick={() => void refetch()}
              className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:border-brand-verde hover:text-brand-verde"
              aria-label="Atualizar mensagens"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {!enabled && (
        <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
          Configurar: {data?.config.missing.join(", ") || "DIGISAC_API_BASE_URL, DIGISAC_API_TOKEN, DIGISAC_SERVICE_ID"}
        </div>
      )}
      {data?.migrationRequired && (
        <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
          Migration Digisac pendente.
        </div>
      )}

      <div className="max-h-72 space-y-3 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Carregando Digisac...
          </div>
        ) : isError ? (
          <p className="text-xs text-red-500">Erro ao carregar mensagens Digisac.</p>
        ) : messages.length === 0 ? (
          <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-xs text-gray-400">
            Sem mensagens Digisac no hub ainda.
          </p>
        ) : (
          messages.map((message) => {
            const outbound = message.direction === "OUTBOUND";
            return (
              <div
                key={message.id}
                className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${
                  outbound ? "ml-8 bg-brand-verde text-white" : "mr-8 bg-gray-50 text-gray-700"
                }`}
              >
                <div className={`mb-1 flex items-center justify-between gap-2 text-[10px] ${outbound ? "text-white/70" : "text-gray-400"}`}>
                  <span className="truncate">
                    {outbound
                      ? message.sentBy?.name ?? "Hub operacional"
                      : message.senderName ?? data?.thread?.contactName ?? enrollment.customer.name}
                  </span>
                  <span className="flex-shrink-0">
                    {new Date(message.externalCreatedAt ?? message.createdAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-gray-50 p-3">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, 2000))}
          placeholder={hasPhone ? "Mensagem para o aluno via Digisac..." : "Cadastre um telefone para enviar"}
          rows={3}
          className="min-h-[72px] w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 outline-none focus:border-brand-verde focus:ring-2 focus:ring-brand-verde/10"
          disabled={mutation.isPending || !enabled || !hasPhone}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[10px] text-gray-400">{text.length}/2000</span>
          <button
            type="button"
            onClick={() => mutation.mutate(text)}
            disabled={mutation.isPending || !enabled || !hasPhone || !text.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-verde px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}

function StudentAiCard({
  phase,
  enrollment,
  currentUserRole,
}: {
  phase: PhaseWithEnrollments;
  enrollment: EnrollmentCard;
  currentUserRole: string;
}) {
  const hub = "operational";
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/dashboard/ai/chat" }), []);
  const { messages, setMessages, sendMessage, status, error } = useChat({ transport } as any);
  const isStreaming = status === "streaming" || status === "submitted";
  const summaryPrompt =
    "Sumarize o caso operacional deste aluno em no maximo 6 linhas curtas. Use texto puro, sem Markdown, sem negrito, sem emoji, sem tabela, sem separadores e sem pipes. Comece cada linha com um rotulo simples: Fase atual, Risco, Ultima sessao, Checklist, Pendencias, Proxima acao. Nao inclua leitura estrategica, visao CEO, nomes de tools, IDs internos ou erros tecnicos.";
  const opsContext = [
    `Aluno: ${enrollment.customer.name}`,
    `Enrollment ID: ${enrollment.id}`,
    `Customer ID: ${enrollment.customer.id}`,
    `Fase atual: ${phase.label} (${phase.key})`,
    `Responsavel: ${enrollment.assignedTo.name ?? "Sem nome"}`,
    `Programa: ${enrollment.programType}`,
  ].join(" | ");

  async function createSummaryConversation() {
    const res = await fetch("/api/dashboard/ai/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hub, title: `Resumo Ops - ${enrollment.customer.name}` }),
    });
    if (!res.ok) throw new Error("Falha ao criar conversa");
    const data = await res.json();
    const id = data?.conversation?.id as string | undefined;
    if (!id) throw new Error("Conversa criada sem id");
    return id;
  }

  async function summarizeStudent() {
    if (isStreaming) return;
    try {
      setMessages([]);
      const resolvedConversationId = await createSummaryConversation();
      (sendMessage as any)(
        { text: summaryPrompt },
        {
          body: {
            conversationId: resolvedConversationId,
            pathname: "/ops/pipeline",
            params: { enrollmentId: enrollment.id },
            hub,
            opsContext,
          },
        }
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar resumo");
    }
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-brand-verde" />
          <h3 className="text-sm font-display font-semibold text-gray-900">Resumo AI do aluno</h3>
        </div>
        <p className="mt-1 text-xs text-gray-400">
          Gera um resumo curto sob demanda para economizar tokens.
        </p>
      </div>

      <div className="max-h-72 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-xs text-gray-400">
            Clique em resumir para gerar uma visao operacional do caso.
          </p>
        ) : (
          messages.map((message: any) => {
            const text = cleanOpsAiText((message.parts ?? [])
              .filter((part: any) => part.type === "text")
              .map((part: any) => part.text)
              .join(""));
            if (!text || message.role === "user") return null;
            return (
              <div
                key={message.id}
                className="rounded-lg bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-700"
              >
                <div className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-brand-verde">
                  <Bot className="h-3 w-3" />
                  Resumo operacional
                </div>
                <p className="whitespace-pre-wrap">{text}</p>
              </div>
            );
          })
        )}
        {isStreaming && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Lendo dados do aluno...
          </div>
        )}
        {error && <p className="text-xs text-red-500">Erro no chat. Verifique se o AI Copilot esta habilitado.</p>}
      </div>

      <div className="border-t border-gray-50 p-3">
        <button
          type="button"
          onClick={() => void summarizeStudent()}
          disabled={isStreaming}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-verde px-3 py-2 text-xs font-semibold text-white transition-opacity disabled:opacity-40"
        >
          {isStreaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
          Sumarizar caso do aluno
        </button>
      </div>
    </div>
  );
}

function StudentDetail({
  phase,
  enrollment,
  phases,
  currentUserRole,
}: {
  phase: PhaseWithEnrollments;
  enrollment: EnrollmentCard;
  phases: PhaseWithEnrollments[];
  currentUserRole: string;
}) {
  const advanceMutation = useAdvancePhase();
  const phaseAgeDays = getPhaseAgeDays(enrollment);
  const daysSinceLastSession = getDaysSinceLastSession(enrollment);
  const progress = getChecklistProgress(phase, enrollment);
  const nextPhase = phases.find((p) => p.sortOrder === phase.sortOrder + 1);
  const paymentAlert = getPaymentAlert(enrollment);

  function advance() {
    if (!nextPhase) {
      toast.error("Este aluno ja esta na ultima fase.");
      return;
    }
    advanceMutation.mutate(
      { enrollmentId: enrollment.id, toPhaseId: nextPhase.id },
      {
        onSuccess: () => toast.success(`Aluno movido para ${nextPhase.label}`),
        onError: (err) => toast.error(err.message ?? "Erro ao avancar fase"),
      }
    );
  }

  return (
    <aside className="space-y-4">
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-creme text-sm font-bold text-brand-verde">
            {initials(enrollment.customer.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-display font-bold text-gray-900">{enrollment.customer.name}</h2>
            <p className="truncate text-xs text-gray-500">{enrollment.customer.email}</p>
            {enrollment.customer.phone && <p className="text-xs text-gray-400">{enrollment.customer.phone}</p>}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Fase</p>
            <p className="mt-1 text-sm font-semibold text-gray-800">{phase.label}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Responsavel</p>
            <p className="mt-1 text-sm font-semibold text-gray-800">{enrollment.assignedTo.name ?? "Sem nome"}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Tempo na fase</p>
            <p className="mt-1 text-sm font-semibold text-gray-800">{phaseAgeDays} de {phase.slaDays} dias</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Ultima sessao</p>
            <p className="mt-1 text-sm font-semibold text-gray-800">
              {daysSinceLastSession === null ? "Sem registro" : `${daysSinceLastSession}d atras`}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-gray-100 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Progresso do checklist</span>
            <span className="text-xs font-bold text-brand-verde">{progress.total ? `${progress.percent}%` : "N/A"}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full bg-brand-tangerina" style={{ width: `${progress.percent}%` }} />
          </div>
        </div>

        <div
          className={`mt-4 rounded-lg border p-3 text-xs font-semibold ${
            paymentAlert.level === "red"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {paymentAlert.level === "red" ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            <span>{paymentAlert.label}</span>
          </div>
          {paymentAlert.detail && (
            <p className="mt-1 pl-6 text-[11px] font-medium opacity-80">{paymentAlert.detail}</p>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <Link
            href={`/ops/students/${enrollment.id}`}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:border-brand-verde hover:text-brand-verde"
          >
            <UserRound className="h-4 w-4" />
            Perfil
          </Link>
          <button
            type="button"
            onClick={advance}
            disabled={advanceMutation.isPending || !nextPhase}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-verde px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {advanceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Avancar
          </button>
        </div>
      </div>

      <InternalCommentsCard key={`comments-${enrollment.id}`} enrollment={enrollment} />
      <DigisacWhatsappCard key={`digisac-${enrollment.id}`} enrollment={enrollment} />
      <StudentAiCard key={`ai-${enrollment.id}`} phase={phase} enrollment={enrollment} currentUserRole={currentUserRole} />
    </aside>
  );
}

export function PipelineBoard({ currentUserId, currentUserRole }: PipelineBoardProps) {
  const { data: phases, isLoading, isError, refetch } = usePipelineData();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!phases) return [];
    const query = search.trim().toLowerCase();
    return phases
      .map((phase) => {
        const enrollments = phase.enrollments.filter((enrollment) => {
          const matchesSearch =
            !query ||
            enrollment.customer.name.toLowerCase().includes(query) ||
            enrollment.customer.email.toLowerCase().includes(query) ||
            enrollment.assignedTo.name?.toLowerCase().includes(query);
          if (!matchesSearch) return false;
          if (filter === "mine") return enrollment.assignedTo.id === currentUserId;
          if (filter === "risk") return Boolean(getRiskLabel(phase, enrollment));
          if (filter === "debt") return getPaymentAlert(enrollment).level === "red";
          return true;
        });
        return { ...phase, enrollments };
      })
      .filter((phase) => phase.enrollments.length > 0);
  }, [currentUserId, filter, phases, search]);

  const selected = useMemo(() => {
    if (!phases) return null;
    const preferredId = selectedId ?? phases.flatMap((phase) => phase.enrollments)[0]?.id;
    if (!preferredId) return null;
    for (const phase of phases) {
      const enrollment = phase.enrollments.find((item) => item.id === preferredId);
      if (enrollment) return { phase, enrollment };
    }
    return null;
  }, [phases, selectedId]);

  const totals = useMemo(() => {
    const all = phases?.flatMap((phase) => phase.enrollments.map((enrollment) => ({ phase, enrollment }))) ?? [];
    return {
      students: all.length,
      mine: all.filter(({ enrollment }) => enrollment.assignedTo.id === currentUserId).length,
      risk: all.filter(({ phase, enrollment }) => Boolean(getRiskLabel(phase, enrollment))).length,
      debt: all.filter(({ enrollment }) => getPaymentAlert(enrollment).level === "red").length,
    };
  }, [currentUserId, phases]);

  if (isLoading) return <PipelineSkeleton />;

  if (isError || !phases) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-red-100 bg-white py-20">
        <p className="text-sm text-gray-500">Erro ao carregar a lista operacional.</p>
        <button onClick={() => refetch()} className="text-sm font-medium text-brand-verde underline">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="grid min-h-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
      <div className="min-w-0">
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          {[
            { key: "all" as const, label: "Todos", value: totals.students },
            { key: "mine" as const, label: "Meus", value: totals.mine },
            { key: "risk" as const, label: "Risco", value: totals.risk },
            { key: "debt" as const, label: "Financeiro", value: totals.debt },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`rounded-xl border p-4 text-left transition-all ${
                filter === item.key
                  ? "border-brand-verde bg-brand-verde text-white"
                  : "border-gray-100 bg-white text-gray-700 hover:border-brand-verde/40"
              }`}
            >
              <p className="text-2xl font-display font-bold">{item.value}</p>
              <p className={`text-xs ${filter === item.key ? "text-white/75" : "text-gray-400"}`}>{item.label}</p>
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar aluno, email ou responsavel..."
              className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm outline-none focus:border-brand-verde focus:bg-white"
            />
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500">
            <ListFilter className="h-4 w-4" />
            Lista por area/fase
          </div>
        </div>

        <div className="space-y-5">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-gray-100 bg-white p-12 text-center">
              <p className="text-sm text-gray-400">Nenhum aluno encontrado para este filtro.</p>
            </div>
          ) : (
            filtered.map((phase) => (
              <section key={phase.id} className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                <div className="mb-3 flex items-center justify-between px-1">
                  <div>
                    <h2 className="font-display text-sm font-bold text-gray-900">{phase.label}</h2>
                    <p className="text-xs text-gray-400">SLA: {phase.slaDays} dias</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-verde shadow-sm">
                    {phase.enrollments.length} aluno{phase.enrollments.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="space-y-2">
                  {phase.enrollments.map((enrollment) => (
                    <StudentRow
                      key={enrollment.id}
                      phase={phase}
                      enrollment={enrollment}
                      selected={selected?.enrollment.id === enrollment.id}
                      onSelect={() => setSelectedId(enrollment.id)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>

      <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
        {selected ? (
          <StudentDetail
            phase={selected.phase}
            enrollment={selected.enrollment}
            phases={phases}
            currentUserRole={currentUserRole}
          />
        ) : (
          <div className="rounded-xl border border-gray-100 bg-white p-8 text-center shadow-sm">
            <Clock className="mx-auto mb-3 h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-400">Selecione um aluno para abrir o painel lateral.</p>
          </div>
        )}
      </div>
    </div>
  );
}
