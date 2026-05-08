import { prisma } from "@/lib/db";
import type { CommercialBIResponse } from "@/lib/services/commercial-bi";
import type { DateRangeParam } from "@/lib/types/financial-bi";
import type {
  ExecutiveAreaDrillDown,
  ExecutiveAreaKey,
  ExecutiveMetricItem,
  ExecutiveAreaSummary,
  ExecutiveBIResponse,
  ExecutiveDecisionItem,
  ExecutiveFreshness,
  ExecutiveOverview,
} from "@/lib/types/executive-bi";

type DecisionSeverity = ExecutiveDecisionItem["severity"];
type AreaStatus = ExecutiveAreaSummary["status"];

export interface ExecutiveAreaInput {
  summary: string;
  alerts: string[];
  freshness: ExecutiveFreshness;
  signalCount?: number;
  decisionSeverity?: DecisionSeverity;
  metrics?: ExecutiveMetricItem[];
  revenue?: number;
  cashOnHand?: number;
  openAr?: number;
  overdueAr?: number;
  collectionsRate?: number;
}

interface ExecutiveOverviewInput {
  finance: ExecutiveAreaInput;
  sales: ExecutiveAreaInput;
  operations: ExecutiveAreaInput;
  ai: ExecutiveAreaInput;
}

interface FinancialExecutiveSource {
  summary: {
    revenue: { value: number };
    collectionRate: { value: number };
    outstandingAR: { value: number };
    overdueAR: { value: number };
    topClientConcentration: { value: number; topClients: Array<{ name: string; percentage: number }> };
  };
  cfoInsight: {
    briefing: string;
    actions: Array<{
      severity?: "URGENT" | "WATCH" | "INSIGHT";
      title: string;
      description: string;
    }>;
  };
  pnl?: {
    cashOnHand: number;
    marginPct: number;
    runwayMonths: number;
    totalExpenses: number;
    totalCOGS: number;
    netIncome: number;
  } | null;
  meta: {
    lastQbSync: string;
  };
}

interface AdminExecutiveSource {
  kpis: {
    dealConversionRate: number;
    wonDeals: number;
    activeStudents: number;
    pipelineValue: number;
    linkedCustomers: number;
    activeEnrollmentsStarted: number;
    pausedEnrollments: number;
  };
  salesFreshness?: ExecutiveFreshness;
}

interface AiExecutiveSource {
  assistantMessagesLast30d: number;
  recentErrorCount: number;
  topToolName?: string | null;
  windowLabel: string;
  freshness: ExecutiveFreshness;
}

type CommercialFreshnessForExecutive = Pick<CommercialBIResponse["freshness"], "state" | "summary">;

export interface ExecutiveBILoadContext {
  dateRange: DateRangeParam;
  from?: string;
  to?: string;
}

export interface ExecutiveBIDataOptions {
  dateRange?: DateRangeParam;
  from?: string;
  to?: string;
  loadFinancialBI?: (context: ExecutiveBILoadContext) => Promise<FinancialExecutiveSource>;
  loadAdminBI?: (context: ExecutiveBILoadContext) => Promise<AdminExecutiveSource>;
  loadAiUsage?: (context: ExecutiveBILoadContext) => Promise<AiExecutiveSource>;
}

function formatCurrencyCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function mapCfoSeverityToExecutive(severity?: "URGENT" | "WATCH" | "INSIGHT"): DecisionSeverity {
  if (severity === "URGENT") return "high";
  if (severity === "WATCH") return "medium";
  return "low";
}

function getAreaLabel(area: ExecutiveAreaKey): string {
  if (area === "sales") return "Commercial & Clients";
  return area === "ai" ? "AI" : area[0].toUpperCase() + area.slice(1);
}

function getAreaHref(area: ExecutiveAreaKey): string {
  return `/dashboard/bi?area=${area}`;
}

