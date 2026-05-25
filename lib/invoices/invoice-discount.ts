export function getQuickBooksDiscountForInvoice({
  discount,
  invoiceCountToCreate,
}: {
  discount: number;
  invoiceCountToCreate: number;
}): number | undefined {
  if (!Number.isFinite(discount) || discount <= 0) {
    return undefined;
  }

  if (invoiceCountToCreate !== 1) {
    return undefined;
  }

  return Number(discount.toFixed(2));
}
