"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface DeleteCustomerButtonProps {
  customerId: string;
  customerName: string;
  userRole: string;
}

export function DeleteCustomerButton({
  customerId,
  customerName,
  userRole,
}: DeleteCustomerButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  // Only show for ADMIN and FINANCE
  if (userRole !== "ADMIN" && userRole !== "FINANCE") {
    return null;
  }

  const handleDelete = async () => {
    const confirmName = prompt(
      `Para excluir "${customerName}", digite exatamente o nome do cliente.\n\nEsta ação remove o cliente, faturas, contratos, formulários, testes e vínculos operacionais.`
    );

    if (confirmName === null) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch("/api/customers/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ customerId, confirmName }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete customer");
      }

      await response.json();
      alert(`Cliente "${customerName}" excluído com sucesso.`);

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
      disabled={isDeleting}
      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 text-white text-sm font-display font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title="Excluir cliente"
    >
      <Trash2 className="w-4 h-4" />
      {isDeleting ? "Excluindo..." : "Excluir Cliente"}
    </button>
  );
}
