import assert from "node:assert/strict";
import test from "node:test";

import { HUB_LINKS, buildSafeCallbackUrl, getHubLink } from "../lib/hub-links";

test("defines stable public hub links", () => {
  assert.equal(HUB_LINKS.operacional.path, "/ops");
  assert.equal(HUB_LINKS.comercial.path, "/dashboard");
  assert.equal(HUB_LINKS.financeiro.path, "/dashboard/financial");
  assert.equal(HUB_LINKS.executivo.path, "/dashboard/executive");
  assert.equal(HUB_LINKS.admin.path, "/dashboard");
  assert.equal(HUB_LINKS.cliente.path, "/hub/login");
});

test("resolves only known hub slugs", () => {
  assert.equal(getHubLink("financeiro")?.label, "Hub Financeiro");
  assert.equal(getHubLink("cliente")?.label, "Hub do Cliente");
  assert.equal(getHubLink("Financeiro"), null);
  assert.equal(getHubLink("clientscarreira"), null);
});

test("keeps sign-in callback urls internal", () => {
  assert.equal(buildSafeCallbackUrl("/dashboard/executive"), "/dashboard/executive");
  assert.equal(buildSafeCallbackUrl("/ops"), "/ops");
  assert.equal(buildSafeCallbackUrl("/hub/login"), "/hub/login");
  assert.equal(buildSafeCallbackUrl("https://evil.example/dashboard"), "/dashboard");
  assert.equal(buildSafeCallbackUrl("//evil.example/dashboard"), "/dashboard");
  assert.equal(buildSafeCallbackUrl(null), "/dashboard");
});
