import assert from "node:assert/strict";

import {
  getPaymentPolicyForProducts,
  validatePaymentSelection,
} from "../lib/invoices/payment-rules";
import { CARREIRA_CATALOG } from "../lib/constants/carreira-products";

const mentoriaProduct = CARREIRA_CATALOG.find((product) => product.id === "mentoria-pass");
const comboProduct = CARREIRA_CATALOG.find((product) => product.id === "combo-pass");
const materialIProduct = CARREIRA_CATALOG.find((product) => product.id === "combo-material-i");
const materialIIProduct = CARREIRA_CATALOG.find((product) => product.id === "combo-material-ii");
const analiseGravadaProduct = CARREIRA_CATALOG.find((product) => product.id === "avulso-analise-gravada");
const analiseVagasProduct = CARREIRA_CATALOG.find((product) => product.id === "avulso-analise-vagas");
const inglesProduct = CARREIRA_CATALOG.find((product) => product.id === "avulso-ingles");
const negociacaoProduct = CARREIRA_CATALOG.find((product) => product.id === "avulso-negociacao");

assert.ok(mentoriaProduct, "mentoria-pass should exist in the catalog");
assert.ok(comboProduct, "combo-pass should exist in the catalog");
assert.ok(materialIProduct, "combo-material-i should exist in the catalog");
assert.ok(materialIIProduct, "combo-material-ii should exist in the catalog");
assert.ok(analiseGravadaProduct, "avulso-analise-gravada should exist in the catalog");
assert.ok(analiseVagasProduct, "avulso-analise-vagas should exist in the catalog");
assert.ok(inglesProduct, "avulso-ingles should exist in the catalog");
assert.ok(negociacaoProduct, "avulso-negociacao should exist in the catalog");
assert.equal(analiseGravadaProduct.qbItemId, "60");
assert.equal(analiseVagasProduct.qbItemId, "69");
assert.equal(CARREIRA_CATALOG.find((product) => product.id === "avulso-bussola")?.qbItemId, "68");
assert.equal(CARREIRA_CATALOG.find((product) => product.id === "avulso-mock")?.qbItemId, "67");
assert.equal(inglesProduct.qbItemId, "94");
assert.equal(negociacaoProduct.qbItemId, "63");
assert.equal(materialIProduct.qbItemId, "96");
assert.equal(materialIProduct.officialPrice, 950);
assert.equal(materialIProduct.paymentRule, "MAX_2X_MIN_300");
assert.equal(materialIIProduct.qbItemId, "97");
assert.equal(materialIIProduct.officialPrice, 1500);
assert.equal(materialIIProduct.paymentRule, "MAX_2X_MIN_300");

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

const avulsoAboveThresholdPolicy = getPaymentPolicyForProducts(
  [analiseGravadaProduct, analiseVagasProduct, inglesProduct],
  684
);
assert.equal(
  avulsoAboveThresholdPolicy.paymentRule,
  "MAX_2X_MIN_300",
  "avulso carts above $600 should allow the 2x minimum-$300 rule"
);
assert.equal(avulsoAboveThresholdPolicy.maxInstallments, 2);

assert.doesNotThrow(() =>
  validatePaymentSelection({
    products: [analiseGravadaProduct, analiseVagasProduct, inglesProduct],
    entryAmount: 0,
    installments: 2,
    totalAmount: 684,
  })
);

const avulsoAtThresholdPolicy = getPaymentPolicyForProducts([analiseGravadaProduct, inglesProduct], 387);
assert.equal(
  avulsoAtThresholdPolicy.paymentRule,
  "AVISTA_ONLY",
  "avulso carts at or below $600 should remain a vista"
);

console.log("payment-rules.test.ts passed");
