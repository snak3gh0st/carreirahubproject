import assert from "node:assert/strict";

import {
  getPaymentPolicyForProducts,
  validatePaymentSelection,
} from "../lib/invoices/payment-rules";
import { CARREIRA_CATALOG } from "../lib/constants/carreira-products";

const mentoriaProduct = CARREIRA_CATALOG.find((product) => product.id === "mentoria-pass");
const comboProduct = CARREIRA_CATALOG.find((product) => product.id === "combo-pass");

assert.ok(mentoriaProduct, "mentoria-pass should exist in the catalog");
assert.ok(comboProduct, "combo-pass should exist in the catalog");

const mentoriaPolicy = getPaymentPolicyForProducts([mentoriaProduct]);
assert.equal(mentoriaPolicy.maxInstallments, 12, "mentoria should allow up to 12 installments");

assert.doesNotThrow(() =>
  validatePaymentSelection({
    products: [mentoriaProduct],
    entryAmount: 0,
    installments: 12,
    totalAmount: 3000,
  })
);

assert.throws(
  () =>
    validatePaymentSelection({
      products: [mentoriaProduct],
      entryAmount: 0,
      installments: 13,
      totalAmount: 3000,
    }),
  /máximo de 12 parcelas/i
);

assert.throws(
  () =>
    validatePaymentSelection({
      products: [comboProduct],
      entryAmount: 0,
      installments: 3,
      totalAmount: 1050,
    }),
  /máximo de 2 parcelas/i
);

console.log("payment-rules.test.ts passed");
