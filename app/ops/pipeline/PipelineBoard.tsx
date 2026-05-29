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
  X,
  UserRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
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
type ProductFilter = "all" | "PASS" | "ADVANCED" | "EARLY_CAREER";

const PRODUCT_LABELS: Record<Exclude<ProductFilter, "all">, string> = {
  PASS: "Programa Pass",
  ADVANCED: "Pass Advanced",
  EARLY_CAREER: "Early Career",
};

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
  const marker = getOperationalStart(enrollment).date;
  return Math.max(0, differenceInDays(new Date(), new Date(marker)));
}

function getOperationalStart(enrollment: EnrollmentCard) {
  const signedContract = enrollment.customer.contracts?.find((contract) => contract.signedAt);
  if (signedContract?.signedAt) {
    return {
      date: signedContract.signedAt,
      source: "Contrato assinado DocuSign",
    };
  }

  const transitionDate = enrollment.transitions[0]?.createdAt;
  if (transitionDate) {
    return {
      date: transitionDate,
      source: "Entrada na fase",
    };
  }

  return {
    date: enrollment.startDate,
    source: "Inicio da mentoria",
  };
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
  const operationalStart = getOperationalStart(enrollment);
  const renewalDate = enrollment.opsProfile?.renewalDate
    ? new Date(enrollment.opsProfile.renewalDate)
    : null;
  const renewalInDays = renewalDate ? differenceInDays(renewalDate, new Date()) : null;
  const slaPercent = phase.slaDays > 0 ? Math.min(Math.round((phaseAgeDays / phase.slaDays) * 100), 100) : 0;

  const slaOverdue = phaseAgeDays > phase.slaDays;
  const hasRisk = Boolean(risk);
  const hasDebt = paymentAlert.level === "red";
  const showRenewal = renewalInDays !== null && renewalInDays <= 30;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={`group relative flex w-full items-center gap-3 px-4 py-3 text-left transition focus:outline-none focus-visible:bg-gray-50 md:gap-4 md:px-5 md:py-3.5 ${
        selected ? "bg-[#F5F7F5]" : "hover:bg-gray-50"
      }`}
    >
      {selected && (
        <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-brand-verde" />
      )}
      <div
        aria-hidden
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold tracking-wide ${
          hasRisk || hasDebt
            ? "bg-orange-50 text-brand-tangerina ring-1 ring-orange-100"
            : "bg-gray-100 text-gray-700"
        }`}
      >
        {initials(enrollment.customer.name)}
      </div>

      <div className="min-w-0 flex-1">
        {/* Line 1: name + program + risk inline */}
        <div className="flex items-baseline gap-2">
          <p className="truncate text-[14px] font-semibold text-gray-900">
            {enrollment.customer.name}
          </p>
          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
            {enrollment.programType}
          </span>
        </div>

        {/* Line 2: meta + signal badges */}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-gray-500">
          <span className="tabular-nums">
            {enrollment._count.sessions} sessão
            {enrollment._count.sessions !== 1 ? "ões" : ""}
          </span>
          <span className="tabular-nums">
            {daysSinceLastSession === null ? "sem sessão" : `${daysSinceLastSession}d sem sessão`}
          </span>
          <span className="hidden truncate sm:inline">
            {enrollment.assignedTo.name ?? "Sem responsável"}
          </span>
          {hasRisk && (
            <span className="inline-flex items-center gap-1 font-semibold text-brand-tangerina">
              <AlertTriangle className="h-3 w-3" strokeWidth={2} />
              {risk}
            </span>
          )}
          {hasDebt && (
            <span className="inline-flex items-center gap-1 font-semibold text-red-600">
              <WalletCards className="h-3 w-3" strokeWidth={2} />
              {paymentAlert.label}
            </span>
          )}
          {showRenewal && (
            <span className="inline-flex items-center gap-1 font-medium text-amber-700">
              <Clock className="h-3 w-3" strokeWidth={2} />
              Renovar {renewalInDays < 0 ? "vencido" : `em ${renewalInDays}d`}
            </span>
          )}
        </div>
      </div>

      {/* Right cluster: SLA + checklist as tiny inline bars */}
      <div className="hidden flex-shrink-0 items-center gap-4 md:flex">
        <div className="w-[100px]">
          <div className="mb-1 flex items-baseline justify-between text-[10px] text-gray-400">
            <span className="font-medium uppercase tracking-wide">SLA</span>
            <span className="tabular-nums">{phaseAgeDays}/{phase.slaDays}d</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full transition-all ${slaOverdue ? "bg-brand-tangerina" : "bg-brand-verde"}`}
              style={{ width: `${slaPercent}%` }}
            />
          </div>
        </div>
        {progress.total > 0 && (
          <div className="w-[80px]">
            <div className="mb-1 flex items-baseline justify-between text-[10px] text-gray-400">
              <span className="font-medium uppercase tracking-wide">Checklist</span>
              <span className="tabular-nums">{progress.percent}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full bg-brand-verde/60"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <ArrowRight
        className={`h-4 w-4 flex-shrink-0 transition ${
          selected ? "text-brand-verde" : "text-gray-300 group-hover:translate-x-0.5 group-hover:text-brand-verde"
        }`}
        strokeWidth={1.75}
      />
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
          Handoff do time para quem assumir este cliente depois.
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
          placeholder="Ex: cliente pediu reagendamento; cobrar formulario antes da proxima sessao..."
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
          placeholder={hasPhone ? "Mensagem para o cliente via Digisac..." : "Cadastre um telefone para enviar"}
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
  const [isSummaryPending, setIsSummaryPending] = useState(false);
  const summaryInFlightRef = useRef(false);
  const isBusy = isStreaming || isSummaryPending;
  const summaryPrompt =
    "Sumarize o caso operacional deste cliente em no maximo 7 linhas curtas. Use texto puro, sem Markdown, sem negrito, sem emoji, sem tabela, sem separadores e sem pipes. Comece cada linha com um rotulo simples: Fase atual, Risco, Ultima sessao, Aplicacoes/entrevistas, Material/CV, Pendencias, Proxima acao. Nao inclua leitura estrategica, visao CEO, nomes de tools, IDs internos ou erros tecnicos.";
  const opsContext = [
    `Cliente: ${enrollment.customer.name}`,
    `Enrollment ID: ${enrollment.id}`,
    `Customer ID: ${enrollment.customer.id}`,
    `Fase atual: ${phase.label} (${phase.key})`,
    `Responsavel: ${enrollment.assignedTo.name ?? "Sem nome"}`,
    `Programa: ${enrollment.programType}`,
    `Atividades recentes: ${enrollment.opsActivities.length}`,
    `Renovacao: ${enrollment.opsProfile?.renewalDate ?? "sem data"}`,
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
    if (isBusy || summaryInFlightRef.current) return;
    summaryInFlightRef.current = true;
    setIsSummaryPending(true);
    try {
      setMessages([]);
      const resolvedConversationId = await createSummaryConversation();
      await (sendMessage as any)(
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
    } finally {
      summaryInFlightRef.current = false;
      setIsSummaryPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-brand-verde" />
          <h3 className="text-sm font-display font-semibold text-gray-900">Resumo AI do cliente</h3>
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
        {isBusy && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Lendo dados do cliente...
          </div>
        )}
        {error && <p className="text-xs text-red-500">Erro no chat. Verifique se o AI Copilot esta habilitado.</p>}
      </div>

      <div className="border-t border-gray-50 p-3">
        <button
          type="button"
          onClick={() => void summarizeStudent()}
          disabled={isBusy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-verde px-3 py-2 text-xs font-semibold text-white transition-opacity disabled:opacity-40"
        >
          {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
          Sumarizar caso do cliente
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
  const operationalStart = getOperationalStart(enrollment);
  const daysSinceLastSession = getDaysSinceLastSession(enrollment);
  const progress = getChecklistProgress(phase, enrollment);
  const nextPhase = phases.find((p) => p.sortOrder === phase.sortOrder + 1);
  const paymentAlert = getPaymentAlert(enrollment);

  function advance() {
    if (!nextPhase) {
      toast.error("Este cliente ja esta na ultima fase.");
      return;
    }
    advanceMutation.mutate(
      { enrollmentId: enrollment.id, toPhaseId: nextPhase.id },
      {
        onSuccess: () => toast.success(`Cliente movido para ${nextPhase.label}`),
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
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Dias considerados</p>
            <p className="mt-1 text-sm font-semibold text-gray-800">{phaseAgeDays} de {phase.slaDays} dias</p>
            <p className="mt-1 text-[10px] text-gray-400">{operationalStart.source}</p>
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
  const [productFilter, setProductFilter] = useState<ProductFilter>("all");
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
          if (productFilter !== "all" && enrollment.programType !== productFilter) return false;
          if (filter === "mine") return enrollment.assignedTo.id === currentUserId;
          if (filter === "risk") return Boolean(getRiskLabel(phase, enrollment));
          if (filter === "debt") return getPaymentAlert(enrollment).level === "red";
          return true;
        });
        return { ...phase, enrollments };
      })
      .filter((phase) => phase.enrollments.length > 0);
  }, [currentUserId, filter, productFilter, phases, search]);

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
      clients: all.length,
      mine: all.filter(({ enrollment }) => enrollment.assignedTo.id === currentUserId).length,
      risk: all.filter(({ phase, enrollment }) => Boolean(getRiskLabel(phase, enrollment))).length,
      debt: all.filter(({ enrollment }) => getPaymentAlert(enrollment).level === "red").length,
      pass: all.filter(({ enrollment }) => enrollment.programType === "PASS").length,
      advanced: all.filter(({ enrollment }) => enrollment.programType === "ADVANCED").length,
      earlyCareer: all.filter(({ enrollment }) => enrollment.programType === "EARLY_CAREER").length,
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

  const filterOptions: Array<{ key: FilterMode; label: string; value: number }> = [
    { key: "all", label: "Todos", value: totals.clients },
    { key: "mine", label: "Meus", value: totals.mine },
    { key: "risk", label: "Em risco", value: totals.risk },
    { key: "debt", label: "Inadimplentes", value: totals.debt },
  ];

  const productOptions: Array<{ key: ProductFilter; label: string; value: number }> = [
    { key: "all", label: "Todos os produtos", value: totals.clients },
    { key: "PASS", label: PRODUCT_LABELS.PASS, value: totals.pass },
    { key: "ADVANCED", label: PRODUCT_LABELS.ADVANCED, value: totals.advanced },
    { key: "EARLY_CAREER", label: PRODUCT_LABELS.EARLY_CAREER, value: totals.earlyCareer },
  ];

  return (
    <div className="grid min-h-0 grid-cols-1 gap-6 xl:h-full xl:grid-cols-[minmax(0,1fr)_390px]">
      <div className="min-w-0 xl:min-h-0 xl:overflow-y-auto xl:pr-2">
        {/* Toolbar: search + segmented filter */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" strokeWidth={1.75} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar cliente, email ou responsável"
              className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-[14px] text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-brand-verde focus:ring-2 focus:ring-brand-verde/10"
            />
          </div>
          <div
            role="tablist"
            aria-label="Filtro"
            className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-0.5"
          >
            {filterOptions.map((item) => (
              <button
                key={item.key}
                role="tab"
                aria-selected={filter === item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`relative inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-verde/40 ${
                  filter === item.key
                    ? "bg-brand-verde text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <span>{item.label}</span>
                <span
                  className={`tabular-nums text-[11px] font-semibold ${
                    filter === item.key ? "text-white/75" : "text-gray-400"
                  }`}
                >
                  {item.value}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Product filter (second row) */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div
            role="tablist"
            aria-label="Produto"
            className="inline-flex flex-wrap items-center rounded-lg border border-gray-200 bg-white p-0.5"
          >
            {productOptions.map((item) => (
              <button
                key={item.key}
                role="tab"
                aria-selected={productFilter === item.key}
                type="button"
                onClick={() => setProductFilter(item.key)}
                className={`relative inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-verde/40 ${
                  productFilter === item.key
                    ? "bg-brand-verde text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <span>{item.label}</span>
                <span
                  className={`tabular-nums text-[11px] font-semibold ${
                    productFilter === item.key ? "text-white/75" : "text-gray-400"
                  }`}
                >
                  {item.value}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-snug text-gray-400">
            Combo, Construção de Material, Avulso e Consultoria entrarão quando virarem matrículas rastreadas.
          </p>
        </div>

        {/* Phase sections */}
        <div className="space-y-7">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-gray-200/60 bg-white px-8 py-16 text-center">
              <p className="text-[14px] text-gray-500">Nenhum cliente para este filtro.</p>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
                className="mt-3 text-[13px] font-medium text-brand-verde underline-offset-2 hover:underline"
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            filtered.map((phase) => (
              <section key={phase.id}>
                <header className="mb-2 flex items-baseline justify-between gap-3 px-1">
                  <div className="flex items-baseline gap-3">
                    <h2 className="text-[14px] font-semibold text-gray-900">{phase.label}</h2>
                    <span className="text-[12px] text-gray-400 tabular-nums">
                      {phase.enrollments.length} · SLA {phase.slaDays}d
                    </span>
                  </div>
                </header>
                <ul className="overflow-hidden rounded-xl border border-gray-200/60 bg-white">
                  {phase.enrollments.map((enrollment, idx) => (
                    <li key={enrollment.id} className={idx === 0 ? "" : "border-t border-gray-100"}>
                      <StudentRow
                        phase={phase}
                        enrollment={enrollment}
                        selected={selected?.enrollment.id === enrollment.id}
                        onSelect={() => setSelectedId(enrollment.id)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>

      <div className="hidden min-w-0 xl:block xl:min-h-0 xl:overflow-y-auto xl:pr-1">
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
            <p className="text-sm text-gray-400">Selecione um cliente para abrir o painel lateral.</p>
          </div>
        )}
      </div>

      {selectedId && selected && (
        <div className="fixed inset-0 z-50 bg-gray-950/35 xl:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-default"
            aria-label="Fechar detalhe do cliente"
            onClick={() => setSelectedId(null)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[86dvh] overflow-hidden rounded-t-3xl bg-gray-50 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Detalhe do cliente</p>
                <p className="truncate text-sm font-display font-bold text-gray-900">
                  {selected.enrollment.customer.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[calc(86dvh-64px)] overflow-y-auto p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              <StudentDetail
                phase={selected.phase}
                enrollment={selected.enrollment}
                phases={phases}
                currentUserRole={currentUserRole}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
