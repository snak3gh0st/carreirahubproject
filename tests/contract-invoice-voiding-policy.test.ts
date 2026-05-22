import test from "node:test";
import assert from "node:assert/strict";

import { shouldVoidInvoiceForContractFailure } from "../lib/invoices/contract-invoice-policy";

test("shouldVoidInvoiceForContractFailure preserves invoices that are already paid", () => {
  assert.equal(
    shouldVoidInvoiceForContractFailure({
      status: "PAID",
      amount: 375,
      amountPaid: 375,
      paidAt: new Date("2026-05-06T00:00:00.000Z"),
    }),
    false
  );
});

test("shouldVoidInvoiceForContractFailure preserves invoices with full payment even if status drifted", () => {
  assert.equal(
    shouldVoidInvoiceForContractFailure({
      status: "VOID",
      amount: 375,
      amountPaid: 375,
      paidAt: new Date("2026-05-06T00:00:00.000Z"),
    }),
    false
  );
});

test("shouldVoidInvoiceForContractFailure voids open unpaid invoices", () => {
  assert.equal(
    shouldVoidInvoiceForContractFailure({
      status: "SENT",
      amount: 375,
      amountPaid: 0,
      paidAt: null,
    }),
    true
  );
});
