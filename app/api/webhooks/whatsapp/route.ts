import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { leadService } from "@/lib/services/lead.service";
import { aiService } from "@/lib/services/ai.service";
import { LeadSource, ConversationStatus, MessageRole } from "@prisma/client";
import crypto from "crypto";

/**
 * POST /api/webhooks/whatsapp
 * 
 * Webhook receiver para mensagens recebidas via WhatsApp Business API
 * 
 * Gatilho: Mensagem recebida via WhatsApp Business API (Twilio)
 * 
 * Fluxo:
 * 1. Validar assinatura do webhook
 * 2. Extrair número de telefone e mensagem
 * 3. Buscar Lead por telefone (ou criar novo)
 * 4. Se mensagem é primeira interação: Criar Conversation
 * 5. Processar mensagem via Chatbot API
 * 6. Enviar resposta via WhatsApp Service
 * 7. Logar em IntegrationLog
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const signature = request.headers.get("x-twilio-signature");

    // 1. Validar assinatura do webhook (Twilio)
    if (process.env.TWILIO_AUTH_TOKEN && signature) {
      const url = request.url;
      const params = new URLSearchParams();
      Object.keys(body).forEach((key) => {
        params.append(key, body[key]);
      });

      const crypto = require("crypto");
      const computedSignature = crypto
        .createHmac("sha1", process.env.TWILIO_AUTH_TOKEN)
        .update(url + params.toString())
        .digest("base64");

      if (signature !== computedSignature) {
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    }

    // 2. Extrair dados da mensagem (formato Twilio)
    const from = body.From?.replace("whatsapp:", "") || body.from;
    const messageBody = body.Body || body.body || "";
    const messageSid = body.MessageSid || body.messageSid;

    if (!from || !messageBody) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 3. Buscar Lead por telefone (ou criar novo)
    let lead = await prisma.lead.findFirst({
      where: {
        phone: {
          contains: from.replace(/\D/g, ""), // Remove caracteres não numéricos
        },
      },
    });

    if (!lead) {
      // Criar novo lead
      lead = await leadService.createLead({
        email: `whatsapp_${from}@temp.com`, // Email temporário
        name: "WhatsApp User",
        phone: from,
        source: LeadSource.WHATSAPP,
        metadata: {
          whatsapp_number: from,
          first_message: messageBody,
        },
      });
    }

    // 4. Buscar ou criar Conversation
    let conversation = await prisma.conversation.findFirst({
      where: {
        leadId: lead.id,
        status: ConversationStatus.ACTIVE,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          leadId: lead.id,
          status: ConversationStatus.ACTIVE,
        },
      });
    }

    // 5. Processar mensagem via AI Service
    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
    });

    const conversationHistory = messages.map((msg) => ({
      role: msg.role.toLowerCase() as "user" | "assistant",
      content: msg.content,
    }));

    const chatResponse = await aiService.chatWithLead(messageBody, {
      name: lead.name,
      email: lead.email,
      conversationHistory,
    });

    // 6. Salvar mensagem do usuário
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        leadId: lead.id,
        role: MessageRole.USER,
        content: messageBody,
        metadata: {
          whatsapp_message_sid: messageSid,
          intent: chatResponse.intent,
          sentiment: chatResponse.sentiment,
        } as any,
      },
    });

    // 7. Salvar resposta do AI
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        leadId: lead.id,
        role: MessageRole.ASSISTANT,
        content: chatResponse.response,
        metadata: {
          shouldEscalate: chatResponse.shouldEscalate,
        } as any,
      },
    });

    // 8. Enviar resposta via WhatsApp (Twilio)
    const { whatsappService } = await import("@/lib/services/whatsapp.service");
    await whatsappService.sendMessage(from, chatResponse.response);

    // 9. Se necessário, escalar para humano
    if (chatResponse.shouldEscalate && conversation.status !== ConversationStatus.ESCALATED) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          status: ConversationStatus.ESCALATED,
          escalatedAt: new Date(),
        },
      });
    }

    // 10. Qualificar lead automaticamente se conversa tem mais de 3 mensagens
    if (messages.length >= 3 && lead.status === "NEW") {
      const { sdrService } = await import("@/lib/services/sdr.service");
      sdrService.autoQualifyLead(lead.id).catch((error) => {
        console.error("Error auto-qualifying lead:", error);
      });
    }

    // 11. Logar em IntegrationLog
    await prisma.integrationLog.create({
      data: {
        service: "WHATSAPP",
        action: "MESSAGE_RECEIVED",
        status: "SUCCESS",
        payload: {
          from,
          leadId: lead.id,
          conversationId: conversation.id,
          messageLength: messageBody.length,
          escalated: chatResponse.shouldEscalate,
        } as any,
      },
    });

    // Twilio espera resposta em formato TwiML ou texto simples
    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error in WhatsApp webhook:", error);

    // Logar erro
    await prisma.integrationLog.create({
      data: {
        service: "WHATSAPP",
        action: "MESSAGE_RECEIVED",
        status: "ERROR",
        error: error instanceof Error ? error.message : "Unknown error",
        payload: await request.json().catch(() => ({})) as any,
      },
    }).catch(() => {});

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

