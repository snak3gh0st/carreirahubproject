import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supportChatService } from "@/lib/services/support-chat.service";
import { SupportTicketStatus } from "@prisma/client";

const TEAM_ROLES = ["ADMIN", "COMMERCIAL"];

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    const isTeam = TEAM_ROLES.includes(userRole);

    if (isTeam) {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get("status") as SupportTicketStatus | null;
      const assignedToId = searchParams.get("assignedToId");

      const tickets = await supportChatService.getTicketsForTeam({
        status: status || undefined,
        assignedToId: assignedToId || undefined,
      });
      return NextResponse.json({ tickets });
    } else {
      const tickets = await supportChatService.getTicketsByUser(userId);
      return NextResponse.json({ tickets });
    }
  } catch (error) {
    console.error("[Support Tickets] Error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
