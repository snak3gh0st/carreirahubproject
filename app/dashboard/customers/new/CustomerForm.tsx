"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function NewCustomerForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    ssn: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "USA",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [qbSyncInfo, setQbSyncInfo] = useState<any>(null);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    setQbSyncInfo(null);

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: form.email,
          name: form.name,
          phone: form.phone || undefined,
          ssn: form.ssn || undefined,
          address: form.address || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
          zipCode: form.zipCode || undefined,
          country: form.country || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao criar customer");
      }

      setSuccess(`Cliente ${data.customer.name} criado com sucesso!`);
      setQbSyncInfo(data.quickbooksSync);

      // Clear form
      setForm({
        name: "",
        email: "",
        phone: "",
        ssn: "",
        address: "",
        city: "",
        state: "",
        zipCode: "",
        country: "USA",
      });

      // Redirect to customer detail after 2 seconds
      setTimeout(() => {
        router.push(`/dashboard/customers/${data.customer.id}`);
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Erro ao criar customer");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Novo Customer</h1>
          <p className="text-gray-600">Cadastro rápido de cliente</p>
        </div>
        <Link
          href="/dashboard/customers"
          className="text-blue-600 hover:underline"
        >
          ← Voltar para Customers
        </Link>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow p-6 space-y-4 max-w-xl"
      >
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            <div className="flex items-start">
              <div className="text-red-600 text-xl mr-3">✗</div>
              <div>
                <h3 className="font-semibold mb-1">Erro</h3>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
            <div className="flex items-start">
              <div className="text-green-600 text-xl mr-3">✓</div>
              <div>
                <h3 className="font-semibold mb-1">Cliente criado com sucesso!</h3>
                <p className="text-sm">{success}</p>
                {qbSyncInfo && (
                  <div className="mt-2 text-sm">
                    {qbSyncInfo.synced ? (
                      <div className="flex items-center text-green-800">
                        <span className="mr-2">✓</span>
                        <span>
                          Sincronizado com QuickBooks (ID: {qbSyncInfo.qbId})
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center text-yellow-700">
                        <span className="mr-2">⚠️</span>
                        <span>{qbSyncInfo.message}</span>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs mt-2 text-green-600">
                  Redirecionando para a página do cliente...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-blue-900 font-semibold mb-2 flex items-center text-sm">
            <svg
              className="w-4 h-4 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            Integração com QuickBooks
          </h3>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>✓ Cliente criado automaticamente no QuickBooks</li>
            <li>✓ Email usado como identificador único</li>
            <li>✓ Se já existir no QB, será vinculado automaticamente</li>
          </ul>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nome <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: João Silva"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: joao@example.com"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Email será usado para enviar invoices do QuickBooks
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone <span className="text-gray-400 text-xs">(Optional)</span>
            </label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="+1 (555) 123-4567"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SSN <span className="text-gray-400 text-xs">(Optional)</span>
            </label>
            <input
              type="text"
              value={form.ssn}
              onChange={(e) => handleChange("ssn", e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="xxx-xx-xxxx"
              maxLength={11}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address <span className="text-gray-400 text-xs">(Optional)</span>
          </label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => handleChange("address", e.target.value)}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="123 Main Street, Apt 4B"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              City <span className="text-gray-400 text-xs">(Optional)</span>
            </label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => handleChange("city", e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="New York"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              State <span className="text-gray-400 text-xs">(Optional)</span>
            </label>
            <input
              type="text"
              value={form.state}
              onChange={(e) => handleChange("state", e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="NY"
              maxLength={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ZIP Code <span className="text-gray-400 text-xs">(Optional)</span>
            </label>
            <input
              type="text"
              value={form.zipCode}
              onChange={(e) => handleChange("zipCode", e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="10001"
              maxLength={10}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/dashboard/customers"
            className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Salvando..." : "Salvar Customer"}
          </button>
        </div>
      </form>
    </div>
  );
}

