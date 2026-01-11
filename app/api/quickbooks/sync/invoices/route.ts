import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { prisma } from "@/lib/db";

/**
 * POST /api/quickbooks/sync/invoices
 * 
 * Sincroniza todas as invoices do QuickBooks para o hub
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { maxResults = 1000, status } = body;

    // Buscar invoices do QuickBooks
    let qbInvoices: any[] = [];
    
    if (status) {
      qbInvoices = await quickbooksService.getInvoicesByStatus(
        status as "Draft" | "Pending" | "Paid" | "Void",
        maxResults
      );
    } else {
      const result = await quickbooksService.getAllInvoices(maxResults);
      qbInvoices = result.invoices;
    }

    const synced: string[] = [];
    const updated: string[] = [];
    const errors: Array<{ invoiceId: string; error: string }> = [];

    for (const qbInvoice of qbInvoices) {
      try {
        const qbInvoiceId = qbInvoice.Id;
        const customerRef = qbInvoice.CustomerRef?.value;

        if (!customerRef) {
          errors.push({
            invoiceId: qbInvoiceId,
            error: "Invoice sem customer no QuickBooks",
          });
          continue;
        }

        // Buscar customer no hub pelo quickbooks_id
        const customer = await prisma.customer.findFirst({
          where: { quickbooks_id: customerRef },
        });

        if (!customer) {
          errors.push({
            invoiceId: qbInvoiceId,
            error: `Customer com quickbooks_id ${customerRef} não encontrado no hub`,
          });
          continue;
        }

        // Calcular total da invoice
        const totalAmount = qbInvoice.TotalAmt || qbInvoice.Balance || 0;
        
        // Converter status do QuickBooks para nosso enum
        const qbStatus = qbInvoice.Balance === 0 ? "PAID" : 
                        qbInvoice.Balance === qbInvoice.TotalAmt ? "SENT" :
                        qbInvoice.Balance > 0 ? "OVERDUE" : "DRAFT";

        // Verificar se invoice já existe
        const existing = await prisma.invoice.findUnique({
          where: { quickbooks_invoice_id: qbInvoiceId },
        });

        // Buscar deal relacionado (se houver)
        const latestDeal = await prisma.deal.findFirst({
          where: { customerId: customer.id },
          orderBy: { createdAt: "desc" },
        });
        const dealId = latestDeal?.id;

        if (!dealId) {
          // Se não houver deal, criar um placeholder ou pular
          errors.push({
            invoiceId: qbInvoiceId,
            error: "Nenhum deal encontrado para o customer",
          });
          continue;
        }

        const invoiceData = {
          invoiceNumber: qbInvoice.DocNumber || undefined,
          amount: totalAmount,
          dueDate: qbInvoice.DueDate ? new Date(qbInvoice.DueDate) : new Date(),
          status: qbStatus as any,
          quickbooks_invoice_id: qbInvoiceId,
          dealId,
          customerId: customer.id,
          metadata: {
            quickbooks: {
              syncDate: new Date().toISOString(),
              txnDate: qbInvoice.TxnDate,
              balance: qbInvoice.Balance,
              totalAmt: qbInvoice.TotalAmt,
              currencyRef: qbInvoice.CurrencyRef,
              lineItems: qbInvoice.Line,
            },
          },
        };

        if (existing) {
          // Atualizar invoice existente
          await prisma.invoice.update({
            where: { id: existing.id },
            data: invoiceData,
          });
          updated.push(existing.id);
        } else {
          // Criar nova invoice
          const invoice = await prisma.invoice.create({
            data: invoiceData,
          });
          synced.push(invoice.id);
        }
      } catch (error: any) {
        errors.push({
          invoiceId: qbInvoice.Id || "N/A",
          error: error.message || "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: qbInvoices.length,
        synced: synced.length,
        updated: updated.length,
        errors: errors.length,
      },
      synced,
      updated,
      errors,
    });
  } catch (error: any) {
    console.error("Error syncing QuickBooks invoices:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync QuickBooks invoices" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/quickbooks/sync/invoices
 * 
 * Lista invoices do QuickBooks (sem sincronizar)
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const maxResults = parseInt(searchParams.get("maxResults") || "100");

    let invoices: any[] = [];
    
    if (status) {
      invoices = await quickbooksService.getInvoicesByStatus(
        status as "Draft" | "Pending" | "Paid" | "Void",
        maxResults
      );
    } else {
      const result = await quickbooksService.getAllInvoices(maxResults);
      invoices = result.invoices;
    }

    return NextResponse.json({
      count: invoices.length,
      invoices: invoices.map((inv: any) => ({
        id: inv.Id,
        docNumber: inv.DocNumber,
        customerRef: inv.CustomerRef?.value,
        totalAmt: inv.TotalAmt,
        balance: inv.Balance,
        txnDate: inv.TxnDate,
        dueDate: inv.DueDate,
        status: inv.Balance === 0 ? "PAID" : inv.Balance > 0 ? "OVERDUE" : "DRAFT",
      })),
    });
  } catch (error: any) {
    console.error("Error fetching QuickBooks invoices:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch QuickBooks invoices" },
      { status: 500 }
    );
  }
}

