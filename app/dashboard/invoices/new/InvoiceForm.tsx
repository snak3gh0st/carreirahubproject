"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

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
  qbType?: string;
}

interface InvoiceItemForm {
  id: string;
  serviceItemId: string;
  quantity: number;
  unitPrice: string;
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
    discount: "",
    entryAmount: "",
    installments: "",
    dueDate: "",
    description: "",
  });
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [items, setItems] = useState<InvoiceItemForm[]>([
    { id: `item-${Date.now()}`, serviceItemId: "", quantity: 1, unitPrice: "" },
  ]);
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>(deals);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingItems, setLoadingItems] = useState(true);
  const searchParams = useSearchParams();

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


  useEffect(() => {
    const customerId = searchParams.get("customerId");
    if (customerId && !form.customerId) {
      setForm((prev) => ({ ...prev, customerId }));
    }
  }, [searchParams, form.customerId]);

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

  const handleChange = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: `item-${Date.now()}-${prev.length}`, serviceItemId: "", quantity: 1, unitPrice: "" },
    ]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItem = (
    id: string,
    field: keyof InvoiceItemForm,
    value: string | number
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const nextItem = { ...item, [field]: value } as InvoiceItemForm;

        if (field === "serviceItemId") {
          const selected = serviceItems.find((svc) => svc.id === value);
          if (selected?.unitPrice != null) {
            nextItem.unitPrice = String(selected.unitPrice);
          }
        }

        return nextItem;
      })
    );
  };

  // Helper function to get numeric value from form field (handles empty strings)
  const getNumericValue = (value: string | number): number => {
    if (typeof value === 'string') {
      return value === '' ? 0 : parseFloat(value) || 0;
    }
    return value || 0;
  };

  const calculateTotal = () => {
    const baseAmount = items.reduce(
      (sum, item) => sum + getNumericValue(item.unitPrice) * item.quantity,
      0
    );
    const discount = getNumericValue(form.discount);
    return Math.max(0, baseAmount - discount);
  };

  const generateInstallmentSchedule = () => {
    const total = calculateTotal();
    const entryAmount = getNumericValue(form.entryAmount);
    const installments = getNumericValue(form.installments);
    const remaining = Math.max(0, total - entryAmount);

    if (installments <= 0 || remaining <= 0) return [];

    const installmentAmount = remaining / installments;
    const schedule = [];
    const baseDate = form.dueDate ? new Date(form.dueDate) : new Date();

    for (let i = 0; i < installments; i++) {
      const installmentDate = new Date(baseDate);
      installmentDate.setMonth(baseDate.getMonth() + i + (entryAmount > 0 ? 1 : 0));

      schedule.push({
        number: i + 1,
        amount: Number(installmentAmount.toFixed(2)),
        dueDate: installmentDate.toISOString().split('T')[0],
        description: `Parcela ${i + 1} de ${installments}`,
      });
    }

    return schedule;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const itemsPayload = items
        .filter((item) => item.serviceItemId)
        .map((item) => {
          const itemData = serviceItems.find((svc) => svc.id === item.serviceItemId);
          return {
            serviceItemId: item.serviceItemId,
            quantity: item.quantity,
            unitPrice: getNumericValue(item.unitPrice),
            description: itemData?.name || "Item de serviço",
          };
        });

      if (!form.customerId || itemsPayload.length === 0) {
        throw new Error("Preencha todos os campos obrigatórios (Cliente e Itens)");
      }

      const discountValue = form.discount === "" ? undefined : getNumericValue(form.discount);
      const entryAmountValue = form.entryAmount === "" ? undefined : getNumericValue(form.entryAmount);
      const installmentsValue = form.installments === "" ? undefined : getNumericValue(form.installments);

      const res = await fetch("/api/invoices/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: form.customerId,
          dealId: form.dealId || undefined,
          items: itemsPayload,
          discount: discountValue,
          entryAmount: entryAmountValue,
          installments: installmentsValue,
          dueDate: form.dueDate || undefined,
          description: form.description || undefined,
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

  const subtotal = items.reduce(
    (sum, item) => sum + getNumericValue(item.unitPrice) * item.quantity,
    0
  );
  const total = calculateTotal();
  const discountValue = getNumericValue(form.discount);
  const entryValue = getNumericValue(form.entryAmount);
  const installmentsValue = getNumericValue(form.installments);
  const remaining = Math.max(0, total - entryValue);
  const perInstallment = installmentsValue > 0 ? remaining / installmentsValue : 0;
  const installmentSchedule =
    installmentsValue > 0 && remaining > 0 ? generateInstallmentSchedule() : [];
  const firstInstallmentDate = installmentSchedule[0]?.dueDate;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">Nova fatura</h1>
            <p className="text-gray-600">Criar nova fatura no QuickBooks</p>
          </div>
          <Link
            href="/dashboard/invoices"
            className="text-blue-600 hover:underline"
          >
            ← Voltar para faturas
          </Link>
        </div>

      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white"
      >
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente <span className="text-red-500">*</span>
            </label>
            <select
              value={form.customerId}
              onChange={(e) => handleChange("customerId", e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            >
              <option value="">Selecione um cliente</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} ({customer.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Negócio <span className="text-gray-400 text-xs">(Opcional)</span>
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
                  : "Selecione um cliente primeiro"}
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Itens da fatura</h3>
            <button
              type="button"
              onClick={addItem}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              + Adicionar item
            </button>
          </div>

          {loadingItems ? (
            <div className="w-full border rounded px-3 py-2 bg-gray-50">
              Carregando itens...
            </div>
          ) : serviceItems.length === 0 ? (
            <div className="w-full border rounded px-3 py-2 bg-yellow-50 text-yellow-800">
              Nenhum item de serviço disponível. Verifique a configuração do QuickBooks.
            </div>
          ) : serviceItems.some((item) => item.id === "no-items-found") ? (
            <div className="w-full border rounded px-3 py-2 bg-yellow-50 text-yellow-800">
              Nenhum item encontrado no QuickBooks. Crie itens de serviço em Produtos e Serviços no QuickBooks.
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item, index) => {
                const selectedItem = serviceItems.find((svc) => svc.id === item.serviceItemId);
                const itemTotal = getNumericValue(item.unitPrice) * item.quantity;

                return (
                  <div key={item.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">Item {index + 1}</p>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Remover
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Serviço <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={item.serviceItemId}
                          onChange={(e) => updateItem(item.id, "serviceItemId", e.target.value)}
                          className="w-full border rounded px-3 py-2"
                          required
                        >
                          <option value="">Selecione um serviço</option>
                          {serviceItems.map((svc) => (
                            <option key={svc.id} value={svc.id}>
                              {svc.name} - ${svc.unitPrice?.toFixed(2) || "0.00"}
                              {svc.type && ` (${svc.type})`}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Quantidade
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(item.id, "quantity", parseInt(e.target.value) || 1)
                          }
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Preço unitário (USD)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.id, "unitPrice", e.target.value)}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Total do item
                        </label>
                        <div className="w-full border rounded px-3 py-2 bg-gray-50">
                          ${itemTotal.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {selectedItem?.description && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Descrição:</span>
                        <p className="mt-1">{selectedItem.description}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Desconto (USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.discount}
                onChange={(e) => handleChange("discount", e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição geral da fatura
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="Ex: Programa de migração, pacote completo"
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-lg font-semibold mb-4">Cálculo da fatura</h3>

          <div className="bg-gray-50 p-4 rounded mb-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Itens selecionados:</span>
                <span className="font-mono">{items.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Subtotal bruto:</span>
                <span className="font-mono">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Desconto aplicado:</span>
                <span className={discountValue > 0 ? "font-mono text-red-600" : "font-mono text-gray-500"}>
                  {discountValue > 0 ? `-$${discountValue.toFixed(2)}` : "-$0.00"}
                </span>
              </div>
            </div>

            <div className="mt-4 border-t pt-3">
              <p className="text-sm font-medium mb-2">Resumo por item</p>
              <div className="space-y-1">
                {items.map((item, index) => {
                  const itemData = serviceItems.find((svc) => svc.id === item.serviceItemId);
                  const itemTotal = getNumericValue(item.unitPrice) * item.quantity;

                  return (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>
                        {itemData?.name || `Item ${index + 1}`}
                      </span>
                      <span className="font-mono">
                        {item.quantity} x ${getNumericValue(item.unitPrice).toFixed(2)} = ${itemTotal.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 border-t pt-3 space-y-2">
              <div className="flex justify-between font-semibold text-lg">
                <span>Total da fatura:</span>
                <span className="font-mono">${total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Entrada (à vista):</span>
                <span className={entryValue > 0 ? "font-mono text-blue-600" : "font-mono text-gray-500"}>
                  {entryValue > 0 ? `-$${entryValue.toFixed(2)}` : "-$0.00"}
                </span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span>Saldo a parcelar:</span>
                <span className="font-mono">${remaining.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Número de parcelas:</span>
                <span className="font-mono">{installmentsValue || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Valor por parcela:</span>
                <span className="font-mono">${perInstallment.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Installment Schedule Preview */}
          {installmentSchedule.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-blue-900 mb-3">Cronograma de Parcelas</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-blue-900 mb-3">
                <div className="flex items-center justify-between">
                  <span>Primeiro vencimento:</span>
                  <span className="font-medium">
                    {firstInstallmentDate
                      ? new Date(firstInstallmentDate).toLocaleDateString()
                      : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total de meses:</span>
                  <span className="font-medium">{installmentsValue}</span>
                </div>
              </div>
              <div className="space-y-2">
                {installmentSchedule.map((installment) => (
                  <div key={installment.number} className="flex justify-between text-sm bg-white">
                    <span>Parcela {installment.number}</span>
                    <span className="font-medium">${installment.amount.toFixed(2)}</span>
                    <span className="text-gray-600">{new Date(installment.dueDate).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-2 border-t border-blue-200">
                <div className="flex justify-between font-medium text-blue-900">
                  <span>Total parcelado:</span>
                  <span>${remaining.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          <h4 className="font-medium mb-3">Configurações de Pagamento</h4>

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
                onChange={(e) => handleChange("entryAmount", e.target.value)}
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
                onChange={(e) => handleChange("installments", e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
              {getNumericValue(form.installments) > 0 && remaining > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  Valor por parcela: ${perInstallment.toFixed(2)}
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
