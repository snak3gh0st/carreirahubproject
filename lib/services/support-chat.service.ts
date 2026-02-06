import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { SupportTicket, SupportMessage, SupportTicketStatus } from "@prisma/client";
import {
  SUPPORT_CHAT_SYSTEM_PROMPT,
  SUPPORT_CHAT_USER_CONTEXT,
  ESCALATION_KEYWORDS,
} from "@/lib/prompts/support-chat";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const AI_MODEL = process.env.AI_MODEL || "gpt-4-turbo-preview";

class SupportChatService {
  async createTicket(userId: string): Promise<SupportTicket> {
    return prisma.supportTicket.create({
      data: { userId },
    });
  }

  async sendMessage(
    ticketId: string,
    userId: string,
    content: string
  ): Promise<{ userMsg: SupportMessage; aiResponse: SupportMessage | null; shouldEscalate: boolean }> {
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

    // Get conversation history for AI context
    const messages = await prisma.supportMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    // Call AI
    const { response: aiText, shouldEscalate } = await this.callAI(
      userId,
      messages,
      content
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
    latestMessage: string
  ): Promise<{ response: string; shouldEscalate: boolean }> {
    if (!process.env.OPENAI_API_KEY) {
      return {
        response:
          "Desculpe, nosso assistente esta temporariamente indisponivel. Estou transferindo voce para a equipe de suporte.",
        shouldEscalate: true,
      };
    }

    try {
      // Get user name
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });

      const messageHistory = history
        .map((m) => {
          const role = m.role === "USER" ? "Usuario" : m.role === "AI" ? "Assistente" : "Equipe";
          return `${role}: ${m.content}`;
        })
        .join("\n");

      const completion = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          { role: "system", content: SUPPORT_CHAT_SYSTEM_PROMPT },
          {
            role: "system",
            content: SUPPORT_CHAT_USER_CONTEXT(
              user?.name || "Usuario",
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
    } catch (error) {
      console.error("[SupportChat] AI error:", error);
      return {
        response:
          "Desculpe, tive um problema ao processar sua mensagem. Vou transferir voce para a equipe de suporte.",
        shouldEscalate: true,
      };
    }
  }

  async escalateTicket(ticketId: string, reason?: string): Promise<SupportTicket> {
    return prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: "ESCALATED",
        escalatedAt: new Date(),
      },
    });
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
