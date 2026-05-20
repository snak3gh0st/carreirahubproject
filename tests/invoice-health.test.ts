import assert from "node:assert/strict";
import test from "node:test";

import {
  shouldWarnForScheduledInvoiceBacklog,
  summarizeInvoiceHealthSignals,
} from "../lib/invoices/invoice-health";

test("summarizeInvoiceHealthSignals separates local future installments, publish window, and send window work", () => {
  const now = new Date("2026-05-19T12:00:00.000Z");

  const result = summarizeInvoiceHealthSignals(
    [
      {
        status: "DRAFT",
        dueDate: new Date("2026-06-10T12:00:00.000Z"),
        emailSentAt: null,
        emailSendAttempts: 0,
        quickbooks_invoice_id: null,
        installments: { seriesId: "SERIES-1", publishStrategy: "WINDOWED_QB_CREATE" },
        customerEmail: "future@example.com",
      },
      {
        status: "DRAFT",
        dueDate: new Date("2026-05-26T12:00:00.000Z"),
        emailSentAt: null,
        emailSendAttempts: 0,
        quickbooks_invoice_id: null,
        installments: { seriesId: "SERIES-1", publishStrategy: "WINDOWED_QB_CREATE" },
        customerEmail: "publish@example.com",
      },
      {
        status: "SENT",
        dueDate: new Date("2026-05-26T12:00:00.000Z"),
        emailSentAt: null,
        emailSendAttempts: 0,
        quickbooks_invoice_id: "2001",
        installments: { seriesId: "SERIES-1", publishStrategy: "WINDOWED_QB_CREATE" },
        customerEmail: "qb@example.com",
      },
      {
        status: "DRAFT",
        dueDate: new Date("2026-05-24T12:00:00.000Z"),
        emailSentAt: null,
        emailSendAttempts: 0,
        quickbooks_invoice_id: null,
        installments: { seriesId: "SERIES-1", publishStrategy: "WINDOWED_QB_CREATE" },
        customerEmail: "send@example.com",
      },
      {
        status: "SENT",
        dueDate: new Date("2026-07-24T12:00:00.000Z"),
        emailSentAt: null,
        emailSendAttempts: 0,
        quickbooks_invoice_id: "2002",
        installments: null,
        customerEmail: "legacy@example.com",
      },
      {
        status: "SENT",
        dueDate: new Date("2026-05-18T12:00:00.000Z"),
        emailSentAt: null,
        emailSendAttempts: 0,
        quickbooks_invoice_id: "2003",
        installments: null,
        customerEmail: "stale@example.com",
      },
    ],
    now
  );

  assert.deepEqual(result, {
    sendWindowPendingCount: 1,
    publishWindowPendingCount: 1,
    qbCreatedAwaitingSendCount: 1,
    localFutureInstallmentCount: 1,
    legacyQbFutureUnsentCount: 1,
    stalePastDueUnsentCount: 1,
  });
});

test("summarizeInvoiceHealthSignals ignores invoices already sent locally or blocked without email", () => {
  const now = new Date("2026-05-19T12:00:00.000Z");

  const result = summarizeInvoiceHealthSignals(
    [
      {
        status: "SENT",
        dueDate: new Date("2026-05-24T12:00:00.000Z"),
        emailSentAt: new Date("2026-05-19T13:00:00.000Z"),
        emailSendAttempts: 1,
        quickbooks_invoice_id: "2004",
        installments: null,
        customerEmail: "done@example.com",
      },
      {
        status: "DRAFT",
        dueDate: new Date("2026-05-24T12:00:00.000Z"),
        emailSentAt: null,
        emailSendAttempts: 0,
        quickbooks_invoice_id: null,
        installments: { seriesId: "SERIES-1", publishStrategy: "WINDOWED_QB_CREATE" },
        customerEmail: "",
      },
    ],
    now
  );

  assert.deepEqual(result, {
    sendWindowPendingCount: 0,
    publishWindowPendingCount: 0,
    qbCreatedAwaitingSendCount: 0,
    localFutureInstallmentCount: 0,
    legacyQbFutureUnsentCount: 0,
    stalePastDueUnsentCount: 0,
  });
});

test("shouldWarnForScheduledInvoiceBacklog stays quiet before today's send window when yesterday run exists", () => {
  assert.equal(
    shouldWarnForScheduledInvoiceBacklog({
      now: new Date("2026-05-20T01:06:00.000Z"),
      lastSendRunAt: new Date("2026-05-19T09:05:00.000Z"),
    }),
    false
  );
});

test("shouldWarnForScheduledInvoiceBacklog warns after the daily send window opens", () => {
  assert.equal(
    shouldWarnForScheduledInvoiceBacklog({
      now: new Date("2026-05-20T10:00:00.000Z"),
      lastSendRunAt: new Date("2026-05-20T09:05:00.000Z"),
    }),
    true
  );
});

test("shouldWarnForScheduledInvoiceBacklog warns before today's send window when yesterday run is missing", () => {
  assert.equal(
    shouldWarnForScheduledInvoiceBacklog({
      now: new Date("2026-05-20T01:06:00.000Z"),
      lastSendRunAt: new Date("2026-05-18T09:05:00.000Z"),
    }),
    true
  );
});
