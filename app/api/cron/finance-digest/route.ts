import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { emailService, FinanceDigestData } from '@/lib/services/email.service';
import { differenceInDays, endOfDay, startOfDay, subDays } from 'date-fns';
import { buildCustomerIdExclusionWhere } from '@/lib/financial/hub-exclusions';
import { getFinancialHubExcludedCustomerIds } from '@/lib/financial/hub-exclusions-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) { return POST(request); }

/**
 * POST /api/cron/finance-digest
 *
 * Daily 8 AM PT-BR digest for each active FINANCE user containing:
 *   - AR aging buckets (0-30, 31-60, 61-90, 90+)
 *   - Today's expected collections
 *   - QuickBooks sync errors (last 24h)
 *   - Cashflow this month vs last month
 *   - Stale invoices (180+ days)
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

    console.log('[FinanceDigest] Starting daily finance digest send...');

    const now = new Date();
    const dateLabel = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const excludedCustomerIds = await getFinancialHubExcludedCustomerIds();
    const customerIdExclusionWhere = buildCustomerIdExclusionWhere(excludedCustomerIds);

    const recipients = await prisma.user.findMany({
      where: { active: true, role: 'FINANCE' },
      select: { id: true, name: true, email: true, role: true },
    });

    if (recipients.length === 0) {
      console.log('[FinanceDigest] No active FINANCE users — nothing to send.');
      return NextResponse.json({ success: true, sent: 0, total: 0, results: [], timestamp: now.toISOString() });
    }

    // ---------------------------------------------------------------------
    // Build a single shared FinanceDigestData (same data for each finance user)
    // ---------------------------------------------------------------------

    const overdueInvoices = await prisma.invoice.findMany({
      where: { status: 'OVERDUE', ...customerIdExclusionWhere },
      select: { id: true, amount: true, dueDate: true },
    });

    const buckets = { bucket0to30: 0, bucket31to60: 0, bucket61to90: 0, bucket90Plus: 0 };
    for (const inv of overdueInvoices) {
      const days = differenceInDays(now, inv.dueDate);
      const amt = Number(inv.amount);
      if (days <= 30) buckets.bucket0to30 += amt;
      else if (days <= 60) buckets.bucket31to60 += amt;
      else if (days <= 90) buckets.bucket61to90 += amt;
      else buckets.bucket90Plus += amt;
    }

    const todayInvoices = await prisma.invoice.findMany({
      where: {
        status: 'SENT',
        dueDate: { gte: startOfDay(now), lte: endOfDay(now) },
        ...customerIdExclusionWhere,
      },
      select: { amount: true },
    });
    const todayExpectedCollections = {
      count: todayInvoices.length,
      amount: todayInvoices.reduce((s, i) => s + Number(i.amount), 0),
    };

    const syncErrorLogs = await prisma.integrationLog.findMany({
      where: {
        service: { in: ['quickbooks', 'QUICKBOOKS'] },
        status: 'ERROR',
        createdAt: { gte: subDays(now, 1) },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, error: true, payload: true },
    });

    const syncErrorInvoices = syncErrorLogs.map((log) => {
      const payload = (log.payload as any) || {};
      const invoiceId = payload?.invoiceId || payload?.entity?.id || null;
      const invoiceNumber = payload?.invoiceNumber || invoiceId || null;
      return {
        id: invoiceId || log.id,
        invoiceNumber,
        errorMessage: log.error || 'Erro desconhecido',
      };
    });

    // Cashflow this month vs last month — best-effort via getFinancialKPIs
    let cashflow = { revenueThisMonth: 0, revenueLastMonth: 0, deltaPercent: 0 };
    try {
      const { getFinancialKPIs } = await import('@/lib/services/financial-bi');
      const kpisThis = await getFinancialKPIs('this_month');
      const kpisLast = await getFinancialKPIs('last_month');
      cashflow.revenueThisMonth = Number(kpisThis.revenue || 0);
      cashflow.revenueLastMonth = Number(kpisLast.revenue || 0);
      cashflow.deltaPercent =
        cashflow.revenueLastMonth > 0
          ? ((cashflow.revenueThisMonth - cashflow.revenueLastMonth) / cashflow.revenueLastMonth) * 100
          : 0;
    } catch (err) {
      console.error('[FinanceDigest] getFinancialKPIs failed (using zeros):', err);
    }

    const staleCutoff = subDays(now, 180);
    const staleAgg = await prisma.invoice.aggregate({
      where: { status: 'OVERDUE', dueDate: { lte: staleCutoff }, ...customerIdExclusionWhere },
      _count: { _all: true },
      _sum: { amount: true },
    });
    const staleInvoices = {
      count: staleAgg._count._all || 0,
      amount: Number(staleAgg._sum.amount || 0),
    };

    const data: FinanceDigestData = {
      date: dateLabel,
      arAging: buckets,
      todayExpectedCollections,
      syncErrorInvoices,
      cashflow,
      staleInvoices,
    };

    let sent = 0;
    let failed = 0;
    const results: Array<{ email: string; status: 'sent' | 'failed'; error?: string }> = [];

    for (const user of recipients) {
      try {
        await emailService.sendFinanceDailyDigest(user, data);
        sent++;
        results.push({ email: user.email, status: 'sent' });
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[FinanceDigest] Failed for ${user.email}:`, msg);
        results.push({ email: user.email, status: 'failed', error: msg });
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: recipients.length,
      results,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('[FinanceDigest] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
