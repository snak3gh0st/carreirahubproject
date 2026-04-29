import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supportChatService } from "@/lib/services/support-chat.service";

const TEAM_ROLES = ["ADMIN", "COMMERCIAL"];

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

    // Verify access
    const ticket = await supportChatService.getTicketById(params.id);
    if (!ticket) {
      return NextResponse.json({ error: "Ticket nao encontrado" }, { status: 404 });
    }
    if (!isTeam && ticket.userId !== userId) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const messages = await supportChatService.getTicketMessages(params.id);
    return NextResponse.json({ messages, status: ticket.status });
  } catch (error) {
    console.error("[Support Messages] Error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (!TEAM_ROLES.includes(userRole)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const agentId = (session.user as any).id;
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "Conteudo obrigatorio" }, { status: 400 });
    }

    const message = await supportChatService.sendAgentReply(
      params.id,
      agentId,
      content.trim()
    );

    return NextResponse.json({ message });
  } catch (error) {
    console.error("[Support Agent Reply] Error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
