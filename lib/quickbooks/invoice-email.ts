type QuickBooksInvoiceEmailPayload = {
  EmailStatus?: string | null;
  BillEmail?: {
    Address?: string | null;
  } | null;
  DeliveryInfo?: {
    DeliveryType?: string | null;
  } | null;
} | null | undefined;

export function isQuickBooksInvoiceQueuedForEmail(
  payload: QuickBooksInvoiceEmailPayload
): boolean {
  if (!payload) return false;

  const emailStatus = payload.EmailStatus ?? null;
  const hasBillEmail = Boolean(payload.BillEmail?.Address);
  const deliveryType = payload.DeliveryInfo?.DeliveryType ?? null;

  if (!hasBillEmail) {
    return false;
  }

  return (
    emailStatus === "NeedToSend" ||
    emailStatus === "EmailSent" ||
    deliveryType === "Email"
  );
}
