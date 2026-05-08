import test from "node:test";
import assert from "node:assert/strict";

import {
  FINANCIAL_HUB_EXCLUDED_CUSTOMER_EMAILS,
  buildNullableCustomerIdExclusionWhere,
  buildFinancialHubInvoiceWhere,
  filterFinancialHubExcludedCustomers,
  isFinancialHubExcludedCustomer,
} from "../lib/financial/hub-exclusions";

test("financial hub exclusion list covers the written-off customer cohort", () => {
  assert.equal(FINANCIAL_HUB_EXCLUDED_CUSTOMER_EMAILS.length, 32);
  assert.equal(new Set(FINANCIAL_HUB_EXCLUDED_CUSTOMER_EMAILS).size, 32);

  assert.equal(
    isFinancialHubExcludedCustomer({
      name: "Joao Vicente Gaido Junior",
      email: "jvgaidojunior@gmail.com",
    }),
    true,
  );
  assert.equal(
    isFinancialHubExcludedCustomer({
      name: "Cecilia Carolina Pereira Guimaraes",
      email: "carolinaceciliausa@outlook.com",
    }),
    true,
  );
});

test("financial hub exclusion does not hide unrelated partial-name customers", () => {
  assert.equal(
    isFinancialHubExcludedCustomer({
      name: "Carolina",
      email: "carolinasantos130495@gmail.com",
    }),
    false,
  );
});

test("filterFinancialHubExcludedCustomers removes only the configured cohort", () => {
  const visibleRows = filterFinancialHubExcludedCustomers(
    [
      { id: "keep", customerId: "c-1", amount: 100 },
      { id: "hide-by-id", customerId: "c-2", amount: 200 },
      {
        id: "hide-by-customer",
        customerId: "c-3",
        amount: 300,
        customer: { name: "Aryane da Silva Souza", email: "arycaa@gmail.com" },
      },
    ],
    ["c-2"],
  );

  assert.deepEqual(visibleRows.map((row) => row.id), ["keep"]);
});

test("buildFinancialHubInvoiceWhere adds the visual exclusion to direct financial queries", () => {
  assert.deepEqual(
    buildFinancialHubInvoiceWhere({ status: "OVERDUE" }, ["c-hidden"]),
    { status: "OVERDUE", customerId: { notIn: ["c-hidden"] } },
  );

  assert.deepEqual(
    buildFinancialHubInvoiceWhere({ status: "PAID" }, []),
    { status: "PAID" },
  );
});

test("buildNullableCustomerIdExclusionWhere preserves null deals while excluding hidden customers", () => {
  assert.deepEqual(
    buildNullableCustomerIdExclusionWhere(["c-hidden"]),
    {
      OR: [
        { customerId: null },
        { customerId: { notIn: ["c-hidden"] } },
      ],
    },
  );

  assert.deepEqual(buildNullableCustomerIdExclusionWhere([]), {});
});
