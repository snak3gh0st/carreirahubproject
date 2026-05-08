import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ConversationStatus } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createConversationSchema = z.object({
  leadId: z.string().uuid(),
});

/**
 * GET /api/conversations
 * Listar conversas com filtros opcionais
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const searchParams = request.nextUrl.searchParams;
    const leadId = searchParams.get("leadId");
    const status = searchParams.get("status") as ConversationStatus | null;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: any = {};
    if (leadId) where.leadId = leadId;
    if (status) where.status = status;

    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1, // Última mensagem
        },
        escalatedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
    });

    return NextResponse.json({
      conversations,
      pagination: {
        limit,
        offset,
        total: conversations.length,
      },
    });
  } catch (error) {
    console.error("Error listing conversations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations
 * Criar nova conversa
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { leadId } = createConversationSchema.parse(body);

    // Verificar se lead existe
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    // Criar conversa
    const conversation = await prisma.conversation.create({
      data: {
        leadId,
        status: ConversationStatus.ACTIVE,
      },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating conversation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

