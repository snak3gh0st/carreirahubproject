"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface DeleteInvoiceButtonProps {
  invoiceId: string;
  invoiceNumber: string;
  hasQuickbooksId: boolean;
  userRole: string;
}

export function DeleteInvoiceButton({
  invoiceId,
  invoiceNumber,
  hasQuickbooksId,
  userRole,
}: DeleteInvoiceButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  // Only show for ADMIN and FINANCE
  if (userRole !== "ADMIN" && userRole !== "FINANCE") {
    return null;
  }

  const handleDelete = async () => {
    const confirmMessage = hasQuickbooksId
      ? `Anular fatura ${invoiceNumber}?\n\nIsso marcará como anulada no QuickBooks (definindo o saldo como $0) e a removerá do sistema.\n\nA anulação define o saldo da fatura como $0 e a marca como anulada. Esta operação não pode ser desfeita.`
      : `Tem certeza que deseja excluir a fatura ${invoiceNumber}?\n\nIsso a removerá do banco de dados local.\n\nEsta ação não pode ser desfeita.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Falha ao anular fatura");
      }

      const result = await response.json();

      // Show appropriate success message
      if (result.quickbooksError) {
        alert(
          `Fatura excluída localmente, mas a anulação no QuickBooks falhou:\n${result.quickbooksError}\n\nVerifique os Logs de Integração para detalhes.`
        );
      } else if (result.voidedInQuickBooks) {
        alert(`Fatura ${invoiceNumber} anulada com sucesso no QuickBooks e removida do banco de dados local.`);
      } else {
        alert(`Fatura ${invoiceNumber} excluída com sucesso.`);
      }

      // Redirect to invoice list instead of just refreshing
      router.push('/dashboard/invoices');
    } catch (error: any) {
      alert(`Falha ao anular fatura: ${error.message || "Erro desconhecido"}`);
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors"
      title={hasQuickbooksId ? "Anular fatura no QuickBooks" : "Excluir fatura"}
    >
      <Trash2 className="w-4 h-4" />
      {isDeleting ? (hasQuickbooksId ? 'Anulando...' : 'Excluindo...') : (hasQuickbooksId ? 'Anular Fatura' : 'Excluir')}
    </button>
  );
}
