import { NextRequest, NextResponse } from 'next/server';
import { contractWorkflowService } from '@/lib/services/contract-workflow.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/contract-expiration
 * Check for expired contracts and mark them as expired
 *
 * Schedule: Daily at 1:00 AM UTC
 * Contracts expire 30 days after being sent
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel cron jobs include this header)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('[CRON] Unauthorized request to contract-expiration');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON] Starting contract expiration check...');

    const result = await contractWorkflowService.checkExpiredContracts();

    console.log(`[CRON] Contract expiration check complete: ${result.expired} expired, ${result.errors} errors`);

    return NextResponse.json({
      success: true,
      message: 'Contract expiration check completed',
      expired: result.expired,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[CRON] Contract expiration check failed:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