function buildAreaStatus(area: ExecutiveAreaKey, input: ExecutiveAreaInput): AreaStatus {
  if (input.freshness.state === "unavailable") return "risk";
  if (area === "finance" && ((input.overdueAr ?? 0) > 0 || input.alerts.length > 0)) return "risk";
  if (input.freshness.state === "stale" || input.alerts.length > 0 || (input.signalCount ?? 0) > 0) return "watch";
  return "good";
}

function buildDecisionItem(
  area: ExecutiveAreaKey,
  index: number,
  impact: string,
  severity: DecisionSeverity,
): ExecutiveDecisionItem {
  const focus = area === "finance" ? "collections" : "overview";
  const titleByArea: Record<ExecutiveAreaKey, string> = {
    finance: "Finance risk requires action",
    sales: "Sales trend needs attention",
    operations: "Operations bottleneck needs follow-up",
    ai: "AI execution should be reviewed",
  };
  const actionByArea: Record<ExecutiveAreaKey, string> = {
    finance: "Review receivables risk and assign collections owners today.",
    sales: "Inspect conversion drivers and adjust pipeline follow-up this week.",
    operations: "Review stalled delivery work and rebalance team attention.",
    ai: "Review the failing AI workflow and confirm the next operational fix.",
  };

  return {
    id: `${area}-${index}`,
    area,
    severity,
    title: titleByArea[area],
    impact,
    suggestedAction: actionByArea[area],
    href: `${getAreaHref(area)}&focus=${focus}`,
  };
}

