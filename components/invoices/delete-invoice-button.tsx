"use client";

import { useState } from "react";
import { X } from "lucide-react";
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
      ? `Delete invoice ${invoiceNumber}?\n\nThis will remove it from both QuickBooks and the local database.`
      : `Delete invoice ${invoiceNumber}?\n\nThis will remove it from the local database.`;

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

      // Refresh the page to show updated list
      router.refresh();
    } catch (error: any) {
      alert(`Failed to delete invoice: ${error.message || "Unknown error"}`);
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] px-2"
      title="Delete invoice"
    >
      <X className="h-5 w-5" />
    </button>
  );
}
