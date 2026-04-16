import test from "node:test";
import assert from "node:assert/strict";

import { buildDashboardMetrics } from "../lib/dashboard/metrics-calculations";

test("buildDashboardMetrics preserves dashboard KPI semantics from aggregate inputs", () => {
  const metrics = buildDashboardMetrics({
    totalLeads: 10,
    qualifiedLeads: 4,
    totalDeals: 5,
    wonDeals: 2,
    wonDealsThisMonth: 1,
    totalInvoices: 8,
    totalRevenue: 1000.4,
    totalInvoiced: 1500.4,
    totalPaid: 1300.4,
    overdueAmount: 200.2,
    overdueCount: 1,
    totalCustomers: 6,
    newCustomersThisMonth: 2,
    dealStatusSummary: [
      { status: "OPEN", valueSum: 500.2 },
      { status: "WON", valueSum: 900.7 },
      { status: "LOST", valueSum: 300.1 },
    ],
    invoicesPaidThisMonth: 3,
    invoicesPaidLastMonth: 2,
    dateRange: "thisYear",
    customerSegment: "all",
    invoiceStatuses: ["PAID", "OVERDUE"],
    appliedDateRange: { gte: new Date("2026-01-01T00:00:00.000Z") },
  });

  assert.deepEqual(metrics.sales, {
    wonDealsThisMonth: 1,
    totalDeals: 5,
    wonDeals: 2,
    totalLeads: 10,
    qualifiedLeads: 4,
    conversionRate: "20.0",
    pipelineValue: 500,
    avgDealValue: 500,
  });

  assert.deepEqual(metrics.finance, {
    totalRevenue: 1000,
    totalInvoiced: 1500,
    totalPaid: 1300,
    pendingAmount: 200,
    overdueAmount: 200,
    collectionRate: "86.7",
    totalInvoices: 8,
    overdueCount: 1,
    revenueGrowth: "50.0",
  });

  assert.deepEqual(metrics.customers, {
    totalCustomers: 6,
    newCustomersThisMonth: 2,
    avgCustomerValue: 167,
  });
});
