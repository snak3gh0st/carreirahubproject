// lib/services/financial-bi.ts
import { prisma } from "@/lib/db";
import { InvoiceStatus } from "@prisma/client";
import { startOfMonth, addMonths, subMonths, subDays, startOfYear, format, differenceInDays } from "date-fns";
import { evaluateCfoRules, CfoFacts } from "@/lib/services/cfo-rules";
import { getCachedCfoInsight, CfoAnalysisInput } from "@/lib/services/cfo-analysis";
import { parseProfitAndLoss, parseBalanceSheet } from "@/lib/services/qb-report-parser";
import { buildCustomerPaymentTrends, buildPatternAlerts } from "@/lib/financial/cfo-signals";
import { getCachedQbCfoReportPacket } from "@/lib/services/qb-cfo-reports";
import {
  FinancialBIResponse,
  KPIMetric,
  TabParam,
  DateRangeParam,
  RevenueGrowthData,
  ArCollectionsData,
  CashFlowData,
  ReceivablesProjectionData,
  CustomerAnalysisData,
  PnLData,
} from "@/lib/types/financial-bi";

// ── Date range helpers ──────────────────────────────────────

function getDateRange(dateRange: DateRangeParam, from?: string, to?: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  const endDate = to ? new Date(to) : now;

  switch (dateRange) {
    case "last7":
      return { startDate: subDays(now, 7), endDate };
    case "last30":
      return { startDate: subDays(now, 30), endDate };
    case "last90":
      return { startDate: subDays(now, 90), endDate };
    case "thisYear":
      return { startDate: startOfYear(now), endDate };
    case "custom":
      return { startDate: from ? new Date(from) : subDays(now, 30), endDate };
    case "allTime":
    default:
      return { startDate: new Date("2020-01-01"), endDate };
  }
}

function getPreviousPeriod(startDate: Date, endDate: Date): { startDate: Date; endDate: Date } {
  const days = differenceInDays(endDate, startDate);
  return {
    startDate: subDays(startDate, days),
    endDate: subDays(startDate, 1),
  };
}

function buildKpiMetric(value: number, prevValue: number, thresholds?: { warningPct?: number; dangerPct?: number; invertDirection?: boolean }): KPIMetric {
  const changePct = prevValue > 0 ? ((value - prevValue) / prevValue) * 100 : 0;
  const opts = { warningPct: 5, dangerPct: 15, invertDirection: false, ...thresholds };

  let contextLevel: "good" | "warning" | "danger" = "good";
  let context = "healthy";

  if (!opts.invertDirection) {
    if (changePct < -opts.dangerPct) { contextLevel = "danger"; context = "critical"; }
    else if (changePct < -opts.warningPct) { contextLevel = "warning"; context = "needs attention"; }
  } else {
    if (changePct > opts.dangerPct) { contextLevel = "danger"; context = "critical"; }
    else if (changePct > opts.warningPct) { contextLevel = "warning"; context = "needs attention"; }
  }

  return { value, prevValue, changePct, context, contextLevel };
}

// ── Core summary queries ────────────────────────────────────

