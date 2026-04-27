// lib/services/admin-bi.ts
import { prisma } from "@/lib/db";
import { differenceInMonths, differenceInDays, subMonths, subDays, startOfMonth, format, subYears } from "date-fns";

export interface AdminBIDateRange {
  startDate: Date;
  endDate: Date;
}

export function getAdminBIDateRange(
  preset: string,
  from?: string,
  to?: string
): AdminBIDateRange {
  const now = new Date();
  switch (preset) {
    case "last30":
      return { startDate: subDays(now, 30), endDate: now };
    case "last90":
      return { startDate: subDays(now, 90), endDate: now };
    case "thisYear":
      return {
        startDate: new Date(now.getFullYear(), 0, 1),
        endDate: now,
      };
    case "custom":
      return {
        startDate: from ? new Date(from) : subDays(now, 30),
        endDate: to ? new Date(to) : now,
      };
    case "allTime":
    default:
      return { startDate: new Date("2020-01-01"), endDate: now };
  }
}

// ── KPI Summary ──────────────────────────────────────────────

export async function getAdminBIKpis(range: AdminBIDateRange) {
  const { startDate, endDate } = range;
  const prevStart = subDays(startDate, differenceInDays(endDate, startDate));
  const prevEnd = subDays(startDate, 1);

  const [
    activeEnrollments,
    inactiveEnrollments,
    allEnrollments,
    wonDeals,
    prevWonDeals,
    totalDeals,
    prevTotalDeals,
    overdueInvoices,
    totalActiveInvoices,
    convertedLeads,
    allLeadsInPeriod,
  ] = await Promise.all([
    prisma.mentorshipEnrollment.count({ where: { status: "ACTIVE" } }),
    prisma.mentorshipEnrollment.count({ where: { status: { in: ["COMPLETED", "PAUSED"] } } }),
    prisma.mentorshipEnrollment.findMany({
      where: { startDate: { gte: new Date("2020-01-01") } },
      select: { startDate: true, endDate: true, status: true },
    }),
    prisma.deal.count({ where: { status: "WON", updatedAt: { gte: startDate, lte: endDate } } }),
    prisma.deal.count({ where: { status: "WON", updatedAt: { gte: prevStart, lte: prevEnd } } }),
    prisma.deal.count({ where: { createdAt: { gte: startDate, lte: endDate } } }),
    prisma.deal.count({ where: { createdAt: { gte: prevStart, lte: prevEnd } } }),
    prisma.invoice.aggregate({
      where: { status: "OVERDUE" },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.invoice.aggregate({
      where: { status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.lead.findMany({
      where: { convertedAt: { gte: startDate, lte: endDate, not: null } },
      select: { createdAt: true, convertedAt: true },
    }),
    prisma.lead.count({ where: { createdAt: { gte: startDate, lte: endDate } } }),
  ]);

  // Average tenure in months
  const tenures = allEnrollments
    .map((e) => {
      const end = e.endDate ?? new Date();
      return differenceInMonths(end, e.startDate);
    })
    .filter((m) => m >= 0);
  const avgTenureMonths =
    tenures.length > 0 ? tenures.reduce((a, b) => a + b, 0) / tenures.length : 0;

  // Average negotiation time in days
  const negotiationDays = convertedLeads
    .filter((l) => l.convertedAt)
    .map((l) => differenceInDays(l.convertedAt!, l.createdAt))
    .filter((d) => d >= 0);
  const avgNegotiationDays =
    negotiationDays.length > 0
      ? negotiationDays.reduce((a, b) => a + b, 0) / negotiationDays.length
      : 0;

  const conversionRate = totalDeals > 0 ? (wonDeals / totalDeals) * 100 : 0;
  const prevConversionRate = prevTotalDeals > 0 ? (prevWonDeals / prevTotalDeals) * 100 : 0;

  const overdueAmount = Number(overdueInvoices._sum.amount ?? 0);
  const totalArAmount = Number(totalActiveInvoices._sum.amount ?? 0);
  const delinquencyRate = totalArAmount > 0 ? (overdueAmount / totalArAmount) * 100 : 0;

  const leadConversionRate =
    allLeadsInPeriod > 0 ? (convertedLeads.length / allLeadsInPeriod) * 100 : 0;

  return {
    activeStudents: activeEnrollments,
    inactiveStudents: inactiveEnrollments,
    avgTenureMonths: Math.round(avgTenureMonths * 10) / 10,
    wonDeals,
    prevWonDeals,
    conversionRate: Math.round(conversionRate * 10) / 10,
    prevConversionRate: Math.round(prevConversionRate * 10) / 10,
    avgNegotiationDays: Math.round(avgNegotiationDays * 10) / 10,
    delinquencyRate: Math.round(delinquencyRate * 10) / 10,
    leadConversionRate: Math.round(leadConversionRate * 10) / 10,
    leadsConverted: convertedLeads.length,
    totalLeads: allLeadsInPeriod,
  };
}

// ── Closer Performance ───────────────────────────────────────

export async function getCloserPerformance(range: AdminBIDateRange) {
  const { startDate, endDate } = range;

  const wonDeals = await prisma.deal.findMany({
    where: {
      status: "WON",
      updatedAt: { gte: startDate, lte: endDate },
      ownerId: { not: null },
    },
    select: {
      value: true,
      ownerId: true,
      createdAt: true,
      updatedAt: true,
      owner: { select: { name: true } },
    },
  });

  const allDealsInPeriod = await prisma.deal.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
      ownerId: { not: null },
    },
    select: { status: true, ownerId: true, owner: { select: { name: true } } },
  });

  // Group by closer
  const closerMap = new Map<
    string,
    { name: string; dealsWon: number; totalValue: number; totalDeals: number }
  >();

  for (const deal of allDealsInPeriod) {
    if (!deal.ownerId) continue;
    if (!closerMap.has(deal.ownerId)) {
      closerMap.set(deal.ownerId, {
        name: deal.owner?.name ?? "Unknown",
        dealsWon: 0,
        totalValue: 0,
        totalDeals: 0,
      });
    }
    const entry = closerMap.get(deal.ownerId)!;
    entry.totalDeals++;
  }

  for (const deal of wonDeals) {
    if (!deal.ownerId) continue;
    if (!closerMap.has(deal.ownerId)) {
      closerMap.set(deal.ownerId, {
        name: deal.owner?.name ?? "Unknown",
        dealsWon: 0,
        totalValue: 0,
        totalDeals: 0,
      });
    }
    const entry = closerMap.get(deal.ownerId)!;
    entry.dealsWon++;
    entry.totalValue += Number(deal.value);
  }

  const closers = Array.from(closerMap.values())
    .map((c) => ({
      ...c,
      conversionRate:
        c.totalDeals > 0 ? Math.round((c.dealsWon / c.totalDeals) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.totalValue - a.totalValue);

  // Monthly deals won trend for top closer
  const monthlyTrend = Array.from({ length: 12 }, (_, i) => {
    const month = subMonths(new Date(), 11 - i);
    const start = startOfMonth(month);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);
    const label = format(month, "MMM yy");
    const count = wonDeals.filter(
      (d) => d.updatedAt >= start && d.updatedAt <= end
    ).length;
    const value = wonDeals
      .filter((d) => d.updatedAt >= start && d.updatedAt <= end)
      .reduce((s, d) => s + Number(d.value), 0);
    return { month: label, count, value };
  });

  return { closers, monthlyTrend };
}

// ── Programs ─────────────────────────────────────────────────

export async function getProgramsData(range: AdminBIDateRange) {
  const { startDate, endDate } = range;

  const [enrollmentsByProgram, enrollmentsByMonth, statusBreakdown] = await Promise.all([
    prisma.mentorshipEnrollment.groupBy({
      by: ["programType"],
      _count: { id: true },
    }),
    prisma.mentorshipEnrollment.findMany({
      where: { startDate: { gte: subMonths(new Date(), 11) } },
      select: { startDate: true, programType: true, status: true },
    }),
    prisma.mentorshipEnrollment.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
  ]);

  // Monthly enrollment trend by program type (last 12 months)
  const monthlyTrend = Array.from({ length: 12 }, (_, i) => {
    const month = subMonths(new Date(), 11 - i);
    const start = startOfMonth(month);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);
    const label = format(month, "MMM yy");

    const passCount = enrollmentsByMonth.filter(
      (e) => e.startDate >= start && e.startDate <= end && e.programType === "PASS"
    ).length;
    const advancedCount = enrollmentsByMonth.filter(
      (e) => e.startDate >= start && e.startDate <= end && e.programType === "ADVANCED"
    ).length;

    return { month: label, PASS: passCount, ADVANCED: advancedCount };
  });

  return {
    byProgram: enrollmentsByProgram.map((e) => ({
      program: e.programType,
      count: e._count.id,
    })),
    byStatus: statusBreakdown.map((s) => ({
      status: s.status,
      count: s._count.id,
    })),
    monthlyTrend,
  };
}

// ── Customer Demographics ────────────────────────────────────

export async function getCustomerDemographics() {
  const customers = await prisma.customer.findMany({
    select: {
      dateOfBirth: true,
      country: true,
      state: true,
      createdAt: true,
    },
  });

  const now = new Date();

  // Age buckets
  const ageBuckets: Record<string, number> = {
    "18-24": 0,
    "25-34": 0,
    "35-44": 0,
    "45-54": 0,
    "55+": 0,
    Unknown: 0,
  };

  for (const c of customers) {
    if (!c.dateOfBirth) {
      ageBuckets["Unknown"]++;
      continue;
    }
    const age = differenceInMonths(now, c.dateOfBirth) / 12;
    if (age < 25) ageBuckets["18-24"]++;
    else if (age < 35) ageBuckets["25-34"]++;
    else if (age < 45) ageBuckets["35-44"]++;
    else if (age < 55) ageBuckets["45-54"]++;
    else ageBuckets["55+"]++;
  }

  // Country distribution
  const countryMap = new Map<string, number>();
  for (const c of customers) {
    const key = c.country ?? "Unknown";
    countryMap.set(key, (countryMap.get(key) ?? 0) + 1);
  }
  const countries = Array.from(countryMap.entries())
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Customer acquisition by month (last 12)
  const acquisitionTrend = Array.from({ length: 12 }, (_, i) => {
    const month = subMonths(now, 11 - i);
    const start = startOfMonth(month);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);
    const label = format(month, "MMM yy");
    const count = customers.filter((c) => c.createdAt >= start && c.createdAt <= end).length;
    return { month: label, newCustomers: count };
  });

  return {
    ageBuckets: Object.entries(ageBuckets).map(([range, count]) => ({ range, count })),
    countries,
    acquisitionTrend,
    totalCustomers: customers.length,
  };
}

// ── Lead Funnel ───────────────────────────────────────────────

export async function getLeadFunnel(range: AdminBIDateRange) {
  const { startDate, endDate } = range;
  const dateFilter = { gte: startDate, lte: endDate };

  const [statusCounts, sourceCounts, avgScoreByStatus, recentQualifications] =
    await Promise.all([
      prisma.lead.groupBy({
        by: ["status"],
        where: { createdAt: dateFilter },
        _count: { id: true },
      }),
      prisma.lead.groupBy({
        by: ["source"],
        where: { createdAt: dateFilter },
        _count: { id: true },
      }),
      prisma.lead.groupBy({
        by: ["status"],
        where: {
          createdAt: dateFilter,
          qualificationScore: { not: null, gt: 0 },
        },
        _avg: { qualificationScore: true },
      }),
      prisma.lead.findMany({
        where: { createdAt: dateFilter },
        select: { status: true, qualificationScore: true, source: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ]);

  // Funnel stages in order
  const statusOrder = ["NEW", "QUALIFYING", "QUALIFIED", "UNQUALIFIED", "CONVERTED", "LOST"];
  const funnel = statusOrder.map((s) => ({
    status: s,
    count: statusCounts.find((x) => x.status === s)?._count.id ?? 0,
    avgScore:
      Math.round((avgScoreByStatus.find((x) => x.status === s)?._avg.qualificationScore ?? 0) * 10) /
      10,
  }));

  const sources = sourceCounts
    .map((s) => ({ source: s.source, count: s._count.id }))
    .sort((a, b) => b.count - a.count);

  // Monthly new leads (last 12)
  const monthlyLeads = Array.from({ length: 12 }, (_, i) => {
    const month = subMonths(new Date(), 11 - i);
    const start = startOfMonth(month);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);
    const label = format(month, "MMM yy");
    const total = recentQualifications.filter(
      (l) => l.createdAt >= start && l.createdAt <= end
    ).length;
    const qualified = recentQualifications.filter(
      (l) =>
        l.createdAt >= start &&
        l.createdAt <= end &&
        l.status === "QUALIFIED"
    ).length;
    return { month: label, total, qualified };
  });

  return { funnel, sources, monthlyLeads };
}

// ── Sales Seasonality ────────────────────────────────────────

export async function getSalesSeasonality() {
  const since = subMonths(new Date(), 11);

  const [deals, payments] = await Promise.all([
    prisma.deal.findMany({
      where: { status: "WON", updatedAt: { gte: startOfMonth(since) } },
      select: { value: true, updatedAt: true },
    }),
    prisma.payment.findMany({
      where: { paymentDate: { gte: startOfMonth(since) } },
      select: { amount: true, paymentDate: true, paymentMethod: true },
    }),
  ]);

  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const month = subMonths(new Date(), 11 - i);
    const start = startOfMonth(month);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);
    const label = format(month, "MMM yy");

    const dealsCount = deals.filter((d) => d.updatedAt >= start && d.updatedAt <= end).length;
    const dealsValue = deals
      .filter((d) => d.updatedAt >= start && d.updatedAt <= end)
      .reduce((s, d) => s + Number(d.value), 0);
    const revenue = payments
      .filter((p) => p.paymentDate >= start && p.paymentDate <= end)
      .reduce((s, p) => s + Number(p.amount), 0);

    return { month: label, deals: dealsCount, dealsValue, revenue };
  });

  // Payment method breakdown
  const methodMap = new Map<string, { count: number; amount: number }>();
  for (const p of payments) {
    const key = p.paymentMethod ?? "Other";
    const entry = methodMap.get(key) ?? { count: 0, amount: 0 };
    entry.count++;
    entry.amount += Number(p.amount);
    methodMap.set(key, entry);
  }
  const paymentMethods = Array.from(methodMap.entries())
    .map(([method, data]) => ({ method, ...data }))
    .sort((a, b) => b.amount - a.amount);

  return { monthlyData, paymentMethods };
}

// ── Main entry point ─────────────────────────────────────────

export type AdminBITab = "kpis" | "closers" | "programs" | "demographics" | "funnel" | "seasonality" | "all";

export async function getAdminBIData(
  preset: string,
  from?: string,
  to?: string,
  tab: AdminBITab = "all"
) {
  const range = getAdminBIDateRange(preset, from, to);

  if (tab === "all") {
    const [kpis, closers, programs, demographics, funnel, seasonality] = await Promise.all([
      getAdminBIKpis(range),
      getCloserPerformance(range),
      getProgramsData(range),
      getCustomerDemographics(),
      getLeadFunnel(range),
      getSalesSeasonality(),
    ]);
    return { kpis, closers, programs, demographics, funnel, seasonality, dateRange: { startDate: range.startDate, endDate: range.endDate } };
  }

  if (tab === "kpis") return { kpis: await getAdminBIKpis(range), dateRange: range };
  if (tab === "closers") return { closers: await getCloserPerformance(range), dateRange: range };
  if (tab === "programs") return { programs: await getProgramsData(range), dateRange: range };
  if (tab === "demographics") return { demographics: await getCustomerDemographics(), dateRange: range };
  if (tab === "funnel") return { funnel: await getLeadFunnel(range), dateRange: range };
  if (tab === "seasonality") return { seasonality: await getSalesSeasonality(), dateRange: range };

  return {};
}
