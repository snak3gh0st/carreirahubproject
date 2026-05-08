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
  recommendations: string[];
  actions: CfoAction[];
}

export interface FinancialBISummary {
  revenue: KPIMetric;
  collectionRate: KPIMetric;
  outstandingAR: KPIMetric;
  overdueAR: KPIMetric;
  mrr: KPIMetric;
  topClientConcentration: ConcentrationMetric;
  delinquencyRate?: number;
  avgDaysToPayment?: number;
  revenueTrendMini: Array<{ month: string; amount: number }>;
  agingSnapshotMini: Array<{ bucket: string; amount: number; count: number }>;
}

export interface RevenueGrowthData {
  invoicedVsCollected: Array<{ month: string; invoiced: number; collected: number }>;
  revenueByService: Array<{ service: string; amount: number; invoiceCount: number }>;
  mrrTrend: Array<{ month: string; mrr: number; arr: number; actualMrr: number; actualArr: number }>;
  momGrowth: Array<{ month: string; growthPct: number }>;
}

export interface ArCollectionsData {
  agingBreakdown: Array<{ bucket: string; count: number; amount: number }>;
  collectionPerformance: Array<{ month: string; avgDaysToPayment: number | null; collectionRate: number; invoiced: number; collected: number }>;
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
  cogsByCategory: Array<{
    category: string;
    amount: number;
    pctOfTotal: number;
  }>;
  burnRate: number;
  prevBurnRate: number;
  cashOnHand: number;
  runwayMonths: number;
  totalAssets?: number;
  totalLiabilities?: number;
  totalEquity?: number;
  netCashChange?: number;
  operatingCashFlow?: number;
  investingCashFlow?: number;
  financingCashFlow?: number;
  lastFetchedAt: string;
}

export interface MonthlyReceivable {
  month: string;
  monthLabel: string;
  totalDue: number;
  collectionExpected: number;
  optimistic: number;
  conservative: number;
  invoiceCount: number;
  delinquentAmount: number;
}

export interface DelinquencySummary {
  totalDelinquent: number;
  totalAR: number;
  delinquencyRate: number;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
  estimatedRecovery: number;
  estimatedLoss: number;
}

export interface ReceivablesProjectionData {
  monthlyProjection: MonthlyReceivable[];
  delinquency: DelinquencySummary;
  overdueTotal: number;
  upcomingNext7Days: number;
  upcomingNext30Days: number;
  monthlyBreakeven: number;
  salesForecast?: {
    avgProjectedSales: number;
    avgProjectedCashIn: number;
    realizationRate: number;
    monthly: Array<{
      month: string;
      monthLabel: string;
      projectedSales: number;
      projectedCashIn: number;
      existingReceivables: number;
      totalExpectedInflow: number;
      conservativeTotalInflow: number;
      gapToBreakeven: number;
    }>;
  };
}

export interface FinancialBIResponse {
  summary: FinancialBISummary;
  cfoInsight: CfoInsightData;
  revenueGrowth?: RevenueGrowthData;
  arCollections?: ArCollectionsData;
  cashFlow?: CashFlowData;
  receivablesProjection?: ReceivablesProjectionData;
  customerAnalysis?: CustomerAnalysisData;
  pnl?: PnLData;
  meta: {
    lastQbSync: string;
    dateRange: { from: string; to: string };
    generatedAt: string;
  };
}

export type TabParam = "all" | "revenue" | "ar" | "cashflow" | "customers" | "pnl";
export type DateRangeParam =
  | "last7"
  | "last30"
  | "last90"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "allTime"
  | "custom";
