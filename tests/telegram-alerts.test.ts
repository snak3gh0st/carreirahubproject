import assert from "node:assert/strict";
import test from "node:test";

import { buildTelegramErrorMessage } from "@/lib/utils/telegram-alerts";

test("buildTelegramErrorMessage includes structured failure context", () => {
  const error = Object.assign(new Error("QuickBooks request failed"), {
    name: "QuickBooksError",
    code: "AUTH_FAILED",
    status: 401,
    response: {
      status: 401,
      data: {
        fault: {
          type: "AUTH",
          detail: "Token expired",
        },
      },
    },
    cause: new Error("Refresh token missing"),
  });

  const text = buildTelegramErrorMessage("Webhook QuickBooks/WEBHOOK_ERROR", error, {
    Route: "/api/webhooks/quickbooks",
    Method: "POST",
    Service: "QuickBooks",
    Payload: {
      eventId: "evt_123",
      realmId: "realm_456",
    },
  });

  assert.match(text, /ERROR/);
  assert.match(text, /Webhook QuickBooks\/WEBHOOK_ERROR/);
  assert.match(text, /QuickBooks request failed/);
  assert.match(text, /QuickBooksError/);
  assert.match(text, /AUTH_FAILED/);
  assert.match(text, /401/);
  assert.match(text, /Refresh token missing/);
  assert.match(text, /\/api\/webhooks\/quickbooks/);
  assert.match(text, /realm_456/);
});

test("buildTelegramErrorMessage truncates bulky values", () => {
  const hugeBody = "x".repeat(1200);

  const text = buildTelegramErrorMessage("Cron auto-charge-invoices", new Error("Body too large"), {
    Response: hugeBody,
  });

  assert.match(text, /Body too large/);
  assert.ok(text.length < 4096, "telegram messages must stay under the API limit");
  assert.match(text, /\.\.\./);
});
