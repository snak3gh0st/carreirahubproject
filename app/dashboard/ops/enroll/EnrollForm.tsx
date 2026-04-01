"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

interface CustomerResult {
  id: string;
  name: string;
  email: string;
  cefrLevel: string | null;
}

export default function EnrollForm() {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
  const [programType, setProgramType] = useState<"PASS" | "ADVANCED" | "">("");
  // TODO: Replace with user select once /api/dashboard/users endpoint exists (returns ADMIN/OPERATIONAL users)
  const [assignedToId, setAssignedToId] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.length < 2) {
      setCustomers([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/ops/customers/search?q=${encodeURIComponent(query)}`
        );
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
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
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
        toast.success("Student enrolled successfully.");
      } else if (res.status === 409) {
        toast.error(data.error ?? "Student is already enrolled.");
      } else {
        toast.error(data.error ?? "Failed to enroll student. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const isFormValid =
    !!selectedCustomer && !!programType && !!assignedToId && !!startDate;

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
      {/* Customer typeahead */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Customer
        </label>

        {selectedCustomer ? (
          <div className="flex items-center justify-between p-3 border border-gray-300 rounded-lg bg-gray-50">
            <span className="text-sm text-gray-800">
              {selectedCustomer.name} ({selectedCustomer.email})
            </span>
            <button
              type="button"
              onClick={clearCustomer}
              className="ml-2 text-gray-400 hover:text-gray-600 text-lg leading-none"
              aria-label="Clear customer selection"
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
              placeholder="Type 2+ characters to search customers..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-verde focus:border-transparent"
              autoComplete="off"
            />
            {isSearching && (
              <span className="absolute right-3 top-2.5 text-xs text-gray-400">
                Searching...
              </span>
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
                      {c.name} &mdash; {c.email} &mdash; CEFR:{" "}
                      {c.cefrLevel ?? "Pending"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {showDropdown && customers.length === 0 && !isSearching && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm text-gray-400">
                No customers found.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Program type */}
      <div>
        <label
          htmlFor="programType"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Program Type
        </label>
        <select
          id="programType"
          value={programType}
          onChange={(e) => setProgramType(e.target.value as "PASS" | "ADVANCED" | "")}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-verde focus:border-transparent"
        >
          <option value="">Select program...</option>
          <option value="PASS">PASS</option>
          <option value="ADVANCED">ADVANCED</option>
        </select>
      </div>

      {/* Assigned to — manual input fallback (no /api/dashboard/users endpoint yet) */}
      <div>
        <label
          htmlFor="assignedToId"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Assigned Team Member (User ID)
        </label>
        <input
          id="assignedToId"
          type="text"
          value={assignedToId}
          onChange={(e) => setAssignedToId(e.target.value)}
          placeholder="Enter team member user ID..."
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-verde focus:border-transparent"
        />
        <p className="mt-1 text-xs text-gray-400">
          A user select dropdown will replace this once the users API endpoint is available.
        </p>
      </div>

      {/* Start date */}
      <div>
        <label
          htmlFor="startDate"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Start Date
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
        {isSubmitting ? "Enrolling..." : "Enroll Student"}
      </button>
    </form>
  );
}
