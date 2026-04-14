import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { emailService, SellerDigestData } from '@/lib/services/email.service';
import { differenceInDays, differenceInHours, subDays, subHours } from 'date-fns';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cron/seller-digest
 *
 * Daily 8 AM PT-BR digest for each active SALES user containing:
 *   - overdue invoices owned by them
 *   - unsigned contracts on their deals (7+ days)
 *   - stale deals (14+ days, top 10 by value)
 *   - unanswered leads (24h+, fallback createdById since Lead lacks assignedToId/ownerId)
 *
 * Empty digests are skipped (no email sent).
 *
 * Schedule (vercel.json): 0 8 * * *
 * Auth: Bearer ${CRON_SECRET}
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[SellerDigest] Starting daily seller digest send...');

    const now = new Date();
    const dateLabel = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const sellers = await prisma.user.findMany({
      where: { active: true, role: 'SALES' },
      select: { id: true, name: true, email: true, role: true },
    });

    console.log(`[SellerDigest] Found ${sellers.length} SALES user(s)`);

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const results: Array<{ email: string; status: 'sent' | 'skipped' | 'failed'; error?: string }> = [];

    for (const seller of sellers) {
      try {
        // Overdue invoices owned by this seller
        const overdueInvoices = await prisma.invoice.findMany({
          where: { ownerId: seller.id, status: 'OVERDUE' },
          include: { customer: { select: { name: true } } },
          orderBy: { dueDate: 'asc' },
          take: 10,
        });

        // Unsigned contracts (sent 7+ days ago) on deals owned by this seller
        const unsignedContracts = await prisma.contract.findMany({
          where: {
            status: { in: ['SENT_FOR_SIGNATURE', 'VIEWED'] as any },
            sentAt: { lte: subDays(now, 7) },
            deal: { ownerId: seller.id },
          },
          include: { deal: { select: { title: true } } },
          take: 10,
        });

        // Stale deals (no activity 14+ days), top 10 by value desc
        const staleDeals = await prisma.deal.findMany({
          where: {
            ownerId: seller.id,
            status: { notIn: ['WON', 'LOST'] as any },
            updatedAt: { lte: subDays(now, 14) },
          },
          orderBy: { value: 'desc' },
          take: 10,
        });

        // Unanswered NEW leads created 24h+ ago. Lead has no assignedToId/ownerId,
        // so fall back to createdById per plan.
        const unansweredLeads = await prisma.lead.findMany({
          where: {
            createdById: seller.id,
            status: 'NEW',
            createdAt: { lte: subHours(now, 24) },
          },
          orderBy: { createdAt: 'asc' },
          take: 10,
        });

        const data: SellerDigestData = {
          date: dateLabel,
          overdueInvoices: overdueInvoices.map((inv) => ({
            invoiceNumber: inv.invoiceNumber || inv.id,
            customerName: inv.customer.name,
            amount: Number(inv.amount),
            daysOverdue: differenceInDays(now, inv.dueDate),
          })),
          unsignedContracts: unsignedContracts.map((c) => ({
            signerName: c.signerName,
            dealTitle: c.deal?.title || '(sem titulo)',
            daysSinceSent: c.sentAt ? differenceInDays(now, c.sentAt) : 0,
          })),
          staleDeals: staleDeals.map((d) => ({
            title: d.title,
            value: Number(d.value),
            lastActivityDays: differenceInDays(now, d.updatedAt),
          })),
          unansweredLeads: unansweredLeads.map((l) => ({
            name: l.name,
            source: l.source,
            hoursSinceCreated: differenceInHours(now, l.createdAt),
          })),
        };

        const allEmpty =
          data.overdueInvoices.length === 0 &&
          data.unsignedContracts.length === 0 &&
          data.staleDeals.length === 0 &&
          data.unansweredLeads.length === 0;

        if (allEmpty) {
          console.log(`[SellerDigest] Skipping ${seller.email} — no items`);
          skipped++;
          results.push({ email: seller.email, status: 'skipped' });
          continue;
        }

        await emailService.sendSellerDailyDigest(seller, data);
        sent++;
        results.push({ email: seller.email, status: 'sent' });
        console.log(`[SellerDigest] Sent to ${seller.email}`);
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[SellerDigest] Failed for ${seller.email}:`, msg);
        results.push({ email: seller.email, status: 'failed', error: msg });
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      skipped,
      failed,
      total: sellers.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SellerDigest] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
