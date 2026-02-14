"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, X, UserCircle, Bot, HeadphonesIcon, Plus, List, Trash2, ArrowLeft, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Message {
  id: string;
  role: "USER" | "AI" | "AGENT";
  content: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  subject: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  messages: { content: string }[];
  _count: { messages: number };
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

function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "hoje";
  if (diffDays === 1) return "ontem";
  if (diffDays < 30) return `${diffDays} dias atras`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} meses atras`;
  return `${Math.floor(diffDays / 365)} anos atras`;
}

export function SupportChatWidget({ userId, userName, onClose }: SupportChatWidgetProps) {
  const [view, setView] = useState<"welcome" | "chat" | "tickets">("welcome");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string>("AI_HANDLING");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEscalationInput, setShowEscalationInput] = useState(false);
  const [escalationMessage, setEscalationMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadAllTickets = useCallback(async () => {
    try {
      const res = await fetch("/api/support/tickets");
      const data = await res.json();
      if (data.tickets) {
        setAllTickets(data.tickets);
      }
      return data.tickets || [];
    } catch (error) {
      console.error("Failed to load tickets:", error);
      return [];
    }
  }, []);

  // Load existing tickets on mount
  useEffect(() => {
    async function init() {
      const tickets = await loadAllTickets();
      if (tickets.length > 0) {
        // Find first active ticket
        const active = tickets.find(
          (t: Ticket) => !["RESOLVED", "CLOSED"].includes(t.status)
        );
        if (active) {
          setTicketId(active.id);
          setStatus(active.status);
          setView("chat");
          // Load messages
          const msgRes = await fetch(`/api/support/tickets/${active.id}/messages`);
          const msgData = await msgRes.json();
          if (msgData.messages) {
            setMessages(msgData.messages);
          }
        }
      }
      setLoading(false);
    }
    init();
  }, [loadAllTickets]);

  // Poll for new messages
  useEffect(() => {
    if (!ticketId || view !== "chat") return;
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
  }, [ticketId, view]);

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
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempId),
          ...data.messages,
        ]);
      }
      // Refresh tickets list in background
      loadAllTickets();
    } catch (err) {
      console.error("Failed to send message:", err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError("Falha na conexao. Verifique sua internet e tente novamente.");
    } finally {
      setSending(false);
    }
  }, [input, sending, ticketId, loadAllTickets]);

  const handleEscalate = async () => {
    if (!ticketId) return;
    try {
      await fetch(`/api/support/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ESCALATED", message: escalationMessage.trim() || undefined }),
      });
      setStatus("ESCALATED");
      setShowEscalationInput(false);
      setEscalationMessage("");
      // Add feedback message locally so user sees confirmation immediately
      const feedbackMsg: Message = {
        id: `escalate-${Date.now()}`,
        role: "AI",
        content:
          "Sua conversa foi transferida para a equipe Sigma. Um membro da equipe vai responder em breve. Voce sera notificado aqui mesmo quando houver uma resposta. Obrigado pela paciencia! 🙏",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, feedbackMsg]);
    } catch (error) {
      console.error("Failed to escalate:", error);
    }
  };

  const startNewConversation = () => {
    setTicketId(null);
    setMessages([]);
    setStatus("AI_HANDLING");
    setView("chat");
  };

  const switchToTicket = async (id: string) => {
    setView("chat");
    setTicketId(id);
    const ticket = allTickets.find((t) => t.id === id);
    if (ticket) setStatus(ticket.status);
    try {
      const res = await fetch(`/api/support/tickets/${id}/messages`);
      const data = await res.json();
      if (data.messages) setMessages(data.messages);
    } catch (err) {
      console.error("Failed to load ticket messages:", err);
    }
  };

  const deleteTicket = async (id: string) => {
    try {
      await fetch(`/api/support/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED" }),
      });
      await loadAllTickets();
      if (id === ticketId) {
        setView("tickets");
        setTicketId(null);
        setMessages([]);
      }
    } catch (error) {
      console.error("Failed to close ticket:", error);
      setError("Erro ao fechar ticket");
    }
  };

  const openTickets = allTickets.filter((t) => !["RESOLVED", "CLOSED"].includes(t.status));
  const closedTickets = allTickets.filter((t) => ["RESOLVED", "CLOSED"].includes(t.status));

  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS.AI_HANDLING;

  const renderTicketCard = (ticket: Ticket, grayed = false) => {
    const tStatus = STATUS_LABELS[ticket.status] || STATUS_LABELS.AI_HANDLING;
    const lastMsg = ticket.messages?.[0]?.content || "";
    const preview = lastMsg.length > 50 ? lastMsg.slice(0, 50) + "..." : lastMsg;
    return (
      <div
        key={ticket.id}
        className={`${grayed ? "bg-gray-100 opacity-60" : "bg-gray-50 hover:bg-gray-100"} p-3 rounded-lg cursor-pointer relative group`}
      >
        <div onClick={() => switchToTicket(ticket.id)}>
          <div className="flex items-start justify-between mb-1 pr-6">
            <span className={`font-medium text-sm ${grayed ? "text-gray-400" : "text-gray-900"}`}>
              {ticket.subject || "Sem assunto"}
            </span>
            <Badge variant={tStatus.variant} className="text-[10px] px-1.5 py-0 flex-shrink-0">
              {tStatus.label}
            </Badge>
          </div>
          {preview && (
            <p className="text-xs text-gray-500 mb-1 line-clamp-1">{preview}</p>
          )}
          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <span>{ticket._count?.messages || 0} mensagens</span>
            <span>{relativeTime(ticket.createdAt)}</span>
          </div>
        </div>
        {!["CLOSED"].includes(ticket.status) && (
          <button
            onClick={(e) => { e.stopPropagation(); deleteTicket(ticket.id); }}
            className="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Fechar ticket"
            title="Fechar ticket"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="fixed bottom-24 right-6 z-50 w-[380px] h-[500px] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-secondary-dark px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          {view === "tickets" && (
            <button
              onClick={() => ticketId ? setView("chat") : setView("welcome")}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <HeadphonesIcon className="h-5 w-5 text-gold-500" />
          <span className="text-white font-semibold text-sm">
            {view === "tickets" ? "Meus Tickets" : "Suporte"}
          </span>
          {view === "chat" && ticketId && (
            <Badge variant={statusInfo.variant} className="text-[10px] px-2 py-0.5">
              {statusInfo.label}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {view === "chat" && (
            <button
              onClick={() => { loadAllTickets(); setView("tickets"); }}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Meus Tickets"
              title="Meus Tickets"
            >
              <List className="h-4 w-4" />
            </button>
          )}
          {view === "chat" && ticketId && (
            <button
              onClick={startNewConversation}
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
      ) : view === "welcome" ? (
        /* Welcome screen */
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <HeadphonesIcon className="h-12 w-12 text-gold-500 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Como podemos ajudar?
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            Nosso assistente virtual esta pronto para ajudar com suas duvidas sobre programas, pagamentos e processos.
          </p>
          <div className="flex flex-col gap-2 w-full max-w-[200px]">
            <button
              onClick={startNewConversation}
              className="bg-gold-600 hover:bg-gold-700 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-colors"
            >
              Iniciar Conversa
            </button>
            {allTickets.length > 0 && (
              <button
                onClick={() => { loadAllTickets(); setView("tickets"); }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Meus Tickets ({allTickets.length})
              </button>
            )}
          </div>
        </div>
      ) : view === "tickets" ? (
        /* Tickets list view */
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {openTickets.length === 0 && closedTickets.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-8 w-8 text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">Nenhum ticket encontrado</p>
            </div>
          ) : (
            <>
              {openTickets.map((ticket) => renderTicketCard(ticket))}
              {closedTickets.length > 0 && (
                <div className="pt-2 border-t border-gray-200">
                  <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Encerrados</h4>
                  {closedTickets.map((ticket) => renderTicketCard(ticket, true))}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* Messages (chat view) */
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "USER" ? "justify-end" : "justify-start"}`}
            >
              <div className="max-w-[85%]">
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

      {/* Footer - input area (chat view only) */}
      {view === "chat" && (!ticketId || !["RESOLVED", "CLOSED"].includes(status)) && (
        <div className="border-t border-gray-200 px-3 py-2 flex-shrink-0">
          {/* Escalation button / input */}
          {status === "AI_HANDLING" && ticketId && !showEscalationInput && (
            <button
              onClick={() => setShowEscalationInput(true)}
              className="text-[11px] text-gray-400 hover:text-gold-600 mb-2 flex items-center gap-1 transition-colors"
            >
              <UserCircle className="h-3 w-3" />
              Falar com um Humano
            </button>
          )}
          {showEscalationInput && (
            <div className="mb-2 space-y-2">
              <textarea
                value={escalationMessage}
                onChange={(e) => setEscalationMessage(e.target.value)}
                placeholder="Descreva o que precisa..."
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold-500 focus:border-gold-500 resize-none"
                rows={2}
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleEscalate}
                  className="bg-gold-600 hover:bg-gold-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                >
                  Enviar para equipe
                </button>
                <button
                  onClick={() => { setShowEscalationInput(false); setEscalationMessage(""); }}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
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

      {/* Resolved/Closed state + New Conversation button (chat view only) */}
      {view === "chat" && ticketId && ["RESOLVED", "CLOSED"].includes(status) && (
        <div className="border-t border-gray-200 px-4 py-3 text-center flex-shrink-0">
          <p className="text-sm text-gray-500 mb-2">
            Este ticket foi {status === "RESOLVED" ? "resolvido" : "encerrado"}.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => { loadAllTickets(); setView("tickets"); }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5"
            >
              <List className="h-3.5 w-3.5" />
              Meus Tickets
            </button>
            <button
              onClick={startNewConversation}
              className="bg-gold-600 hover:bg-gold-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova Conversa
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
