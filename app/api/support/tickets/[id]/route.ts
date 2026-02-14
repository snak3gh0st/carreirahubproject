import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supportChatService } from "@/lib/services/support-chat.service";
import { prisma } from "@/lib/db";

const TEAM_ROLES = ["ADMIN", "SUPPORT", "OPERATIONAL"];

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    const isTeam = TEAM_ROLES.includes(userRole);

    const ticket = await supportChatService.getTicketById(params.id);
    if (!ticket) {
      return NextResponse.json({ error: "Ticket nao encontrado" }, { status: 404 });
    }

    // Verify access
    if (!isTeam && ticket.userId !== userId) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error("[Support Ticket Detail] Error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const userId = (session.user as any).id;

    // Team role check for status updates
    const isTeam = TEAM_ROLES.includes(userRole);

    const body = await request.json();
    const { status } = body;

    // Users can escalate or close their own tickets
    if (!isTeam) {
      if (status !== "ESCALATED" && status !== "CLOSED") {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
      }
      const ticket = await prisma.supportTicket.findUnique({
        where: { id: params.id },
      });
      if (!ticket || ticket.userId !== userId) {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
      }
    }

    const validStatuses = ["ESCALATED", "IN_PROGRESS", "RESOLVED", "CLOSED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Status invalido" }, { status: 400 });
    }

    // Use service method for escalation so email notification is sent
    if (status === "ESCALATED") {
      const userMessage = body.message?.trim();
      // Save user's escalation message in the ticket chat history
      if (userMessage) {
        await prisma.supportMessage.create({
          data: {
            ticketId: params.id,
            role: "USER",
            content: userMessage,
          },
        });
      }
      const reason = userMessage || "Solicitacao manual do usuario";
      const ticket = await supportChatService.escalateTicket(params.id, reason);
      return NextResponse.json({ ticket });
    }

    const data: any = { status };
    if (status === "RESOLVED") data.resolvedAt = new Date();

    const ticket = await prisma.supportTicket.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error("[Support Ticket Update] Error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
