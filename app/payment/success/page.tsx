import { prisma } from "@/lib/db";

interface PaymentSuccessPageProps {
  searchParams: {
    invoice_id?: string;
  };
}

/**
 * Payment Success Page
 * Shown after successful payment via QuickBooks Payments
 */
export default async function PaymentSuccessPage({
  searchParams,
}: PaymentSuccessPageProps) {
  const invoiceId = searchParams.invoice_id;

  let invoice = null;
  if (invoiceId) {
    invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true },
    });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: "#FBF8F0" }}>
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 text-center">
        {/* Success Icon */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: "#F0E6C8" }}
        >
          <svg className="w-8 h-8" fill="none" stroke="#C9A84C" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Payment Successful!
        </h1>

        <p className="text-gray-500 mb-6">
          Thank you for your payment. Your transaction has been completed successfully.
        </p>

        {invoice && (
          <div className="rounded-xl p-5 mb-6 text-left" style={{ backgroundColor: "#FDFAF2" }}>
            <h2 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide">
              Payment Details
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Invoice</span>
                <span className="font-medium text-gray-900">
                  #{invoice.invoiceNumber || invoice.id.slice(0, 8)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount</span>
                <span className="font-semibold" style={{ color: "#C9A84C" }}>
                  ${Number(invoice.amount).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Customer</span>
                <span className="font-medium text-gray-900">{invoice.customer?.name}</span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            A confirmation email has been sent to your registered email address.
          </div>

          <p className="text-xs text-gray-400 mt-2">
            Your payment method has been saved for future automatic payments on your remaining installments.
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            Carreira U.S.A. · Secure payment processed by QuickBooks Payments
          </p>
        </div>
      </div>
    </div>
  );
}
