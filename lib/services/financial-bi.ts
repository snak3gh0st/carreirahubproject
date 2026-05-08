// lib/services/financial-bi.ts
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { startOfMonth, addMonths, subMonths, subDays, format, differenceInDays, differenceInCalendarMonths, endOfMonth } from "date-fns";
import { evaluateCfoRules, CfoFacts } from "@/lib/services/cfo-rules";
import { getCachedCfoInsight, CfoAnalysisInput } from "@/lib/services/cfo-analysis";
import { buildCustomerPaymentTrends, buildPatternAlerts } from "@/lib/financial/cfo-signals";
import { getCachedQbCfoReportPacket } from "@/lib/services/qb-cfo-reports";
import {
  buildReceivableAgingSummary,
  getFinancialDateRange,
  getOpenAmount,
} from "@/lib/financial/bi-helpers";
import {
  buildCustomerIdExclusionWhere,
  filterFinancialHubExcludedCustomers,
  isFinancialHubExcludedCustomer,
} from "@/lib/financial/hub-exclusions";
import { getFinancialHubExcludedCustomerIds } from "@/lib/financial/hub-exclusions-db";
import { buildWindowedQbPnlSnapshot, getQbMonthKey } from "@/lib/financial/qb-bi-helpers";
import { buildQbHistoryStartDate } from "@/lib/financial/qb-window";
import { buildAverageSalesForecast } from "@/lib/financial/receivables-forecast-helpers";
import {
  isQuickBooksInvoiceExcludedFromHub,
  isQuickBooksInvoiceMarkedMissing,
} from "@/lib/quickbooks/sync-helpers";
import {
  loadQuickBooksWindowedFinancials,
  type QuickBooksWindowedFinancials,
} from "@/lib/services/qb-windowed-financials";
import {
  ensureParsedBalanceSheet,
  ensureParsedCashFlow,
  ensureParsedProfitAndLoss,
  type ParsedPnlCategory,
} from "@/lib/services/qb-report-parser";
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

function isFinancialInvoiceUsable(invoice: {
  quickbooks_invoice_id?: string | null;
  installments?: unknown;
}): boolean {
  if (!invoice.quickbooks_invoice_id) {
    return true;
  }

  return !isQuickBooksInvoiceMarkedMissing(invoice.installments)
    && !isQuickBooksInvoiceExcludedFromHub(invoice.installments);
}

export function getPreviousComparablePeriod(startDate: Date, endDate: Date): { startDate: Date; endDate: Date } {
  const inclusiveDays = Math.max(differenceInDays(endDate, startDate) + 1, 1);
  return {
    startDate: subDays(startDate, inclusiveDays),
    endDate: subDays(startDate, 1),
  };
}

