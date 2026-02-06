"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, X, UserCircle, Bot, HeadphonesIcon, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Message {
  id: string;
  role: "USER" | "AI" | "AGENT";
  content: string;
  createdAt: string;
}

interface SupportChatWidgetProps {
  userId: string;
  userName: string;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, { label: string; variant: "info" | "warning" | "success" | "default" }> = {
  AI_HANDLING: { label: "IA", variant: "info" },
  ESCALATED: { label: "Escalado", variant: "warning" },
  IN_PROGRESS: { label: "Em Andamento", variant: "warning" },
  RESOLVED: { label: "Resolvido", variant: "success" },
  CLOSED: { label: "Encerrado", variant: "default" },
};

export function SupportChatWidget({ userId, userName, onClose }: SupportChatWidgetProps) {
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string>("AI_HANDLING");
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load existing active ticket
  useEffect(() => {
    async function loadTickets() {
      try {
        const res = await fetch("/api/support/tickets");
        const data = await res.json();
        if (data.tickets?.length > 0) {
          // Find first non-resolved/closed ticket
          const active = data.tickets.find(
            (t: any) => !["RESOLVED", "CLOSED"].includes(t.status)
          );
          if (active) {
            setTicketId(active.id);
            setStatus(active.status);
            // Load messages
            const msgRes = await fetch(`/api/support/tickets/${active.id}/messages`);
            const msgData = await msgRes.json();
            if (msgData.messages) {
              setMessages(msgData.messages);
            }
          }
        }
      } catch (error) {
        console.error("Failed to load tickets:", error);
      } finally {
        setLoading(false);
      }
    }
    loadTickets();
  }, []);

  // Poll for new messages
  useEffect(() => {
    if (!ticketId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/support/tickets/${ticketId}/messages`);
        const data = await res.json();
        if (data.messages) {
          setMessages(data.messages);
        }
        if (data.status) {
          setStatus(data.status);
        }
      } catch (error) {
        // Silently fail polling
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [ticketId]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput("");
    setError(null);
    setSending(true);

    // Optimistic UI: show user message immediately
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      role: "USER",
      content: msg,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, message: msg }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setError(data.error || "Erro ao enviar mensagem. Tente novamente.");
        return;
      }

      if (data.ticketId) {
        setTicketId(data.ticketId);
      }
      if (data.status) {
        setStatus(data.status);
      }
      if (data.messages) {
        // Replace optimistic user message with real messages from API
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempId),
          ...data.messages,
        ]);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      // Remove optimistic message on network error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError("Falha na conexao. Verifique sua internet e tente novamente.");
    } finally {
      setSending(false);
    }
  }, [input, sending, ticketId]);

  const handleEscalate = async () => {
    if (!ticketId) return;
    try {
      await fetch(`/api/support/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ESCALATED" }),
      });
      setStatus("ESCALATED");
    } catch (error) {
      console.error("Failed to escalate:", error);
    }
  };

  const startConversation = () => {
    setStarted(true);
    // Ticket will be created on first message
  };

  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS.AI_HANDLING;

  return (
    <div className="fixed bottom-24 right-6 z-50 w-[380px] h-[500px] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-secondary-dark px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <HeadphonesIcon className="h-5 w-5 text-gold-500" />
          <span className="text-white font-semibold text-sm">Suporte</span>
          {ticketId && (
            <Badge variant={statusInfo.variant} className="text-[10px] px-2 py-0.5">
              {statusInfo.label}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {ticketId && (
            <button
              onClick={() => { setTicketId(null); setMessages([]); setStatus("AI_HANDLING"); setStarted(false); }}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Nova Conversa"
              title="Nova Conversa"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin h-6 w-6 border-2 border-gold-600 border-t-transparent rounded-full" />
        </div>
      ) : !ticketId && messages.length === 0 && !started ? (
        /* Welcome screen */
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <HeadphonesIcon className="h-12 w-12 text-gold-500 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Como podemos ajudar?
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            Nosso assistente virtual esta pronto para ajudar com suas duvidas sobre programas, pagamentos e processos.
          </p>
          <button
            onClick={startConversation}
            className="bg-gold-600 hover:bg-gold-700 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-colors"
          >
            Iniciar Conversa
          </button>
        </div>
      ) : (
        /* Messages */
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "USER" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[85%] ${msg.role === "USER" ? "order-1" : "order-1"}`}>
                {msg.role !== "USER" && (
                  <div className="flex items-center gap-1 mb-1">
                    {msg.role === "AI" ? (
                      <Bot className="h-3 w-3 text-gray-400" />
                    ) : (
                      <UserCircle className="h-3 w-3 text-success-600" />
                    )}
                    <span className="text-[10px] text-gray-400 font-medium">
                      {msg.role === "AI" ? "Assistente IA" : "Equipe Sigma"}
                    </span>
                  </div>
                )}
                <div
                  className={`px-3 py-2 rounded-lg text-sm leading-relaxed ${
                    msg.role === "USER"
                      ? "bg-gold-600 text-white rounded-br-none"
                      : msg.role === "AGENT"
                      ? "bg-success-50 text-gray-800 border border-success-200 rounded-bl-none"
                      : "bg-gray-100 text-gray-800 rounded-bl-none"
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-gray-300 mt-0.5 block">
                  {new Date(msg.createdAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          ))}
          {error && (
            <div className="flex justify-center">
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg text-xs text-center max-w-[90%]">
                {error}
              </div>
            </div>
          )}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-gray-100 px-3 py-2 rounded-lg text-sm text-gray-400">
                Digitando...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Footer - input area */}
      {(ticketId || started) && !["RESOLVED", "CLOSED"].includes(status) && (
        <div className="border-t border-gray-200 px-3 py-2 flex-shrink-0">
          {/* Escalation button */}
          {status === "AI_HANDLING" && ticketId && (
            <button
              onClick={handleEscalate}
              className="text-[11px] text-gray-400 hover:text-gold-600 mb-2 flex items-center gap-1 transition-colors"
            >
              <UserCircle className="h-3 w-3" />
              Falar com um Humano
            </button>
          )}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Digite sua mensagem..."
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold-500 focus:border-gold-500"
              disabled={sending}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="bg-gold-600 hover:bg-gold-700 disabled:opacity-50 text-white p-2 rounded-lg transition-colors"
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Resolved/Closed state + New Conversation button */}
      {["RESOLVED", "CLOSED"].includes(status) && (
        <div className="border-t border-gray-200 px-4 py-3 text-center flex-shrink-0">
          <p className="text-sm text-gray-500 mb-2">
            Este ticket foi {status === "RESOLVED" ? "resolvido" : "encerrado"}.
          </p>
          <button
            onClick={() => { setTicketId(null); setMessages([]); setStatus("AI_HANDLING"); setStarted(false); }}
            className="bg-gold-600 hover:bg-gold-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova Conversa
          </button>
        </div>
      )}
    </div>
  );
}
