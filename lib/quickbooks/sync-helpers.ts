export interface PaginatedQuickBooksRecords<T> {
  records: T[];
  hasMore: boolean;
  nextPosition: number;
}

export function extractQuickBooksInvoiceFromResponse(response: unknown): Record<string, any> | null {
  if (!response || typeof response !== "object") {
    return null;
  }

  const payload = response as Record<string, any>;
  if (payload.Invoice && typeof payload.Invoice === "object") {
    return payload.Invoice as Record<string, any>;
  }

  if (typeof payload.Id === "string" || typeof payload.Id === "number") {
    return payload;
  }

  return null;
}

export function extractQuickBooksQueryResponse(response: unknown): Record<string, any> {
  if (!response || typeof response !== "object") {
    return {};
  }

  const payload = response as Record<string, any>;
  if (!payload.QueryResponse || typeof payload.QueryResponse !== "object") {
    return {};
  }

  return payload.QueryResponse as Record<string, any>;
}

export function extractQuickBooksCdcResponses(response: unknown): Array<Record<string, any>> {
  if (!response || typeof response !== "object") {
    return [];
  }

  const payload = response as Record<string, any>;
  if (!payload.CDCResponse) {
    return [];
  }

  return Array.isArray(payload.CDCResponse)
    ? (payload.CDCResponse as Array<Record<string, any>>)
    : [payload.CDCResponse as Record<string, any>];
}

export async function collectPaginatedQuickBooksRecords<T>(
  fetchPage: (startPosition: number) => Promise<PaginatedQuickBooksRecords<T>>
): Promise<T[]> {
  const allRecords: T[] = [];
  let startPosition = 1;
  let hasMore = true;

  while (hasMore) {
    const page = await fetchPage(startPosition);
    allRecords.push(...page.records);
    hasMore = page.hasMore;
    startPosition = page.nextPosition;
  }

  return allRecords;
}

export function findLinkedQuickBooksInvoiceId(qbPayment: { Line?: Array<{ LinkedTxn?: Array<{ TxnType?: string; TxnId?: string }> }> }): string | undefined {
  for (const line of qbPayment.Line || []) {
    const invoiceTxn = (line.LinkedTxn || []).find((txn) => txn.TxnType === "Invoice");
    if (invoiceTxn?.TxnId) {
      return invoiceTxn.TxnId;
    }
  }

  return undefined;
}

export function paymentLinksToQuickBooksInvoice(
  qbPayment: { Line?: Array<{ LinkedTxn?: Array<{ TxnType?: string; TxnId?: string }> }> },
  invoiceId: string
): boolean {
  for (const line of qbPayment.Line || []) {
    for (const txn of line.LinkedTxn || []) {
      if (txn.TxnType === "Invoice" && txn.TxnId === invoiceId) {
        return true;
      }
    }
  }

  return false;
}

export function resolveLocalCustomerIdForPayment(options: {
  linkedInvoiceCustomerId?: string | null;
  linkedInvoiceQbCustomerId?: string | null;
  customerByQbId: Map<string | null, { id: string }>;
}): string | undefined {
  if (options.linkedInvoiceCustomerId) {
    return options.linkedInvoiceCustomerId;
  }

  if (options.linkedInvoiceQbCustomerId) {
    return options.customerByQbId.get(options.linkedInvoiceQbCustomerId)?.id;
  }

  return undefined;
}

export function chooseInvoiceSyncMatch<T extends { id: string }>(options: {
  existingByQuickBooksId?: T | null;
  existingByDocNumber?: T | null;
  draftFallback?: T | null;
}): { record: T; strategy: "quickbooks_id" | "doc_number" | "draft" } | null {
  if (options.existingByQuickBooksId) {
    return { record: options.existingByQuickBooksId, strategy: "quickbooks_id" };
  }

  if (options.existingByDocNumber) {
    return { record: options.existingByDocNumber, strategy: "doc_number" };
  }

  if (options.draftFallback) {
    return { record: options.draftFallback, strategy: "draft" };
  }

  return null;
}

export type QuickBooksInvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "PARTIALLY_PAID";

function formatDateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

export function determineQuickBooksInvoiceStatus({
  balance,
  totalAmount,
  dueDate,
  now = new Date(),
  emailStatus,
  businessTimeZone = "America/Sao_Paulo",
}: {
  balance: number;
  totalAmount: number;
  dueDate: Date;
  now?: Date;
  emailStatus?: string | null;
  businessTimeZone?: string;
}): QuickBooksInvoiceStatus {
  if (balance === 0) return "PAID";
  if (balance < totalAmount && balance > 0) return "PARTIALLY_PAID";
  if (
    formatDateKeyInTimeZone(dueDate, businessTimeZone) <
      formatDateKeyInTimeZone(now, businessTimeZone) &&
    balance > 0
  ) {
    return "OVERDUE";
  }
  if (emailStatus === "EmailSent") return "SENT";
  return "SENT";
}

function asPlainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export function mergeQuickBooksInvoiceMetadata(
  installments: unknown,
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const installmentsObject = asPlainObject(installments);
  const existingQuickBooks = asPlainObject(installmentsObject.quickbooks);

  return {
    ...installmentsObject,
    quickbooks: {
      ...existingQuickBooks,
      ...metadata,
    },
  };
}

export function isQuickBooksInvoiceMarkedMissing(installments: unknown): boolean {
  const installmentsObject = asPlainObject(installments);
  const quickbooks = asPlainObject(installmentsObject.quickbooks);

  return quickbooks.missingInQb === true || typeof quickbooks.missingInQbAt === "string";
}

export function isQuickBooksInvoiceExcludedFromHub(installments: unknown): boolean {
  const installmentsObject = asPlainObject(installments);
  const quickbooks = asPlainObject(installmentsObject.quickbooks);

  return quickbooks.excludedFromHub === true;
}

export type QuickBooksIncrementalInvoiceDecision = "backfill" | "update" | "skip";

function normalizeDateKey(date: Date | string | null | undefined): string | null {
  if (!date) {
    return null;
  }

  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) {
    return null;
  }

  return value.toISOString().slice(0, 10);
}

export function getQuickBooksIncrementalInvoiceDecision(options: {
  existingInvoice:
    | {
        status: string;
        amount?: number | null;
        dueDate?: Date | string | null;
        amountPaid?: number | null;
        installments?: unknown;
      }
    | null
    | undefined;
  nextStatus: string;
  nextAmount: number;
  nextDueDate: Date;
  nextAmountPaid: number;
  excludeFromHub: boolean;
}): QuickBooksIncrementalInvoiceDecision {
  const { existingInvoice } = options;

  if (!existingInvoice) {
    return "backfill";
  }

  const statusChanged = existingInvoice.status !== options.nextStatus;
  const amountChanged = (existingInvoice.amount ?? 0) !== options.nextAmount;
  const amountPaidChanged = (existingInvoice.amountPaid ?? 0) !== options.nextAmountPaid;
  const dueDateChanged =
    normalizeDateKey(existingInvoice.dueDate) !== normalizeDateKey(options.nextDueDate);
  const exclusionChanged =
    isQuickBooksInvoiceExcludedFromHub(existingInvoice.installments) !== options.excludeFromHub;

  if (statusChanged || amountChanged || amountPaidChanged || dueDateChanged || exclusionChanged) {
    return "update";
  }

  return "skip";
}
