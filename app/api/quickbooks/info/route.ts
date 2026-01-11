import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { quickbooksService } from "@/lib/services/quickbooks.service";

/**
 * GET /api/quickbooks/info
 * 
 * Retorna informações da company e estatísticas do QuickBooks
 */
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Buscar informações da company
    const companyInfo = await quickbooksService.getCompanyInfo();
    
    // Buscar contagens básicas
    const [customers, invoicesResult, items] = await Promise.all([
      quickbooksService.getAllCustomers(100).catch(() => []),
      quickbooksService.getAllInvoices(100).catch(() => ({ invoices: [] })),
      quickbooksService.getAllItems(100).catch(() => []),
    ]);

    const invoices = invoicesResult.invoices || [];

    return NextResponse.json({
      company: {
        companyName: companyInfo.CompanyInfo?.CompanyName,
        legalName: companyInfo.CompanyInfo?.LegalName,
        companyAddr: companyInfo.CompanyInfo?.CompanyAddr,
        fiscalYearStartMonth: companyInfo.CompanyInfo?.FiscalYearStartMonth,
        country: companyInfo.CompanyInfo?.Country,
        email: companyInfo.CompanyInfo?.Email?.Address,
        phone: companyInfo.CompanyInfo?.Phone?.FreeFormNumber,
      },
      counts: {
        customers: Array.isArray(customers) ? customers.length : 0,
        invoices: Array.isArray(invoices) ? invoices.length : 0,
        items: Array.isArray(items) ? items.length : 0,
      },
      note: "Contagens limitadas a 100 registros. Use endpoints de sync para dados completos.",
    });
  } catch (error: any) {
    console.error("Error fetching QuickBooks info:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch QuickBooks info" },
      { status: 500 }
    );
  }
}

