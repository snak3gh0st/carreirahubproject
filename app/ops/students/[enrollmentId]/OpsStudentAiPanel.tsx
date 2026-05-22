"use client";

import { useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Bot, Loader2, MessageCircle, Send } from "lucide-react";

function extractText(message: any) {
  return (message.parts ?? [])
    .filter((part: any) => part.type === "text")
    .map((part: any) => part.text)
    .join("");
}

export function OpsStudentAiPanel({
  enrollmentId,
  studentName,
  currentPhase,
  ownerName,
}: {
  enrollmentId: string;
  studentName: string;
  currentPhase: string | null | undefined;
  ownerName: string | null | undefined;
}) {
  const [text, setText] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/dashboard/ai/chat" }), []);
  const { messages, sendMessage, status, error } = useChat({ transport } as any);
  const isStreaming = status === "streaming" || status === "submitted";
  const opsContext = [
    `Aluno selecionado: ${studentName}`,
    `Enrollment ID: ${enrollmentId}`,
    `Fase atual: ${currentPhase ?? "sem fase"}`,
    `Responsável: ${ownerName ?? "sem responsável"}`,
    "Use getStudentOperationalIntelligence para responder perguntas sobre este aluno.",
  ].join(" | ");

  async function ensureConversation(prompt: string) {
    if (conversationId) return conversationId;

    const response = await fetch("/api/dashboard/ai/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hub: "operational", title: `Aluno - ${studentName}: ${prompt.slice(0, 40)}` }),
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
    if (!trimmed || isStreaming) return;
    setText("");
    const id = await ensureConversation(trimmed);
    (sendMessage as any)(
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
  }

  const suggestions = [
    "Resuma o caso operacional deste aluno com pendências e próxima ação.",
    "Quantas sessões e mock interviews este aluno já realizou? Separe por responsável.",
    "Liste aplicações, entrevistas e status deste aluno.",
  ];

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-brand-verde" />
          <h2 className="text-base font-display font-semibold text-brand-verde">IA interna do aluno</h2>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Pergunte sobre histórico, sessões, documentos, entrevistas, comentários internos e próximos passos.
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
                disabled={isStreaming}
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
                    <div className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-brand-verde">
                      <Bot className="h-3 w-3" />
                      Operacional AI
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{content}</p>
                </div>
              </div>
            );
          })
        )}

        {isStreaming && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Consultando dados internos do aluno...
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
            placeholder="Pergunte algo sobre este aluno..."
            rows={2}
            disabled={isStreaming}
            className="min-h-[44px] flex-1 resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-verde focus:ring-2 focus:ring-brand-verde/10 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void ask(text)}
            disabled={isStreaming || !text.trim()}
            className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-verde text-white transition-opacity disabled:opacity-40"
            aria-label="Enviar pergunta para IA"
          >
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </section>
  );
}
