// lib/types/financial-bi.ts

export interface KPIMetric {
  value: number;
  prevValue: number;
  changePct: number;
  context: string;
  contextLevel: "good" | "warning" | "danger";
}

export interface ConcentrationMetric extends KPIMetric {
  topClients: Array<{ name: string; percentage: number }>;
}

export interface CfoAction {
  severity: "URGENT" | "WATCH" | "INSIGHT";
  title: string;
  description: string;
  linkedEntity?: { type: "invoice" | "customer"; id: string };
}

export interface CfoInsightData {
  briefing: string;
  generatedAt: string;
  actions: CfoAction[];
}

export interface FinancialBISummary {
  revenue: KPIMetric;
  collectionRate: KPIMetric;
  outstandingAR: KPIMetric;
  mrr: KPIMetric;
  topClientConcentration: ConcentrationMetric;
  revenueTrendMini: Array<{ month: string; amount: number }>;
  agingSnapshotMini: Array<{ bucket: string; amount: number; count: number }>;
}

export interface RevenueGrowthData {
  invoicedVsCollected: Array<{ month: string; invoiced: number; collected: number }>;
  revenueByService: Array<{ service: string; amount: number }>;
  mrrTrend: Array<{ month: string; mrr: number; arr: number }>;
  momGrowth: Array<{ month: string; growthPct: number }>;
}

export interface ArCollectionsData {
  agingBreakdown: Array<{ bucket: string; count: number; amount: number }>;
  collectionPerformance: Array<{ month: string; avgDaysToPayment: number; collectionRate: number }>;
  overdueInvoices: OverdueInvoiceRow[];
}

export interface OverdueInvoiceRow {
  id: string;
  customerName: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
  remindersSent: number;
  collectionCalls: number;
  autoChargeStatus: string | null;
  ownerName: string;
}

export interface CashFlowData {
  forecast: Array<{ date: string; optimistic: number; expected: number; conservative: number }>;
  probabilityBreakdown: Array<{ segment: string; amount: number; count: number }>;
  atRiskInvoices: AtRiskInvoiceRow[];
}

export interface AtRiskInvoiceRow {
  id: string;
  customerName: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
  probability: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  lastAction: string;
}

export interface CustomerAnalysisData {
  concentration: Array<{ customer: string; revenue: number; cumulativePct: number }>;
  topCustomers: Array<{ customer: string; totalPaid: number }>;
  segments: Array<{ segment: string; count: number; revenue: number }>;
  ltv: {
    average: number;
    median: number;
    trend: Array<{ month: string; value: number }>;
  };
}

export interface PnLData {
  totalRevenue: number;
  totalExpenses: number;
  totalCOGS: number;
  netIncome: number;
  marginPct: number;
  prevTotalRevenue: number;
  prevTotalExpenses: number;
  prevNetIncome: number;
  monthlyPnL: Array<{
    month: string;
    revenue: number;
    cogs: number;
    expenses: number;
    netIncome: number;
  }>;
  expensesByCategory: Array<{
    category: string;
    amount: number;
    pctOfTotal: number;
  }>;
  burnRate: number;
  prevBurnRate: number;
  cashOnHand: number;
  runwayMonths: number;
  lastFetchedAt: string;
}

export interface FinancialBIResponse {
  summary: FinancialBISummary;
  cfoInsight: CfoInsightData;
  revenueGrowth?: RevenueGrowthData;
  arCollections?: ArCollectionsData;
  cashFlow?: CashFlowData;
  customerAnalysis?: CustomerAnalysisData;
  pnl?: PnLData;
  meta: {
    lastQbSync: string;
    dateRange: { from: string; to: string };
    generatedAt: string;
  };
}

export type TabParam = "all" | "revenue" | "ar" | "cashflow" | "customers" | "pnl";
export type DateRangeParam = "last7" | "last30" | "last90" | "thisYear" | "allTime" | "custom";
