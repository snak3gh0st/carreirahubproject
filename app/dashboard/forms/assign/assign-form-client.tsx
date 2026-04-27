"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, ClipboardList, User, CheckCircle2, FileText, Loader2 } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  email: string;
}

interface TemplateOption {
  id: string;
  title: string;
  titlePt: string;
  description: string;
  fieldCount: number;
}

interface AssignFormClientProps {
  customers: Customer[];
  templateOptions: TemplateOption[];
  preselectedCustomerId?: string;
}

export function AssignFormClient({
  customers,
  templateOptions,
  preselectedCustomerId,
}: AssignFormClientProps) {
  const router = useRouter();

  const [templateId, setTemplateId] = useState("");
  const [customerId, setCustomerId] = useState(preselectedCustomerId || "");
  const [customerSearch, setCustomerSearch] = useState(() => {
    if (preselectedCustomerId) {
      const c = customers.find((c) => c.id === preselectedCustomerId);
      return c ? c.name : "";
    }
    return "";
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showCustomerList, setShowCustomerList] = useState(!preselectedCustomerId);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 20);
    const term = customerSearch.toLowerCase();
    return customers.filter(
      (c) => c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term)
    ).slice(0, 20);
  }, [customers, customerSearch]);

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const selectedTemplate = templateOptions.find((t) => t.id === templateId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!templateId) { setError("Selecione um formulário."); return; }
    if (!customerId) { setError("Selecione um cliente."); return; }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/dashboard/forms/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, templateId }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Falha ao atribuir formulário.");
      }
      setSuccess(true);
      setTimeout(() => router.push("/dashboard/forms"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Step 1: Select Template */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-bold">1</div>
          <h2 className="text-sm font-display font-semibold text-gray-700 uppercase tracking-wide">Escolha o Formulário</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {templateOptions.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplateId(t.id)}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                templateId === t.id
                  ? "border-primary-500 bg-primary-50 shadow-sm"
                  : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${templateId === t.id ? "bg-primary-100" : "bg-gray-100"}`}>
                  <ClipboardList className={`h-4 w-4 ${templateId === t.id ? "text-primary-600" : "text-gray-500"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-display font-semibold text-sm ${templateId === t.id ? "text-primary-700" : "text-gray-900"}`}>
                    {t.titlePt}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{t.description}</p>
                  <p className="text-xs text-gray-400 mt-1">{t.fieldCount} campos</p>
                </div>
                {templateId === t.id && (
                  <CheckCircle2 className="h-5 w-5 text-primary-600 flex-shrink-0" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Select Customer */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-bold">2</div>
          <h2 className="text-sm font-display font-semibold text-gray-700 uppercase tracking-wide">Selecione o Cliente</h2>
        </div>

        {selectedCustomer && !showCustomerList ? (
          <div className="flex items-center justify-between p-4 bg-primary-50 rounded-xl border border-primary-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                <span className="text-sm font-bold text-primary-600">
                  {selectedCustomer.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-display font-semibold text-gray-900">{selectedCustomer.name}</p>
                <p className="text-xs text-gray-500">{selectedCustomer.email}</p>
              </div>
            </div>
            <button type="button" onClick={() => setShowCustomerList(true)} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
              Trocar
            </button>
          </div>
        ) : (
          <>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerList(true); }}
                placeholder="Buscar por nome ou email..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                autoFocus={!preselectedCustomerId}
              />
            </div>

            <div className="max-h-[280px] overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
              {filteredCustomers.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500">
                  Nenhum cliente encontrado
                </div>
              ) : (
                filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setCustomerId(c.id); setCustomerSearch(c.name); setShowCustomerList(false); }}
                    className={`w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors ${
                      customerId === c.id ? "bg-primary-50" : ""
                    }`}
                  >
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-gray-600">
                        {c.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-500 truncate">{c.email}</p>
                    </div>
                    {customerId === c.id && <CheckCircle2 className="h-4 w-4 text-primary-600 flex-shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Summary & Submit */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Formulário atribuído com sucesso! Redirecionando...
          </div>
        )}

        {selectedTemplate && selectedCustomer && !success && (
          <div className="mb-4 p-4 bg-gray-50 rounded-xl text-sm">
            <p className="text-gray-600">
              <span className="font-semibold text-gray-900">{selectedTemplate.titlePt}</span> será atribuído a{" "}
              <span className="font-semibold text-gray-900">{selectedCustomer.name}</span>.
              O cliente poderá preencher pelo hub do cliente.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || success || !templateId || !customerId}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-medium rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all shadow-md shadow-primary-600/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {isSubmitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Atribuindo...</>
          ) : (
            <><ClipboardList className="h-4 w-4" /> Atribuir Formulário</>
          )}
        </button>
      </div>
    </form>
  );
}
