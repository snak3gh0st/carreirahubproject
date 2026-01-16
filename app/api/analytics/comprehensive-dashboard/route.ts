import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * GET /api/analytics/comprehensive-dashboard
 *
 * Combines internal database analytics with QuickBooks data:
 * - Database: Our managed invoices, deals, leads, customers
 * - QuickBooks: All QB invoices, customers, receivables, aging
 * - Comparison: What's synced vs what's in QB
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch both BI dashboard and QB analytics in parallel
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    const [biResponse, qbResponse] = await Promise.all([
      fetch(`${baseUrl}/api/analytics/bi-dashboard`, {
        headers: request.headers,
      }).catch((e) => {
        console.error("[Comprehensive] Error fetching BI dashboard:", e);
        return null;
      }),
      fetch(`${baseUrl}/api/quickbooks/analytics`, {
        headers: request.headers,
      }).catch((e) => {
        console.error("[Comprehensive] Error fetching QB analytics:", e);
        return null;
      }),
    ]);

    let biData = null;
    let qbData = null;

    if (biResponse?.ok) {
      biData = await biResponse.json();
    }

    if (qbResponse?.ok) {
      qbData = await qbResponse.json();
    }

    // Calculate sync status and differences
    const syncStatus = {
      invoicesSynced: biData?.kpis?.totalInvoices || 0,
      invoicesInQB: qbData?.summary?.totalInvoices || 0,
      customersSynced: biData?.kpis?.activeCustomers || 0,
      customersInQB: qbData?.summary?.totalCustomers || 0,
      syncPercentageInvoices: biData && qbData
        ? Math.round((biData.kpis.totalInvoices / qbData.summary.totalInvoices) * 100)
        : 0,
      syncPercentageCustomers: biData && qbData
        ? Math.round((biData.kpis.activeCustomers / qbData.summary.totalCustomers) * 100)
        : 0,
    };

    return NextResponse.json({
      // Our managed data
      database: biData,

      // QuickBooks source data
      quickbooks: qbData,

      // Sync comparison
      syncStatus,

      // Combined metrics
      combined: {
        totalReceivables: qbData?.summary?.totalReceivables || 0,
        daysOutstanding: qbData?.summary?.dso || 0,
        receivablesAging: qbData?.aging || null,
        topQBCustomersByAR: qbData?.topCustomersByAR || [],
        qbCompanyInfo: qbData?.companyInfo || null,
      },

      // Data quality metrics
      dataQuality: {
        dbRevenueVsQB: biData && qbData
          ? {
              dbRevenue: biData.kpis.totalRevenue,
              qbInvoicedAmount: qbData.summary.totalInvoicedAmount,
              difference: biData.kpis.totalRevenue - qbData.summary.totalInvoicedAmount,
              percentageOfQB: biData.kpis.totalRevenue > 0
                ? Math.round((biData.kpis.totalRevenue / qbData.summary.totalInvoicedAmount) * 100)
                : 0,
            }
          : null,
      },

      lastSync: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Comprehensive Dashboard] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch comprehensive dashboard",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
