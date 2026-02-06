import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supportChatService } from "@/lib/services/support-chat.service";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const { ticketId, message } = body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "Mensagem obrigatoria" }, { status: 400 });
    }

    // Create ticket if needed
    let activeTicketId = ticketId;
    if (!activeTicketId) {
      const ticket = await supportChatService.createTicket(userId);
      activeTicketId = ticket.id;
    }

    // Send message and get AI response
    const result = await supportChatService.sendMessage(
      activeTicketId,
      userId,
      message.trim()
    );

    // Get updated ticket
    const ticket = await supportChatService.getTicketById(activeTicketId);

    return NextResponse.json({
      ticketId: activeTicketId,
      messages: [
        result.userMsg,
        ...(result.aiResponse ? [result.aiResponse] : []),
      ],
      status: ticket?.status,
      shouldEscalate: result.shouldEscalate,
    });
  } catch (error) {
    console.error("[Support Chat] Error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
