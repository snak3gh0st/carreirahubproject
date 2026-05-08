import test from "node:test";
import assert from "node:assert/strict";

import {
  AI_HUBS,
  getAiHubBySlug,
  getAiHubForRole,
  getAiRouteForRole,
} from "../../lib/ai/hub-config.ts";

test("getAiHubForRole maps finance to financial", () => {
  assert.equal(getAiHubForRole("FINANCE")?.slug, "financial");
  assert.equal(getAiHubForRole("FINANCE")?.label, "Financeiro AI");
});

test("getAiHubForRole maps sales family to commercial", () => {
  assert.equal(getAiHubForRole("SALES")?.slug, "commercial");
  assert.equal(getAiHubForRole("SDR")?.slug, "commercial");
  assert.equal(getAiHubForRole("COMMERCIAL")?.slug, "commercial");
  assert.equal(getAiHubForRole("HEAD_COMERCIAL")?.slug, "commercial");
});

test("getAiHubForRole maps support family to operational", () => {
  assert.equal(getAiHubForRole("OPERATIONAL")?.slug, "operational");
  assert.equal(getAiHubForRole("SUPPORT")?.slug, "operational");
});

test("getAiHubForRole maps admin to admin_executive", () => {
  assert.equal(getAiHubForRole("ADMIN")?.slug, "admin");
});

test("getAiRouteForRole returns the canonical hub routes", () => {
  assert.equal(getAiRouteForRole("FINANCE"), "/dashboard/financial/ai");
  assert.equal(getAiRouteForRole("SALES"), "/dashboard/commercial/ai");
  assert.equal(getAiRouteForRole("HEAD_COMERCIAL"), "/dashboard/commercial/ai");
  assert.equal(getAiRouteForRole("ADMIN"), "/dashboard/admin/ai");
});

test("AI_HUBS expose starter prompts and lookup by slug works", () => {
  assert.equal(AI_HUBS.FINANCIAL.label, "Financeiro AI");
  assert.equal(AI_HUBS.ADMIN_EXECUTIVE.label, "Admin AI");
  assert.ok(AI_HUBS.ADMIN_EXECUTIVE.starterPrompts.length >= 3);
  assert.equal(getAiHubBySlug("admin")?.slug, "admin");
  assert.equal(getAiHubBySlug("operational")?.slug, "operational");
});

test("unknown role or slug returns null", () => {
  assert.equal(getAiHubForRole("UNKNOWN"), null);
  assert.equal(getAiHubForRole("__proto__"), null);
  assert.equal(getAiHubBySlug("unknown"), null);
  assert.equal(getAiHubBySlug("__proto__"), null);
  assert.equal(getAiRouteForRole("UNKNOWN"), null);
  assert.equal(getAiRouteForRole("__proto__"), null);
});
