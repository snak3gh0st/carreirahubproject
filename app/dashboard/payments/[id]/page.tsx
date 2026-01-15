import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

/**
 * Payment Detail Page
 *
 * Shows payment details with invoice and customer context
 */
export default async function PaymentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  // Verificar permissão
  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN" && userRole !== "FINANCE") {
    redirect("/dashboard");
  }

  // Fetch payment with relations
  const payment = await prisma.payment.findUnique({
    where: { id: params.id },
    include: {
      customer: {
        include: {
          invoices: {
            select: {
              id: true,
              status: true,
              amount: true,
            },
          },
        },
      },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          amount: true,
          amountPaid: true,
          status: true,
          dueDate: true,
        },
      },
    },
  });

  if (!payment) {
    notFound();
  }

  // Fetch customer's recent payment history (last 5 payments)
  const recentPayments = await prisma.payment.findMany({
    where: {
      customerId: payment.customerId,
      id: { not: payment.id }, // Exclude current payment
    },
    take: 5,
    orderBy: { paymentDate: "desc" },
    include: {
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
        },
      },
    },
  });

  // Calculate customer totals
  const customerTotalPaid = payment.customer.invoices
    .filter((inv) => inv.status === "PAID")
    .reduce((sum, inv) => sum + Number(inv.amount), 0);

  const customerBalance = payment.customer.invoices
    .filter((inv) => inv.status !== "PAID" && inv.status !== "VOID")
    .reduce((sum, inv) => sum + Number(inv.amount), 0);

  // Determine source
  const isQBSynced = !!payment.quickbooks_payment_id;
  const isStripeSynced = !!payment.stripe_payment_id;
  const isManual = !isQBSynced && !isStripeSynced;

  // Calculate invoice balance before/after payment
  const invoiceTotal = Number(payment.invoice.amount);
  const invoiceAmountPaid = Number(payment.invoice.amountPaid || 0);
  const invoiceBalanceAfter = invoiceTotal - invoiceAmountPaid;
  const invoiceBalanceBefore = invoiceBalanceAfter + Number(payment.amount);

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Link
          href="/dashboard/payments"
          className="text-blue-600 hover:underline mb-4 inline-block"
        >
          ← Back to Payments
        </Link>
      </div>

      {/* Two-column responsive layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Payment Details (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Payment Header */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-4xl font-bold text-green-600">
                  ${Number(payment.amount).toLocaleString()}
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(payment.paymentDate).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  Applied
                </span>
                {isQBSynced && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                    QuickBooks
                  </span>
                )}
                {isStripeSynced && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs">
                    Stripe
                  </span>
                )}
                {isManual && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                    Manual
                  </span>
                )}
              </div>
            </div>

            <div className="border-t pt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Transaction Reference</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="font-mono text-sm font-medium">
                    {payment.referenceNumber || payment.id.slice(0, 12)}
                  </p>
                  {payment.referenceNumber && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(payment.referenceNumber!);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                      title="Copy reference"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Payment Method</p>
                <p className="text-sm font-medium mt-1">
                  {payment.paymentMethod || "N/A"}
                </p>
              </div>
              {isQBSynced && (
                <div>
                  <p className="text-sm text-gray-500">QuickBooks ID</p>
                  <p className="text-sm font-mono font-medium mt-1">
                    {payment.quickbooks_payment_id}
                  </p>
                </div>
              )}
              {isStripeSynced && (
                <div>
                  <p className="text-sm text-gray-500">Stripe Payment ID</p>
                  <p className="text-sm font-mono font-medium mt-1">
                    {payment.stripe_payment_id}
                  </p>
                </div>
              )}
            </div>

            {payment.notes && (
              <div className="border-t pt-4 mt-4">
                <p className="text-sm text-gray-500 mb-1">Private Notes</p>
                <p className="text-sm text-gray-700">{payment.notes}</p>
              </div>
            )}
          </div>

          {/* Payment Details Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Payment Details</h2>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-gray-500">Payment Date</span>
                <span className="text-sm font-medium">
                  {new Date(payment.paymentDate).toLocaleString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-gray-500">Payment Method</span>
                <span className="text-sm font-medium">
                  {payment.paymentMethod || "Not specified"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-gray-500">Transaction Reference</span>
                <span className="text-sm font-mono">
                  {payment.referenceNumber || payment.id.slice(0, 12)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-gray-500">Applied to Invoice</span>
                <Link
                  href={`/dashboard/invoices/${payment.invoice.id}`}
                  className="text-sm text-blue-600 hover:underline font-medium"
                >
                  {payment.invoice.invoiceNumber || payment.invoice.id.slice(0, 8)}
                </Link>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-gray-500">Created At</span>
                <span className="text-sm">
                  {new Date(payment.createdAt).toLocaleString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-gray-500">Last Updated</span>
                <span className="text-sm">
                  {new Date(payment.updatedAt).toLocaleString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Recent Payment History (same customer) */}
          {recentPayments.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  Recent Payments from {payment.customer.name}
                </h2>
                <Link
                  href={`/dashboard/customers/${payment.customer.id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  View All →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Date
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Amount
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Invoice #
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Method
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentPayments.map((recentPayment) => (
                      <tr key={recentPayment.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {new Date(recentPayment.paymentDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-green-600">
                          ${Number(recentPayment.amount).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <Link
                            href={`/dashboard/invoices/${recentPayment.invoice.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {recentPayment.invoice.invoiceNumber ||
                              recentPayment.invoice.id.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {recentPayment.paymentMethod || "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Invoice & Customer Cards (1/3 width) */}
        <div className="lg:col-span-1 space-y-6">
          {/* Invoice Information Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Invoice Information</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Invoice Number</p>
                <Link
                  href={`/dashboard/invoices/${payment.invoice.id}`}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {payment.invoice.invoiceNumber || payment.invoice.id.slice(0, 8)}
                </Link>
              </div>
              <div>
                <p className="text-sm text-gray-500">Invoice Total</p>
                <p className="text-lg font-semibold">
                  ${Number(payment.invoice.amount).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Balance Before Payment</p>
                <p className="text-sm font-medium text-orange-600">
                  ${invoiceBalanceBefore.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Balance After Payment</p>
                <p className="text-sm font-medium text-green-600">
                  ${invoiceBalanceAfter.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Invoice Status</p>
                <span
                  className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${
                    payment.invoice.status === "PAID"
                      ? "bg-green-100 text-green-800"
                      : payment.invoice.status === "OVERDUE"
                      ? "bg-red-100 text-red-800"
                      : payment.invoice.status === "SENT"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {payment.invoice.status}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Due Date</p>
                <p className="text-sm">
                  {new Date(payment.invoice.dueDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Customer Information Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Customer Information</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Customer Name</p>
                <Link
                  href={`/dashboard/customers/${payment.customer.id}`}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {payment.customer.name}
                </Link>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="text-sm">{payment.customer.email}</p>
              </div>
              {payment.customer.phone && (
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="text-sm">{payment.customer.phone}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Current Balance</p>
                <p
                  className={`text-lg font-semibold ${
                    customerBalance > 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  ${customerBalance.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Paid to Date</p>
                <p className="text-sm font-medium text-green-600">
                  ${customerTotalPaid.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Payment History</p>
                <p className="text-sm">
                  {recentPayments.length + 1} payment{recentPayments.length !== 0 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex gap-3">
        <Link
          href="/dashboard/payments"
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition"
        >
          Back to Payments List
        </Link>
        <Link
          href={`/dashboard/invoices/${payment.invoice.id}`}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          View Invoice
        </Link>
        <Link
          href={`/dashboard/customers/${payment.customer.id}`}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          View Customer
        </Link>
      </div>
    </div>
  );
}
