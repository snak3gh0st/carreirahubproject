import test from "node:test";
import assert from "node:assert/strict";

import { buildCustomerPaymentTrends, buildPatternAlerts } from "../lib/financial/cfo-signals";

test("buildCustomerPaymentTrends detects consecutive slowing payment behavior", () => {
  const trends = buildCustomerPaymentTrends([
    { customerId: "c1", customerName: "Acme", issuedAt: new Date("2026-01-01"), paidAt: new Date("2026-01-06") },
    { customerId: "c1", customerName: "Acme", issuedAt: new Date("2026-02-01"), paidAt: new Date("2026-02-11") },
    { customerId: "c1", customerName: "Acme", issuedAt: new Date("2026-03-01"), paidAt: new Date("2026-03-16") },
    { customerId: "c1", customerName: "Acme", issuedAt: new Date("2026-04-01"), paidAt: new Date("2026-04-21") },
    { customerId: "c2", customerName: "Stable Co", issuedAt: new Date("2026-01-01"), paidAt: new Date("2026-01-08") },
    { customerId: "c2", customerName: "Stable Co", issuedAt: new Date("2026-02-01"), paidAt: new Date("2026-02-08") },
  ]);

  assert.equal(trends.length, 1);
  assert.equal(trends[0]?.customerName, "Acme");
  assert.equal(trends[0]?.currentAvgDays, 20);
  assert.equal(trends[0]?.previousAvgDays, 15);
  assert.equal(trends[0]?.consecutiveSlowing, 3);
});

test("buildPatternAlerts summarizes the highest-signal CFO warnings", () => {
  const alerts = buildPatternAlerts({
    collectionRateChange: -6.4,
    aging90PlusAmount: 12500,
    worstOverdue: { customer: "Acme", amount: 8200, days: 67 },
    customerPaymentTrends: [
      {
        customerId: "c1",
        customerName: "Acme",
        currentAvgDays: 20,
        previousAvgDays: 15,
        consecutiveSlowing: 3,
      },
    ],
  });

  assert.deepEqual(alerts, [
    "Collection rate fell 6.4 points versus the prior period.",
    "AR over 90 days is $12,500.",
    "Acme has the worst overdue balance at $8,200 and is 67 days late.",
    "Acme payment speed has slowed to 20 days from 15 days over 3 consecutive months.",
  ]);
});
