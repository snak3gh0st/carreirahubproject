export interface PaginatedQuickBooksRecords<T> {
  records: T[];
  hasMore: boolean;
  nextPosition: number;
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
