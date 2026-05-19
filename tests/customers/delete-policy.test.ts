import assert from "node:assert/strict";
import test from "node:test";

import { validateCustomerDeleteConfirmation } from "../../lib/customers/delete-policy";

test("validateCustomerDeleteConfirmation requires exact customer name", () => {
  assert.equal(
    validateCustomerDeleteConfirmation("Maria Silva", "Maria Silva").allowed,
    true
  );

  const result = validateCustomerDeleteConfirmation("Maria Silva", "maria silva");

  assert.equal(result.allowed, false);
  assert.match(result.reason ?? "", /nome do cliente/i);
});
