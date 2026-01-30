"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface DeleteCustomerButtonProps {
  customerId: string;
  customerName: string;
  quickbooksId: string | null;
  userRole: string;
}

export function DeleteCustomerButton({
  customerId,
  customerName,
  quickbooksId,
  userRole,
}: DeleteCustomerButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  // Only show for ADMIN and FINANCE
  if (userRole !== "ADMIN" && userRole !== "FINANCE") {
    return null;
  }

  const handleDelete = async () => {
    if (!quickbooksId) {
      alert("Cannot delete customer: QuickBooks ID is required for deletion.");
      return;
    }

    const confirmMessage = `Delete customer "${customerName}"?\n\nThis will delete the customer from both the system and QuickBooks. This action cannot be undone.\n\nAre you sure you want to continue?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch("/api/customers/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ qbCustomerId: quickbooksId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete customer");
      }

      const result = await response.json();

      // Show success message
      alert(`Customer "${customerName}" deleted successfully from both the system and QuickBooks.`);

      // Redirect to customers list
      router.push("/dashboard/customers");
    } catch (error: any) {
      console.error("Failed to delete customer:", error);
      alert(`Failed to delete customer: ${error.message || "Unknown error"}`);
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting || !quickbooksId}
      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 text-white text-sm font-display font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title={
        !quickbooksId
          ? "Customer must have QuickBooks ID to delete"
          : "Delete customer"
      }
    >
      <Trash2 className="w-4 h-4" />
      {isDeleting ? "Deleting..." : "Delete Customer"}
    </button>
  );
}