function getPreviousPeriod(startDate: Date, endDate: Date): { startDate: Date; endDate: Date } {
  return getPreviousComparablePeriod(startDate, endDate);
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

export function buildConcentrationMetric(
  value: number,
  prevValue: number,
  topClients: Array<{ name: string; percentage: number }>,
) {
  return {
    ...buildKpiMetric(value, prevValue, { invertDirection: true, warningPct: 40, dangerPct: 50 }),
    topClients,
  };
}

export function buildCfoFinancialSnapshot(input: {
  summary: { overdueAmount: number };
  pnl: Pick<PnLData, "totalExpenses" | "netIncome" | "marginPct" | "burnRate" | "cashOnHand" | "runwayMonths"> | null;
  overdueCount: number;
  worstOverdue: { customer: string; amount: number; days: number } | null;
}) {
  return {
    overdueCount: input.overdueCount,
    overdueTotal: input.summary.overdueAmount,
    worstOverdue: input.worstOverdue,
    totalExpenses: input.pnl?.totalExpenses ?? 0,
    netIncome: input.pnl?.netIncome ?? 0,
    marginPct: input.pnl?.marginPct ?? 0,
    burnRate: input.pnl?.burnRate ?? 0,
    cashOnHand: input.pnl?.cashOnHand ?? 0,
    runwayMonths: input.pnl?.runwayMonths ?? 0,
  };
}

type RevenueLineItem = {
  description?: string;
  name?: string;
  amount?: number;
  serviceItemId?: string;
};

type RevenueInvoiceRecord = {
  createdAt: Date;
  dueDate: Date;
  installments?: unknown;
  quickbooks_invoice_id?: string | null;
};

type InvoicePaymentRecord = {
  paymentDate: Date;
  amount: number | string | Prisma.Decimal | null;
};

type MonthlyRevenuePoint = {
  month: string;
  invoiced: number;
  collected: number;
};

type MonthlyCostPoint = {
  month: string;
  monthKey: string;
  revenue: number;
  cogs: number;
  expenses: number;
  netIncome: number;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function readQuickBooksTxnDate(installments: unknown): string | null {
  if (!installments || typeof installments !== "object") {
    return null;
  }

  const quickbooks = (installments as { quickbooks?: { txnDate?: unknown } }).quickbooks;
  if (!quickbooks || typeof quickbooks !== "object" || typeof quickbooks.txnDate !== "string") {
    return null;
  }

  return quickbooks.txnDate;
}

export function resolveInvoiceBookedMonth(invoice: RevenueInvoiceRecord): string {
  const qbTxnDate = readQuickBooksTxnDate(invoice.installments);
  if (qbTxnDate) {
    const parsed = new Date(qbTxnDate);
    if (!Number.isNaN(parsed.getTime())) {
      return format(parsed, "yyyy-MM");
    }
  }

  if (invoice.quickbooks_invoice_id) {
    return format(invoice.dueDate, "yyyy-MM");
  }

  return format(invoice.createdAt, "yyyy-MM");
}

export function resolveInvoiceBookedDate(invoice: RevenueInvoiceRecord): Date {
  const qbTxnDate = readQuickBooksTxnDate(invoice.installments);
  if (qbTxnDate) {
    const parsed = new Date(qbTxnDate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  if (invoice.quickbooks_invoice_id) {
    return invoice.dueDate;
  }

  return invoice.createdAt;
}

export function normalizeRevenueServiceLabel(input: {
  rawName?: string | null;
  fallbackItemName?: string | null;
}): string | null {
  const candidate = (input.fallbackItemName || input.rawName || "").trim();
  if (!candidate) {
    return null;
  }

  const base = candidate
    .replace(/^Service\s*-\s*/i, "")
    .replace(/\s*-\s*Entry Payment$/i, "")
    .replace(/\s*-\s*Installment\s+\d+\s+of\s+\d+$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!base || /^(service|invoice|other)$/i.test(base)) {
    return null;
  }

  return base;
}

export function buildTrailingAverageTrend(
  points: Array<{ month: string; value: number }>,
  windowSize = 3,
): Array<{ month: string; average: number }> {
  return points.map((point, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const window = points.slice(start, index + 1);
    const average = window.length > 0
      ? window.reduce((sum, entry) => sum + entry.value, 0) / window.length
      : 0;

    return {
      month: point.month,
      average,
    };
  });
}

function computeBurnRateFromMonthlyPnlRows(
  monthlyPnL: Array<{ monthKey: string; expenses: number; cogs: number }>,
  endKey: string,
) {
  const recentMonths = monthlyPnL.filter((row) => row.monthKey <= endKey).slice(-3);

  if (recentMonths.length === 0) {
    return 0;
  }

  return recentMonths.reduce((sum, month) => sum + month.expenses + month.cogs, 0) / recentMonths.length;
}

export function computeTrailingClosedMonthCostAverage(
  monthlyPnL: MonthlyCostPoint[],
  endDate: Date,
  monthCount = 3,
) {
  const endKey = format(endDate, "yyyy-MM");
  const includeCurrentMonth = format(endDate, "yyyy-MM-dd") === format(endOfMonth(endDate), "yyyy-MM-dd");
  const eligibleRows = monthlyPnL.filter((row) => row.monthKey < endKey || (includeCurrentMonth && row.monthKey === endKey));
  const trailingRows = eligibleRows.slice(-monthCount);

  if (trailingRows.length === 0) {
    return 0;
  }

  return trailingRows.reduce((sum, row) => sum + row.cogs + row.expenses, 0) / trailingRows.length;
}

export function computeWeightedAveragePaymentDays(
  bookedAt: Date,
  payments: InvoicePaymentRecord[],
) {
  let weightedDays = 0;
  let paidAmount = 0;

  for (const payment of payments) {
    const amount = Number(payment.amount || 0);
    if (amount <= 0) {
      continue;
    }

    const days = Math.max(differenceInDays(payment.paymentDate, bookedAt), 0);
    weightedDays += days * amount;
    paidAmount += amount;
  }

  if (paidAmount <= 0) {
    return null;
  }

  return weightedDays / paidAmount;
}

function getCashFlowSectionTotal(
  sections: Array<{ name: string; total: number }> | undefined,
  aliases: string[],
) {
  if (!sections || sections.length === 0) {
    return 0;
  }

  const normalize = (value: string) => value.trim().toLowerCase();
  const wanted = aliases.map(normalize);
  const match = sections.find((section) => wanted.includes(normalize(section.name)));
  return match?.total || 0;
}

export function buildCashOnHandValue(
  balanceSheet: { bankAccounts?: { total?: number | null } } | null | undefined,
  cashFlowSections: Array<{ name: string; total: number }> | undefined,
) {
  const endingCash = getCashFlowSectionTotal(cashFlowSections, ["EndingCash", "Cash at end of period"]);
  if (endingCash > 0) {
    return endingCash;
  }

  return Number(balanceSheet?.bankAccounts?.total || 0);
}

function buildExcludedLegacyReceivableCutoff(): Date {
  return buildQbHistoryStartDate();
}

function isLegacyReceivableOutsideHub(invoice: {
  dueDate: Date;
  quickbooks_invoice_id?: string | null;
  installments?: unknown;
}): boolean {
  if (!invoice.quickbooks_invoice_id) {
    return false;
  }

  if (isQuickBooksInvoiceExcludedFromHub(invoice.installments)) {
    return true;
  }

  return invoice.dueDate < buildExcludedLegacyReceivableCutoff();
}

function isReceivableOutsideFinancialHub(
  invoice: {
    customerId?: string | null;
    dueDate: Date;
    quickbooks_invoice_id?: string | null;
    installments?: unknown;
  },
  excludedCustomerIds: Set<string>,
): boolean {
  if (invoice.customerId && excludedCustomerIds.has(invoice.customerId)) {
    return true;
  }

  return isLegacyReceivableOutsideHub(invoice);
}

function filterVisibleReceivableInvoices<T extends {
  customerId?: string | null;
  dueDate: Date;
  quickbooks_invoice_id?: string | null;
  installments?: unknown;
}>(invoices: T[], excludedCustomerIds: Iterable<string>): T[] {
  const excludedIds = new Set(excludedCustomerIds);
  return invoices.filter((invoice) => (
    isFinancialInvoiceUsable(invoice)
    && !isReceivableOutsideFinancialHub(invoice, excludedIds)
  ));
}

// ── Core summary queries ────────────────────────────────────

async function querySummary(
  startDate: Date,
  endDate: Date,
  prevStart: Date,
  prevEnd: Date,
  qbWindow: QuickBooksWindowedFinancials | null = null,
) {
  const excludedCustomerIds = await getFinancialHubExcludedCustomerIds();
  const customerIdExclusionWhere = buildCustomerIdExclusionWhere(excludedCustomerIds);
  const dateFilter = { gte: startDate, lte: endDate };
  const prevDateFilter = { gte: prevStart, lte: prevEnd };
  const snapshotDate = endDate;
  const prevSnapshotDate = prevEnd;

  const [
    paidInvoicesCurrent, invoicedInvoicesCurrent, outstandingInvoicesForAr,
    paidInvoicesPrevious, invoicedInvoicesPrevious, prevOutstandingInvoicesForAr,
    revenueTrend, agingInvoices, topCustomerPayments, prevTopCustomerPayments, systemConfig, latestQbCache, qbReportPacket, pnlCache,
  ] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: "PAID", paidAt: dateFilter },
      select: { amountPaid: true, customerId: true, quickbooks_invoice_id: true, installments: true },
    }),
    prisma.invoice.findMany({
      where: { createdAt: dateFilter, status: { not: "VOID" } },
      select: { amount: true, customerId: true, quickbooks_invoice_id: true, installments: true },
    }),
    prisma.invoice.findMany({
      where: { status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] } },
      select: { amount: true, amountPaid: true, dueDate: true, customerId: true, quickbooks_invoice_id: true, installments: true },
    }),
    prisma.invoice.findMany({
      where: { status: "PAID", paidAt: prevDateFilter },
      select: { amountPaid: true, customerId: true, quickbooks_invoice_id: true, installments: true },
    }),
    prisma.invoice.findMany({
      where: { createdAt: prevDateFilter, status: { not: "VOID" } },
      select: { amount: true, customerId: true, quickbooks_invoice_id: true, installments: true },
    }),
    prisma.invoice.findMany({
      where: { status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] }, createdAt: { lte: prevEnd } },
      select: { amount: true, amountPaid: true, dueDate: true, customerId: true, quickbooks_invoice_id: true, installments: true },
    }),
    prisma.payment.findMany({
      where: { paymentDate: { gte: subMonths(new Date(), 12) }, ...customerIdExclusionWhere },
      select: { paymentDate: true, amount: true },
    }),
    prisma.invoice.findMany({
      where: { status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] } },
      select: { id: true, amount: true, amountPaid: true, dueDate: true, customerId: true, quickbooks_invoice_id: true, installments: true },
    }),
    prisma.payment.groupBy({
      by: ["customerId"],
      where: { paymentDate: dateFilter, ...customerIdExclusionWhere },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 10,
    }),
    prisma.payment.groupBy({
      by: ["customerId"],
      where: { paymentDate: prevDateFilter, ...customerIdExclusionWhere },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 10,
    }),
    prisma.systemConfig.findUnique({ where: { id: "system" }, select: { last_qb_sync: true } }),
    prisma.qbReportCache.findFirst({
      orderBy: { fetchedAt: "desc" },
      select: { fetchedAt: true },
    }),
    getCachedQbCfoReportPacket(),
    prisma.qbReportCache.findUnique({
      where: { reportType: "ProfitAndLoss" },
      select: { data: true },
    }),
  ]);

  const paidCurrentUsable = filterFinancialHubExcludedCustomers(
    paidInvoicesCurrent.filter(isFinancialInvoiceUsable),
    excludedCustomerIds,
  );
  const paidPreviousUsable = filterFinancialHubExcludedCustomers(
    paidInvoicesPrevious.filter(isFinancialInvoiceUsable),
    excludedCustomerIds,
  );
  const invoicedCurrentUsable = filterFinancialHubExcludedCustomers(
    invoicedInvoicesCurrent.filter(isFinancialInvoiceUsable),
    excludedCustomerIds,
  );
  const invoicedPreviousUsable = filterFinancialHubExcludedCustomers(
    invoicedInvoicesPrevious.filter(isFinancialInvoiceUsable),
    excludedCustomerIds,
  );
  const outstandingCurrentUsable = filterVisibleReceivableInvoices(outstandingInvoicesForAr, excludedCustomerIds);
  const outstandingPreviousUsable = filterVisibleReceivableInvoices(prevOutstandingInvoicesForAr, excludedCustomerIds);
  const agingInvoicesUsable = filterVisibleReceivableInvoices(agingInvoices, excludedCustomerIds);

  const revenueFromPayments = paidCurrentUsable.reduce((sum, inv) => sum + Number(inv.amountPaid || 0), 0);
  const prevRevenueFromPayments = paidPreviousUsable.reduce((sum, inv) => sum + Number(inv.amountPaid || 0), 0);
  const totalInvoiced = invoicedCurrentUsable.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
  const prevTotalInvoiced = invoicedPreviousUsable.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
  const collectionRate = totalInvoiced > 0 ? (revenueFromPayments / totalInvoiced) * 100 : 0;
  const prevCollectionRate = prevTotalInvoiced > 0 ? (prevRevenueFromPayments / prevTotalInvoiced) * 100 : 0;

  // MRR: average monthly collected revenue over last 3 months
  const threeMonthsAgo = subMonths(new Date(), 3);
  const recentPayments = revenueTrend.filter((p) => p.paymentDate >= threeMonthsAgo);
  const recentTotal = recentPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const mrr = recentTotal / 3;
  const sixMonthsAgo = subMonths(new Date(), 6);
  const prevRecentPayments = revenueTrend.filter((p) => p.paymentDate >= sixMonthsAgo && p.paymentDate < threeMonthsAgo);
  const prevRecentTotal = prevRecentPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const prevMrr = prevRecentTotal / 3;

  // Revenue trend mini — prefer QuickBooks P&L months when cached, fallback to synced payments
  const monthlyRevenue = new Map<string, number>();
  for (const p of revenueTrend) {
    const key = format(p.paymentDate, "yyyy-MM");
    monthlyRevenue.set(key, (monthlyRevenue.get(key) || 0) + Number(p.amount));
  }
  const fallbackRevenueTrendMini = Array.from(monthlyRevenue.entries())
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const qbPnlSnapshot = pnlCache
    ? buildWindowedQbPnlSnapshot(JSON.parse(pnlCache.data), startDate, endDate, prevStart, prevEnd)
    : null;
  const revenue = qbWindow?.currentPnl.income.total ?? qbPnlSnapshot?.current.totalRevenue ?? revenueFromPayments;
  const prevRevenue = qbWindow?.previousPnl.income.total ?? qbPnlSnapshot?.previous.totalRevenue ?? prevRevenueFromPayments;
  const revenueTrendMini = qbPnlSnapshot
    ? qbPnlSnapshot.monthlyPnL.map((entry) => ({ month: entry.month, amount: entry.revenue }))
    : fallbackRevenueTrendMini;

  // AR is row-level and visual-filtered by the hub exclusion list. QuickBooks aging
  // reports are aggregate snapshots, so they cannot remove the written-off cohort reliably.
  const currentArAging = buildReceivableAgingSummary(agingInvoicesUsable, snapshotDate);
  const previousArAging = buildReceivableAgingSummary(outstandingPreviousUsable, prevSnapshotDate);
  const agingSnapshotMini = currentArAging.buckets;
  const outstanding = currentArAging.totalOpenReceivables;
  const prevOutstanding = previousArAging.totalOpenReceivables;
  const overdueAmount = currentArAging.overdueAmount;
  const prevOverdueAmountExact = previousArAging.overdueAmount;
  const delinquencyRate = outstanding > 0 ? (overdueAmount / outstanding) * 100 : 0;

  // Concentration
  const qbCustomerSalesRows = (qbWindow?.currentCustomerSales.rows ?? [])
    .filter((row) => !isFinancialHubExcludedCustomer({ name: row.name }));
  const prevQbCustomerSalesRows = (qbWindow?.previousCustomerSales.rows ?? [])
    .filter((row) => !isFinancialHubExcludedCustomer({ name: row.name }));
  const hasQbCustomerSales = qbCustomerSalesRows.length > 0;
  const hasPrevQbCustomerSales = prevQbCustomerSalesRows.length > 0;
  const totalPaidInPeriod = hasQbCustomerSales
    ? qbCustomerSalesRows.reduce((sum, row) => sum + Number(row.total || 0), 0)
    : topCustomerPayments.reduce((sum, g) => sum + Number(g._sum.amount || 0), 0);
  const prevTotalPaidInPeriod = hasPrevQbCustomerSales
    ? prevQbCustomerSalesRows.reduce((sum, row) => sum + Number(row.total || 0), 0)
    : prevTopCustomerPayments.reduce((sum, g) => sum + Number(g._sum.amount || 0), 0);

  let topClients: Array<{ name: string; percentage: number }> = [];
  let concentration = 0;
  let prevConcentration = 0;

  if (hasQbCustomerSales) {
    const topCustomerRows = [...qbCustomerSalesRows].sort((a, b) => b.total - a.total).slice(0, 3);
    const topThreeTotal = topCustomerRows.reduce((sum, row) => sum + Number(row.total || 0), 0);
    concentration = totalPaidInPeriod > 0 ? (topThreeTotal / totalPaidInPeriod) * 100 : 0;
    topClients = topCustomerRows.map((row) => ({
      name: row.name,
      percentage: totalPaidInPeriod > 0 ? (Number(row.total || 0) / totalPaidInPeriod) * 100 : 0,
    }));
  } else {
    const customerIds = topCustomerPayments.slice(0, 3).map((g) => g.customerId);
    const topThreeTotal = topCustomerPayments.slice(0, 3).reduce((sum, g) => sum + Number(g._sum.amount || 0), 0);
    concentration = totalPaidInPeriod > 0 ? (topThreeTotal / totalPaidInPeriod) * 100 : 0;
    const topCustomerNames = customerIds.length > 0
      ? await prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true } })
      : [];
    const nameMap = new Map(topCustomerNames.map((c) => [c.id, c.name]));
    topClients = topCustomerPayments.slice(0, 3).map((g) => ({
      name: nameMap.get(g.customerId) || "Unknown",
      percentage: totalPaidInPeriod > 0 ? (Number(g._sum.amount || 0) / totalPaidInPeriod) * 100 : 0,
    }));
  }

  if (hasPrevQbCustomerSales) {
    const prevTopCustomerRows = [...prevQbCustomerSalesRows].sort((a, b) => b.total - a.total).slice(0, 3);
    const prevTopThreeTotal = prevTopCustomerRows.reduce((sum, row) => sum + Number(row.total || 0), 0);
    prevConcentration = prevTotalPaidInPeriod > 0 ? (prevTopThreeTotal / prevTotalPaidInPeriod) * 100 : 0;
  } else {
    const prevTopThreeTotal = prevTopCustomerPayments.slice(0, 3).reduce((sum, g) => sum + Number(g._sum.amount || 0), 0);
    prevConcentration = prevTotalPaidInPeriod > 0 ? (prevTopThreeTotal / prevTotalPaidInPeriod) * 100 : 0;
  }

  const currentMrrRows = qbPnlSnapshot
    ? qbPnlSnapshot.monthlyPnL.filter((row) => row.monthKey <= format(endDate, "yyyy-MM")).slice(-3)
    : [];
  const prevMrrRows = qbPnlSnapshot
    ? qbPnlSnapshot.monthlyPnL.filter((row) => row.monthKey <= format(prevEnd, "yyyy-MM")).slice(-3)
    : [];
  const qbMrr = currentMrrRows.length > 0
    ? currentMrrRows.reduce((sum, row) => sum + row.revenue, 0) / currentMrrRows.length
    : null;
  const qbPrevMrr = prevMrrRows.length > 0
    ? prevMrrRows.reduce((sum, row) => sum + row.revenue, 0) / prevMrrRows.length
    : null;

  return {
    revenue: buildKpiMetric(revenue, prevRevenue),
    collectionRate: buildKpiMetric(collectionRate, prevCollectionRate),
    outstandingAR: buildKpiMetric(outstanding, prevOutstanding, { invertDirection: true }),
    overdueAR: buildKpiMetric(overdueAmount, prevOverdueAmountExact, { invertDirection: true }),
    mrr: buildKpiMetric(qbMrr ?? mrr, qbPrevMrr ?? prevMrr),
    topClientConcentration: buildConcentrationMetric(concentration, prevConcentration, topClients),
    delinquencyRate: Math.round(delinquencyRate * 10) / 10,
    revenueTrendMini,
    agingSnapshotMini,
    _raw: {
      collectionRate, prevCollectionRate, collectionRateChange: collectionRate - prevCollectionRate,
      outstandingAR: outstanding, topThreeConcentration: concentration, topThreeClients: topClients,
      overdueAmount,
      aging90PlusAmount: agingSnapshotMini.find((b) => b.bucket === "90+")?.amount || 0,
      prevAging90PlusAmount: previousArAging.buckets.find((b) => b.bucket === "90+")?.amount || 0,
      totalInvoiced, revenue,
      revenueChangePct: prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0,
      mrr: qbMrr ?? mrr, agingInvoices: agingInvoicesUsable,
      thirtyDayCashProjection: qbMrr ?? mrr,
    },
    _lastQbSync: systemConfig?.last_qb_sync?.toISOString() || latestQbCache?.fetchedAt?.toISOString() || null,
  };
}

