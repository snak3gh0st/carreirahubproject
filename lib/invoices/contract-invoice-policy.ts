import { InvoiceStatus } from "@prisma/client";

export interface ContractFailureInvoiceState {
  status: InvoiceStatus | string;
  amount: number | { toString(): string } | null;
  amountPaid: number | { toString(): string } | null;
  paidAt: Date | string | null;
}

function toNumber(value: ContractFailureInvoiceState["amount"]): number {
  if (value == null) return 0;
  return Number(value);
}

export function isInvoicePaymentComplete(invoice: ContractFailureInvoiceState): boolean {
  const amount = toNumber(invoice.amount);
  const amountPaid = toNumber(invoice.amountPaid);

  return (
    invoice.status === InvoiceStatus.PAID ||
    Boolean(invoice.paidAt) ||
    (amount > 0 && amountPaid >= amount)
  );
}

export function shouldVoidInvoiceForContractFailure(invoice: ContractFailureInvoiceState): boolean {
  return !isInvoicePaymentComplete(invoice);
}
