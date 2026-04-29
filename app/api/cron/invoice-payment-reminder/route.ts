import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { emailService } from '@/lib/services/email.service';
import { subDays, differenceInDays } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) { return POST(request); }

/**
 * POST /api/cron/invoice-payment-reminder
 *
 * Sends up to 2 payment reminders to Hub customers for invoices that have been
 * unpaid for 30+ days (SENT or OVERDUE status). QB also sends its own reminders;
 * this is a supplementary touchpoint from the Hub.
 *
 *   - Reminder 1: 30 days after invoice created (paymentReminderCount = 0)
 *   - Reminder 2: 60 days after invoice created (30 days after reminder 1)
 *
 * Skips customers without a ClientUser (no Hub account).
 *
 * Schedule (vercel.json): 0 10 * * *  (10:00 AM UTC)
 * Auth: Bearer ${CRON_SECRET}
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[InvoicePaymentReminder] Starting...');

    const now = new Date();
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '';
    if (!APP_URL) {
      console.error('[InvoicePaymentReminder] APP_URL not configured — payment links will be broken');
    }

    const invoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['SENT', 'OVERDUE'] },
        paymentReminderCount: { lt: 2 },
        OR: [
          {
            paymentReminderCount: 0,
            createdAt: { lte: subDays(now, 30) },
          },
          {
            paymentReminderCount: 1,
            lastPaymentReminderAt: { lte: subDays(now, 30) },
          },
        ],
      },
      include: {
        customer: {
          include: { clientUser: { select: { language: true } } },
        },
      },
    });

    console.log(`[InvoicePaymentReminder] Found ${invoices.length} invoice(s) to remind`);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const invoice of invoices) {
      try {
        const { customer } = invoice;

        if (!customer.clientUser) {
          console.log(`[InvoicePaymentReminder] No Hub account for customer ${customer.id}, skipping`);
          skipped++;
          continue;
        }

        const daysSinceSent = differenceInDays(now, invoice.createdAt);
        const paymentUrl = `${APP_URL}/hub/pay/${invoice.id}`;

        await emailService.sendStaleInvoiceReminder(
          {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            amount: invoice.amount,
            dueDate: invoice.dueDate,
            status: invoice.status,
            customer: { id: customer.id, name: customer.name, email: customer.email },
          },
          { id: customer.id, name: customer.name, email: customer.email },
          paymentUrl,
          daysSinceSent
        );

        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            paymentReminderCount: { increment: 1 },
            lastPaymentReminderAt: now,
          },
        });

        sent++;
        console.log(`[InvoicePaymentReminder] Sent to ${customer.email} for invoice ${invoice.id} (${daysSinceSent}d)`);
      } catch (err) {
        failed++;
        console.error(`[InvoicePaymentReminder] Failed for invoice ${invoice.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      skipped,
      failed,
      total: invoices.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[InvoicePaymentReminder] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