function getSeverityScore(severity: DecisionSeverity): number {
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

function buildDecisionQueue(input: ExecutiveOverviewInput): ExecutiveDecisionItem[] {
  const financeSeverity: DecisionSeverity = input.finance.decisionSeverity
    ?? ((input.finance.overdueAr ?? 0) > 0 || input.finance.alerts.length > 0 ? "high" : "low");
  const salesSeverity: DecisionSeverity = input.sales.decisionSeverity
    ?? (input.sales.alerts.length > 0 ? "medium" : "low");
  const operationsSeverity: DecisionSeverity = input.operations.decisionSeverity
    ?? (input.operations.alerts.length > 0 || input.operations.freshness.state === "stale" ? "medium" : "low");
  const aiSeverity: DecisionSeverity = input.ai.decisionSeverity
    ?? ((input.ai.signalCount ?? 0) > 0 ? "medium" : input.ai.alerts.length > 0 ? "low" : "low");

  const items = [
    ...(input.finance.alerts[0] ? [buildDecisionItem("finance", 0, input.finance.alerts[0], financeSeverity)] : []),
    ...(input.sales.alerts[0] ? [buildDecisionItem("sales", 0, input.sales.alerts[0], salesSeverity)] : []),
    ...(input.operations.alerts[0] ? [buildDecisionItem("operations", 0, input.operations.alerts[0], operationsSeverity)] : []),
    ...(input.ai.alerts[0] ? [buildDecisionItem("ai", 0, input.ai.alerts[0], aiSeverity)] : []),
  ];

  return items.sort((left, right) => {
    const severityDelta = getSeverityScore(right.severity) - getSeverityScore(left.severity);
    if (severityDelta !== 0) return severityDelta;
    if (left.area === "finance" && right.area !== "finance") return -1;
    if (right.area === "finance" && left.area !== "finance") return 1;
    return left.area.localeCompare(right.area);
  });
}

function buildOverviewFreshness(input: ExecutiveOverviewInput): ExecutiveFreshness {
  const domainFreshness = [
    ["Finance", input.finance.freshness],
    ["Sales", input.sales.freshness],
    ["Operations", input.operations.freshness],
    ["AI", input.ai.freshness],
  ] as const;

  const delayed = domainFreshness.filter(([, freshness]) => freshness.state !== "fresh");
  if (delayed.length === 0) {
    return { state: "fresh", summary: "All executive domains are fresh." };
  }
  if (delayed.some(([, freshness]) => freshness.state === "unavailable")) {
    return { state: "unavailable", summary: `${delayed.map(([label]) => label).join(", ")} data is unavailable.` };
  }
  if (delayed.some(([, freshness]) => freshness.state === "stale")) {
    return { state: "stale", summary: `${delayed.map(([label]) => label).join(", ")} data is delayed.` };
  }
  return { state: "partial", summary: `${delayed.map(([label]) => label).join(", ")} data is partially refreshed.` };
}

export function buildExecutiveOverview(input: ExecutiveOverviewInput): ExecutiveOverview {
  const decisionQueue = buildDecisionQueue(input);
  const topDecision = decisionQueue[0];
  const revenue = input.finance.revenue ?? 0;
  const openAr = input.finance.openAr ?? 0;
  const overdueAr = input.finance.overdueAr ?? 0;
  const collectionsRate = input.finance.collectionsRate ?? 0;
  const cashOnHand = input.finance.cashOnHand ?? 0;

  const lines: string[] = [];
  lines.push(
    `Revenue is ${revenue > 0 ? "active" : "flat"} in the selected window, cash on hand is ${cashOnHand > 0 ? "available" : "not visible"}, and open receivables stand at ${Math.round(openAr).toLocaleString()} dollars.`
  );
  if (overdueAr > 0) {
    lines.push(`Overdue AR is ${Math.round(overdueAr).toLocaleString()} dollars and collections rate is ${collectionsRate.toFixed(1)} percent, so collections execution needs immediate attention.`);
  } else {
    lines.push(`Collections rate is ${collectionsRate.toFixed(1)} percent and overdue receivables are currently contained.`);
  }
  if (topDecision) {
    lines.push(`Next executive action: ${topDecision.suggestedAction}`);
  }
  const briefing = lines.join(" ");

  return {
    briefing,
    health: {
      revenue,
      cashOnHand: input.finance.cashOnHand ?? 0,
      openAr,
      overdueAr,
      collectionsRate,
    },
    decisionQueue,
    freshness: buildOverviewFreshness(input),
  };
}

function buildAreaSummaries(input: ExecutiveOverviewInput): Record<ExecutiveAreaKey, ExecutiveAreaSummary> {
  return {
    finance: {
      label: "Finance",
      status: buildAreaStatus("finance", input.finance),
      summary: input.finance.summary,
      freshness: input.finance.freshness,
      signalCount: input.finance.signalCount,
      metrics: input.finance.metrics,
      href: getAreaHref("finance"),
    },
    sales: {
      label: "Commercial & Clients",
      status: buildAreaStatus("sales", input.sales),
      summary: input.sales.summary,
      freshness: input.sales.freshness,
      signalCount: input.sales.signalCount,
      metrics: input.sales.metrics,
      href: getAreaHref("sales"),
    },
    operations: {
      label: "Operations",
      status: buildAreaStatus("operations", input.operations),
      summary: input.operations.summary,
      freshness: input.operations.freshness,
      signalCount: input.operations.signalCount,
      metrics: input.operations.metrics,
      href: getAreaHref("operations"),
    },
    ai: {
      label: "AI",
      status: buildAreaStatus("ai", input.ai),
      summary: input.ai.summary,
      freshness: input.ai.freshness,
      signalCount: input.ai.signalCount,
      metrics: input.ai.metrics,
      href: getAreaHref("ai"),
    },
  };
}

function buildAreaDetails(input: ExecutiveOverviewInput): Record<ExecutiveAreaKey, ExecutiveAreaDrillDown> {
  return {
    finance: {
      area: "finance",
      summary: input.finance.summary,
      bullets: input.finance.alerts.length > 0 ? input.finance.alerts : ["Finance is operating without active executive alerts."],
    },
    sales: {
      area: "sales",
      summary: input.sales.summary,
      bullets: input.sales.alerts.length > 0 ? input.sales.alerts : ["Sales is operating without active executive alerts."],
    },
    operations: {
      area: "operations",
      summary: input.operations.summary,
      bullets: input.operations.alerts.length > 0 ? input.operations.alerts : ["Operations is operating without active executive alerts."],
    },
    ai: {
      area: "ai",
      summary: input.ai.summary,
      bullets: input.ai.alerts.length > 0 ? input.ai.alerts : ["AI is operating without active executive alerts."],
    },
  };
}

function formatDateOnly(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function resolveExecutiveAdminWindow(
  dateRange: DateRangeParam,
  now: Date = new Date(),
  from?: string,
  to?: string,
): {
  preset: "last30" | "last90" | "thisYear" | "allTime" | "custom";
  from?: string;
  to?: string;
} {
  if (dateRange === "custom") return { preset: "custom", from, to };
  if (dateRange === "last90") return { preset: "last90" };
  if (dateRange === "thisYear") return { preset: "thisYear" };
  if (dateRange === "allTime") return { preset: "allTime" };
  if (dateRange === "last7") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - 6);
    return {
      preset: "custom",
      from: formatDateOnly(start),
      to: formatDateOnly(now),
    };
  }
  if (dateRange === "thisMonth") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return {
      preset: "custom",
      from: formatDateOnly(start),
      to: formatDateOnly(now),
    };
  }
  if (dateRange === "lastMonth") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    return {
      preset: "custom",
      from: formatDateOnly(start),
      to: formatDateOnly(end),
    };
  }
  return { preset: "last30" };
}

