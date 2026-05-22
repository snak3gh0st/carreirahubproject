import test from "node:test";
import assert from "node:assert/strict";

import { getPaymentStatusDisplay } from "../components/invoices/payment-status-card";

test("getPaymentStatusDisplay treats void paid invoices as paid reconciliation state", () => {
  assert.deepEqual(
    getPaymentStatusDisplay({
      status: "VOID" as any,
      amount: 375,
      amountPaid: 375,
      paidAt: new Date("2026-05-06T00:00:00.000Z"),
      daysUntilDue: -15,
    }),
    {
      label: "Pago",
      badgeClass: "bg-green-100 text-green-800",
      isPaid: true,
      isOverdue: false,
      isVoid: true,
    }
  );
});

test("getPaymentStatusDisplay treats unpaid void invoices as anulada", () => {
  assert.deepEqual(
    getPaymentStatusDisplay({
      status: "VOID" as any,
      amount: 375,
      amountPaid: 0,
      paidAt: null,
      daysUntilDue: -15,
    }),
    {
      label: "Anulada",
      badgeClass: "bg-gray-100 text-gray-700",
      isPaid: false,
      isOverdue: false,
      isVoid: true,
    }
  );
});
