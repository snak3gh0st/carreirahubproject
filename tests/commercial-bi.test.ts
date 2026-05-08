import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCommercialBIFromRecords,
  getCommercialBIDateRange,
} from "../lib/services/commercial-bi";

const NOW = new Date("2026-05-05T12:00:00.000Z");

test("getCommercialBIDateRange supports the same executive filter windows", () => {
  const thisMonth = getCommercialBIDateRange({ preset: "thisMonth", now: NOW });
  assert.equal(thisMonth.startDate.toISOString(), "2026-05-01T00:00:00.000Z");
  assert.equal(thisMonth.endDate.toISOString(), NOW.toISOString());

  const lastMonth = getCommercialBIDateRange({ preset: "lastMonth", now: NOW });
  assert.equal(lastMonth.startDate.toISOString(), "2026-04-01T00:00:00.000Z");
  assert.equal(lastMonth.endDate.toISOString(), "2026-04-30T23:59:59.999Z");

  const last7 = getCommercialBIDateRange({ preset: "last7", now: NOW });
  assert.equal(last7.startDate.toISOString(), "2026-04-29T12:00:00.000Z");
  assert.equal(last7.endDate.toISOString(), NOW.toISOString());
});

test("buildCommercialBIFromRecords aggregates the whole commercial team and segments each seller", () => {
  const data = buildCommercialBIFromRecords({
    now: NOW,
    range: {
      startDate: new Date("2026-05-01T00:00:00.000Z"),
      endDate: new Date("2026-05-05T23:59:59.999Z"),
    },
    sellers: [
      { id: "seller-a", name: "Alice Seller", email: "alice@example.com" },
      { id: "seller-b", name: "Bruno Seller", email: "bruno@example.com" },
    ],
    leads: [
      { id: "lead-1", createdById: "seller-a", status: "NEW", source: "META", qualificationScore: 20, createdAt: new Date("2026-05-01T12:00:00.000Z"), convertedAt: null },
      { id: "lead-2", createdById: "seller-a", status: "QUALIFIED", source: "META", qualificationScore: 82, createdAt: new Date("2026-05-02T12:00:00.000Z"), convertedAt: null },
      { id: "lead-3", createdById: "seller-a", status: "CONVERTED", source: "GOOGLE", qualificationScore: 91, createdAt: new Date("2026-05-03T12:00:00.000Z"), convertedAt: new Date("2026-05-04T12:00:00.000Z") },
      { id: "lead-4", createdById: "seller-b", status: "QUALIFIED", source: "REFERRAL", qualificationScore: 76, createdAt: new Date("2026-05-03T12:00:00.000Z"), convertedAt: null },
    ],
    deals: [
      { id: "deal-a-open", ownerId: "seller-a", title: "Alice open", value: 10000, status: "OPEN", clint_deal_id: "clint-a-open", createdAt: new Date("2026-05-01T12:00:00.000Z"), updatedAt: new Date("2026-05-04T12:00:00.000Z") },
      { id: "deal-a-won", ownerId: "seller-a", title: "Alice won", value: 20000, status: "WON", clint_deal_id: "clint-a-won", createdAt: new Date("2026-04-25T12:00:00.000Z"), updatedAt: new Date("2026-05-04T12:00:00.000Z") },
      { id: "deal-a-lost", ownerId: "seller-a", title: "Alice lost", value: 5000, status: "LOST", clint_deal_id: "clint-a-lost", createdAt: new Date("2026-05-01T12:00:00.000Z"), updatedAt: new Date("2026-05-02T12:00:00.000Z") },
      { id: "deal-b-open", ownerId: "seller-b", title: "Bruno stale", value: 15000, status: "OPEN", clint_deal_id: null, createdAt: new Date("2026-04-01T12:00:00.000Z"), updatedAt: new Date("2026-04-12T12:00:00.000Z") },
      { id: "deal-b-won", ownerId: "seller-b", title: "Bruno won", value: 10000, status: "WON", clint_deal_id: "clint-b-won", createdAt: new Date("2026-04-29T12:00:00.000Z"), updatedAt: new Date("2026-05-03T12:00:00.000Z") },
      { id: "deal-unassigned", ownerId: null, title: "Unassigned Clint deal", value: 7000, status: "OPEN", clint_deal_id: "clint-unassigned", createdAt: new Date("2026-05-01T12:00:00.000Z"), updatedAt: new Date("2026-05-02T12:00:00.000Z") },
    ],
    invoices: [
      { id: "invoice-a-paid", ownerId: "seller-a", dealId: "deal-a-won", invoiceNumber: "A-1", amount: 20000, amountPaid: 20000, status: "PAID", dueDate: new Date("2026-05-10T12:00:00.000Z"), createdAt: new Date("2026-05-04T12:00:00.000Z"), paidAt: new Date("2026-05-05T12:00:00.000Z") },
      { id: "invoice-a-open", ownerId: "seller-a", dealId: "deal-a-open", invoiceNumber: "A-2", amount: 5000, amountPaid: 0, status: "SENT", dueDate: new Date("2026-05-20T12:00:00.000Z"), createdAt: new Date("2026-05-04T12:00:00.000Z"), paidAt: null },
      { id: "invoice-b-overdue", ownerId: "seller-b", dealId: "deal-b-won", invoiceNumber: "B-1", amount: 10000, amountPaid: 2000, status: "OVERDUE", dueDate: new Date("2026-04-20T12:00:00.000Z"), createdAt: new Date("2026-05-04T12:00:00.000Z"), paidAt: null },
    ],
    contracts: [
      { id: "contract-a", dealId: "deal-a-won", ownerId: "seller-a", status: "SENT_FOR_SIGNATURE", sentAt: new Date("2026-05-04T12:00:00.000Z"), signedAt: null, createdAt: new Date("2026-05-04T12:00:00.000Z") },
      { id: "contract-b", dealId: "deal-b-won", ownerId: "seller-b", status: "SIGNED", sentAt: new Date("2026-05-03T12:00:00.000Z"), signedAt: new Date("2026-05-04T12:00:00.000Z"), createdAt: new Date("2026-05-03T12:00:00.000Z") },
    ],
    lastClintSync: new Date("2026-05-05T10:00:00.000Z"),
  });

  assert.equal(data.summary.sellerCount, 2);
  assert.equal(data.summary.openPipelineValue, 32000);
  assert.equal(data.summary.wonDeals, 2);
  assert.equal(data.summary.wonValue, 30000);
  assert.equal(data.summary.conversionRate, 66.7);
  assert.equal(data.summary.avgDealValue, 15000);
  assert.equal(data.summary.pendingInvoiceAmount, 13000);
  assert.equal(data.summary.unassignedOpenDeals, 1);
  assert.equal(data.sellers[0].sellerName, "Alice Seller");
  assert.equal(data.sellers[0].wonValue, 20000);
  assert.equal(data.sellers[0].conversionRate, 50);
  assert.equal(data.sellers[1].sellerName, "Bruno Seller");
  assert.equal(data.sellers[1].staleOpenDeals, 1);
  assert.equal(data.sourceBreakdown[0].source, "META");
  assert.equal(data.actionQueue.staleDeals[0].sellerName, "Bruno Seller");
  assert.equal(data.actionQueue.pendingInvoices[0].openAmount, 8000);
});

