import { NextRequest, NextResponse } from 'next/server';
import { paymentWorkflowService } from '@/lib/services/payment-workflow.service';
import { prisma } from '@/lib/db';
import { emailService } from '@/lib/services/email.service';
import { InvoiceStatus } from '@prisma/client';
import { withCronTelemetry } from "@/lib/utils/cron-with-telegram";

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/overdue-invoices
 * Check for overdue invoices and mark them as overdue.
 *
 * Schedule: Daily at 2:00 AM UTC
 *
 * After marking invoices OVERDUE we look up each invoice's owner (SALES role)
 * and fire a real-time PT-BR notification via emailService.sendSellerInvoiceOverdue.
 * Notification failures NEVER fail the cron run.
 */
export const GET = withCronTelemetry("overdue-invoices", async (request) => {
  const startTime = Date.now();
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('[CRON] Unauthorized request to overdue-invoices');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON] Starting overdue invoice check...');

    const result = await paymentWorkflowService.checkOverdueInvoices();

    console.log(`[CRON] Overdue invoice check complete: ${result.overdue} marked overdue, ${result.errors} errors`);

    // Real-time seller notifications for invoices that became overdue in the
    // last few minutes (markedOverdueAt fresh). Best-effort, never throws.
    let notified = 0;
    let notifyErrors = 0;
    try {
      const cutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 min window
      const freshlyOverdue = await prisma.invoice.findMany({
        where: {
          status: InvoiceStatus.OVERDUE,
          markedOverdueAt: { gte: cutoff },
          ownerId: { not: null },
        },
        include: { customer: true, owner: true },
      });

      for (const inv of freshlyOverdue) {
        try {
          if (!inv.owner || !inv.owner.email) continue;
          if (inv.owner.role !== 'COMMERCIAL') continue;

          await emailService.sendSellerInvoiceOverdue(
            {
              id: inv.id,
              invoiceNumber: inv.invoiceNumber,
              amount: inv.amount,
              dueDate: inv.dueDate,
              status: inv.status,
              customer: { id: inv.customer.id, name: inv.customer.name, email: inv.customer.email },
            },
            { id: inv.owner.id, name: inv.owner.name, email: inv.owner.email, role: inv.owner.role }
          );
          notified++;
          console.log(`[SellerNotify] Overdue invoice ${inv.id} -> ${inv.owner.email}`);
        } catch (err) {
          notifyErrors++;
          console.error(`[SellerNotify] Failed to notify owner of invoice ${inv.id}:`, err);
        }
      }
    } catch (err) {
      console.error('[SellerNotify] Failed to query freshly-overdue invoices:', err);
    }

    return NextResponse.json({
      success: true,
      message: 'Overdue invoice check completed',
      overdue: result.overdue,
      errors: result.errors,
      sellerNotified: notified,
      sellerNotifyErrors: notifyErrors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CRON] Overdue invoice check failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
});
