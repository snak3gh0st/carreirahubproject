"use client";

import { useState } from "react";
import { Phone, Loader2 } from "lucide-react";

interface CollectionCallButtonProps {
  invoiceId: string;
  customerPhone: string | null;
  isOverdue: boolean;
  lastCallAt: Date | null;
  callCount: number;
  maxAttempts?: number;
}

export function CollectionCallButton({
  invoiceId,
  customerPhone,
  isOverdue,
  lastCallAt,
  callCount,
  maxAttempts = 3,
}: CollectionCallButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Calculate if call was recent (within 24 hours)
  const wasCalledRecently = lastCallAt
    ? Date.now() - new Date(lastCallAt).getTime() < 24 * 60 * 60 * 1000
    : false;

  // Determine if button should be disabled
  const isDisabled =
    !isOverdue ||
    !customerPhone ||
    wasCalledRecently ||
    callCount >= maxAttempts ||
    isLoading;

  // Get reason for disabled state
  const getDisabledReason = (): string | null => {
    if (!isOverdue) return "Invoice is not overdue";
    if (!customerPhone) return "Customer has no phone number";
    if (callCount >= maxAttempts) return `Maximum attempts (${maxAttempts}) reached`;
    if (wasCalledRecently) return "Wait 24 hours between calls";
    return null;
  };

  const handleCall = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/collection-call`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to initiate call");
      }

      setMessage({
        type: "success",
        text: "Call initiated successfully. The AI agent is calling the customer.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to initiate call",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const disabledReason = getDisabledReason();

  return (
    <div className="space-y-3">
      <button
        onClick={handleCall}
        disabled={isDisabled}
        className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition ${
          isDisabled
            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
            : "bg-orange-600 text-white hover:bg-orange-700"
        }`}
        title={disabledReason || undefined}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Initiating Call...</span>
          </>
        ) : (
          <>
            <Phone className="w-5 h-5" />
            <span>Call to Collect</span>
          </>
        )}
      </button>

      {/* Call statistics */}
      <div className="text-xs text-gray-500 space-y-1">
        <div className="flex justify-between">
          <span>Call attempts:</span>
          <span className={callCount >= maxAttempts ? "text-red-500" : ""}>
            {callCount} / {maxAttempts}
          </span>
        </div>
        {lastCallAt && (
          <div className="flex justify-between">
            <span>Last call:</span>
            <span>
              {new Date(lastCallAt).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}
      </div>

      {/* Disabled reason */}
      {disabledReason && !message && (
        <p className="text-xs text-gray-500 text-center">{disabledReason}</p>
      )}

      {/* Status message */}
      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