async function querySummary(startDate: Date, endDate: Date, prevStart: Date, prevEnd: Date) {
  const dateFilter = { gte: startDate, lte: endDate };
  const prevDateFilter = { gte: prevStart, lte: prevEnd };

  const [
    paidAgg, invoicedAgg, outstandingAgg,
    prevPaidAgg, prevInvoicedAgg, prevOutstandingAgg,
    revenueTrend, agingInvoices, topCustomerPayments, systemConfig,
  ] = await Promise.all([
    prisma.invoice.aggregate({ where: { status: "PAID", paidAt: dateFilter }, _sum: { amountPaid: true } }),
    prisma.invoice.aggregate({ where: { createdAt: dateFilter, status: { not: "VOID" } }, _sum: { amount: true } }),
    prisma.invoice.aggregate({ where: { status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] } }, _sum: { amount: true } }),
    prisma.invoice.aggregate({ where: { status: "PAID", paidAt: prevDateFilter }, _sum: { amountPaid: true } }),
    prisma.invoice.aggregate({ where: { createdAt: prevDateFilter, status: { not: "VOID" } }, _sum: { amount: true } }),
    prisma.invoice.aggregate({ where: { status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] }, createdAt: { lte: prevEnd } }, _sum: { amount: true } }),
    prisma.payment.findMany({ where: { paymentDate: { gte: subMonths(new Date(), 12) } }, select: { paymentDate: true, amount: true } }),
    prisma.invoice.findMany({ where: { status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] } }, select: { id: true, amount: true, dueDate: true, customerId: true } }),
    prisma.payment.groupBy({ by: ["customerId"], _sum: { amount: true }, orderBy: { _sum: { amount: "desc" } }, take: 10 }),
    prisma.systemConfig.findUnique({ where: { id: "system" }, select: { last_qb_sync: true } }),
  ]);

  const revenue = Number(paidAgg._sum.amountPaid || 0);
  const prevRevenue = Number(prevPaidAgg._sum.amountPaid || 0);
  const totalInvoiced = Number(invoicedAgg._sum.amount || 0);
  const prevTotalInvoiced = Number(prevInvoicedAgg._sum.amount || 0);
  const outstanding = Number(outstandingAgg._sum.amount || 0);
  const prevOutstanding = Number(prevOutstandingAgg._sum.amount || 0);

  const collectionRate = totalInvoiced > 0 ? (revenue / totalInvoiced) * 100 : 0;
  const prevCollectionRate = prevTotalInvoiced > 0 ? (prevRevenue / prevTotalInvoiced) * 100 : 0;

  // MRR: average monthly collected revenue over last 3 months
  const threeMonthsAgo = subMonths(new Date(), 3);
  const recentPayments = revenueTrend.filter((p) => p.paymentDate >= threeMonthsAgo);
  const recentTotal = recentPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const mrr = recentTotal / 3;
  const sixMonthsAgo = subMonths(new Date(), 6);
  const prevRecentPayments = revenueTrend.filter((p) => p.paymentDate >= sixMonthsAgo && p.paymentDate < threeMonthsAgo);
  const prevRecentTotal = prevRecentPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const prevMrr = prevRecentTotal / 3;

  // Revenue trend mini (12 months)
  const monthlyRevenue = new Map<string, number>();
  for (const p of revenueTrend) {
    const key = format(p.paymentDate, "yyyy-MM");
    monthlyRevenue.set(key, (monthlyRevenue.get(key) || 0) + Number(p.amount));
  }
  const revenueTrendMini = Array.from(monthlyRevenue.entries())
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Aging snapshot
  const now = new Date();
  const agingBuckets = [
    { bucket: "Current", min: -Infinity, max: 0 },
    { bucket: "1-30", min: 1, max: 30 },
    { bucket: "31-60", min: 31, max: 60 },
    { bucket: "61-90", min: 61, max: 90 },
    { bucket: "90+", min: 91, max: Infinity },
  ];

  const agingSnapshotMini = agingBuckets.map(({ bucket, min, max }) => {
    const matching = agingInvoices.filter((inv) => {
      const days = differenceInDays(now, inv.dueDate);
      return days >= min && days <= max;
    });
    return {
      bucket,
      amount: matching.reduce((sum, inv) => sum + Number(inv.amount), 0),
      count: matching.length,
    };
  });

  // Concentration
  const totalPaidAllTime = topCustomerPayments.reduce((sum, g) => sum + Number(g._sum.amount || 0), 0);
  const customerIds = topCustomerPayments.slice(0, 3).map((g) => g.customerId);
  const topThreeTotal = topCustomerPayments.slice(0, 3).reduce((sum, g) => sum + Number(g._sum.amount || 0), 0);
  const concentration = totalPaidAllTime > 0 ? (topThreeTotal / totalPaidAllTime) * 100 : 0;

  const topCustomerNames = customerIds.length > 0
    ? await prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true } })
    : [];
  const nameMap = new Map(topCustomerNames.map((c) => [c.id, c.name]));
  const topClients = topCustomerPayments.slice(0, 3).map((g) => ({
    name: nameMap.get(g.customerId) || "Unknown",
    percentage: totalPaidAllTime > 0 ? (Number(g._sum.amount || 0) / totalPaidAllTime) * 100 : 0,
  }));

  return {
    revenue: buildKpiMetric(revenue, prevRevenue),
    collectionRate: buildKpiMetric(collectionRate, prevCollectionRate),
    outstandingAR: buildKpiMetric(outstanding, prevOutstanding, { invertDirection: true }),
    mrr: buildKpiMetric(mrr, prevMrr),
    topClientConcentration: {
      ...buildKpiMetric(concentration, concentration, { invertDirection: true, warningPct: 40, dangerPct: 50 }),
      topClients,
    },
    revenueTrendMini,
    agingSnapshotMini,
    _raw: {
      collectionRate, prevCollectionRate, collectionRateChange: collectionRate - prevCollectionRate,
      outstandingAR: outstanding, topThreeConcentration: concentration, topThreeClients: topClients,
      aging90PlusAmount: agingSnapshotMini.find((b) => b.bucket === "90+")?.amount || 0,
      prevAging90PlusAmount: 0, totalInvoiced, revenue,
      revenueChangePct: prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0,
      mrr, agingInvoices,
      thirtyDayCashProjection: mrr,
    },
    _lastQbSync: systemConfig?.last_qb_sync?.toISOString() || null,
  };
}

// ── Tab queries ─────────────────────────────────────────────

