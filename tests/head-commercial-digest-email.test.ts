import test from "node:test";
import assert from "node:assert/strict";

import { EmailService } from "../lib/services/email.service";
import type { CommercialBIResponse } from "../lib/services/commercial-bi";

function baseCommercialBIData(): CommercialBIResponse {
  return {
    dateRange: {
      from: "2026-05-01T00:00:00.000Z",
      to: "2026-05-05T23:59:59.999Z",
    },
    freshness: {
      lastClintSync: "2026-05-05T12:00:00.000Z",
      state: "fresh",
      summary: "Clint sincronizado ha 2.0h.",
    },
    summary: {
      sellerCount: 2,
      leadCount: 18,
      qualifiedLeads: 9,
      convertedLeads: 4,
      openPipelineValue: 42000,
      openDeals: 7,
      wonDeals: 3,
      wonValue: 28000,
      lostDeals: 1,
      conversionRate: 75,
      avgDealValue: 9333,
      pendingContracts: 2,
      pendingInvoices: 4,
      pendingInvoiceAmount: 6500,
      staleOpenDeals: 3,
      unassignedOpenDeals: 1,
    },
    sellers: [
      {
        sellerId: "seller-a",
        sellerName: "Ana",
        sellerEmail: "ana@carreirausa.com",
        leads: 10,
        qualifiedLeads: 5,
        convertedLeads: 3,
        openDeals: 4,
        openPipelineValue: 24000,
        wonDeals: 2,
        wonValue: 18000,
        lostDeals: 1,
        conversionRate: 66.7,
        avgDealValue: 9000,
        avgCloseDays: 12,
        pendingContracts: 1,
        pendingInvoices: 2,
        pendingInvoiceAmount: 4500,
        staleOpenDeals: 1,
        clintLinkedDeals: 5,
      },
      {
        sellerId: "seller-b",
        sellerName: "Bruna",
        sellerEmail: "bruna@carreirausa.com",
        leads: 8,
        qualifiedLeads: 4,
        convertedLeads: 1,
        openDeals: 3,
        openPipelineValue: 18000,
        wonDeals: 1,
        wonValue: 10000,
        lostDeals: 0,
        conversionRate: 100,
        avgDealValue: 10000,
        avgCloseDays: 18,
        pendingContracts: 1,
        pendingInvoices: 2,
        pendingInvoiceAmount: 2000,
        staleOpenDeals: 2,
        clintLinkedDeals: 4,
      },
    ],
    sourceBreakdown: [
      { source: "Clint", leads: 12, qualified: 7, converted: 3, avgScore: 82 },
      { source: "Referral", leads: 6, qualified: 2, converted: 1, avgScore: 68 },
    ],
    actionQueue: {
      staleDeals: [
        { id: "deal-1", title: "PASS - Maria", sellerName: "Ana", value: 12000, daysStale: 19 },
      ],
      pendingInvoices: [
        { id: "invoice-1", invoiceNumber: "INV-100", sellerName: "Ana", openAmount: 4500, daysOverdue: 8 },
      ],
      wonWithoutContract: [],
      wonWithoutInvoice: [],
      unassignedOpenDeals: [],
    },
    closerBreakdown: [],
  };
}

test("sendHeadCommercialDailyDigest renders a commercial-only team BI email", async () => {
  const service = Object.create(EmailService.prototype) as EmailService;
  let to = "";
  let subject = "";
  let html = "";

  (service as unknown as {
    sendEmailWithTracking: (to: string, subject: string, html: string) => Promise<void>;
  }).sendEmailWithTracking = async (recipient, renderedSubject, renderedHtml) => {
    to = recipient;
    subject = renderedSubject;
    html = renderedHtml;
  };

  await service.sendHeadCommercialDailyDigest(
    { name: "Ariela", email: "ariela.chrisostomo@carreirausa.com" },
    baseCommercialBIData(),
  );

  assert.equal(to, "ariela.chrisostomo@carreirausa.com");
  assert.match(subject, /BI Comercial/);
  assert.match(html, /Performance por vendedor/);
  assert.match(html, /Ana/);
  assert.match(html, /Bruna/);
  assert.match(html, /Pipeline aberto/);
  assert.match(html, /Pendencias/);
  assert.match(html, /Origem dos leads/);
  assert.match(html, /Abrir BI Comercial/);
  assert.doesNotMatch(html, /COGS/);
  assert.doesNotMatch(html, /Financial/);
});
