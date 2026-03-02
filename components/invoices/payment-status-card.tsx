"use client";

import { useState } from "react";
import { InvoiceStatus, ContractStatus } from "@prisma/client";
import { normalizeDateOnly, differenceInCalendarDaysUTC } from "@/lib/utils/date";

interface PaymentStatusCardProps {
  invoice: {
    id: string;
    invoiceNumber: string | null;
    status: InvoiceStatus;
    amount: any;
    dueDate: Date | string;
    paidAt: Date | null;
    amountPaid: any | null;
    paymentMethod: string | null;
    stripePaymentLinkId: string | null;
    stripePaymentIntentId: string | null;
    lastPaymentReminderAt: Date | null;
    paymentReminderCount: number;
  };
  contractStatus: ContractStatus | null;
}

export function PaymentStatusCard({ invoice, contractStatus }: PaymentStatusCardProps) {
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSendPaymentLink = async () => {
    setIsSending(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/invoices/${invoice.id}/send-payment-link`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send payment link");
      }

      setMessage({ type: "success", text: "Payment link sent successfully" });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to send payment link",
      });
    } finally {
      setIsSending(false);
    }
  };

  const dueDateOnly = normalizeDateOnly(invoice.dueDate);
  const daysUntilDue = differenceInCalendarDaysUTC(dueDateOnly, new Date());
  const isOverdue = daysUntilDue < 0;
  const isPaid = invoice.status === InvoiceStatus.PAID;
  const canSendPaymentLink =
    contractStatus === ContractStatus.SIGNED &&
    !isPaid &&
    invoice.status !== InvoiceStatus.VOID;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Payment Status</h3>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isPaid
              ? "bg-green-100 text-green-800"
              : isOverdue
              ? "bg-red-100 text-red-800"
              : "bg-yellow-100 text-yellow-800"
          }`}
        >
          {isPaid ? "Paid" : isOverdue ? "Overdue" : "Pending"}
        </span>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Amount</span>
          <span className="font-medium">
            ${Number(invoice.amount).toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">Due Date</span>
          <span
            className={`font-medium ${
              isOverdue && !isPaid ? "text-red-600" : ""
            }`}
          >
            {dueDateOnly.toLocaleDateString("pt-BR", { timeZone: "UTC" })}
            {!isPaid && (
              <span className="ml-1">
                ({isOverdue ? `${Math.abs(daysUntilDue)} days overdue` : `${daysUntilDue} days`})
              </span>
            )}
          </span>
        </div>

        {isPaid && invoice.paidAt && (
          <>
            <div className="flex justify-between">
              <span className="text-gray-600">Paid On</span>
              <span className="font-medium text-green-600">
                {new Date(invoice.paidAt).toLocaleDateString("pt-BR")}
              </span>
            </div>
            {invoice.amountPaid && (
              <div className="flex justify-between">
                <span className="text-gray-600">Amount Paid</span>
                <span className="font-medium text-green-600">
                  ${Number(invoice.amountPaid).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}
            {invoice.paymentMethod && (
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Method</span>
                <span className="font-medium">{invoice.paymentMethod}</span>
              </div>
            )}
          </>
        )}

        {!isPaid && invoice.stripePaymentLinkId && (
          <>
            <div className="flex justify-between">
              <span className="text-gray-600">Payment Link</span>
              <span className="font-medium text-green-600">Sent</span>
            </div>
            {invoice.paymentReminderCount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Reminders Sent</span>
                <span className="font-medium">{invoice.paymentReminderCount}</span>
              </div>
            )}
          </>
        )}

        {invoice.stripePaymentIntentId && (
          <div className="flex justify-between">
            <span className="text-gray-600">Stripe ID</span>
            <span className="font-mono text-xs truncate max-w-[150px]">
              {invoice.stripePaymentIntentId}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 pt-4 border-t space-y-2">
        {canSendPaymentLink && (
          <button
            onClick={handleSendPaymentLink}
            disabled={isSending}
            className="w-full px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition disabled:opacity-50"
          >
            {isSending
              ? "Sending..."
              : invoice.stripePaymentLinkId
              ? "Resend Payment Link"
              : "Send Payment Link"}
          </button>
        )}

        {!canSendPaymentLink && !isPaid && contractStatus !== ContractStatus.SIGNED && (
          <p className="text-xs text-gray-500 text-center">
            Contract must be signed before sending payment link
          </p>
        )}
      </div>

      {message && (
        <div
          className={`mt-3 p-2 text-sm rounded ${
            message.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
