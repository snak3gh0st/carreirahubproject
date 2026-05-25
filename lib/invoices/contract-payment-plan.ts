export interface ContractPaymentPlanInvoice {
  invoiceNumber?: string | null;
  installments?: unknown;
  lineItems?: unknown;
}

function getLineItemDescriptions(lineItems: unknown): string[] {
  if (!Array.isArray(lineItems)) {
    return [];
  }

  return lineItems
    .map((lineItem) => {
      if (
        lineItem &&
        typeof lineItem === "object" &&
        "description" in lineItem &&
        typeof lineItem.description === "string"
      ) {
        return lineItem.description;
      }

      return "";
    })
    .filter(Boolean);
}

export function isEntryPaymentInvoice(invoice: ContractPaymentPlanInvoice): boolean {
  const installmentData = invoice.installments as { isEntryPayment?: unknown } | null | undefined;

  if (installmentData?.isEntryPayment === true) {
    return true;
  }

  if (installmentData?.isEntryPayment === false) {
    return false;
  }

  return getLineItemDescriptions(invoice.lineItems).some((description) =>
    /\b(entry payment|entrada)\b/i.test(description)
  );
}

export function splitEntryAndRegularInvoices<T extends ContractPaymentPlanInvoice>(
  seriesInvoices: T[]
): { entryInvoice: T | null; regularInvoices: T[] } {
  const entryInvoice = seriesInvoices.find(isEntryPaymentInvoice) ?? null;

  return {
    entryInvoice,
    regularInvoices: entryInvoice
      ? seriesInvoices.filter((invoice) => invoice !== entryInvoice)
      : seriesInvoices,
  };
}
