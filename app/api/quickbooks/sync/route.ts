import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { quickbooksSyncService } from "@/lib/services/quickbooks-sync.service";
import { prisma } from "@/lib/db";
import { quickbooksService } from "@/lib/services/quickbooks.service";

/**
 * POST /api/quickbooks/sync
 * 
 * Sincronização completa: customers, invoices, payments e items
 * 
 * Agora usa o QuickBooksSyncService para sincronização automatizada
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { 
      syncCustomers = true,
      syncInvoices = true,
      syncPayments = false,
      syncItems = false,
      maxResults = 1000,
      incremental = false, // Por padrão, sincronização completa
    } = body;

    // Usar o serviço de sincronização
    const result = await quickbooksSyncService.sync({
      syncCustomers,
      syncInvoices,
      syncPayments,
      syncItems,
      maxResults,
      incremental,
    });

    return NextResponse.json({
      success: true,
      syncDate: new Date().toISOString(),
      results: {
        customers: result.customers,
        invoices: result.invoices,
        payments: result.payments,
        items: result.items,
        companyInfo: result.companyInfo,
      },
      duration: result.duration,
    });
  } catch (error: any) {
    console.error("Error in QuickBooks full sync:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync QuickBooks data" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/quickbooks/sync
 * 
 * Retorna informações sobre o status da sincronização
 */
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Contar registros sincronizados
    const customersCount = await prisma.customer.count({
      where: { quickbooks_id: { not: null } },
    });

    const invoicesCount = await prisma.invoice.count({
      where: { quickbooks_invoice_id: { not: null } },
    });

    // Buscar company info
    let companyInfo = null;
    try {
      const info = await quickbooksService.getCompanyInfo();
      companyInfo = {
        companyName: info.CompanyInfo?.CompanyName,
        legalName: info.CompanyInfo?.LegalName,
      };
    } catch (error) {
      // Ignore errors
    }

    return NextResponse.json({
      status: "ready",
      syncedCounts: {
        customers: customersCount,
        invoices: invoicesCount,
      },
      companyInfo,
    });
  } catch (error: any) {
    console.error("Error getting sync status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get sync status" },
      { status: 500 }
    );
  }
}

