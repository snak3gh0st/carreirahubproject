import assert from "node:assert/strict";
import test from "node:test";

import { InvoiceStatus } from "@prisma/client";

import {
  canEditInvoiceStatus,
  computeInvoiceAmountFromLineItems,
  normalizeEditableInvoiceLineItems,
} from "../lib/invoices/editable-invoice";

test("normalizeEditableInvoiceLineItems trims descriptions and preserves service item ids", () => {
  const normalized = normalizeEditableInvoiceLineItems([
    {
      description: "  Future installment item  ",
      amount: 100.125,
      serviceItemId: "94",
    },
    {
      description: "Addon",
      amount: 9.1,
      serviceItemId: null,
    },
  ]);

  assert.deepEqual(normalized, [
    {
      description: "Future installment item",
      amount: 100.13,
      serviceItemId: "94",
    },
    {
      description: "Addon",
      amount: 9.1,
    },
  ]);
});

test("computeInvoiceAmountFromLineItems recalculates the invoice total from edited line items", () => {
  const normalized = normalizeEditableInvoiceLineItems([
    { description: "Base", amount: 100.125, serviceItemId: "94" },
    { description: "Addon", amount: 9.1, serviceItemId: null },
  ]);

  assert.equal(computeInvoiceAmountFromLineItems(normalized, 0), 109.23);
  assert.equal(computeInvoiceAmountFromLineItems(undefined, 55), 55);
});

test("canEditInvoiceStatus blocks PAID and VOID invoices while allowing future drafts", () => {
  assert.equal(canEditInvoiceStatus(InvoiceStatus.DRAFT), true);
  assert.equal(canEditInvoiceStatus(InvoiceStatus.SENT), true);
  assert.equal(canEditInvoiceStatus(InvoiceStatus.PAID), false);
  assert.equal(canEditInvoiceStatus(InvoiceStatus.VOID), false);
});
