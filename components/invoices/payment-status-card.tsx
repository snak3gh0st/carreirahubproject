"use client";

import { useState } from "react";
import { InvoiceStatus } from "@prisma/client";
import { normalizeDateOnly, differenceInCalendarDaysUTC } from "@/lib/utils/date";
import { isInvoicePaymentComplete } from "@/lib/invoices/contract-invoice-policy";

interface PaymentStatusCardProps {
  invoice: {
    id: string;
    invoiceNumber: string | null;
    status: InvoiceStatus;
    quickbooksInvoiceId: string | null;
    amount: any;
    dueDate: Date | string;
    paidAt: Date | null;
    amountPaid: any | null;
    paymentMethod: string | null;
    lastPaymentReminderAt: Date | null;
    paymentReminderCount: number;
  };
}

export function getPaymentStatusDisplay({
  status,
  amount,
  amountPaid,
  paidAt,
  daysUntilDue,
}: {
  status: InvoiceStatus;
  amount: any;
  amountPaid: any | null;
  paidAt: Date | null;
  daysUntilDue: number;
}) {
  const isVoid = status === InvoiceStatus.VOID;
  const isPaid = isInvoicePaymentComplete({ status, amount, amountPaid, paidAt });
  const isOverdue = !isPaid && !isVoid && daysUntilDue < 0;

  if (isPaid) {
    return {
      label: "Pago",
      badgeClass: "bg-green-100 text-green-800",
      isPaid,
      isOverdue,
      isVoid,
    };
  }

  if (isVoid) {
    return {
      label: "Anulada",
      badgeClass: "bg-gray-100 text-gray-700",
      isPaid,
      isOverdue,
      isVoid,
    };
  }

  if (isOverdue) {
    return {
      label: "Em atraso",
      badgeClass: "bg-red-100 text-red-800",
      isPaid,
      isOverdue,
      isVoid,
    };
  }

  return {
    label: "Pendente",
    badgeClass: "bg-yellow-100 text-yellow-800",
    isPaid,
    isOverdue,
    isVoid,
  };
}

export function PaymentStatusCard({ invoice }: PaymentStatusCardProps) {
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
        throw new Error(data.error || "Falha ao enviar o link de pagamento");
      }

      setMessage({ type: "success", text: "Link de pagamento enviado com sucesso" });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Falha ao enviar o link de pagamento",
      });
    } finally {
      setIsSending(false);
    }
  };

  const dueDateOnly = normalizeDateOnly(invoice.dueDate);
  const daysUntilDue = differenceInCalendarDaysUTC(dueDateOnly, new Date());
  const paymentStatus = getPaymentStatusDisplay({
    status: invoice.status,
    amount: invoice.amount,
    amountPaid: invoice.amountPaid,
    paidAt: invoice.paidAt,
    daysUntilDue,
  });
  const isOverdue = paymentStatus.isOverdue;
  const isPaid = paymentStatus.isPaid;
  const canSendPaymentLink =
    !isPaid &&
    invoice.status !== InvoiceStatus.VOID &&
    !!invoice.quickbooksInvoiceId;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Status do Pagamento</h3>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${paymentStatus.badgeClass}`}
        >
          {paymentStatus.label}
        </span>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Valor</span>
          <span className="font-medium">
            ${Number(invoice.amount).toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">Vencimento</span>
          <span
            className={`font-medium ${
              isOverdue && !isPaid ? "text-red-600" : ""
            }`}
          >
            {dueDateOnly.toLocaleDateString("pt-BR", { timeZone: "UTC" })}
            {!isPaid && !paymentStatus.isVoid && (
              <span className="ml-1">
                ({isOverdue ? `${Math.abs(daysUntilDue)} dias em atraso` : `${daysUntilDue} dias`})
              </span>
            )}
          </span>
        </div>

        {isPaid && invoice.paidAt && (
          <>
            <div className="flex justify-between">
              <span className="text-gray-600">Pago em</span>
              <span className="font-medium text-green-600">
                {new Date(invoice.paidAt).toLocaleDateString("pt-BR")}
              </span>
            </div>
            {invoice.amountPaid && (
              <div className="flex justify-between">
                <span className="text-gray-600">Valor pago</span>
                <span className="font-medium text-green-600">
                  ${Number(invoice.amountPaid).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}
            {invoice.paymentMethod && (
              <div className="flex justify-between">
                <span className="text-gray-600">Metodo</span>
                <span className="font-medium">{invoice.paymentMethod}</span>
              </div>
            )}
          </>
        )}

        {!isPaid && invoice.paymentReminderCount > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-600">Lembretes enviados</span>
            <span className="font-medium">{invoice.paymentReminderCount}</span>
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
            {isSending ? "Enviando..." : "Enviar link de pagamento"}
          </button>
        )}

        {!canSendPaymentLink && !isPaid && invoice.status !== InvoiceStatus.VOID && (
          <p className="text-xs text-gray-500 text-center">
            Sincronize a invoice com o QuickBooks para enviar o link ao cliente
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
