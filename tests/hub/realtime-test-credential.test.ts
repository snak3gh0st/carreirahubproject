import assert from "node:assert/strict";
import test from "node:test";

import {
  getRealtimeHubTestCredentials,
  isRealtimeTestLoginAllowed,
} from "../../lib/hub/realtime-test-credential";

test("getRealtimeHubTestCredentials returns stable default local credentials", () => {
  const credentials = getRealtimeHubTestCredentials({});

  assert.equal(credentials.email, "realtime.voice.test@clientscarreira.test");
  assert.equal(credentials.password, "CarreiraRealtime!2026");
  assert.equal(credentials.name, "Realtime Voice Test Student");
});

test("isRealtimeTestLoginAllowed permits localhost outside production", () => {
  assert.equal(
    isRealtimeTestLoginAllowed({
      host: "localhost:3001",
      token: null,
      env: { NODE_ENV: "development" },
    }),
    true
  );
});

test("isRealtimeTestLoginAllowed blocks production unless enabled with matching token", () => {
  assert.equal(
    isRealtimeTestLoginAllowed({
      host: "app.carreirausa.com",
      token: "secret",
      env: {
        NODE_ENV: "production",
        HUB_REALTIME_TEST_LOGIN_ENABLED: "false",
        HUB_REALTIME_TEST_LOGIN_SECRET: "secret",
      },
    }),
    false
  );

  assert.equal(
    isRealtimeTestLoginAllowed({
      host: "app.carreirausa.com",
      token: "secret",
      env: {
        NODE_ENV: "production",
        HUB_REALTIME_TEST_LOGIN_ENABLED: "true",
        HUB_REALTIME_TEST_LOGIN_SECRET: "secret",
      },
    }),
    true
  );
});
