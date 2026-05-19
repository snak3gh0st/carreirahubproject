import { InvoiceStatus } from "@prisma/client";

export type EditableInvoiceLineItemInput = {
  description: string;
  amount: number;
  serviceItemId?: string | null;
};

export function canEditInvoiceStatus(status: InvoiceStatus): boolean {
  return status !== InvoiceStatus.PAID && status !== InvoiceStatus.VOID;
}

export function normalizeEditableInvoiceLineItems(
  lineItems: EditableInvoiceLineItemInput[] | undefined
) {
  return lineItems?.map((item) => ({
    description: item.description.trim(),
    amount: Number(item.amount.toFixed(2)),
    ...(item.serviceItemId ? { serviceItemId: item.serviceItemId } : {}),
  }));
}

export function computeInvoiceAmountFromLineItems(
  normalizedLineItems: Array<{ amount: number }> | undefined,
  fallbackAmount: number | undefined
) {
  if (!normalizedLineItems) {
    return fallbackAmount;
  }

  return Number(
    normalizedLineItems
      .reduce((sum, item) => sum + item.amount, 0)
      .toFixed(2)
  );
}
