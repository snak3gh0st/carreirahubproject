import { NextRequest, NextResponse } from 'next/server';
import { paymentWorkflowService } from '@/lib/services/payment-workflow.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/overdue-invoices
 * Check for overdue invoices and mark them as overdue
 *
 * Schedule: Daily at 2:00 AM UTC
 * Invoices become overdue when dueDate < today
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel cron jobs include this header)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('[CRON] Unauthorized request to overdue-invoices');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON] Starting overdue invoice check...');

    const result = await paymentWorkflowService.checkOverdueInvoices();

    console.log(`[CRON] Overdue invoice check complete: ${result.overdue} marked overdue, ${result.errors} errors`);

    return NextResponse.json({
      success: true,
      message: 'Overdue invoice check completed',
      overdue: result.overdue,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[CRON] Overdue invoice check failed:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
