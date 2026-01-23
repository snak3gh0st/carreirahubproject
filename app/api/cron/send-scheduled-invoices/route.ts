import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { invoiceSyncService } from '@/lib/services/invoice-sync.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/send-scheduled-invoices
 * Send invoices to QuickBooks when they are 5 days from due date
 *
 * Schedule: Daily at 9:00 AM UTC
 *
 * Logic:
 * - Find all invoices without quickbooks_invoice_id
 * - Check if dueDate is within 5 days
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

    // Find invoices that haven't been sent to QuickBooks yet
    const pendingInvoices = await prisma.invoice.findMany({
      where: {
        quickbooks_invoice_id: null, // Not yet sent to QB
      },
      include: {
        customer: true,
        deal: true,
      },
    });

    console.log(`[CRON] Found ${pendingInvoices.length} invoices not yet sent to QB`);

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    const now = new Date();

    for (const invoice of pendingInvoices) {
      try {
        // Calculate days until due
        const daysUntilDue = Math.ceil((invoice.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Parse installment metadata
        const installmentMeta = invoice.installments as any;
        const isInstallment = !!installmentMeta?.seriesId;
        const isFirstInstallment = installmentMeta?.isFirstInstallment === true;

        // Skip first installments (already sent during approval)
        if (isInstallment && isFirstInstallment) {
          console.log(`[CRON] Skipping first installment ${invoice.id} (already sent during approval)`);
          
          await prisma.integrationLog.create({
            data: {
              service: 'quickbooks',
              action: 'skipped_first_installment',
              status: 'SUCCESS',
              payload: {
                invoiceId: invoice.id,
                reason: 'First installment already sent during approval',
                isFirstInstallment: true,
              } as any,
            },
          });
          
          skipped++;
          continue;
        }

        // Only send if within 5 days of due date
        if (daysUntilDue <= 5) {
          console.log(`[CRON] Sending invoice ${invoice.id} to QB (due in ${daysUntilDue} days, isInstallment: ${isInstallment})`);

          // Send to QuickBooks
          await invoiceSyncService.syncInvoiceToQuickBooks(invoice.id);

          sent++;

          // Log success with appropriate action
          const action = isInstallment ? 'scheduled_installment_sent' : 'scheduled_invoice_sent';
          await prisma.integrationLog.create({
            data: {
              service: 'quickbooks',
              action,
              status: 'SUCCESS',
              payload: {
                invoiceId: invoice.id,
                daysUntilDue,
                sentAt: now,
                isInstallment,
                isFirstInstallment: false,
              } as any,
            },
          });
        } else {
          console.log(`[CRON] Skipping invoice ${invoice.id} (due in ${daysUntilDue} days, will send on ${new Date(invoice.dueDate.getTime() - 5 * 24 * 60 * 60 * 1000).toLocaleDateString()})`);
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