function getAiWindow(context: ExecutiveBILoadContext): { startDate: Date; freshnessSummary: string; windowLabel: string } {
  const now = new Date();
  if (context.dateRange === "custom" && context.from) {
    return {
      startDate: new Date(context.from),
      windowLabel: context.to ? `${context.from} through ${context.to}` : `starting ${context.from}`,
      freshnessSummary: context.to
        ? `AI usage updated for ${context.from} through ${context.to}.`
        : `AI usage updated starting ${context.from}.`,
    };
  }
  if (context.dateRange === "last7") {
    return {
      startDate: new Date(Date.now() - 7 * 86_400_000),
      windowLabel: "the last 7 days",
      freshnessSummary: "AI usage updated from the last 7 day aggregate.",
    };
  }
  if (context.dateRange === "last90") {
    return {
      startDate: new Date(Date.now() - 90 * 86_400_000),
      windowLabel: "the last 90 days",
      freshnessSummary: "AI usage updated from the last 90 day aggregate.",
    };
  }
  if (context.dateRange === "thisYear") {
    return {
      startDate: new Date(now.getFullYear(), 0, 1),
      windowLabel: "the current year",
      freshnessSummary: "AI usage updated for the current year.",
    };
  }
  if (context.dateRange === "allTime") {
    return {
      startDate: new Date("2020-01-01T00:00:00.000Z"),
      windowLabel: "the full retained history",
      freshnessSummary: "AI usage updated across the full retained history.",
    };
  }
  return {
    startDate: new Date(Date.now() - 30 * 86_400_000),
    windowLabel: "the last 30 days",
    freshnessSummary: "AI usage updated from the last 30 day aggregate.",
  };
}

async function loadCanonicalFinancialBI(context: ExecutiveBILoadContext): Promise<FinancialExecutiveSource> {
  const { getFinancialBIData } = await import("@/lib/services/financial-bi");
  const financial = await getFinancialBIData(context.dateRange, context.from, context.to, "pnl");
  return {
    summary: {
      revenue: { value: financial.summary.revenue.value },
      collectionRate: { value: financial.summary.collectionRate.value },
      outstandingAR: { value: financial.summary.outstandingAR.value },
      overdueAR: { value: financial.summary.overdueAR.value },
      topClientConcentration: {
        value: financial.summary.topClientConcentration.value,
        topClients: financial.summary.topClientConcentration.topClients,
      },
    },
    cfoInsight: {
      briefing: financial.cfoInsight.briefing,
      actions: financial.cfoInsight.actions.map((action) => ({
        severity: action.severity,
        title: action.title,
        description: action.description,
      })),
    },
    pnl: financial.pnl
      ? {
          cashOnHand: financial.pnl.cashOnHand,
          marginPct: financial.pnl.marginPct,
          runwayMonths: financial.pnl.runwayMonths,
          totalExpenses: financial.pnl.totalExpenses,
          totalCOGS: financial.pnl.totalCOGS,
          netIncome: financial.pnl.netIncome,
        }
      : null,
    meta: {
      lastQbSync: financial.meta.lastQbSync,
    },
  };
}

