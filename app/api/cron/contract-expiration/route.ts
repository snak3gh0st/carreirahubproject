import { NextRequest, NextResponse } from 'next/server';
import { contractWorkflowService } from '@/lib/services/contract-workflow.service';
import { prisma } from '@/lib/db';
import { emailService } from '@/lib/services/email.service';
import { ContractStatus } from '@prisma/client';
import { withCronTelemetry } from '@/lib/utils/cron-with-telegram';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/contract-expiration
 * Check for expired contracts and mark them as expired.
 *
 * Schedule: Daily at 1:00 AM UTC
 *
 * After expiration, fire a real-time PT-BR notification to the SALES seller
 * (Deal.owner preferred, Invoice.owner fallback). Best-effort, never fails the cron.
 */
export const GET = withCronTelemetry('contract-expiration', async (_request) => {
  try {
    console.log('[CRON] Starting contract expiration check...');

    const result = await contractWorkflowService.checkExpiredContracts();

    console.log(`[CRON] Contract expiration check complete: ${result.expired} expired, ${result.errors} errors`);

    // Real-time seller notifications for contracts that just expired (last 30 min)
    let notified = 0;
    let notifyErrors = 0;
    try {
      const cutoff = new Date(Date.now() - 30 * 60 * 1000);
      const freshlyExpired = await prisma.contract.findMany({
        where: {
          status: ContractStatus.EXPIRED,
          updatedAt: { gte: cutoff },
        },
        include: { invoices: { select: { id: true } } },
      });

      for (const contract of freshlyExpired) {
        try {
          let seller: { id: string; name: string | null; email: string; role: string } | null = null;
          if (contract.dealId) {
            const deal = await prisma.deal.findUnique({
              where: { id: contract.dealId },
              include: { owner: true },
            });
            if (deal?.owner && deal.owner.email && deal.owner.role === 'COMMERCIAL') {
              seller = deal.owner;
            }
          }
          if (!seller && contract.invoices.length > 0) {
            const inv = await prisma.invoice.findUnique({
              where: { id: contract.invoices[0].id },
              include: { owner: true },
            });
            if (inv?.owner && inv.owner.email && inv.owner.role === 'COMMERCIAL') {
              seller = inv.owner;
            }
          }
          if (!seller) continue;

          await emailService.sendSellerContractUnsigned(
            {
              id: contract.id,
              docusign_env_id: contract.docusign_env_id,
              status: contract.status,
              signedUrl: contract.signedS3Url || contract.signedUrl,
              sentAt: contract.sentAt,
              expiresAt: contract.expiresAt,
              reminderCount: contract.reminderCount,
              signerEmail: contract.signerEmail,
              signerName: contract.signerName,
            },
            seller,
            'expired'
          );
          notified++;
          console.log(`[SellerNotify] Contract ${contract.id} expired -> ${seller.email}`);
        } catch (err) {
          notifyErrors++;
          console.error(`[SellerNotify] Failed expired-contract notify for ${contract.id}:`, err);
        }
      }
    } catch (err) {
      console.error('[SellerNotify] Failed to query freshly-expired contracts:', err);
    }

    return NextResponse.json({
      success: true,
      message: 'Contract expiration check completed',
      expired: result.expired,
      errors: result.errors,
      sellerNotified: notified,
      sellerNotifyErrors: notifyErrors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CRON] Contract expiration check failed:', error);
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
