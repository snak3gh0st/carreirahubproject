"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface CustomerEditFormProps {
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    ssn: string | null;
    passport: string | null;
    cpf: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    country: string | null;
    quickbooks_id: string | null;
    clint_contact_id: string | null;
  };
}

export function CustomerEditForm({ customer }: CustomerEditFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: customer.name || "",
    phone: customer.phone || "",
    ssn: customer.ssn || "",
    passport: customer.passport || "",
    cpf: customer.cpf || "",
    address: customer.address || "",
    city: customer.city || "",
    state: customer.state || "",
    zipCode: customer.zipCode || "",
    country: customer.country || "USA",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone || undefined,
          ssn: form.ssn || undefined,
          passport: form.passport || undefined,
          cpf: form.cpf || undefined,
          address: form.address || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
          zipCode: form.zipCode || undefined,
          country: form.country || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao atualizar customer");
      }

      setSuccess(`Cliente ${data.customer.name} atualizado com sucesso!`);

      // Redirect to customer detail after 2 seconds
      setTimeout(() => {
        router.push(`/dashboard/customers/${customer.id}`);
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar customer");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Editar Cliente</h1>
          <p className="text-gray-600">Atualização de dados do cliente</p>
        </div>
        <Link
          href={`/dashboard/customers/${customer.id}`}
          className="text-blue-600 hover:underline"
        >
          ← Voltar para Cliente
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
                <h3 className="font-semibold mb-1">Cliente atualizado com sucesso!</h3>
                <p className="text-sm">{success}</p>
                <p className="text-xs mt-2 text-green-600">
                  Redirecionando para a página do cliente...
                </p>
              </div>
            </div>
          </div>
        )}

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
            Email <span className="text-gray-400 text-xs">(Somente leitura)</span>
          </label>
          <input
            type="email"
            value={customer.email}
            disabled
            className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-600 cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 mt-1">
            Email é o identificador único e não pode ser alterado. Contate o suporte para mesclar registros de clientes.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Telefone <span className="text-gray-400 text-xs">(Opcional)</span>
          </label>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="+1 (555) 123-4567"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SSN (últimos 4 dígitos) <span className="text-gray-400 text-xs">(Opcional)</span>
            </label>
            <input
              type="text"
              value={form.ssn}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                handleChange("ssn", val);
              }}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="1234"
              maxLength={4}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Passaporte <span className="text-gray-400 text-xs">(Opcional)</span>
            </label>
            <input
              type="text"
              value={form.passport}
              onChange={(e) => handleChange("passport", e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Número do passaporte"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CPF <span className="text-gray-400 text-xs">(Opcional)</span>
            </label>
            <input
              type="text"
              value={form.cpf}
              onChange={(e) => handleChange("cpf", e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="000.000.000-00"
              maxLength={14}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Endereço <span className="text-gray-400 text-xs">(Opcional)</span>
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
              Cidade <span className="text-gray-400 text-xs">(Opcional)</span>
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
              Estado <span className="text-gray-400 text-xs">(Opcional)</span>
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
              CEP <span className="text-gray-400 text-xs">(Opcional)</span>
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
            href={`/dashboard/customers/${customer.id}`}
            className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>
      </form>
    </div>
  );
}
