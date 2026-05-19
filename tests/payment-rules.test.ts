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
assert.equal(materialIProduct.paymentRule, "FLEXIBLE");
assert.equal(materialIIProduct.qbItemId, "97");
assert.equal(materialIIProduct.officialPrice, 1500);
assert.equal(materialIIProduct.paymentRule, "FLEXIBLE");

// Mentoria: keeps preset rule, max 12x
const mentoriaPolicy = getPaymentPolicyForProducts([mentoriaProduct]);
assert.equal(mentoriaPolicy.paymentRule, "MENTORIA_PRESET");
assert.equal(mentoriaPolicy.maxInstallments, 12, "mentoria should allow up to 12 installments");

assert.doesNotThrow(() =>
  validatePaymentSelection({
    products: [mentoriaProduct],
    entryAmount: 0,
    installments: 12,
    totalAmount: 3000,
  })
);

assert.doesNotThrow(() =>
  validatePaymentSelection({
    products: [mentoriaProduct],
    entryAmount: 900,
    installments: 11,
    totalAmount: 3000,
  })
);

assert.throws(
  () =>
    validatePaymentSelection({
      products: [mentoriaProduct],
      entryAmount: 900,
      installments: 12,
      totalAmount: 3000,
    }),
  /entrada conta como primeira parcela|máximo de 11 parcelas/i
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

// Combo: now FLEXIBLE — accepts any 1..12x
const comboPolicy = getPaymentPolicyForProducts([comboProduct]);
assert.equal(comboPolicy.paymentRule, "FLEXIBLE");
assert.equal(comboPolicy.maxInstallments, 12);

assert.doesNotThrow(
  () =>
    validatePaymentSelection({
      products: [comboProduct],
      entryAmount: 0,
      installments: 3,
      totalAmount: 1050,
    }),
  "combo should now allow more than 2 installments"
);

assert.throws(
  () =>
    validatePaymentSelection({
      products: [comboProduct],
      entryAmount: 0,
      installments: 13,
      totalAmount: 1050,
    }),
  /máximo de 12 parcelas/i
);

// Avulso (any value, including under the old $600 threshold): now installable
const avulsoSmallPolicy = getPaymentPolicyForProducts(
  [analiseGravadaProduct, inglesProduct],
  387
);
assert.equal(
  avulsoSmallPolicy.paymentRule,
  "FLEXIBLE",
  "avulso carts of any value should be installable"
);
assert.equal(avulsoSmallPolicy.maxInstallments, 12);

assert.doesNotThrow(() =>
  validatePaymentSelection({
    products: [analiseGravadaProduct, inglesProduct],
    entryAmount: 0,
    installments: 3,
    totalAmount: 387,
  })
);

// No min-per-installment: a $90 service split in 12x ($7.50 each) is now valid
assert.doesNotThrow(() =>
  validatePaymentSelection({
    products: [inglesProduct],
    entryAmount: 0,
    installments: 12,
    totalAmount: 90,
  })
);

// Larger avulso cart still works at full 12x
const avulsoLargePolicy = getPaymentPolicyForProducts(
  [analiseGravadaProduct, analiseVagasProduct, inglesProduct],
  684
);
assert.equal(avulsoLargePolicy.paymentRule, "FLEXIBLE");
assert.equal(avulsoLargePolicy.maxInstallments, 12);

assert.doesNotThrow(() =>
  validatePaymentSelection({
    products: [analiseGravadaProduct, analiseVagasProduct, inglesProduct],
    entryAmount: 0,
    installments: 12,
    totalAmount: 684,
  })
);

// Empty cart: null rule, default cap 12
const emptyPolicy = getPaymentPolicyForProducts([]);
assert.equal(emptyPolicy.paymentRule, null);
assert.equal(emptyPolicy.maxInstallments, 12);

console.log("payment-rules.test.ts passed");
