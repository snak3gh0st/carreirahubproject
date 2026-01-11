import { NextRequest, NextResponse } from 'next/server';
import { contractWorkflowService } from '@/lib/services/contract-workflow.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/contract-reminders
 * Send contract signature reminders
 *
 * Schedule: Daily at 9:00 AM UTC
 * Reminders sent at:
 * - 3 days after contract sent (if not signed)
 * - 7 days after contract sent (if not signed)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel cron jobs include this header)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('[CRON] Unauthorized request to contract-reminders');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON] Starting contract reminder job...');

    const result = await contractWorkflowService.sendReminders();

    console.log(`[CRON] Contract reminder job complete: ${result.sent} sent, ${result.errors} errors`);

    return NextResponse.json({
      success: true,
      message: 'Contract reminder job completed',
      sent: result.sent,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[CRON] Contract reminder job failed:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
