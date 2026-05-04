import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/quickbooks/analytics
 *
 * Fetches analytics data directly from QuickBooks:
 * - All Customers (with metadata)
 * - Receivables/Outstanding Invoices
 * - Financial summaries
 * - Aging reports
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

    // Check QB connection
    const authStatus = await quickbooksService.getAuthStatus();
    if (!authStatus.isAuthenticated) {
      return NextResponse.json(
        { error: "QuickBooks not connected", details: authStatus },
        { status: 400 }
      );
    }

    console.log("[QB Analytics] Starting analytics fetch...");

    // Fetch all data in parallel
    const [qbCustomers, qbInvoices, qbPayments, companyInfo] = await Promise.all([
      quickbooksService.getAllCustomers().catch((e) => {
        console.error("[QB Analytics] Error fetching customers:", e);
        return [];
      }),
      quickbooksService.getAllInvoices().catch((e) => {
        console.error("[QB Analytics] Error fetching invoices:", e);
        return { invoices: [], totalCount: 0 };
      }),
      quickbooksService.getAllPayments().catch((e) => {
        console.error("[QB Analytics] Error fetching payments:", e);
        return [];
      }),
      quickbooksService.getCompanyInfo().catch((e) => {
        console.error("[QB Analytics] Error fetching company info:", e);
        return null;
      }),
    ]);

    console.log(`[QB Analytics] Fetched ${qbCustomers.length} customers, ${qbInvoices.invoices?.length || 0} invoices, ${qbPayments.length} payments`);

    // Process customers data
    const customersData = qbCustomers.map((customer: any) => ({
      id: customer.Id,
      name: customer.DisplayName || customer.FullyQualifiedName,
      email: customer.PrimaryEmailAddr?.Address || "",
      phone: customer.PrimaryPhone?.FreeFormNumber || "",
      qbId: customer.Id,
    }));

    // Process invoices data
    const invoicesData = (qbInvoices.invoices || []).map((invoice: any) => ({
      id: invoice.Id,
      docNumber: invoice.DocNumber,
      customerId: invoice.CustomerRef?.value,
      totalAmount: invoice.TotalAmt || 0,
      balance: invoice.Balance || 0,
      status: invoice.Balance === 0 ? "PAID" : invoice.Balance === invoice.TotalAmt ? "UNPAID" : "PARTIALLY_PAID",
      dueDate: invoice.DueDate,
      txnDate: invoice.TxnDate,
      qbId: invoice.Id,
    }));

    // Calculate receivables
    const totalReceivables = invoicesData.reduce((sum, inv) => sum + (inv.balance || 0), 0);
    const outstandingInvoices = invoicesData.filter((inv) => inv.balance > 0);
    const paidInvoices = invoicesData.filter((inv) => inv.balance === 0);

    // Calculate aging
    const now = new Date();
    const agingBuckets = {
      current: 0,
      days1to30: 0,
      days31to60: 0,
      days61to90: 0,
      days90plus: 0,
    };

    outstandingInvoices.forEach((invoice: any) => {
      if (!invoice.dueDate) return;
      const daysOverdue = Math.floor(
        (now.getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysOverdue <= 0) {
        agingBuckets.current += invoice.balance;
      } else if (daysOverdue <= 30) {
        agingBuckets.days1to30 += invoice.balance;
      } else if (daysOverdue <= 60) {
        agingBuckets.days31to60 += invoice.balance;
      } else if (daysOverdue <= 90) {
        agingBuckets.days61to90 += invoice.balance;
      } else {
        agingBuckets.days90plus += invoice.balance;
      }
    });

    // Get top customers by receivables
    const topCustomersByAR = customersData
      .map((customer: any) => ({
        ...customer,
        totalInvoices: invoicesData.filter((inv: any) => inv.customerId === customer.qbId).length,
        totalReceivables: invoicesData
          .filter((inv: any) => inv.customerId === customer.qbId && inv.balance > 0)
          .reduce((sum, inv: any) => sum + inv.balance, 0),
        totalPaid: invoicesData
          .filter((inv: any) => inv.customerId === customer.qbId && inv.balance === 0)
          .reduce((sum, inv: any) => sum + inv.totalAmount, 0),
      }))
      .filter((c: any) => c.totalReceivables > 0 || c.totalInvoices > 0)
      .sort((a: any, b: any) => b.totalReceivables - a.totalReceivables)
      .slice(0, 10);

    // Calculate DSO (Days Sales Outstanding)
    const totalInvoiced = invoicesData.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const daysInPeriod = 365;
    const dso = totalInvoiced > 0 ? Math.round((totalReceivables / totalInvoiced) * daysInPeriod) : 0;

    return NextResponse.json({
      summary: {
        totalCustomers: customersData.length,
        totalInvoices: invoicesData.length,
        totalPaid: paidInvoices.length,
        totalOutstanding: outstandingInvoices.length,
        totalInvoicedAmount: totalInvoiced,
        totalReceivables,
        dso,
      },
      customers: customersData.slice(0, 50), // Top 50 customers
      invoices: invoicesData.slice(0, 100), // Top 100 invoices
      topCustomersByAR,
      aging: {
        current: Math.round(agingBuckets.current),
        days1to30: Math.round(agingBuckets.days1to30),
        days31to60: Math.round(agingBuckets.days31to60),
        days61to90: Math.round(agingBuckets.days61to90),
        days90plus: Math.round(agingBuckets.days90plus),
      },
      companyInfo: companyInfo ? {
        name: companyInfo.CompanyName,
        legalName: companyInfo.LegalAddr?.City || "",
        email: companyInfo.PrimaryEmailAddr?.Address || "",
      } : null,
      lastSyncAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[QB Analytics] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch QB analytics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
