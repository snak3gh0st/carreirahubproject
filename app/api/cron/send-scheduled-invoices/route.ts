import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { invoiceApprovalService } from '@/lib/services/invoice-approval.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/send-scheduled-invoices
 * Send approved invoices to QuickBooks when they are 3 days from due date
 *
 * Schedule: Daily at 9:00 AM UTC
 *
 * Logic:
 * - Find all APPROVED invoices without quickbooks_invoice_id
 * - Check if dueDate is within 3 days
 * - Send to QuickBooks and email to customer
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel cron jobs include this header)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('[CRON] Unauthorized request to send-scheduled-invoices');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON] Starting scheduled invoice sending job...');

    // Find approved invoices that haven't been sent to QuickBooks yet
    const pendingInvoices = await prisma.invoice.findMany({
      where: {
        approvalStatus: 'APPROVED',
        quickbooks_invoice_id: null, // Not yet sent to QB
      },
      include: {
        customer: true,
        deal: true,
      },
    });

    console.log(`[CRON] Found ${pendingInvoices.length} approved invoices not yet sent to QB`);

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    const now = new Date();

    for (const invoice of pendingInvoices) {
      try {
        // Calculate days until due
        const daysUntilDue = Math.ceil((invoice.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Only send if within 3 days of due date
        if (daysUntilDue <= 3) {
          console.log(`[CRON] Sending invoice ${invoice.id} to QB (due in ${daysUntilDue} days)`);

          // Send to QuickBooks
          await invoiceApprovalService.syncApprovedInvoice(invoice.id);

          sent++;

          // Log success
          await prisma.integrationLog.create({
            data: {
              service: 'quickbooks',
              action: 'scheduled_invoice_sent',
              status: 'SUCCESS',
              payload: {
                invoiceId: invoice.id,
                daysUntilDue,
                sentAt: now,
              } as any,
            },
          });
        } else {
          console.log(`[CRON] Skipping invoice ${invoice.id} (due in ${daysUntilDue} days, will send on ${new Date(invoice.dueDate.getTime() - 3 * 24 * 60 * 60 * 1000).toLocaleDateString()})`);
          skipped++;
        }
      } catch (error) {
        console.error(`[CRON] Error sending invoice ${invoice.id}:`, error);
        errors++;

        // Log error
        await prisma.integrationLog.create({
          data: {
            service: 'quickbooks',
            action: 'scheduled_invoice_send_failed',
            status: 'ERROR',
            error: error instanceof Error ? error.message : 'Unknown error',
            payload: {
              invoiceId: invoice.id,
            } as any,
          },
        });
      }
    }

    console.log(`[CRON] Scheduled invoice sending job complete: ${sent} sent, ${skipped} skipped, ${errors} errors`);

    return NextResponse.json({
      success: true,
      message: 'Scheduled invoice sending job completed',
      sent,
      skipped,
      errors,
      total: pendingInvoices.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[CRON] Scheduled invoice sending job failed:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
