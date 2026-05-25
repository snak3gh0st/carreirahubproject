import assert from "node:assert/strict";

import { splitEntryAndRegularInvoices } from "../lib/invoices/contract-payment-plan";

const noEntrySeries = [
  {
    invoiceNumber: "DDO-PP-260522-I1-AH2",
    installments: { isFirstInstallment: true, current: 1, total: 6 },
    lineItems: [{ description: "Programa Pass - Installment 1 of 6" }],
  },
  {
    invoiceNumber: "DDO-PP-260522-I2-Y1G",
    installments: { isFirstInstallment: false, current: 2, total: 6 },
    lineItems: [{ description: "Programa Pass - Installment 2 of 6" }],
  },
];

const noEntryParts = splitEntryAndRegularInvoices(noEntrySeries);
assert.equal(
  noEntryParts.entryInvoice,
  null,
  "a first installment is not an entry payment unless the invoice explicitly says entry"
);
assert.equal(noEntryParts.regularInvoices.length, 2);

const entrySeries = [
  {
    invoiceNumber: "ABC-PP-ENTRY",
    installments: { isFirstInstallment: true, current: 1, total: 6 },
    lineItems: [{ description: "Programa Pass - Entry Payment" }],
  },
  {
    invoiceNumber: "ABC-PP-I1",
    installments: { isFirstInstallment: false, current: 2, total: 6 },
    lineItems: [{ description: "Programa Pass - Installment 1 of 5" }],
  },
];

const entryParts = splitEntryAndRegularInvoices(entrySeries);
assert.equal(entryParts.entryInvoice?.invoiceNumber, "ABC-PP-ENTRY");
assert.equal(entryParts.regularInvoices.length, 1);

const explicitEntryParts = splitEntryAndRegularInvoices([
  {
    invoiceNumber: "META-ENTRY",
    installments: { isEntryPayment: true, isFirstInstallment: true },
    lineItems: [{ description: "Programa Pass - Installment 1 of 6" }],
  },
]);
assert.equal(explicitEntryParts.entryInvoice?.invoiceNumber, "META-ENTRY");

console.log("contract-payment-plan.test.ts passed");
