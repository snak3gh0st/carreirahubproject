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
    const workflowStatus = searchParams.get("workflowStatus"); // Filter by workflow status
    const limit = parseInt(searchParams.get("limit") || "25");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: any = {};
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (workflowStatus) where.workflowStatus = workflowStatus;

    // Get total count for pagination
    const total = await prisma.deal.count({ where });

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
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            amount: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        contracts: {
          select: {
            id: true,
            status: true,
            signedAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            invoices: true,
            contracts: true,
          },
        },
      },
      orderBy: { workflowStartedAt: "desc" },
      take: limit,
      skip: offset,
    });

    return NextResponse.json({
      deals,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + deals.length < total,
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

