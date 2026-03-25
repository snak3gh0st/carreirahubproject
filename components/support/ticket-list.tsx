"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MessageCircle, Clock, User } from "lucide-react";
import type { BadgeVariant } from "@/components/ui/badge";

interface Ticket {
  id: string;
  subject: string | null;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  user: { name: string | null; email: string };
  assignedTo: { name: string | null } | null;
  messages: { content: string; createdAt: string }[];
  _count: { messages: number };
}

const STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  AI_HANDLING: { label: "IA Atendendo", variant: "info" },
  ESCALATED: { label: "Escalado", variant: "warning" },
  IN_PROGRESS: { label: "Em Andamento", variant: "pending" },
  RESOLVED: { label: "Resolvido", variant: "success" },
  CLOSED: { label: "Encerrado", variant: "default" },
};

const FILTER_TABS = [
  { key: "all", label: "Todos" },
  { key: "ESCALATED", label: "Escalados" },
  { key: "IN_PROGRESS", label: "Em Andamento" },
  { key: "RESOLVED", label: "Resolvidos" },
];

export function TicketList() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const router = useRouter();

  const fetchTickets = async () => {
    try {
      const params = activeFilter !== "all" ? `?status=${activeFilter}` : "";
      const res = await fetch(`/api/support/tickets${params}`);
      const data = await res.json();
      setTickets(data.tickets || []);
    } catch (error) {
      console.error("Failed to load tickets:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchTickets();
  }, [activeFilter]);

  // Poll every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchTickets, 10000);
    return () => clearInterval(interval);
  }, [activeFilter]);

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeFilter === tab.key
                ? "bg-brand-tangerina text-white"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ticket list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-brand-tangerina border-t-transparent rounded-full" />
        </div>
      ) : tickets.length === 0 ? (
        <Card className="text-center py-12">
          <MessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Nenhum ticket encontrado</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => {
            const statusInfo = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.AI_HANDLING;
            const lastMsg = ticket.messages[0];

            return (
              <div
                key={ticket.id}
                className="bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 border border-gray-100"
                onClick={() => router.push(`/dashboard/support/${ticket.id}`)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {ticket.subject || "Sem assunto"}
                      </h3>
                      <Badge variant={statusInfo.variant} dot className="flex-shrink-0">
                        {statusInfo.label}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {ticket.user.name || ticket.user.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {ticket._count.messages} mensagens
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(ticket.updatedAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>

                    {lastMsg && (
                      <p className="text-xs text-gray-400 truncate">
                        {lastMsg.content}
                      </p>
                    )}
                  </div>

                  {ticket.assignedTo && (
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {ticket.assignedTo.name}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
