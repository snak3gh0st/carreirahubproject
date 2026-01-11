import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { quickbooksService } from "@/lib/services/quickbooks.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/integrations/hub-status
 *
 * Returns aggregated status of all integrations for the Integration Hub dashboard
 */
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get system config for integration settings
    const systemConfig = await prisma.systemConfig.findUnique({
      where: { id: "system" },
    });

    // QuickBooks Status
    let quickbooksStatus: any = {
      connected: false,
      companyId: null,
      tokenExpiresAt: null,
      lastSync: null,
    };

    if (systemConfig?.quickbooks_is_authenticated) {
      quickbooksStatus = {
        connected: true,
        companyId: systemConfig.quickbooks_company_id,
        tokenExpiresAt: systemConfig.quickbooks_token_expires_at,
        lastSync: systemConfig.last_qb_sync,
        tokenStatus: systemConfig.quickbooks_token_expires_at
          ? new Date(systemConfig.quickbooks_token_expires_at) > new Date()
            ? "valid"
            : "expired"
          : "unknown",
      };

      // Try to get company name
      try {
        await quickbooksService.initialize();
        const companyInfo = await quickbooksService.getCompanyInfo();
        quickbooksStatus.companyName =
          companyInfo?.CompanyInfo?.CompanyName || null;
      } catch (error) {
        quickbooksStatus.companyName = null;
      }
    }

    // Pipedrive Status
    const pipedriveStatus: any = {
      configured: !!process.env.PIPEDRIVE_API_TOKEN,
      webhookSecretConfigured: !!(
        systemConfig?.pipedrive_webhook_secret ||
        process.env.PIPEDRIVE_WEBHOOK_SECRET
      ),
      lastSync: systemConfig?.last_pipedrive_sync || null,
    };

    // Stripe Status
    const stripeStatus: any = {
      configured: !!process.env.STRIPE_SECRET_KEY,
      webhookConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
    };

    // Get last webhook received for each service
    const lastWebhooks = await prisma.integrationLog.findMany({
      where: {
        action: { startsWith: "WEBHOOK_" },
        status: "SUCCESS",
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const lastQbWebhook = lastWebhooks.find((w) => w.service === "QUICKBOOKS");
    const lastPdWebhook = lastWebhooks.find((w) => w.service === "PIPEDRIVE");
    const lastStripeWebhook = lastWebhooks.find((w) => w.service === "STRIPE");

    quickbooksStatus.lastWebhook = lastQbWebhook?.createdAt || null;
    pipedriveStatus.lastWebhook = lastPdWebhook?.createdAt || null;
    stripeStatus.lastWebhook = lastStripeWebhook?.createdAt || null;

    // Sync Statistics
    const [
      totalCustomers,
      qbCustomers,
      pipedriveCustomers,
      stripeCustomers,
      totalInvoices,
      qbInvoices,
      totalPayments,
      qbPayments,
      stripePayments,
    ] = await Promise.all([
      prisma.customer.count(),
      prisma.customer.count({ where: { quickbooks_id: { not: null } } }),
      prisma.customer.count({ where: { pipedrive_id: { not: null } } }),
      prisma.customer.count({ where: { stripe_id: { not: null } } }),
      prisma.invoice.count(),
      prisma.invoice.count({ where: { quickbooks_invoice_id: { not: null } } }),
      prisma.payment.count(),
      prisma.payment.count({ where: { quickbooks_payment_id: { not: null } } }),
      prisma.payment.count({ where: { stripe_payment_id: { not: null } } }),
    ]);

    const syncStats = {
      customers: {
        total: totalCustomers,
        quickbooks: qbCustomers,
        pipedrive: pipedriveCustomers,
        stripe: stripeCustomers,
      },
      invoices: {
        total: totalInvoices,
        quickbooks: qbInvoices,
      },
      payments: {
        total: totalPayments,
        quickbooks: qbPayments,
        stripe: stripePayments,
      },
    };

    // Recent Activity (last 20 integration events)
    const recentActivity = await prisma.integrationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        service: true,
        action: true,
        status: true,
        error: true,
        createdAt: true,
      },
    });

    // Error statistics (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const errorStats = await prisma.integrationLog.groupBy({
      by: ["service"],
      where: {
        status: "ERROR",
        createdAt: { gte: oneDayAgo },
      },
      _count: { id: true },
    });

    const errorsByService = errorStats.reduce(
      (acc, item) => {
        acc[item.service] = item._count.id;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      quickbooks: quickbooksStatus,
      pipedrive: pipedriveStatus,
      stripe: stripeStatus,
      syncStats,
      recentActivity,
      errorStats: {
        last24Hours: errorsByService,
        total: Object.values(errorsByService).reduce((a, b) => a + b, 0),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Hub Status] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get hub status" },
      { status: 500 }
    );
  }
}
