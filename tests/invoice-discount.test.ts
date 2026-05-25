import assert from "node:assert/strict";

import { getQuickBooksDiscountForInvoice } from "../lib/invoices/invoice-discount";

assert.equal(
  getQuickBooksDiscountForInvoice({
    discount: 500,
    invoiceCountToCreate: 6,
  }),
  undefined,
  "installment invoices already carry the discounted net amount and must not send a QB discount line"
);

assert.equal(
  getQuickBooksDiscountForInvoice({
    discount: 500,
    invoiceCountToCreate: 1,
  }),
  500,
  "single invoices still need the explicit QB discount line because line items use the gross amount"
);

assert.equal(
  getQuickBooksDiscountForInvoice({
    discount: 0,
    invoiceCountToCreate: 1,
  }),
  undefined
);

console.log("invoice-discount.test.ts passed");
