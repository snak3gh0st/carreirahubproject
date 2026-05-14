import assert from "node:assert/strict";
import test from "node:test";

import {
  HUB_LINKS,
  buildHubRedirectUrl,
  buildSafeCallbackUrl,
  getHubLink,
} from "../lib/hub-links";

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

test("builds hub redirects from forwarded public host before container host", () => {
  const headers = new Headers({
    "x-forwarded-host": "app.carreirausa.com",
    "x-forwarded-proto": "https",
    host: "0.0.0.0:3000",
  });

  assert.equal(
    buildHubRedirectUrl("/hub/login", "https://0.0.0.0:3000/hubs/cliente", headers).toString(),
    "https://app.carreirausa.com/hub/login"
  );
});

test("falls back to configured public base when only container host is available", () => {
  const headers = new Headers({
    host: "0.0.0.0:3000",
  });

  assert.equal(
    buildHubRedirectUrl(
      "/dashboard/financial",
      "https://0.0.0.0:3000/hubs/financeiro",
      headers,
      "https://app.carreirausa.com"
    ).toString(),
    "https://app.carreirausa.com/dashboard/financial"
  );
});
