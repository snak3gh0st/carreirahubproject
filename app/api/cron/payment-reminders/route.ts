import { NextRequest, NextResponse } from 'next/server';
import { paymentWorkflowService } from '@/lib/services/payment-workflow.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/payment-reminders
 * Send payment reminders for unpaid invoices
 *
 * Schedule: Daily at 10:00 AM UTC
 * Reminders sent:
 * - 7 days before due date
 * - 3 days before due date
 * - 1 day before due date
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel cron jobs include this header)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('[CRON] Unauthorized request to payment-reminders');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON] Starting payment reminder job...');

    const result = await paymentWorkflowService.sendPaymentReminders();

    console.log(`[CRON] Payment reminder job complete: ${result.sent} sent, ${result.errors} errors`);

    return NextResponse.json({
      success: true,
      message: 'Payment reminder job completed',
      sent: result.sent,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[CRON] Payment reminder job failed:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
