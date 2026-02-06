import { prisma } from "@/lib/db";
import Link from "next/link";

interface PaymentSuccessPageProps {
  searchParams: {
    session_id?: string;
    invoice_id?: string;
  };
}

/**
 * Payment Success Page
 * Shown after successful Stripe payment
 */
export default async function PaymentSuccessPage({
  searchParams,
}: PaymentSuccessPageProps) {
  const invoiceId = searchParams.invoice_id;

  let invoice = null;
  if (invoiceId) {
    invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
      },
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {/* Success Icon */}
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Pagamento Realizado com Sucesso!
        </h1>

        <p className="text-gray-600 mb-6">
          Obrigado pelo seu pagamento. Sua transação foi concluída com sucesso.
        </p>

        {invoice && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <h2 className="font-semibold text-gray-900 mb-3">Detalhes do Pagamento</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Fatura</span>
                <span className="font-medium">
                  {invoice.invoiceNumber || invoice.id.slice(0, 8)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Valor</span>
                <span className="font-medium text-green-600">
                  ${Number(invoice.amount).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cliente</span>
                <span className="font-medium">{invoice.customer?.name}</span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Um e-mail de confirmação foi enviado para o seu endereço de e-mail cadastrado.
          </p>

          <div className="pt-4">
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
            >
              Voltar para a Página Inicial
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            Carreira U.S.A. - Processado por Stripe
          </p>
        </div>
      </div>
    </div>
  );
}
