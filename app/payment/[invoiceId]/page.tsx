import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { InvoiceStatus, ContractStatus } from "@prisma/client";
import Link from "next/link";
import { stripeService } from "@/lib/services/stripe.service";

interface PaymentPageProps {
  params: {
    invoiceId: string;
  };
}

/**
 * Payment Page
 * Customer-facing page to complete payment for an invoice
 */
export default async function PaymentPage({ params }: PaymentPageProps) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.invoiceId },
    include: {
      customer: true,
      contract: true,
    },
  });

  if (!invoice) {
    notFound();
  }

  // Check if invoice is already paid
  if (invoice.status === InvoiceStatus.PAID) {
    redirect(`/payment/success?invoice_id=${invoice.id}`);
  }

  // Check if invoice is voided
  if (invoice.status === InvoiceStatus.VOID) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Fatura Anulada
          </h1>
          <p className="text-gray-600">
            Esta fatura foi anulada e não é mais válida para pagamento.
          </p>
        </div>
      </div>
    );
  }

  // Check if contract is signed
  const contractSigned = invoice.contract?.status === ContractStatus.SIGNED;

  if (!contractSigned) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-yellow-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Contrato Necessário
          </h1>
          <p className="text-gray-600 mb-4">
            Por favor, assine o contrato antes de prosseguir com o pagamento. Verifique seu e-mail para o contrato do DocuSign.
          </p>
          {invoice.contract && (
            <p className="text-sm text-gray-500">
              Status do contrato: {invoice.contract.status.replace(/_/g, " ")}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Calculate days until due
  const daysUntilDue = Math.ceil(
    (new Date(invoice.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const isOverdue = daysUntilDue < 0;

  // Create checkout session URL
  let checkoutUrl = "";
  try {
    const session = await stripeService.createCheckoutSession(invoice, {
      id: invoice.customer.id,
      name: invoice.customer.name,
      email: invoice.customer.email,
      stripe_id: invoice.customer.stripe_id,
    });
    checkoutUrl = session.url;
  } catch (error) {
    console.error("[PAYMENT_PAGE] Failed to create checkout session:", error);
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Carreira U.S.A.</h1>
          <p className="text-gray-600 mt-2">Complete Seu Pagamento</p>
        </div>

        {/* Invoice Card */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Invoice Header */}
          <div className="bg-blue-600 text-white p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-blue-200 text-sm">Fatura</p>
                <p className="text-xl font-bold">
                  {invoice.invoiceNumber || invoice.id.slice(0, 8)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-blue-200 text-sm">Valor Devido</p>
                <p className="text-3xl font-bold">
                  ${Number(invoice.amount).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Invoice Details */}
          <div className="p-6">
            {/* Due Date Warning */}
            {isOverdue && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-800 font-medium">
                  Esta fatura está {Math.abs(daysUntilDue)} dias em atraso
                </p>
              </div>
            )}

            {!isOverdue && daysUntilDue <= 7 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-yellow-800 font-medium">
                  Vence em {daysUntilDue} dia{daysUntilDue !== 1 ? "s" : ""}
                </p>
              </div>
            )}

            {/* Details */}
            <div className="space-y-4">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Cliente</span>
                <span className="font-medium">{invoice.customer.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Email</span>
                <span className="font-medium">{invoice.customer.email}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Data de Vencimento</span>
                <span
                  className={`font-medium ${
                    isOverdue ? "text-red-600" : ""
                  }`}
                >
                  {new Date(invoice.dueDate).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Contrato</span>
                <span className="font-medium text-green-600">Assinado</span>
              </div>
            </div>

            {/* Payment Button */}
            <div className="mt-8">
              {checkoutUrl ? (
                <a
                  href={checkoutUrl}
                  className="block w-full py-4 bg-green-600 text-white text-center font-bold text-lg rounded-lg hover:bg-green-700 transition"
                >
                  Pagar Agora - ${Number(invoice.amount).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </a>
              ) : (
                <div className="text-center">
                  <p className="text-red-600 mb-4">
                    Não foi possível criar a sessão de pagamento. Tente novamente mais tarde.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                  >
                    Tentar Novamente
                  </button>
                </div>
              )}
            </div>

            {/* Payment Methods */}
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-gray-500 text-center mb-4">
                Pagamento seguro processado por Stripe
              </p>
              <div className="flex justify-center space-x-4">
                <div className="text-gray-400 text-xs">
                  Cartão de Crédito
                </div>
                <div className="text-gray-400 text-xs">
                  Transferência Bancária
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Dúvidas sobre sua fatura?{" "}
            <a
              href="mailto:support@carreirausa.com"
              className="text-blue-600 hover:underline"
            >
              Fale com o Suporte
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
