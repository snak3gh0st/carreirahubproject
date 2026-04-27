import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { emailService, DailyDigestEmail } from "@/lib/services/email.service";
import { differenceInDays } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) { return POST(request); }

/**
 * POST /api/cron/daily-ar-digest
 *
 * Cron job que envia emails diários para usuários com resumo de:
 * - Faturas em atraso
 * - Faturas em risco
 * - Faturas antigas (stale)
 * - Tarefas do dia
 *
 * Configurar no vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/daily-ar-digest",
 *     "schedule": "0 9 * * *"  // 9AM todos os dias
 *   }]
 * }
 *
 * Ou chamar manualmente via webhook com secret:
 * POST /api/cron/daily-ar-digest
 * Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Allow Vercel cron jobs or manual trigger with secret
    const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const isManualWithSecret =
      cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isVercelCron && !isManualWithSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[DailyARDigest] Starting daily digest send...");

    const now = new Date();
    const results: Array<{ email: string; success: boolean; error?: string }> =
      [];

    // Get users who should receive AR digests (FINANCE, ADMIN, SALES)
    const users = await prisma.user.findMany({
      where: {
        active: true,
        role: { in: ["FINANCE", "ADMIN", "SALES", "OPERATIONAL"] },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    console.log(`[DailyARDigest] Found ${users.length} users to notify`);

    // Get overdue invoices
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: "OVERDUE",
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
        ownerId: true,
      },
    });

    // Get at-risk invoices (sent but close to overdue)
    const atRiskInvoices = await prisma.invoice.findMany({
      where: {
        status: "SENT",
        dueDate: { lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) }, // Due within 7 days
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
        ownerId: true,
      },
    });

    // Get stale invoices (180+ days overdue)
    const staleInvoices = await prisma.invoice.findMany({
      where: {
        status: "OVERDUE",
        dueDate: { lte: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000) },
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
        ownerId: true,
      },
    });

    // Send email to each user
    for (const user of users) {
      try {
        // Filter invoices owned by this user (or all if ADMIN/FINANCE)
        const isAdminOrFinance = user.role === "ADMIN" || user.role === "FINANCE";

        const userOverdueInvoices = isAdminOrFinance
          ? overdueInvoices
          : overdueInvoices.filter((inv) => inv.ownerId === user.id);

        const userAtRiskInvoices = isAdminOrFinance
          ? atRiskInvoices
          : atRiskInvoices.filter((inv) => inv.ownerId === user.id);

        const userStaleInvoices = isAdminOrFinance
          ? staleInvoices
          : staleInvoices.filter((inv) => inv.ownerId === user.id);

        // Skip if user has no invoices to report
        if (
          userOverdueInvoices.length === 0 &&
          userAtRiskInvoices.length === 0 &&
          userStaleInvoices.length === 0
        ) {
          console.log(
            `[DailyARDigest] Skipping ${user.email} (no invoices to report)`
          );
          continue;
        }

        // Calculate summary
        const summary = {
          overdueInvoices: userOverdueInvoices.length,
          overdueAmount: userOverdueInvoices.reduce(
            (sum, inv) => sum + Number(inv.amount),
            0
          ),
          atRiskInvoices: userAtRiskInvoices.length,
          atRiskAmount: userAtRiskInvoices.reduce(
            (sum, inv) => sum + Number(inv.amount),
            0
          ),
          staleInvoices: userStaleInvoices.length,
          staleAmount: userStaleInvoices.reduce(
            (sum, inv) => sum + Number(inv.amount),
            0
          ),
        };

        // Generate tasks for the day
        const tasks: DailyDigestEmail["tasks"] = [];

        // Add overdue invoice tasks (high priority)
        userOverdueInvoices.slice(0, 5).forEach((inv) => {
          const daysOverdue = differenceInDays(now, new Date(inv.dueDate));
          tasks.push({
            type: "collection_call",
            priority: daysOverdue > 30 ? "high" : "medium",
            description: `Ligar para cobrar fatura ${daysOverdue} dias em atraso`,
            invoiceNumber: inv.invoiceNumber || inv.id.slice(0, 8),
            customerName: inv.customer.name,
          });
        });

        // Add at-risk invoice tasks (medium priority)
        userAtRiskInvoices.slice(0, 3).forEach((inv) => {
          tasks.push({
            type: "follow_up",
            priority: "medium",
            description: `Enviar lembrete antes do vencimento`,
            invoiceNumber: inv.invoiceNumber || inv.id.slice(0, 8),
            customerName: inv.customer.name,
          });
        });

        // Add stale invoice tasks (high priority)
        if (userStaleInvoices.length > 0) {
          tasks.push({
            type: "review",
            priority: "high",
            description: `Revisar ${userStaleInvoices.length} fatura(s) antiga(s) para write-off`,
          });
        }

        // Send email
        const digestData: DailyDigestEmail = {
          userName: user.name || user.email,
          summary,
          tasks,
        };

        const success = await emailService.sendDailyDigest(
          user.email,
          digestData
        );

        results.push({
          email: user.email,
          success,
        });

        console.log(
          `[DailyARDigest] Sent digest to ${user.email}: ${success ? "SUCCESS" : "FAILED"}`
        );
      } catch (error) {
        console.error(`[DailyARDigest] Error sending to ${user.email}:`, error);
        results.push({
          email: user.email,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Log results
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    console.log(
      `[DailyARDigest] Completed: ${successCount} sent, ${failureCount} failed`
    );

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: failureCount,
      results,
    });
  } catch (error) {
    console.error("[DailyARDigest] Fatal error:", error);
    return NextResponse.json(
      {
        error: "Failed to send daily digest",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
