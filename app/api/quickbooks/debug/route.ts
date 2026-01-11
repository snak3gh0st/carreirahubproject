import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/quickbooks/debug
 *
 * Endpoint de debug para testar conexão e buscar dados do QuickBooks
 */
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get database config
  const config = await prisma.systemConfig.findUnique({
    where: { id: "system" },
  });

  const debug: any = {
    timestamp: new Date().toISOString(),
    config: {
      hasClientId: !!process.env.QUICKBOOKS_CLIENT_ID,
      hasClientSecret: !!process.env.QUICKBOOKS_CLIENT_SECRET,
      environment: process.env.QUICKBOOKS_ENVIRONMENT || "sandbox",
      // From database
      isAuthenticated: config?.quickbooks_is_authenticated || false,
      hasAccessToken: !!config?.quickbooks_access_token,
      hasRefreshToken: !!config?.quickbooks_refresh_token,
      companyId: config?.quickbooks_company_id || "Not set",
      tokenExpires: config?.quickbooks_token_expires_at?.toISOString() || "Not set",
      tokenValid: config?.quickbooks_token_expires_at
        ? new Date(config.quickbooks_token_expires_at) > new Date()
        : false,
    },
    tests: {},
  };

  try {
    // Initialize QuickBooks service from database
    await quickbooksService.initialize();

    // Test 1: Company Info
    try {
      console.log("[QuickBooks Debug] Testing company info...");
      const companyInfo = await quickbooksService.getCompanyInfo();
      debug.tests.companyInfo = {
        success: true,
        companyName: companyInfo.CompanyInfo?.CompanyName,
        legalName: companyInfo.CompanyInfo?.LegalName,
        companyId: companyInfo.CompanyInfo?.Id,
      };
    } catch (error: any) {
      debug.tests.companyInfo = {
        success: false,
        error: error.message,
      };
    }

    // Test 2: Get Customers
    try {
      console.log("[QuickBooks Debug] Testing get customers...");
      const customers = await quickbooksService.getAllCustomers(10);
      debug.tests.customers = {
        success: true,
        count: customers.length,
        sample: customers.slice(0, 3).map((c: any) => ({
          id: c.Id,
          displayName: c.DisplayName,
          email: c.PrimaryEmailAddr?.Address,
        })),
      };
    } catch (error: any) {
      debug.tests.customers = {
        success: false,
        error: error.message,
      };
    }

    // Test 3: Get Invoices
    try {
      console.log("[QuickBooks Debug] Testing get invoices...");
      const result = await quickbooksService.getAllInvoices(10);
      debug.tests.invoices = {
        success: true,
        count: result.invoices.length,
        sample: result.invoices.slice(0, 3).map((inv: any) => ({
          id: inv.Id,
          docNumber: inv.DocNumber,
          totalAmt: inv.TotalAmt,
          balance: inv.Balance,
          customerRef: inv.CustomerRef?.value,
        })),
      };
    } catch (error: any) {
      debug.tests.invoices = {
        success: false,
        error: error.message,
      };
    }

    // Test 4: Get Items
    try {
      console.log("[QuickBooks Debug] Testing get items...");
      const items = await quickbooksService.getAllItems(10);
      debug.tests.items = {
        success: true,
        count: items.length,
        sample: items.slice(0, 3).map((item: any) => ({
          id: item.Id,
          name: item.Name,
          type: item.Type,
        })),
      };
    } catch (error: any) {
      debug.tests.items = {
        success: false,
        error: error.message,
      };
    }

    return NextResponse.json(debug);
  } catch (error: any) {
    console.error("[QuickBooks Debug] Fatal error:", error);
    debug.error = error.message;
    return NextResponse.json(debug, { status: 500 });
  }
}







