import { prisma } from "@/lib/db";
import Link from "next/link";

interface PaymentCancelPageProps {
  searchParams: {
    invoice_id?: string;
  };
}

/**
 * Payment Cancel Page
 * Shown when user cancels Stripe payment
 */
export default async function PaymentCancelPage({
  searchParams,
}: PaymentCancelPageProps) {
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
        {/* Cancel Icon */}
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
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Payment Cancelled
        </h1>

        <p className="text-gray-600 mb-6">
          Your payment was not completed. Don&apos;t worry - no charges were made to your account.
        </p>

        {invoice && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <h2 className="font-semibold text-gray-900 mb-3">Invoice Details</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Invoice</span>
                <span className="font-medium">
                  {invoice.invoiceNumber || invoice.id.slice(0, 8)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Amount Due</span>
                <span className="font-medium">
                  ${Number(invoice.amount).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Due Date</span>
                <span className="font-medium">
                  {new Date(invoice.dueDate).toLocaleDateString("en-US")}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            If you experienced any issues or have questions about your payment,
            please contact our support team.
          </p>

          <div className="pt-4 space-y-3">
            {invoice && (
              <Link
                href={`/payment/${invoice.id}`}
                className="block w-full px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition"
              >
                Try Payment Again
              </Link>
            )}

            <Link
              href="/"
              className="block w-full px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition"
            >
              Return to Homepage
            </Link>
          </div>
        </div>

        {/* Support */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            Need help? Contact us at{" "}
            <a
              href="mailto:support@carreirausa.com"
              className="text-blue-600 hover:underline"
            >
              support@carreirausa.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
