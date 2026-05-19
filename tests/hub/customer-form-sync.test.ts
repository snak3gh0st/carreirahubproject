import assert from "node:assert/strict";
import test from "node:test";

import { deriveCustomerUpdatesFromFormAnswers } from "../../lib/hub/customer-form-sync";

test("deriveCustomerUpdatesFromFormAnswers maps onboarding identity fields", () => {
  const updates = deriveCustomerUpdatesFromFormAnswers({
    fullName: "  Maria Silva  ",
    dob: "1990-03-12",
    phone: " +1 555 123 4567 ",
    address: "  123 Main St, Orlando, FL 32801 ",
    desiredRole: "Product Manager",
  });

  assert.deepEqual(updates, {
    name: "Maria Silva",
    dateOfBirth: new Date("1990-03-12T12:00:00.000Z"),
    phone: "+1 555 123 4567",
    address: "123 Main St, Orlando, FL 32801",
  });
});

test("deriveCustomerUpdatesFromFormAnswers ignores empty or invalid values", () => {
  const updates = deriveCustomerUpdatesFromFormAnswers({
    fullName: "",
    dob: "not-a-date",
    phone: null,
    address: "   ",
  });

  assert.deepEqual(updates, {});
});
