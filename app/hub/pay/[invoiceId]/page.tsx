import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { InvoiceStatus } from "@prisma/client";
import PaymentForm from "@/app/payment-v2/[invoiceId]/PaymentForm";
import { Language } from "@/lib/i18n/hub";

function getPayload(token: string) {
  try {
    const [, payloadB64] = token.split(".");
    return JSON.parse(Buffer.from(payloadB64!, "base64url").toString());
  } catch {
    return null;
  }
}

interface Props {
  params: { invoiceId: string };
}

export default async function HubPaymentPage({ params }: Props) {
  const cookieStore = await cookies();
  const token = cookieStore.get("hub-token")?.value;
  if (!token) redirect("/hub/login");

  const payload = getPayload(token);
  if (!payload?.customerId) redirect("/hub/login");

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.invoiceId },
    include: { customer: true },
  });

  if (!invoice) notFound();

  // Ownership check
  if (invoice.customerId !== payload.customerId) notFound();

  // Already paid
  if (invoice.status === InvoiceStatus.PAID) {
    redirect("/hub?paid=1");
  }

  // Must be payable
  const payable: InvoiceStatus[] = [InvoiceStatus.SENT, InvoiceStatus.OVERDUE, InvoiceStatus.PARTIALLY_PAID];
  if (!payable.includes(invoice.status)) {
    redirect("/hub");
  }

  // Calculate charge amount
  const totalAmount = Number(invoice.amount);
  const paidAmount = Number(invoice.amountPaid || 0);
  const chargeAmount = invoice.status === InvoiceStatus.PARTIALLY_PAID
    ? totalAmount - paidAmount
    : totalAmount;

  const lang = (payload?.language || "en") as Language;
  const daysUntilDue = Math.ceil(
    (new Date(invoice.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="max-w-lg mx-auto">
      <PaymentForm
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoiceNumber || invoice.id.slice(0, 8)}
        amount={chargeAmount}
        customerName={invoice.customer.name}
        customerEmail={invoice.customer.email}
        dueDate={invoice.dueDate.toISOString()}
        isOverdue={daysUntilDue < 0}
        daysUntilDue={daysUntilDue}
        language={lang}
        chargeEndpoint={`/api/hub/pay/${invoice.id}/charge`}
        onSuccessRedirect="/hub?paid=1"
        showAutopayNotice

      />
    </div>
  );
}
