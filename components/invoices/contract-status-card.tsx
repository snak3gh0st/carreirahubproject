"use client";

import { ContractStatusBadge } from "./contract-status-badge";
import { ContractStatus } from "@prisma/client";
import { useState } from "react";

interface Contract {
  id: string;
  docusign_env_id: string | null;
  status: ContractStatus;
  signedUrl: string | null;
  sentAt: Date | null;
  signedAt: Date | null;
  expiresAt: Date | null;
  reminderCount: number;
  lastReminderAt: Date | null;
  signerEmail: string;
  signerName: string;
}

interface ContractStatusCardProps {
  contract: Contract | null;
  invoiceId: string;
  customerEmail: string;
  customerName: string;
}

export function ContractStatusCard({
  contract,
  invoiceId,
  customerEmail,
  customerName,
}: ContractStatusCardProps) {
  const [isResending, setIsResending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleResendContract = async () => {
    setIsResending(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/resend-contract`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Falha ao reenviar o contrato");
      }

      setMessage({ type: "success", text: "Lembrete do contrato enviado com sucesso" });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Falha ao reenviar o contrato",
      });
    } finally {
      setIsResending(false);
    }
  };

  if (!contract) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold mb-4">Contrato do pacote</h3>
        <p className="text-gray-500 text-sm">
          Nenhum contrato foi gerado para o pacote deste servico.
        </p>
      </div>
    );
  }

  const daysRemaining = contract.expiresAt
    ? Math.ceil(
        (new Date(contract.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Contrato do pacote</h3>
        <ContractStatusBadge status={contract.status} />
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Assinante</span>
          <span className="font-medium">{contract.signerName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Email</span>
          <span className="font-medium">{contract.signerEmail}</span>
        </div>

        {contract.sentAt && (
          <div className="flex justify-between">
            <span className="text-gray-600">Enviado em</span>
            <span className="font-medium">
              {new Date(contract.sentAt).toLocaleDateString("pt-BR")}
            </span>
          </div>
        )}

        {contract.status === ContractStatus.SIGNED && contract.signedAt && (
          <div className="flex justify-between">
            <span className="text-gray-600">Assinado em</span>
            <span className="font-medium text-green-600">
              {new Date(contract.signedAt).toLocaleDateString("pt-BR")}
            </span>
          </div>
        )}

        {contract.status === ContractStatus.SENT_FOR_SIGNATURE && contract.expiresAt && (
          <>
            <div className="flex justify-between">
              <span className="text-gray-600">Expira em</span>
              <span
                className={`font-medium ${
                  daysRemaining && daysRemaining <= 7 ? "text-orange-600" : ""
                }`}
              >
                {new Date(contract.expiresAt).toLocaleDateString("pt-BR")}
                {daysRemaining !== null && ` (${daysRemaining} dias)`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Lembretes enviados</span>
              <span className="font-medium">{contract.reminderCount}</span>
            </div>
          </>
        )}

        {contract.docusign_env_id && (
          <div className="flex justify-between">
            <span className="text-gray-600">DocuSign ID</span>
            <span className="font-mono text-xs">{contract.docusign_env_id}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 pt-4 border-t space-y-2">
        {contract.status === ContractStatus.SENT_FOR_SIGNATURE && (
          <button
            onClick={handleResendContract}
            disabled={isResending}
            className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition disabled:opacity-50"
          >
            {isResending ? "Enviando..." : "Reenviar lembrete do contrato"}
          </button>
        )}

        {contract.status === ContractStatus.SIGNED && contract.signedUrl && (
          <a
            href={contract.signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition text-center"
          >
            Ver contrato assinado
          </a>
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
