import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_EXECUTIVE_DAILY_DIGEST_EMAIL,
  getExecutiveDailyDigestEmail,
  isCfoInsightStale,
  parseCfoRecommendations,
} from "../lib/services/executive-daily-digest";
import {
  EmailService,
  type ExecutiveDailyDigestData,
} from "../lib/services/email.service";

function baseDigestData(): ExecutiveDailyDigestData {
  return {
    date: "Wednesday, May 6 2026",
    today: { revenueToday: 2200, dealsWonToday: 2, leadsToday: 9 },
    week: { dealsWonWeek: 7, leadsWeek: 42 },
    financial: {
      mrr: 71000,
      totalAR: 22000,
      delinquencyRate: 9.4,
      overdueAmount: 3100,
      overdueCount: 3,
      monthlyTrend: [
        { label: "Mar 2026", revenue: 58000, invoiced: 61000, newInvoices: 18, collectionRate: 95.1 },
        { label: "Apr 2026", revenue: 64000, invoiced: 69000, newInvoices: 21, collectionRate: 92.8 },
        { label: "May 2026", revenue: 22000, invoiced: 27000, newInvoices: 9, collectionRate: 81.5 },
      ],
      annualTrend: [],
      arAging: [],
      topOverdue: [
        { customer: "Cliente A", invoiceNumber: "INV-101", amount: 1900, daysOverdue: 18 },
      ],
      paymentMethods: [],
      costBreakdown: null,
    },
    commercial: {
      monthlyTrend: [
        { label: "Mar 2026", dealsWon: 5, wonValue: 58000, newLeads: 31, qualified: 12 },
        { label: "Apr 2026", dealsWon: 6, wonValue: 64000, newLeads: 32, qualified: 15 },
        { label: "May 2026", dealsWon: 3, wonValue: 22000, newLeads: 16, qualified: 8 },
      ],
      topClosers: [{ name: "Ana", won: 2, value: 14000 }],
      leadFunnel: [],
      leadSources: [],
      avgQualificationScore: 74,
    },
    operations: {
      activeStudents: 48,
      avgNegotiationDays: 16,
      monthlyEnrollments: [
        { label: "Mar 2026", total: 9, pass: 4, advanced: 5 },
        { label: "Apr 2026", total: 12, pass: 6, advanced: 6 },
        { label: "May 2026", total: 6, pass: 4, advanced: 2 },
      ],
    },
    aiCfo: {
      briefing: "Caixa estavel, mas cobranca precisa seguir semanalmente.",
      recommendations: [
        "Priorizar os 3 maiores saldos vencidos.",
        "Manter margem acima de 20%.",
      ],
      generatedAt: new Date("2026-05-06T08:00:00.000Z"),
      dateRange: "last30",
      isStale: false,
    },
    dataQuality: {
      quickBooksConnected: false,
      quickBooksTokenExpired: true,
      quickBooksTokenExpiresAt: new Date("2026-04-13T22:15:37.670Z"),
      latestQuickBooksError: "Incorrect or invalid refresh token",
    },
  };
}

test("executive digest defaults to Thais and supports manual test override", () => {
  assert.equal(DEFAULT_EXECUTIVE_DAILY_DIGEST_EMAIL, "thais.mei@carreirausa.com");
  assert.equal(getExecutiveDailyDigestEmail(), "thais.mei@carreirausa.com");
  assert.equal(getExecutiveDailyDigestEmail("qa@example.com"), "qa@example.com");
  assert.equal(getExecutiveDailyDigestEmail(null, "ceo@example.com"), "ceo@example.com");
});

test("parseCfoRecommendations returns concise string recommendations", () => {
  assert.deepEqual(
    parseCfoRecommendations(JSON.stringify(["Acompanhar AR", { title: "Revisar COGS" }, { text: "Cobrar top 3" }])),
    ["Acompanhar AR", "Revisar COGS", "Cobrar top 3"],
  );
  assert.deepEqual(parseCfoRecommendations("not-json"), []);
});

test("isCfoInsightStale flags missing or old AI context", () => {
  const now = new Date("2026-05-06T12:00:00.000Z");
  assert.equal(isCfoInsightStale(null, now), true);
  assert.equal(isCfoInsightStale(new Date("2026-05-05T04:00:00.000Z"), now), false);
  assert.equal(isCfoInsightStale(new Date("2026-05-04T23:00:00.000Z"), now), true);
});

test("sendExecutiveDailyDigest renders a concise all-area report with AI CFO context", async () => {
  const service = Object.create(EmailService.prototype) as EmailService;
  let subject = "";
  let html = "";

  (service as unknown as {
    sendEmailWithTracking: (to: string, subject: string, html: string) => Promise<void>;
  }).sendEmailWithTracking = async (_to, renderedSubject, renderedHtml) => {
    subject = renderedSubject;
    html = renderedHtml;
  };

  await service.sendExecutiveDailyDigest(
    { name: "Thais", email: "thais.mei@carreirausa.com" },
    baseDigestData(),
  );

  assert.match(subject, /Resumo executivo diario/);
  assert.match(html, /Thais/);
  assert.match(html, /Leitura da IA CFO/);
  assert.match(html, /Caixa estavel/);
  assert.match(html, /Priorizar os 3 maiores saldos vencidos/);
  assert.match(html, /Financeiro/);
  assert.match(html, /Comercial/);
  assert.match(html, /Operacoes/);
  assert.match(html, /QuickBooks precisa reconectar/);
});
