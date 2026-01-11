import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aiService } from "@/lib/services/ai.service";
import { leadService } from "@/lib/services/lead.service";
import { sdrService } from "@/lib/services/sdr.service";
import { ConversationStatus, MessageRole } from "@prisma/client";
import { z } from "zod";

const chatRequestSchema = z.object({
  leadId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
});

/**
 * POST /api/chat
 * 
 * Chatbot API para Customer Service com AI
 * 
 * Fluxo:
 * 1. Validar leadId
 * 2. Buscar ou criar Conversation
 * 3. Buscar histórico de mensagens
 * 4. Chamar AI Service com contexto completo
 * 5. Salvar mensagem do usuário e resposta do AI
 * 6. Se necessário, qualificar lead automaticamente
 * 7. Se necessário, escalar para humano
 * 8. Retornar resposta
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId, conversationId, message } = chatRequestSchema.parse(body);

    // 1. Validar lead
    const lead = await leadService.getLeadById(leadId);
    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    // 2. Buscar ou criar Conversation
    let conversation;
    if (conversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });

      if (!conversation || conversation.leadId !== leadId) {
        return NextResponse.json(
          { error: "Conversation not found or doesn't belong to lead" },
          { status: 404 }
        );
      }
    } else {
      // Criar nova conversa
      conversation = await prisma.conversation.create({
        data: {
          leadId,
          status: ConversationStatus.ACTIVE,
        },
      });
    }

    // 3. Buscar histórico de mensagens
    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
    });

    const conversationHistory = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role.toLowerCase() as "user" | "assistant",
      content: msg.content,
    }));

    // 4. Chamar AI Service
    const chatResponse = await aiService.chatWithLead(message, {
      name: lead.name,
      email: lead.email,
      conversationHistory,
    });

    // 5. Salvar mensagem do usuário
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        leadId,
        role: MessageRole.USER,
        content: message,
        metadata: {
          intent: chatResponse.intent,
          sentiment: chatResponse.sentiment,
        } as any,
      },
    });

    // 6. Salvar resposta do AI
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        leadId,
        role: MessageRole.ASSISTANT,
        content: chatResponse.response,
        metadata: {
          shouldEscalate: chatResponse.shouldEscalate,
        } as any,
      },
    });

    // 7. Se necessário, escalar para humano
    let escalated = false;
    if (chatResponse.shouldEscalate && conversation.status !== ConversationStatus.ESCALATED) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          status: ConversationStatus.ESCALATED,
          escalatedAt: new Date(),
        },
      });
      escalated = true;
    }

    // 8. Qualificar lead automaticamente se conversa tem mais de 3 mensagens
    let qualificationScore: number | undefined;
    if (messages.length >= 3 && lead.status === "NEW") {
      try {
        const qualification = await sdrService.autoQualifyLead(leadId);
        qualificationScore = qualification.score;
      } catch (error) {
        console.error("Error auto-qualifying lead:", error);
      }
    }

    // 9. Logar operação
    await prisma.integrationLog.create({
      data: {
        service: "AI_SERVICE",
        action: "CHAT_MESSAGE_PROCESSED",
        status: "SUCCESS",
        payload: {
          leadId,
          conversationId: conversation.id,
          messageLength: message.length,
          escalated,
          qualificationScore,
        } as any,
      },
    });

    return NextResponse.json({
      conversationId: conversation.id,
      response: chatResponse.response,
      escalated,
      qualificationScore,
    });
  } catch (error) {
    console.error("Error in chat API:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    // Logar erro
    await prisma.integrationLog.create({
      data: {
        service: "AI_SERVICE",
        action: "CHAT_MESSAGE_PROCESSED",
        status: "ERROR",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    }).catch(() => {}); // Ignorar erro de log

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

