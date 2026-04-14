import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { emailService, AdminDigestData } from '@/lib/services/email.service';
import { differenceInDays, format, startOfWeek, subDays, subWeeks } from 'date-fns';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cron/admin-digest
 *
 * Weekly Monday 8 AM PT-BR digest for each active ADMIN user containing:
 *   - MRR (current + week-over-week delta)
 *   - Top 5 deals at risk (no activity 14+ days)
 *   - Latest CFO IA insights (from CfoInsight table)
 *   - Conversion funnel (last 7 days)
 *   - Lead source performance
 *   - BI highlights
 *
 * Schedule (vercel.json): 0 8 * * 1
 * Auth: Bearer ${CRON_SECRET}
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[AdminDigest] Starting weekly admin digest send...');

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekRange = `${format(weekStart, 'dd/MM/yyyy')} - ${format(now, 'dd/MM/yyyy')}`;
    const prevWeekStart = subWeeks(weekStart, 1);

    const recipients = await prisma.user.findMany({
      where: { active: true, role: 'ADMIN' },
      select: { id: true, name: true, email: true, role: true },
    });

    if (recipients.length === 0) {
      console.log('[AdminDigest] No active ADMIN users — nothing to send.');
      return NextResponse.json({ success: true, sent: 0, total: 0, results: [], timestamp: now.toISOString() });
    }

    // ---------------------------------------------------------------------
    // Build a single shared AdminDigestData
    // ---------------------------------------------------------------------

    // MRR — pull from getFinancialKPIs (this month vs last month). Week-over-week
    // is approximated via revenue delta scaled across periods.
    let mrr = { current: 0, deltaWeek: 0, deltaPercent: 0 };
    let biHighlights: string[] = [];
    try {
      const { getFinancialKPIs } = await import('@/lib/services/financial-bi');
      const kpis = await getFinancialKPIs('this_month');
      mrr.current = Number(kpis.mrr || 0);
      mrr.deltaPercent = Number(kpis.revenueChangePct || 0);
      mrr.deltaWeek = mrr.current * (mrr.deltaPercent / 100);

      biHighlights = [
        `Receita do mes: $${Number(kpis.revenue || 0).toFixed(2)}`,
        `Taxa de cobranca: ${Number(kpis.collectionRate || 0).toFixed(1)}%`,
        `AR em aberto: $${Number(kpis.outstandingAR || 0).toFixed(2)}`,
        `Faturas em atraso (90+ dias): $${Number(kpis.aging90Plus || 0).toFixed(2)}`,
        `Projecao de caixa 30 dias: $${Number(kpis.cashProjection30Day || 0).toFixed(2)}`,
      ];
    } catch (err) {
      console.error('[AdminDigest] getFinancialKPIs failed:', err);
    }

    // Top 5 deals at risk: open deals with no activity 14+ days, ordered by value desc
    const dealsAtRiskRaw = await prisma.deal.findMany({
      where: {
        status: { notIn: ['WON', 'LOST'] as any },
        updatedAt: { lte: subDays(now, 14) },
      },
      orderBy: { value: 'desc' },
      take: 5,
      include: { owner: { select: { name: true } } },
    });
    const dealsAtRisk = dealsAtRiskRaw.map((d) => ({
      title: d.title,
      value: Number(d.value),
      ownerName: d.owner?.name || '(sem owner)',
      lastActivityDays: differenceInDays(now, d.updatedAt),
    }));

    // CFO insights: probe (a) CfoInsight model -> (b) cache file dir -> (c) fallback
    let cfoInsights = 'Sem analises recentes do CFO IA.';
    try {
      const latest = await prisma.cfoInsight.findFirst({ orderBy: { generatedAt: 'desc' } });
      if (latest && latest.briefing) {
        cfoInsights = latest.briefing;
        if (latest.recommendations) {
          try {
            const recs = JSON.parse(latest.recommendations);
            if (Array.isArray(recs) && recs.length > 0) {
              const recsText = recs
                .slice(0, 5)
                .map((r: any, i: number) => `${i + 1}. ${typeof r === 'string' ? r : r.title || r.text || JSON.stringify(r)}`)
                .join('\n');
              cfoInsights = `${latest.briefing}\n\nRecomendacoes:\n${recsText}`;
            }
          } catch {
            /* ignore parse error */
          }
        }
      } else {
        // Fallback (b): cache dir
        try {
          const fs = await import('fs/promises');
          const path = await import('path');
          const dir = path.join(process.cwd(), '.cfo-cache');
          const files = await fs.readdir(dir);
          if (files.length > 0) {
            files.sort().reverse();
            const latestFile = await fs.readFile(path.join(dir, files[0]), 'utf-8');
            cfoInsights = latestFile.slice(0, 4000);
          }
        } catch {
          /* fallback (c) — keep default string */
        }
      }
    } catch (err) {
      console.error('[AdminDigest] CFO insights probe failed:', err);
    }

    // Conversion funnel (last 7 days)
    const sevenAgo = subDays(now, 7);
    const [leadsCount, qualifiedCount, dealsCount, wonCount] = await Promise.all([
      prisma.lead.count({ where: { createdAt: { gte: sevenAgo } } }),
      prisma.lead.count({ where: { status: 'QUALIFIED', createdAt: { gte: sevenAgo } } }),
      prisma.deal.count({ where: { createdAt: { gte: sevenAgo } } }),
      prisma.deal.count({ where: { status: 'WON', updatedAt: { gte: sevenAgo } } }),
    ]);

    const conversionFunnel = {
      leads: leadsCount,
      qualified: qualifiedCount,
      deals: dealsCount,
      won: wonCount,
    };

    // Lead source performance
    const leadsBySource = await prisma.lead.groupBy({
      by: ['source'],
      where: { createdAt: { gte: prevWeekStart } },
      _count: { _all: true },
    });
    const conversionsBySource = await prisma.lead.groupBy({
      by: ['source'],
      where: { createdAt: { gte: prevWeekStart }, status: 'CONVERTED' },
      _count: { _all: true },
    });
    const conversionMap = new Map(conversionsBySource.map((c) => [c.source, c._count._all]));
    const leadSourcePerformance = leadsBySource.map((s) => ({
      source: s.source,
      leads: s._count._all,
      conversions: conversionMap.get(s.source) || 0,
    }));

    const data: AdminDigestData = {
      weekRange,
      mrr,
      dealsAtRisk,
      cfoInsights,
      conversionFunnel,
      leadSourcePerformance,
      biHighlights,
    };

    let sent = 0;
    let failed = 0;
    const results: Array<{ email: string; status: 'sent' | 'failed'; error?: string }> = [];

    for (const user of recipients) {
      try {
        await emailService.sendAdminWeeklyDigest(user, data);
        sent++;
        results.push({ email: user.email, status: 'sent' });
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[AdminDigest] Failed for ${user.email}:`, msg);
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
    console.error('[AdminDigest] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