test("buildCommercialBIFromRecords counts all stale deals while limiting the action queue", () => {
  const staleDeals = Array.from({ length: 11 }, (_, index) => ({
    id: `stale-${index}`,
    ownerId: "seller-a",
    title: `Stale deal ${index}`,
    value: 1000 + index,
    status: "OPEN",
    clint_deal_id: `clint-stale-${index}`,
    createdAt: new Date("2026-04-01T12:00:00.000Z"),
    updatedAt: new Date("2026-04-10T12:00:00.000Z"),
  }));

  const data = buildCommercialBIFromRecords({
    now: NOW,
    range: {
      startDate: new Date("2026-05-01T00:00:00.000Z"),
      endDate: new Date("2026-05-05T23:59:59.999Z"),
    },
    sellers: [{ id: "seller-a", name: "Alice Seller", email: "alice@example.com" }],
    leads: [],
    deals: staleDeals,
    invoices: [],
    contracts: [],
    lastClintSync: null,
  });

  assert.equal(data.summary.staleOpenDeals, 11);
  assert.equal(data.actionQueue.staleDeals.length, 10);
});

test("buildCommercialBIFromRecords attributes ownerless Clint records through commercial owner fallback", () => {
  const data = buildCommercialBIFromRecords({
    now: NOW,
    range: {
      startDate: new Date("2026-05-01T00:00:00.000Z"),
      endDate: new Date("2026-05-05T23:59:59.999Z"),
    },
    sellers: [{ id: "seller-a", name: "Alice Seller", email: "alice@example.com" }],
    leads: [
      { id: "lead-from-clint", createdById: null, commercialOwnerId: "seller-a", status: "QUALIFIED", source: "CLINT", qualificationScore: 80, createdAt: new Date("2026-05-01T12:00:00.000Z"), convertedAt: null } as any,
    ],
    deals: [
      { id: "ownerless-won", ownerId: null, commercialOwnerId: "seller-a", title: "Ownerless won", value: 0, attributedValue: 6400, status: "WON", clint_deal_id: "clint-won", createdAt: new Date("2026-05-01T12:00:00.000Z"), updatedAt: new Date("2026-05-05T12:00:00.000Z") } as any,
      { id: "ownerless-open", ownerId: null, commercialOwnerId: "seller-a", title: "Ownerless open", value: 2000, status: "OPEN", clint_deal_id: "clint-open", createdAt: new Date("2026-05-01T12:00:00.000Z"), updatedAt: new Date("2026-05-05T12:00:00.000Z") } as any,
      { id: "ownerless-lost", ownerId: null, commercialOwnerId: "seller-a", title: "Ownerless lost", value: 1200, status: "LOST", clint_deal_id: "clint-lost", createdAt: new Date("2026-05-01T12:00:00.000Z"), updatedAt: new Date("2026-05-05T12:00:00.000Z") } as any,
    ],
    invoices: [],
    contracts: [],
    lastClintSync: null,
  });

  assert.equal(data.sellers[0].leads, 1);
  assert.equal(data.sellers[0].qualifiedLeads, 1);
  assert.equal(data.sellers[0].openPipelineValue, 2000);
  assert.equal(data.sellers[0].wonValue, 6400);
  assert.equal(data.sellers[0].conversionRate, 50);
  assert.equal(data.sellers[0].clintLinkedDeals, 3);
  assert.equal(data.summary.wonValue, 6400);
  assert.equal(data.summary.unassignedOpenDeals, 0);
});

