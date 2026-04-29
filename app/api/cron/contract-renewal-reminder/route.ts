import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { emailService, ContractRenewalData } from '@/lib/services/email.service';
import { addDays, subDays, differenceInDays } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) { return POST(request); }

/**
 * POST /api/cron/contract-renewal-reminder
 *
 * Sends pre-expiration warnings to the deal/invoice owner for unsigned contracts
 * expiring within 30 days. Fires at three milestones: 30d, 14d, 7d before expiry.
 *
 * Deduplication: uses Contract.reminderCount + Contract.lastReminderAt.
 * Max 3 reminders per contract.
 *
 * Schedule (vercel.json): 0 7 * * *
 * Auth: Bearer ${CRON_SECRET}
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[ContractRenewalReminder] Starting...');

    const now = new Date();
    const thirtyDaysOut = addDays(now, 30);

    const contracts = await prisma.contract.findMany({
      where: {
        status: 'SENT_FOR_SIGNATURE',
        expiresAt: { gte: now, lte: thirtyDaysOut },
        OR: [
          { reminderCount: 0 },
          {
            reminderCount: 1,
            lastReminderAt: { lte: subDays(now, 14) },
            expiresAt: { lte: addDays(now, 14) },
          },
          {
            reminderCount: 2,
            lastReminderAt: { lte: subDays(now, 5) },
            expiresAt: { lte: addDays(now, 7) },
          },
        ],
      },
      include: {
        deal: { include: { owner: true } },
        invoices: { select: { id: true } },
      },
    });

    console.log(`[ContractRenewalReminder] Found ${contracts.length} contract(s) to notify`);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const contract of contracts) {
      try {
        if (!contract.expiresAt) { skipped++; continue; }

        // Resolve seller: deal.owner → invoice.owner fallback
        let seller: { id: string; name: string | null; email: string; role: string } | null = null;

        if (contract.deal?.owner && contract.deal.owner.email) {
          seller = contract.deal.owner;
        }

        if (!seller && contract.invoices.length > 0) {
          const inv = await prisma.invoice.findUnique({
            where: { id: contract.invoices[0].id },
            include: { owner: true },
          });
          if (inv?.owner?.email) seller = inv.owner;
        }

        if (!seller) {
          console.log(`[ContractRenewalReminder] No seller for contract ${contract.id}, skipping`);
          skipped++;
          continue;
        }

        const daysUntilExpiry = differenceInDays(contract.expiresAt, now);

        const contractData: ContractRenewalData = {
          id: contract.id,
          signerName: contract.signerName,
          signerEmail: contract.signerEmail,
          sentAt: contract.sentAt,
          expiresAt: contract.expiresAt,
          reminderCount: contract.reminderCount,
        };

        await emailService.sendContractRenewalWarning(contractData, seller, daysUntilExpiry);

        await prisma.contract.update({
          where: { id: contract.id },
          data: {
            reminderCount: { increment: 1 },
            lastReminderAt: now,
          },
        });

        sent++;
        console.log(`[ContractRenewalReminder] Sent to ${seller.email} for contract ${contract.id} (${daysUntilExpiry}d)`);
      } catch (err) {
        failed++;
        console.error(`[ContractRenewalReminder] Failed for contract ${contract.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      skipped,
      failed,
      total: contracts.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ContractRenewalReminder] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
