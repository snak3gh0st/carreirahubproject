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
    dateOfBirth: "",
    identificationType: "passport",
    ssn: "",
    passport: "",
    cpf: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "USA",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(null);
  };

  const handleSsnChange = (value: string) => {
    handleChange("ssn", value.replace(/\D/g, "").slice(-4));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

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
          dateOfBirth: form.dateOfBirth || undefined,
          ssn: form.identificationType === "ssn" ? form.ssn : undefined,
          passport: form.identificationType === "passport" ? form.passport : undefined,
          cpf: form.identificationType === "cpf" ? form.cpf : undefined,
          address: form.address || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
          zipCode: form.zipCode || undefined,
          country: form.country || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const validationMessage = Array.isArray(data.details)
          ? data.details.map((detail: any) => detail.message).join(", ")
          : null;
        throw new Error(validationMessage || data.error || "Erro ao criar cliente");
      }

      setSuccess(`Cliente ${data.customer.name} criado com sucesso!`);

      // Clear form
      setForm({
        name: "",
        email: "",
        phone: "",
        dateOfBirth: "",
        identificationType: "passport",
        ssn: "",
        passport: "",
        cpf: "",
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
      setError(err.message || "Erro ao criar cliente");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Novo Cliente</h1>
          <p className="text-gray-600">Cadastro rápido de cliente</p>
        </div>
        <Link
          href="/dashboard/customers"
          className="text-blue-600 hover:underline"
        >
          ← Voltar para Clientes
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
            Email usado para acesso ao hub e envio de comunicados.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Telefone <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="+1 (555) 123-4567"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Data de Nascimento <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => handleChange("dateOfBirth", e.target.value)}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="DD/MM/AAAA"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de identificação <span className="text-red-500">*</span>
            </label>
            <select
              value={form.identificationType}
              onChange={(e) => {
                const nextType = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  identificationType: nextType,
                  ssn: nextType === "ssn" ? prev.ssn : "",
                  passport: nextType === "passport" ? prev.passport : "",
                  cpf: nextType === "cpf" ? prev.cpf : "",
                }));
                setError(null);
                setSuccess(null);
              }}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="ssn">SSN</option>
              <option value="passport">Passaporte</option>
              <option value="cpf">CPF</option>
            </select>
          </div>
          {form.identificationType === "ssn" ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SSN (ultimos 4 digitos) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={form.ssn}
                onChange={(e) => handleSsnChange(e.target.value)}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="1234"
                maxLength={4}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                O SSN e protegido no sistema; apenas os 4 ultimos digitos ficam visiveis.
              </p>
            </div>
          ) : form.identificationType === "passport" ? (
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Passaporte <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.passport}
              onChange={(e) => handleChange("passport", e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Número do passaporte"
              required
            />
          </div>
          ) : (
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CPF <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.cpf}
              onChange={(e) => handleChange("cpf", e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="000.000.000-00"
              maxLength={14}
              required
            />
          </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Endereço <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => handleChange("address", e.target.value)}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="123 Main Street, Apt 4B"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cidade <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => handleChange("city", e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="New York"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.state}
              onChange={(e) => handleChange("state", e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="NY"
              maxLength={2}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CEP <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.zipCode}
              onChange={(e) => handleChange("zipCode", e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="10001"
              maxLength={10}
              required
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
            {submitting ? "Salvando..." : "Salvar Cliente"}
          </button>
        </div>
      </form>
    </div>
  );
}