async function queryRevenueGrowth(startDate: Date, endDate: Date): Promise<RevenueGrowthData> {
  const payments = await prisma.payment.findMany({
    where: { paymentDate: { gte: subMonths(new Date(), 12) } },
    select: { paymentDate: true, amount: true },
  });
  const invoices = await prisma.invoice.findMany({
    where: { createdAt: { gte: subMonths(new Date(), 12) }, status: { not: "VOID" } },
    select: { createdAt: true, amount: true, lineItems: true, status: true, amountPaid: true, paidAt: true },
  });

  const invoicedByMonth = new Map<string, number>();
  const collectedByMonth = new Map<string, number>();
  for (const inv of invoices) {
    const month = format(inv.createdAt, "yyyy-MM");
    invoicedByMonth.set(month, (invoicedByMonth.get(month) || 0) + Number(inv.amount));
  }
  for (const p of payments) {
    const month = format(p.paymentDate, "yyyy-MM");
    collectedByMonth.set(month, (collectedByMonth.get(month) || 0) + Number(p.amount));
  }
  const allMonths = new Set([...invoicedByMonth.keys(), ...collectedByMonth.keys()]);
  const invoicedVsCollected = Array.from(allMonths).sort().map((month) => ({
    month, invoiced: invoicedByMonth.get(month) || 0, collected: collectedByMonth.get(month) || 0,
  }));

  const serviceRevenue = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.lineItems && Array.isArray(inv.lineItems)) {
      for (const item of inv.lineItems as Array<{ description?: string; name?: string; amount?: number }>) {
        const name = item.description || item.name || "Other";
        serviceRevenue.set(name, (serviceRevenue.get(name) || 0) + Number(item.amount || 0));
      }
    }
  }
  const revenueByService = Array.from(serviceRevenue.entries())
    .map(([service, amount]) => ({ service, amount }))
    .sort((a, b) => b.amount - a.amount).slice(0, 10);

  const mrrTrend = invoicedVsCollected.map((m) => ({ month: m.month, mrr: m.collected, arr: m.collected * 12 }));
  const momGrowth = invoicedVsCollected.map((m, i) => {
    const prev = i > 0 ? invoicedVsCollected[i - 1].collected : 0;
    return { month: m.month, growthPct: prev > 0 ? ((m.collected - prev) / prev) * 100 : 0 };
  });

  return { invoicedVsCollected, revenueByService, mrrTrend, momGrowth };
}

async function queryArCollections(startDate: Date, endDate: Date): Promise<ArCollectionsData> {
  const now = new Date();
  const [overdueInvoicesRaw, paidInvoices] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: { in: ["OVERDUE", "SENT", "PARTIALLY_PAID"] } },
      include: { customer: { select: { name: true } }, owner: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.invoice.findMany({
      where: { status: "PAID", paidAt: { gte: subMonths(now, 12) } },
      select: { createdAt: true, paidAt: true, amount: true, amountPaid: true },
    }),
  ]);

  const agingBuckets = [
    { bucket: "Current", min: -Infinity, max: 0 },
    { bucket: "1-30", min: 1, max: 30 },
    { bucket: "31-60", min: 31, max: 60 },
    { bucket: "61-90", min: 61, max: 90 },
    { bucket: "90+", min: 91, max: Infinity },
  ];
  const agingBreakdown = agingBuckets.map(({ bucket, min, max }) => {
    const matching = overdueInvoicesRaw.filter((inv) => {
      const days = differenceInDays(now, inv.dueDate);
      return days >= min && days <= max;
    });
    return { bucket, count: matching.length, amount: matching.reduce((sum, inv) => sum + Number(inv.amount), 0) };
  });

  const monthlyPerformance = new Map<string, { totalDays: number; count: number; paid: number; invoiced: number }>();
  for (const inv of paidInvoices) {
    if (!inv.paidAt) continue;
    const month = format(inv.paidAt, "yyyy-MM");
    const days = differenceInDays(inv.paidAt, inv.createdAt);
    const existing = monthlyPerformance.get(month) || { totalDays: 0, count: 0, paid: 0, invoiced: 0 };
    existing.totalDays += days; existing.count += 1;
    existing.paid += Number(inv.amountPaid || 0); existing.invoiced += Number(inv.amount);
    monthlyPerformance.set(month, existing);
  }
  const collectionPerformance = Array.from(monthlyPerformance.entries()).sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month, avgDaysToPayment: data.count > 0 ? Math.round(data.totalDays / data.count) : 0,
      collectionRate: data.invoiced > 0 ? (data.paid / data.invoiced) * 100 : 0,
    }));

  const overdueInvoices = overdueInvoicesRaw
    .filter((inv) => differenceInDays(now, inv.dueDate) > 0)
    .map((inv) => ({
      id: inv.id, customerName: inv.customer.name, invoiceNumber: inv.invoiceNumber || "N/A",
      amount: Number(inv.amount), dueDate: inv.dueDate.toISOString(),
      daysOverdue: differenceInDays(now, inv.dueDate), remindersSent: inv.paymentReminderCount,
      collectionCalls: inv.collectionCallCount, autoChargeStatus: inv.autoChargeStatus,
      ownerName: inv.owner?.name || "Unassigned",
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  return { agingBreakdown, collectionPerformance, overdueInvoices };
}

async function queryCashFlow(): Promise<CashFlowData> {
  const now = new Date();
  const outstandingInvoices = await prisma.invoice.findMany({
    where: { status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] } },
    include: { customer: { select: { name: true, id: true } }, payments: { select: { paymentDate: true, amount: true } } },
  });

  function calcProbability(daysOverdue: number): number {
    if (daysOverdue <= 0) return 95;
    if (daysOverdue <= 30) return 80;
    if (daysOverdue <= 60) return 55;
    if (daysOverdue <= 90) return 30;
    if (daysOverdue <= 180) return 15;
    return 5;
  }

  function getRiskLevel(prob: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
    if (prob >= 80) return "LOW";
    if (prob >= 60) return "MEDIUM";
    if (prob >= 40) return "HIGH";
    return "CRITICAL";
  }

  const weeks: CashFlowData["forecast"] = [];
  for (let i = 0; i < 13; i++) {
    const weekStart = subDays(now, -(i * 7));
    const weekEnd = subDays(now, -((i + 1) * 7));
    const weekLabel = format(weekStart, "MMM dd");
    let optimistic = 0, expected = 0, conservative = 0;

    for (const inv of outstandingInvoices) {
      const dueInWeek = inv.dueDate >= weekStart && inv.dueDate < weekEnd;
      if (!dueInWeek && i > 0) continue;
      if (i === 0 && inv.dueDate > weekEnd) continue;

      const amount = Number(inv.amount) - Number(inv.amountPaid || 0);
      if (amount <= 0) continue;
      const daysOverdue = differenceInDays(now, inv.dueDate);
      const prob = calcProbability(daysOverdue) / 100;
      optimistic += amount; expected += amount * prob; conservative += amount * Math.max(prob - 0.2, 0);
    }
    weeks.push({ date: weekLabel, optimistic, expected, conservative });
  }

  const segments: Record<string, { amount: number; count: number }> = {
    "High (>80%)": { amount: 0, count: 0 }, "Medium (50-80%)": { amount: 0, count: 0 },
    "Low (20-50%)": { amount: 0, count: 0 }, "Bad debt (<20%)": { amount: 0, count: 0 },
  };
  const atRiskList: CashFlowData["atRiskInvoices"] = [];

  for (const inv of outstandingInvoices) {
    const remaining = Number(inv.amount) - Number(inv.amountPaid || 0);
    if (remaining <= 0) continue;
    const daysOverdue = differenceInDays(now, inv.dueDate);
    const prob = calcProbability(daysOverdue);
    const riskLevel = getRiskLevel(prob);

    if (prob >= 80) { segments["High (>80%)"].amount += remaining; segments["High (>80%)"].count++; }
    else if (prob >= 50) { segments["Medium (50-80%)"].amount += remaining; segments["Medium (50-80%)"].count++; }
    else if (prob >= 20) { segments["Low (20-50%)"].amount += remaining; segments["Low (20-50%)"].count++; }
    else { segments["Bad debt (<20%)"].amount += remaining; segments["Bad debt (<20%)"].count++; }

    if (prob < 80) {
      const lastPayment = inv.payments.sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime())[0];
      atRiskList.push({
        id: inv.id, customerName: inv.customer.name, amount: remaining,
        dueDate: inv.dueDate.toISOString(), daysOverdue: Math.max(daysOverdue, 0),
        probability: prob, riskLevel,
        lastAction: lastPayment ? `Payment $${Number(lastPayment.amount)} on ${format(lastPayment.paymentDate, "MMM dd")}` : "No payments",
      });
    }
  }

  return {
    forecast: weeks,
    probabilityBreakdown: Object.entries(segments).map(([segment, data]) => ({ segment, ...data })),
    atRiskInvoices: atRiskList.sort((a, b) => a.probability - b.probability),
  };
}