function mapCommercialFreshness(
  freshness: CommercialFreshnessForExecutive
): ExecutiveFreshness {
  if (freshness.state === "fresh") {
    return { state: "fresh", summary: freshness.summary };
  }
  if (freshness.state === "stale") {
    return { state: "stale", summary: freshness.summary };
  }
  return { state: "unavailable", summary: freshness.summary };
}

export function buildAdminExecutiveSourceFromCommercialBI(input: {
  adminKpis: {
    activeStudents?: number;
  };
  commercial: {
    freshness: CommercialFreshnessForExecutive;
    summary: Pick<CommercialBIResponse["summary"], "wonDeals" | "conversionRate" | "openPipelineValue">;
  };
  linkedCustomers: number;
  activeEnrollmentsStarted: number;
  pausedEnrollments: number;
}): AdminExecutiveSource {
  return {
    kpis: {
      dealConversionRate: input.commercial.summary.conversionRate,
      wonDeals: input.commercial.summary.wonDeals,
      activeStudents: input.adminKpis.activeStudents ?? 0,
      pipelineValue: input.commercial.summary.openPipelineValue,
      linkedCustomers: input.linkedCustomers,
      activeEnrollmentsStarted: input.activeEnrollmentsStarted,
      pausedEnrollments: input.pausedEnrollments,
    },
    salesFreshness: mapCommercialFreshness(input.commercial.freshness),
  };
}

async function loadCanonicalAdminBI(context: ExecutiveBILoadContext): Promise<AdminExecutiveSource> {
  const { getAdminBIData } = await import("@/lib/services/admin-bi");
  const { getCommercialBIData, getCommercialBIDateRange } = await import("@/lib/services/commercial-bi");
  const adminWindow = resolveExecutiveAdminWindow(context.dateRange, new Date(), context.from, context.to);
  const admin = await getAdminBIData(adminWindow.preset, adminWindow.from, adminWindow.to, "kpis");
  const range = getCommercialBIDateRange({
    preset: context.dateRange,
    from: context.from,
    to: context.to,
  });
  const [linkedCustomers, activeEnrollmentsStarted, pausedEnrollments, commercial] = await Promise.all([
    prisma.customer.count({
      where: {
        clint_contact_id: { not: null },
      },
    }),
    prisma.mentorshipEnrollment.count({
      where: { startDate: { gte: range.startDate, lte: range.endDate } },
    }),
    prisma.mentorshipEnrollment.count({
      where: { status: "PAUSED" },
    }),
    getCommercialBIData({
      preset: context.dateRange,
      from: context.from,
      to: context.to,
    }),
  ]);

  return buildAdminExecutiveSourceFromCommercialBI({
    adminKpis: {
      activeStudents: admin.kpis?.activeStudents,
    },
    commercial,
    linkedCustomers,
    activeEnrollmentsStarted,
    pausedEnrollments,
  });
}

async function loadCanonicalAiUsage(context: ExecutiveBILoadContext): Promise<AiExecutiveSource> {
  const window = getAiWindow(context);
  const [assistantMessagesLast30d, recentErrorCount, topTool] = await Promise.all([
    prisma.aiMessage.count({
      where: { role: "ASSISTANT", createdAt: { gte: window.startDate } },
    }),
    prisma.aiMessage.count({
      where: { errorMessage: { not: null }, createdAt: { gte: window.startDate } },
    }),
    prisma.aiMessage.groupBy({
      by: ["toolName"],
      where: {
        role: "TOOL",
        createdAt: { gte: window.startDate },
        toolName: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { toolName: "desc" } },
      take: 1,
    }),
  ]);

  return {
    assistantMessagesLast30d,
    recentErrorCount,
    topToolName: topTool[0]?.toolName ?? null,
    windowLabel: window.windowLabel,
    freshness: {
      state: "fresh",
      summary: window.freshnessSummary,
    },
  };
}

