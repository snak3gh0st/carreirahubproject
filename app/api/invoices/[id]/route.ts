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

/**
 * DELETE /api/invoices/[id]
 * Delete invoice from QuickBooks and local database
 */
export async function DELETE(
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
    const userEmail = (session.user as any).email;

    // Only ADMIN and FINANCE can delete invoices
    if (userRole !== "ADMIN" && userRole !== "FINANCE") {
      return NextResponse.json(
        { error: "Forbidden: Only ADMIN and FINANCE can delete invoices" },
        { status: 403 }
      );
    }

    // Fetch invoice with customer relation
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
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

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    let deletedFromQuickBooks = false;
    let quickbooksError: string | null = null;

    // Delete from QuickBooks if synced
    if (invoice.quickbooks_invoice_id) {
      try {
        console.log(`[DELETE Invoice] Attempting to delete invoice ${invoice.quickbooks_invoice_id} from QuickBooks...`);
        
        // Import and initialize QuickBooks service
        const { quickbooksService } = await import("@/lib/services/quickbooks.service");
        await quickbooksService.initialize();

        // Delete from QuickBooks
        await quickbooksService.deleteInvoice(invoice.quickbooks_invoice_id);
        deletedFromQuickBooks = true;

        // Log successful QB deletion
        await prisma.integrationLog.create({
          data: {
            service: "quickbooks",
            action: "invoice_deleted",
            status: "SUCCESS",
            payload: {
              invoiceNumber: invoice.invoiceNumber,
              amount: Number(invoice.amount),
              quickbooks_invoice_id: invoice.quickbooks_invoice_id,
              customerName: invoice.customer.name,
              deletedBy: userEmail,
            },
          },
        });

        console.log(`[DELETE Invoice] ✓ Invoice ${invoice.quickbooks_invoice_id} deleted from QuickBooks`);
      } catch (qbError: any) {
        // Log QB error but continue with local delete
        quickbooksError = qbError.message || String(qbError);
        console.error(`[DELETE Invoice] ✗ Failed to delete from QuickBooks:`, quickbooksError);

        await prisma.integrationLog.create({
          data: {
            service: "quickbooks",
            action: "invoice_delete_failed",
            status: "ERROR",
            error: quickbooksError,
            payload: {
              invoiceNumber: invoice.invoiceNumber,
              amount: Number(invoice.amount),
              quickbooks_invoice_id: invoice.quickbooks_invoice_id,
              customerName: invoice.customer.name,
              deletedBy: userEmail,
            },
          },
        });
      }
    }

    // Always delete from local database
    const deletedInvoice = await prisma.invoice.delete({
      where: { id: params.id },
    });

    console.log(`[DELETE Invoice] ✓ Invoice ${params.id} deleted from local database`);

    // Return success response
    return NextResponse.json({
      success: true,
      deletedFromQuickBooks,
      quickbooksError,
      invoice: deletedInvoice,
    });
  } catch (error: any) {
    console.error("Error deleting invoice:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

