import test from "node:test";
import assert from "node:assert/strict";

import { buildInactiveCustomerAlertRows } from "../lib/services/alerts.service";

test("buildInactiveCustomerAlertRows skips customers with active churn alerts", () => {
  const now = new Date("2026-05-15T20:00:00.000Z");
  const rows = buildInactiveCustomerAlertRows({
    ruleId: "rule-1",
    now,
    customers: [
      { id: "customer-1", name: "Existing Alert", email: "existing@example.com" },
      { id: "customer-2", name: "No Invoice", email: "never@example.com" },
      { id: "customer-3", name: "Old Invoice", email: "old@example.com" },
    ],
    existingAlertCustomerIds: new Set(["customer-1"]),
    lastInvoiceByCustomerId: new Map([
      ["customer-3", new Date("2026-01-15T20:00:00.000Z")],
    ]),
  });

  assert.deepEqual(
    rows.map((row) => ({
      title: row.title,
      customerId: row.customerId,
      data: row.data,
    })),
    [
      {
        title: "Inactive Customer: No Invoice",
        customerId: "customer-2",
        data: {
          customerName: "No Invoice",
          customerEmail: "never@example.com",
          daysSinceActivity: null,
        },
      },
      {
        title: "Inactive Customer: Old Invoice",
        customerId: "customer-3",
        data: {
          customerName: "Old Invoice",
          customerEmail: "old@example.com",
          daysSinceActivity: 120,
        },
      },
    ],
  );
});