// ── Tab queries ─────────────────────────────────────────────

async function queryRevenueGrowth(startDate: Date, endDate: Date): Promise<RevenueGrowthData> {
  const excludedCustomerIds = await getFinancialHubExcludedCustomerIds();
  const trendStart = startOfMonth(subMonths(endDate, 11));
  const [payments, invoices, pnlCache, qbItems] = await Promise.all([
    prisma.payment.findMany({
      where: { paymentDate: { gte: trendStart, lte: endDate }, ...buildCustomerIdExclusionWhere(excludedCustomerIds) },
      select: { paymentDate: true, amount: true },
    }),
    prisma.invoice.findMany({
      where: { createdAt: { gte: trendStart, lte: endDate }, status: { not: "VOID" } },
      select: {
        createdAt: true,
        dueDate: true,
        customerId: true,
        amount: true,
        lineItems: true,
        status: true,
        amountPaid: true,
        paidAt: true,
        quickbooks_invoice_id: true,
        installments: true,
      },
    }),
    prisma.qbReportCache.findUnique({
      where: { reportType: "ProfitAndLoss" },
      select: { data: true },
    }),
    prisma.quickBooksItem.findMany({
      select: { qbId: true, name: true },
    }),
  ]);
  const usableInvoices = filterFinancialHubExcludedCustomers(
    invoices.filter(isFinancialInvoiceUsable),
    excludedCustomerIds,
  );
  const qbItemNameById = new Map(qbItems.map((item) => [item.qbId, item.name]));

  const invoicedByMonth = new Map<string, number>();
  const collectedByMonth = new Map<string, number>();
  for (const inv of usableInvoices) {
    const month = resolveInvoiceBookedMonth(inv);
    invoicedByMonth.set(month, (invoicedByMonth.get(month) || 0) + Number(inv.amount));
  }
  for (const p of payments) {
    const month = format(p.paymentDate, "yyyy-MM");
    collectedByMonth.set(month, (collectedByMonth.get(month) || 0) + Number(p.amount));
  }
  const qbMonthlyPnl = pnlCache
    ? buildWindowedQbPnlSnapshot(
        ensureParsedProfitAndLoss(JSON.parse(pnlCache.data)),
        trendStart,
        endDate,
        trendStart,
        endDate,
      ).monthlyPnL
    : null;
  if (qbMonthlyPnl && qbMonthlyPnl.length > 0) {
    collectedByMonth.clear();
    for (const row of qbMonthlyPnl) {
      collectedByMonth.set(row.monthKey, row.revenue);
    }
  }
  const allMonths = new Set([...invoicedByMonth.keys(), ...collectedByMonth.keys()]);
  const invoicedVsCollected = Array.from(allMonths).sort().map((month) => ({
    month, invoiced: invoicedByMonth.get(month) || 0, collected: collectedByMonth.get(month) || 0,
  }));

  const serviceRevenue = new Map<string, { amount: number; invoiceCount: number }>();
  for (const inv of usableInvoices) {
    if (inv.lineItems && Array.isArray(inv.lineItems)) {
      const seenLabels = new Set<string>();
      for (const item of inv.lineItems as RevenueLineItem[]) {
        const fallbackItemName = item.serviceItemId ? qbItemNameById.get(String(item.serviceItemId)) : null;
        const name = normalizeRevenueServiceLabel({
          rawName: item.description || item.name || null,
          fallbackItemName,
        });
        if (!name) continue;
        const current = serviceRevenue.get(name) || { amount: 0, invoiceCount: 0 };
        current.amount += Number(item.amount || 0);
        if (!seenLabels.has(name)) {
          current.invoiceCount += 1;
          seenLabels.add(name);
        }
        serviceRevenue.set(name, current);
      }
    }
  }
  const revenueByService = Array.from(serviceRevenue.entries())
    .map(([service, stats]) => ({ service, amount: stats.amount, invoiceCount: stats.invoiceCount }))
    .sort((a, b) => b.amount - a.amount).slice(0, 10);

  const mrrAverages = buildTrailingAverageTrend(
    invoicedVsCollected.map((month) => ({ month: month.month, value: month.collected })),
    3,
  );
  const mrrTrend = invoicedVsCollected.map((m, index) => ({
    month: m.month,
    mrr: mrrAverages[index]?.average || 0,
    arr: (mrrAverages[index]?.average || 0) * 12,
    actualMrr: m.collected,
    actualArr: m.collected * 12,
  }));
  const momGrowth = invoicedVsCollected.map((m, i) => {
    const prev = i > 0 ? invoicedVsCollected[i - 1].collected : 0;
    return { month: m.month, growthPct: prev > 0 ? ((m.collected - prev) / prev) * 100 : 0 };
  });

  return { invoicedVsCollected, revenueByService, mrrTrend, momGrowth };
}