async function queryReceivablesProjection(): Promise<ReceivablesProjectionData> {
  const now = new Date();
  // 2025-01-01 baseline: exclude legacy pre-2025 invoices from delinquency/projection
  const BASE_DATE = new Date("2025-01-01");

  const [outstandingInvoices, pnlCache] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] },
        dueDate: { gte: BASE_DATE },
      },
      select: { id: true, amount: true, amountPaid: true, dueDate: true, status: true },
    }),
    prisma.qbReportCache.findUnique({ where: { reportType: "ProfitAndLoss" }, select: { data: true } }),
  ]);

  // Monthly breakeven from QB burn rate — count only months with real expense or COGS data
  let monthlyBreakeven = 0;
  try {
    if (pnlCache) {
      const pnl = JSON.parse(pnlCache.data);
      const expByMonth: number[] = pnl.expenses?.byMonth || [];
      const cogsbyMonth: number[] = pnl.cogs?.byMonth || [];
      const maxLen = Math.max(expByMonth.length, cogsbyMonth.length);
      const activeMonths = Array.from({ length: maxLen }, (_, i) =>
        (expByMonth[i] || 0) + (cogsbyMonth[i] || 0)
      ).filter((v) => v > 0).length || 1;
      monthlyBreakeven = ((pnl.expenses?.total || 0) + (pnl.cogs?.total || 0)) / activeMonths;
    }
  } catch {
    // QB cache not available — breakeven will be 0 (hidden in UI)
  }

  function calcProbability(daysOverdue: number): number {
    if (daysOverdue <= 0) return 95;
    if (daysOverdue <= 30) return 80;
    if (daysOverdue <= 60) return 55;
    if (daysOverdue <= 90) return 30;
    if (daysOverdue <= 180) return 15;
    return 5;
  }

  // 6-month projection: current month shows only this month's invoices +
  // overdue invoices (2025+), NOT a dump of all historical overdue.
  // Overdue 2025+ are shown in month 0 as "delinquent carry-over".
  const overdueCarryOver = outstandingInvoices.filter(
    (inv) => differenceInDays(now, inv.dueDate) > 0 && format(inv.dueDate, "yyyy-MM") !== format(now, "yyyy-MM")
  );

  const monthlyProjection: ReceivablesProjectionData["monthlyProjection"] = [];
  for (let i = 0; i < 6; i++) {
    const targetMonthStart = startOfMonth(addMonths(now, i));
    const monthKey = format(targetMonthStart, "yyyy-MM");
    const monthLabel = format(targetMonthStart, "MMM yyyy");

    // Invoices whose dueDate falls in this calendar month
    const calendarMonthInvoices = outstandingInvoices.filter(
      (inv) => format(inv.dueDate, "yyyy-MM") === monthKey
    );

    // Month 0: also include all overdue carry-over (past months 2025+)
    const monthInvoices = i === 0
      ? [...calendarMonthInvoices, ...overdueCarryOver]
      : calendarMonthInvoices;

    let totalDue = 0;
    let collectionExpected = 0;
    let delinquentAmount = 0;

    for (const inv of monthInvoices) {
      const remaining = Number(inv.amount) - Number(inv.amountPaid || 0);
      if (remaining <= 0) continue;
      const daysOverdue = differenceInDays(now, inv.dueDate);
      const prob = calcProbability(daysOverdue) / 100;
      totalDue += remaining;
      collectionExpected += remaining * prob;
      if (daysOverdue > 0) delinquentAmount += remaining;
    }

    monthlyProjection.push({
      month: monthKey,
      monthLabel,
      totalDue: Math.round(totalDue),
      collectionExpected: Math.round(collectionExpected),
      optimistic: Math.round(totalDue),
      conservative: Math.round(collectionExpected * 0.7),
      invoiceCount: monthInvoices.length,
      delinquentAmount: Math.round(delinquentAmount),
    });
  }

  // Delinquency breakdown (2025+ only)
  let current = 0, days1to30 = 0, days31to60 = 0, days61to90 = 0, days90plus = 0;
  let estimatedRecovery = 0;
  let totalAR = 0;

  for (const inv of outstandingInvoices) {
    const remaining = Number(inv.amount) - Number(inv.amountPaid || 0);
    if (remaining <= 0) continue;
    totalAR += remaining;
    const daysOverdue = differenceInDays(now, inv.dueDate);
    const prob = calcProbability(daysOverdue) / 100;
    estimatedRecovery += remaining * prob;

    if (daysOverdue <= 0) current += remaining;
    else if (daysOverdue <= 30) days1to30 += remaining;
    else if (daysOverdue <= 60) days31to60 += remaining;
    else if (daysOverdue <= 90) days61to90 += remaining;
    else days90plus += remaining;
  }

  const totalDelinquent = days1to30 + days31to60 + days61to90 + days90plus;

  const next7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const next30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const upcomingNext7Days = outstandingInvoices
    .filter((inv) => inv.dueDate >= now && inv.dueDate <= next7)
    .reduce((sum, inv) => sum + Math.max(Number(inv.amount) - Number(inv.amountPaid || 0), 0), 0);

  const upcomingNext30Days = outstandingInvoices
    .filter((inv) => inv.dueDate >= now && inv.dueDate <= next30)
    .reduce((sum, inv) => sum + Math.max(Number(inv.amount) - Number(inv.amountPaid || 0), 0), 0);

  return {
    monthlyProjection,
    delinquency: {
      totalDelinquent: Math.round(totalDelinquent),
      totalAR: Math.round(totalAR),
      delinquencyRate: totalAR > 0 ? (totalDelinquent / totalAR) * 100 : 0,
      current: Math.round(current),
      days1to30: Math.round(days1to30),
      days31to60: Math.round(days31to60),
      days61to90: Math.round(days61to90),
      days90plus: Math.round(days90plus),
      estimatedRecovery: Math.round(estimatedRecovery),
      estimatedLoss: Math.round(totalDelinquent - Math.min(estimatedRecovery, totalDelinquent)),
    },
    overdueTotal: Math.round(totalDelinquent),
    upcomingNext7Days: Math.round(upcomingNext7Days),
    upcomingNext30Days: Math.round(upcomingNext30Days),
    monthlyBreakeven: Math.round(monthlyBreakeven),
  };
}

