import { DEFAULT_QB_PUBLISH_WINDOW_DAYS, getWindowedQuickBooksDeliveryStage, isWindowedQuickBooksInstallmentDraft } from "@/lib/invoices/installment-publishing";

export type InvoiceHealthRow = {
  status: string;
  dueDate: Date;
  emailSentAt: Date | null;
  emailSendAttempts: number;
  quickbooks_invoice_id: string | null;
  installments: unknown;
  customerEmail?: string | null;
};

export type InvoiceHealthSignals = {
  sendWindowPendingCount: number;
  publishWindowPendingCount: number;
  qbCreatedAwaitingSendCount: number;
  localFutureInstallmentCount: number;
  legacyQbFutureUnsentCount: number;
  stalePastDueUnsentCount: number;
};

export function summarizeInvoiceHealthSignals(
  invoices: InvoiceHealthRow[],
  now: Date
): InvoiceHealthSignals {
  const summary: InvoiceHealthSignals = {
    sendWindowPendingCount: 0,
    publishWindowPendingCount: 0,
    qbCreatedAwaitingSendCount: 0,
    localFutureInstallmentCount: 0,
    legacyQbFutureUnsentCount: 0,
    stalePastDueUnsentCount: 0,
  };

  for (const invoice of invoices) {
    if (!invoice.customerEmail?.trim()) continue;
    if (invoice.emailSentAt) continue;
    if (invoice.status === "PAID" || invoice.status === "VOID") continue;

    const installments = invoice.installments as { qbPublishWindowDays?: number } | null | undefined;
    const publishWindowDays =
      typeof installments?.qbPublishWindowDays === "number" && installments.qbPublishWindowDays > 0
        ? installments.qbPublishWindowDays
        : DEFAULT_QB_PUBLISH_WINDOW_DAYS;
    const deliveryStage = getWindowedQuickBooksDeliveryStage({
      dueDate: invoice.dueDate,
      now,
      publishWindowDays,
    });
    const isWindowedDraft = isWindowedQuickBooksInstallmentDraft(invoice);
    const hasQuickBooksInvoice = Boolean(invoice.quickbooks_invoice_id);

    if (invoice.dueDate.getTime() < now.getTime() && invoice.emailSendAttempts === 0) {
      summary.stalePastDueUnsentCount += 1;
      continue;
    }

    if (isWindowedDraft) {
      if (deliveryStage === "hold") {
        summary.localFutureInstallmentCount += 1;
      } else if (deliveryStage === "create_only") {
        summary.publishWindowPendingCount += 1;
      } else {
        summary.sendWindowPendingCount += 1;
      }
      continue;
    }

    if (hasQuickBooksInvoice) {
      if (deliveryStage === "hold") {
        summary.legacyQbFutureUnsentCount += 1;
      } else if (deliveryStage === "create_only") {
        summary.qbCreatedAwaitingSendCount += 1;
      } else {
        summary.sendWindowPendingCount += 1;
      }
      continue;
    }

    if (invoice.status === "DRAFT") {
      if (deliveryStage === "create_only") {
        summary.publishWindowPendingCount += 1;
      } else if (deliveryStage === "create_and_send") {
        summary.sendWindowPendingCount += 1;
      }
    }
  }

  return summary;
}
