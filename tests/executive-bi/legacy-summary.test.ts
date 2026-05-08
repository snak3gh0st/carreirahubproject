import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLegacyExecutiveCards,
  buildLegacyWindowParams,
  type LegacyExecutiveCard,
} from "../../lib/executive-bi/legacy-summary";
import type { ExecutiveBIResponse } from "../../lib/types/executive-bi";

const sampleExecutiveResponse: ExecutiveBIResponse = {
  overview: {
    briefing: "AR risk is rising.",
    health: {
      revenue: 94000,
      cashOnHand: 120000,
      openAr: 27000,
      overdueAr: 18000,
      collectionsRate: 72.4,
    },
    decisionQueue: [],
    freshness: { state: "fresh", summary: "Finance updated 12 min ago" },
  },
  areas: {
    finance: {
      label: "Finance",
      status: "risk",
      summary: "Collections pressure is rising.",
      freshness: { state: "fresh", summary: "Finance updated 12 min ago" },
      href: "/dashboard/bi?area=finance",
    },
    sales: {
      label: "Commercial & Clients",
      status: "watch",
      summary: "Pipeline is softer this week.",
      freshness: { state: "partial", summary: "Sales is partially refreshed" },
      href: "/dashboard/bi?area=sales",
    },
    operations: {
      label: "Operations",
      status: "good",
      summary: "Delivery is stable.",
      freshness: { state: "partial", summary: "Operations is partially refreshed" },
      href: "/dashboard/bi?area=operations",
    },
    ai: {
      label: "AI",
      status: "watch",
      summary: "Recent AI issues need review.",
      freshness: { state: "fresh", summary: "AI updated" },
      href: "/dashboard/bi?area=ai",
    },
  },
  areaDetails: {
    finance: { area: "finance", summary: "Collections pressure is rising.", bullets: [] },
    sales: { area: "sales", summary: "Pipeline is softer this week.", bullets: [] },
    operations: { area: "operations", summary: "Delivery is stable.", bullets: [] },
    ai: { area: "ai", summary: "Recent AI issues need review.", bullets: [] },
  },
};

test("buildLegacyExecutiveCards maps canonical executive KPIs into legacy-friendly cards", () => {
  const cards = buildLegacyExecutiveCards(sampleExecutiveResponse);

  assert.equal(cards[0]?.label, "Revenue");
  assert.equal(cards[0]?.value, "$94,000");
  assert.equal(cards[3]?.label, "Overdue AR");
  assert.equal(cards[3]?.value, "$18,000");
});

test("buildLegacyWindowParams preserves the same date window across cockpit and legacy pages", () => {
  assert.equal(
    buildLegacyWindowParams("custom", "2026-04-01", "2026-05-01"),
    "dateRange=custom&from=2026-04-01&to=2026-05-01",
  );
});

test("legacy executive cards expose stable labels in cockpit order", () => {
  const cards: LegacyExecutiveCard[] = [
    { label: "Revenue", value: "$94,000", helper: "Canonical QuickBooks revenue" },
    { label: "Cash On Hand", value: "$120,000", helper: "Canonical executive liquidity" },
    { label: "Open AR", value: "$27,000", helper: "Canonical receivables outstanding" },
    { label: "Overdue AR", value: "$18,000", helper: "Canonical overdue receivables" },
    { label: "Collections Rate", value: "72.4%", helper: "Canonical collection performance" },
  ];

  assert.deepEqual(cards.map((card) => card.label), [
    "Revenue",
    "Cash On Hand",
    "Open AR",
    "Overdue AR",
    "Collections Rate",
  ]);
});
