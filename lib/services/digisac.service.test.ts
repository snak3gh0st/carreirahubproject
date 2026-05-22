import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDigisacPhone,
  getDigisacPhoneCandidates,
  isMatchingDigisacPhone,
} from "./digisac.service";

test("formats Brazilian 11-digit mobile numbers with country code 55", () => {
  assert.equal(formatDigisacPhone("11999999999", "55"), "5511999999999");
});

test("does not treat Brazilian area code 11 as a US country code", () => {
  assert.equal(isMatchingDigisacPhone("11999999999", "15599999999", "55"), false);
  assert.equal(isMatchingDigisacPhone("11999999999", "5511999999999", "55"), true);
});

test("keeps explicit country-code numbers unchanged", () => {
  assert.deepEqual(getDigisacPhoneCandidates("+1 (954) 555-0199", "55"), [
    "19545550199",
  ]);
});

test("supports US 10-digit numbers when default country is 1", () => {
  assert.equal(formatDigisacPhone("(954) 555-0199", "1"), "19545550199");
  assert.equal(isMatchingDigisacPhone("(954) 555-0199", "19545550199", "1"), true);
});