test("buildCommercialBIFromRecords segments closer performance by product and payment method", () => {
  const data = buildCommercialBIFromRecords({
    now: NOW,
    range: {
      startDate: new Date("2026-05-01T00:00:00.000Z"),
      endDate: new Date("2026-05-31T23:59:59.999Z"),
    },
    sellers: [{ id: "seller-a", name: "Alice Seller", email: "alice@example.com" }],
    leads: [],
    deals: [
      { id: "deal-pass", ownerId: "seller-a", title: "PASS Career", value: 10000, status: "WON", clint_deal_id: "clint-pass", createdAt: new Date("2026-05-01T12:00:00.000Z"), updatedAt: new Date("2026-05-05T12:00:00.000Z") },
      { id: "deal-advanced", ownerId: "seller-a", title: "ADVANCED Global", value: 20000, status: "WON", clint_deal_id: "clint-adv", createdAt: new Date("2026-05-02T12:00:00.000Z"), updatedAt: new Date("2026-05-06T12:00:00.000Z") },
    ],
    invoices: [
      { id: "inv-pass-ach", ownerId: "seller-a", dealId: "deal-pass", invoiceNumber: "P-1", amount: 10000, amountPaid: 10000, status: "PAID", dueDate: new Date("2026-05-10T12:00:00.000Z"), createdAt: new Date("2026-05-04T12:00:00.000Z"), paidAt: new Date("2026-05-05T12:00:00.000Z"), paymentMethod: "ach" } as any,
      { id: "inv-adv-card", ownerId: "seller-a", dealId: "deal-advanced", invoiceNumber: "A-1", amount: 20000, amountPaid: 15000, status: "PARTIALLY_PAID", dueDate: new Date("2026-05-20T12:00:00.000Z"), createdAt: new Date("2026-05-05T12:00:00.000Z"), paidAt: new Date("2026-05-10T12:00:00.000Z"), paymentMethod: "credit_card" } as any,
    ],
    contracts: [],
    lastClintSync: new Date("2026-05-05T10:00:00.000Z"),
  });

  assert.equal(data.closerBreakdown.length, 1);
  assert.equal(data.closerBreakdown[0].sellerName, "Alice Seller");

  const pass = data.closerBreakdown[0].products.find((item) => item.product === "PASS");
  const advanced = data.closerBreakdown[0].products.find((item) => item.product === "ADVANCED");
  assert.equal(pass?.wonDeals, 1);
  assert.equal(pass?.wonValue, 10000);
  assert.equal(advanced?.wonDeals, 1);
  assert.equal(advanced?.wonValue, 20000);

  const ach = data.closerBreakdown[0].paymentMethods.find((item) => item.method === "ACH");
  const card = data.closerBreakdown[0].paymentMethods.find((item) => item.method === "CARD");
  assert.equal(ach?.paidAmount, 10000);
  assert.equal(card?.paidAmount, 15000);
});
