"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Customer {
  id: string;
  name: string;
  email: string;
}

interface Deal {
  id: string;
  title: string;
  customerId: string | null;
}

interface ServiceItem {
  id: string;
  name: string;
  description?: string;
  unitPrice?: number;
  type?: string;
}

interface PriceLevel {
  id: string;
  qbId: string;
  name: string;
}

interface PaymentTerm {
  id: string;
  qbId: string;
  name: string;
  dueDays?: number;
}

interface InvoiceFormProps {
  customers: Customer[];
  deals: Deal[];
}

export function InvoiceForm({ customers, deals }: InvoiceFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    customerId: "",
    dealId: "",
    serviceItemId: "",
    quantity: 1,
    unitPrice: 0,
    discount: 0,
    entryAmount: 0,
    installments: 0,
    dueDate: "",
    description: "",
    priceLevelId: "",
    paymentTermId: "",
  });
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [priceLevels, setPriceLevels] = useState<PriceLevel[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>(deals);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingItems, setLoadingItems] = useState(true);

  // Buscar service items do QuickBooks
  useEffect(() => {
    async function fetchServiceItems() {
      try {
        const res = await fetch("/api/quickbooks/items");
        if (res.ok) {
          const data = await res.json();
          setServiceItems(Array.isArray(data) ? data : []);
        } else {
          // Se não conseguir buscar, usar itens vazios (será mostrado mensagem)
          console.warn("Failed to fetch QuickBooks items:", res.status);
          setServiceItems([]);
        }
      } catch (err) {
        console.error("Error fetching service items:", err);
        setServiceItems([]);
      } finally {
        setLoadingItems(false);
      }
    }
    fetchServiceItems();
  }, []);

  // Buscar price levels do QuickBooks
  useEffect(() => {
    async function fetchPriceLevels() {
      try {
        const res = await fetch("/api/quickbooks/price-levels");
        if (res.ok) {
          const data = await res.json();
          setPriceLevels(Array.isArray(data) ? data : []);
        } else {
          console.warn("Failed to fetch QuickBooks price levels:", res.status);
          setPriceLevels([]);
        }
      } catch (err) {
        console.error("Error fetching price levels:", err);
        setPriceLevels([]);
      }
    }
    fetchPriceLevels();
  }, []);

  // Buscar payment terms do QuickBooks
  useEffect(() => {
    async function fetchPaymentTerms() {
      try {
        const res = await fetch("/api/quickbooks/payment-terms");
        if (res.ok) {
          const data = await res.json();
          setPaymentTerms(Array.isArray(data) ? data : []);
        } else {
          console.warn("Failed to fetch QuickBooks payment terms:", res.status);
          setPaymentTerms([]);
        }
      } catch (err) {
        console.error("Error fetching payment terms:", err);
        setPaymentTerms([]);
      }
    }
    fetchPaymentTerms();
  }, []);

  // Filtrar deals quando customer mudar
  useEffect(() => {
    if (form.customerId) {
      const customerDeals = deals.filter((d) => d.customerId === form.customerId && d.customerId !== null);
      setFilteredDeals(customerDeals);
      if (customerDeals.length > 0 && !customerDeals.find((d) => d.id === form.dealId)) {
        setForm((prev) => ({ ...prev, dealId: customerDeals[0].id }));
      } else if (customerDeals.length === 0) {
        setForm((prev) => ({ ...prev, dealId: "" }));
      }
    } else {
      setFilteredDeals(deals);
    }
  }, [form.customerId, deals]);

  // Atualizar preço quando item de serviço mudar
  useEffect(() => {
    if (form.serviceItemId) {
      const item = serviceItems.find((i) => i.id === form.serviceItemId);
      if (item?.unitPrice) {
        setForm((prev) => ({ ...prev, unitPrice: item.unitPrice || 0 }));
      }
    }
  }, [form.serviceItemId, serviceItems]);

  const handleChange = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const calculateTotal = () => {
    const baseAmount = form.unitPrice * form.quantity;
    const discount = form.discount || 0;
    return Math.max(0, baseAmount - discount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!form.customerId || !form.serviceItemId) {
        throw new Error("Preencha todos os campos obrigatórios (Customer e Serviço)");
      }

      const res = await fetch("/api/invoices/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: form.customerId,
          dealId: form.dealId || undefined,
          serviceItemId: form.serviceItemId,
          quantity: form.quantity,
          unitPrice: form.unitPrice,
          discount: form.discount || undefined,
          entryAmount: form.entryAmount || undefined,
          installments: form.installments || undefined,
          dueDate: form.dueDate || undefined,
          description: form.description || undefined,
          priceLevelId: form.priceLevelId || undefined,
          paymentTermId: form.paymentTermId || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao criar invoice");
      }

      const data = await res.json();

      // API returns { invoices: [...], message, seriesId }
      if (data.invoices && data.invoices.length > 0) {
        // Redirect to first invoice (if multiple installments, user can see series from there)
        const firstInvoice = data.invoices[0];
        router.push(`/dashboard/invoices/${firstInvoice.id}`);
      } else {
        // Fallback to invoices list
        router.push("/dashboard/invoices");
      }
    } catch (err: any) {
      setError(err.message || "Erro ao criar invoice");
    } finally {
      setSubmitting(false);
    }
  };

  const total = calculateTotal();
  const remaining = Math.max(0, total - (form.entryAmount || 0));

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Nova Invoice</h1>
          <p className="text-gray-600">Criar nova fatura no QuickBooks</p>
        </div>
        <Link
          href="/dashboard/invoices"
          className="text-blue-600 hover:underline"
        >
          ← Voltar para Invoices
        </Link>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow p-6 space-y-6 max-w-2xl"
      >
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer <span className="text-red-500">*</span>
            </label>
            <select
              value={form.customerId}
              onChange={(e) => handleChange("customerId", e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            >
              <option value="">Selecione um customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} ({customer.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deal <span className="text-gray-400 text-xs">(Opcional)</span>
            </label>
            <select
              value={form.dealId}
              onChange={(e) => handleChange("dealId", e.target.value)}
              className="w-full border rounded px-3 py-2"
              disabled={!form.customerId || filteredDeals.length === 0}
            >
              <option value="">
                {form.customerId
                  ? filteredDeals.length === 0
                    ? "Nenhum deal disponível (pode continuar sem deal)"
                    : "Selecione um deal (opcional)"
                  : "Selecione um customer primeiro"}
              </option>
              {filteredDeals.map((deal) => (
                <option key={deal.id} value={deal.id}>
                  {deal.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-lg font-semibold mb-4">Item de Serviço</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Serviço <span className="text-red-500">*</span>
              </label>
              {loadingItems ? (
                <div className="w-full border rounded px-3 py-2 bg-gray-50">
                  Carregando itens...
                </div>
              ) : serviceItems.length === 0 ? (
                <div className="w-full border rounded px-3 py-2 bg-yellow-50 text-yellow-800">
                  Nenhum item de serviço disponível. Verifique a configuração do QuickBooks.
                </div>
              ) : serviceItems.some(item => item.id === "no-items-found") ? (
                <div className="w-full border rounded px-3 py-2 bg-yellow-50 text-yellow-800">
                  Nenhum item encontrado no QuickBooks. Crie itens de serviço em Products & Services no QuickBooks.
                </div>
              ) : (
                <>
                  <select
                    value={form.serviceItemId}
                    onChange={(e) => handleChange("serviceItemId", e.target.value)}
                    className="w-full border rounded px-3 py-2"
                    required
                  >
                    <option value="">Selecione um serviço ({serviceItems.length} disponíveis)</option>
                    {serviceItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  {form.serviceItemId && (
                    <p className="text-xs text-gray-500 mt-1">
                      {serviceItems.find((i) => i.id === form.serviceItemId)?.description || "Sem descrição"}
                    </p>
                  )}
                </>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantidade
              </label>
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => handleChange("quantity", parseInt(e.target.value) || 1)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preço Unitário (USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.unitPrice}
                onChange={(e) => handleChange("unitPrice", parseFloat(e.target.value) || 0)}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Desconto (USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.discount}
                onChange={(e) => handleChange("discount", parseFloat(e.target.value) || 0)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrição
            </label>
            <textarea
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              className="w-full border rounded px-3 py-2"
              rows={3}
              placeholder="Descrição do serviço..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price Level (Optional)
              </label>
              <select
                value={form.priceLevelId}
                onChange={(e) => handleChange("priceLevelId", e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Standard Pricing</option>
                {priceLevels.map((pl) => (
                  <option key={pl.id} value={pl.qbId}>
                    {pl.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Terms
              </label>
              <select
                value={form.paymentTermId}
                onChange={(e) => handleChange("paymentTermId", e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Select Payment Terms</option>
                {paymentTerms.map((term) => (
                  <option key={term.id} value={term.qbId}>
                    {term.name} {term.dueDays && `(Net ${term.dueDays})`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-lg font-semibold mb-4">Pagamento</h3>
          
          <div className="bg-gray-50 p-4 rounded mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span>Subtotal:</span>
              <span>${(form.unitPrice * form.quantity).toFixed(2)}</span>
            </div>
            {form.discount > 0 && (
              <div className="flex justify-between text-sm mb-2 text-red-600">
                <span>Desconto:</span>
                <span>-${form.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-lg border-t pt-2 mt-2">
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Entrada (USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={total}
                value={form.entryAmount}
                onChange={(e) => handleChange("entryAmount", parseFloat(e.target.value) || 0)}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Número de Parcelas
              </label>
              <input
                type="number"
                min="0"
                value={form.installments}
                onChange={(e) => handleChange("installments", parseInt(e.target.value) || 0)}
                className="w-full border rounded px-3 py-2"
              />
              {form.installments > 0 && remaining > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  Valor por parcela: ${(remaining / form.installments).toFixed(2)}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data de Vencimento
            </label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => handleChange("dueDate", e.target.value)}
              className="w-full border rounded px-3 py-2"
              min={new Date().toISOString().split("T")[0]}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Link
            href="/dashboard/invoices"
            className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Criando..." : "Criar Invoice"}
          </button>
        </div>
      </form>
    </div>
  );
}

