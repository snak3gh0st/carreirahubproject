"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface MobileFilterModalProps {
  currentFilters: {
    dueDateFrom?: string;
    dueDateTo?: string;
    minAmount?: string;
    maxAmount?: string;
    paymentMethod?: string;
    balanceStatus?: string;
    minInvoices?: string;
    maxInvoices?: string;
    minTotalInvoiced?: string;
    maxTotalInvoiced?: string;
    createdFrom?: string;
    createdTo?: string;
    dateFrom?: string;
    dateTo?: string;
    customerId?: string;
  };
  preserveParams: { [key: string]: string };
  filterType: "invoices" | "customers" | "payments";
  activeFilterCount: number;
}

export function MobileFilterModal({
  currentFilters,
  preserveParams,
  filterType,
  activeFilterCount,
}: MobileFilterModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Close modal on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsOpen(false);
    }
  };

  // Close modal on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const params = new URLSearchParams();

    // Preserve existing params
    Object.entries(preserveParams).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    // Add filter values
    formData.forEach((value, key) => {
      if (value) params.set(key, value.toString());
    });

    const basePath =
      filterType === "invoices"
        ? "/dashboard/invoices"
        : filterType === "customers"
        ? "/dashboard/customers"
        : "/dashboard/payments";

    router.push(`${basePath}?${params.toString()}`);
    setIsOpen(false);
  };

  const handleClear = () => {
    const params = new URLSearchParams();
    // Only preserve search and source
    if (preserveParams.search) params.set("search", preserveParams.search);
    if (preserveParams.source) params.set("source", preserveParams.source);

    const basePath =
      filterType === "invoices"
        ? "/dashboard/invoices"
        : filterType === "customers"
        ? "/dashboard/customers"
        : "/dashboard/payments";

    router.push(params.toString() ? `${basePath}?${params.toString()}` : basePath);
    setIsOpen(false);
  };

  return (
    <>
      {/* Filter Button (Mobile) */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 min-h-[44px] min-w-[44px]"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        <span>Filters</span>
        {activeFilterCount > 0 && (
          <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 md:hidden"
          onClick={handleBackdropClick}
        >
          {/* Modal Content */}
          <div
            ref={modalRef}
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto animate-slide-up"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Advanced Filters</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 active:text-gray-800"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-4">
              <div className="space-y-4">
                {/* Invoice Filters */}
                {filterType === "invoices" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Due Date From
                      </label>
                      <input
                        type="date"
                        name="dueDateFrom"
                        defaultValue={currentFilters.dueDateFrom}
                        className="w-full px-3 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base min-h-[44px]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Due Date To
                      </label>
                      <input
                        type="date"
                        name="dueDateTo"
                        defaultValue={currentFilters.dueDateTo}
                        className="w-full px-3 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base min-h-[44px]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Min Amount ($)
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        name="minAmount"
                        defaultValue={currentFilters.minAmount}
                        placeholder="0"
                        step="0.01"
                        className="w-full px-3 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base min-h-[44px]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Amount ($)
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        name="maxAmount"
                        defaultValue={currentFilters.maxAmount}
                        placeholder="Unlimited"
                        step="0.01"
                        className="w-full px-3 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base min-h-[44px]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Payment Method
                      </label>
                      <select
                        name="paymentMethod"
                        defaultValue={currentFilters.paymentMethod || ""}
                        className="w-full px-3 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base min-h-[44px]"
                      >
                        <option value="">All</option>
                        <option value="CARD">Card</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                        <option value="CASH">Cash</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Customer Filters */}
                {filterType === "customers" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Balance Status
                      </label>
                      <select
                        name="balanceStatus"
                        defaultValue={currentFilters.balanceStatus || ""}
                        className="w-full px-3 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base min-h-[44px]"
                      >
                        <option value="">All</option>
                        <option value="has-balance">Has Balance</option>
                        <option value="no-balance">No Balance</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Min Invoice Count
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        name="minInvoices"
                        defaultValue={currentFilters.minInvoices}
                        placeholder="0"
                        className="w-full px-3 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base min-h-[44px]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Invoice Count
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        name="maxInvoices"
                        defaultValue={currentFilters.maxInvoices}
                        placeholder="Unlimited"
                        className="w-full px-3 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base min-h-[44px]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Min Total Invoiced ($)
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        name="minTotalInvoiced"
                        defaultValue={currentFilters.minTotalInvoiced}
                        placeholder="0"
                        step="0.01"
                        className="w-full px-3 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base min-h-[44px]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Total Invoiced ($)
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        name="maxTotalInvoiced"
                        defaultValue={currentFilters.maxTotalInvoiced}
                        placeholder="Unlimited"
                        step="0.01"
                        className="w-full px-3 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base min-h-[44px]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Created From
                      </label>
                      <input
                        type="date"
                        name="createdFrom"
                        defaultValue={currentFilters.createdFrom}
                        className="w-full px-3 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base min-h-[44px]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Created To
                      </label>
                      <input
                        type="date"
                        name="createdTo"
                        defaultValue={currentFilters.createdTo}
                        className="w-full px-3 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base min-h-[44px]"
                      />
                    </div>
                  </>
                )}

                {/* Payment Filters */}
                {filterType === "payments" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date From
                      </label>
                      <input
                        type="date"
                        name="dateFrom"
                        defaultValue={currentFilters.dateFrom}
                        className="w-full px-3 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base min-h-[44px]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date To
                      </label>
                      <input
                        type="date"
                        name="dateTo"
                        defaultValue={currentFilters.dateTo}
                        className="w-full px-3 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base min-h-[44px]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Min Amount ($)
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        name="minAmount"
                        defaultValue={currentFilters.minAmount}
                        placeholder="0"
                        step="0.01"
                        className="w-full px-3 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base min-h-[44px]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Amount ($)
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        name="maxAmount"
                        defaultValue={currentFilters.maxAmount}
                        placeholder="Unlimited"
                        step="0.01"
                        className="w-full px-3 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base min-h-[44px]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Payment Method
                      </label>
                      <select
                        name="paymentMethod"
                        defaultValue={currentFilters.paymentMethod || ""}
                        className="w-full px-3 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base min-h-[44px]"
                      >
                        <option value="">All</option>
                        <option value="CARD">Card</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                        <option value="CASH">Cash</option>
                        <option value="CHECK">Check</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Action Buttons (Fixed at bottom) */}
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 -mx-4 -mb-4 mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex-1 px-4 py-3 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 active:bg-gray-100 transition font-medium min-h-[44px]"
                >
                  Clear Filters
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 active:bg-blue-800 transition font-medium min-h-[44px]"
                >
                  Apply Filters
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
