"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Search, CheckSquare, Square, Loader2 } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  email: string;
  cefrLevel: string | null;
}

interface AssignableUser {
  id: string;
  name: string;
  email: string;
}

export default function BulkEnrollForm() {
  const [query, setQuery] = useState("");
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [programType, setProgramType] = useState<"PASS" | "ADVANCED" | "">("");
  const [assignedToId, setAssignedToId] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/ops/enrollments/bulk/customers").then((r) => r.json()),
      fetch("/api/ops/users").then((r) => r.json()),
    ])
      .then(([customersData, usersData]) => {
        setAllCustomers(customersData.customers ?? []);
        setFilteredCustomers(customersData.customers ?? []);
        setAssignableUsers(usersData.users ?? []);
      })
      .catch(() => toast.error("Erro ao carregar dados."))
      .finally(() => setIsLoadingCustomers(false));
  }, []);

  useEffect(() => {
    const q = query.toLowerCase();
    if (!q) {
      setFilteredCustomers(allCustomers);
      return;
    }
    setFilteredCustomers(
      allCustomers.filter(
        (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
      )
    );
  }, [query, allCustomers]);

  const toggleCustomer = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selected.size === filteredCustomers.length && filteredCustomers.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredCustomers.map((c) => c.id)));
    }
  }, [selected.size, filteredCustomers]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.size === 0 || !programType || !assignedToId || !startDate) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/ops/enrollments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerIds: Array.from(selected),
          programType,
          assignedToId,
          startDate,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        const parts: string[] = [];
        if (data.succeeded > 0) parts.push(`${data.succeeded} matriculado${data.succeeded !== 1 ? "s" : ""}`);
        if (data.skipped > 0) parts.push(`${data.skipped} já matriculado${data.skipped !== 1 ? "s" : ""}`);
        if (data.failed > 0) parts.push(`${data.failed} com erro`);
        toast.success(parts.join(" · "));

        // Remove successfully enrolled customers from the list
        setAllCustomers((prev) => prev.filter((c) => !selected.has(c.id)));
        setSelected(new Set());
      } else {
        toast.error("Erro ao processar matrículas.");
      }
    } catch {
      toast.error("Erro de rede. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const allFilteredSelected =
    filteredCustomers.length > 0 && filteredCustomers.every((c) => selected.has(c.id));
  const isFormValid = selected.size > 0 && !!programType && !!assignedToId && !!startDate;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Customer list */}
      <div className="flex-1 bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar por nome ou email..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-verde focus:border-transparent"
            />
          </div>
          <button
            type="button"
            onClick={toggleAll}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-brand-verde transition-colors whitespace-nowrap"
          >
            {allFilteredSelected ? (
              <CheckSquare className="h-4 w-4 text-brand-verde" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            {allFilteredSelected ? "Desmarcar todos" : "Selecionar todos"}
          </button>
        </div>

        {isLoadingCustomers ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-brand-verde" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">
            {query ? "Nenhum cliente encontrado para essa busca." : "Todos os clientes já estão matriculados."}
          </div>
        ) : (
          <ul className="divide-y divide-gray-50 max-h-[520px] overflow-y-auto">
            {filteredCustomers.map((c) => {
              const isSelected = selected.has(c.id);
              return (
                <li
                  key={c.id}
                  onClick={() => toggleCustomer(c.id)}
                  className={`flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors ${
                    isSelected ? "bg-brand-creme/40" : "hover:bg-gray-50/60"
                  }`}
                >
                  <div className="flex-shrink-0">
                    {isSelected ? (
                      <CheckSquare className="h-5 w-5 text-brand-verde" />
                    ) : (
                      <Square className="h-5 w-5 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                    <p className="text-xs text-gray-400 truncate">{c.email}</p>
                  </div>
                  {c.cefrLevel && (
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      {c.cefrLevel}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 text-xs text-gray-400">
          {selected.size > 0
            ? `${selected.size} cliente${selected.size !== 1 ? "s" : ""} selecionado${selected.size !== 1 ? "s" : ""}`
            : `${filteredCustomers.length} cliente${filteredCustomers.length !== 1 ? "s" : ""} disponível${filteredCustomers.length !== 1 ? "is" : ""}`}
        </div>
      </div>

      {/* Settings panel */}
      <form onSubmit={handleSubmit} className="w-full lg:w-72 bg-white rounded-2xl border border-gray-200 p-5 space-y-5 lg:sticky lg:top-8">
        <div>
          <p className="text-sm font-semibold text-brand-verde mb-1">Configurações da Matrícula</p>
          <p className="text-xs text-gray-400">Aplicado a todos os selecionados</p>
        </div>

        <div>
          <label htmlFor="programType" className="block text-sm font-medium text-gray-700 mb-1">
            Programa
          </label>
          <select
            id="programType"
            value={programType}
            onChange={(e) => setProgramType(e.target.value as "PASS" | "ADVANCED" | "")}
            required
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-verde focus:border-transparent"
          >
            <option value="">Selecione...</option>
            <option value="PASS">PASS</option>
            <option value="ADVANCED">ADVANCED</option>
          </select>
        </div>

        <div>
          <label htmlFor="assignedToId" className="block text-sm font-medium text-gray-700 mb-1">
            Responsável
          </label>
          <select
            id="assignedToId"
            value={assignedToId}
            onChange={(e) => setAssignedToId(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-verde focus:border-transparent"
          >
            <option value="">Selecione...</option>
            {assignableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
            Data de Início
          </label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-verde focus:border-transparent"
          />
        </div>

        <button
          type="submit"
          disabled={!isFormValid || isSubmitting}
          className="w-full py-2.5 px-4 bg-brand-verde text-white text-sm font-semibold rounded-xl hover:bg-brand-verde/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Matriculando...
            </span>
          ) : selected.size > 0 ? (
            `Matricular ${selected.size} cliente${selected.size !== 1 ? "s" : ""}`
          ) : (
            "Selecione clientes"
          )}
        </button>
      </form>
    </div>
  );
}
