export function extractQuickbooksInvoiceLink(payload: unknown): string | null {
  const invoice = (payload as any)?.Invoice ?? payload;
  const link = invoice?.InvoiceLink;

  if (typeof link !== "string") return null;

  try {
    const url = new URL(link);
    if (url.protocol !== "https:") return null;
    if (!url.hostname.endsWith("intuit.com")) return null;
    return url.toString();
  } catch {
    return null;
  }
}
