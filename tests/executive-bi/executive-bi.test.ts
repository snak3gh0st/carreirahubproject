import test from "node:test";
import assert from "node:assert/strict";

import type { ExecutiveBIResponse } from "../../lib/types/executive-bi";
import {
  buildAdminExecutiveSourceFromCommercialBI,
  buildExecutiveOverview,
  getExecutiveBIData,
} from "../../lib/services/executive-bi";

test("buildExecutiveOverview shapes health metrics and ranks finance risk first", () => {
  const result = buildExecutiveOverview({
    finance: {
      summary: "Collections pressure is rising faster than cash coverage.",
      alerts: ["Three overdue accounts represent 41 percent of open receivables."],
      freshness: { state: "fresh", summary: "Finance updated 12 min ago" },
      signalCount: 2,
      revenue: 94000,
      cashOnHand: 120000,
      openAr: 27000,
      overdueAr: 18000,
      collectionsRate: 72.4,
    },
    sales: {
      summary: "Pipeline conversion softened this week.",
      alerts: ["Pipeline conversion fell 8.2 points versus the prior period."],
      freshness: { state: "partial", summary: "CRM sync is delayed for one segment" },
      signalCount: 1,
    },
    operations: {
      summary: "Two cohorts are moving slower than expected.",
      alerts: ["12 active students have not advanced phase in 14 days."],
      freshness: { state: "stale", summary: "Operations snapshot is 1 day old" },
      signalCount: 3,
    },
    ai: {
      summary: "AI usage needs review after recent execution failures.",
      alerts: ["AI surfaced 2 recent execution issues in the last 30 days."],
      freshness: { state: "fresh", summary: "AI usage updated 5 min ago" },
      signalCount: 2,
      decisionSeverity: "medium",
    },
  });

  assert.equal(result.health.revenue, 94000);
  assert.equal(result.health.cashOnHand, 120000);
  assert.equal(result.health.openAr, 27000);
  assert.equal(result.health.overdueAr, 18000);
  assert.equal(result.health.collectionsRate, 72.4);
  assert.equal(result.decisionQueue[0]?.area, "finance");
  assert.equal(result.decisionQueue[0]?.severity, "high");
  assert.equal(result.decisionQueue.find((item) => item.area === "ai")?.severity, "medium");
  assert.match(result.briefing, /open receivables/i);
  assert.match(result.briefing, /collections rate/i);
});

test("buildAdminExecutiveSourceFromCommercialBI maps sales KPIs from the canonical commercial BI", () => {
  const source = buildAdminExecutiveSourceFromCommercialBI({
    adminKpis: {
      activeStudents: 42,
    },
    commercial: {
      freshness: {
        state: "fresh",
        summary: "Clint sincronizado ha 1.0h.",
      },
      summary: {
        wonDeals: 23,
        conversionRate: 3.2,
        openPipelineValue: 1281298,
      },
    },
    linkedCustomers: 456,
    activeEnrollmentsStarted: 12,
    pausedEnrollments: 1,
  });

  assert.equal(source.kpis.wonDeals, 23);
  assert.equal(source.kpis.dealConversionRate, 3.2);
  assert.equal(source.kpis.pipelineValue, 1281298);
  assert.equal(source.kpis.linkedCustomers, 456);
  assert.equal(source.kpis.activeStudents, 42);
  assert.equal(source.salesFreshness?.state, "fresh");
  assert.match(source.salesFreshness?.summary ?? "", /Clint sincronizado/);
});

