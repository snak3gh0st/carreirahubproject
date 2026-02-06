"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Send, ArrowLeft, CheckCircle, Bot, UserCircle, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { BadgeVariant } from "@/components/ui/badge";

interface Message {
  id: string;
  role: "USER" | "AI" | "AGENT";
  content: string;
  createdAt: string;
}

interface TicketData {
  id: string;
  subject: string | null;
  status: string;
  priority: string;
  createdAt: string;
  escalatedAt: string | null;
  resolvedAt: string | null;
  user: { id: string; name: string | null; email: string };
  assignedTo: { name: string | null } | null;
  messages: Message[];
}

const STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  AI_HANDLING: { label: "IA Atendendo", variant: "info" },
  ESCALATED: { label: "Escalado", variant: "warning" },
  IN_PROGRESS: { label: "Em Andamento", variant: "pending" },
  RESOLVED: { label: "Resolvido", variant: "success" },
  CLOSED: { label: "Encerrado", variant: "default" },
};

export function TicketChatView({ ticketId }: { ticketId: string }) {
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load ticket
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/support/tickets/${ticketId}`);
        const data = await res.json();
        if (data.ticket) {
          setTicket(data.ticket);
          setMessages(data.ticket.messages || []);
        }
      } catch (error) {
        console.error("Failed to load ticket:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [ticketId]);

  // Poll for new messages
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/support/tickets/${ticketId}/messages`);
        const data = await res.json();
        if (data.messages) setMessages(data.messages);
        if (data.status && ticket) {
          setTicket((prev) => prev ? { ...prev, status: data.status } : prev);
        }
      } catch (error) {
        // Silent fail
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [ticketId, ticket]);

  const sendReply = async () => {
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput("");
    setSending(true);

    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: msg }),
      });
      const data = await res.json();
      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
        if (ticket) {
          setTicket((prev) => prev ? { ...prev, status: "IN_PROGRESS" } : prev);
        }
      }
    } catch (error) {
      console.error("Failed to send reply:", error);
    } finally {
      setSending(false);
    }
  };

  const resolveTicket = async () => {
    try {
      await fetch(`/api/support/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RESOLVED" }),
      });
      setTicket((prev) => prev ? { ...prev, status: "RESOLVED" } : prev);
    } catch (error) {
      console.error("Failed to resolve:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-gold-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!ticket) {
    return <p className="text-gray-500 text-center py-12">Ticket nao encontrado</p>;
  }

  const statusInfo = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.AI_HANDLING;

  return (
    <div className="flex gap-6 h-[calc(100vh-180px)]">
      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Chat header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard/support")}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                {ticket.subject || "Sem assunto"}
              </h2>
              <p className="text-xs text-gray-400">
                {ticket.user.name || ticket.user.email}
              </p>
            </div>
            <Badge variant={statusInfo.variant} dot>
              {statusInfo.label}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {!["RESOLVED", "CLOSED"].includes(ticket.status) && (
              <Button
                variant="success"
                size="sm"
                onClick={resolveTicket}
                leftIcon={<CheckCircle className="h-4 w-4" />}
              >
                Resolver Ticket
              </Button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "USER" ? "justify-end" : "justify-start"}`}
            >
              <div className="max-w-[70%]">
                {msg.role !== "USER" && (
                  <div className="flex items-center gap-1 mb-1">
                    {msg.role === "AI" ? (
                      <Bot className="h-3.5 w-3.5 text-gray-400" />
                    ) : (
                      <UserCircle className="h-3.5 w-3.5 text-success-600" />
                    )}
                    <span className="text-xs text-gray-400 font-medium">
                      {msg.role === "AI" ? "Assistente IA" : "Equipe Sigma"}
                    </span>
                  </div>
                )}
                <div
                  className={`px-4 py-2.5 rounded-lg text-sm leading-relaxed ${
                    msg.role === "USER"
                      ? "bg-gold-50 text-gray-800 border border-gold-200 rounded-br-none"
                      : msg.role === "AGENT"
                      ? "bg-success-50 text-gray-800 border border-success-200 rounded-bl-none"
                      : "bg-gray-100 text-gray-800 rounded-bl-none"
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-gray-300 mt-1 block">
                  {new Date(msg.createdAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply input */}
        {!["RESOLVED", "CLOSED"].includes(ticket.status) && (
          <div className="border-t border-gray-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendReply()}
              placeholder="Escrever resposta..."
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-gold-500 focus:border-gold-500"
              disabled={sending}
            />
            <button
              onClick={sendReply}
              disabled={!input.trim() || sending}
              className="bg-gold-600 hover:bg-gold-700 disabled:opacity-50 text-white p-2.5 rounded-lg transition-colors"
              aria-label="Enviar resposta"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* User info sidebar */}
      <Card className="w-64 flex-shrink-0 h-fit p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Informacoes do Usuario
        </h3>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-400">Nome</p>
            <p className="text-sm text-gray-700">{ticket.user.name || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Email</p>
            <p className="text-sm text-gray-700 break-all">{ticket.user.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Aberto em</p>
            <p className="text-sm text-gray-700">
              {new Date(ticket.createdAt).toLocaleDateString("pt-BR")}
            </p>
          </div>
          {ticket.escalatedAt && (
            <div>
              <p className="text-xs text-gray-400">Escalado em</p>
              <p className="text-sm text-gray-700">
                {new Date(ticket.escalatedAt).toLocaleDateString("pt-BR")}
              </p>
            </div>
          )}
          {ticket.assignedTo && (
            <div>
              <p className="text-xs text-gray-400">Atribuido a</p>
              <p className="text-sm text-gray-700">{ticket.assignedTo.name}</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
