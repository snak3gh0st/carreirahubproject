import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { emailService, OverdueInvoiceEmail } from "@/lib/services/email.service";
import { differenceInDays } from "date-fns";
import { buildCustomerIdExclusionWhere } from "@/lib/financial/hub-exclusions";
import { getFinancialHubExcludedCustomerIds } from "@/lib/financial/hub-exclusions-db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) { return POST(request); }

/**
 * POST /api/cron/overdue-invoice-alerts
 *
 * Cron job que envia alertas imediatos quando faturas ficam em atraso.
 * Roda a cada 6 horas para detectar novas faturas overdue.
 *
 * Envia email para o owner da fatura (ou para FINANCE team se não tiver owner).
 *
 * Configurar no vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/overdue-invoice-alerts",
 *     "schedule": "0 *\/6 * * *"
 *   }]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const isManualWithSecret =
      cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isVercelCron && !isManualWithSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[OverdueInvoiceAlerts] Starting overdue check...");

    const now = new Date();
    const excludedCustomerIds = await getFinancialHubExcludedCustomerIds();
    const customerIdExclusionWhere = buildCustomerIdExclusionWhere(excludedCustomerIds);
    const results: Array<{ email: string; success: boolean; error?: string }> =
      [];

    // Get invoices that are overdue
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: "OVERDUE",
        ...customerIdExclusionWhere,
      },
      select: {
        id: true,
        invoiceNumber: true,
        amount: true,
        dueDate: true,
        customer: {
          select: {
            name: true,
          },
        },
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    console.log(`[OverdueInvoiceAlerts] Found ${overdueInvoices.length} overdue invoices`);

    // Group invoices by owner
    const invoicesByOwner = new Map<
      string,
      {
        email: string;
        name: string;
        invoices: OverdueInvoiceEmail["invoices"];
      }
    >();

    // Also collect invoices without owner
    const unownedInvoices: OverdueInvoiceEmail["invoices"] = [];

    overdueInvoices.forEach((inv) => {
      const daysOverdue = differenceInDays(now, new Date(inv.dueDate));

      const invoiceData = {
        invoiceNumber: inv.invoiceNumber || inv.id.slice(0, 8),
        customerName: inv.customer.name,
        amount: Number(inv.amount),
        daysOverdue,
        dueDate: new Date(inv.dueDate),
      };

      if (inv.owner) {
        const ownerId = inv.owner.id;
        if (!invoicesByOwner.has(ownerId)) {
          invoicesByOwner.set(ownerId, {
            email: inv.owner.email,
            name: inv.owner.name || inv.owner.email,
            invoices: [],
          });
        }
        invoicesByOwner.get(ownerId)!.invoices.push(invoiceData);
      } else {
        unownedInvoices.push(invoiceData);
      }
    });

    // Send emails to each owner
    for (const [ownerId, ownerData] of invoicesByOwner) {
      try {
        const emailData: OverdueInvoiceEmail = {
          userName: ownerData.name,
          invoices: ownerData.invoices,
        };

        const success = await emailService.sendOverdueInvoiceAlert(
          ownerData.email,
          emailData
        );

        results.push({
          email: ownerData.email,
          success,
        });

        console.log(
          `[OverdueInvoiceAlerts] Sent to ${ownerData.email}: ${success ? "SUCCESS" : "FAILED"}`
        );
      } catch (error) {
        console.error(
          `[OverdueInvoiceAlerts] Error sending to ${ownerData.email}:`,
          error
        );
        results.push({
          email: ownerData.email,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Send unowned invoices to FINANCE team
    if (unownedInvoices.length > 0) {
      const financeUsers = await prisma.user.findMany({
        where: {
          active: true,
          role: { in: ["FINANCE", "ADMIN"] },
        },
        select: {
          email: true,
          name: true,
        },
      });

      for (const user of financeUsers) {
        try {
          const emailData: OverdueInvoiceEmail = {
            userName: user.name || user.email,
            invoices: unownedInvoices,
          };

          const success = await emailService.sendOverdueInvoiceAlert(
            user.email,
            emailData
          );

          results.push({
            email: user.email,
            success,
          });

          console.log(
            `[OverdueInvoiceAlerts] Sent unowned invoices to ${user.email}: ${success ? "SUCCESS" : "FAILED"}`
          );
        } catch (error) {
          console.error(
            `[OverdueInvoiceAlerts] Error sending to ${user.email}:`,
            error
          );
          results.push({
            email: user.email,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    console.log(
      `[OverdueInvoiceAlerts] Completed: ${successCount} sent, ${failureCount} failed`
    );

    return NextResponse.json({
      success: true,
      overdueInvoices: overdueInvoices.length,
      sent: successCount,
      failed: failureCount,
      results,
    });
  } catch (error) {
    console.error("[OverdueInvoiceAlerts] Fatal error:", error);
    return NextResponse.json(
      {
        error: "Failed to send overdue invoice alerts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
