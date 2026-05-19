import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_QB_PUBLISH_WINDOW_DAYS,
  WINDOWED_QB_CREATE_STRATEGY,
  determineInvoiceCountToCreate,
  getWindowedQuickBooksDeliveryStage,
  getInstallmentPersistencePlan,
  hasPastScheduleDate,
  isWindowedQuickBooksInstallmentDraft,
  validateScheduleDatesCount,
} from "../lib/invoices/installment-publishing";

test("determineInvoiceCountToCreate handles single, installments-only, and entry-plus-installments flows", () => {
  assert.equal(determineInvoiceCountToCreate({ entryAmount: 0, installmentCount: 0 }), 1);
  assert.equal(determineInvoiceCountToCreate({ entryAmount: 500, installmentCount: 0 }), 1);
  assert.equal(determineInvoiceCountToCreate({ entryAmount: 0, installmentCount: 4 }), 4);
  assert.equal(determineInvoiceCountToCreate({ entryAmount: 500, installmentCount: 4 }), 5);
});

test("validateScheduleDatesCount rejects mismatched custom schedule lengths", () => {
  const dates = [new Date("2026-06-01T12:00:00.000Z"), new Date("2026-07-01T12:00:00.000Z")];

  assert.equal(validateScheduleDatesCount(undefined, 3), null);
  assert.equal(validateScheduleDatesCount(dates, 2), null);
  assert.equal(
    validateScheduleDatesCount(dates, 3),
    "Expected 3 schedule dates, received 2"
  );
});

test("hasPastScheduleDate flags dates before the comparison day", () => {
  const today = new Date("2026-05-19T12:00:00.000Z");

  assert.equal(
    hasPastScheduleDate(
      [new Date("2026-05-19T12:00:00.000Z"), new Date("2026-05-20T12:00:00.000Z")],
      today
    ),
    false
  );
  assert.equal(
    hasPastScheduleDate([new Date("2026-05-18T12:00:00.000Z")], today),
    true
  );
});

test("isWindowedQuickBooksInstallmentDraft only matches local future installments", () => {
  assert.equal(
    isWindowedQuickBooksInstallmentDraft({
      quickbooks_invoice_id: null,
      installments: {
        seriesId: "SERIES-1",
        publishStrategy: WINDOWED_QB_CREATE_STRATEGY,
      },
    }),
    true
  );

  assert.equal(
    isWindowedQuickBooksInstallmentDraft({
      quickbooks_invoice_id: "123",
      installments: {
        seriesId: "SERIES-1",
        publishStrategy: WINDOWED_QB_CREATE_STRATEGY,
      },
    }),
    false
  );

  assert.equal(
    isWindowedQuickBooksInstallmentDraft({
      quickbooks_invoice_id: null,
      installments: {
        seriesId: "SERIES-1",
        publishStrategy: "OTHER",
      },
    }),
    false
  );
});

test("getInstallmentPersistencePlan keeps only the first invoice in QuickBooks immediately for recurring series", () => {
  assert.deepEqual(
    getInstallmentPersistencePlan({
      invoiceIndex: 0,
      totalInvoices: 3,
      seriesId: "SERIES-1",
    }),
    {
      localStatus: "SENT",
      shouldCreateInQuickBooksImmediately: true,
      installmentsMetadata: {
        seriesId: "SERIES-1",
        current: 1,
        total: 3,
        isFirstInstallment: true,
      },
    }
  );

  assert.deepEqual(
    getInstallmentPersistencePlan({
      invoiceIndex: 1,
      totalInvoices: 3,
      seriesId: "SERIES-1",
    }),
    {
      localStatus: "DRAFT",
      shouldCreateInQuickBooksImmediately: false,
      installmentsMetadata: {
        seriesId: "SERIES-1",
        current: 2,
        total: 3,
        isFirstInstallment: false,
        publishStrategy: WINDOWED_QB_CREATE_STRATEGY,
        qbPublishWindowDays: DEFAULT_QB_PUBLISH_WINDOW_DAYS,
      },
    }
  );
});

test("getWindowedQuickBooksDeliveryStage separates hold, create-only, and create-and-send windows", () => {
  const now = new Date("2026-05-19T12:00:00.000Z");

  assert.equal(
    getWindowedQuickBooksDeliveryStage({
      now,
      dueDate: new Date("2026-05-29T12:00:00.000Z"),
      publishWindowDays: DEFAULT_QB_PUBLISH_WINDOW_DAYS,
    }),
    "hold"
  );

  assert.equal(
    getWindowedQuickBooksDeliveryStage({
      now,
      dueDate: new Date("2026-05-26T12:00:00.000Z"),
    }),
    "create_only"
  );

  assert.equal(
    getWindowedQuickBooksDeliveryStage({
      now,
      dueDate: new Date("2026-05-24T12:00:00.000Z"),
    }),
    "create_and_send"
  );
});