async function queryCustomerAnalysis(): Promise<CustomerAnalysisData> {
  const now = new Date();
  const [customerPayments, allCustomers] = await Promise.all([
    prisma.payment.groupBy({ by: ["customerId"], _sum: { amount: true }, orderBy: { _sum: { amount: "desc" } } }),
    prisma.customer.findMany({
      select: { id: true, name: true, invoices: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 } },
    }),
  ]);

  const customerNames = await prisma.customer.findMany({
    where: { id: { in: customerPayments.map((c) => c.customerId) } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(customerNames.map((c) => [c.id, c.name]));

  const totalRevenue = customerPayments.reduce((sum, c) => sum + Number(c._sum.amount || 0), 0);
  let cumulative = 0;
  const concentration = customerPayments.map((c) => {
    const rev = Number(c._sum.amount || 0);
    cumulative += rev;
    return { customer: nameMap.get(c.customerId) || "Unknown", revenue: rev, cumulativePct: totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 0 };
  });

  const topCustomers = customerPayments.slice(0, 10).map((c) => ({
    customer: nameMap.get(c.customerId) || "Unknown", totalPaid: Number(c._sum.amount || 0),
  }));

  const segmentCounts: Record<string, { count: number; revenue: number }> = {
    Active: { count: 0, revenue: 0 }, Inactive: { count: 0, revenue: 0 }, Churned: { count: 0, revenue: 0 },
  };
  const paymentMap = new Map(customerPayments.map((c) => [c.customerId, Number(c._sum.amount || 0)]));

  for (const cust of allCustomers) {
    const lastInvoice = cust.invoices[0];
    const rev = paymentMap.get(cust.id) || 0;
    if (!lastInvoice) { segmentCounts.Churned.count++; segmentCounts.Churned.revenue += rev; }
    else {
      const daysSince = differenceInDays(now, lastInvoice.createdAt);
      if (daysSince <= 90) { segmentCounts.Active.count++; segmentCounts.Active.revenue += rev; }
      else if (daysSince <= 180) { segmentCounts.Inactive.count++; segmentCounts.Inactive.revenue += rev; }
      else { segmentCounts.Churned.count++; segmentCounts.Churned.revenue += rev; }
    }
  }

  const segments = Object.entries(segmentCounts).map(([segment, data]) => ({ segment, ...data }));
  const amounts = customerPayments.map((c) => Number(c._sum.amount || 0)).filter((a) => a > 0);
  const average = amounts.length > 0 ? amounts.reduce((sum, a) => sum + a, 0) / amounts.length : 0;
  const sorted = [...amounts].sort((a, b) => a - b);
  const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;

  return { concentration, topCustomers, segments, ltv: { average, median, trend: [] } };
}

// ── P&L from QB report cache ────────────────────────────────

async function queryPnL(startDate: Date, endDate: Date): Promise<PnLData | null> {
  try {
    const [pnlCache, bsCache] = await Promise.all([
      prisma.qbReportCache.findUnique({ where: { reportType: "ProfitAndLoss" } }),
      prisma.qbReportCache.findUnique({ where: { reportType: "BalanceSheet" } }),
    ]);

    if (!pnlCache) return null;

    const pnlData = JSON.parse(pnlCache.data);
    const bsData = bsCache ? JSON.parse(bsCache.data) : null;

    const { income, cogs, expenses, netIncome, months } = pnlData;

    const monthlyPnL = months.map((month: string, i: number) => ({
      month,
      revenue: income.byMonth[i] || 0,
      cogs: cogs.byMonth[i] || 0,
      expenses: expenses.byMonth[i] || 0,
      netIncome: netIncome.byMonth[i] || 0,
    }));

    const totalExp = expenses.total || 1;
    const expensesByCategory = (expenses.byCategory || []).slice(0, 15).map(
      (c: { category: string; amount: number }) => ({
        category: c.category,
        amount: c.amount,
        pctOfTotal: (c.amount / totalExp) * 100,
      })
    );

    const recentMonths = monthlyPnL.slice(-3);
    const burnRate = recentMonths.length > 0
      ? recentMonths.reduce((sum: number, m: { expenses: number; cogs: number }) => sum + m.expenses + m.cogs, 0) / recentMonths.length
      : 0;

    const prevMonths = monthlyPnL.slice(-6, -3);
    const prevBurnRate = prevMonths.length > 0
      ? prevMonths.reduce((sum: number, m: { expenses: number; cogs: number }) => sum + m.expenses + m.cogs, 0) / prevMonths.length
      : 0;

    const cashOnHand = bsData?.bankAccounts?.total || 0;
    const runwayMonths = burnRate > 0 ? cashOnHand / burnRate : 99;

    const halfPoint = Math.floor(months.length / 2);
    const prevRevenue = monthlyPnL.slice(0, halfPoint).reduce((s: number, m: { revenue: number }) => s + m.revenue, 0);
    const prevExpenses = monthlyPnL.slice(0, halfPoint).reduce((s: number, m: { expenses: number; cogs: number }) => s + m.expenses + m.cogs, 0);

    const marginPct = income.total > 0 ? (netIncome.total / income.total) * 100 : 0;

    return {
      totalRevenue: income.total,
      totalExpenses: expenses.total + cogs.total,
      totalCOGS: cogs.total,
      netIncome: netIncome.total,
      marginPct,
      prevTotalRevenue: prevRevenue,
      prevTotalExpenses: prevExpenses,
      prevNetIncome: prevRevenue - prevExpenses,
      monthlyPnL,
      expensesByCategory,
      burnRate,
      prevBurnRate,
      cashOnHand,
      runwayMonths,
      lastFetchedAt: pnlCache.fetchedAt.toISOString(),
    };
  } catch (error) {
    console.error("[FINANCIAL-BI] Error reading QB report cache:", error);
    return null;
  }
}

// ── Public API ──────────────────────────────────────────────

export async function getFinancialKPIs(dateRange: string): Promise<CfoAnalysisInput> {
  const { startDate, endDate } = getDateRange(dateRange as DateRangeParam);
  const prev = getPreviousPeriod(startDate, endDate);
  const summary = await querySummary(startDate, endDate, prev.startDate, prev.endDate);

  const [overdueInvoices, recentPaidInvoices, qbReportPacket] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: "OVERDUE" },
      include: { customer: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.invoice.findMany({
      where: {
        status: "PAID",
        paidAt: { not: null, gte: subMonths(new Date(), 6) },
      },
      select: {
        customerId: true,
        createdAt: true,
        paidAt: true,
        customer: { select: { name: true } },
      },
    }),
    getCachedQbCfoReportPacket(),
  ]);
  const worst = overdueInvoices[0];
  const customerPaymentTrends = buildCustomerPaymentTrends(
    recentPaidInvoices
      .filter((invoice): invoice is typeof invoice & { paidAt: Date } => Boolean(invoice.paidAt))
      .map((invoice) => ({
        customerId: invoice.customerId,
        customerName: invoice.customer.name,
        issuedAt: invoice.createdAt,
        paidAt: invoice.paidAt,
      }))
  );
  const patternAlerts = buildPatternAlerts({
    collectionRateChange: summary._raw.collectionRateChange,
    aging90PlusAmount: summary._raw.aging90PlusAmount,
    worstOverdue: worst
      ? {
          customer: worst.customer.name,
          amount: Number(worst.amount),
          days: differenceInDays(new Date(), worst.dueDate),
        }
      : null,
    customerPaymentTrends,
  });

  const result: CfoAnalysisInput = {
    revenue: summary.revenue.value, revenueChangePct: summary._raw.revenueChangePct,
    collectionRate: summary._raw.collectionRate, prevCollectionRate: summary._raw.prevCollectionRate,
    outstandingAR: summary.outstandingAR.value, mrr: summary.mrr.value,
    topThreeConcentration: summary._raw.topThreeConcentration, topThreeClients: summary._raw.topThreeClients,
    overdueCount: overdueInvoices.length,
    overdueTotal: overdueInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0),
    worstOverdue: worst ? { customer: worst.customer.name, amount: Number(worst.amount), days: differenceInDays(new Date(), worst.dueDate) } : null,
    aging90Plus: summary._raw.aging90PlusAmount, cashProjection30Day: summary._raw.thirtyDayCashProjection,
    patternAlerts, dateRangeLabel: dateRange,
    totalExpenses: 0,
    netIncome: 0,
    marginPct: 0,
    burnRate: 0,
    cashOnHand: 0,
    runwayMonths: 0,
    topExpenseCategory: "",
    topExpenseAmount: 0,
    qbReportPacket,
  };

  // Try to enrich with P&L data
  try {
    const pnlCache = await prisma.qbReportCache.findUnique({ where: { reportType: "ProfitAndLoss" } });
    const bsCache = await prisma.qbReportCache.findUnique({ where: { reportType: "BalanceSheet" } });
    if (pnlCache) {
      const pnl = JSON.parse(pnlCache.data);
      const bs = bsCache ? JSON.parse(bsCache.data) : null;
      const totalExp = (pnl.expenses?.total || 0) + (pnl.cogs?.total || 0);
      const expByMonth: number[] = pnl.expenses?.byMonth || [];
      const cogsByMonth: number[] = pnl.cogs?.byMonth || [];
      const maxLen = Math.max(expByMonth.length, cogsByMonth.length);
      const activeMonths = Array.from({ length: maxLen }, (_, i) =>
        (expByMonth[i] || 0) + (cogsByMonth[i] || 0)
      ).filter((v) => v > 0).length || 1;
      const topCat = pnl.expenses?.byCategory?.[0];
      Object.assign(result, {
        totalExpenses: totalExp,
        netIncome: pnl.netIncome?.total || 0,
        marginPct: pnl.income?.total > 0 ? ((pnl.netIncome?.total || 0) / pnl.income.total) * 100 : 0,
        burnRate: totalExp / activeMonths,
        cashOnHand: bs?.bankAccounts?.total || 0,
        runwayMonths: totalExp > 0 ? (bs?.bankAccounts?.total || 0) / (totalExp / activeMonths) : 0,
        topExpenseCategory: topCat?.category || "",
        topExpenseAmount: topCat?.amount || 0,
      });
    }
  } catch (e) {
    // Ignore — expense data is optional
  }

  return result;
}

