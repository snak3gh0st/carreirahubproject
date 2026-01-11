import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { quickbooksService } from "@/lib/services/quickbooks.service";

/**
 * GET /api/quickbooks/test
 * 
 * Testa a conexão com a API do QuickBooks
 */
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Testar conexão buscando informações da company
    const companyInfo = await quickbooksService.getCompanyInfo();
    
    return NextResponse.json({
      success: true,
      message: "Conexão com QuickBooks estabelecida com sucesso",
      company: {
        companyName: companyInfo.CompanyInfo?.CompanyName,
        legalName: companyInfo.CompanyInfo?.LegalName,
        companyId: companyInfo.CompanyInfo?.CompanyName, // Usar CompanyName como identificador
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[QuickBooks Test] Error:", error);
    
    return NextResponse.json({
      success: false,
      error: error.message || "Erro desconhecido",
      details: {
        message: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      troubleshooting: {
        checkAccessToken: "Verifique se QUICKBOOKS_ACCESS_TOKEN está configurado e válido",
        checkCompanyId: "Verifique se QUICKBOOKS_COMPANY_ID está correto",
        checkEnvironment: "Verifique se QUICKBOOKS_ENVIRONMENT está configurado como 'production' ou 'sandbox'",
        checkCredentials: "Verifique se QUICKBOOKS_CLIENT_ID e QUICKBOOKS_CLIENT_SECRET estão corretos",
      },
    }, { status: 500 });
  }
}







