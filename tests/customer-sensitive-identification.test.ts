import assert from "node:assert/strict";
import test from "node:test";

import {
  maskSensitiveIdentification,
  normalizeSsnLast4,
  sanitizeOperationalCustomerIdentification,
} from "../lib/customers/sensitive-identification";

test("normalizeSsnLast4 keeps only the final four digits", () => {
  assert.equal(normalizeSsnLast4("123-45-6789"), "6789");
  assert.equal(normalizeSsnLast4("9876"), "9876");
  assert.equal(normalizeSsnLast4(" 12 "), "12");
  assert.equal(normalizeSsnLast4("abc"), undefined);
});

test("maskSensitiveIdentification shows only the final four digits", () => {
  assert.equal(maskSensitiveIdentification("123-45-6789"), "**** 6789");
  assert.equal(maskSensitiveIdentification("6789"), "**** 6789");
  assert.equal(maskSensitiveIdentification(null), null);
});

test("sanitizeOperationalCustomerIdentification removes identity documents from operational payloads", () => {
  const customer = {
    id: "cus_1",
    name: "Maria",
    ssn: "123-45-6789",
    cpf: "000.000.000-00",
    passport: "AB123456",
  };

  assert.deepEqual(sanitizeOperationalCustomerIdentification(customer), {
    id: "cus_1",
    name: "Maria",
  });
});