export async function getExecutiveBIData(options: ExecutiveBIDataOptions = {}): Promise<ExecutiveBIResponse> {
  const context: ExecutiveBILoadContext = {
    dateRange: options.dateRange ?? "last30",
    from: options.from,
    to: options.to,
  };
  const loadFinancialBI = options.loadFinancialBI ?? loadCanonicalFinancialBI;
  const loadAdminBI = options.loadAdminBI ?? loadCanonicalAdminBI;
  const loadAiUsage = options.loadAiUsage ?? loadCanonicalAiUsage;

  const [financial, admin, aiUsage] = await Promise.all([
    loadFinancialBI(context),
    loadAdminBI(context),
    loadAiUsage(context),
  ]);

  const financeFreshness: ExecutiveFreshness = financial.meta.lastQbSync === "Never"
    ? { state: "stale", summary: "Finance sync is missing." }
    : { state: "fresh", summary: `Finance updated ${financial.meta.lastQbSync}` };

  const salesAlerts = [
    ...(admin.kpis.dealConversionRate < 20
      ? [`Deal conversion is ${admin.kpis.dealConversionRate.toFixed(1)} percent and needs review.`]
      : []),
    ...(admin.kpis.wonDeals === 0
      ? ["No deals were won in the active reporting window."]
      : []),
    ...(admin.kpis.pipelineValue <= 0
      ? ["Pipeline value is empty for the active commercial window."]
      : []),
  ];
  const operationsAlerts = [
    ...(admin.kpis.pausedEnrollments > 0
      ? [`${admin.kpis.pausedEnrollments} enrollments are paused and should be reviewed.`]
      : []),
    ...(admin.kpis.activeStudents === 0
      ? ["No active students are visible in the current operational snapshot."]
      : []),
  ];
  const aiAlerts = [
    ...(aiUsage.recentErrorCount > 0
      ? [`AI surfaced ${aiUsage.recentErrorCount} recent execution issue${aiUsage.recentErrorCount === 1 ? "" : "s"} in ${aiUsage.windowLabel}.`]
      : []),
    ...(aiUsage.recentErrorCount > 0 && aiUsage.topToolName
      ? [`Most used AI tool: ${aiUsage.topToolName}.`]
      : []),
  ];
  const strongestFinanceSeverity = financial.cfoInsight.actions.reduce<DecisionSeverity | undefined>((strongest, action) => {
    const nextSeverity = mapCfoSeverityToExecutive(action.severity);
    if (!strongest || getSeverityScore(nextSeverity) > getSeverityScore(strongest)) {
      return nextSeverity;
    }
    return strongest;
  }, undefined);

  const input: ExecutiveOverviewInput = {
    finance: {
      summary: `QuickBooks shows ${formatCurrencyCompact(financial.summary.revenue.value)} in revenue, ${formatCurrencyCompact(financial.summary.outstandingAR.value)} open AR, ${formatCurrencyCompact(financial.summary.overdueAR.value)} overdue AR, and ${financial.summary.collectionRate.value.toFixed(1)} percent collections in the active window.`,
      alerts: financial.cfoInsight.actions.map((action) => action.description),
      freshness: financeFreshness,
      signalCount: financial.cfoInsight.actions.length,
      decisionSeverity: strongestFinanceSeverity,
      metrics: [
        { label: "Revenue", value: formatCurrencyCompact(financial.summary.revenue.value), helper: "QuickBooks window revenue" },
        { label: "Cash", value: formatCurrencyCompact(financial.pnl?.cashOnHand ?? 0), helper: "Balance sheet bank accounts" },
        { label: "Open AR", value: formatCurrencyCompact(financial.summary.outstandingAR.value), helper: "Open receivables" },
        { label: "Overdue AR", value: formatCurrencyCompact(financial.summary.overdueAR.value), helper: "Past due receivables" },
        { label: "Collections", value: `${financial.summary.collectionRate.value.toFixed(1)}%`, helper: "Collected vs invoiced" },
      ],
      revenue: financial.summary.revenue.value,
      cashOnHand: financial.pnl?.cashOnHand ?? 0,
      openAr: financial.summary.outstandingAR.value,
      overdueAr: financial.summary.overdueAR.value,
      collectionsRate: financial.summary.collectionRate.value,
    },
    sales: {
      summary: `Commercial closed ${admin.kpis.wonDeals} deals in the selected window, Clint shows ${formatCurrencyCompact(admin.kpis.pipelineValue)} in current open pipeline, ${admin.kpis.linkedCustomers} linked customers, and ${financial.summary.topClientConcentration.value.toFixed(1)} percent concentration in the top three clients.`,
      alerts: salesAlerts,
      freshness: admin.salesFreshness ?? { state: "partial", summary: "Sales summary is derived from the admin BI reporting window." },
      signalCount: salesAlerts.length,
      metrics: [
        { label: "Deals Won", value: String(admin.kpis.wonDeals), helper: "Won in the selected window" },
        { label: "Pipeline Value", value: formatCurrencyCompact(admin.kpis.pipelineValue), helper: "Current open Clint pipeline" },
        { label: "Deal Conversion", value: `${admin.kpis.dealConversionRate.toFixed(1)}%`, helper: "Won / (won + lost) in the selected window" },
        { label: "Linked Customers", value: String(admin.kpis.linkedCustomers), helper: "Current customers matched to Clint" },
        { label: "Top 3 Concentration", value: `${financial.summary.topClientConcentration.value.toFixed(1)}%`, helper: "Revenue concentration" },
      ],
    },
    operations: {
      summary: `${admin.kpis.activeStudents} active students are in delivery, ${admin.kpis.activeEnrollmentsStarted} enrollments started in the selected window, and ${admin.kpis.pausedEnrollments} paused enrollments need operational follow-up.`,
      alerts: operationsAlerts,
      freshness: { state: "partial", summary: "Operations summary is derived from the admin BI reporting window." },
      signalCount: operationsAlerts.length,
      metrics: [
        { label: "Enrollments", value: String(admin.kpis.activeEnrollmentsStarted), helper: "Started in window" },
        { label: "Active Students", value: String(admin.kpis.activeStudents), helper: "Currently in delivery" },
        { label: "Paused", value: String(admin.kpis.pausedEnrollments), helper: "Need review" },
      ],
    },
    ai: {
      summary: aiUsage.recentErrorCount > 0
        ? `AI usage is active, but ${aiUsage.recentErrorCount} recent execution issue${aiUsage.recentErrorCount === 1 ? "" : "s"} need review.`
        : `AI usage is stable across ${aiUsage.assistantMessagesLast30d} assistant responses in ${aiUsage.windowLabel}.`,
      alerts: aiAlerts,
      freshness: aiUsage.freshness,
      signalCount: aiUsage.recentErrorCount,
      decisionSeverity: aiUsage.recentErrorCount > 0 ? "medium" : "low",
      metrics: [
        { label: "Assistant Replies", value: String(aiUsage.assistantMessagesLast30d), helper: aiUsage.windowLabel },
        { label: "Recent Errors", value: String(aiUsage.recentErrorCount), helper: "Execution issues in window" },
        { label: "Top Tool", value: aiUsage.topToolName ?? "None", helper: "Most used workflow tool" },
      ],
    },
  };

  return {
    overview: buildExecutiveOverview(input),
    areas: buildAreaSummaries(input),
    areaDetails: buildAreaDetails(input),
  };
}