export async function getFinancialBIData(
  dateRange: DateRangeParam, from?: string, to?: string, tab: TabParam = "all",
): Promise<FinancialBIResponse> {
  const { startDate, endDate } = getDateRange(dateRange, from, to);
  const prev = getPreviousPeriod(startDate, endDate);
  // Run summary, overdue invoices, cached insight, and tab queries ALL in parallel
  const tabQueries: Promise<unknown>[] = [];
  const tabKeys: string[] = [];
  if (tab === "all" || tab === "revenue") { tabQueries.push(queryRevenueGrowth(startDate, endDate)); tabKeys.push("revenueGrowth"); }
  if (tab === "all" || tab === "ar") { tabQueries.push(queryArCollections(startDate, endDate)); tabKeys.push("arCollections"); }
  if (tab === "all" || tab === "cashflow") { tabQueries.push(queryCashFlow()); tabKeys.push("cashFlow"); }
  if (tab === "all" || tab === "cashflow") { tabQueries.push(queryReceivablesProjection()); tabKeys.push("receivablesProjection"); }
  if (tab === "all" || tab === "customers") { tabQueries.push(queryCustomerAnalysis()); tabKeys.push("customerAnalysis"); }
  if (tab === "all" || tab === "pnl") { tabQueries.push(queryPnL(startDate, endDate)); tabKeys.push("pnl"); }

  const [summaryRaw, overdueForRules, recentPaidForRules, cachedInsight, ...tabResults] = await Promise.all([
    querySummary(startDate, endDate, prev.startDate, prev.endDate),
    prisma.invoice.findMany({
      where: { status: "OVERDUE" },
      include: { customer: { select: { name: true } } },
    }),
    prisma.invoice.findMany({
      where: {
        status: "PAID",
        paidAt: { not: null, gte: subMonths(new Date(), 6) },
      },
      select: {
        customerId: true,
        createdAt: true,
        paidAt: true,
        customer: { select: { name: true } },
      },
    }),
    getCachedCfoInsight(dateRange),
    ...tabQueries,
  ]);

  const facts: CfoFacts = {
    collectionRate: summaryRaw._raw.collectionRate, prevCollectionRate: summaryRaw._raw.prevCollectionRate,
    collectionRateChange: summaryRaw._raw.collectionRateChange, outstandingAR: summaryRaw.outstandingAR.value,
    topThreeConcentration: summaryRaw._raw.topThreeConcentration, topThreeClients: summaryRaw._raw.topThreeClients,
    overdueInvoices: overdueForRules.map((inv: any) => ({
      id: inv.id, customerName: inv.customer.name, amount: Number(inv.amount),
      daysOverdue: differenceInDays(new Date(), inv.dueDate), remindersSent: inv.paymentReminderCount,
      autoChargeStatus: inv.autoChargeStatus,
    })),
    customerPaymentTrends: buildCustomerPaymentTrends(
      recentPaidForRules
        .filter((inv): inv is typeof inv & { paidAt: Date } => Boolean(inv.paidAt))
        .map((inv) => ({
          customerId: inv.customerId,
          customerName: inv.customer.name,
          issuedAt: inv.createdAt,
          paidAt: inv.paidAt,
        }))
    ),
    thirtyDayCashProjection: summaryRaw._raw.thirtyDayCashProjection,
    aging90PlusAmount: summaryRaw._raw.aging90PlusAmount, prevAging90PlusAmount: summaryRaw._raw.prevAging90PlusAmount,
    expenseGrowthPct: 0,
    revenueGrowthPct: 0,
    netMarginPct: 0,
    prevNetMarginPct: 0,
    cashRunwayMonths: 99,
    burnRate: 0,
    prevBurnRate: 0,
  };
  const tabData: Record<string, unknown> = {};
  tabKeys.forEach((key, i) => { tabData[key] = tabResults[i]; });

  // Enrich facts with P&L data if available
  const pnlResult = tabData.pnl as PnLData | null;
  if (pnlResult) {
    facts.expenseGrowthPct = pnlResult.prevTotalExpenses > 0
      ? ((pnlResult.totalExpenses - pnlResult.prevTotalExpenses) / pnlResult.prevTotalExpenses) * 100
      : 0;
    facts.revenueGrowthPct = pnlResult.prevTotalRevenue > 0
      ? ((pnlResult.totalRevenue - pnlResult.prevTotalRevenue) / pnlResult.prevTotalRevenue) * 100
      : 0;
    facts.netMarginPct = pnlResult.marginPct;
    facts.prevNetMarginPct = pnlResult.prevTotalRevenue > 0
      ? ((pnlResult.prevNetIncome) / pnlResult.prevTotalRevenue) * 100
      : 0;
    facts.cashRunwayMonths = pnlResult.runwayMonths;
    facts.burnRate = pnlResult.burnRate;
    facts.prevBurnRate = pnlResult.prevBurnRate;
  }

  const actions = await evaluateCfoRules(facts);

  const { _raw, _lastQbSync, ...summary } = summaryRaw;

  return {
    summary,
    cfoInsight: {
      briefing: cachedInsight?.briefing || "AI analysis will be available after the next scheduled run.",
      generatedAt: cachedInsight?.generatedAt || new Date().toISOString(),
      recommendations: cachedInsight?.recommendations || [],
      actions,
    },
    ...tabData,
    meta: {
      lastQbSync: _lastQbSync || "Never",
      dateRange: { from: startDate.toISOString(), to: endDate.toISOString() },
      generatedAt: new Date().toISOString(),
    },
  } as FinancialBIResponse;
}
