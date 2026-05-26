"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

interface CustomerResult {
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

export default function EnrollForm() {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
  const [programType, setProgramType] = useState<"PASS" | "ADVANCED" | "EARLY_CAREER" | "">("");
  // TODO: Replace with user select once /api/dashboard/users endpoint exists
  const [assignedToId, setAssignedToId] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/ops/users")
      .then((r) => r.json())
      .then((d) => setAssignableUsers(d.users ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setCustomers([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ops/customers/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setCustomers(data.customers ?? []);
          setShowDropdown(true);
        }
      } catch {
        // silently ignore network errors during typeahead
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function selectCustomer(customer: CustomerResult) {
    setSelectedCustomer(customer);
    setQuery("");
    setCustomers([]);
    setShowDropdown(false);
  }

  function clearCustomer() {
    setSelectedCustomer(null);
    setQuery("");
    setCustomers([]);
    setShowDropdown(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomer || !programType || !assignedToId || !startDate) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/ops/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          programType,
          assignedToId,
          startDate,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSelectedCustomer(null);
        setQuery("");
        setProgramType("");
        setAssignedToId("");
        setStartDate(new Date().toISOString().split("T")[0]);
        toast.success("Cliente matriculado com sucesso.");
      } else if (res.status === 409) {
        toast.error(data.error ?? "Este cliente já possui uma matrícula ativa.");
      } else {
        toast.error(data.error ?? "Erro ao matricular cliente. Tente novamente.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const isFormValid = !!selectedCustomer && !!programType && !!assignedToId && !!startDate;

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      {/* Customer typeahead */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>

        {selectedCustomer ? (
          <div className="flex items-center justify-between p-3 border border-gray-300 rounded-lg bg-gray-50">
            <span className="text-sm text-gray-800">
              {selectedCustomer.name} ({selectedCustomer.email})
            </span>
            <button
              type="button"
              onClick={clearCustomer}
              className="ml-2 text-gray-400 hover:text-gray-600 text-lg leading-none"
              aria-label="Limpar seleção"
            >
              &times;
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite 2+ caracteres para buscar..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-verde focus:border-transparent"
              autoComplete="off"
            />
            {isSearching && (
              <span className="absolute right-3 top-2.5 text-xs text-gray-400">Buscando...</span>
            )}
            {showDropdown && customers.length > 0 && (
              <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                {customers.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => selectCustomer(c)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                    >
                      {c.name} &mdash; {c.email} &mdash; CEFR: {c.cefrLevel ?? "Pendente"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {showDropdown && customers.length === 0 && !isSearching && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm text-gray-400">
                Nenhum cliente encontrado.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Program type */}
      <div>
        <label htmlFor="programType" className="block text-sm font-medium text-gray-700 mb-1">
          Programa
        </label>
        <select
          id="programType"
          value={programType}
          onChange={(e) => setProgramType(e.target.value as "PASS" | "ADVANCED" | "EARLY_CAREER" | "")}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-verde focus:border-transparent"
        >
          <option value="">Selecione o programa...</option>
          <option value="PASS">Programa Pass</option>
          <option value="ADVANCED">Programa Pass Advanced</option>
          <option value="EARLY_CAREER">Programa Early Career</option>
        </select>
      </div>

      {/* Assigned to */}
      <div>
        <label htmlFor="assignedToId" className="block text-sm font-medium text-gray-700 mb-1">
          Responsável
        </label>
        <select
          id="assignedToId"
          value={assignedToId}
          onChange={(e) => setAssignedToId(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-verde focus:border-transparent"
        >
          <option value="">Selecione o responsável...</option>
          {assignableUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.email})
            </option>
          ))}
        </select>
      </div>

      {/* Start date */}
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
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-verde focus:border-transparent"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!isFormValid || isSubmitting}
        className="w-full py-2.5 px-4 bg-brand-verde text-white text-sm font-semibold rounded-lg hover:bg-brand-verde/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? "Matriculando..." : "Matricular Cliente"}
      </button>
    </form>
  );
}
