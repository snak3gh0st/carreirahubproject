import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { emailService, AdminDailyDigestData } from '@/lib/services/email.service';
import {
  format, startOfDay, startOfWeek, startOfMonth, endOfMonth,
  subMonths, differenceInDays,
} from 'date-fns';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cron/daily-bi-digest
 * Daily 18h BRT (21h UTC) — all active ADMIN users.
 * Schedule: 0 21 * * *
 *
 * Revenue source of truth: invoice.amountPaid + paidAt (QB sync writes here directly).
 * MRR: average of the last 3 COMPLETE calendar months (never includes the current partial month).
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const testEmail = new URL(request.url).searchParams.get('testEmail');

    const dbRecipients = await prisma.user.findMany({
      where: { active: true, role: 'ADMIN' },
      select: { id: true, name: true, email: true },
    });
    const recipients = testEmail ? [{ id: 'test', name: 'Admin', email: testEmail }] : dbRecipients;
    if (!recipients.length) return NextResponse.json({ success: true, sent: 0, message: 'No ADMIN users' });

    // ── Month buckets ─────────────────────────────────────────────────────────
    // Trend table: [M-2, M-1, M0 (current, may be partial)]
    const months = [2, 1, 0].map((offset) => {
      const ref = subMonths(now, offset);
      return { start: startOfMonth(ref), end: endOfMonth(ref), label: format(ref, 'MMM yyyy') };
    });

    // MRR uses last 3 COMPLETE calendar months: [M-3, M-2, M-1]
    const mrrMonths = [3, 2, 1].map((offset) => {
      const ref = subMonths(now, offset);
      return { start: startOfMonth(ref), end: endOfMonth(ref) };
    });

    // Annual: trailing 12 months, oldest → newest
    const annualMonths = Array.from({ length: 12 }, (_, i) => {
      const ref = subMonths(now, 11 - i);
      return { start: startOfMonth(ref), end: endOfMonth(ref), label: format(ref, 'MMM yyyy') };
    });

    const since12Months = annualMonths[0].start;

    // ── Batch all DB queries ──────────────────────────────────────────────────
    const [
      allPaidInvoices,
      allInvoices12,
      openInvoices,
      allDeals,
      allLeads,
      topOverdueRaw,
      allEnrollments,
      activeStudents,
      monthWonDealsRaw,
    ] = await Promise.all([
      // PAID invoices — source of truth for revenue (QB sync writes amountPaid+paidAt directly)
      prisma.invoice.findMany({
        where: { status: 'PAID', paidAt: { gte: since12Months } },
        select: { paidAt: true, amountPaid: true, paymentMethod: true },
      }),
      // all non-void invoices created in last 12 months (for invoiced amounts)
      prisma.invoice.findMany({
        where: { createdAt: { gte: since12Months }, status: { not: 'VOID' } },
        select: { createdAt: true, amount: true, amountPaid: true, status: true },
      }),
      // open invoices for AR aging
      prisma.invoice.findMany({
        where: { status: { in: ['SENT', 'OVERDUE', 'PARTIALLY_PAID'] } },
        select: { id: true, amount: true, dueDate: true, status: true, customer: { select: { name: true } }, invoiceNumber: true },
      }),
      // deals last 12 months
      prisma.deal.findMany({
        where: { createdAt: { gte: since12Months } },
        select: { status: true, value: true, createdAt: true, updatedAt: true, ownerId: true, owner: { select: { name: true } } },
      }),
      // leads last 12 months
      prisma.lead.findMany({
        where: { createdAt: { gte: since12Months } },
        select: { status: true, createdAt: true, convertedAt: true, source: true, qualificationScore: true },
      }),
      // top 6 overdue by amount
      prisma.invoice.findMany({
        where: { status: 'OVERDUE' },
        orderBy: { amount: 'desc' },
        take: 6,
        select: { amount: true, dueDate: true, invoiceNumber: true, customer: { select: { name: true } } },
      }),
      // enrollments last 12 months
      prisma.mentorshipEnrollment.findMany({
        where: { startDate: { gte: since12Months } },
        select: { startDate: true, programType: true, status: true },
      }),
      // active students (all time)
      prisma.mentorshipEnrollment.count({ where: { status: 'ACTIVE' } }),
      // WON deals this month for top closers
      prisma.deal.findMany({
        where: { status: 'WON', updatedAt: { gte: months[2].start }, ownerId: { not: null } },
        select: { value: true, ownerId: true, updatedAt: true, owner: { select: { name: true } } },
      }),
    ]);

    // ── 3-month financial trend ───────────────────────────────────────────────
    const monthlyFinancial = months.map(({ start, end, label }) => {
      const revenue = allPaidInvoices
        .filter(p => p.paidAt && p.paidAt >= start && p.paidAt <= end)
        .reduce((s, p) => s + Number(p.amountPaid), 0);
      const invoiced = allInvoices12
        .filter(i => i.createdAt >= start && i.createdAt <= end)
        .reduce((s, i) => s + Number(i.amount), 0);
      const newInvoices = allInvoices12.filter(i => i.createdAt >= start && i.createdAt <= end).length;
      const collRate = invoiced > 0 ? (revenue / invoiced) * 100 : 0;
      return { label, revenue, invoiced, newInvoices, collectionRate: collRate };
    });

    // MRR = avg of last 3 COMPLETE calendar months (never includes current partial month)
    const mrrRevenues = mrrMonths.map(({ start, end }) =>
      allPaidInvoices
        .filter(p => p.paidAt && p.paidAt >= start && p.paidAt <= end)
        .reduce((s, p) => s + Number(p.amountPaid), 0)
    );
    const mrr = mrrRevenues.reduce((s, r) => s + r, 0) / 3;

    // Today's revenue
    const revenueToday = allPaidInvoices
      .filter(p => p.paidAt && p.paidAt >= todayStart)
      .reduce((s, p) => s + Number(p.amountPaid), 0);

    // ── Annual trend (trailing 12 months) ────────────────────────────────────
    const annualFinancial = annualMonths.map(({ start, end, label }) => {
      const revenue = allPaidInvoices
        .filter(p => p.paidAt && p.paidAt >= start && p.paidAt <= end)
        .reduce((s, p) => s + Number(p.amountPaid), 0);
      const invoiced = allInvoices12
        .filter(i => i.createdAt >= start && i.createdAt <= end)
        .reduce((s, i) => s + Number(i.amount), 0);
      const dealsWon = allDeals.filter(d => d.status === 'WON' && d.updatedAt >= start && d.updatedAt <= end).length;
      const newLeads = allLeads.filter(l => l.createdAt >= start && l.createdAt <= end).length;
      return { label, revenue, invoiced, dealsWon, newLeads };
    });

    // ── AR Aging ──────────────────────────────────────────────────────────────
    const agingBuckets = [
      { label: 'Current (not due)', min: -Infinity, max: 0 },
      { label: '1–30 days', min: 1, max: 30 },
      { label: '31–60 days', min: 31, max: 60 },
      { label: '61–90 days', min: 61, max: 90 },
      { label: '90+ days', min: 91, max: Infinity },
    ].map(({ label, min, max }) => {
      const matching = openInvoices.filter(inv => {
        const days = differenceInDays(now, inv.dueDate);
        return days >= min && days <= max;
      });
      return {
        label,
        count: matching.length,
        amount: matching.reduce((s, i) => s + Number(i.amount), 0),
      };
    });

    const totalAR = agingBuckets.reduce((s, b) => s + b.amount, 0);
    const overdueAmount = agingBuckets.slice(1).reduce((s, b) => s + b.amount, 0);
    const delinquencyRate = totalAR > 0 ? (overdueAmount / totalAR) * 100 : 0;

    // ── Top overdue invoices ──────────────────────────────────────────────────
    const topOverdue = topOverdueRaw.map(inv => ({
      customer: inv.customer?.name ?? 'Unknown',
      invoiceNumber: inv.invoiceNumber ?? '—',
      amount: Number(inv.amount),
      daysOverdue: differenceInDays(now, inv.dueDate),
    }));

    // ── 3-month commercial trend ──────────────────────────────────────────────
    const monthlyCommercial = months.map(({ start, end, label }) => {
      const won = allDeals.filter(d => d.status === 'WON' && d.updatedAt >= start && d.updatedAt <= end);
      const wonValue = won.reduce((s, d) => s + Number(d.value), 0);
      const newLeads = allLeads.filter(l => l.createdAt >= start && l.createdAt <= end).length;
      const qualified = allLeads.filter(l => l.createdAt >= start && l.createdAt <= end && l.status === 'QUALIFIED').length;
      return { label, dealsWon: won.length, wonValue, newLeads, qualified };
    });

    // ── Top closers this month ────────────────────────────────────────────────
    const thisMonthStart = months[2].start;
    const closerMap = new Map<string, { name: string; won: number; value: number }>();
    for (const d of monthWonDealsRaw.filter(d => d.updatedAt >= thisMonthStart)) {
      if (!d.ownerId) continue;
      const e = closerMap.get(d.ownerId) ?? { name: d.owner?.name ?? 'Unknown', won: 0, value: 0 };
      e.won++; e.value += Number(d.value);
      closerMap.set(d.ownerId, e);
    }
    const topClosers = Array.from(closerMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // ── Lead funnel this month ────────────────────────────────────────────────
    const thisMonthLeads = allLeads.filter(l => l.createdAt >= thisMonthStart);
    const funnelStatuses = ['NEW', 'QUALIFYING', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED', 'LOST'];
    const leadFunnel = funnelStatuses.map(s => ({
      status: s,
      count: thisMonthLeads.filter(l => l.status === s).length,
    }));
    const avgScore = thisMonthLeads
      .filter(l => l.qualificationScore && l.qualificationScore > 0)
      .reduce((s, l, _, arr) => s + (l.qualificationScore ?? 0) / arr.length, 0);

    // Lead sources this month
    const sourceMap = new Map<string, number>();
    for (const l of thisMonthLeads) {
      sourceMap.set(l.source, (sourceMap.get(l.source) ?? 0) + 1);
    }
    const leadSources = Array.from(sourceMap.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    // ── Enrollments by month ──────────────────────────────────────────────────
    const monthlyEnrollments = months.map(({ start, end, label }) => {
      const month = allEnrollments.filter(e => e.startDate >= start && e.startDate <= end);
      return {
        label,
        total: month.length,
        pass: month.filter(e => e.programType === 'PASS').length,
        advanced: month.filter(e => e.programType === 'ADVANCED').length,
      };
    });

    // ── Payment methods this month (from paid invoices) ───────────────────────
    const methodMap = new Map<string, number>();
    for (const p of allPaidInvoices.filter(p => p.paidAt && p.paidAt >= thisMonthStart)) {
      const key = p.paymentMethod ?? 'Other';
      methodMap.set(key, (methodMap.get(key) ?? 0) + Number(p.amountPaid));
    }
    const paymentMethods = Array.from(methodMap.entries())
      .map(([method, amount]) => ({ method, amount }))
      .sort((a, b) => b.amount - a.amount);

    // ── Today / week quick stats ──────────────────────────────────────────────
    const dealsWonToday = allDeals.filter(d => d.status === 'WON' && d.updatedAt >= todayStart).length;
    const dealsWonWeek = allDeals.filter(d => d.status === 'WON' && d.updatedAt >= weekStart).length;
    const leadsToday = allLeads.filter(l => l.createdAt >= todayStart).length;
    const leadsWeek = allLeads.filter(l => l.createdAt >= weekStart).length;

    // ── Avg negotiation time ──────────────────────────────────────────────────
    const negDays = allLeads
      .filter(l => l.convertedAt)
      .map(l => differenceInDays(l.convertedAt!, l.createdAt))
      .filter(d => d >= 0);
    const avgNegotiationDays = negDays.length
      ? Math.round(negDays.reduce((a, b) => a + b, 0) / negDays.length)
      : 0;

    // ── Compose data ──────────────────────────────────────────────────────────
    const digestData: AdminDailyDigestData = {
      date: format(now, 'EEEE, MMM d yyyy'),
      today: { revenueToday, dealsWonToday, leadsToday },
      week: { dealsWonWeek, leadsWeek },
      financial: {
        mrr: Math.round(mrr),
        totalAR,
        delinquencyRate: Math.round(delinquencyRate * 10) / 10,
        overdueAmount,
        overdueCount: openInvoices.filter(i => i.status === 'OVERDUE').length,
        monthlyTrend: monthlyFinancial,
        annualTrend: annualFinancial,
        arAging: agingBuckets,
        topOverdue,
        paymentMethods,
      },
      commercial: {
        monthlyTrend: monthlyCommercial,
        topClosers,
        leadFunnel,
        leadSources,
        avgQualificationScore: Math.round(avgScore * 10) / 10,
      },
      operations: {
        activeStudents,
        avgNegotiationDays,
        monthlyEnrollments,
      },
    };

    let sent = 0, failed = 0;
    const results: Array<{ email: string; status: 'sent' | 'failed'; error?: string }> = [];
    for (const user of recipients) {
      try {
        await emailService.sendAdminDailyDigest(user, digestData);
        sent++;
        results.push({ email: user.email, status: 'sent' });
      } catch (err) {
        failed++;
        results.push({ email: user.email, status: 'failed', error: err instanceof Error ? err.message : String(err) });
      }
    }

    return NextResponse.json({ success: true, sent, failed, total: recipients.length, results, timestamp: now.toISOString() });
  } catch (error) {
    console.error('[DailyBIDigest] Fatal:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
