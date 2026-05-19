"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus } from "lucide-react";

interface LineItem {
  description: string;
  amount: number;
  serviceItemId?: string | null;
}

interface EditInvoiceFormProps {
  invoice: {
    id: string;
    invoiceNumber: string | null;
    amount: number;
    dueDate: Date;
    description: string | null;
    quickbooks_invoice_id: string | null;
    quickbooks_sync_token: string | null;
    lineItems: LineItem[];
    isScheduledFutureInstallment: boolean;
  };
}

export function EditInvoiceForm({ invoice }: EditInvoiceFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [amount, setAmount] = useState(Number(invoice.amount));
  const [dueDate, setDueDate] = useState(
    new Date(invoice.dueDate).toISOString().split('T')[0]
  );
  const [description, setDescription] = useState(invoice.description || "");
  const [lineItems, setLineItems] = useState<LineItem[]>(
    invoice.lineItems.length > 0
      ? invoice.lineItems
      : [{ description: "Service", amount: Number(invoice.amount), serviceItemId: null }]
  );

  // Validation state
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Recalculate total when line items change
  useEffect(() => {
    const total = lineItems.reduce((sum, item) => sum + item.amount, 0);
    setAmount(total);
  }, [lineItems]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Amount validation
    if (amount <= 0) {
      errors.amount = "Amount must be greater than 0";
    }

    // Due date validation
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(dueDate);
    selectedDate.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      errors.dueDate = "Due date cannot be in the past";
    }

    // Line items validation
    if (lineItems.length === 0) {
      errors.lineItems = "At least one line item is required";
    }

    lineItems.forEach((item, index) => {
      if (!item.description.trim()) {
        errors[`lineItem_${index}_description`] = "Description is required";
      }
      if (item.amount <= 0) {
        errors[`lineItem_${index}_amount`] = "Amount must be greater than 0";
      }
    });

    // Line items must sum to total (within $0.01 tolerance)
    const lineItemsTotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const diff = Math.abs(lineItemsTotal - amount);
    if (diff > 0.01) {
      errors.lineItems = `Line items total ($${lineItemsTotal.toFixed(2)}) must match invoice amount ($${amount.toFixed(2)})`;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddLineItem = () => {
    setLineItems([...lineItems, { description: "", amount: 0 }]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const handleLineItemChange = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems];
    updated[index] = {
      ...updated[index],
      [field]: field === 'amount' ? Number(value) : value
    };
    setLineItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      setError("Please fix the validation errors below");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          dueDate: new Date(dueDate).toISOString(),
          description: invoice.quickbooks_invoice_id ? description || null : undefined,
          lineItems,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update invoice");
      }

      // Show warning if QB sync failed but local update succeeded
      if (data.qbSyncError) {
        console.warn("QuickBooks sync failed:", data.qbSyncError);
        // Still redirect but could show a toast notification
      }

      // Success - redirect to invoice detail page
      router.push(`/dashboard/invoices/${invoice.id}?updated=true`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to update invoice");
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push(`/dashboard/invoices/${invoice.id}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Alert */}
      {error && (
        <div
          className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg"
          role="alert"
        >
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* QuickBooks Warning */}
      {invoice.quickbooks_invoice_id && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg">
          <p className="font-medium">QuickBooks Synced Invoice</p>
          <p className="text-sm">
            This invoice is synced with QuickBooks (ID: {invoice.quickbooks_invoice_id}). 
            Changes will be automatically synced using QuickBooks sparse update API.
          </p>
          {invoice.quickbooks_sync_token && (
            <p className="text-xs mt-1 text-blue-600">
              SyncToken: {invoice.quickbooks_sync_token}
            </p>
          )}
        </div>
      )}

      {invoice.isScheduledFutureInstallment && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-lg">
          <p className="font-medium">Future installment</p>
          <p className="text-sm">
            This invoice has not been published to QuickBooks yet. Changes made here stay local until it enters the scheduled QB send window.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Amount (read-only, calculated from line items) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Total Amount
          </label>
          <div className="px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-2xl font-bold text-gray-900">
            ${amount.toFixed(2)}
          </div>
          <p className="text-xs text-gray-500 mt-1">Calculated from line items below</p>
        </div>

        {/* Due Date */}
        <div>
          <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-2">
            Due Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="dueDate"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              validationErrors.dueDate ? 'border-red-500' : 'border-gray-300'
            }`}
            aria-describedby={validationErrors.dueDate ? "dueDate-error" : undefined}
            required
          />
          {validationErrors.dueDate && (
            <p id="dueDate-error" className="text-red-600 text-sm mt-1">
              {validationErrors.dueDate}
            </p>
          )}
        </div>
      </div>

      {/* Description */}
      {invoice.quickbooks_invoice_id && (
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            QuickBooks Customer Note
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Optional note to sync to the QuickBooks invoice..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      {/* Line Items */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Line Items <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={handleAddLineItem}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>

        {validationErrors.lineItems && (
          <p className="text-red-600 text-sm mb-2">{validationErrors.lineItems}</p>
        )}

        <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-16">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {lineItems.map((item, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                        placeholder="Item description"
                        className={`w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          validationErrors[`lineItem_${index}_description`] ? 'border-red-500' : 'border-gray-300'
                        }`}
                        aria-describedby={validationErrors[`lineItem_${index}_description`] ? `lineItem-${index}-desc-error` : undefined}
                      />
                      {validationErrors[`lineItem_${index}_description`] && (
                        <p id={`lineItem-${index}-desc-error`} className="text-red-600 text-xs mt-1">
                          {validationErrors[`lineItem_${index}_description`]}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={item.amount}
                        onChange={(e) => handleLineItemChange(index, 'amount', e.target.value)}
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        className={`w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          validationErrors[`lineItem_${index}_amount`] ? 'border-red-500' : 'border-gray-300'
                        }`}
                        aria-describedby={validationErrors[`lineItem_${index}_amount`] ? `lineItem-${index}-amount-error` : undefined}
                      />
                      {validationErrors[`lineItem_${index}_amount`] && (
                        <p id={`lineItem-${index}-amount-error`} className="text-red-600 text-xs mt-1">
                          {validationErrors[`lineItem_${index}_amount`]}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleRemoveLineItem(index)}
                        disabled={lineItems.length === 1}
                        className="text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                        title={lineItems.length === 1 ? "Cannot remove last item" : "Remove item"}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={loading}
          className="inline-flex items-center justify-center px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
