"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { addMonths, parseLocalDate } from "@/lib/utils/date";

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
  serviceSearch: string;
  showServiceDropdown: boolean;
}


interface InvoiceFormProps {
  customers: Customer[];
  deals: Deal[];
}

export function InvoiceForm({ customers, deals }: InvoiceFormProps) {
  const router = useRouter();
  const businessTimeZone = "America/Sao_Paulo";

  const formatDateInputInTimeZone = (date: Date) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: businessTimeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    return `${year}-${month}-${day}`;
  };

  const todayInBusinessTimeZone = formatDateInputInTimeZone(new Date());

  const [form, setForm] = useState({
    customerId: "",
    dealId: "",
    discount: "",
    discountType: "amount" as "amount" | "percentage",
    entryAmount: "",
    installments: "",
    dueDate: "",
    description: "",
  });
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [items, setItems] = useState<InvoiceItemForm[]>([
    { id: `item-${Date.now()}`, serviceItemId: "", quantity: 1, unitPrice: "", serviceSearch: "", showServiceDropdown: false },
  ]);
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>(deals);
  const [submitting, setSubmitting] = useState(false);
  const [createdInvoiceData, setCreatedInvoiceData] = useState<{
    customerId: string;
    customerName: string;
    invoiceCount: number;
    firstInvoiceId: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingItems, setLoadingItems] = useState(true);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
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


  // Filter customers based on search
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(customerSearch.toLowerCase())
  );

  useEffect(() => {
    const customerId = searchParams.get("customerId");
    if (customerId && !form.customerId) {
      setForm((prev) => ({ ...prev, customerId }));
      // Set the customer name in the search field
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        setCustomerSearch(customer.name);
      }
    }
  }, [searchParams, form.customerId, customers]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.customer-search-container')) {
        setShowCustomerDropdown(false);
      }
    };

    if (showCustomerDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCustomerDropdown]);

  // Close service dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      items.forEach((item) => {
        if (item.showServiceDropdown && !target.closest(`.service-search-container-${item.id}`)) {
          updateItemSearch(item.id, "showServiceDropdown", false);
        }
      });
    };

    const hasOpenDropdown = items.some((item) => item.showServiceDropdown);
    if (hasOpenDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [items]);

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
      { id: `item-${Date.now()}-${prev.length}`, serviceItemId: "", quantity: 1, unitPrice: "", serviceSearch: "", showServiceDropdown: false },
    ]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItemSearch = (
    id: string,
    field: "serviceSearch" | "showServiceDropdown",
    value: string | boolean
  ) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const getFilteredServices = (searchTerm: string) => {
    if (!searchTerm) return serviceItems;
    return serviceItems
      .filter((svc) =>
        svc.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a.name.localeCompare(b.name));
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
    const discountValue = getNumericValue(form.discount);
    
    if (form.discountType === "percentage") {
      const discountAmount = baseAmount * (discountValue / 100);
      return Math.max(0, baseAmount - discountAmount);
    } else {
      return Math.max(0, baseAmount - discountValue);
    }
  };

  const generateInstallmentSchedule = () => {
    const total = calculateTotal();
    const entryAmount = getNumericValue(form.entryAmount);
    const installments = getNumericValue(form.installments);
    const remaining = Math.max(0, total - entryAmount);

    const schedule = [];
    // Use UTC noon for date-only operations to prevent timezone date shifts
    const now = new Date();
    const baseDate = form.dueDate
      ? parseLocalDate(form.dueDate)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0, 0));

    // CASE 1: Single payment (a vista) - no entry, no installments
    if (entryAmount === 0 && installments === 0 && total > 0) {
      schedule.push({
        number: 1,
        amount: total,
        dueDate: baseDate.toISOString().split('T')[0],
        description: 'Pagamento a vista (completo)',
        isEntry: false,
        isSinglePayment: true,
      });
      return schedule;
    }

    // CASE 2: Entry only (no installments)
    if (entryAmount > 0 && installments === 0) {
      schedule.push({
        number: 0,
        amount: entryAmount,
        dueDate: baseDate.toISOString().split('T')[0],
        description: 'Entrada (a vista)',
        isEntry: true,
        isSinglePayment: false,
      });
      return schedule;
    }

    // CASE 3: Entry + installments
    if (entryAmount > 0) {
      schedule.push({
        number: 0,
        amount: entryAmount,
        dueDate: baseDate.toISOString().split('T')[0],
        description: 'Entrada (a vista)',
        isEntry: true,
        isSinglePayment: false,
      });
    }

    // CASE 4: Installments (with or without entry)
    if (installments > 0 && remaining > 0) {
      const installmentAmount = remaining / installments;

      for (let i = 0; i < installments; i++) {
        // Fix: When no entrada, first installment should use chosen date (i=0 → +0 months)
        const monthsToAdd = entryAmount > 0 ? i + 1 : i;
        const installmentDate = addMonths(baseDate, monthsToAdd);

        schedule.push({
          number: i + 1,
          amount: Number(installmentAmount.toFixed(2)),
          dueDate: installmentDate.toISOString().split('T')[0],
          description: `Parcela ${i + 1} de ${installments}`,
          isEntry: false,
          isSinglePayment: false,
        });
      }
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

      // Convert discount to dollar amount (handles both "amount" and "percentage" types)
      const discountRaw = form.discount === "" ? undefined : getNumericValue(form.discount);
      let discountValue: number | undefined;
      if (discountRaw !== undefined && discountRaw > 0) {
        if (form.discountType === "percentage") {
          const baseAmount = itemsPayload.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
          discountValue = Number((baseAmount * (discountRaw / 100)).toFixed(2));
        } else {
          discountValue = discountRaw;
        }
      }
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
        const firstInvoice = data.invoices[0];
        const customer = customers.find(c => c.id === form.customerId);

        // Show contract creation prompt instead of immediate redirect
        setCreatedInvoiceData({
          customerId: form.customerId,
          customerName: customer?.name || '',
          invoiceCount: data.invoices.length,
          firstInvoiceId: firstInvoice.id,
        });
      } else {
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
  const discountInputValue = getNumericValue(form.discount);
  const discountValue = form.discountType === "percentage" 
    ? subtotal * (discountInputValue / 100) 
    : discountInputValue;
  const entryValue = getNumericValue(form.entryAmount);
  const installmentsValue = getNumericValue(form.installments);
  const remaining = Math.max(0, total - entryValue);
  const perInstallment = installmentsValue > 0 ? remaining / installmentsValue : 0;
  const installmentSchedule = generateInstallmentSchedule();
  const firstInstallmentDate = installmentSchedule[0]?.dueDate;

  // Show contract creation prompt after successful invoice creation
  if (createdInvoiceData) {
    return (
      <div className="container mx-auto p-6 max-w-xl">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {createdInvoiceData.invoiceCount === 1 ? 'Fatura criada!' : `${createdInvoiceData.invoiceCount} faturas criadas!`}
          </h2>
          <p className="text-gray-600 mb-6">
            {createdInvoiceData.invoiceCount > 1
              ? `Pacote com ${createdInvoiceData.invoiceCount} parcelas criado para ${createdInvoiceData.customerName}.`
              : `Fatura criada para ${createdInvoiceData.customerName}.`
            }
          </p>

          <p className="text-sm text-gray-500 mb-6">Deseja enviar o contrato para assinatura?</p>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push(
                `/dashboard/contracts/new?customerId=${createdInvoiceData.customerId}`
              )}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Criar Contrato
            </button>
            <button
              onClick={() => router.push(`/dashboard/invoices/${createdInvoiceData.firstInvoiceId}`)}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
            >
              Ver Fatura
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Nova fatura</h1>
            <p className="text-gray-600 mt-1">Criar nova fatura no QuickBooks</p>
          </div>
          <Link
            href="/dashboard/invoices"
            className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
          >
            ← Voltar para faturas
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* Section 1: Customer Information Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Informações do Cliente</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative customer-search-container">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cliente <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  placeholder="Buscar por nome ou email..."
                  className="w-full border border-gray-300 rounded-md pl-10 pr-10 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required={!form.customerId}
                />
                {/* Search icon */}
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
                {/* Clear button */}
                {form.customerId && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, customerId: "" }));
                      setCustomerSearch("");
                      setShowCustomerDropdown(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-5 w-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                )}
              </div>
              
              {/* Dropdown */}
              {showCustomerDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                  {filteredCustomers.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      Nenhum cliente encontrado
                    </div>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({ ...prev, customerId: customer.id }));
                          setCustomerSearch(customer.name);
                          setShowCustomerDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors ${
                          form.customerId === customer.id ? 'bg-blue-100' : ''
                        }`}
                      >
                        <div className="text-sm font-medium text-gray-900">
                          {customer.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {customer.email}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Section 2: Invoice Details Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Detalhes da Fatura</h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descrição geral da fatura
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ex: Programa de migração, pacote completo"
            />
          </div>
        </div>

        {/* Section 3: Line Items Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="border-l-4 border-blue-500 pl-4 mb-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Itens da Fatura</h2>
              <button
                type="button"
                onClick={addItem}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium text-sm"
              >
                + Adicionar item
              </button>
            </div>
          </div>

          {loadingItems ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-blue-900">
              <p className="font-medium">Carregando itens do QuickBooks...</p>
            </div>
          ) : serviceItems.length === 0 ? (
            <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-lg p-4">
              <p className="text-yellow-800 font-medium">Nenhum item de serviço disponível. Verifique a configuração do QuickBooks.</p>
            </div>
          ) : serviceItems.some((item) => item.id === "no-items-found") ? (
            <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-lg p-4">
              <p className="text-yellow-800 font-medium">Nenhum item encontrado no QuickBooks. Crie itens de serviço em Produtos e Serviços no QuickBooks.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item, index) => {
                const selectedItem = serviceItems.find((svc) => svc.id === item.serviceItemId);
                const itemTotal = getNumericValue(item.unitPrice) * item.quantity;

                return (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-gray-900">Item {index + 1}</p>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-sm font-medium text-red-600 hover:text-red-700 px-3 py-1 rounded hover:bg-red-50"
                        >
                          Remover
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className={`relative service-search-container-${item.id}`}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Serviço <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={item.serviceSearch}
                            onChange={(e) => {
                              updateItemSearch(item.id, "serviceSearch", e.target.value);
                              updateItemSearch(item.id, "showServiceDropdown", true);
                            }}
                            onFocus={() => updateItemSearch(item.id, "showServiceDropdown", true)}
                            placeholder="Buscar serviço por nome..."
                            className="w-full border border-gray-300 rounded-md pl-10 pr-10 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required={!item.serviceItemId}
                          />
                          {/* Search icon */}
                          <svg
                            className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                          </svg>
                          {/* Clear button */}
                          {item.serviceItemId && (
                            <button
                              type="button"
                              onClick={() => {
                                updateItem(item.id, "serviceItemId", "");
                                updateItemSearch(item.id, "serviceSearch", "");
                                updateItemSearch(item.id, "showServiceDropdown", false);
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              <svg className="h-5 w-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M6 18L18 6M6 6l12 12"></path>
                              </svg>
                            </button>
                          )}
                        </div>
                        
                        {/* Dropdown */}
                        {item.showServiceDropdown && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                            {getFilteredServices(item.serviceSearch).length === 0 ? (
                              <div className="px-3 py-2 text-sm text-gray-500">
                                Nenhum serviço encontrado
                              </div>
                            ) : (
                              getFilteredServices(item.serviceSearch).map((svc) => (
                                <button
                                  key={svc.id}
                                  type="button"
                                  onClick={() => {
                                    updateItem(item.id, "serviceItemId", svc.id);
                                    updateItemSearch(item.id, "serviceSearch", svc.name);
                                    updateItemSearch(item.id, "showServiceDropdown", false);
                                    // Auto-populate unitPrice
                                    if (svc.unitPrice != null) {
                                      updateItem(item.id, "unitPrice", String(svc.unitPrice));
                                    }
                                  }}
                                  className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors ${
                                    item.serviceItemId === svc.id ? 'bg-blue-100' : ''
                                  }`}
                                >
                                  <div className="text-sm font-bold text-gray-900">
                                    {svc.name}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    R$ {svc.unitPrice?.toFixed(2) || "0.00"}
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Quantidade
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(item.id, "quantity", parseInt(e.target.value) || 1)
                          }
                          className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Preço unitário (USD)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.id, "unitPrice", e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Total do item
                        </label>
                        <div className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 font-mono text-lg font-semibold text-gray-900">
                          ${itemTotal.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {selectedItem?.description && (
                      <div className="pt-2 border-t border-gray-300">
                        <p className="text-sm font-medium text-gray-700">Descrição:</p>
                        <p className="text-sm text-gray-600 mt-1">{selectedItem.description}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 4: Pricing Summary Card - PROMINENT */}
        <div className="bg-blue-50 rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <h2 className="text-2xl font-bold text-blue-900 mb-6">Resumo da Fatura</h2>

          {/* Discount Field (moved here) */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Desconto
            </label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => handleChange("discountType", "amount")}
                className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                  form.discountType === "amount"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Valor (USD)
              </button>
              <button
                type="button"
                onClick={() => handleChange("discountType", "percentage")}
                className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                  form.discountType === "percentage"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Percentual (%)
              </button>
            </div>
            <input
              type="number"
              step={form.discountType === "percentage" ? "0.1" : "0.01"}
              min="0"
              max={form.discountType === "percentage" ? "100" : undefined}
              value={form.discount}
              onChange={(e) => handleChange("discount", e.target.value)}
              className="w-full md:w-1/2 border border-gray-300 rounded-md px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={form.discountType === "percentage" ? "0.0" : "0.00"}
            />
          </div>

          {/* Calculation Display */}
          <div className="bg-white rounded-lg p-5 space-y-3">
            <div className="flex justify-between text-sm text-gray-700">
              <span>Itens selecionados:</span>
              <span className="font-mono font-medium">{items.length}</span>
            </div>
            <div className="flex justify-between text-base">
              <span className="text-gray-700">Subtotal bruto:</span>
              <span className="font-mono font-semibold text-gray-900">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base">
              <span className="text-gray-700">Desconto aplicado:</span>
              <span className={discountValue > 0 ? "font-mono font-semibold text-red-600" : "font-mono text-gray-500"}>
                {discountValue > 0 ? `-$${discountValue.toFixed(2)}` : "-$0.00"}
              </span>
            </div>

            {/* Item Breakdown */}
            <div className="pt-3 border-t border-blue-200">
              <p className="text-sm font-semibold text-gray-900 mb-2">Detalhamento por item</p>
              <div className="space-y-2">
                {items.map((item, index) => {
                  const itemData = serviceItems.find((svc) => svc.id === item.serviceItemId);
                  const itemTotal = getNumericValue(item.unitPrice) * item.quantity;

                  return (
                    <div key={item.id} className="flex justify-between text-sm text-gray-700">
                      <span className="font-medium">
                        {itemData?.name || `Item ${index + 1}`}
                      </span>
                      <span className="font-mono">
                        {item.quantity} × ${getNumericValue(item.unitPrice).toFixed(2)} = ${itemTotal.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Total Section */}
            <div className="pt-3 border-t-2 border-blue-300 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-900">Total da fatura:</span>
                <span className="font-mono text-2xl font-bold text-blue-600">${total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base">
                <span className="text-gray-700">Entrada (à vista):</span>
                <span className={entryValue > 0 ? "font-mono font-semibold text-green-600" : "font-mono text-gray-500"}>
                  {entryValue > 0 ? `-$${entryValue.toFixed(2)}` : "$0.00"}
                </span>
              </div>
              <div className="flex justify-between text-base font-medium">
                <span className="text-gray-900">Saldo a parcelar:</span>
                <span className="font-mono text-lg text-gray-900">${remaining.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-700">
                <span>Número de parcelas:</span>
                <span className="font-mono font-medium">{installmentsValue || 0}</span>
              </div>
              <div className="flex justify-between text-base">
                <span className="text-gray-700">Valor por parcela:</span>
                <span className="font-mono font-semibold text-blue-600">${perInstallment.toFixed(2)}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Section 5: Payment Configuration Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Condições de Pagamento</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Entrada (USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={total}
                value={form.entryAmount}
                onChange={(e) => handleChange("entryAmount", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número de Parcelas
              </label>
              <input
                type="number"
                min="0"
                value={form.installments}
                onChange={(e) => handleChange("installments", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
              />
              {getNumericValue(form.installments) > 0 && remaining > 0 && (
                <p className="text-sm text-green-600 mt-2 font-medium">
                  Valor por parcela: ${perInstallment.toFixed(2)}
                </p>
              )}
              {getNumericValue(form.installments) > 0 && (
                <p className="text-sm text-gray-600 mt-1">
                  Total de pagamentos: {getNumericValue(form.entryAmount) > 0 ? '1 entrada + ' : ''}{getNumericValue(form.installments)} parcela{getNumericValue(form.installments) > 1 ? 's' : ''} = {getNumericValue(form.entryAmount) > 0 ? getNumericValue(form.installments) + 1 : getNumericValue(form.installments)} pagamento{(getNumericValue(form.entryAmount) > 0 ? getNumericValue(form.installments) + 1 : getNumericValue(form.installments)) > 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data de Vencimento
            </label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => handleChange("dueDate", e.target.value)}
              className="w-full md:w-1/2 border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min={todayInBusinessTimeZone}
            />
          </div>
        </div>

        {/* Section 6: Payment Schedule (installments, entry, or single payment) */}
        {installmentSchedule.length > 0 && (
          <div className={`rounded-lg shadow-md p-6 border-l-4 ${
            installmentSchedule[0]?.isSinglePayment
              ? 'bg-green-50 border-green-500'
              : 'bg-blue-50 border-blue-500'
          }`}>
            <h2 className={`text-xl font-semibold mb-4 ${
              installmentSchedule[0]?.isSinglePayment ? 'text-green-900' : 'text-blue-900'
            }`}>
              {installmentSchedule[0]?.isSinglePayment
                ? 'Pagamento a Vista'
                : 'Cronograma de Parcelas'}
            </h2>


            {/* For single payment, show a simpler view */}
            {installmentSchedule[0]?.isSinglePayment ? (
              <div className="bg-white rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-gray-900">Fatura unica</p>
                    <p className="text-sm text-gray-600">
                      Vencimento: {parseLocalDate(installmentSchedule[0].dueDate).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <span className="font-mono text-2xl font-bold text-green-600">
                    ${installmentSchedule[0].amount.toFixed(2)}
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    {installmentSchedule[0].dueDate === todayInBusinessTimeZone
                      ? 'A fatura sera enviada por email imediatamente apos a criacao.'
                      : 'A fatura sera enviada por email 5 dias antes do vencimento.'}
                  </p>
                </div>
              </div>
            ) : (
              // Existing installment schedule code
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 text-sm text-blue-900">
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">Primeiro vencimento</p>
                    <p className="font-semibold text-base">
                      {firstInstallmentDate
                        ? parseLocalDate(firstInstallmentDate).toLocaleDateString('pt-BR')
                        : "-"}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">Total de meses</p>
                    <p className="font-semibold text-base">{installmentsValue}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {installmentSchedule.map((installment) => (
                    <div
                      key={installment.number}
                      className={`rounded-lg p-3 flex justify-between items-center text-sm ${
                        installment.isEntry
                          ? 'bg-green-50 border border-green-300'
                          : 'bg-white'
                      }`}
                    >
                      <span className={`font-medium ${
                        installment.isEntry ? 'text-green-900' : 'text-gray-900'
                      }`}>
                        {installment.description}
                      </span>
                      <span className={`font-mono font-semibold ${
                        installment.isEntry ? 'text-green-600' : 'text-blue-600'
                      }`}>
                        ${installment.amount.toFixed(2)}
                      </span>
                      <span className="text-gray-600">
                        {parseLocalDate(installment.dueDate).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t-2 border-blue-300 bg-white rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-blue-900">Total de todas as faturas:</span>
                    <span className="font-mono text-lg font-bold text-blue-600">
                      ${(entryValue + remaining).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {entryValue > 0 && `Entrada: $${entryValue.toFixed(2)} + `}
                    {installmentsValue} parcela(s): ${remaining.toFixed(2)}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Form Action Buttons - Enhanced Footer */}
        <div className="bg-gray-50 rounded-lg p-6 shadow-md">
          <div className="flex justify-end gap-3">
            <Link
              href="/dashboard/invoices"
              className="px-6 py-3 border-2 border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 bg-blue-600 text-white rounded-md font-semibold text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {submitting ? "Criando fatura..." : "Criar Fatura"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