async function queryArCollections(
  startDate: Date,
  endDate: Date,
  _qbWindow: QuickBooksWindowedFinancials | null = null,
): Promise<ArCollectionsData> {
  const excludedCustomerIds = await getFinancialHubExcludedCustomerIds();
  const snapshotDate = endDate;
  const performanceStart = buildQbHistoryStartDate();
  const [overdueInvoicesRaw, performanceInvoices, performancePayments] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: { in: ["OVERDUE", "SENT", "PARTIALLY_PAID"] } },
      include: { customer: { select: { name: true } }, owner: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.invoice.findMany({
      where: {
        status: { not: "VOID" },
        OR: [
          { createdAt: { gte: performanceStart, lte: endDate } },
          { dueDate: { gte: performanceStart, lte: endDate } },
        ],
      },
      select: {
        createdAt: true,
        dueDate: true,
        customerId: true,
        amount: true,
        amountPaid: true,
        status: true,
        quickbooks_invoice_id: true,
        installments: true,
        payments: {
          select: { paymentDate: true, amount: true },
        },
      },
    }),
    prisma.payment.findMany({
      where: { paymentDate: { gte: performanceStart, lte: endDate }, ...buildCustomerIdExclusionWhere(excludedCustomerIds) },
      select: { paymentDate: true, amount: true, customerId: true },
    }),
  ]);
  const usableOutstandingInvoices = filterVisibleReceivableInvoices(overdueInvoicesRaw, excludedCustomerIds);
  const agingBreakdown = buildReceivableAgingSummary(
    usableOutstandingInvoices,
    snapshotDate,
  ).buckets;

  const performanceMonths = Array.from(
    { length: Math.max(differenceInCalendarMonths(startOfMonth(endDate), performanceStart) + 1, 1) },
    (_, index) => format(startOfMonth(addMonths(performanceStart, index)), "yyyy-MM"),
  );
  const invoicedByMonth = new Map<string, number>(performanceMonths.map((month) => [month, 0]));
  const collectedByMonth = new Map<string, number>(performanceMonths.map((month) => [month, 0]));
  const cohortCollectedByMonth = new Map<string, number>(performanceMonths.map((month) => [month, 0]));
  const monthlyPerformance = new Map<string, { weightedDays: number; paidAmount: number }>(
    performanceMonths.map((month) => [month, { weightedDays: 0, paidAmount: 0 }]),
  );
  const usablePerformanceInvoices = filterFinancialHubExcludedCustomers(
    performanceInvoices.filter(isFinancialInvoiceUsable),
    excludedCustomerIds,
  );

  for (const inv of usablePerformanceInvoices) {
    const bookedMonth = resolveInvoiceBookedMonth(inv);
    if (!invoicedByMonth.has(bookedMonth)) {
      continue;
    }

    invoicedByMonth.set(bookedMonth, (invoicedByMonth.get(bookedMonth) || 0) + Number(inv.amount || 0));
    cohortCollectedByMonth.set(bookedMonth, (cohortCollectedByMonth.get(bookedMonth) || 0) + Number(inv.amountPaid || 0));

    const bookedAt = resolveInvoiceBookedDate(inv);
    const weightedAvgDays = computeWeightedAveragePaymentDays(bookedAt, inv.payments);
    if (weightedAvgDays !== null) {
      const paidAmount = inv.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const existing = monthlyPerformance.get(bookedMonth) || { weightedDays: 0, paidAmount: 0 };
      existing.weightedDays += weightedAvgDays * paidAmount;
      existing.paidAmount += paidAmount;
      monthlyPerformance.set(bookedMonth, existing);
    }
  }

  for (const payment of performancePayments) {
    const paymentMonth = format(payment.paymentDate, "yyyy-MM");
    if (!collectedByMonth.has(paymentMonth)) {
      continue;
    }
    collectedByMonth.set(paymentMonth, (collectedByMonth.get(paymentMonth) || 0) + Number(payment.amount || 0));
  }

  const collectionPerformance = performanceMonths.map((month) => {
    const performance = monthlyPerformance.get(month) || { weightedDays: 0, paidAmount: 0 };
    const invoiced = invoicedByMonth.get(month) || 0;
    const collected = collectedByMonth.get(month) || 0;
    const collectedToDate = cohortCollectedByMonth.get(month) || 0;

    return {
      month,
      avgDaysToPayment: performance.paidAmount > 0 ? Math.round(performance.weightedDays / performance.paidAmount) : null,
      collectionRate: invoiced > 0 ? Math.min((collectedToDate / invoiced) * 100, 100) : 0,
      invoiced,
      collected,
    };
  });

  const overdueInvoices = usableOutstandingInvoices
    .filter((inv) => differenceInDays(snapshotDate, inv.dueDate) > 0)
    .map((inv) => ({
      id: inv.id, customerName: inv.customer.name, invoiceNumber: inv.invoiceNumber || "N/A",
      amount: getOpenAmount(inv.amount, inv.amountPaid), dueDate: inv.dueDate.toISOString(),
      daysOverdue: differenceInDays(snapshotDate, inv.dueDate), remindersSent: inv.paymentReminderCount,
      collectionCalls: inv.collectionCallCount, autoChargeStatus: inv.autoChargeStatus,
      ownerName: inv.owner?.name || "Unassigned",
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  return { agingBreakdown, collectionPerformance, overdueInvoices };
}

async function queryCashFlow(endDate: Date): Promise<CashFlowData> {
  const excludedCustomerIds = await getFinancialHubExcludedCustomerIds();
  const snapshotDate = endDate;
  const outstandingInvoicesRaw = await prisma.invoice.findMany({
    where: { status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] } },
    include: { customer: { select: { name: true, id: true } }, payments: { select: { paymentDate: true, amount: true } } },
  });
  const outstandingInvoices = filterVisibleReceivableInvoices(outstandingInvoicesRaw, excludedCustomerIds);

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
    const weekStart = subDays(snapshotDate, -(i * 7));
    const weekEnd = subDays(snapshotDate, -((i + 1) * 7));
    const weekLabel = format(weekStart, "MMM dd");
    let optimistic = 0, expected = 0, conservative = 0;

    for (const inv of outstandingInvoices) {
      const dueInWeek = inv.dueDate >= weekStart && inv.dueDate < weekEnd;
      if (!dueInWeek && i > 0) continue;
      if (i === 0 && inv.dueDate > weekEnd) continue;

      const amount = getOpenAmount(inv.amount, inv.amountPaid);
      if (amount <= 0) continue;
      const daysOverdue = differenceInDays(snapshotDate, inv.dueDate);
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
    const remaining = getOpenAmount(inv.amount, inv.amountPaid);
    if (remaining <= 0) continue;
    const daysOverdue = differenceInDays(snapshotDate, inv.dueDate);
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

async function queryReceivablesProjection(
  startDate: Date,
  endDate: Date,
  qbWindow: QuickBooksWindowedFinancials | null = null,
): Promise<ReceivablesProjectionData> {
  const excludedCustomerIds = await getFinancialHubExcludedCustomerIds();
  const now = new Date();
  // 2025-01-01 baseline: exclude legacy pre-2025 invoices from delinquency/projection
  const BASE_DATE = buildQbHistoryStartDate();

  const [outstandingInvoices, pnlCache, historicalInvoices] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] },
        dueDate: { gte: BASE_DATE },
      },
      select: { id: true, customerId: true, amount: true, amountPaid: true, dueDate: true, status: true, quickbooks_invoice_id: true, installments: true },
    }),
    prisma.qbReportCache.findUnique({ where: { reportType: "ProfitAndLoss" }, select: { data: true } }),
    prisma.invoice.findMany({
      where: {
        status: { not: "VOID" },
        OR: [
          { createdAt: { gte: BASE_DATE, lte: endDate } },
          { dueDate: { gte: BASE_DATE, lte: endDate } },
        ],
      },
      select: {
        createdAt: true,
        dueDate: true,
        customerId: true,
        amount: true,
        quickbooks_invoice_id: true,
        installments: true,
      },
    }),
  ]);
  const usableOutstandingInvoices = filterVisibleReceivableInvoices(outstandingInvoices, excludedCustomerIds);
  const usableHistoricalInvoices = filterFinancialHubExcludedCustomers(
    historicalInvoices.filter(isFinancialInvoiceUsable),
    excludedCustomerIds,
  );

  let monthlyBreakeven = 0;
  const collectedHistoryByMonth = new Map<string, number>();
  try {
    if (pnlCache) {
      const pnl = ensureParsedProfitAndLoss(JSON.parse(pnlCache.data));
      const prev = getPreviousPeriod(startDate, endDate);
      const qbWindowedPnl = buildWindowedQbPnlSnapshot(pnl, startDate, endDate, prev.startDate, prev.endDate);
      monthlyBreakeven = computeTrailingClosedMonthCostAverage(qbWindowedPnl.monthlyPnL as MonthlyCostPoint[], endDate);
      const historicalQbWindow = buildWindowedQbPnlSnapshot(pnl, BASE_DATE, endDate, BASE_DATE, endDate);
      for (const row of historicalQbWindow.monthlyPnL as MonthlyCostPoint[]) {
        collectedHistoryByMonth.set(row.monthKey, row.revenue);
      }

      if (!monthlyBreakeven && qbWindow?.currentPnl) {
        monthlyBreakeven = (qbWindow.currentPnl.expenses.total || 0) + (qbWindow.currentPnl.cogs.total || 0);
      }
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
  const overdueCarryOver = usableOutstandingInvoices.filter(
    (inv) => differenceInDays(now, inv.dueDate) > 0 && format(inv.dueDate, "yyyy-MM") !== format(now, "yyyy-MM")
  );

  const monthlyProjection: ReceivablesProjectionData["monthlyProjection"] = [];
  for (let i = 0; i < 6; i++) {
    const targetMonthStart = startOfMonth(addMonths(now, i));
    const monthKey = format(targetMonthStart, "yyyy-MM");
    const monthLabel = format(targetMonthStart, "MMM yyyy");

    // Invoices whose dueDate falls in this calendar month
    const calendarMonthInvoices = usableOutstandingInvoices.filter(
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
      const remaining = getOpenAmount(inv.amount, inv.amountPaid);
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

  for (const inv of usableOutstandingInvoices) {
    const remaining = getOpenAmount(inv.amount, inv.amountPaid);
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

  const upcomingNext7Days = usableOutstandingInvoices
    .filter((inv) => inv.dueDate >= now && inv.dueDate <= next7)
    .reduce((sum, inv) => sum + getOpenAmount(inv.amount, inv.amountPaid), 0);

  const upcomingNext30Days = usableOutstandingInvoices
    .filter((inv) => inv.dueDate >= now && inv.dueDate <= next30)
    .reduce((sum, inv) => sum + getOpenAmount(inv.amount, inv.amountPaid), 0);

  const invoicedHistoryByMonth = new Map<string, number>();
  for (const invoice of usableHistoricalInvoices) {
    const month = resolveInvoiceBookedMonth(invoice);
    invoicedHistoryByMonth.set(month, (invoicedHistoryByMonth.get(month) || 0) + Number(invoice.amount || 0));
  }
  const historyMonths = Array.from(new Set([
    ...invoicedHistoryByMonth.keys(),
    ...collectedHistoryByMonth.keys(),
  ])).sort();
  const salesForecast = historyMonths.length > 0
    ? buildAverageSalesForecast(
        historyMonths.map((month) => ({
          month,
          invoiced: invoicedHistoryByMonth.get(month) || 0,
          collected: collectedHistoryByMonth.get(month) || 0,
        })),
        now,
        monthlyProjection.map((row) => ({
          month: row.month,
          monthLabel: row.monthLabel,
          collectionExpected: row.collectionExpected,
          conservative: row.conservative,
        })),
        Math.round(monthlyBreakeven),
      )
    : undefined;

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
    salesForecast,
  };
}

async function queryCustomerAnalysis(
  startDate: Date,
  endDate: Date,
  qbWindow: QuickBooksWindowedFinancials | null = null,
): Promise<CustomerAnalysisData> {
  const excludedCustomerIds = await getFinancialHubExcludedCustomerIds();
  const customerIdExclusionWhere = buildCustomerIdExclusionWhere(excludedCustomerIds);
  const now = endDate;
  const [customerPayments, allCustomers] = await Promise.all([
    prisma.payment.groupBy({
      by: ["customerId"],
      where: { paymentDate: { gte: startDate, lte: endDate }, ...customerIdExclusionWhere },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
    prisma.customer.findMany({
      where: {
        createdAt: { lte: endDate },
        ...(excludedCustomerIds.length > 0 ? { id: { notIn: excludedCustomerIds } } : {}),
      },
      select: {
        id: true,
        name: true,
        invoices: {
          where: { createdAt: { lte: endDate } },
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
  ]);

  const customerNames = await prisma.customer.findMany({
    where: { id: { in: customerPayments.map((c) => c.customerId) } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(customerNames.map((c) => [c.id, c.name]));

  const qbRows = (qbWindow?.currentCustomerSales.rows ?? [])
    .filter((row) => !isFinancialHubExcludedCustomer({ name: row.name }));
  const totalRevenue = qbRows.length > 0
    ? qbRows.reduce((sum, row) => sum + Number(row.total || 0), 0)
    : customerPayments.reduce((sum, c) => sum + Number(c._sum.amount || 0), 0);
  let cumulative = 0;
  const concentration = (qbRows.length > 0
    ? [...qbRows].sort((a, b) => b.total - a.total).map((row) => ({
        customer: row.name,
        revenue: Number(row.total || 0),
      }))
    : customerPayments.map((c) => ({
        customer: nameMap.get(c.customerId) || "Unknown",
        revenue: Number(c._sum.amount || 0),
      })))
    .map((entry) => {
      cumulative += entry.revenue;
      return { ...entry, cumulativePct: totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 0 };
    });

  const topCustomers = concentration.slice(0, 10).map((entry) => ({
    customer: entry.customer,
    totalPaid: entry.revenue,
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

function sumCategoryAmountForWindow(
  category: ParsedPnlCategory,
  months: string[],
  startDate: Date,
  endDate: Date,
): number {
  if (!category.byMonth?.length || months.length === 0) {
    return Number(category.amount || 0);
  }

  const startKey = format(startDate, "yyyy-MM");
  const endKey = format(endDate, "yyyy-MM");
  const amount = months.reduce((sum, label, index) => {
    const monthKey = getQbMonthKey(label);
    if (!monthKey || monthKey < startKey || monthKey > endKey) {
      return sum;
    }
    return sum + Number(category.byMonth?.[index] || 0);
  }, 0);

  return amount > 0 ? amount : Number(category.amount || 0);
}

function buildPnlCategoryBreakdown(
  categories: ParsedPnlCategory[],
  total: number,
  options?: {
    months: string[];
    startDate: Date;
    endDate: Date;
  },
): Array<{ category: string; amount: number; pctOfTotal: number }> {
  if (total <= 0) return [];

  return categories
    .map((category) => ({
      category: category.category,
      amount: roundMoney(options
        ? sumCategoryAmountForWindow(category, options.months, options.startDate, options.endDate)
        : Number(category.amount || 0)),
    }))
    .filter((category) => category.amount > 0)
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 15)
    .map((category) => ({
      ...category,
      pctOfTotal: (category.amount / total) * 100,
    }));
}

async function queryPnL(
  startDate: Date,
  endDate: Date,
  qbWindow: QuickBooksWindowedFinancials | null = null,
): Promise<PnLData | null> {
  try {
    const [pnlCache, balanceSheetCache, cashFlowCache] = await Promise.all([
      prisma.qbReportCache.findUnique({ where: { reportType: "ProfitAndLoss" } }),
      prisma.qbReportCache.findUnique({ where: { reportType: "BalanceSheet" } }),
      prisma.qbReportCache.findUnique({ where: { reportType: "CashFlow" } }),
    ]);

    if (!pnlCache) return null;

    const pnlData = ensureParsedProfitAndLoss(JSON.parse(pnlCache.data));
    const prev = getPreviousPeriod(startDate, endDate);
    const qbWindowedPnl = buildWindowedQbPnlSnapshot(pnlData, startDate, endDate, prev.startDate, prev.endDate);
    const exactCurrentPnl = qbWindow?.currentPnl;
    const exactPreviousPnl = qbWindow?.previousPnl;
    const cachedBalanceSheet = balanceSheetCache ? ensureParsedBalanceSheet(JSON.parse(balanceSheetCache.data)) : null;
    const cachedCashFlow = cashFlowCache ? ensureParsedCashFlow(JSON.parse(cashFlowCache.data)) : null;
    const currentBalanceSheet = qbWindow?.currentBalanceSheet ?? cachedBalanceSheet;
    const currentCashFlow = qbWindow?.currentCashFlow ?? cachedCashFlow;

    const cogs = exactCurrentPnl?.cogs ?? pnlData.cogs;
    const expenses = exactCurrentPnl?.expenses ?? pnlData.expenses;
    const monthlyPnL = qbWindowedPnl.monthlyPnL.map(({ month, revenue, cogs, expenses: monthExpenses, netIncome }) => ({
      month,
      revenue,
      cogs,
      expenses: monthExpenses,
      netIncome,
    }));

    const burnRate = computeTrailingClosedMonthCostAverage(qbWindowedPnl.monthlyPnL as MonthlyCostPoint[], endDate);
    const prevBurnRate = computeTrailingClosedMonthCostAverage(qbWindowedPnl.monthlyPnL as MonthlyCostPoint[], prev.endDate);

    const currentRevenueTotal = exactCurrentPnl?.income.total ?? qbWindowedPnl.current.totalRevenue;
    const currentCogsTotal = exactCurrentPnl?.cogs.total ?? qbWindowedPnl.current.totalCOGS;
    const currentExpenseTotal = (exactCurrentPnl?.expenses.total ?? qbWindowedPnl.current.totalExpenses - qbWindowedPnl.current.totalCOGS) + currentCogsTotal;
    const currentNetIncome = exactCurrentPnl?.netIncome.total ?? qbWindowedPnl.current.netIncome;
    const previousRevenueTotal = exactPreviousPnl?.income.total ?? qbWindowedPnl.previous.totalRevenue;
    const previousCogsTotal = exactPreviousPnl?.cogs.total ?? qbWindowedPnl.previous.totalCOGS;
    const previousExpenseTotal = (exactPreviousPnl?.expenses.total ?? qbWindowedPnl.previous.totalExpenses - qbWindowedPnl.previous.totalCOGS) + previousCogsTotal;
    const previousNetIncome = exactPreviousPnl?.netIncome.total ?? qbWindowedPnl.previous.netIncome;

    const cashOnHand = buildCashOnHandValue(currentBalanceSheet, currentCashFlow?.sections);
    const runwayMonths = burnRate > 0 ? cashOnHand / burnRate : 99;
    const marginPct = currentRevenueTotal > 0
      ? (currentNetIncome / currentRevenueTotal) * 100
      : 0;
    const cachedWindowOptions = exactCurrentPnl
      ? undefined
      : { months: pnlData.months, startDate, endDate };
    const cogsByCategory = buildPnlCategoryBreakdown(
      cogs.byCategory || [],
      currentCogsTotal,
      cachedWindowOptions,
    );
    const operatingExpensesTotal = Math.max(currentExpenseTotal - currentCogsTotal, 0);
    const expensesByCategory = buildPnlCategoryBreakdown(
      expenses.byCategory || [],
      operatingExpensesTotal,
      cachedWindowOptions,
    );

    return {
      totalRevenue: currentRevenueTotal,
      totalExpenses: currentExpenseTotal,
      totalCOGS: currentCogsTotal,
      netIncome: currentNetIncome,
      marginPct,
      prevTotalRevenue: previousRevenueTotal,
      prevTotalExpenses: previousExpenseTotal,
      prevNetIncome: previousNetIncome,
      monthlyPnL,
      expensesByCategory,
      cogsByCategory,
      burnRate,
      prevBurnRate,
      cashOnHand,
      runwayMonths,
      totalAssets: currentBalanceSheet?.totalAssets || 0,
      totalLiabilities: currentBalanceSheet?.totalLiabilities || 0,
      totalEquity: currentBalanceSheet?.totalEquity || 0,
      netCashChange: currentCashFlow?.netCashChange || 0,
      operatingCashFlow: getCashFlowSectionTotal(currentCashFlow?.sections, ["Operating Activities", "OPERATING ACTIVITIES", "OperatingActivities"]),
      investingCashFlow: getCashFlowSectionTotal(currentCashFlow?.sections, ["Investing Activities", "INVESTING ACTIVITIES", "InvestingActivities"]),
      financingCashFlow: getCashFlowSectionTotal(currentCashFlow?.sections, ["Financing Activities", "FINANCING ACTIVITIES", "FinancingActivities"]),
      lastFetchedAt: pnlCache.fetchedAt.toISOString(),
    };
  } catch (error) {
    console.error("[FINANCIAL-BI] Error reading QB report cache:", error);
    return null;
  }
}

// ── Public API ──────────────────────────────────────────────

export async function getFinancialKPIs(dateRange: string): Promise<CfoAnalysisInput> {
  const { startDate, endDate } = getFinancialDateRange(dateRange as any);
  const prev = getPreviousPeriod(startDate, endDate);
  const excludedCustomerIds = await getFinancialHubExcludedCustomerIds();
  const qbWindow = await loadQuickBooksWindowedFinancials(startDate, endDate, prev.startDate, prev.endDate)
    .catch((error) => {
      console.error("[FINANCIAL-BI] Failed to load exact QuickBooks window for KPI packet:", error);
      return null;
    });
  const summary = await querySummary(startDate, endDate, prev.startDate, prev.endDate, qbWindow);

  const [overdueInvoices, recentPaidInvoices, qbReportPacket, pnlResult] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] },
        dueDate: { lt: new Date() },
      },
      include: { customer: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
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
        quickbooks_invoice_id: true,
        installments: true,
        customer: { select: { name: true } },
      },
    }),
    getCachedQbCfoReportPacket(),
    queryPnL(startDate, endDate, qbWindow),
  ]);
  const usableOverdueInvoices = filterVisibleReceivableInvoices(overdueInvoices, excludedCustomerIds);
  const usableRecentPaidInvoices = filterFinancialHubExcludedCustomers(
    recentPaidInvoices.filter(isFinancialInvoiceUsable),
    excludedCustomerIds,
  );
  const worst = usableOverdueInvoices[0];
  const customerPaymentTrends = buildCustomerPaymentTrends(
    usableRecentPaidInvoices
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
          amount: getOpenAmount(worst.amount, worst.amountPaid),
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
    ...buildCfoFinancialSnapshot({
      summary: { overdueAmount: summary.overdueAR.value },
      pnl: pnlResult,
      overdueCount: usableOverdueInvoices.length,
      worstOverdue: worst ? { customer: worst.customer.name, amount: getOpenAmount(worst.amount, worst.amountPaid), days: differenceInDays(new Date(), worst.dueDate) } : null,
    }),
    aging90Plus: summary._raw.aging90PlusAmount, cashProjection30Day: summary._raw.thirtyDayCashProjection,
    patternAlerts, dateRangeLabel: dateRange,
    topExpenseCategory: "",
    topExpenseAmount: 0,
    qbReportPacket,
  };

  // Add expense category detail when available.
  try {
    const pnlCache = await prisma.qbReportCache.findUnique({ where: { reportType: "ProfitAndLoss" } });
    if (qbWindow) {
      const topCat = qbWindow.currentPnl.expenses.byCategory?.[0];
      Object.assign(result, {
        topExpenseCategory: topCat?.category || "",
        topExpenseAmount: topCat?.amount || 0,
      });
    } else if (pnlCache) {
      const pnl = ensureParsedProfitAndLoss(JSON.parse(pnlCache.data));
      const topCat = pnl.expenses?.byCategory?.[0];
      Object.assign(result, {
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
  const { startDate, endDate } = getFinancialDateRange(dateRange, { from, to });
  const prev = getPreviousPeriod(startDate, endDate);
  const excludedCustomerIds = await getFinancialHubExcludedCustomerIds();
  const qbWindowPromise = loadQuickBooksWindowedFinancials(startDate, endDate, prev.startDate, prev.endDate)
    .catch((error) => {
      console.error("[FINANCIAL-BI] Failed to load exact QuickBooks window:", error);
      return null;
    });
  // Run summary, overdue invoices, cached insight, and tab queries ALL in parallel
  const tabQueries: Promise<unknown>[] = [];
  const tabKeys: string[] = [];
  if (tab === "all" || tab === "revenue") { tabQueries.push(queryRevenueGrowth(startDate, endDate)); tabKeys.push("revenueGrowth"); }
  if (tab === "all" || tab === "ar") { tabQueries.push(qbWindowPromise.then((qbWindow) => queryArCollections(startDate, endDate, qbWindow))); tabKeys.push("arCollections"); }
  if (tab === "all" || tab === "cashflow") { tabQueries.push(queryCashFlow(endDate)); tabKeys.push("cashFlow"); }
  if (tab === "all" || tab === "cashflow") {
    tabQueries.push(qbWindowPromise.then((qbWindow) => queryReceivablesProjection(startDate, endDate, qbWindow)));
    tabKeys.push("receivablesProjection");
  }
  if (tab === "all" || tab === "customers") { tabQueries.push(qbWindowPromise.then((qbWindow) => queryCustomerAnalysis(startDate, endDate, qbWindow))); tabKeys.push("customerAnalysis"); }
  if (tab === "all" || tab === "pnl") { tabQueries.push(qbWindowPromise.then((qbWindow) => queryPnL(startDate, endDate, qbWindow))); tabKeys.push("pnl"); }

  const [summaryRaw, overdueForRules, recentPaidForRules, cachedInsight, ...tabResults] = await Promise.all([
    qbWindowPromise.then((qbWindow) => querySummary(startDate, endDate, prev.startDate, prev.endDate, qbWindow)),
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
        quickbooks_invoice_id: true,
        installments: true,
        customer: { select: { name: true } },
      },
    }),
    getCachedCfoInsight(dateRange),
    ...tabQueries,
  ]);
  const visibleOverdueForRules = overdueForRules.filter(
    (invoice) => filterVisibleReceivableInvoices([invoice], excludedCustomerIds).length > 0,
  );
  const visibleRecentPaidForRules = filterFinancialHubExcludedCustomers(
    recentPaidForRules.filter(isFinancialInvoiceUsable),
    excludedCustomerIds,
  );

  const facts: CfoFacts = {
    collectionRate: summaryRaw._raw.collectionRate, prevCollectionRate: summaryRaw._raw.prevCollectionRate,
    collectionRateChange: summaryRaw._raw.collectionRateChange, outstandingAR: summaryRaw.outstandingAR.value,
    topThreeConcentration: summaryRaw._raw.topThreeConcentration, topThreeClients: summaryRaw._raw.topThreeClients,
    overdueInvoices: visibleOverdueForRules.map((inv: any) => ({
      id: inv.id, customerName: inv.customer.name, amount: getOpenAmount(inv.amount, inv.amountPaid),
      daysOverdue: differenceInDays(new Date(), inv.dueDate), remindersSent: inv.paymentReminderCount,
      autoChargeStatus: inv.autoChargeStatus,
    })),
    customerPaymentTrends: buildCustomerPaymentTrends(
      visibleRecentPaidForRules
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
