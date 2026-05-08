import test from "node:test";
import assert from "node:assert/strict";

import { EmailService, type AdminDailyDigestData } from "../lib/services/email.service";

function baseDigestData(): AdminDailyDigestData {
  return {
    date: "Tuesday, May 5 2026",
    today: { revenueToday: 1200, dealsWonToday: 1, leadsToday: 4 },
    week: { dealsWonWeek: 3, leadsWeek: 19 },
    financial: {
      mrr: 72000,
      totalAR: 18000,
      delinquencyRate: 11.2,
      overdueAmount: 2500,
      overdueCount: 4,
      monthlyTrend: [
        { label: "Mar 2026", revenue: 58000, invoiced: 61000, newInvoices: 18, collectionRate: 95.1 },
        { label: "Apr 2026", revenue: 64000, invoiced: 69000, newInvoices: 21, collectionRate: 92.8 },
        { label: "May 2026", revenue: 18000, invoiced: 24000, newInvoices: 8, collectionRate: 75 },
      ],
      annualTrend: [
        { label: "Jun 2025", revenue: 10000, invoiced: 12000, dealsWon: 2, newLeads: 20 },
        { label: "Jul 2025", revenue: 12000, invoiced: 14000, dealsWon: 2, newLeads: 22 },
        { label: "Aug 2025", revenue: 13000, invoiced: 15000, dealsWon: 3, newLeads: 24 },
        { label: "Sep 2025", revenue: 14000, invoiced: 16000, dealsWon: 3, newLeads: 25 },
        { label: "Oct 2025", revenue: 15000, invoiced: 17000, dealsWon: 4, newLeads: 26 },
        { label: "Nov 2025", revenue: 16000, invoiced: 18000, dealsWon: 4, newLeads: 27 },
        { label: "Dec 2025", revenue: 17000, invoiced: 19000, dealsWon: 5, newLeads: 28 },
        { label: "Jan 2026", revenue: 18000, invoiced: 20000, dealsWon: 5, newLeads: 29 },
        { label: "Feb 2026", revenue: 19000, invoiced: 21000, dealsWon: 6, newLeads: 30 },
        { label: "Mar 2026", revenue: 58000, invoiced: 61000, dealsWon: 7, newLeads: 31 },
        { label: "Apr 2026", revenue: 64000, invoiced: 69000, dealsWon: 8, newLeads: 32 },
        { label: "May 2026", revenue: 18000, invoiced: 24000, dealsWon: 2, newLeads: 12 },
      ],
      arAging: [
        { label: "Current (not due)", count: 8, amount: 12000 },
        { label: "1-30 days", count: 2, amount: 2000 },
        { label: "31-60 days", count: 1, amount: 500 },
        { label: "61-90 days", count: 0, amount: 0 },
        { label: "90+ days", count: 1, amount: 2500 },
      ],
      topOverdue: [],
      paymentMethods: [],
      costBreakdown: {
        periodLabel: "May 2026 MTD",
        revenue: 18000,
        cogsTotal: 5400,
        operatingExpensesTotal: 3600,
        totalCost: 9000,
        grossMarginPct: 70,
        cogsToExpenseRatio: 1.5,
        cogsSharePct: 60,
        expensesSharePct: 40,
        cogsByCategory: [
          { category: "Contract instructors", amount: 4200, pctOfCogs: 77.8 },
          { category: "Program materials", amount: 1200, pctOfCogs: 22.2 },
        ],
        expensesByCategory: [
          { category: "Payroll", amount: 2600, pctOfExpenses: 72.2 },
          { category: "Software", amount: 1000, pctOfExpenses: 27.8 },
        ],
      },
    },
    commercial: {
      monthlyTrend: [
        { label: "Mar 2026", dealsWon: 5, wonValue: 58000, newLeads: 31, qualified: 12 },
        { label: "Apr 2026", dealsWon: 6, wonValue: 64000, newLeads: 32, qualified: 15 },
        { label: "May 2026", dealsWon: 2, wonValue: 18000, newLeads: 12, qualified: 5 },
      ],
      topClosers: [],
      leadFunnel: [
        { status: "NEW", count: 12 },
        { status: "QUALIFYING", count: 6 },
        { status: "QUALIFIED", count: 5 },
        { status: "UNQUALIFIED", count: 1 },
        { status: "CONVERTED", count: 2 },
        { status: "LOST", count: 0 },
      ],
      leadSources: [],
      avgQualificationScore: 72,
    },
    operations: {
      activeStudents: 42,
      avgNegotiationDays: 18,
      monthlyEnrollments: [
        { label: "Mar 2026", total: 9, pass: 4, advanced: 5 },
        { label: "Apr 2026", total: 12, pass: 6, advanced: 6 },
        { label: "May 2026", total: 5, pass: 3, advanced: 2 },
      ],
    },
  };
}

test("sendAdminDailyDigest renders COGS breakdown and COGS-to-expense relationship", async () => {
  const service = Object.create(EmailService.prototype) as EmailService;
  let html = "";

  (service as unknown as {
    sendEmailWithTracking: (to: string, subject: string, html: string) => Promise<void>;
  }).sendEmailWithTracking = async (_to, _subject, renderedHtml) => {
    html = renderedHtml;
  };

  await service.sendAdminDailyDigest(
    { name: "Executive", email: "exec@carreirausa.com" },
    baseDigestData(),
  );

  assert.match(html, /COGS &amp; Expense Mix/);
  assert.match(html, /COGS:OpEx/);
  assert.match(html, /1\.50x/);
  assert.match(html, /Contract instructors/);
  assert.match(html, /Program materials/);
  assert.match(html, /Operating Expense Breakdown/);
});
