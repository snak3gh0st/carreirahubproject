import test from "node:test";
import assert from "node:assert/strict";

import {
  applyCanonicalFinanceSummary,
  buildDashboardMetrics,
  getDashboardDateFilter,
} from "../lib/dashboard/metrics-calculations";
import { getFinancialDateRange } from "../lib/financial/bi-helpers";

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

test("getDashboardDateFilter supports MTD aliases with exact month-to-date bounds", () => {
  const now = new Date("2026-05-05T15:30:00.000Z");

  const filter = getDashboardDateFilter("thisMonth", { now });

  assert.equal(filter?.gte?.getFullYear(), 2026);
  assert.equal(filter?.gte?.getMonth(), 4);
  assert.equal(filter?.gte?.getDate(), 1);
  assert.equal(filter?.lte?.toISOString(), now.toISOString());
});

test("getDashboardDateFilter supports lastMonth with closed month bounds", () => {
  const now = new Date("2026-05-05T15:30:00.000Z");

  const filter = getDashboardDateFilter("lastMonth", { now });

  assert.equal(filter?.gte?.getFullYear(), 2026);
  assert.equal(filter?.gte?.getMonth(), 3);
  assert.equal(filter?.gte?.getDate(), 1);
  assert.equal(filter?.lte?.getFullYear(), 2026);
  assert.equal(filter?.lte?.getMonth(), 3);
  assert.equal(filter?.lte?.getDate(), 30);
});

test("getFinancialDateRange keeps rolling windows inclusive to the requested day count", () => {
  const now = new Date("2026-05-05T15:30:00.000Z");

  const last7 = getFinancialDateRange("last7", { now });
  const last30 = getFinancialDateRange("last30", { now });
  const last90 = getFinancialDateRange("last90", { now });

  assert.equal(last7.startDate.toISOString(), "2026-04-29T15:30:00.000Z");
  assert.equal(last30.startDate.toISOString(), "2026-04-06T15:30:00.000Z");
  assert.equal(last90.startDate.toISOString().slice(0, 10), "2026-02-05");
});

test("applyCanonicalFinanceSummary aligns home finance KPIs to the QuickBooks summary layer", () => {
  const metrics = buildDashboardMetrics({
    totalLeads: 10,
    qualifiedLeads: 4,
    totalDeals: 5,
    wonDeals: 2,
    wonDealsThisMonth: 1,
    totalInvoices: 8,
    totalRevenue: 1000,
    totalInvoiced: 1500,
    totalPaid: 1000,
    overdueAmount: 200,
    overdueCount: 1,
    totalCustomers: 6,
    newCustomersThisMonth: 2,
    dealStatusSummary: [],
    invoicesPaidThisMonth: 3,
    invoicesPaidLastMonth: 2,
    dateRange: "thisMonth",
    customerSegment: "all",
    invoiceStatuses: [],
    appliedDateRange: { gte: new Date("2026-05-01T00:00:00.000Z") },
  });

  const aligned = applyCanonicalFinanceSummary(metrics, {
    revenue: { value: 6682.92, prevValue: 11302.57, changePct: -40.87, context: "", contextLevel: "danger" },
    collectionRate: { value: 25.4, prevValue: 38.1, changePct: -33.33, context: "", contextLevel: "danger" },
    outstandingAR: { value: 485434.87, prevValue: 489367.79, changePct: -0.8, context: "", contextLevel: "warning" },
    overdueAR: { value: 249163.05, prevValue: 244873.09, changePct: 1.75, context: "", contextLevel: "danger" },
    mrr: { value: 74753.17, prevValue: 74000, changePct: 1.02, context: "", contextLevel: "good" },
    topClientConcentration: {
      value: 32,
      prevValue: 31,
      changePct: 1,
      context: "",
      contextLevel: "warning",
      topClients: [],
    },
    revenueTrendMini: [],
    agingSnapshotMini: [],
  });

  assert.equal(aligned.finance.totalRevenue, 6683);
  assert.equal(aligned.finance.totalPaid, 6683);
  assert.equal(aligned.finance.pendingAmount, 485435);
  assert.equal(aligned.finance.overdueAmount, 249163);
  assert.equal(aligned.finance.collectionRate, "25.4");
  assert.equal(aligned.finance.revenueGrowth, "-40.9");
});
