"use client";

import { useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Bot, Loader2, MessageCircle, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function extractText(message: any) {
  return (message.parts ?? [])
    .filter((part: any) => part.type === "text")
    .map((part: any) => part.text)
    .join("");
}

export function OpsStudentAiPanel({
  enrollmentId,
  customerName,
  currentPhase,
  ownerName,
}: {
  enrollmentId: string;
  customerName: string;
  currentPhase: string | null | undefined;
  ownerName: string | null | undefined;
}) {
  const [text, setText] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isSendPending, setIsSendPending] = useState(false);
  const sendInFlightRef = useRef(false);
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/dashboard/ai/chat" }), []);
  const { messages, sendMessage, status, error } = useChat({ transport } as any);
  const isStreaming = status === "streaming" || status === "submitted";
  const isBusy = isStreaming || isSendPending;
  const opsContext = [
    `Cliente selecionado: ${customerName}`,
    `Enrollment ID: ${enrollmentId}`,
    `Fase atual: ${currentPhase ?? "sem fase"}`,
    `Responsável: ${ownerName ?? "sem responsável"}`,
    "Use getStudentOperationalIntelligence para responder perguntas sobre este cliente.",
  ].join(" | ");

  async function ensureConversation(prompt: string) {
    if (conversationId) return conversationId;

    const response = await fetch("/api/dashboard/ai/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hub: "operational", title: `Cliente - ${customerName}: ${prompt.slice(0, 40)}` }),
    });
    if (!response.ok) throw new Error("Falha ao criar conversa da IA.");
    const payload = await response.json();
    const id = payload?.conversation?.id as string | undefined;
    if (!id) throw new Error("Conversa criada sem id.");
    setConversationId(id);
    return id;
  }

  async function ask(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed || isBusy || sendInFlightRef.current) return;
    sendInFlightRef.current = true;
    setIsSendPending(true);
    try {
      setText("");
      const id = await ensureConversation(trimmed);
      await (sendMessage as any)(
        { text: trimmed },
        {
          body: {
            conversationId: id,
            pathname: `/ops/students/${enrollmentId}`,
            params: { enrollmentId },
            hub: "operational",
            opsContext,
          },
        }
      );
    } finally {
      sendInFlightRef.current = false;
      setIsSendPending(false);
    }
  }

  const suggestions = [
    "Monte a ficha completa deste cliente com cadastro, programa, financeiro, fase, pendências e próxima ação.",
    "Quantas sessões e mock interviews este cliente já realizou? Separe por responsável.",
    "Liste aplicações, entrevistas, status e links faltantes deste cliente.",
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gray-50/70 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-brand-verde" />
            <h2 className="text-base font-display font-semibold text-brand-verde">IA interna do cliente</h2>
          </div>
          <span className="rounded-full border border-brand-verde/15 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-verde">
            contexto completo
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Pergunte sobre cadastro, financeiro, histórico, sessões, documentos, entrevistas, comentários internos e próximos passos.
        </p>
      </div>

      <div className="max-h-[420px] space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
        {messages.length === 0 ? (
          <div className="space-y-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => void ask(suggestion)}
                disabled={isBusy}
                className="block w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-600 transition-colors hover:border-brand-verde/30 hover:bg-brand-verde/5 disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : (
          messages.map((message: any) => {
            const content = extractText(message);
            if (!content) return null;
            const isUser = message.role === "user";
            return (
              <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[92%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                    isUser
                      ? "bg-brand-verde text-white"
                      : "border border-gray-100 bg-gray-50 text-gray-700"
                  }`}
                >
                  {!isUser && (
                    <div className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-brand-verde">
                      <Bot className="h-3 w-3" />
                      Operacional AI
                    </div>
                  )}
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{content}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none prose-headings:mb-2 prose-headings:mt-3 prose-headings:text-gray-900 prose-p:my-2 prose-ul:my-2 prose-li:my-0 prose-strong:text-gray-900 prose-table:my-3 prose-th:border prose-th:border-gray-200 prose-th:bg-white prose-th:px-2 prose-th:py-1 prose-td:border prose-td:border-gray-200 prose-td:px-2 prose-td:py-1">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {isBusy && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Consultando dados internos do cliente...
          </div>
        )}
        {error && <p className="text-xs text-red-500">Erro ao consultar a IA. Verifique se o AI Copilot está habilitado.</p>}
      </div>

      <div className="border-t border-gray-100 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value.slice(0, 2000))}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void ask(text);
              }
            }}
            placeholder="Pergunte algo sobre este cliente..."
            rows={2}
            disabled={isBusy}
            className="min-h-[44px] flex-1 resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-verde focus:ring-2 focus:ring-brand-verde/10 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void ask(text)}
            disabled={isBusy || !text.trim()}
            className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-verde text-white transition-opacity disabled:opacity-40"
            aria-label="Enviar pergunta para IA"
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </section>
  );
}
