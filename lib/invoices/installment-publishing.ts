const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const DEFAULT_QB_PUBLISH_WINDOW_DAYS = 7;
export const DEFAULT_QB_SEND_WINDOW_DAYS = 5;
export const WINDOWED_QB_CREATE_STRATEGY = "WINDOWED_QB_CREATE";

type InstallmentsMetadata = {
  seriesId?: string;
  publishStrategy?: string;
  qbPublishWindowDays?: number;
} | null | undefined;

export type InstallmentPersistencePlan = {
  localStatus: "SENT" | "DRAFT";
  shouldCreateInQuickBooksImmediately: boolean;
  installmentsMetadata?: {
    seriesId: string;
    current: number;
    total: number;
    isFirstInstallment: boolean;
    publishStrategy?: string;
    qbPublishWindowDays?: number;
  };
};

export function determineInvoiceCountToCreate({
  entryAmount,
  installmentCount,
}: {
  entryAmount: number;
  installmentCount: number;
}): number {
  if (entryAmount > 0 && installmentCount > 0) {
    return 1 + installmentCount;
  }

  if (entryAmount > 0) {
    return 1;
  }

  if (installmentCount > 0) {
    return installmentCount;
  }

  return 1;
}

export function validateScheduleDatesCount(
  scheduleDates: Date[] | undefined,
  expectedCount: number
): string | null {
  if (!scheduleDates) {
    return null;
  }

  if (scheduleDates.length !== expectedCount) {
    return `Expected ${expectedCount} schedule dates, received ${scheduleDates.length}`;
  }

  return null;
}

export function hasPastScheduleDate(
  scheduleDates: Date[] | undefined,
  today: Date
): boolean {
  return Boolean(scheduleDates?.some((value) => value.getTime() < today.getTime()));
}

export function isWindowedQuickBooksInstallmentDraft(invoice: {
  quickbooks_invoice_id: string | null;
  installments: unknown;
}): boolean {
  const installments = invoice.installments as InstallmentsMetadata;
  return (
    invoice.quickbooks_invoice_id === null &&
    !!installments?.seriesId &&
    installments?.publishStrategy === WINDOWED_QB_CREATE_STRATEGY
  );
}

export function getInstallmentPersistencePlan({
  invoiceIndex,
  totalInvoices,
  seriesId,
  publishWindowDays = DEFAULT_QB_PUBLISH_WINDOW_DAYS,
}: {
  invoiceIndex: number;
  totalInvoices: number;
  seriesId?: string;
  publishWindowDays?: number;
}): InstallmentPersistencePlan {
  const isSeries = totalInvoices > 1 && !!seriesId;
  const current = invoiceIndex + 1;
  const isFirstInstallment = current === 1;

  if (!isSeries) {
    return {
      localStatus: "SENT",
      shouldCreateInQuickBooksImmediately: true,
    };
  }

  if (isFirstInstallment) {
    return {
      localStatus: "SENT",
      shouldCreateInQuickBooksImmediately: true,
      installmentsMetadata: {
        seriesId: seriesId!,
        current,
        total: totalInvoices,
        isFirstInstallment: true,
      },
    };
  }

  return {
    localStatus: "DRAFT",
    shouldCreateInQuickBooksImmediately: false,
    installmentsMetadata: {
      seriesId: seriesId!,
      current,
      total: totalInvoices,
      isFirstInstallment: false,
      publishStrategy: WINDOWED_QB_CREATE_STRATEGY,
      qbPublishWindowDays: publishWindowDays,
    },
  };
}

export type WindowedQuickBooksDeliveryStage =
  | "hold"
  | "create_only"
  | "create_and_send";

export function getWindowedQuickBooksDeliveryStage({
  dueDate,
  now,
  publishWindowDays = DEFAULT_QB_PUBLISH_WINDOW_DAYS,
  sendWindowDays = DEFAULT_QB_SEND_WINDOW_DAYS,
}: {
  dueDate: Date;
  now: Date;
  publishWindowDays?: number;
  sendWindowDays?: number;
}): WindowedQuickBooksDeliveryStage {
  const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / MS_PER_DAY);

  if (daysUntilDue > publishWindowDays) {
    return "hold";
  }

  if (daysUntilDue > sendWindowDays) {
    return "create_only";
  }

  return "create_and_send";
}
