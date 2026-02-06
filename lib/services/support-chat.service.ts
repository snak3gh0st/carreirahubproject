import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { SupportTicket, SupportMessage, SupportTicketStatus } from "@prisma/client";
import {
  SUPPORT_CHAT_SYSTEM_PROMPT,
  SUPPORT_CHAT_USER_CONTEXT,
  ESCALATION_KEYWORDS,
} from "@/lib/prompts/support-chat";

// Lazy-init OpenAI client to ensure env vars are available at runtime
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// Use SUPPORT_AI_MODEL env var or fallback to gpt-3.5-turbo (cheap and widely available)
const SUPPORT_AI_MODEL = process.env.SUPPORT_AI_MODEL || "gpt-3.5-turbo";

// Cost protection limits
const MAX_MESSAGES_PER_HOUR = 10;
const MAX_ACTIVE_TICKETS_PER_USER = 3;
const MAX_HISTORY_MESSAGES = 8; // Limit context window to reduce token usage

class SupportChatService {
  async createTicket(userId: string): Promise<SupportTicket> {
    // Auto-close stale tickets (escalated/in_progress for >24h with no new messages)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.supportTicket.updateMany({
      where: {
        userId,
        status: { in: ["AI_HANDLING", "ESCALATED", "IN_PROGRESS"] },
        updatedAt: { lt: oneDayAgo },
      },
      data: { status: "CLOSED" },
    });

    // Check active ticket limit
    const activeTickets = await prisma.supportTicket.count({
      where: {
        userId,
        status: { in: ["AI_HANDLING", "ESCALATED", "IN_PROGRESS"] },
      },
    });
    if (activeTickets >= MAX_ACTIVE_TICKETS_PER_USER) {
      throw new Error("TICKET_LIMIT_REACHED");
    }

    return prisma.supportTicket.create({
      data: { userId },
    });
  }

  private async checkRateLimit(userId: string): Promise<boolean> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentMessages = await prisma.supportMessage.count({
      where: {
        role: "USER",
        createdAt: { gte: oneHourAgo },
        ticket: { userId },
      },
    });
    return recentMessages < MAX_MESSAGES_PER_HOUR;
  }

  async sendMessage(
    ticketId: string,
    userId: string,
    content: string,
    userRole: string = "COMMERCIAL"
  ): Promise<{ userMsg: SupportMessage; aiResponse: SupportMessage | null; shouldEscalate: boolean }> {
    // Rate limit check
    const allowed = await this.checkRateLimit(userId);
    if (!allowed) {
      throw new Error("RATE_LIMIT_EXCEEDED");
    }

    // Save user message
    const userMsg = await prisma.supportMessage.create({
      data: {
        ticketId,
        role: "USER",
        content,
      },
    });

    // Check if ticket is still AI-handled
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.status !== "AI_HANDLING") {
      // Not AI-handled anymore, no AI response
      return { userMsg, aiResponse: null, shouldEscalate: false };
    }

    // Auto-generate subject from first message
    if (!ticket.subject) {
      const subject = content.length > 60 ? content.slice(0, 57) + "..." : content;
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { subject },
      });
    }

    // Check for explicit escalation keywords
    const messageLower = content.toLowerCase();
    const hasEscalationKeyword = ESCALATION_KEYWORDS.some((kw) =>
      messageLower.includes(kw)
    );

    if (hasEscalationKeyword) {
      await this.escalateTicket(ticketId, "Palavra-chave de escalacao detectada");
      const aiResponse = await prisma.supportMessage.create({
        data: {
          ticketId,
          role: "AI",
          content:
            "Entendi que voce precisa de atendimento da nossa equipe. Estou transferindo sua conversa para um membro da equipe Sigma. Voce sera atendido em breve!",
        },
      });
      return { userMsg, aiResponse, shouldEscalate: true };
    }

    // Get conversation history for AI context (limited to reduce token costs)
    const messages = await prisma.supportMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: "desc" },
      take: MAX_HISTORY_MESSAGES,
    });
    messages.reverse();

    // Call AI
    const { response: aiText, shouldEscalate } = await this.callAI(
      userId,
      messages,
      content,
      userRole
    );

    // Save AI response
    const aiResponse = await prisma.supportMessage.create({
      data: {
        ticketId,
        role: "AI",
        content: aiText,
      },
    });

    // If AI recommends escalation
    if (shouldEscalate) {
      await this.escalateTicket(ticketId, "IA recomendou escalacao");
    }

    return { userMsg, aiResponse, shouldEscalate };
  }

  private async callAI(
    userId: string,
    history: SupportMessage[],
    latestMessage: string,
    userRole: string = "COMMERCIAL"
  ): Promise<{ response: string; shouldEscalate: boolean }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("[SupportChat] OPENAI_API_KEY not configured");
      return {
        response:
          "Desculpe, nosso assistente esta temporariamente indisponivel. Estou transferindo voce para a equipe de suporte.",
        shouldEscalate: true,
      };
    }

    try {
      console.log(`[SupportChat] Calling AI with model=${SUPPORT_AI_MODEL}, key=${apiKey.slice(0, 8)}...`);
      // Get user name and role
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, role: true },
      });

      const messageHistory = history
        .map((m) => {
          const role = m.role === "USER" ? "Usuario" : m.role === "AI" ? "Assistente" : "Equipe";
          return `${role}: ${m.content}`;
        })
        .join("\n");

      const completion = await getOpenAI().chat.completions.create({
        model: SUPPORT_AI_MODEL,
        messages: [
          { role: "system", content: SUPPORT_CHAT_SYSTEM_PROMPT },
          {
            role: "system",
            content: SUPPORT_CHAT_USER_CONTEXT(
              user?.name || "Usuario",
              userRole,
              messageHistory
            ),
          },
          { role: "user", content: latestMessage },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const rawResponse =
        completion.choices[0]?.message?.content ||
        "Desculpe, nao consegui processar sua mensagem.";

      // Parse escalation flag from response
      const shouldEscalate = rawResponse.includes("[ESCALATE:true]");
      const response = rawResponse
        .replace(/\[ESCALATE:(true|false)\]/g, "")
        .trim();

      return { response, shouldEscalate };
    } catch (error: any) {
      console.error("[SupportChat] AI FULL ERROR:", JSON.stringify({
        message: error?.message,
        status: error?.status,
        code: error?.code,
        type: error?.type,
        error: error?.error,
      }));
      return {
        response:
          "Desculpe, tive um problema ao processar sua mensagem. Vou transferir voce para a equipe de suporte.",
        shouldEscalate: true,
      };
    }
  }

  async escalateTicket(ticketId: string, reason?: string): Promise<SupportTicket> {
    const ticket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: "ESCALATED",
        escalatedAt: new Date(),
      },
      include: {
        user: { select: { name: true, email: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 3 },
      },
    });

    // Send email notification to Sigma team
    const SUPPORT_EMAIL = process.env.EMAIL_SUPPORT_TEAM || "paulo@sigmaintel.io";
    const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const userName = (ticket as any).user?.name || "Usuário";
    const userEmail = (ticket as any).user?.email || "";
    const lastMessages = (ticket as any).messages
      ?.map((m: any) => `<b>${m.role === "USER" ? userName : "AI"}:</b> ${m.content}`)
      .reverse()
      .join("<br/>") || "";

    this.sendEscalationEmail(SUPPORT_EMAIL, `🚨 Novo Ticket de Suporte Escalado - ${userName}`, `
<!DOCTYPE html>
<html><head><style>
  body { font-family: Arial, sans-serif; color: #333; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: #f59e0b; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
  .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
  .messages { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
  .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
  .footer { text-align: center; padding: 15px; font-size: 12px; color: #6b7280; }
</style></head>
<body><div class="container">
  <div class="header">
    <h1 style="margin:0;">🚨 Ticket de Suporte Escalado</h1>
  </div>
  <div class="content">
    <p><strong>Usuário:</strong> ${userName} (${userEmail})</p>
    <p><strong>Motivo:</strong> ${reason || "Solicitação do usuário"}</p>
    <p><strong>Ticket:</strong> ${ticketId}</p>
    <p><strong>Assunto:</strong> ${ticket.subject || "Sem assunto"}</p>

    <div class="messages">
      <h3 style="margin-top:0;">Últimas Mensagens:</h3>
      ${lastMessages}
    </div>

    <a href="${APP_URL}/dashboard/support/${ticketId}" class="button">Responder Ticket</a>
  </div>
  <div class="footer">
    <p>Carreira USA Hub - Suporte</p>
  </div>
</div></body></html>`
    ).catch((err: any) => console.error("[SupportChat] Email notification failed:", err));

    return ticket;
  }

  async sendAgentReply(
    ticketId: string,
    agentId: string,
    content: string
  ): Promise<SupportMessage> {
    // Update ticket status and assignment
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: "IN_PROGRESS",
        assignedToId: agentId,
      },
    });

    return prisma.supportMessage.create({
      data: {
        ticketId,
        role: "AGENT",
        content,
      },
    });
  }

  private async sendEscalationEmail(to: string, subject: string, html: string): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.log(`[SupportChat] Resend not configured, skipping email to ${to}`);
      return;
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "noreply@carreirausa.com",
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error("[SupportChat] Email send failed:", await res.text());
    } else {
      console.log("[SupportChat] Escalation email sent to", to);
    }
  }

  async getTicketsByUser(userId: string): Promise<SupportTicket[]> {
    return prisma.supportTicket.findMany({
      where: { userId },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async getTicketsForTeam(filters?: {
    status?: SupportTicketStatus;
    assignedToId?: string;
  }): Promise<any[]> {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.assignedToId) where.assignedToId = filters.assignedToId;

    return prisma.supportTicket.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
        assignedTo: { select: { name: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async getTicketMessages(ticketId: string): Promise<SupportMessage[]> {
    return prisma.supportMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: "asc" },
    });
  }

  async resolveTicket(ticketId: string): Promise<SupportTicket> {
    return prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
      },
    });
  }

  async getTicketById(ticketId: string) {
    return prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { name: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
  }
}

export const supportChatService = new SupportChatService();
