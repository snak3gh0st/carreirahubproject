import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { quickbooksService } from '@/lib/services/quickbooks.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/send-scheduled-invoices
 * Send invoice emails when they are 5 days from due date
 *
 * Schedule: Daily at 9:00 AM UTC
 *
 * Logic:
 * - Find all invoices that are QB-synced (quickbooks_invoice_id is set) but NOT yet emailed
 *   (emailSentAt is null) — these are scheduled installments waiting for their send window
 * - Check if dueDate is within 5 days
 * - Send email via QuickBooks /send endpoint and update emailSentAt
 *
 * NOTE: The previous query used `quickbooks_invoice_id: null` which was wrong — all invoices
 * get a QB ID at creation time, so that query always returned 0 results and no emails were sent.
 * The correct signal for "not yet emailed" is emailSentAt being null.
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

    // Find invoices that:
    // 1. Have been synced to QuickBooks (quickbooks_invoice_id is set)
    // 2. Have NOT yet been emailed (emailSentAt is null)
    // 3. Have a customer email to send to
    const pendingInvoices = await prisma.invoice.findMany({
      where: {
        quickbooks_invoice_id: { not: null }, // Already in QuickBooks
        emailSentAt: null,                    // Not yet emailed to customer
        status: { notIn: ['PAID', 'VOID'] },  // Skip already-closed invoices
      },
      include: {
        customer: true,
        deal: true,
      },
    });

    console.log(`[CRON] Found ${pendingInvoices.length} QB-synced invoices not yet emailed`);

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    const now = new Date();

    for (const invoice of pendingInvoices) {
      try {
        // Skip if customer has no email
        if (!invoice.customer.email) {
          console.log(`[CRON] Skipping invoice ${invoice.id} — customer has no email`);
          skipped++;
          continue;
        }

        // Skip if no QB invoice ID (shouldn't happen due to query filter, but be safe)
        if (!invoice.quickbooks_invoice_id) {
          console.log(`[CRON] Skipping invoice ${invoice.id} — no QB invoice ID`);
          skipped++;
          continue;
        }

        // Calculate days until due
        const daysUntilDue = Math.ceil((invoice.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Parse installment metadata
        const installmentMeta = invoice.installments as any;
        const isInstallment = !!installmentMeta?.seriesId;

        // Only send if within 5 days of due date (or already past due)
        if (daysUntilDue <= 5) {
          console.log(`[CRON] Sending email for invoice ${invoice.id} (QB: ${invoice.quickbooks_invoice_id}, due in ${daysUntilDue} days, isInstallment: ${isInstallment})`);

          // Initialize QB service
          await quickbooksService.initialize();

          // Send invoice email via QuickBooks
          const sendResult = await quickbooksService.sendInvoice(
            invoice.quickbooks_invoice_id,
            invoice.customer.email
          );

          if (sendResult.success && sendResult.sent) {
            // Update emailSentAt in our DB to mark as sent
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: {
                emailSentAt: new Date(),
                emailSendAttempts: { increment: 1 },
                lastEmailSendError: null,
              },
            });

            sent++;

            const action = isInstallment ? 'scheduled_installment_sent' : 'scheduled_invoice_sent';
            await prisma.integrationLog.create({
              data: {
                service: 'quickbooks',
                action,
                status: 'SUCCESS',
                payload: {
                  invoiceId: invoice.id,
                  qbInvoiceId: invoice.quickbooks_invoice_id,
                  recipientEmail: invoice.customer.email,
                  daysUntilDue,
                  sentAt: now,
                  isInstallment,
                  deliveryInfo: sendResult.deliveryInfo,
                  emailStatus: sendResult.emailStatus,
                  sendAttempts: sendResult.attempt,
                } as any,
              },
            });

            console.log(`[CRON] ✓ Email sent for invoice ${invoice.id} to ${invoice.customer.email}`);
          } else {
            // Send failed — update error tracking but don't increment sentAt
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: {
                emailSendAttempts: { increment: 1 },
                lastEmailSendError: sendResult.error || 'QB send failed',
              },
            });

            errors++;

            await prisma.integrationLog.create({
              data: {
                service: 'quickbooks',
                action: 'scheduled_invoice_send_failed',
                status: 'ERROR',
                error: sendResult.error || 'QB send returned failure',
                payload: {
                  invoiceId: invoice.id,
                  qbInvoiceId: invoice.quickbooks_invoice_id,
                  recipientEmail: invoice.customer.email,
                  daysUntilDue,
                  attempts: sendResult.attempts,
                  emailStatus: sendResult.emailStatus,
                } as any,
              },
            });

            console.log(`[CRON] ✗ Failed to send email for invoice ${invoice.id}: ${sendResult.error}`);
          }
        } else {
          console.log(`[CRON] Skipping invoice ${invoice.id} (due in ${daysUntilDue} days, will send on ${new Date(invoice.dueDate.getTime() - 5 * 24 * 60 * 60 * 1000).toLocaleDateString()})`);
          skipped++;
        }
      } catch (error) {
        console.error(`[CRON] Error sending invoice ${invoice.id}:`, error);
        errors++;

        // Update error tracking
        try {
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              emailSendAttempts: { increment: 1 },
              lastEmailSendError: error instanceof Error ? error.message : 'Unknown error',
            },
          });
        } catch (updateError) {
          console.error(`[CRON] Error updating invoice error state:`, updateError);
        }

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
