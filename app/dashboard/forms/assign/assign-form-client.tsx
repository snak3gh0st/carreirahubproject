"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Customer {
  id: string;
  name: string;
  email: string;
}

interface TemplateOption {
  id: string;
  title: string;
}

interface AssignFormClientProps {
  customers: Customer[];
  templateOptions: TemplateOption[];
}

export function AssignFormClient({
  customers,
  templateOptions,
}: AssignFormClientProps) {
  const router = useRouter();

  const [templateId, setTemplateId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Filter customers by search term
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const term = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term)
    );
  }, [customers, customerSearch]);

  const selectedCustomer = customers.find((c) => c.id === customerId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!templateId) {
      setError("Selecione um formulario.");
      return;
    }

    if (!customerId) {
      setError("Selecione um cliente.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/dashboard/forms/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, templateId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Falha ao atribuir formulario.");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard/forms");
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro desconhecido ao atribuir."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
        {/* Template Select */}
        <div>
          <label
            htmlFor="templateId"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Formulario
          </label>
          <select
            id="templateId"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Selecione um formulario...</option>
            {templateOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>

        {/* Customer Search + Select */}
        <div>
          <label
            htmlFor="customerSearch"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Cliente
          </label>

          {/* Search input */}
          <div className="relative mb-2">
            <svg
              className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              id="customerSearch"
              type="text"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Buscar por nome ou email..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Customer dropdown */}
          <select
            id="customerId"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            size={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {filteredCustomers.length === 0 ? (
              <option disabled value="">
                Nenhum cliente encontrado
              </option>
            ) : (
              filteredCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.email})
                </option>
              ))
            )}
          </select>

          {selectedCustomer && (
            <p className="mt-2 text-sm text-gray-600">
              Selecionado:{" "}
              <span className="font-medium text-gray-900">
                {selectedCustomer.name}
              </span>{" "}
              &mdash; {selectedCustomer.email}
            </p>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Success message */}
        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            Formulario atribuido com sucesso! Redirecionando...
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <Link
            href="/dashboard/forms"
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Voltar
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || success}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Atribuindo...
              </>
            ) : (
              "Atribuir Formulario"
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
