import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DealStatus } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * GET /api/deals
 * Listar deals com filtros opcionais
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") as DealStatus | null;
    const customerId = searchParams.get("customerId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: any = {};
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;

    const deals = await prisma.deal.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        invoices: {
          take: 3,
          orderBy: { createdAt: "desc" },
        },
        contracts: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    return NextResponse.json({
      deals,
      pagination: {
        limit,
        offset,
        total: deals.length,
      },
    });
  } catch (error) {
    console.error("Error listing deals:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

