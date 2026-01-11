import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DealStatus } from "@prisma/client";
import { z } from "zod";

const updateDealSchema = z.object({
  status: z.nativeEnum(DealStatus).optional(),
  title: z.string().optional(),
  value: z.number().optional(),
  currency: z.string().optional(),
});

/**
 * GET /api/deals/[id]
 * Buscar deal por ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deal = await prisma.deal.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        invoices: {
          orderBy: { createdAt: "desc" },
        },
        contracts: {
          orderBy: { createdAt: "desc" },
        },
        convertedFromLead: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
          },
        },
      },
    });

    if (!deal) {
      return NextResponse.json(
        { error: "Deal not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(deal);
  } catch (error) {
    console.error("Error fetching deal:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/deals/[id]
 * Atualizar deal
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const data = updateDealSchema.parse(body);

    const deal = await prisma.deal.update({
      where: { id: params.id },
      data,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(deal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error updating deal:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

