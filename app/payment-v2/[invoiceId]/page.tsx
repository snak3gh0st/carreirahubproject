import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { InvoiceStatus } from "@prisma/client";
import PaymentForm from "./PaymentForm";

interface Props {
  params: { invoiceId: string };
}

export default async function PaymentV2Page({ params }: Props) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.invoiceId },
    include: { customer: true, contract: true },
  });

  if (!invoice) notFound();

  if (invoice.status === InvoiceStatus.PAID) {
    redirect(`/payment/success?invoice_id=${invoice.id}`);
  }

  if (invoice.status === InvoiceStatus.VOID) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Fatura Anulada</h1>
          <p className="text-gray-600">Esta fatura foi anulada e não é mais válida.</p>
        </div>
      </div>
    );
  }

  // NOTE: contract check skipped in draft mode
  const daysUntilDue = Math.ceil(
    (new Date(invoice.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <PaymentForm
      invoiceId={invoice.id}
      invoiceNumber={invoice.invoiceNumber || invoice.id.slice(0, 8)}
      amount={Number(invoice.amount)}
      customerName={invoice.customer.name}
      customerEmail={invoice.customer.email}
      dueDate={invoice.dueDate.toISOString()}
      isOverdue={daysUntilDue < 0}
      daysUntilDue={daysUntilDue}
    />
  );
}
