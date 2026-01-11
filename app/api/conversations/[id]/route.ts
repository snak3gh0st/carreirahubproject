import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ConversationStatus } from "@prisma/client";
import { z } from "zod";

const updateConversationSchema = z.object({
  status: z.nativeEnum(ConversationStatus).optional(),
  escalatedToId: z.string().uuid().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
});

/**
 * GET /api/conversations/[id]
 * Buscar conversa por ID com todas as mensagens
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: params.id },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true,
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
        },
        escalatedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error("Error fetching conversation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/conversations/[id]
 * Atualizar conversa (escalar, fechar, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const data = updateConversationSchema.parse(body);

    const updateData: any = { ...data };
    
    // Se está escalando, definir escalatedAt
    if (data.escalatedToId && data.status === ConversationStatus.ESCALATED) {
      updateData.escalatedAt = new Date();
    }

    const conversation = await prisma.conversation.update({
      where: { id: params.id },
      data: updateData,
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        escalatedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(conversation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error updating conversation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

