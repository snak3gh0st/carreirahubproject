export interface DashboardMetricsBuildInput {
  totalLeads: number;
  qualifiedLeads: number;
  totalDeals: number;
  wonDeals: number;
  wonDealsThisMonth: number;
  totalInvoices: number;
  totalRevenue: number;
  totalInvoiced: number;
  totalPaid: number;
  overdueAmount: number;
  overdueCount: number;
  totalCustomers: number;
  newCustomersThisMonth: number;
  dealStatusSummary: Array<{ status: string; valueSum: number }>;
  invoicesPaidThisMonth: number;
  invoicesPaidLastMonth: number;
  dateRange: string;
  customerSegment: string;
  invoiceStatuses: string[];
  appliedDateRange: { gte?: Date; lte?: Date };
  actions?: {
    openInvoiceCount: number;
    partialInvoiceCount: number;
    pendingContractCount: number;
    openDealCount: number;
    qualifiedLeadCount: number;
    quickbooksGapCount: number;
    autoChargeRiskCount: number;
  };
}

export function buildDashboardMetrics(input: DashboardMetricsBuildInput) {
  const conversionRate = input.totalLeads > 0 ? (input.wonDeals / input.totalLeads) * 100 : 0;
  const pendingAmount = input.totalInvoiced - input.totalPaid;
  const collectionRate = input.totalInvoiced > 0 ? (input.totalPaid / input.totalInvoiced) * 100 : 0;
  const pipelineValue = input.dealStatusSummary
    .filter((deal) => deal.status !== "WON" && deal.status !== "LOST")
    .reduce((sum, deal) => sum + deal.valueSum, 0);
  const avgDealValue = input.wonDeals > 0 ? input.totalRevenue / input.wonDeals : 0;
  const avgCustomerValue = input.totalCustomers > 0 ? input.totalRevenue / input.totalCustomers : 0;
  const revenueGrowth =
    input.invoicesPaidLastMonth > 0
      ? (((input.invoicesPaidThisMonth - input.invoicesPaidLastMonth) / input.invoicesPaidLastMonth) * 100).toFixed(1)
      : "0";

  const actions = input.actions ?? {
    openInvoiceCount: 0,
    partialInvoiceCount: 0,
    pendingContractCount: 0,
    openDealCount: 0,
    qualifiedLeadCount: 0,
    quickbooksGapCount: 0,
    autoChargeRiskCount: 0,
  };

  return {
    sales: {
      wonDealsThisMonth: input.wonDealsThisMonth,
      totalDeals: input.totalDeals,
      wonDeals: input.wonDeals,
      totalLeads: input.totalLeads,
      qualifiedLeads: input.qualifiedLeads,
      conversionRate: conversionRate.toFixed(1),
      pipelineValue: Math.round(pipelineValue),
      avgDealValue: Math.round(avgDealValue),
    },
    finance: {
      totalRevenue: Math.round(input.totalRevenue),
      totalInvoiced: Math.round(input.totalInvoiced),
      totalPaid: Math.round(input.totalPaid),
      pendingAmount: Math.round(pendingAmount),
      overdueAmount: Math.round(input.overdueAmount),
      collectionRate: collectionRate.toFixed(1),
      totalInvoices: input.totalInvoices,
      overdueCount: input.overdueCount,
      revenueGrowth,
    },
    customers: {
      totalCustomers: input.totalCustomers,
      newCustomersThisMonth: input.newCustomersThisMonth,
      avgCustomerValue: Math.round(avgCustomerValue),
    },
    summary: {
      totalMetrics: input.totalLeads + input.totalDeals + input.totalInvoices + input.totalCustomers,
      activeUsers: input.totalLeads,
    },
    filters: {
      dateRange: input.dateRange,
      customerSegment: input.customerSegment,
      invoiceStatus: input.invoiceStatuses,
      appliedDateRange: input.appliedDateRange,
    },
    actions,
  };
}
