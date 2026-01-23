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
      ? `Are you sure you want to delete invoice ${invoiceNumber}?\n\nThis will remove it from both QuickBooks and the local database.\n\nThis action cannot be undone.`
      : `Are you sure you want to delete invoice ${invoiceNumber}?\n\nThis will remove it from the local database.\n\nThis action cannot be undone.`;

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
        throw new Error(error.error || "Failed to delete invoice");
      }

      const result = await response.json();

      // Show appropriate success message
      if (result.quickbooksError) {
        alert(
          `Invoice deleted locally, but QuickBooks deletion failed:\n${result.quickbooksError}\n\nCheck Integration Logs for details.`
        );
      } else if (result.deletedFromQuickBooks) {
        alert(`Invoice ${invoiceNumber} deleted from QuickBooks and local database.`);
      } else {
        alert(`Invoice ${invoiceNumber} deleted successfully.`);
      }

      // Redirect to invoice list instead of just refreshing
      router.push('/dashboard/invoices');
    } catch (error: any) {
      alert(`Failed to delete invoice: ${error.message || "Unknown error"}`);
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors"
      title="Delete invoice"
    >
      <Trash2 className="w-4 h-4" />
      {isDeleting ? 'Deleting...' : 'Delete'}
    </button>
  );
}
