import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { InvoiceStatus } from "@prisma/client";
import { z } from "zod";

const updateInvoiceSchema = z.object({
  status: z.nativeEnum(InvoiceStatus).optional(),
  pdfUrl: z.string().url().optional(),
});

/**
 * GET /api/invoices/[id]
 * Buscar invoice por ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const userId = (session.user as any).id;

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        deal: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Authorization: Check ownership for COMMERCIAL and SALES
    if (userRole === "COMMERCIAL" || userRole === "SALES") {
      if (invoice.ownerId !== userId) {
        return NextResponse.json(
          { error: "Forbidden: You can only view your own invoices" },
          { status: 403 }
        );
      }
    }

    // ADMIN and FINANCE can view all invoices
    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Error fetching invoice:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/invoices/[id]
 * Atualizar invoice
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const userId = (session.user as any).id;

    // Check if invoice exists and user has access
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id: params.id },
    });

    if (!existingInvoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Authorization: Check ownership for COMMERCIAL and SALES
    if (userRole === "COMMERCIAL" || userRole === "SALES") {
      if (existingInvoice.ownerId !== userId) {
        return NextResponse.json(
          { error: "Forbidden: You can only update your own invoices" },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const data = updateInvoiceSchema.parse(body);

    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json(invoice);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error updating invoice:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