test("getExecutiveBIData builds four area summaries and drill-downs from canonical sources", async () => {
  let financialContext: { dateRange: string; from?: string; to?: string } | undefined;
  let adminContext: { dateRange: string; from?: string; to?: string } | undefined;
  let aiContext: { dateRange: string; from?: string; to?: string } | undefined;

  const data = await getExecutiveBIData({
    dateRange: "custom",
    from: "2026-04-01",
    to: "2026-05-01",
    loadFinancialBI: async (context) => {
      financialContext = context;
      return {
      summary: {
        revenue: { value: 94000 },
        collectionRate: { value: 72.4 },
        outstandingAR: { value: 27000 },
        overdueAR: { value: 18000 },
        topClientConcentration: {
          value: 41,
          topClients: [{ name: "Client A", percentage: 21 }, { name: "Client B", percentage: 12 }, { name: "Client C", percentage: 8 }],
        },
      },
      cfoInsight: {
        briefing: "Collections pressure is rising.",
        actions: [
          {
            severity: "URGENT",
            title: "AR concentration rising",
            description: "Three overdue accounts represent 41 percent of open receivables.",
          },
        ],
      },
      pnl: {
        cashOnHand: 120000,
        marginPct: 18.4,
        runwayMonths: 7.2,
        totalExpenses: 64000,
        totalCOGS: 18000,
        netIncome: 21000,
      },
      meta: {
        lastQbSync: "2026-05-04T12:00:00.000Z",
      },
    };
    },
    loadAdminBI: async (context) => {
      adminContext = context;
      return {
      kpis: {
        dealConversionRate: 14.2,
        wonDeals: 11,
        activeStudents: 87,
        pipelineValue: 156000,
        linkedCustomers: 9,
        activeEnrollmentsStarted: 14,
        pausedEnrollments: 2,
      },
      salesFreshness: { state: "fresh", summary: "Clint commercial KPIs are loaded from the live CRM snapshot." },
    };
    },
    loadAiUsage: async (context) => {
      aiContext = context;
      return {
      assistantMessagesLast30d: 420,
      recentErrorCount: 1,
      topToolName: "student_lookup",
      windowLabel: "2026-04-01 through 2026-05-01",
      freshness: { state: "fresh", summary: "AI usage updated 5 min ago" },
    };
    },
  });

  const typed: ExecutiveBIResponse = data;

  assert.ok(typed);
  assert.deepEqual(financialContext, { dateRange: "custom", from: "2026-04-01", to: "2026-05-01" });
  assert.deepEqual(adminContext, { dateRange: "custom", from: "2026-04-01", to: "2026-05-01" });
  assert.deepEqual(aiContext, { dateRange: "custom", from: "2026-04-01", to: "2026-05-01" });
  assert.deepEqual(Object.keys(data.areas).sort(), ["ai", "finance", "operations", "sales"]);
  assert.deepEqual(Object.keys(data.areaDetails).sort(), ["ai", "finance", "operations", "sales"]);
  assert.equal(data.overview.health.cashOnHand, 120000);
  assert.equal(data.overview.health.revenue, 94000);
  assert.equal(data.overview.health.overdueAr, 18000);
  assert.equal(data.overview.decisionQueue[0]?.area, "finance");
  assert.equal(data.overview.decisionQueue.find((item) => item.area === "ai")?.severity, "medium");
  assert.match(data.overview.briefing, /collections execution/i);
  assert.equal(data.areas.finance.status, "risk");
  assert.equal(data.areas.finance.signalCount, 1);
  assert.equal(data.areas.sales.status, "watch");
  assert.equal(data.areas.operations.status, "watch");
  assert.equal(data.areas.operations.label, "Operations");
  assert.equal(data.areas.sales.label, "Commercial & Clients");
  assert.equal(data.areas.sales.metrics?.[1]?.label, "Pipeline Value");
  assert.equal(data.areas.sales.metrics?.[2]?.label, "Deal Conversion");
  assert.equal(data.areas.sales.metrics?.[3]?.label, "Linked Customers");
  assert.match(data.areas.sales.summary, /linked customers/i);
  assert.equal(data.areaDetails.finance.area, "finance");
  assert.ok(data.areaDetails.finance.bullets[0]?.includes("41 percent"));
  assert.ok(data.areaDetails.ai.bullets[0]?.includes("2026-04-01 through 2026-05-01"));
  assert.ok(data.areaDetails.ai.bullets.some((bullet) => bullet.includes("student_lookup")));
});
