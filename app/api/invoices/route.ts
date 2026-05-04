import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { InvoiceStatus } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * GET /api/invoices
 * Listar invoices com filtros opcionais
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const userId = (session.user as any).id;

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") as InvoiceStatus | null;
    const customerId = searchParams.get("customerId");
    const dealId = searchParams.get("dealId");
    const selectedId = searchParams.get("selectedId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: any = {};
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (dealId) where.dealId = dealId;

    // Authorization: Filter by owner for COMMERCIAL
    if (userRole === "COMMERCIAL") {
      where.ownerId = userId;
    }

    const invoiceInclude = {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      deal: {
        select: {
          id: true,
          title: true,
          value: true,
        },
      },
    };

    let invoices = await prisma.invoice.findMany({
      where,
      include: invoiceInclude,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    if (selectedId && !invoices.some((invoice) => invoice.id === selectedId)) {
      const selectedWhere: any = { id: selectedId };
      if (userRole === "COMMERCIAL") {
        selectedWhere.ownerId = userId;
      }
      const selectedInvoice = await prisma.invoice.findFirst({
        where: selectedWhere,
        include: invoiceInclude,
      });
      if (selectedInvoice) {
        invoices = [selectedInvoice, ...invoices];
      }
    }

    return NextResponse.json({
      invoices,
      pagination: {
        limit,
        offset,
        total: invoices.length,
      },
    });
  } catch (error) {
    console.error("Error listing invoices:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
