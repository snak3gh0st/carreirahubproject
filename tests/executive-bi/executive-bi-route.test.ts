import test from "node:test";
import assert from "node:assert/strict";

import { createExecutiveBIGetHandler } from "../../app/api/analytics/executive-bi/route-handler";
import type { ExecutiveBIResponse } from "../../lib/types/executive-bi";

const sampleExecutiveResponse: ExecutiveBIResponse = {
  overview: {
    briefing: "Executive BI ready",
    health: {
      revenue: 94000,
      cashOnHand: 120000,
      openAr: 27000,
      overdueAr: 18000,
      collectionsRate: 72.4,
    },
    decisionQueue: [],
    freshness: { state: "fresh", summary: "All executive domains are fresh." },
  },
  areas: {
    finance: {
      label: "Finance",
      status: "good",
      summary: "Finance summary",
      freshness: { state: "fresh", summary: "Finance updated" },
      href: "/dashboard/bi?area=finance",
    },
    sales: {
      label: "Commercial & Clients",
      status: "good",
      summary: "Sales summary",
      freshness: { state: "fresh", summary: "Sales updated" },
      href: "/dashboard/bi?area=sales",
    },
    operations: {
      label: "Operations",
      status: "good",
      summary: "Operations summary",
      freshness: { state: "fresh", summary: "Operations updated" },
      href: "/dashboard/bi?area=operations",
    },
    ai: {
      label: "AI",
      status: "good",
      summary: "AI summary",
      freshness: { state: "fresh", summary: "AI updated" },
      href: "/dashboard/bi?area=ai",
    },
  },
  areaDetails: {
    finance: { area: "finance", summary: "Finance detail", bullets: [] },
    sales: { area: "sales", summary: "Sales detail", bullets: [] },
    operations: { area: "operations", summary: "Operations detail", bullets: [] },
    ai: { area: "ai", summary: "AI detail", bullets: [] },
  },
};

test("executive BI route returns 401 when no session exists", async () => {
  const handler = createExecutiveBIGetHandler({
    getSession: async () => null,
    getData: async () => {
      throw new Error("should not be called");
    },
  });

  const response = await handler(new Request("https://example.com/api/analytics/executive-bi"));
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.deepEqual(body, { error: "Unauthorized" });
});

test("executive BI route returns 403 when role is not allowed", async () => {
  const handler = createExecutiveBIGetHandler({
    getSession: async () => ({
      user: { id: "user_1", role: "SELLER" },
    }),
    getData: async () => {
      throw new Error("should not be called");
    },
  });

  const response = await handler(new Request("https://example.com/api/analytics/executive-bi"));
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.deepEqual(body, { error: "Forbidden" });
});

test("executive BI route returns 200 for allowed roles and forwards date params", async () => {
  let receivedOptions: unknown;

  const handler = createExecutiveBIGetHandler({
    getSession: async () => ({
      user: { id: "user_2", role: "FINANCE" },
    }),
    getData: async (options) => {
      receivedOptions = options;
      return sampleExecutiveResponse;
    },
  });

  const response = await handler(
    new Request(
      "https://example.com/api/analytics/executive-bi?dateRange=custom&from=2026-04-01&to=2026-05-01",
    ),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(receivedOptions, {
    dateRange: "custom",
    from: "2026-04-01",
    to: "2026-05-01",
  });
  assert.equal(body.overview.briefing, "Executive BI ready");
});

test("executive BI route defaults dateRange to last30", async () => {
  let receivedOptions: unknown;

  const handler = createExecutiveBIGetHandler({
    getSession: async () => ({
      user: { id: "user_3", role: "ADMIN" },
    }),
    getData: async (options) => {
      receivedOptions = options;
      return {
        ...sampleExecutiveResponse,
        overview: {
          ...sampleExecutiveResponse.overview,
          briefing: "Default window",
        },
      };
    },
  });

  const response = await handler(new Request("https://example.com/api/analytics/executive-bi"));

  assert.equal(response.status, 200);
  assert.deepEqual(receivedOptions, {
    dateRange: "last30",
    from: undefined,
    to: undefined,
  });
});
